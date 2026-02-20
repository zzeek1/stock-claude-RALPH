import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import * as statsService from '../services/stats-service';
import * as accountService from '../services/account-service';

export function registerStatsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.STATS_OVERVIEW, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getStatsOverview(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_PNL_CURVE, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getPnlCurve(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_STRATEGY, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getStrategyStats(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_EMOTION, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getEmotionStats(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_MONTHLY, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getMonthlyStats(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_CALENDAR, async (_, year) => {
    try {
      return { success: true, data: statsService.getCalendarData(year) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_DRAWDOWN, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getDrawdownData(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_PNL_DISTRIBUTION, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getPnlDistribution(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.POSITION_LIST, async () => {
    try {
      return { success: true, data: await statsService.getPositions() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_PLAN_EXECUTION, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getPlanExecutionStats(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_ASSET_CURVE, async (_, startDate, endDate) => {
    try {
      return { success: true, data: accountService.getAssetCurve(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_RISK_ASSESSMENT, async () => {
    try {
      return { success: true, data: statsService.getRiskAssessment() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_STRATEGY_TREND, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getStrategyTrendData(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_STRATEGY_WIN_RATE_TREND, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getStrategyWinRateTrend(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STATS_EMOTION_HEATMAP, async (_, startDate, endDate) => {
    try {
      return { success: true, data: statsService.getEmotionHeatmapData(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
