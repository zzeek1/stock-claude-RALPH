import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { JournalEntry } from '../../shared/types';
import * as journalService from '../services/journal-service';

export function registerJournalHandlers(): void {
  // Save journal (create or update)
  ipcMain.handle(IPC_CHANNELS.JOURNAL_SAVE, async (_event, journal: Partial<JournalEntry> & { date: string; title: string }) => {
    try {
      const result = journalService.saveJournal(journal);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get journal by ID
  ipcMain.handle(IPC_CHANNELS.JOURNAL_GET, async (_event, id: string) => {
    try {
      const journal = journalService.getJournalById(id);
      return { success: true, data: journal };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get journal by date
  ipcMain.handle(IPC_CHANNELS.JOURNAL_GET_BY_DATE, async (_event, date: string) => {
    try {
      const journal = journalService.getJournalByDate(date);
      return { success: true, data: journal };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get journal by date range
  ipcMain.handle(IPC_CHANNELS.JOURNAL_GET_BY_DATE_RANGE, async (_event, startDate: string, endDate: string) => {
    try {
      const journals = journalService.getJournalByDateRange(startDate, endDate);
      return { success: true, data: journals };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get journal list
  ipcMain.handle(IPC_CHANNELS.JOURNAL_LIST, async (_event, options?: { page?: number; pageSize?: number; keyword?: string }) => {
    try {
      const result = journalService.getJournalList(options);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Delete journal
  ipcMain.handle(IPC_CHANNELS.JOURNAL_DELETE, async (_event, id: string) => {
    try {
      const success = journalService.deleteJournal(id);
      return { success };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
