/**
 * 实时行情 IPC 处理器
 */
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import * as quoteService from '../services/quote-service';
import { writeLog } from '../index';

export function registerQuoteHandlers(): void {
  // 获取实时行情
  ipcMain.handle(IPC_CHANNELS.QUOTE_GET, async (_, symbols: string[]) => {
    try {
      writeLog('[IPC] QUOTE_GET called with symbols:', symbols);
      if (!symbols || symbols.length === 0) {
        return { success: true, data: [] };
      }
      const quotes = await quoteService.getQuotes(symbols);
      writeLog('[IPC] QUOTE_GET returned quotes:', quotes.length);
      return { success: true, data: quotes };
    } catch (error: any) {
      writeLog('[IPC] Quote API error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.QUOTE_FX_RATES, async () => {
    try {
      const rates = await quoteService.getFxRates();
      return { success: true, data: rates };
    } catch (error: any) {
      writeLog('FX API error:', error);
      return { success: false, error: error.message };
    }
  });
}
