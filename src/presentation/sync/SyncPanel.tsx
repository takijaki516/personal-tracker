import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { registerBackground } from '../../infrastructure/background';
import type { BackupInfo, ConnectionInfo } from '../../infrastructure/desktop-bridge';
import { exportBackup } from '../../infrastructure/platform';
import {
  connect,
  disconnect,
  getConnectionInfo,
  listBackups,
  maintenance,
  readBackup,
  syncNow,
  watchSync,
} from '../../infrastructure/services';
import PairScanner from './PairScanner';

function connectionLabel(info: ConnectionInfo | null): string {
  if (!info?.connected) {
    return '연결된 기기 없음';
  }
  return info.mode === 'desktop' ? 'Android 연결됨' : 'Mac 연결 설정됨';
}

function SyncButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, disabled && { opacity: 0.45 }]}
    >
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}

export default function SyncPanel({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: () => Promise<void>;
}) {
  const [info, setInfo] = useState<ConnectionInfo | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [code, setCode] = useState('');
  const [showCodes, setShowCodes] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [backgroundNote, setBackgroundNote] = useState('');
  const [revision, setRevision] = useState(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const callback = useRef(onChange);
  useLayoutEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  async function refresh() {
    setInfo(await getConnectionInfo());
    setBackups(await listBackups());
  }
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    void registerBackground()
      .then((registered) => {
        if (!registered) {
          setBackgroundNote(
            '백그라운드 실행을 사용할 수 없는 환경입니다. 앱을 열면 백업을 확인합니다.',
          );
        }
      })
      .catch(() =>
        setBackgroundNote('백그라운드 등록에 실패했습니다. 앱 실행 중 백업은 계속 동작합니다.'),
      );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (disabled || !active) {
      return;
    }
    let cancelled = false;
    const update = async () => {
      if (cancelled) {
        return;
      }
      await callback.current();
      if (!cancelled) {
        await refresh();
        setMessage((current) => (current.startsWith('연결 대기 중') ? '' : current));
      }
    };
    const maintain = () => {
      void maintenance()
        .then(async () => {
          if (!cancelled) {
            await refresh();
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setMessage(`자동 백업 실패: ${String(error)}`);
          }
        });
    };
    maintain();
    const stop = watchSync(
      () => {
        void update().catch((error) => {
          if (!cancelled) {
            setMessage(String(error));
          }
        });
      },
      (error) => {
        if (!cancelled) {
          setMessage(`연결 대기 중 · ${error}`);
        }
      },
    );
    const timer = setInterval(maintain, 60000);
    return () => {
      cancelled = true;
      stop();
      clearInterval(timer);
    };
  }, [disabled, active, revision]);
  async function action(run: () => Promise<void>, success: string) {
    setWorking(true);
    setMessage('처리 중…');
    try {
      await run();
      await callback.current();
      await refresh();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  }
  const locked = disabled || working;
  const pair = (value: string) => {
    void action(async () => {
      await connect(value);
      setCode('');
      setRevision((r) => r + 1);
      await syncNow();
    }, 'Mac과 동기화했습니다.');
  };
  return (
    <View style={s.panel}>
      <Text style={s.title}>백업 및 기기 동기화</Text>
      <Text style={s.text}>
        {info?.mode === 'web'
          ? info.note
          : '기록은 이 기기의 SQLite에 저장합니다. 같은 Wi-Fi에서 내 기기와 동기화할 수 있어요.'}
      </Text>
      {info?.mode !== 'web' && (
        <>
          <Text style={s.text}>
            {connectionLabel(info)} · 마지막 동기화:{' '}
            {info?.lastSync ? new Date(info.lastSync).toLocaleString() : '아직 없음'}
          </Text>
          {!!info?.note && <Text style={s.text}>{info.note}</Text>}
          <View style={s.row}>
            <SyncButton
              disabled={locked}
              label={working ? '처리 중…' : '지금 동기화'}
              onPress={() => {
                void action(syncNow, '동기화했습니다.');
              }}
            />
            <SyncButton
              disabled={locked}
              label={showCodes ? '기기 연결 닫기' : '기기 연결'}
              onPress={() => setShowCodes(!showCodes)}
            />
            <SyncButton
              disabled={locked}
              label={showBackups ? '백업 목록 닫기' : '자동 백업 목록'}
              onPress={() => {
                setShowBackups(!showBackups);
                void refresh().catch((error) => setMessage(String(error)));
              }}
            />
          </View>
          {showCodes && (
            <View style={s.box}>
              {info?.mode === 'desktop' ? (
                <>
                  <Text style={s.text}>
                    Android 앱에서 아래 QR 코드를 스캔하세요. 연결 코드에는 접근 키가 포함되어
                    있으니 다른 사람에게 공유하지 마세요.
                  </Text>
                  {info.codes.map((value) => (
                    <View
                      key={value}
                      style={{
                        gap: 12,
                        marginTop: 12,
                      }}
                    >
                      <QRCode value={value} size={180} />
                      <Text selectable style={s.text}>
                        {value}
                      </Text>
                    </View>
                  ))}
                  <Text style={s.text}>
                    Mac의 네트워크 주소가 바뀌면 다시 스캔하세요. 여러 코드가 보이면 Wi-Fi 주소의
                    코드를 사용하세요.
                  </Text>
                  <SyncButton
                    disabled={locked}
                    label={'연결 키 재발급 · 기존 기기 해제'}
                    onPress={() => {
                      void action(
                        disconnect,
                        '기존 연결을 해제했습니다. 새 QR 코드로 연결해 주세요.',
                      );
                    }}
                  />
                </>
              ) : (
                <>
                  {!locked && <PairScanner onScan={pair} />}
                  <TextInput
                    accessibilityLabel="Mac 연결 코드"
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="exercise://…"
                    multiline
                    style={s.input}
                  />
                  <View style={s.row}>
                    <SyncButton
                      disabled={locked}
                      label={'연결 코드로 연결'}
                      onPress={() => pair(code)}
                    />
                    <SyncButton
                      disabled={locked}
                      label={'Mac 연결 해제'}
                      onPress={() => {
                        void action(async () => {
                          await disconnect();
                          setRevision((r) => r + 1);
                        }, 'Mac 연결을 해제했습니다.');
                      }}
                    />
                  </View>
                </>
              )}
            </View>
          )}
          {showBackups && (
            <View style={s.box}>
              <Text style={s.text}>
                하루에 한 번 전체 기록을 보관합니다. 목록에서 내보낸 파일은 ‘백업 복원’으로 복구할
                수 있어요.
              </Text>
              <Text selectable style={s.small}>
                {info?.backupPath}
              </Text>
              {!backups.length && <Text style={s.text}>아직 자동 백업이 없습니다.</Text>}
              {backups.slice(0, 60).map((item) => (
                <View key={item.name} style={s.row}>
                  <Text style={[s.small, { flex: 1 }]}>{item.name}</Text>
                  <SyncButton
                    disabled={locked}
                    label={'내보내기'}
                    onPress={() => {
                      void action(async () => {
                        await exportBackup(await readBackup(item.name), item.name);
                      }, '백업 내보내기를 마쳤습니다.');
                    }}
                  />
                </View>
              ))}
              {backups.length > 60 && (
                <Text style={s.small}>최근 60개를 표시합니다. 이전 백업도 저장되어 있습니다.</Text>
              )}
            </View>
          )}
          <Text style={s.small}>
            자동 동기화는 두 앱이 실행 중일 때 약 25초 간격으로 확인합니다. Mac은 켜져 있어야
            합니다. 종료·절전 중 놓친 백업은 다음 실행 때 현재 기록으로 생성합니다.
          </Text>
          {info?.mode === 'android' && !!backgroundNote && (
            <Text style={s.small}>{backgroundNote}</Text>
          )}
        </>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {message}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  panel: {
    marginTop: 24,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dce3d5',
    backgroundColor: '#fff',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2f4536',
  },
  text: {
    fontSize: 13,
    lineHeight: 22,
    color: '#52654b',
  },
  small: {
    fontSize: 11,
    lineHeight: 19,
    color: '#6e7c65',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    padding: 12,
    minHeight: 44,
    backgroundColor: '#eaf0df',
    borderRadius: 8,
  },
  buttonText: {
    color: '#245d48',
    fontSize: 12,
  },
  box: {
    backgroundColor: '#f6f7f2',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  input: {
    minHeight: 60,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dce3d5',
    borderRadius: 8,
    backgroundColor: '#fff',
    color: '#263a30',
  },
});
