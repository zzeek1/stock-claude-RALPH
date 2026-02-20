import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app, dialog, Notification, safeStorage } from 'electron';
import { getDbPath, getDb, forceSaveDb } from '../database/connection';
import { getAllSettings } from './settings-service';
import type { CloudBackupConfig } from '../../shared/types';

const MAX_AUTO_BACKUPS = 7;
const DAILY_INTERVAL = 24 * 60 * 60 * 1000;
const WEEKLY_INTERVAL = 7 * 24 * 60 * 60 * 1000;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export async function exportDatabase(): Promise<string> {
  forceSaveDb();
  
  const defaultPath = path.join(
    app.getPath('documents'),
    `stock-claude-backup-${new Date().toISOString().slice(0, 10)}.db`
  );
  
  const result = await dialog.showSaveDialog({
    title: '备份数据库',
    defaultPath,
    filters: [{ name: 'Database', extensions: ['db'] }],
  });
  
  if (result.canceled || !result.filePath) {
    throw new Error('用户取消');
  }
  
  const sourcePath = getDbPath();
  fs.copyFileSync(sourcePath, result.filePath);
  
  return result.filePath;
}

export async function importDatabase(): Promise<boolean> {
  const result = await dialog.showOpenDialog({
    title: '恢复数据库',
    filters: [{ name: 'Database', extensions: ['db'] }],
    properties: ['openFile'],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    throw new Error('用户取消');
  }
  
  const backupPath = result.filePaths[0];
  const currentPath = getDbPath();
  forceSaveDb();
  
  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const autoBackupPath = path.join(backupDir, `auto-backup-${timestamp}.db`);
  fs.copyFileSync(currentPath, autoBackupPath);
  
  fs.copyFileSync(backupPath, currentPath);
  
  return true;
}

export function getBackupDir(): string {
  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

export interface BackupInfo {
  name: string;
  path: string;
  time: number;
  size: number;
}

export function listBackups(): BackupInfo[] {
  const backupDir = getBackupDir();
  try {
    return fs.readdirSync(backupDir)
      .filter(f => f.startsWith('auto-backup-') && f.endsWith('.db'))
      .map(f => {
        const filePath = path.join(backupDir, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          path: filePath,
          time: stats.mtime.getTime(),
          size: stats.size,
        };
      })
      .sort((a, b) => b.time - a.time);
  } catch {
    return [];
  }
}

export async function autoBackup(): Promise<string> {
  const backupDir = getBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `auto-backup-${timestamp}.db`);
  
  forceSaveDb();
  const sourcePath = getDbPath();
  fs.copyFileSync(sourcePath, backupPath);
  
  cleanOldBackups(backupDir);
  
  return backupPath;
}

function cleanOldBackups(backupDir: string): void {
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('auto-backup-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  
  if (files.length > MAX_AUTO_BACKUPS) {
    for (let i = MAX_AUTO_BACKUPS; i < files.length; i++) {
      fs.unlinkSync(files[i].path);
    }
  }
}

export function shouldAutoBackup(): boolean {
  const settings = getAllSettings();

  // Check if auto-backup is enabled
  if (!settings.auto_backup_enabled) {
    return false;
  }

  const backupDir = getBackupDir();
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('auto-backup-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) return true;

  const lastBackup = files[0].time;
  const now = Date.now();

  // Use settings for interval (daily or weekly)
  const interval = settings.auto_backup_frequency === 'weekly' ? WEEKLY_INTERVAL : DAILY_INTERVAL;

  return (now - lastBackup) > interval;
}

export function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      silent: false,
    }).show();
  }
}

// ===== 云备份功能 =====

function getEncryptionKey(): Buffer | null {
  // Try to use Electron's safeStorage for encryption
  if (safeStorage.isEncryptionAvailable()) {
    // Use a fixed key derived from machine ID
    const machineId = process.env.COMPUTERNAME || process.env.HOSTNAME || 'stock-claude-default';
    const key = crypto.createHash('sha256').update(machineId).digest();
    return key;
  }
  return null;
}

function encryptData(data: Buffer): Buffer {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('加密不可用');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: IV (16 bytes) + AuthTag (16 bytes) + Encrypted data
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptData(encryptedData: Buffer): Buffer {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('加密不可用');
  }

  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export async function exportEncryptedBackup(): Promise<string> {
  forceSaveDb();

  const defaultPath = path.join(
    app.getPath('documents'),
    `stock-claude-backup-${new Date().toISOString().slice(0, 10)}.enc`
  );

  const result = await dialog.showSaveDialog({
    title: '导出加密备份',
    defaultPath,
    filters: [{ name: 'Encrypted Backup', extensions: ['enc'] }],
  });

  if (result.canceled || !result.filePath) {
    throw new Error('用户取消');
  }

  const sourcePath = getDbPath();
  const dbData = fs.readFileSync(sourcePath);
  const encryptedData = encryptData(dbData);
  fs.writeFileSync(result.filePath, encryptedData);

  return result.filePath;
}

export async function importEncryptedBackup(): Promise<boolean> {
  const result = await dialog.showOpenDialog({
    title: '导入加密备份',
    filters: [{ name: 'Encrypted Backup', extensions: ['enc'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    throw new Error('用户取消');
  }

  const backupPath = result.filePaths[0];
  const currentPath = getDbPath();
  forceSaveDb();

  // Create a local backup before restoring
  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const autoBackupPath = path.join(backupDir, `pre-restore-${timestamp}.db`);
  fs.copyFileSync(currentPath, autoBackupPath);

  // Decrypt and restore
  const encryptedData = fs.readFileSync(backupPath);
  const decryptedData = decryptData(encryptedData);
  fs.writeFileSync(currentPath, decryptedData);

  return true;
}

export async function syncToCloudFolder(config: CloudBackupConfig): Promise<string> {
  if (!config.folder_path) {
    throw new Error('未配置云同步文件夹');
  }

  forceSaveDb();
  const sourcePath = getDbPath();
  const dbData = fs.readFileSync(sourcePath);

  // Encrypt if needed
  const dataToSave = config.encrypted ? encryptData(dbData) : dbData;

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 10);
  const ext = config.encrypted ? '.enc' : '.db';
  const fileName = `stock-claude-backup-${timestamp}${ext}`;
  const destPath = path.join(config.folder_path, fileName);

  // Ensure folder exists
  if (!fs.existsSync(config.folder_path)) {
    fs.mkdirSync(config.folder_path, { recursive: true });
  }

  fs.writeFileSync(destPath, dataToSave);

  return destPath;
}
