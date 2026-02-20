import { queryAll, queryOne, execute } from '../database/connection';
import { TradingGoal, GoalProgress, GoalWarning, GoalPeriod } from '../../shared/types';
import { getStatsOverview } from './stats-service';
import { getSetting } from './settings-service';

export function getGoal(id: string): TradingGoal | null {
  const row = queryOne('SELECT * FROM goals WHERE id = ?', [id]);
  if (!row) return null;
  return rowToGoal(row);
}

export function listGoals(period?: GoalPeriod, year?: number): TradingGoal[] {
  let sql = 'SELECT * FROM goals WHERE 1=1';
  const params: any[] = [];

  if (period) {
    sql += ' AND period = ?';
    params.push(period);
  }
  if (year) {
    sql += ' AND year = ?';
    params.push(year);
  }
  sql += ' ORDER BY year DESC, month DESC';

  const rows = queryAll(sql, params);
  return rows.map(rowToGoal);
}

export function saveGoal(goal: Partial<TradingGoal> & { period: GoalPeriod; year: number; month?: number }): TradingGoal {
  const now = new Date().toISOString();
  const id = goal.id || generateId();

  const existing = goal.id ? getGoal(goal.id) : null;

  if (existing) {
    execute(
      `UPDATE goals SET
        period = ?, year = ?, month = ?,
        target_return = ?, target_win_rate = ?, target_profit_loss_ratio = ?,
        target_max_drawdown = ?, target_trade_count = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        goal.period, goal.year, goal.month ?? null,
        goal.target_return ?? null, goal.target_win_rate ?? null,
        goal.target_profit_loss_ratio ?? null, goal.target_max_drawdown ?? null,
        goal.target_trade_count ?? null,
        now, id
      ]
    );
    return { ...existing, ...goal, id, updated_at: now };
  } else {
    execute(
      `INSERT INTO goals (
        id, period, year, month,
        target_return, target_win_rate, target_profit_loss_ratio,
        target_max_drawdown, target_trade_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, goal.period, goal.year, goal.month ?? null,
        goal.target_return ?? null, goal.target_win_rate ?? null,
        goal.target_profit_loss_ratio ?? null, goal.target_max_drawdown ?? null,
        goal.target_trade_count ?? null,
        now, now
      ]
    );
    return {
      id,
      period: goal.period,
      year: goal.year,
      month: goal.month,
      target_return: goal.target_return,
      target_win_rate: goal.target_win_rate,
      target_profit_loss_ratio: goal.target_profit_loss_ratio,
      target_max_drawdown: goal.target_max_drawdown,
      target_trade_count: goal.target_trade_count,
      created_at: now,
      updated_at: now,
    };
  }
}

export function deleteGoal(id: string): boolean {
  const existing = getGoal(id);
  if (!existing) return false;
  execute('DELETE FROM goals WHERE id = ?', [id]);
  return true;
}

export function getGoalProgress(id: string): GoalProgress | null {
  const goal = getGoal(id);
  if (!goal) return null;

  const { startDate, endDate } = getGoalDateRange(goal);
  const stats = getStatsOverview(startDate, endDate);
  const initialCapital = parseFloat(getSetting('initial_capital') || '100000');

  const actualReturn = stats.total_pnl / initialCapital;
  const actualWinRate = stats.win_rate;
  const actualProfitLossRatio = stats.profit_loss_ratio;
  const actualMaxDrawdown = stats.max_drawdown;
  const actualTradeCount = stats.total_trades;

  const returnProgress = goal.target_return ? Math.min(actualReturn / goal.target_return, 1) : 0;
  const winRateProgress = goal.target_win_rate ? Math.min(actualWinRate / goal.target_win_rate, 1) : 0;
  const profitLossRatioProgress = goal.target_profit_loss_ratio ? Math.min(actualProfitLossRatio / goal.target_profit_loss_ratio, 1) : 0;

  const warnings = generateWarnings(goal, {
    actualReturn,
    actualWinRate,
    actualProfitLossRatio,
    actualMaxDrawdown,
  });

  return {
    goal,
    actual_return: actualReturn,
    actual_win_rate: actualWinRate,
    actual_profit_loss_ratio: actualProfitLossRatio,
    actual_max_drawdown: actualMaxDrawdown,
    actual_trade_count: actualTradeCount,
    return_progress: returnProgress,
    win_rate_progress: winRateProgress,
    profit_loss_ratio_progress: profitLossRatioProgress,
    warnings,
  };
}

export function getCurrentGoalProgress(): GoalProgress | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let goal = queryOne(
    'SELECT * FROM goals WHERE period = ? AND year = ? AND month = ?',
    ['monthly', year, month]
  );

  if (!goal) {
    goal = queryOne(
      'SELECT * FROM goals WHERE period = ? AND year = ?',
      ['yearly', year]
    );
  }

  if (!goal) return null;

  return getGoalProgress((rowToGoal(goal)).id);
}

function getGoalDateRange(goal: TradingGoal): { startDate: string; endDate: string } {
  if (goal.period === 'monthly' && goal.month) {
    const startDate = `${goal.year}-${String(goal.month).padStart(2, '0')}-01`;
    const lastDay = new Date(goal.year, goal.month, 0).getDate();
    const endDate = `${goal.year}-${String(goal.month).padStart(2, '0')}-${lastDay}`;
    return { startDate, endDate };
  } else {
    const startDate = `${goal.year}-01-01`;
    const endDate = `${goal.year}-12-31`;
    return { startDate, endDate };
  }
}

function generateWarnings(
  goal: TradingGoal,
  actuals: {
    actualReturn: number;
    actualWinRate: number;
    actualProfitLossRatio: number;
    actualMaxDrawdown: number;
  }
): GoalWarning[] {
  const warnings: GoalWarning[] = [];
  const { actualReturn, actualWinRate, actualProfitLossRatio, actualMaxDrawdown } = actuals;

  if (goal.target_return !== undefined && goal.target_return !== null) {
    if (actualReturn < goal.target_return * 0.5) {
      warnings.push({
        type: 'return',
        severity: 'danger',
        message: `收益率仅达到目标的 ${(actualReturn / goal.target_return * 100).toFixed(1)}%，需加速`,
        actual: actualReturn,
        target: goal.target_return,
      });
    } else if (actualReturn < goal.target_return * 0.8) {
      warnings.push({
        type: 'return',
        severity: 'warning',
        message: `收益率已达到目标的 ${(actualReturn / goal.target_return * 100).toFixed(1)}%，继续努力`,
        actual: actualReturn,
        target: goal.target_return,
      });
    }
  }

  if (goal.target_win_rate !== undefined && goal.target_win_rate !== null) {
    if (actualWinRate < goal.target_win_rate * 0.7) {
      warnings.push({
        type: 'win_rate',
        severity: 'danger',
        message: `胜率 ${(actualWinRate * 100).toFixed(1)}% 远低于目标 ${(goal.target_win_rate * 100).toFixed(1)}%`,
        actual: actualWinRate,
        target: goal.target_win_rate,
      });
    } else if (actualWinRate < goal.target_win_rate) {
      warnings.push({
        type: 'win_rate',
        severity: 'warning',
        message: `胜率 ${(actualWinRate * 100).toFixed(1)}% 低于目标 ${(goal.target_win_rate * 100).toFixed(1)}%`,
        actual: actualWinRate,
        target: goal.target_win_rate,
      });
    }
  }

  if (goal.target_profit_loss_ratio !== undefined && goal.target_profit_loss_ratio !== null) {
    if (actualProfitLossRatio < goal.target_profit_loss_ratio * 0.5) {
      warnings.push({
        type: 'profit_loss_ratio',
        severity: 'danger',
        message: `盈亏比 ${actualProfitLossRatio.toFixed(2)} 远低于目标 ${goal.target_profit_loss_ratio.toFixed(2)}`,
        actual: actualProfitLossRatio,
        target: goal.target_profit_loss_ratio,
      });
    } else if (actualProfitLossRatio < goal.target_profit_loss_ratio) {
      warnings.push({
        type: 'profit_loss_ratio',
        severity: 'warning',
        message: `盈亏比 ${actualProfitLossRatio.toFixed(2)} 低于目标 ${goal.target_profit_loss_ratio.toFixed(2)}`,
        actual: actualProfitLossRatio,
        target: goal.target_profit_loss_ratio,
      });
    }
  }

  if (goal.target_max_drawdown !== undefined && goal.target_max_drawdown !== null) {
    if (actualMaxDrawdown > goal.target_max_drawdown) {
      const severity = actualMaxDrawdown > goal.target_max_drawdown * 1.5 ? 'danger' : 'warning';
      warnings.push({
        type: 'max_drawdown',
        severity,
        message: `最大回撤 ${(actualMaxDrawdown * 100).toFixed(1)}% 超过目标 ${(goal.target_max_drawdown * 100).toFixed(1)}%`,
        actual: actualMaxDrawdown,
        target: goal.target_max_drawdown,
      });
    }
  }

  return warnings;
}

function rowToGoal(row: any): TradingGoal {
  return {
    id: row.id,
    period: row.period,
    year: row.year,
    month: row.month,
    target_return: row.target_return,
    target_win_rate: row.target_win_rate,
    target_profit_loss_ratio: row.target_profit_loss_ratio,
    target_max_drawdown: row.target_max_drawdown,
    target_trade_count: row.target_trade_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function generateId(): string {
  return `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
