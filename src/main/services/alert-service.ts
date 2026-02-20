/**
 * 止损止盈提醒服务
 * 监控持仓价格，触发桌面通知
 */
import * as quoteService from './quote-service';
import * as statsService from './stats-service';
import { showNotification } from './backup-service';
import { getSetting } from './settings-service';
import { queryAll, queryOne } from '../database/connection';

// 存储已触发的警报，避免重复通知
// Key: "stock_code-direction" (direction: "stop_loss" or "take_profit")
const triggeredAlerts = new Map<string, { price: number; time: Date }>();

let checkInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 获取检查间隔（毫秒）
 */
function getCheckInterval(): number {
  const interval = parseInt(getSetting('alert_interval') || '60', 10);
  return interval * 1000; // 转换为毫秒
}

/**
 * 检查是否启用预警
 */
function isAlertEnabled(): boolean {
  return getSetting('alert_enabled') !== 'false';
}

/**
 * 启动价格监控
 */
export function startPriceMonitoring(): void {
  // 检查是否启用预警
  if (!isAlertEnabled()) {
    console.log('Price alerts are disabled');
    return;
  }

  if (checkInterval) {
    console.log('Price monitoring already running');
    return;
  }

  console.log('Starting price monitoring...');
  const interval = getCheckInterval();
  checkInterval = setInterval(checkPriceAlerts, interval);

  // 立即执行一次检查
  checkPriceAlerts();
}

/**
 * 停止价格监控
 */
export function stopPriceMonitoring(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('Price monitoring stopped');
  }
}

/**
 * 检查价格是否触及止损/止盈
 */
async function checkPriceAlerts(): Promise<void> {
  try {
    // 获取所有持仓
    const positions = await statsService.getPositions();

    // 过滤出有止损或止盈设置的持仓
    const monitoredPositions = positions.filter(
      p => (p.stop_loss && p.stop_loss > 0) || (p.take_profit && p.take_profit > 0)
    );

    if (monitoredPositions.length === 0) {
      return;
    }

    // 获取这些持仓的实时价格
    const symbols: string[] = [];
    const positionMap = new Map<string, typeof monitoredPositions[0]>();

    for (const pos of monitoredPositions) {
      let symbol = pos.stock_code;
      if (pos.market === 'SH') symbol = pos.stock_code + '.SH';
      else if (pos.market === 'SZ') symbol = pos.stock_code + '.SZ';
      else if (pos.market === 'HK') symbol = pos.stock_code + '.HK';
      else if (pos.market === 'US') symbol = pos.stock_code + '.US';

      symbols.push(symbol);
      positionMap.set(symbol, pos);
    }

    if (symbols.length === 0) return;

    const quotes = await quoteService.getQuotes(symbols);
    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

    // 检查每个持仓的价格
    for (const pos of monitoredPositions) {
      let symbol = pos.stock_code;
      if (pos.market === 'SH') symbol = pos.stock_code + '.SH';
      else if (pos.market === 'SZ') symbol = pos.stock_code + '.SZ';
      else if (pos.market === 'HK') symbol = pos.stock_code + '.HK';
      else if (pos.market === 'US') symbol = pos.stock_code + '.US';

      const quote = quoteMap.get(symbol);
      if (!quote) continue;

      const currentPrice = parseFloat(quote.lastDone);
      if (!currentPrice || currentPrice <= 0) continue;

      // 检查止损
      if (pos.stop_loss && pos.stop_loss > 0) {
        const alertKey = `${pos.stock_code}-stop_loss`;
        const lastTriggered = triggeredAlerts.get(alertKey);

        // 触发止损条件：价格 <= 止损价
        if (currentPrice <= pos.stop_loss) {
          // 检查是否已经触发过（避免重复通知）
          if (!lastTriggered || lastTriggered.price !== pos.stop_loss) {
            triggeredAlerts.set(alertKey, { price: pos.stop_loss, time: new Date() });
            showStopLossAlert(pos, currentPrice);
          }
        } else {
          // 价格回到止损价之上，清除警报状态（用户可能调整了止损）
          if (lastTriggered) {
            triggeredAlerts.delete(alertKey);
          }
        }
      }

      // 检查止盈
      if (pos.take_profit && pos.take_profit > 0) {
        const alertKey = `${pos.stock_code}-take_profit`;
        const lastTriggered = triggeredAlerts.get(alertKey);

        // 触发止盈条件：价格 >= 止盈价
        if (currentPrice >= pos.take_profit) {
          // 检查是否已经触发过（避免重复通知）
          if (!lastTriggered || lastTriggered.price !== pos.take_profit) {
            triggeredAlerts.set(alertKey, { price: pos.take_profit, time: new Date() });
            showTakeProfitAlert(pos, currentPrice);
          }
        } else {
          // 价格回到止盈价之下，清除警报状态
          if (lastTriggered) {
            triggeredAlerts.delete(alertKey);
          }
        }
      }
    }
  } catch (error) {
    console.error('Price alert check failed:', error);
  }

  // 同时检查连续亏损
  await checkConsecutiveLossAlerts();
}

/**
 * 显示止损提醒
 */
function showStopLossAlert(pos: { stock_code: string; stock_name: string; stop_loss?: number }, currentPrice: number): void {
  const title = '止损提醒';
  const body = `${pos.stock_name} (${pos.stock_code}) 已触及止损价 ¥${pos.stop_loss?.toFixed(2)}，当前价格 ¥${currentPrice.toFixed(2)}`;
  showNotification(title, body);
  console.log(`[ALERT] Stop loss triggered: ${pos.stock_code} at ${currentPrice}`);
}

/**
 * 显示止盈提醒
 */
function showTakeProfitAlert(pos: { stock_code: string; stock_name: string; take_profit?: number }, currentPrice: number): void {
  const title = '止盈提醒';
  const body = `${pos.stock_name} (${pos.stock_code}) 已触及止盈价 ¥${pos.take_profit?.toFixed(2)}，当前价格 ¥${currentPrice.toFixed(2)}`;
  showNotification(title, body);
  console.log(`[ALERT] Take profit triggered: ${pos.stock_code} at ${currentPrice}`);
}

/**
 * 检查连续亏损
 */
async function checkConsecutiveLossAlerts(): Promise<void> {
  try {
    const threshold = parseInt(getSetting('consecutive_loss_threshold') || '3', 10);
    if (threshold <= 0) return;

    // 查询最近的交易记录，计算连续亏损
    const recentTrades = queryOne(`
      SELECT COUNT(*) as count FROM (
        SELECT
          t.stock_code,
          t.trade_date,
          SUM(CASE WHEN t.direction = 'BUY' THEN t.total_cost ELSE -t.total_cost END) as pnl
        FROM trades t
        WHERE t.sell_date IS NOT NULL
        GROUP BY t.stock_code, t.trade_date
        ORDER BY t.trade_date DESC
        LIMIT ${threshold}
      ) WHERE pnl < 0
    `);

    const consecutiveLosses = recentTrades?.count || 0;

    if (consecutiveLosses >= threshold) {
      const alertKey = 'consecutive_loss';
      if (!triggeredAlerts.has(alertKey)) {
        triggeredAlerts.set(alertKey, { price: 0, time: new Date() });
        showNotification(
          '【连续亏损提醒】',
          `已连续 ${consecutiveLosses} 笔亏损，建议暂停交易休息一下`
        );
        console.log(`[ALERT] Consecutive losses: ${consecutiveLosses}`);
      }
    }
  } catch (error) {
    console.error('Consecutive loss check failed:', error);
  }
}

/**
 * 手动触发一次价格检查
 */
export async function triggerManualCheck(): Promise<void> {
  await checkPriceAlerts();
}

/**
 * 清理旧的警报记录（超过24小时的）
 */
export function cleanOldAlerts(): void {
  const now = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (const [key, value] of triggeredAlerts.entries()) {
    if (now.getTime() - value.time.getTime() > oneDayMs) {
      triggeredAlerts.delete(key);
    }
  }
}
