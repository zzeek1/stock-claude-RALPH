import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { previewImport, importTrades, getImportLogs, ImportPreview, ImportResult } from '../services/import-service';

export function registerImportHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.IMPORT_PREVIEW, async (_event, content: string): Promise<{ success: boolean; data?: ImportPreview; error?: string }> => {
    try {
      const preview = previewImport(content);
      return { success: true, data: preview };
    } catch (error: any) {
      return { success: false, error: error.message || '预览失败' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_TRADES, async (_event, content: string, fieldMapping: any, defaultValues?: any): Promise<{ success: boolean; data?: ImportResult; error?: string }> => {
    try {
      const result = importTrades(content, fieldMapping, defaultValues);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || '导入失败' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_LOGS, async (): Promise<{ success: boolean; data?: any[]; error?: string }> => {
    try {
      const logs = getImportLogs();
      return { success: true, data: logs };
    } catch (error: any) {
      return { success: false, error: error.message || '获取日志失败' };
    }
  });
}
