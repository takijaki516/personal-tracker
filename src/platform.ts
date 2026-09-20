import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { engine } from './native-storage';

export const readStored = engine.read;
export const writeStored = engine.write;
export async function exportBackup(raw: string, name: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('이 기기에서는 파일 공유를 사용할 수 없습니다.');
  }
  const file = new File(Paths.cache, name);
  try {
    file.create({ overwrite: true });
    file.write(raw);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: '운동관리 백업 저장',
      UTI: 'public.json',
    });
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
}
export async function importBackup(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) {
    return null;
  }
  const file = new File(result.assets[0].uri);
  try {
    if (file.size > 10_000_000) {
      throw new Error('10MB 이하의 백업 파일을 선택해 주세요.');
    }
    return await file.text();
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
}
