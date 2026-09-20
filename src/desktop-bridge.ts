export type ConnectionInfo = {
  mode: 'desktop' | 'android' | 'web';
  codes: string[];
  connected: boolean;
  lastSync: string | null;
  backupPath: string;
  note?: string;
};
export type BackupInfo = { name: string };
export type DesktopBridge = {
  read(): Promise<string>;
  write(raw: string, base?: string): Promise<void>;
  restore(raw: string): Promise<void>;
  maintenance(): Promise<void>;
  info(): Promise<ConnectionInfo>;
  sync(): Promise<void>;
  disconnect(): Promise<void>;
  backups(): Promise<BackupInfo[]>;
  backupRead(name: string): Promise<string>;
  export(raw: string, name: string): Promise<void>;
  import(): Promise<string | null>;
};
declare global {
  interface Window {
    exerciseDesktop?: DesktopBridge;
  }
}
