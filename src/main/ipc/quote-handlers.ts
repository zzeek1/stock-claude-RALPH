/**
 * 实时行情 IPC 处理器
 */
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import * as quoteService from '../services/quote-service';

export function registerQuoteHandlers(): void {
  // 获取实时行情
  ipcMain.handle(IPC_CHANNELS.QUOTE_GET, async (_, symbols: string[]) => {
    try {
      if (!symbols || symbols.length === 0) {
        return { success: true, data: [] };
      }
      const quotes = await quoteService.getQuotes(symbols);
      return { success: true, data: quotes };
    } catch (error: any) {
      console.error('Quote API error:', error);
      return { success: false, error: error.message };
    }
  });
}
