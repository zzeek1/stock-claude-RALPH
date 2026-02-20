import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import * as accountService from '../services/account-management-service';

export function registerAccountHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ACCOUNT_CREATE, async (_, accountData) => {
    try {
      const account = accountService.createAccount(accountData);
      return { success: true, data: account };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_LIST, async () => {
    try {
      const accounts = accountService.listAccounts();
      return { success: true, data: accounts };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_SET_ACTIVE, async (_, accountId) => {
    try {
      accountService.setActiveAccount(accountId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_DELETE, async (_, accountId) => {
    try {
      accountService.deleteAccount(accountId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
