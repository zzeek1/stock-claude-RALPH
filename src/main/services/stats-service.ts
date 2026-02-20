import { queryAll, queryOne } from '../database/connection';
import {
  StatsOverview, PnlDataPoint, StrategyStats, EmotionWinRate,
  MonthlyStats, CalendarHeatmapData, DrawdownData, PnlDistribution,
  Position, PlanExecutionStats, PlanExecutionDetail,
  RiskAssessment, RiskExposure, RiskReward, MaxPotentialLoss, Market,
  StrategyTrendData, StrategyWinRateTrend, EmotionHeatmapData,
} from '../../shared/types';
import { getQuotes } from './quote-service';

export function getStatsOverview(startDate?: string, endDate?: string): StatsOverview {
  const dateFilter = buildDateFilter(startDate, endDate);

  const sellStats = queryOne(`
    SELECT
      COUNT(*) as total_sells,
      COALESCE(SUM(realized_pnl), 0) as total_pnl,
      COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) as winning,
      COALESCE(SUM(CASE WHEN realized_pnl < 0 THEN 1 ELSE 0 END), 0) as losing,
      COALESCE(AVG(CASE WHEN realized_pnl > 0 THEN realized_pnl END), 0) as avg_win,
      COALESCE(AVG(CASE WHEN realized_pnl < 0 THEN realized_pnl END), 0) as avg_loss,
      COALESCE(AVG(holding_days), 0) as avg_holding_days
    FROM trades
    WHERE direction = 'SELL' AND realized_pnl IS NOT NULL ${dateFilter.clause}
  `, dateFilter.params);

  const totalTrades = queryOne(
    `SELECT COUNT(*) as total FROM trades WHERE 1=1 ${dateFilter.clause}`,
    dateFilter.params
  );

  const impulsiveStats = queryOne(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END), 0) as winning
    FROM trades
    WHERE is_impulsive = 1 AND direction = 'SELL' AND realized_pnl IS NOT NULL ${dateFilter.clause}
  `, dateFilter.params);

  const stopLossStats = queryOne(`
    SELECT
      COUNT(*) as total_with_stop,
      SUM(CASE WHEN price <= stop_loss THEN 1 ELSE 0 END) as executed
    FROM trades
    WHERE direction = 'SELL' AND stop_loss IS NOT NULL ${dateFilter.clause}
  `, dateFilter.params);

  const sellTrades = queryAll(`
    SELECT realized_pnl FROM trades
    WHERE direction = 'SELL' AND realized_pnl IS NOT NULL ${dateFilter.clause}
    ORDER BY trade_date ASC
  `, dateFilter.params);

  let maxConsecutiveWins = 0, maxConsecutiveLosses = 0;
  let currentWins = 0, currentLosses = 0;
  for (const t of sellTrades) {
    if (t.realized_pnl > 0) {
      currentWins++;
      currentLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
    } else {
      currentLosses++;
      currentWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    }
  }

  const maxDrawdown = calculateMaxDrawdown(startDate, endDate);

  const winRate = sellStats.total_sells > 0 ? sellStats.winning / sellStats.total_sells : 0;
  const profitLossRatio = sellStats.avg_loss !== 0 ? Math.abs(sellStats.avg_win / sellStats.avg_loss) : 0;
  const expectancy = winRate * sellStats.avg_win + (1 - winRate) * sellStats.avg_loss;

  const initialCapital = getInitialCapital();
  const totalReturn = initialCapital > 0 ? sellStats.total_pnl / initialCapital : 0;

  return {
    total_pnl: sellStats.total_pnl,
    total_return: totalReturn,
    win_rate: winRate,
    profit_loss_ratio: profitLossRatio,
    total_trades: totalTrades?.total ?? 0,
    winning_trades: sellStats.winning,
    losing_trades: sellStats.losing,
    max_drawdown: maxDrawdown,
    max_consecutive_wins: maxConsecutiveWins,
    max_consecutive_losses: maxConsecutiveLosses,
    avg_holding_days: sellStats.avg_holding_days,
    impulsive_trade_count: impulsiveStats?.total ?? 0,
    impulsive_trade_win_rate: impulsiveStats?.total > 0 ? impulsiveStats.winning / impulsiveStats.total : 0,
    stop_loss_execution_rate: stopLossStats?.total_with_stop > 0 ? (stopLossStats.executed ?? 0) / stopLossStats.total_with_stop : 0,
    expectancy,
    avg_win: sellStats.avg_win,
    avg_loss: sellStats.avg_loss,
  };
}

export function getPnlCurve(startDate?: string, endDate?: string): PnlDataPoint[] {
  const dateFilter = buildDateFilter(startDate, endDate);

  const rows = queryAll(`
    SELECT trade_date as date, COALESCE(SUM(realized_pnl), 0) as daily_pnl
    FROM trades
    WHERE direction = 'SELL' AND realized_pnl IS NOT NULL ${dateFilter.clause}
    GROUP BY trade_date
    ORDER BY trade_date ASC
  `, dateFilter.params);

  let cumulative = 0;
  return rows.map(row => {
    cumulative += row.daily_pnl;
    return {
      date: row.date,
      daily_pnl: row.daily_pnl,
      cumulative_pnl: cumulative,
    };
  });
}

export function getStrategyStats(startDate?: string, endDate?: string): StrategyStats[] {
  const dateFilter = buildDateFilter(startDate, endDate);

  return queryAll(`
    SELECT
      COALESCE(strategy, '未分类') as strategy,
      COALESCE(SUM(realized_pnl), 0) as total_pnl,
      CASE WHEN COUNT(*) > 0
        THEN CAST(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
        ELSE 0 END as win_rate,
      COUNT(*) as trade_count,
      COALESCE(AVG(realized_pnl), 0) as avg_pnl
    FROM trades
    WHERE direction = 'SELL' AND realized_pnl IS NOT NULL ${dateFilter.clause}
    GROUP BY strategy
    ORDER BY total_pnl DESC
  `, dateFilter.params) as StrategyStats[];
}

export function getEmotionStats(startDate?: string, endDate?: string): EmotionWinRate[] {
  const dateFilter = buildDateFilter(startDate, endDate);

  return queryAll(`
    SELECT
      COALESCE(emotion_before, '未记录') as emotion,
      CASE WHEN COUNT(*) > 0
        THEN CAST(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
        ELSE 0 END as win_rate,
      COUNT(*) as trade_count,
      COALESCE(AVG(realized_pnl), 0) as avg_pnl
    FROM trades
    WHERE direction = 'SELL' AND realized_pnl IS NOT NULL AND emotion_before IS NOT NULL ${dateFilter.clause}
    GROUP BY emotion_before
    ORDER BY trade_count DESC
  `, dateFilter.params) as EmotionWinRate[];
}

export function getMonthlyStats(startDate?: string, endDate?: string): MonthlyStats[] {
  const dateFilter = buildDateFilter(startDate, endDate);

  return queryAll(`
    SELECT
      SUBSTR(trade_date, 1, 7) as month,
      COALESCE(SUM(realized_pnl), 0) as pnl,
      COUNT(*) as trade_count,
      CASE WHEN COUNT(*) > 0
        THEN CAST(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
        ELSE 0 END as win_rate
    FROM trades
    WHERE direction = 'SELL' AND realized_pnl IS NOT NULL ${dateFilter.clause}
    GROUP BY SUBSTR(trade_date, 1, 7)
    ORDER BY month ASC
  `, dateFilter.params) as MonthlyStats[];
}

export function getCalendarData(year: number): CalendarHeatmapData[] {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  return queryAll(`
    SELECT
      trade_date as date,
      COALESCE(SUM(realized_pnl), 0) as pnl,
      COUNT(*) as trade_count
    FROM trades
    WHERE trade_date >= ? AND trade_date <= ?
    GROUP BY trade_date
    ORDER BY trade_date ASC
  `, [startDate, endDate]) as CalendarHeatmapData[];
}

export function getDrawdownData(startDate?: string, endDate?: string): DrawdownData[] {
  const pnlCurve = getPnlCurve(startDate, endDate);
  const initialCapital = getInitialCapital();

  let peak = initialCapital;
  return pnlCurve.map(point => {
    const value = initialCapital + point.cumulative_pnl;
    peak = Math.max(peak, value);
    const drawdown = peak > 0 ? (peak - value) / peak : 0;
    return { date: point.date, drawdown, peak, value };
  });
}

export function getPnlDistribution(startDate?: string, endDate?: string): PnlDistribution[] {
  const dateFilter = buildDateFilter(startDate, endDate);

  const trades = queryAll(`
    SELECT realized_pnl FROM trades
    WHERE direction = 'SELL' AND realized_pnl IS NOT NULL ${dateFilter.clause}
    ORDER BY realized_pnl ASC
  `, dateFilter.params);

  if (trades.length === 0) return [];

  const pnls = trades.map(t => t.realized_pnl);
  const min = Math.min(...pnls);
  const max = Math.max(...pnls);
  const range = max - min;
  const bucketCount = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(trades.length))));
  const bucketSize = range / bucketCount || 1;

  const buckets: PnlDistribution[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const rangeStart = min + i * bucketSize;
    const rangeEnd = min + (i + 1) * bucketSize;
    const count = pnls.filter(p => p >= rangeStart && (i === bucketCount - 1 ? p <= rangeEnd : p < rangeEnd)).length;
    buckets.push({
      range: `${rangeStart.toFixed(0)}~${rangeEnd.toFixed(0)}`,
      count,
      rangeStart,
      rangeEnd,
    });
  }

  return buckets;
}

export async function getPositions(): Promise<Position[]> {
  const positions = queryAll(`
    SELECT
      t.stock_code,
      t.stock_name,
      t.market,
      SUM(CASE WHEN t.direction = 'BUY' THEN t.quantity ELSE -t.quantity END) as quantity,
      CASE WHEN SUM(CASE WHEN t.direction = 'BUY' THEN t.quantity ELSE 0 END) > 0
        THEN SUM(CASE WHEN t.direction = 'BUY' THEN t.total_cost ELSE 0 END) / SUM(CASE WHEN t.direction = 'BUY' THEN t.quantity ELSE 0 END)
        ELSE 0 END as avg_cost,
      SUM(CASE WHEN t.direction = 'BUY' THEN t.total_cost ELSE 0 END) as total_cost,
      MIN(CASE WHEN t.direction = 'BUY' THEN t.trade_date END) as first_buy_date,
      MAX(t.trade_date) as last_trade_date,
      CAST(julianday('now') - julianday(MIN(CASE WHEN t.direction = 'BUY' THEN t.trade_date END)) AS INTEGER) as holding_days,
      -- 获取最近一次买入的止损和止盈价格
      (SELECT stop_loss FROM trades WHERE stock_code = t.stock_code AND direction = 'BUY' AND stop_loss IS NOT NULL ORDER BY trade_date DESC, created_at DESC LIMIT 1) as stop_loss,
      (SELECT take_profit FROM trades WHERE stock_code = t.stock_code AND direction = 'BUY' AND take_profit IS NOT NULL ORDER BY trade_date DESC, created_at DESC LIMIT 1) as take_profit
    FROM trades t
    GROUP BY t.stock_code
    HAVING SUM(CASE WHEN t.direction = 'BUY' THEN t.quantity ELSE -t.quantity END) > 0
    ORDER BY t.stock_code
  `) as Position[];

  if (positions.length === 0) return positions;

  // 获取实时股价
  const symbolMap: Record<string, { code: string; market: string }> = {};
  const symbols: string[] = [];

  for (const pos of positions) {
    let symbol = pos.stock_code;
    if (pos.market === 'SH') symbol = pos.stock_code + '.SH';
    else if (pos.market === 'SZ') symbol = pos.stock_code + '.SZ';
    else if (pos.market === 'HK') symbol = pos.stock_code + '.HK';
    else if (pos.market === 'US') symbol = pos.stock_code + '.US';

    symbolMap[symbol] = { code: pos.stock_code, market: pos.market };
    symbols.push(symbol);
  }

  try {
    const quotes = await getQuotes(symbols);
    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

    for (const pos of positions) {
      let symbol = pos.stock_code;
      if (pos.market === 'SH') symbol = pos.stock_code + '.SH';
      else if (pos.market === 'SZ') symbol = pos.stock_code + '.SZ';
      else if (pos.market === 'HK') symbol = pos.stock_code + '.HK';
      else if (pos.market === 'US') symbol = pos.stock_code + '.US';

      const quote = quoteMap.get(symbol);
      const currentPrice = quote ? parseFloat(quote.lastDone) : 0;

      pos.current_price = currentPrice || pos.avg_cost; // 如果获取不到则用成本价
      pos.current_value = pos.quantity * pos.current_price;
      pos.floating_pnl = pos.current_value - pos.total_cost;
      pos.floating_pnl_ratio = pos.total_cost > 0 ? pos.floating_pnl / pos.total_cost : 0;
    }
  } catch (error) {
    console.error('Failed to fetch quotes:', error);
    // 获取失败时，使用成本价作为当前价格
    for (const pos of positions) {
      pos.current_price = pos.avg_cost;
      pos.current_value = pos.quantity * pos.avg_cost;
      pos.floating_pnl = 0;
      pos.floating_pnl_ratio = 0;
    }
  }

  return positions;
}

function calculateMaxDrawdown(startDate?: string, endDate?: string): number {
  const pnlCurve = getPnlCurve(startDate, endDate);
  const initialCapital = getInitialCapital();

  let peak = initialCapital;
  let maxDrawdown = 0;

  for (const point of pnlCurve) {
    const value = initialCapital + point.cumulative_pnl;
    peak = Math.max(peak, value);
    const drawdown = peak > 0 ? (peak - value) / peak : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  return maxDrawdown;
}

function getInitialCapital(): number {
  const row = queryOne("SELECT value FROM settings WHERE key = 'initial_capital'");
  return row ? parseFloat(row.value) : 100000;
}

function buildDateFilter(startDate?: string, endDate?: string): { clause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  if (startDate) {
    conditions.push('AND trade_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('AND trade_date <= ?');
    params.push(endDate);
  }

  return { clause: conditions.join(' '), params };
}

export function getPlanExecutionStats(startDate?: string, endDate?: string): PlanExecutionStats {
  const dateFilter = buildDateFilter(startDate, endDate);

  const stats = queryOne(`
    SELECT
      COUNT(*) as total_with_plan,
      SUM(CASE WHEN plan_executed = 'EXECUTED' THEN 1 ELSE 0 END) as executed_count,
      SUM(CASE WHEN plan_executed = 'PARTIAL' THEN 1 ELSE 0 END) as partial_count,
      SUM(CASE WHEN plan_executed = 'MISSED' THEN 1 ELSE 0 END) as missed_count,
      COALESCE(AVG(CASE WHEN plan_executed = 'EXECUTED' THEN realized_pnl END), 0) as executed_avg_pnl,
      COALESCE(AVG(CASE WHEN plan_executed = 'PARTIAL' THEN realized_pnl END), 0) as partial_avg_pnl,
      COALESCE(AVG(CASE WHEN plan_executed = 'MISSED' THEN realized_pnl END), 0) as missed_avg_pnl
    FROM trades
    WHERE direction = 'SELL' AND (stop_loss IS NOT NULL OR take_profit IS NOT NULL) ${dateFilter.clause}
  `, dateFilter.params);

  const totalWithPlan = stats?.total_with_plan ?? 0;
  const executedCount = stats?.executed_count ?? 0;
  const partialCount = stats?.partial_count ?? 0;
  const missedCount = stats?.missed_count ?? 0;

  return {
    total_with_plan: totalWithPlan,
    executed_count: executedCount,
    partial_count: partialCount,
    missed_count: missedCount,
    execution_rate: totalWithPlan > 0 ? (executedCount + partialCount) / totalWithPlan : 0,
    executed_avg_pnl: stats?.executed_avg_pnl ?? 0,
    partial_avg_pnl: stats?.partial_avg_pnl ?? 0,
    missed_avg_pnl: stats?.missed_avg_pnl ?? 0,
  };
}

export function getPlanExecutionDetails(startDate?: string, endDate?: string): PlanExecutionDetail[] {
  const dateFilter = buildDateFilter(startDate, endDate);

  const rows = queryAll(`
    SELECT
      stock_code,
      stock_name,
      trade_date,
      price as sell_price,
      stop_loss,
      take_profit,
      plan_executed,
      realized_pnl
    FROM trades
    WHERE direction = 'SELL' AND (stop_loss IS NOT NULL OR take_profit IS NOT NULL) ${dateFilter.clause}
    ORDER BY trade_date DESC
  `, dateFilter.params);

  return rows.map(row => {
    let reason = '';
    if (row.plan_executed === 'EXECUTED') {
      if (row.stop_loss && row.take_profit) {
        reason = row.sell_price <= row.stop_loss ? '触发止损' : '触发止盈';
      } else if (row.stop_loss) {
        reason = '触发止损';
      } else if (row.take_profit) {
        reason = '触发止盈';
      }
    } else if (row.plan_executed === 'PARTIAL') {
      reason = row.sell_price > (row.stop_loss ?? 0) && row.sell_price < (row.take_profit ?? Infinity) 
        ? '价格位于止损和止盈之间' 
        : row.stop_loss ? '未触发止损' : '未触发止盈';
    } else if (row.plan_executed === 'MISSED') {
      reason = row.stop_loss && row.take_profit
        ? '既未触发止损也未触发止盈'
        : row.stop_loss ? '未触发止损' : '未触发止盈';
    }

    return {
      stock_code: row.stock_code,
      stock_name: row.stock_name,
      trade_date: row.trade_date,
      sell_price: row.sell_price,
      stop_loss: row.stop_loss,
      take_profit: row.take_profit,
      plan_executed: row.plan_executed,
      realized_pnl: row.realized_pnl,
      reason,
    };
  });
}

// ===== 风险评估 =====
export function getRiskAssessment(): RiskAssessment {
  const initialCapital = getInitialCapital();

  // Get current positions with quotes
  const positions = getCurrentPositions();

  // Calculate total market value
  let totalMarketValue = 0;
  const marketValues: Record<string, number> = { SH: 0, SZ: 0, BJ: 0, HK: 0, US: 0 };
  const stockValues: { code: string; name: string; value: number }[] = [];

  for (const pos of positions) {
    totalMarketValue += pos.current_value;
    marketValues[pos.market] = (marketValues[pos.market] || 0) + pos.current_value;
    stockValues.push({
      code: pos.stock_code,
      name: pos.stock_name,
      value: pos.current_value,
    });
  }

  // Get cash from latest account snapshot
  const cashRow = queryOne('SELECT cash FROM account_snapshots ORDER BY date DESC LIMIT 1');
  const cash = cashRow?.cash || initialCapital;

  const totalAssets = cash + totalMarketValue;
  const totalExposure = totalAssets > 0 ? totalMarketValue / totalAssets : 0;

  // Calculate largest position percentage
  const largestPositionPct = totalAssets > 0
    ? (stockValues.length > 0 ? Math.max(...stockValues.map(s => s.value)) / totalAssets : 0)
    : 0;

  // Market exposure
  const marketExposure = (Object.keys(marketValues) as Market[])
    .filter(m => marketValues[m] > 0)
    .map(m => ({
      market: m,
      value: marketValues[m],
      percentage: totalAssets > 0 ? marketValues[m] / totalAssets : 0,
    }));

  // Stock exposure (Top 10)
  stockValues.sort((a, b) => b.value - a.value);
  const stockExposure = stockValues.slice(0, 10).map(s => ({
    stock_code: s.code,
    stock_name: s.name,
    value: s.value,
    percentage: totalAssets > 0 ? s.value / totalAssets : 0,
  }));

  // Risk Reward calculation
  let positionsWithSL = 0;
  let totalPotentialUpside = 0;
  let totalPotentialDownside = 0;
  let weightedRiskReward = 0;

  for (const pos of positions) {
    if (pos.stop_loss && pos.stop_loss > 0) {
      positionsWithSL++;
      const potentialDownside = (pos.avg_cost - pos.stop_loss) * pos.quantity;
      const potentialUpside = pos.take_profit
        ? (pos.take_profit - pos.avg_cost) * pos.quantity
        : (pos.current_price - pos.avg_cost) * pos.quantity * 2; // Assume 2:1 reward

      totalPotentialDownside += Math.max(0, potentialDownside);
      totalPotentialUpside += Math.max(0, potentialUpside);

      if (potentialDownside > 0) {
        weightedRiskReward += potentialUpside / potentialDownside;
      }
    }
  }

  const currentRiskReward = totalPotentialDownside > 0
    ? totalPotentialUpside / totalPotentialDownside
    : 0;
  const avgHistoricalRiskReward = positionsWithSL > 0
    ? weightedRiskReward / positionsWithSL
    : 0;

  // Max Potential Loss
  let ifAllStopLoss = 0;
  let largestSingleLoss = 0;

  for (const pos of positions) {
    if (pos.stop_loss && pos.stop_loss > 0) {
      const loss = (pos.avg_cost - pos.stop_loss) * pos.quantity;
      ifAllStopLoss += Math.max(0, loss);
      largestSingleLoss = Math.max(largestSingleLoss, Math.max(0, loss));
    } else {
      // If no stop loss, assume full position value at risk
      ifAllStopLoss += pos.current_value;
      largestSingleLoss = Math.max(largestSingleLoss, pos.current_value);
    }
  }

  const ifAllStopLossPct = totalAssets > 0 ? ifAllStopLoss / totalAssets : 0;
  const lossFromConcentration = largestPositionPct > 0.3
    ? totalMarketValue * (largestPositionPct - 0.3) * 0.5 // Assume 50% loss on concentration risk
    : 0;
  const canCoverLoss = cash >= ifAllStopLoss;

  // Generate warnings
  const warnings: string[] = [];
  if (totalExposure > 0.8) {
    warnings.push('仓位过重，建议控制在80%以下');
  }
  if (largestPositionPct > 0.3) {
    warnings.push('单一股票仓位过重，建议分散投资');
  }
  if (ifAllStopLossPct > 0.5) {
    warnings.push('最大潜在损失超过50%，风险较高');
  }
  if (!canCoverLoss) {
    warnings.push('可用资金不足以覆盖全部止损损失');
  }
  if (currentRiskReward < 1 && positionsWithSL > 0) {
    warnings.push('当前风险收益比小于1:1，建议优化出场策略');
  }

  // Overall risk level
  let overallRiskLevel: 'low' | 'medium' | 'high' = 'low';
  if (warnings.length >= 3 || ifAllStopLossPct > 0.5) {
    overallRiskLevel = 'high';
  } else if (warnings.length >= 1 || totalExposure > 0.6 || largestPositionPct > 0.2) {
    overallRiskLevel = 'medium';
  }

  return {
    exposure: {
      total_market_value: totalMarketValue,
      total_exposure: totalExposure,
      largest_position_pct: largestPositionPct,
      market_exposure: marketExposure,
      stock_exposure: stockExposure,
    },
    risk_reward: {
      current_risk_reward: currentRiskReward,
      avg_historical_risk_reward: avgHistoricalRiskReward,
      positions_with_sl: positionsWithSL,
      potential_upside: totalPotentialUpside,
      potential_downside: totalPotentialDownside,
    },
    max_potential_loss: {
      if_all_stop_loss: ifAllStopLoss,
      if_all_stop_loss_pct: ifAllStopLossPct,
      largest_single_loss: largestSingleLoss,
      loss_from_concentration: lossFromConcentration,
      cash_available: cash,
      can_cover_loss: canCoverLoss,
    },
    overall_risk_level: overallRiskLevel,
    risk_warnings: warnings,
  };
}

function getCurrentPositions(): any[] {
  // Get all BUY positions that haven't been fully closed
  const buyTrades = queryAll(`
    SELECT
      stock_code,
      stock_name,
      market,
      SUM(CASE WHEN direction = 'BUY' THEN quantity ELSE -quantity END) as remaining_qty,
      SUM(CASE WHEN direction = 'BUY' THEN total_cost ELSE -total_cost END) as total_cost
    FROM trades
    GROUP BY stock_code
    HAVING remaining_qty > 0
  `);

  return buyTrades.map(t => {
    const avgCost = t.remaining_qty > 0 ? t.total_cost / t.remaining_qty : 0;

    // Get stop_loss and take_profit from most recent BUY trade
    const slTpTrade = queryOne(`
      SELECT stop_loss, take_profit FROM trades
      WHERE stock_code = ? AND direction = 'BUY'
      ORDER BY trade_date DESC LIMIT 1
    `, [t.stock_code]);

    return {
      stock_code: t.stock_code,
      stock_name: t.stock_name,
      market: t.market,
      quantity: t.remaining_qty,
      avg_cost: avgCost,
      total_cost: t.total_cost,
      current_price: 0,
      current_value: 0,
      floating_pnl: 0,
      stop_loss: slTpTrade?.stop_loss,
      take_profit: slTpTrade?.take_profit,
    };
  });
}

// ===== 策略效果追踪 =====

export function getStrategyTrendData(startDate?: string, endDate?: string): StrategyTrendData[] {
  const dateFilter = buildDateFilter(startDate, endDate);

  // Get monthly strategy data
  const rows = queryAll(`
    SELECT
      COALESCE(strategy, '未分类') as strategy,
      SUBSTR(trade_date, 1, 7) as period,
      COALESCE(SUM(realized_pnl), 0) as total_pnl,
      CASE WHEN COUNT(*) > 0
        THEN CAST(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
        ELSE 0 END as win_rate,
      COUNT(*) as trade_count,
      COALESCE(AVG(realized_pnl), 0) as avg_pnl,
      SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
      SUM(CASE WHEN realized_pnl < 0 THEN 1 ELSE 0 END) as losing_trades
    FROM trades
    WHERE direction = 'SELL' AND realized_pnl IS NOT NULL ${dateFilter.clause}
    GROUP BY strategy, SUBSTR(trade_date, 1, 7)
    ORDER BY strategy, period ASC
  `, dateFilter.params) as StrategyTrendData[];

  return rows;
}

export function getStrategyWinRateTrend(startDate?: string, endDate?: string): StrategyWinRateTrend[] {
  const dateFilter = buildDateFilter(startDate, endDate);

  // Get monthly win rate trend for each strategy
  const rows = queryAll(`
    SELECT
      COALESCE(strategy, '未分类') as strategy,
      SUBSTR(trade_date, 1, 7) as period,
      CASE WHEN COUNT(*) > 0
        THEN CAST(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
        ELSE 0 END as win_rate,
      COUNT(*) as trade_count
    FROM trades
    WHERE direction = 'SELL' AND realized_pnl IS NOT NULL ${dateFilter.clause}
    GROUP BY strategy, SUBSTR(trade_date, 1, 7)
    ORDER BY strategy, period ASC
  `, dateFilter.params) as StrategyWinRateTrend[];

  return rows;
}

// ===== 情绪热力图 =====

export function getEmotionHeatmapData(startDate?: string, endDate?: string): EmotionHeatmapData[] {
  const dateFilter = buildDateFilter(startDate, endDate);

  // Get monthly emotion-win rate data for heatmap
  const rows = queryAll(`
    SELECT
      COALESCE(emotion_before, '未记录') as emotion,
      SUBSTR(trade_date, 1, 7) as period,
      CASE WHEN COUNT(*) > 0
        THEN CAST(SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
        ELSE 0 END as win_rate,
      COUNT(*) as trade_count,
      COALESCE(AVG(realized_pnl), 0) as avg_pnl
    FROM trades
    WHERE direction = 'SELL' AND realized_pnl IS NOT NULL AND emotion_before IS NOT NULL ${dateFilter.clause}
    GROUP BY emotion_before, SUBSTR(trade_date, 1, 7)
    ORDER BY emotion, period ASC
  `, dateFilter.params) as EmotionHeatmapData[];

  return rows;
}
