import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync, chmodSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { app, BrowserWindow, ipcMain, dialog, protocol, net, safeStorage } from 'electron';

import { parseStore } from '../src/data';
import type { ConnectionInfo } from '../src/desktop-bridge';
import { encodeBytes, pairingText } from '../src/wire';
import { createLanServer } from './lan-server';
import { openStorage } from './storage';

protocol.registerSchemesAsPrivileged([
  { scheme: 'exercise-app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
app.setName('운동관리');
const smokeDir = process.env.EXERCISE_SMOKE_DIR;
app.setPath('userData', smokeDir || join(app.getPath('appData'), 'ExerciseTracker'));
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app
    .whenReady()
    .then(async () => {
      const store = openStorage(app.getPath('userData'));
      const secretFile = join(app.getPath('userData'), 'pairing.key');
      let secret = '';
      const rotate = () => {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error('macOS 키 저장소를 사용할 수 없습니다.');
        }
        secret = encodeBytes(randomBytes(32));
        writeFileSync(secretFile, safeStorage.encryptString(secret), { mode: 0o600 });
        chmodSync(secretFile, 0o600);
      };
      let serverError = '';
      try {
        if (existsSync(secretFile)) {
          secret = safeStorage.decryptString(readFileSync(secretFile));
        } else {
          rotate();
        }
      } catch (error) {
        serverError = `연결 키를 열지 못했습니다: ${String(error)}`;
      }
      const lan = createLanServer(
        store.engine,
        () => secret,
        () => store.set('lastSync', new Date().toISOString()),
      );
      if (secret) {
        await new Promise<void>((resolve) => {
          lan.server.once('error', (error) => {
            serverError = `Wi-Fi 수신 서버 오류: ${error.message}`;
            resolve();
          });
          lan.server.listen(47831, '0.0.0.0', resolve);
        });
      }
      let backupError = '';
      const maintenance = async () => {
        try {
          await store.engine.dailyBackup();
          backupError = '';
        } catch (error) {
          backupError = `자동 백업 실패: ${String(error)}`;
          throw error;
        }
      };
      void maintenance().catch(() => {});
      const timer = setInterval(() => void maintenance().catch(() => {}), 60000);
      const root = resolve(__dirname, '../dist');
      protocol.handle('exercise-app', async (request) => {
        const url = new URL(request.url);
        if (url.host !== 'app') {
          return new Response('Forbidden', { status: 403 });
        }
        const target = resolve(
          root,
          `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`,
        );
        if (!target.startsWith(root + sep)) {
          return new Response('Forbidden', { status: 403 });
        }
        const response = await net.fetch(pathToFileURL(target).href);
        response.headers.set(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'",
        );
        return response;
      });
      let window: BrowserWindow;
      const development = !app.isPackaged && process.argv.includes('--dev');
      const trusted = (url: string) =>
        development
          ? new URL(url).origin === 'http://localhost:8081'
          : url.startsWith('exercise-app://app/');
      function handle(name: string, fn: (...args: unknown[]) => unknown) {
        ipcMain.handle(name, (event, ...args) => {
          if (
            !window ||
            event.sender !== window.webContents ||
            event.senderFrame !== window.webContents.mainFrame ||
            !trusted(event.senderFrame.url)
          ) {
            throw new Error('Untrusted renderer');
          }
          return fn(...args);
        });
      }
      const validRaw = (raw: unknown) => {
        if (typeof raw !== 'string' || Buffer.byteLength(raw) > 10_000_000) {
          throw new Error('백업 파일은 10MB 이하여야 합니다.');
        }
        parseStore(raw);
        return raw;
      };
      handle('records:read', () => store.engine.read());
      handle('records:write', async (raw, base) => {
        await store.engine.write(validRaw(raw), base === undefined ? undefined : validRaw(base));
        lan.wake();
      });
      handle('records:restore', async (raw) => {
        await store.engine.restore(validRaw(raw));
        lan.wake();
      });
      handle('maintenance', maintenance);
      handle('connection:info', (): ConnectionInfo => {
        const hosts = Object.values(networkInterfaces())
          .flat()
          .filter((x) => x && x.family === 'IPv4' && !x.internal)
          .map((x) => x!.address)
          .filter((ip) => /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip));
        return {
          mode: 'desktop',
          codes:
            !serverError && secret
              ? hosts.map((host) => pairingText({ host, port: 47831, key: secret }))
              : [],
          connected: lan.active(),
          lastSync: store.get('lastSync'),
          backupPath: store.backupPath,
          note:
            serverError ||
            backupError ||
            (!hosts.length ? '로컬 Wi-Fi에 연결해 주세요.' : undefined),
        };
      });
      handle('connection:sync', () => {
        if (serverError) {
          throw new Error(serverError);
        }
        return lan.requestSync();
      });
      handle('connection:disconnect', () => {
        rotate();
        lan.reset();
      });
      handle('backups:list', store.backups);
      handle('backups:read', (name) => {
        if (typeof name !== 'string') {
          throw new Error('파일명이 올바르지 않습니다.');
        }
        return store.backupRead(name);
      });
      handle('backup:export', async (raw, name) => {
        const content = validRaw(raw);
        if (typeof name !== 'string' || !/^[^/\\]{1,150}\.json$/.test(name)) {
          throw new Error('파일명이 올바르지 않습니다.');
        }
        const result = await dialog.showSaveDialog(window, {
          defaultPath: name,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (!result.canceled && result.filePath) {
          writeFileSync(result.filePath, content, { mode: 0o600 });
        }
      });
      handle('backup:import', async () => {
        const result = await dialog.showOpenDialog(window, {
          properties: ['openFile'],
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (result.canceled) {
          return null;
        }
        if (statSync(result.filePaths[0]).size > 10_000_000) {
          throw new Error('백업 파일은 10MB 이하여야 합니다.');
        }
        return validRaw(readFileSync(result.filePaths[0], 'utf8'));
      });
      function createWindow() {
        window = new BrowserWindow({
          width: 1200,
          height: 860,
          minWidth: 640,
          minHeight: 600,
          title: '운동관리',
          show: !smokeDir,
          webPreferences: {
            preload: join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.webContents.on('will-navigate', (event, url) => {
          if (!trusted(url)) {
            event.preventDefault();
          }
        });
        window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) =>
          callback(false),
        );
        void window.loadURL(
          development ? 'http://localhost:8081' : 'exercise-app://app/index.html',
        );
        if (smokeDir) {
          window.webContents.on('did-finish-load', async () => {
            try {
              const result = await window.webContents.executeJavaScript(`(async () => {
            for (let i = 0; i < 100 && !document.body.innerText.includes('백업 및 기기 동기화'); i++) await new Promise(r => setTimeout(r, 100));
            return { title: document.body.innerText, data: await window.exerciseDesktop.read(), info: await window.exerciseDesktop.info() };
          })()`);
              window.showInactive();
              await new Promise((resolve) => setTimeout(resolve, 600));
              writeFileSync(
                join(smokeDir, 'screen.png'),
                (await window.webContents.capturePage()).toPNG(),
              );
              await window.webContents.executeJavaScript(
                `document.querySelectorAll('*').forEach(el => { if (el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto') el.scrollTop = el.scrollHeight; });`,
              );
              await new Promise((resolve) => setTimeout(resolve, 300));
              writeFileSync(
                join(smokeDir, 'sync-screen.png'),
                (await window.webContents.capturePage()).toPNG(),
              );
              writeFileSync(join(smokeDir, 'smoke-result.json'), JSON.stringify(result));
              app.exit(result.title.includes('백업 및 기기 동기화') ? 0 : 1);
            } catch (error) {
              writeFileSync(join(smokeDir, 'smoke-error.txt'), String(error));
              app.exit(1);
            }
          });
          setTimeout(() => app.exit(2), 30000);
        }
      }
      createWindow();
      // Keep the LAN receiver and daily backup timer alive when the Mac window is closed.
      app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
          app.quit();
        }
      });
      app.on('activate', () => {
        if (!BrowserWindow.getAllWindows().length) {
          createWindow();
        }
      });
      app.on('second-instance', () => {
        if (!BrowserWindow.getAllWindows().length) {
          createWindow();
        }
        window.show();
        window.focus();
      });
      app.on('before-quit', () => {
        clearInterval(timer);
        lan.close();
      });
    })
    .catch((error) => {
      dialog.showErrorBox('운동관리 시작 실패', String(error));
      app.exit(1);
    });
}
