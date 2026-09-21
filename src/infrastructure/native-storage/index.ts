import { createEngine } from '../../application/local-engine';
import { nativeStorageAdapter } from './adapter';

export { backupDirectory, backupFiles, readBackupFile } from './backups';
export { db, setting, setSetting } from './database';

export const engine = createEngine(nativeStorageAdapter);
