import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import * as goalService from '../services/goal-service';
import { GoalPeriod } from '../../shared/types';

export function registerGoalHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GOAL_GET, async (_, id: string) => {
    try {
      const goal = goalService.getGoal(id);
      return { success: true, data: goal };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GOAL_LIST, async (_, period?: GoalPeriod, year?: number) => {
    try {
      const goals = goalService.listGoals(period, year);
      return { success: true, data: goals };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GOAL_SAVE, async (_, goal) => {
    try {
      const saved = goalService.saveGoal(goal);
      return { success: true, data: saved };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GOAL_DELETE, async (_, id: string) => {
    try {
      const deleted = goalService.deleteGoal(id);
      return { success: true, data: deleted };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.GOAL_PROGRESS, async (_, id?: string) => {
    try {
      const progress = id
        ? goalService.getGoalProgress(id)
        : goalService.getCurrentGoalProgress();
      return { success: true, data: progress };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
