import { queryAll, queryOne, execute, saveDb } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { getAllSettings, saveSettings } from './settings-service';
import type { TradingAccount, Settings } from '../../shared/types';

export function createAccount(account: Omit<TradingAccount, 'id' | 'created_at' | 'is_active'>): TradingAccount {
  const id = uuidv4();
  const now = new Date().toISOString();

  const newAccount: TradingAccount = {
    id,
    name: account.name,
    account_type: account.account_type,
    initial_capital: account.initial_capital,
    broker_name: account.broker_name,
    account_number: account.account_number,
    created_at: now,
    is_active: true,
  };

  execute(`
    INSERT INTO trading_accounts (id, name, account_type, initial_capital, broker_name, account_number, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    newAccount.id,
    newAccount.name,
    newAccount.account_type,
    newAccount.initial_capital,
    newAccount.broker_name || null,
    newAccount.account_number || null,
    newAccount.created_at,
    newAccount.is_active ? 1 : 0,
  ]);

  // If this is the first account, set it as active
  const existingAccounts = listAccounts();
  if (existingAccounts.length === 1) {
    setActiveAccount(id);
  }

  saveDb();
  return newAccount;
}

export function listAccounts(): TradingAccount[] {
  const rows = queryAll('SELECT * FROM trading_accounts ORDER BY created_at ASC');
  return rows.map(row => ({
    ...row,
    is_active: row.is_active === 1,
  }));
}

export function getActiveAccount(): TradingAccount | null {
  const settings = getAllSettings();
  if (!settings.current_account_id) {
    // If no active account, return the first account
    const accounts = listAccounts();
    if (accounts.length > 0) {
      return accounts[0];
    }
    return null;
  }

  const row = queryOne('SELECT * FROM trading_accounts WHERE id = ?', [settings.current_account_id]);
  if (!row) return null;

  return {
    ...row,
    is_active: row.is_active === 1,
  };
}

export function setActiveAccount(accountId: string): void {
  // Verify account exists
  const account = queryOne('SELECT id FROM trading_accounts WHERE id = ?', [accountId]);
  if (!account) {
    throw new Error('账户不存在');
  }

  // Update settings
  const settings = getAllSettings();
  const newSettings: Partial<Settings> = {
    ...settings,
    current_account_id: accountId,
  };
  saveSettings(newSettings);
}

export function deleteAccount(accountId: string): boolean {
  // Cannot delete the last account
  const accounts = listAccounts();
  if (accounts.length <= 1) {
    throw new Error('至少需要保留一个账户');
  }

  // If deleting the active account, switch to another
  const settings = getAllSettings();
  if (settings.current_account_id === accountId) {
    const remaining = accounts.filter(a => a.id !== accountId);
    if (remaining.length > 0) {
      setActiveAccount(remaining[0].id);
    }
  }

  execute('DELETE FROM trading_accounts WHERE id = ?', [accountId]);
  saveDb();
  return true;
}

export function getAccountId(): string {
  const activeAccount = getActiveAccount();
  if (activeAccount) {
    return activeAccount.id;
  }
  return 'default';
}
