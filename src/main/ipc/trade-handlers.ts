import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import * as tradeService from '../services/trade-service';
import { exportTradesToCsv, exportPdfReport } from '../services/export-service';

export function registerTradeHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TRADE_CREATE, async (_, trade) => {
    try {
      return { success: true, data: tradeService.createTrade(trade) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TRADE_UPDATE, async (_, id, updates) => {
    try {
      return { success: true, data: tradeService.updateTrade(id, updates) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TRADE_DELETE, async (_, id) => {
    try {
      return { success: true, data: tradeService.deleteTrade(id) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TRADE_GET, async (_, id) => {
    try {
      return { success: true, data: tradeService.getTrade(id) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TRADE_LIST, async (_, filter) => {
    try {
      return { success: true, data: tradeService.listTrades(filter) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TRADE_GET_RELATED, async (_, id) => {
    try {
      return { success: true, data: tradeService.getRelatedTrades(id) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TRADE_EXPORT_CSV, async (_, filter) => {
    try {
      const filePath = await exportTradesToCsv(filter);
      return { success: true, data: filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_PDF_REPORT, async (_, reportType, startDate, endDate) => {
    try {
      const filePath = await exportPdfReport(reportType, startDate, endDate);
      return { success: true, data: filePath };
    } catch (error: any) {
      if (error.message === '用户取消') {
        return { success: false, error: '用户取消' };
      }
      return { success: false, error: error.message };
    }
  });
}
