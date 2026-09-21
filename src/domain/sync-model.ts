import { emptyDay, emptyStore, isDate, parseStore, type Store } from './data';

export type Entry = {
  date: string;
  kind: 'meal' | 'workout' | 'weight';
  id: string;
  value: unknown;
  counter: number;
  device: string;
};

export type SyncDocument = {
  schema: 1;
  device: string;
  clock: number;
  entries: Record<string, Entry>;
};

export const entryKey = (e: Pick<Entry, 'date' | 'kind' | 'id'>) =>
  JSON.stringify([e.date, e.kind, e.id]);
export const newDocument = (device: string): SyncDocument => ({
  schema: 1,
  device,
  clock: 0,
  entries: {},
});
function order(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
const validId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 100;

export function snapshot(doc: SyncDocument): Store {
  const store = emptyStore();
  for (const [, e] of Object.entries(doc.entries).sort(([a], [b]) => order(a, b))) {
    if (e.value === null) {
      continue;
    }
    const day = (store.days[e.date] ??= emptyDay());
    if (e.kind === 'weight') {
      day.weight = e.value as number;
    }
    if (e.kind === 'meal') {
      day.meals.push(e.value as (typeof day.meals)[number]);
    }
    if (e.kind === 'workout') {
      day.workouts.push(e.value as (typeof day.workouts)[number]);
    }
  }
  return parseStore(JSON.stringify(store));
}

export function parseDocument(raw: string): SyncDocument {
  if (raw.length > 10_000_000) {
    throw new Error('동기화 데이터가 10MB를 초과합니다.');
  }
  const d = JSON.parse(raw);
  if (
    !d ||
    d.schema !== 1 ||
    !validId(d.device) ||
    !Number.isSafeInteger(d.clock) ||
    d.clock < 0 ||
    d.clock > Number.MAX_SAFE_INTEGER - 100000 ||
    !d.entries ||
    typeof d.entries !== 'object' ||
    Array.isArray(d.entries)
  ) {
    throw new Error('올바르지 않은 동기화 데이터입니다.');
  }
  if (Object.keys(d.entries).length > 50000) {
    throw new Error('동기화 기록 수가 너무 많습니다.');
  }
  for (const [key, e] of Object.entries(d.entries) as [string, Entry][]) {
    if (
      !e ||
      !isDate(e.date) ||
      !['meal', 'workout', 'weight'].includes(e.kind) ||
      !validId(e.id) ||
      !validId(e.device) ||
      !Number.isSafeInteger(e.counter) ||
      e.counter < 0 ||
      e.counter > d.clock ||
      key !== entryKey(e)
    ) {
      throw new Error('올바르지 않은 동기화 기록입니다.');
    }
    if (e.kind === 'weight' && e.id !== 'weight') {
      throw new Error('체중 기록 키가 올바르지 않습니다.');
    }
    if (
      e.value !== null &&
      e.kind !== 'weight' &&
      (typeof e.value !== 'object' || (e.value as { id?: string }).id !== e.id)
    ) {
      throw new Error('기록 ID가 일치하지 않습니다.');
    }
  }
  snapshot(d);
  return d;
}

function flatten(store: Store): Record<string, Omit<Entry, 'counter' | 'device'>> {
  const result: ReturnType<typeof flatten> = {};
  for (const [date, day] of Object.entries(store.days)) {
    for (const [kind, values] of [
      ['meal', day.meals],
      ['workout', day.workouts],
    ] as const) {
      for (const value of values) {
        const e = {
          date,
          kind,
          id: value.id,
          value,
        };
        result[entryKey(e)] = e;
      }
    }
    if (day.weight !== null) {
      const e = {
        date,
        kind: 'weight' as const,
        id: 'weight',
        value: day.weight,
      };
      result[entryKey(e)] = e;
    }
  }
  return result;
}

// Apply only changes made by this editor, preserving remote changes to other records.
export function editDocument(doc: SyncDocument, before: Store, after: Store): SyncDocument {
  parseStore(JSON.stringify(after));
  const a = flatten(before),
    b = flatten(after);
  const next = {
    ...doc,
    entries: { ...doc.entries },
  };
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[key]?.value) === JSON.stringify(b[key]?.value)) {
      continue;
    }
    const e = b[key] ?? {
      ...a[key],
      value: null,
    };
    next.entries[key] = {
      ...e,
      counter: ++next.clock,
      device: doc.device,
    };
  }
  return parseDocument(JSON.stringify(next));
}

export function mergeDocuments(local: SyncDocument, remote: SyncDocument): SyncDocument {
  const next: SyncDocument = {
    ...local,
    clock: Math.max(local.clock, remote.clock),
    entries: { ...local.entries },
  };
  for (const [key, incoming] of Object.entries(remote.entries)) {
    const old = next.entries[key];
    const compare = !old
      ? 1
      : incoming.counter - old.counter ||
        order(incoming.device, old.device) ||
        order(JSON.stringify(incoming.value), JSON.stringify(old.value));
    if (compare > 0) {
      next.entries[key] = incoming;
    }
  }
  return parseDocument(JSON.stringify(next));
}

export function migrateStore(store: Store, device: string): SyncDocument {
  // Deterministic initial versions avoid duplicating legacy records on first pairing.
  const entries = Object.fromEntries(
    Object.entries(flatten(store)).map(([key, e]) => [
      key,
      {
        ...e,
        counter: 0,
        device: 'legacy',
      },
    ]),
  );
  return parseDocument(
    JSON.stringify({
      schema: 1,
      device,
      clock: 0,
      entries,
    }),
  );
}
