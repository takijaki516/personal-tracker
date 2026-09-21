import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { parseStore } from '../../domain/data';

export const backupDirectory = () => new Directory(Paths.document, 'backups');

export function backupFiles() {
  const dir = backupDirectory();
  return dir.exists
    ? dir
        .list()
        .filter((file): file is File => file instanceof File && file.name.endsWith('.json'))
        .map((file) => ({ name: file.name }))
        .sort((a, b) => b.name.localeCompare(a.name))
    : [];
}

export async function readBackupFile(name: string) {
  if (!backupFiles().some((file) => file.name === name)) {
    throw new Error('백업 파일을 찾을 수 없습니다.');
  }
  const file = new File(backupDirectory(), name);
  if (file.size > 10_000_000) {
    throw new Error('백업 파일이 너무 큽니다.');
  }
  const raw = await file.text();
  parseStore(raw);
  return raw;
}

export async function writeBackup(day: string, raw: string, reason?: string) {
  const dir = backupDirectory();
  dir.create({
    idempotent: true,
    intermediates: true,
  });
  const target = new File(dir, `운동관리-${day}${reason ? `-${reason}` : ''}.json`);
  if (target.exists) {
    return;
  }
  const temp = new File(dir, `${Crypto.randomUUID()}.tmp`);
  try {
    temp.create();
    temp.write(raw);
    temp.move(target);
  } finally {
    if (temp.exists && temp.uri !== target.uri) {
      temp.delete();
    }
  }
}
