import { queryAll, queryOne, execute } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { AccountSnapshot, AssetCurveData } from '../../shared/types';
import * as settingsService from './settings-service';

export function saveSnapshot(snapshot: Omit<AccountSnapshot, 'id' | 'created_at'>): AccountSnapshot {
  const id = uuidv4();
  const now = new Date().toISOString();

  execute(`
    INSERT OR REPLACE INTO account_snapshots (
      id, date, total_assets, cash, market_value,
      daily_pnl, daily_return, cumulative_return, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, snapshot.date, snapshot.total_assets, snapshot.cash,
    snapshot.market_value, snapshot.daily_pnl, snapshot.daily_return,
    snapshot.cumulative_return, now,
  ]);

  return { ...snapshot, id, created_at: now };
}

/**
 * Auto-generate account snapshot from current positions and trade history
 */
export function generateAutoSnapshot(): Omit<AccountSnapshot, 'id' | 'created_at'> | null {
  const settings = settingsService.getAllSettings();
  const initialCapital = settings.initial_capital || 100000;

  // Get current positions with their market values
  const positions = queryAll(`
    SELECT
      stock_code,
      market,
      SUM(CASE WHEN direction = 'BUY' THEN quantity ELSE -quantity END) as quantity,
      SUM(CASE WHEN direction = 'BUY' THEN total_cost ELSE 0 END) as total_cost
    FROM trades
    GROUP BY stock_code
    HAVING SUM(CASE WHEN direction = 'BUY' THEN quantity ELSE -quantity END) > 0
  `) as { stock_code: string; market: string; quantity: number; total_cost: number }[];

  // Calculate total market value (simplified - using avg_cost as current price)
  // In a real scenario, you'd fetch real-time prices
  const marketValue = positions.reduce((sum, pos) => sum + pos.total_cost, 0);

  // Calculate realized P&L from closed trades
  const realizedPnlResult = queryOne(`
    SELECT
      COALESCE(SUM(CASE WHEN direction = 'SELL' THEN amount ELSE 0 END), 0) as sell_amount,
      COALESCE(SUM(CASE WHEN direction = 'BUY' THEN total_cost ELSE 0 END) -
               SUM(CASE WHEN direction = 'SELL' THEN total_cost ELSE 0 END), 0) as buy_cost,
      COALESCE(SUM(commission), 0) as total_commission,
      COALESCE(SUM(stamp_tax), 0) as total_stamp_tax
    FROM trades
  `) as { sell_amount: number; buy_cost: number; total_commission: number; total_stamp_tax: number } | null;

  const totalCommission = realizedPnlResult?.total_commission || 0;
  const totalStampTax = realizedPnlResult?.total_stamp_tax || 0;

  // Simplified cash calculation:
  // Cash = Initial Capital + Realized P&L - Total Costs
  // This is approximate since we don't track actual cash flow
  // A better approach would be to assume all BUY trades use cash from initial capital
  // and all SELL trades return cash

  // Calculate net cash flow from trades
  const cashFlowResult = queryOne(`
    SELECT
      COALESCE(SUM(CASE WHEN direction = 'SELL' THEN amount ELSE 0 END), 0) as sell_proceeds,
      COALESCE(SUM(CASE WHEN direction = 'BUY' THEN total_cost ELSE 0 END), 0) as buy_cost,
      COALESCE(SUM(commission), 0) as total_commission,
      COALESCE(SUM(stamp_tax), 0) as total_stamp_tax
    FROM trades
  `) as { sell_proceeds: number; buy_cost: number; total_commission: number; total_stamp_tax: number } | null;

  const sellProceeds = cashFlowResult?.sell_proceeds || 0;
  const buyCost = cashFlowResult?.buy_cost || 0;
  const commission = cashFlowResult?.total_commission || 0;
  const stampTax = cashFlowResult?.total_stamp_tax || 0;

  // Cash = Initial Capital - Buy Costs + Sell Proceeds - Costs
  const cash = initialCapital - buyCost + sellProceeds - commission - stampTax;

  // Total assets = cash + market value
  const totalAssets = cash + marketValue;

  // Get previous snapshot for daily P&L calculation
  const previousSnapshot = getLatestSnapshot();

  const today = new Date().toISOString().split('T')[0];

  let dailyPnl = 0;
  let dailyReturn = 0;
  let cumulativeReturn = 0;

  if (previousSnapshot) {
    dailyPnl = totalAssets - previousSnapshot.total_assets;
    dailyReturn = previousSnapshot.total_assets > 0 ? dailyPnl / previousSnapshot.total_assets : 0;
  }

  cumulativeReturn = (totalAssets - initialCapital) / initialCapital;

  return {
    date: today,
    total_assets: totalAssets,
    cash: cash,
    market_value: marketValue,
    daily_pnl: dailyPnl,
    daily_return: dailyReturn,
    cumulative_return: cumulativeReturn,
  };
}

export function listSnapshots(startDate?: string, endDate?: string): AccountSnapshot[] {
  let sql = 'SELECT * FROM account_snapshots';
  const params: any[] = [];

  if (startDate && endDate) {
    sql += ' WHERE date >= ? AND date <= ?';
    params.push(startDate, endDate);
  } else if (startDate) {
    sql += ' WHERE date >= ?';
    params.push(startDate);
  } else if (endDate) {
    sql += ' WHERE date <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY date ASC';
  return queryAll(sql, params) as AccountSnapshot[];
}

export function getLatestSnapshot(): AccountSnapshot | null {
  return queryOne('SELECT * FROM account_snapshots ORDER BY date DESC LIMIT 1') as AccountSnapshot | null;
}

/**
 * Get asset curve data with optional date range
 */
export function getAssetCurve(startDate?: string, endDate?: string): AssetCurveData[] {
  let sql = 'SELECT date, total_assets, cash, market_value, daily_pnl, daily_return, cumulative_return FROM account_snapshots';
  const params: any[] = [];

  if (startDate && endDate) {
    sql += ' WHERE date >= ? AND date <= ?';
    params.push(startDate, endDate);
  } else if (startDate) {
    sql += ' WHERE date >= ?';
    params.push(startDate);
  } else if (endDate) {
    sql += ' WHERE date <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY date ASC';
  return queryAll(sql, params) as AssetCurveData[];
}
