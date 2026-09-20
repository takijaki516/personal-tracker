import { STORAGE_KEY } from './data';
import type {} from './desktop-bridge';

// Keep the original PWA key: existing records survive on the same web origin.
export async function readStored(): Promise<string | null> {
  return window.exerciseDesktop ? window.exerciseDesktop.read() : localStorage.getItem(STORAGE_KEY);
}
export async function writeStored(raw: string, base?: string): Promise<void> {
  if (window.exerciseDesktop) {
    await window.exerciseDesktop.write(raw, base);
  } else {
    localStorage.setItem(STORAGE_KEY, raw);
  }
}
export async function exportBackup(raw: string, name: string): Promise<void> {
  if (window.exerciseDesktop) {
    return window.exerciseDesktop.export(raw, name);
  }
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function importBackup(): Promise<string | null> {
  if (window.exerciseDesktop) {
    return window.exerciseDesktop.import();
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) {
          return resolve(null);
        }
        if (file.size > 10_000_000) {
          throw new Error('10MB 이하의 백업 파일을 선택해 주세요.');
        }
        resolve(await file.text());
      } catch (error) {
        reject(error);
      }
    };
    input.click();
  });
}
