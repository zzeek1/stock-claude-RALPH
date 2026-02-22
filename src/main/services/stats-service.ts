import { queryAll, queryOne } from '../database/connection';
import {
  StatsOverview, PnlDataPoint, StrategyStats, EmotionWinRate,
  MonthlyStats, CalendarHeatmapData, DrawdownData, PnlDistribution,
  Position, PlanExecutionStats, PlanExecutionDetail,
  CanonicalKpis,
  RiskAssessment, RiskExposure, RiskReward, MaxPotentialLoss, Market,
  StrategyTrendData, StrategyWinRateTrend, EmotionHeatmapData,
} from '../../shared/types';
import { getQuotes, getFxRates } from './quote-service';
import { calculateConsecutiveStats } from './streak-utils';

type FxRates = {
  USD: number;
  HKD: number;
  CNY: number;
};

const DEFAULT_FX_RATES: FxRates = {
  USD: 1,
  HKD: 7.8,
  CNY: 7.2,
};

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
    ORDER BY trade_date ASC, created_at ASC, id ASC
  `, dateFilter.params);

  const streakStats = calculateConsecutiveStats(
    sellTrades.map((t: { realized_pnl: number }) => Number(t.realized_pnl) || 0),
  );

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
    max_consecutive_wins: streakStats.maxConsecutiveWins,
    max_consecutive_losses: streakStats.maxConsecutiveLosses,
    current_consecutive_wins: streakStats.currentConsecutiveWins,
    current_consecutive_losses: streakStats.currentConsecutiveLosses,
    avg_holding_days: sellStats.avg_holding_days,
    impulsive_trade_count: impulsiveStats?.total ?? 0,
    impulsive_trade_win_rate: impulsiveStats?.total > 0 ? impulsiveStats.winning / impulsiveStats.total : 0,
    stop_loss_execution_rate: stopLossStats?.total_with_stop > 0 ? (stopLossStats.executed ?? 0) / stopLossStats.total_with_stop : 0,
    expectancy,
    avg_win: sellStats.avg_win,
    avg_loss: sellStats.avg_loss,
  };
}

function convertMarketAmountToCny(amount: number, market: string, fxRates: FxRates): number {
  if (!Number.isFinite(amount)) return 0;
  if (market === 'US') return amount * (fxRates.CNY / fxRates.USD);
  if (market === 'HK') return amount * (fxRates.CNY / fxRates.HKD);
  return amount;
}

async function getFxRatesWithFallback(): Promise<FxRates> {
  try {
    const fxRates = await getFxRates();
    if (fxRates.USD > 0 && fxRates.HKD > 0 && fxRates.CNY > 0) {
      return fxRates;
    }
  } catch {
    // fallback to defaults
  }
  return DEFAULT_FX_RATES;
}

export async function getCanonicalKpis(startDate?: string, endDate?: string): Promise<CanonicalKpis> {
  const dateFilter = buildDateFilter(startDate, endDate);
  const fxRates = await getFxRatesWithFallback();

  const sellTrades = queryAll(
    `
      SELECT realized_pnl, market
      FROM trades
      WHERE direction = 'SELL' AND realized_pnl IS NOT NULL ${dateFilter.clause}
    `,
    dateFilter.params,
  ) as Array<{ realized_pnl: number; market: Market }>;

  let realizedPnl = 0;
  let winCount = 0;
  let lossCount = 0;
  let flatCount = 0;
  let winPnlSum = 0;
  let lossPnlSum = 0;

  for (const trade of sellTrades) {
    const rawPnl = Number(trade.realized_pnl);
    if (!Number.isFinite(rawPnl)) continue;

    const normalized = convertMarketAmountToCny(rawPnl, trade.market, fxRates);
    realizedPnl += normalized;

    if (normalized > 0) {
      winCount += 1;
      winPnlSum += normalized;
    } else if (normalized < 0) {
      lossCount += 1;
      lossPnlSum += normalized;
    } else {
      flatCount += 1;
    }
  }

  const isHistoricalSnapshot = isHistoricalRangeEnd(endDate);
  const positions = isHistoricalSnapshot ? [] : await getPositions();
  const unrealizedPnl = isHistoricalSnapshot
    ? 0
    : positions.reduce((sum, position) => {
      const marketPnl = Number(position.floating_pnl || 0);
      return sum + convertMarketAmountToCny(marketPnl, position.market, fxRates);
    }, 0);

  const totalTradesRow = queryOne(
    `SELECT COUNT(*) as total FROM trades WHERE 1=1 ${dateFilter.clause}`,
    dateFilter.params,
  ) as { total?: number } | null;

  const sellCount = winCount + lossCount + flatCount;
  const winRate = sellCount > 0 ? winCount / sellCount : 0;
  const avgWin = winCount > 0 ? winPnlSum / winCount : 0;
  const avgLoss = lossCount > 0 ? lossPnlSum / lossCount : 0;
  const profitLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  const expectancy = winRate * avgWin + (1 - winRate) * avgLoss;
  const totalPnl = realizedPnl + unrealizedPnl;

  const snapshotConditions: string[] = [];
  const snapshotParams: any[] = [];
  if (startDate) {
    snapshotConditions.push('AND date >= ?');
    snapshotParams.push(startDate);
  }
  if (endDate) {
    snapshotConditions.push('AND date <= ?');
    snapshotParams.push(endDate);
  }
  const assetSnapshots = queryAll(
    `
      SELECT date, COALESCE(total_assets, 0) as total_assets
      FROM account_snapshots
      WHERE 1=1 ${snapshotConditions.join(' ')}
      ORDER BY date ASC
    `,
    snapshotParams,
  ) as Array<{ date: string; total_assets: number }>;

  let latestSnapshotAssets = 0;
  for (const row of assetSnapshots) {
    const value = Number(row.total_assets || 0);
    if (value > 0) {
      latestSnapshotAssets = value;
    }
  }

  const initialCapital = getInitialCapital();
  const totalAssets = latestSnapshotAssets > 0
    ? latestSnapshotAssets
    : Math.max(0, initialCapital + totalPnl);
  const baselineAssetsForReturn = totalAssets - totalPnl;
  const totalReturn = baselineAssetsForReturn > 0 ? totalPnl / baselineAssetsForReturn : 0;

  let maxDrawdown = 0;
  if (assetSnapshots.length > 0) {
    let peak = 0;
    for (const row of assetSnapshots) {
      const value = Number(row.total_assets || 0);
      if (value <= 0) continue;
      peak = Math.max(peak, value);
      const drawdown = peak > 0 ? (peak - value) / peak : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    if (maxDrawdown === 0 && !assetSnapshots.some((row) => Number(row.total_assets || 0) > 0)) {
      maxDrawdown = calculateMaxDrawdown(startDate, endDate);
    }
  } else {
    maxDrawdown = calculateMaxDrawdown(startDate, endDate);
  }

  return {
    base_currency: 'CNY',
    realized_pnl: realizedPnl,
    unrealized_pnl: unrealizedPnl,
    total_pnl: totalPnl,
    total_assets: totalAssets,
    total_return: totalReturn,
    max_drawdown: maxDrawdown,
    total_trades: totalTradesRow?.total ?? 0,
    winning_trades: winCount,
    losing_trades: lossCount,
    flat_trades: flatCount,
    win_rate: winRate,
    avg_win: avgWin,
    avg_loss: avgLoss,
    profit_loss_ratio: profitLossRatio,
    expectancy,
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
      AND direction = 'SELL'
      AND realized_pnl IS NOT NULL
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
  type TradeRow = {
    stock_code: string;
    stock_name: string;
    market: Market;
    direction: 'BUY' | 'SELL';
    trade_date: string;
    quantity: number;
    total_cost: number;
    stop_loss?: number | null;
    take_profit?: number | null;
  };

  type PositionState = {
    stock_code: string;
    stock_name: string;
    market: Market;
    quantity: number;
    total_cost: number;
    first_buy_date: string;
    last_trade_date: string;
    short_qty: number;
    lots: Array<{ qty: number; cost_per_share: number; trade_date: string }>;
    stop_loss?: number;
    take_profit?: number;
  };

  const trades = queryAll(`
    SELECT
      stock_code,
      stock_name,
      market,
      direction,
      trade_date,
      quantity,
      total_cost,
      stop_loss,
      take_profit
    FROM trades
    ORDER BY stock_code ASC, trade_date ASC, created_at ASC
  `) as TradeRow[];

  if (trades.length === 0) return [];

  const states = new Map<string, PositionState>();

  for (const trade of trades) {
    const normalizedCode = (trade.stock_code || '').trim().toUpperCase();
    const key = `${normalizedCode}::${trade.market}`;
    const qty = Math.max(0, Number(trade.quantity) || 0);
    const cost = Number(trade.total_cost) || 0;
    const direction = String(trade.direction || '').trim().toUpperCase();

    const state = states.get(key) ?? {
      stock_code: normalizedCode,
      stock_name: trade.stock_name,
      market: trade.market,
      quantity: 0,
      total_cost: 0,
      first_buy_date: '',
      last_trade_date: trade.trade_date,
      short_qty: 0,
      lots: [],
      stop_loss: undefined,
      take_profit: undefined,
    };

    state.stock_name = trade.stock_name;
    state.market = trade.market;
    state.last_trade_date = trade.trade_date;

    if (direction === 'BUY') {
      let remainingBuyQty = qty;
      const unitCost = qty > 0 ? Math.max(0, cost) / qty : 0;

      // If there was oversold quantity, BUY first offsets that short debt.
      if (state.short_qty > 0 && remainingBuyQty > 0) {
        const coverQty = Math.min(state.short_qty, remainingBuyQty);
        state.short_qty -= coverQty;
        remainingBuyQty -= coverQty;
      }

      if (remainingBuyQty > 0) {
        state.lots.push({
          qty: remainingBuyQty,
          cost_per_share: unitCost,
          trade_date: trade.trade_date,
        });
      }

      if (trade.stop_loss !== null && trade.stop_loss !== undefined) {
        state.stop_loss = trade.stop_loss;
      }
      if (trade.take_profit !== null && trade.take_profit !== undefined) {
        state.take_profit = trade.take_profit;
      }
    } else {
      let remainingSellQty = qty;

      // FIFO reduce open lots.
      while (remainingSellQty > 0 && state.lots.length > 0) {
        const firstLot = state.lots[0];
        if (firstLot.qty <= remainingSellQty) {
          remainingSellQty -= firstLot.qty;
          state.lots.shift();
        } else {
          firstLot.qty -= remainingSellQty;
          remainingSellQty = 0;
        }
      }

      // If sells exceed total longs, track as short debt.
      if (remainingSellQty > 0) {
        state.short_qty += remainingSellQty;
      }
    }

    state.quantity = state.lots.reduce((sum, lot) => sum + lot.qty, 0);
    state.total_cost = state.lots.reduce((sum, lot) => sum + lot.qty * lot.cost_per_share, 0);
    state.first_buy_date = state.lots.length > 0 ? state.lots[0].trade_date : '';

    if (state.quantity <= 0) {
      state.quantity = 0;
      state.total_cost = 0;
      state.first_buy_date = '';
      state.stop_loss = undefined;
      state.take_profit = undefined;
    }

    states.set(key, state);
  }

  const now = new Date();
  const positions = Array.from(states.values())
    .filter(s => s.quantity > 0)
    .map((s) => {
      const avg_cost = s.quantity > 0 ? s.total_cost / s.quantity : 0;
      const holding_days = s.first_buy_date
        ? Math.max(0, Math.floor((now.getTime() - new Date(s.first_buy_date).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        stock_code: s.stock_code,
        stock_name: s.stock_name,
        market: s.market,
        quantity: s.quantity,
        avg_cost,
        total_cost: s.total_cost,
        current_price: avg_cost,
        current_value: s.quantity * avg_cost,
        floating_pnl: 0,
        floating_pnl_ratio: 0,
        first_buy_date: s.first_buy_date,
        last_trade_date: s.last_trade_date,
        holding_days,
        stop_loss: s.stop_loss,
        take_profit: s.take_profit,
        quote_is_fallback: false,
      } as Position;
    })
    .sort((a, b) => a.stock_code.localeCompare(b.stock_code));

  // Debug: Log final positions
  if (positions.length === 0) return [];

  const symbols = positions.map((pos) => toQuoteSymbol(pos.stock_code, pos.market));

  try {
    const quotes = await getQuotes(symbols);
    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

    for (const pos of positions) {
      const symbol = toQuoteSymbol(pos.stock_code, pos.market);
      const quote = quoteMap.get(symbol);
      const currentPrice = quote ? parseFloat(quote.lastDone) : 0;
      const hasValidQuote = Number.isFinite(currentPrice) && currentPrice > 0;

      pos.current_price = hasValidQuote ? currentPrice : pos.avg_cost;
      pos.current_value = pos.quantity * pos.current_price;
      pos.floating_pnl = pos.current_value - pos.total_cost;
      pos.floating_pnl_ratio = pos.total_cost > 0 ? pos.floating_pnl / pos.total_cost : 0;
      pos.quote_is_fallback = !hasValidQuote;
      pos.quote_timestamp = toQuoteTimestamp(quote?.timestamp);
      pos.quote_error = hasValidQuote
        ? undefined
        : (quote ? '行情返回无效价格，已回退到成本价' : '行情缺失，已回退到成本价');
    }
  } catch (error) {
    console.error('Failed to fetch quotes:', error);
    const quoteError = error instanceof Error ? error.message : String(error);
    for (const pos of positions) {
      pos.current_price = pos.avg_cost;
      pos.current_value = pos.quantity * pos.avg_cost;
      pos.floating_pnl = 0;
      pos.floating_pnl_ratio = 0;
      pos.quote_is_fallback = true;
      pos.quote_error = quoteError || '行情服务异常，已回退到成本价';
      pos.quote_timestamp = undefined;
    }
  }

  return positions;
}

function toQuoteSymbol(stockCode: string, market: Market): string {
  if (market === 'SH') return `${stockCode}.SH`;
  if (market === 'SZ') return `${stockCode}.SZ`;
  if (market === 'HK') return `${stockCode}.HK`;
  if (market === 'US') return `${stockCode}.US`;
  return stockCode;
}

function toQuoteTimestamp(timestamp: Date | string | undefined): string | undefined {
  if (!timestamp) {
    return undefined;
  }
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
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

function estimateCashFromTrades(initialCapital: number): number {
  const row = queryOne(`
    SELECT
      COALESCE(SUM(CASE WHEN direction = 'BUY' THEN total_cost ELSE 0 END), 0) as total_buy_cost,
      COALESCE(SUM(CASE WHEN direction = 'SELL' THEN total_cost ELSE 0 END), 0) as total_sell_amount
    FROM trades
  `);

  const totalBuyCost = Number(row?.total_buy_cost) || 0;
  const totalSellAmount = Number(row?.total_sell_amount) || 0;
  return initialCapital - totalBuyCost + totalSellAmount;
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

function isHistoricalRangeEnd(endDate?: string): boolean {
  if (!endDate) {
    return false;
  }
  const today = new Date().toISOString().slice(0, 10);
  return endDate < today;
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
export async function getRiskAssessment(): Promise<RiskAssessment> {
  const initialCapital = getInitialCapital();
  const fxRates = await getFxRatesWithFallback();

  // Get current positions with quotes
  const positions = await getPositions();

  // Calculate total market value
  let totalMarketValue = 0;
  const marketValues: Record<string, number> = { SH: 0, SZ: 0, BJ: 0, HK: 0, US: 0 };
  const stockValues: { code: string; name: string; value: number }[] = [];

  for (const pos of positions) {
    const positionValueCny = convertMarketAmountToCny(Number(pos.current_value || 0), pos.market, fxRates);
    totalMarketValue += positionValueCny;
    marketValues[pos.market] = (marketValues[pos.market] || 0) + positionValueCny;
    stockValues.push({
      code: pos.stock_code,
      name: pos.stock_name,
      value: positionValueCny,
    });
  }

  // Get cash from latest account snapshot
  const cashRow = queryOne('SELECT cash FROM account_snapshots ORDER BY date DESC LIMIT 1');
  const estimatedCash = estimateCashFromTrades(initialCapital);
  const snapshotCash = Number(cashRow?.cash);
  const cash = Number.isFinite(snapshotCash)
    ? snapshotCash
    : Number.isFinite(estimatedCash)
      ? estimatedCash
      : initialCapital;

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
      const potentialDownside = convertMarketAmountToCny(
        (pos.avg_cost - pos.stop_loss) * pos.quantity,
        pos.market,
        fxRates,
      );
      const potentialUpside = convertMarketAmountToCny(
        pos.take_profit
        ? (pos.take_profit - pos.avg_cost) * pos.quantity
        : (pos.current_price - pos.avg_cost) * pos.quantity * 2, // Assume 2:1 reward
        pos.market,
        fxRates,
      );

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
      const loss = convertMarketAmountToCny(
        (pos.avg_cost - pos.stop_loss) * pos.quantity,
        pos.market,
        fxRates,
      );
      ifAllStopLoss += Math.max(0, loss);
      largestSingleLoss = Math.max(largestSingleLoss, Math.max(0, loss));
    } else {
      // If no stop loss, assume full position value at risk
      const positionValueCny = convertMarketAmountToCny(Number(pos.current_value || 0), pos.market, fxRates);
      ifAllStopLoss += positionValueCny;
      largestSingleLoss = Math.max(largestSingleLoss, positionValueCny);
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
