import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { generateBriefingData, saveDailyBriefing, getDailyBriefing, getRecentBriefings } from '../services/briefing-service';

export function registerBriefingHandlers(): void {
  // Generate and save daily briefing
  ipcMain.handle(IPC_CHANNELS.BRIEFING_GENERATE, async () => {
    try {
      const data = await generateBriefingData();
      const saved = saveDailyBriefing(data);
      return {
        success: true,
        data: saved,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '生成简报失败',
      };
    }
  });

  // Get today's briefing
  ipcMain.handle(IPC_CHANNELS.BRIEFING_GET_TODAY, async () => {
    try {
      const briefing = getDailyBriefing();
      return {
        success: true,
        data: briefing,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '获取简报失败',
      };
    }
  });

  // Get recent briefings
  ipcMain.handle(IPC_CHANNELS.BRIEFING_GET_RECENT, async (_event, days: number = 7) => {
    try {
      const briefings = getRecentBriefings(days);
      return {
        success: true,
        data: briefings,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '获取简报失败',
      };
    }
  });
}
