import type { ConnectionInfo } from './desktop-bridge';
import { writeStored } from './platform.web';

export async function restoreStored(raw: string) {
  if (window.exerciseDesktop) {
    await window.exerciseDesktop.restore(raw);
  } else {
    await writeStored(raw);
  }
}
export async function maintenance() {
  await window.exerciseDesktop?.maintenance();
}
export async function getConnectionInfo(): Promise<ConnectionInfo> {
  return window.exerciseDesktop
    ? window.exerciseDesktop.info()
    : {
        mode: 'web',
        codes: [],
        connected: false,
        lastSync: null,
        backupPath: '',
        note: '브라우저 미리보기입니다. SQLite·자동 백업·Wi-Fi 동기화는 설치 앱에서 사용할 수 있어요.',
      };
}
export async function connect(_code: string) {
  throw new Error('Mac에 표시된 연결 코드를 Android 앱에 입력해 주세요.');
}
export async function disconnect() {
  await window.exerciseDesktop?.disconnect();
}
export async function syncNow() {
  if (!window.exerciseDesktop) {
    throw new Error('설치 앱에서 동기화할 수 있습니다.');
  }
  await window.exerciseDesktop.sync();
}
export async function listBackups() {
  return window.exerciseDesktop?.backups() ?? [];
}
export async function readBackup(name: string) {
  if (!window.exerciseDesktop) {
    throw new Error('설치 앱에서 사용할 수 있습니다.');
  }
  return window.exerciseDesktop.backupRead(name);
}
export function watchSync(onChange: () => void, _onError: (message: string) => void) {
  const timer = setInterval(onChange, 3000);
  return () => clearInterval(timer);
}
