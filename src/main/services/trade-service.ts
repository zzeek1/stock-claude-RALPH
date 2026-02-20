import { queryAll, queryOne, execute } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { Trade, TradeFilter, TradeListResult, PlanExecuted } from '../../shared/types';

function determinePlanExecution(
  sellPrice: number,
  stopLoss?: number | null,
  takeProfit?: number | null
): PlanExecuted | null {
  if (!stopLoss && !takeProfit) return null;

  const hitStopLoss = stopLoss && sellPrice <= stopLoss;
  const hitTakeProfit = takeProfit && sellPrice >= takeProfit;

  if (hitStopLoss && hitTakeProfit) {
    return 'EXECUTED';
  }

  if (hitStopLoss || hitTakeProfit) {
    return 'EXECUTED';
  }

  if (stopLoss && takeProfit) {
    if (sellPrice > stopLoss && sellPrice < takeProfit) {
      return 'PARTIAL';
    }
  } else if (stopLoss && sellPrice > stopLoss) {
    return 'PARTIAL';
  } else if (takeProfit && sellPrice < takeProfit) {
    return 'PARTIAL';
  }

  return 'MISSED';
}

function rowToTrade(row: any): Trade {
  return {
    ...row,
    is_impulsive: row.is_impulsive === 1,
    tags: row.tags ? JSON.parse(row.tags) : [],
  };
}

export function createTrade(trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Trade {
  const now = new Date().toISOString();
  const id = uuidv4();

  const amount = trade.amount || trade.price * trade.quantity;
  const commission = trade.commission || amount * 0.00025;
  let stamp_tax = trade.stamp_tax || 0;
  if (trade.direction === 'SELL') {
    stamp_tax = stamp_tax || amount * 0.0005;
  }
  const total_cost = trade.direction === 'BUY'
    ? amount + commission + stamp_tax
    : amount - commission - stamp_tax;

  let position_before = trade.position_before;
  let position_after = trade.position_after;
  if (position_before === undefined || position_before === null) {
    position_before = getCurrentPosition(trade.stock_code);
  }
  if (position_after === undefined || position_after === null) {
    position_after = trade.direction === 'BUY'
      ? (position_before || 0) + trade.quantity
      : (position_before || 0) - trade.quantity;
  }

  let realized_pnl = trade.realized_pnl;
  let pnl_ratio = trade.pnl_ratio;
  let holding_days = trade.holding_days;
  let related_trade_id = trade.related_trade_id;
  let plan_executed: PlanExecuted | null | undefined = trade.plan_executed;

  if (trade.direction === 'SELL' && (realized_pnl === undefined || realized_pnl === null)) {
    const buyInfo = getAvgBuyCost(trade.stock_code);
    if (buyInfo) {
      const sellRevenue = amount - commission - stamp_tax;
      const buyCost = buyInfo.avg_cost * trade.quantity;
      realized_pnl = sellRevenue - buyCost;
      pnl_ratio = buyCost > 0 ? realized_pnl / buyCost : 0;
      holding_days = buyInfo.first_buy_date
        ? Math.ceil((new Date(trade.trade_date).getTime() - new Date(buyInfo.first_buy_date).getTime()) / (1000 * 60 * 60 * 24))
        : undefined;
      related_trade_id = buyInfo.last_buy_id;
    }
  }

  if (trade.direction === 'SELL' && !plan_executed) {
    plan_executed = determinePlanExecution(trade.price, trade.stop_loss, trade.take_profit) ?? undefined;
  }

  execute(`
    INSERT INTO trades (
      id, stock_code, stock_name, market, direction, trade_date, trade_time,
      price, quantity, amount, commission, stamp_tax, total_cost,
      position_before, position_after, position_ratio,
      realized_pnl, pnl_ratio, holding_days,
      strategy, entry_reason, exit_plan, stop_loss, take_profit, plan_executed,
      emotion_before, emotion_after, confidence, is_impulsive,
      lesson, market_trend, sector_trend, market_note,
      related_trade_id, tags, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `, [
    id, trade.stock_code, trade.stock_name, trade.market, trade.direction,
    trade.trade_date, trade.trade_time || null,
    trade.price, trade.quantity, amount, commission, stamp_tax, total_cost,
    position_before ?? null, position_after ?? null, trade.position_ratio ?? null,
    realized_pnl ?? null, pnl_ratio ?? null, holding_days ?? null,
    trade.strategy || null, trade.entry_reason || null, trade.exit_plan || null,
    trade.stop_loss ?? null, trade.take_profit ?? null, plan_executed ?? null,
    trade.emotion_before || null, trade.emotion_after || null,
    trade.confidence ?? null, trade.is_impulsive ? 1 : 0,
    trade.lesson || null, trade.market_trend || null,
    trade.sector_trend || null, trade.market_note || null,
    related_trade_id || null, JSON.stringify(trade.tags || []),
    now, now,
  ]);

  return getTrade(id)!;
}

export function getTrade(id: string): Trade | null {
  const row = queryOne('SELECT * FROM trades WHERE id = ?', [id]);
  return row ? rowToTrade(row) : null;
}

export function updateTrade(id: string, updates: Partial<Trade>): Trade | null {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  const allowedFields = [
    'stock_code', 'stock_name', 'market', 'direction', 'trade_date', 'trade_time',
    'price', 'quantity', 'amount', 'commission', 'stamp_tax', 'total_cost',
    'position_before', 'position_after', 'position_ratio',
    'realized_pnl', 'pnl_ratio', 'holding_days',
    'strategy', 'entry_reason', 'exit_plan', 'stop_loss', 'take_profit', 'plan_executed',
    'emotion_before', 'emotion_after', 'confidence',
    'lesson', 'market_trend', 'sector_trend', 'market_note',
    'related_trade_id',
  ];

  for (const field of allowedFields) {
    if (field in updates) {
      fields.push(`${field} = ?`);
      values.push((updates as any)[field] ?? null);
    }
  }

  if ('is_impulsive' in updates) {
    fields.push('is_impulsive = ?');
    values.push(updates.is_impulsive ? 1 : 0);
  }

  if ('tags' in updates) {
    fields.push('tags = ?');
    values.push(JSON.stringify(updates.tags || []));
  }

  if (fields.length === 0) return getTrade(id);

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  execute(`UPDATE trades SET ${fields.join(', ')} WHERE id = ?`, values);
  return getTrade(id);
}

export function deleteTrade(id: string): boolean {
  execute('DELETE FROM trades WHERE id = ?', [id]);
  return true;
}

export function listTrades(filter: TradeFilter): TradeListResult {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filter.startDate) {
    conditions.push('trade_date >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    conditions.push('trade_date <= ?');
    params.push(filter.endDate);
  }
  if (filter.stock_code) {
    conditions.push('stock_code LIKE ?');
    params.push(`%${filter.stock_code}%`);
  }
  if (filter.stock_name) {
    conditions.push('stock_name LIKE ?');
    params.push(`%${filter.stock_name}%`);
  }
  if (filter.direction) {
    conditions.push('direction = ?');
    params.push(filter.direction);
  }
  if (filter.strategy) {
    conditions.push('strategy = ?');
    params.push(filter.strategy);
  }
  if (filter.market) {
    conditions.push('market = ?');
    params.push(filter.market);
  }
  if (filter.pnlType === 'profit') {
    conditions.push('realized_pnl > 0');
  } else if (filter.pnlType === 'loss') {
    conditions.push('realized_pnl < 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = queryOne(`SELECT COUNT(*) as total FROM trades ${whereClause}`, params);
  const total = countRow?.total ?? 0;

  const page = filter.page || 1;
  const pageSize = filter.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const sortField = filter.sortField || 'trade_date';
  const sortOrder = filter.sortOrder || 'desc';
  const orderClause = `ORDER BY ${sortField} ${sortOrder}, created_at DESC`;

  const rows = queryAll(
    `SELECT * FROM trades ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    trades: rows.map(rowToTrade),
    total,
    page,
    pageSize,
  };
}

export function getTradesByDateRange(startDate: string, endDate: string): Trade[] {
  const rows = queryAll(
    'SELECT * FROM trades WHERE trade_date >= ? AND trade_date <= ? ORDER BY trade_date ASC, created_at ASC',
    [startDate, endDate]
  );
  return rows.map(rowToTrade);
}

function getCurrentPosition(stockCode: string): number {
  const result = queryOne(`
    SELECT COALESCE(
      SUM(CASE WHEN direction = 'BUY' THEN quantity ELSE -quantity END),
      0
    ) as position
    FROM trades WHERE stock_code = ?
  `, [stockCode]);
  return result?.position ?? 0;
}

function getAvgBuyCost(stockCode: string): { avg_cost: number; first_buy_date: string; last_buy_id: string } | null {
  const result = queryOne(`
    SELECT
      SUM(total_cost) / SUM(quantity) as avg_cost,
      MIN(trade_date) as first_buy_date
    FROM trades
    WHERE stock_code = ? AND direction = 'BUY'
  `, [stockCode]);

  if (!result || !result.avg_cost) return null;

  const lastBuy = queryOne(
    "SELECT id FROM trades WHERE stock_code = ? AND direction = 'BUY' ORDER BY trade_date DESC LIMIT 1",
    [stockCode]
  );

  return {
    avg_cost: result.avg_cost,
    first_buy_date: result.first_buy_date,
    last_buy_id: lastBuy?.id || '',
  };
}

export function getRelatedTrades(tradeId: string): Trade[] {
  const trade = getTrade(tradeId);
  if (!trade) return [];

  const rows = queryAll(
    'SELECT * FROM trades WHERE stock_code = ? AND id != ? ORDER BY trade_date ASC',
    [trade.stock_code, tradeId]
  );
  return rows.map(rowToTrade);
}
