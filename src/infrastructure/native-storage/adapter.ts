import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { LocalAdapter } from '../../application/local-engine';
import { STORAGE_KEY } from '../../domain/data';
import { writeBackup } from './backups';
import { commitDocument, loadDocument } from './database';

export const nativeStorageAdapter: LocalAdapter = {
  uuid: Crypto.randomUUID,
  legacy: () => AsyncStorage.getItem(STORAGE_KEY),
  load: loadDocument,
  commit: commitDocument,
  backup: writeBackup,
};
