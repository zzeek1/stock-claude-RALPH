import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import * as aiService from '../services/ai-service';

export function registerAIHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_REVIEW_START, async (event, type, startDate, endDate) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { success: false, error: '窗口未找到' };
      const reviewId = await aiService.startReview(type, startDate, endDate, win);
      return { success: true, data: reviewId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_REVIEW_LIST, async () => {
    try {
      return { success: true, data: aiService.listReviews() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_REVIEW_GET, async (_, id) => {
    try {
      return { success: true, data: aiService.getReview(id) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_REVIEW_DELETE, async (_, id) => {
    try {
      return { success: true, data: aiService.deleteReview(id) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_REVIEW_TOGGLE_FAVORITE, async (_, id) => {
    try {
      return { success: true, data: aiService.toggleFavorite(id) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_REVIEW_UPDATE_NOTE, async (_, id, note) => {
    try {
      return { success: true, data: aiService.updateNote(id, note) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_CONVERSATION_ASK, async (event, reviewId, question) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { success: false, error: '窗口未找到' };
      await aiService.askConversation(reviewId, question, win);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_CONVERSATION_GET, async (_, reviewId) => {
    try {
      return { success: true, data: aiService.getConversations(reviewId) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
