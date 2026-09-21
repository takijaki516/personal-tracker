import { useEffect, useRef, useState } from 'react';

import { loadRecords, saveRecords } from '../../application/record-repository';
import { emptyStore, type Day, type Store } from '../../domain/data';
import { readStored, writeStored } from '../../infrastructure/platform';
import { restoreStored } from '../../infrastructure/services';

const storage = { read: readStored, write: writeStored };
export type SaveResult = { ok: boolean; error?: string };
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : '작업을 완료하지 못했습니다.';

export function useTrackerRecords() {
  const [data, setData] = useState<Store>(emptyStore);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const saving = useRef(false);
  const dataRevision = useRef(0);

  useEffect(() => {
    let active = true;
    loadRecords(storage)
      .then((value) => {
        if (active) {
          setData(value);
        }
      })
      .catch(() => {
        if (active) {
          setBlocked(true);
          setMessage(
            '저장된 기록을 읽을 수 없어 저장을 중지했습니다. 기존 데이터를 확인하거나 올바른 백업을 복원해 주세요.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function persist(next: Store, restoring = false): Promise<SaveResult> {
    if (saving.current || !loaded) {
      return { ok: false };
    }
    if (blocked && !restoring) {
      setMessage('기존 기록을 보호하기 위해 저장이 중지되었습니다. 백업을 복원해 주세요.');
      return { ok: false };
    }
    saving.current = true;
    dataRevision.current++;
    setBusy(true);
    try {
      if (restoring) {
        await restoreStored(JSON.stringify(next));
      } else {
        await saveRecords(storage, next, data);
      }
      setData(await loadRecords(storage));
      setBlocked(false);
      setMessage(restoring ? '백업을 복원했어요.' : '기록을 저장했어요.');
      return { ok: true };
    } catch (error) {
      const text = `저장하지 못했습니다. ${errorText(error)}`;
      setMessage(text);
      return { ok: false, error: text };
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function updateDay(next: Day, target: string) {
    return persist({ ...data, days: { ...data.days, [target]: next } });
  }

  async function refresh() {
    if (!saving.current) {
      const revision = dataRevision.current;
      const latest = await loadRecords(storage);
      if (!saving.current && dataRevision.current === revision) {
        setData(latest);
      }
    }
  }

  return { data, loaded, blocked, busy, message, setMessage, updateDay, persist, refresh };
}
