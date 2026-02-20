import { queryAll, queryOne, execute } from '../database/connection';
import { getAllSettings } from './settings-service';
import { getPositions } from './stats-service';
import { v4 as uuidv4 } from 'uuid';

export interface DailyBriefing {
  id: string;
  date: string;
  content: string;
  today_trades: number;
  today_pnl: number;
  week_pnl: number;
  month_pnl: number;
  positions_count: number;
  positions_value: number;
  consecutive_losses: number;
  risk_alert: string | null;
  created_at: string;
}

export interface BriefingData {
  date: string;
  today: {
    trades: number;
    buy: number;
    sell: number;
    pnl: number;
    win_count: number;
    loss_count: number;
  };
  week: {
    pnl: number;
    trades: number;
    win_rate: number;
  };
  month: {
    pnl: number;
    trades: number;
    win_rate: number;
  };
  positions: {
    count: number;
    value: number;
    profit: number;
  };
  risk: {
    consecutive_losses: number;
    max_consecutive_losses: number;
    position_concentration: number;
    total_exposure: number;
  };
  alerts: string[];
}

function getDateRange(daysAgo: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysAgo);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function generateBriefingData(): Promise<BriefingData> {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  // Get today's trades
  const todayTrades = queryAll(`
    SELECT direction, price, quantity, amount, commission, stamp_tax
    FROM trades
    WHERE trade_date = ?
  `, [today]) as any[];

  // Calculate today's P&L
  let todayPnl = 0;
  let buyCount = 0;
  let sellCount = 0;
  let winCount = 0;
  let lossCount = 0;

  for (const trade of todayTrades) {
    if (trade.direction === 'BUY') {
      buyCount++;
      todayPnl -= (trade.amount + trade.commission + trade.stamp_tax);
    } else {
      sellCount++;
      const pnl = trade.amount - trade.commission - trade.stamp_tax;
      todayPnl += pnl;
      if (pnl > 0) winCount++;
      else lossCount++;
    }
  }

  // Get week trades
  const weekTrades = queryAll(`
    SELECT direction, price, quantity, amount, commission, stamp_tax
    FROM trades
    WHERE trade_date >= ?
  `, [weekStart]) as any[];

  let weekPnl = 0;
  let weekWin = 0;
  let weekLoss = 0;

  for (const trade of weekTrades) {
    if (trade.direction === 'SELL') {
      const pnl = trade.amount - trade.commission - trade.stamp_tax;
      weekPnl += pnl;
      if (pnl > 0) weekWin++;
      else weekLoss++;
    }
  }

  // Get month trades
  const monthTrades = queryAll(`
    SELECT direction, price, quantity, amount, commission, stamp_tax
    FROM trades
    WHERE trade_date >= ?
  `, [monthStart]) as any[];

  let monthPnl = 0;
  let monthWin = 0;
  let monthLoss = 0;

  for (const trade of monthTrades) {
    if (trade.direction === 'SELL') {
      const pnl = trade.amount - trade.commission - trade.stamp_tax;
      monthPnl += pnl;
      if (pnl > 0) monthWin++;
      else monthLoss++;
    }
  }

  // Get positions
  const positions = await getPositions();
  let positionsValue = 0;
  let positionsProfit = 0;

  for (const pos of positions) {
    positionsValue += pos.current_value || 0;
    positionsProfit += pos.floating_pnl || 0;
  }

  // Get consecutive losses
  const recentTrades = queryAll(`
    SELECT direction, price, quantity, amount, commission, stamp_tax
    FROM trades
    WHERE direction = 'SELL'
    ORDER BY trade_date DESC, created_at DESC
    LIMIT 20
  `) as any[];

  let consecutiveLosses = 0;
  for (const trade of recentTrades) {
    const pnl = trade.amount - trade.commission - trade.stamp_tax;
    if (pnl < 0) {
      consecutiveLosses++;
    } else {
      break;
    }
  }

  // Get max consecutive losses
  const allSellTrades = queryAll(`
    SELECT direction, price, quantity, amount, commission, stamp_tax
    FROM trades
    WHERE direction = 'SELL'
    ORDER BY trade_date ASC
  `) as any[];

  let maxConsecutiveLosses = 0;
  let currentLosses = 0;
  for (const trade of allSellTrades) {
    const pnl = trade.amount - trade.commission - trade.stamp_tax;
    if (pnl < 0) {
      currentLosses++;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    } else {
      currentLosses = 0;
    }
  }

  // Calculate risk metrics
  const settings = getAllSettings();
  const totalCapital = settings?.initial_capital || 100000;
  const positionConcentration = totalCapital > 0 ? (positionsValue / totalCapital) * 100 : 0;

  // Generate alerts
  const alerts: string[] = [];

  if (consecutiveLosses >= 3) {
    alerts.push(`⚠️ 已连续亏损 ${consecutiveLosses} 笔，建议暂停交易休息`);
  }

  if (positionConcentration > 80) {
    alerts.push(`⚠️ 仓位过重 (${positionConcentration.toFixed(1)}%)，建议控制仓位`);
  }

  if (todayTrades.length >= 5) {
    alerts.push(`⚠️ 今日交易 ${todayTrades.length} 笔，注意交易频率`);
  }

  if (winCount > 0 && lossCount > 0 && lossCount > winCount * 2) {
    alerts.push(`⚠️ 亏损笔数超过盈利笔数 2 倍，建议谨慎操作`);
  }

  // Build briefing content
  const content = buildBriefingContent({
    today: {
      trades: todayTrades.length,
      buy: buyCount,
      sell: sellCount,
      pnl: todayPnl,
      win_count: winCount,
      loss_count: lossCount,
    },
    week: {
      pnl: weekPnl,
      trades: weekTrades.length,
      win_rate: weekTrades.length > 0 ? (weekWin / (weekWin + weekLoss)) * 100 : 0,
    },
    month: {
      pnl: monthPnl,
      trades: monthTrades.length,
      win_rate: monthTrades.length > 0 ? (monthWin / (monthWin + monthLoss)) * 100 : 0,
    },
    positions: {
      count: positions.length,
      value: positionsValue,
      profit: positionsProfit,
    },
    risk: {
      consecutive_losses: consecutiveLosses,
      max_consecutive_losses: maxConsecutiveLosses,
      position_concentration: positionConcentration,
      total_exposure: positionsValue,
    },
    alerts,
  });

  return {
    date: today,
    today: {
      trades: todayTrades.length,
      buy: buyCount,
      sell: sellCount,
      pnl: todayPnl,
      win_count: winCount,
      loss_count: lossCount,
    },
    week: {
      pnl: weekPnl,
      trades: weekTrades.length,
      win_rate: weekTrades.length > 0 ? (weekWin / (weekWin + weekLoss)) * 100 : 0,
    },
    month: {
      pnl: monthPnl,
      trades: monthTrades.length,
      win_rate: monthTrades.length > 0 ? (monthWin / (monthWin + monthLoss)) * 100 : 0,
    },
    positions: {
      count: positions.length,
      value: positionsValue,
      profit: positionsProfit,
    },
    risk: {
      consecutive_losses: consecutiveLosses,
      max_consecutive_losses: maxConsecutiveLosses,
      position_concentration: positionConcentration,
      total_exposure: positionsValue,
    },
    alerts,
  };
}

function buildBriefingContent(data: {
  today: BriefingData['today'];
  week: BriefingData['week'];
  month: BriefingData['month'];
  positions: BriefingData['positions'];
  risk: BriefingData['risk'];
  alerts: string[];
  date?: string;
}): string {
  const lines: string[] = [];

  lines.push(`📅 ${data.date || new Date().toISOString().split('T')[0]} 每日交易简报`);
  lines.push('');
  lines.push('【今日交易】');
  lines.push(`  交易次数: ${data.today.trades} 笔 (买入 ${data.today.buy}, 卖出 ${data.today.sell})`);
  lines.push(`  今日盈亏: ¥${data.today.pnl.toFixed(2)}`);
  lines.push(`  盈亏统计: 盈利 ${data.today.win_count} 笔, 亏损 ${data.today.loss_count} 笔`);

  lines.push('');
  lines.push('【本周统计】');
  lines.push(`  本周盈亏: ¥${data.week.pnl.toFixed(2)}`);
  lines.push(`  交易次数: ${data.week.trades} 笔`);
  lines.push(`  胜率: ${data.week.win_rate.toFixed(1)}%`);

  lines.push('');
  lines.push('【本月统计】');
  lines.push(`  本月盈亏: ¥${data.month.pnl.toFixed(2)}`);
  lines.push(`  交易次数: ${data.month.trades} 笔`);
  lines.push(`  胜率: ${data.month.win_rate.toFixed(1)}%`);

  lines.push('');
  lines.push('【当前持仓】');
  lines.push(`  持仓数量: ${data.positions.count} 只`);
  lines.push(`  持仓市值: ¥${data.positions.value.toFixed(2)}`);
  lines.push(`  持仓盈亏: ¥${data.positions.profit.toFixed(2)}`);

  lines.push('');
  lines.push('【风险提示】');
  if (data.risk.consecutive_losses > 0) {
    lines.push(`  连续亏损: ${data.risk.consecutive_losses} 笔 (历史最高: ${data.risk.max_consecutive_losses} 笔)`);
  }
  lines.push(`  仓位占比: ${data.risk.position_concentration.toFixed(1)}%`);

  if (data.alerts.length > 0) {
    lines.push('');
    lines.push('【操作建议】');
    for (const alert of data.alerts) {
      lines.push(`  ${alert}`);
    }
  }

  return lines.join('\n');
}

export function saveDailyBriefing(data: BriefingData): DailyBriefing {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Create table if not exists
  execute(`
    CREATE TABLE IF NOT EXISTS daily_briefings (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      content TEXT,
      today_trades INTEGER,
      today_pnl REAL,
      week_pnl REAL,
      month_pnl REAL,
      positions_count INTEGER,
      positions_value REAL,
      consecutive_losses INTEGER,
      risk_alert TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Check if briefing exists for today
  const existing = queryOne(`
    SELECT id FROM daily_briefings WHERE date = ?
  `, [data.date]);

  if (existing) {
    // Update existing
    execute(`
      UPDATE daily_briefings
      SET content = ?, today_trades = ?, today_pnl = ?, week_pnl = ?, month_pnl = ?,
          positions_count = ?, positions_value = ?, consecutive_losses = ?, risk_alert = ?
      WHERE date = ?
    `, [
      buildBriefingContent({
        today: data.today,
        week: data.week,
        month: data.month,
        positions: data.positions,
        risk: data.risk,
        alerts: data.alerts,
        date: data.date,
      }),
      data.today.trades,
      data.today.pnl,
      data.week.pnl,
      data.month.pnl,
      data.positions.count,
      data.positions.value,
      data.risk.consecutive_losses,
      data.alerts.length > 0 ? data.alerts.join('; ') : null,
      data.date,
    ]);
    return {
      id: existing.id,
      date: data.date,
      content: buildBriefingContent({
        today: data.today,
        week: data.week,
        month: data.month,
        positions: data.positions,
        risk: data.risk,
        alerts: data.alerts,
        date: data.date,
      }),
      today_trades: data.today.trades,
      today_pnl: data.today.pnl,
      week_pnl: data.week.pnl,
      month_pnl: data.month.pnl,
      positions_count: data.positions.count,
      positions_value: data.positions.value,
      consecutive_losses: data.risk.consecutive_losses,
      risk_alert: data.alerts.length > 0 ? data.alerts.join('; ') : null,
      created_at: now,
    };
  }

  // Insert new
  execute(`
    INSERT INTO daily_briefings (id, date, content, today_trades, today_pnl, week_pnl, month_pnl,
      positions_count, positions_value, consecutive_losses, risk_alert, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.date,
    buildBriefingContent({
      today: data.today,
      week: data.week,
      month: data.month,
      positions: data.positions,
      risk: data.risk,
      alerts: data.alerts,
      date: data.date,
    }),
    data.today.trades,
    data.today.pnl,
    data.week.pnl,
    data.month.pnl,
    data.positions.count,
    data.positions.value,
    data.risk.consecutive_losses,
    data.alerts.length > 0 ? data.alerts.join('; ') : null,
    now,
  ]);

  return {
    id,
    date: data.date,
    content: buildBriefingContent({
      today: data.today,
      week: data.week,
      month: data.month,
      positions: data.positions,
      risk: data.risk,
      alerts: data.alerts,
      date: data.date,
    }),
    today_trades: data.today.trades,
    today_pnl: data.today.pnl,
    week_pnl: data.week.pnl,
    month_pnl: data.month.pnl,
    positions_count: data.positions.count,
    positions_value: data.positions.value,
    consecutive_losses: data.risk.consecutive_losses,
    risk_alert: data.alerts.length > 0 ? data.alerts.join('; ') : null,
    created_at: now,
  };
}

export function getDailyBriefing(date?: string): DailyBriefing | null {
  const targetDate = date || new Date().toISOString().split('T')[0];

  const result = queryOne(`
    SELECT * FROM daily_briefings WHERE date = ?
  `, [targetDate]);

  return result as DailyBriefing | null;
}

export function getRecentBriefings(days: number = 7): DailyBriefing[] {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  return queryAll(`
    SELECT * FROM daily_briefings
    WHERE date >= ?
    ORDER BY date DESC
  `, [startDateStr]) as DailyBriefing[];
}
