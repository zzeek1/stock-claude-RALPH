/**
 * Longbridge 实时行情服务
 */
import { Config, QuoteContext } from "longbridge";
import { Period, AdjustType, NaiveDate } from "longbridge";
import { writeLog } from "../index";

// 硬编码的凭证
const APP_KEY = "110cf270ca570e1b8b60b8a74bef3346";
const APP_SECRET = "721b3835d40a07b2a1146ad6f9b3254c1007c8443b3ab9328485a244cb460f39";
const ACCESS_TOKEN = "m_eyJhbGciOiJSUzI1NiIsImtpZCI6ImQ5YWRiMGIxYTdlNzYxNzEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJsb25nYnJpZGdlIiwic3ViIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzc5Mzc2MDM3LCJpYXQiOjE3NzE2MDAwMzgsImFrIjoiIiwiYWFpZCI6MjA4NjE0NTQsImFjIjoibGJfcGFwZXJ0cmFkaW5nIiwibWlkIjoxNjM4NDU0OCwic2lkIjoiQWFZU0t5enpKZVQ5QWxZekVVTHdhdz09IiwiYmwiOjMsInVsIjowLCJpayI6ImxiX3BhcGVydHJhZGluZ18yMDg2MTQ1NCJ9.DkgdRyp-PpCeMIKnawzR4a_aNwBPv2aV56-5UfCCb677D3WoJKxzqxt07wWlTw9xPs-ql5_3FgVa_viEskl1JCekT77DtReHx7A_ZgTlvjNpHq_3-5HtPxBR1Gd3j0knmziJcIH80FlMAIlj7Mk-h26YQVNMueG7XaYYcAEf8PVSNycqbAdvR_vuLRFngTJAGtVZyyiSl_L6PrnJNbh8-JN-wi6zaR4j_Q3z8QBLhzOU231_TaEMMUvG47elqiu7GcvR2XT6tEyujLYmannwBdJSsUrPSQJAI2tE4V7BIRNzhnOsTI7ydufh5jqkSX73wbVbUrcDIyHsq0tIXrM-iRtUgcoHp0mS0UElZRd2hTwKMqNaKaHvGm4boXFewSqwwDlT92pYx_bzi1ZrfAHshAEfsaelBseLpWyzHfoLaIx5Rnj525ZyX5O4r0L5CtLHnbzkEsiCFBaJtqJ5HFTFJbcSc_a3bhxqnVJ-JD8zR7HYdEkowbPWhVV95LiSxdx8j1aL8b7rSCKd34IGwDP9zh7v0uvf96AskZyosv1PFAFey14ha1J4RoVRRSMca2fbw_XZiNzIZShYWIiHsRL9j8jKYtv9utivd1ltvZBRiPanu45JHwAd_-NFI3FCZLmWAf_60rH61bd4VV168O-UNiKQzUQwzAg3z3Vi8Y53KrI";

// 缓存配置，避免重复创建
let configInstance: Config | null = null;
let quoteContextInstance: QuoteContext | null = null;
const quoteCache = new Map<string, { data: QuoteInfo; timestamp: number }>();
const CACHE_TTL = 3000; // 3 seconds
const historyCache = new Map<string, { data: HistoricalDailyClose[]; timestamp: number }>();
const HISTORY_CACHE_TTL = 10 * 60_000; // 10 minutes
let fxRatesCache: { data: FxRates; timestamp: number } | null = null;
const FX_CACHE_TTL = 60_000; // 60 seconds

function getConfig(): Config {
  if (!configInstance) {
    configInstance = new Config({
      appKey: APP_KEY,
      appSecret: APP_SECRET,
      accessToken: ACCESS_TOKEN,
    });
  }
  return configInstance;
}

async function getQuoteContext(): Promise<QuoteContext> {
  if (!quoteContextInstance) {
    const config = getConfig();
    quoteContextInstance = await QuoteContext.new(config);
  }
  return quoteContextInstance;
}

/**
 * 清理配置缓存和上下文
 */
export function clearConfigCache(): void {
  configInstance = null;
  // QuoteContext 并没有显式的 close 方法在类型定义中（通常），如果有的话应该调用
  // 假设 SDK 管理连接，我们只是释放引用
  quoteContextInstance = null;
  quoteCache.clear();
}

/**
 * 获取实时行情
 * @param symbols 股票代码数组，如 ["QQQ.US", "AAPL.US", "700.HK"]
 * @returns 行情数据数组
 */
export async function getQuotes(symbols: string[]): Promise<QuoteInfo[]> {
  const now = Date.now();
  const result: QuoteInfo[] = [];
  const symbolsToFetch: string[] = [];

  // Check cache first
  for (const symbol of symbols) {
    const cached = quoteCache.get(symbol);
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      result.push(cached.data);
    } else {
      symbolsToFetch.push(symbol);
    }
  }

  if (symbolsToFetch.length === 0) {
    return result;
  }

  try {
    writeLog('[Quote] Fetching quotes for:', symbolsToFetch);
    const ctx = await getQuoteContext();
    writeLog('[Quote] QuoteContext created, fetching quotes...');
    const quotes = await ctx.quote(symbolsToFetch);
    writeLog('[Quote] Received quotes:', quotes.length);
    
    const fetchedQuotes = quotes.map(q => {
      const info: QuoteInfo = {
        symbol: q.symbol,
        name: (q as any).name || "",
        lastDone: q.lastDone?.toString() || "",
        change: (q as any).change?.toString() || "",
        changeRate: (q as any).changeRate?.toString() || "",
        open: q.open?.toString() || "",
        high: q.high?.toString() || "",
        low: q.low?.toString() || "",
        volume: q.volume?.toString() || "",
        turnover: q.turnover?.toString() || "",
        timestamp: q.timestamp || new Date(),
      };
      
      // Update cache
      quoteCache.set(q.symbol, {
        data: info,
        timestamp: now
      });
      
      return info;
    });

    return [...result, ...fetchedQuotes];
  } catch (error) {
    writeLog("[Quote] Failed to fetch quotes:", error);
    // If fetch fails, try to return stale cache if available, or throw
    // For now, let's just re-throw
    throw error;
  }
}

export interface FxRates {
  // 1 USD = x CURRENCY
  USD: number;
  HKD: number;
  CNY: number;
  timestamp: string;
}

export interface HistoricalDailyClose {
  date: string;
  close: number;
}

function toNaiveDate(dateStr?: string | null): NaiveDate | undefined {
  if (!dateStr) return undefined;
  const [y, m, d] = String(dateStr).split('-').map((v) => Number(v));
  if (!y || !m || !d) return undefined;
  return new NaiveDate(y, m, d);
}

function toMarketDateString(timestamp: Date, symbol: string): string {
  const isUs = symbol.endsWith('.US');
  const timeZone = isUs ? 'America/New_York' : 'Asia/Shanghai';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
}

export async function getFxRates(): Promise<FxRates> {
  const now = Date.now();
  if (fxRatesCache && now - fxRatesCache.timestamp < FX_CACHE_TTL) {
    return fxRatesCache.data;
  }

  const resp = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!resp.ok) {
    throw new Error(`FX API failed: ${resp.status}`);
  }

  const payload = await resp.json() as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };

  const usd = 1;
  const hkd = payload?.rates?.HKD;
  const cny = payload?.rates?.CNY;

  if (!hkd || !cny) {
    throw new Error('FX API missing HKD/CNY rates');
  }

  const data: FxRates = {
    USD: usd,
    HKD: hkd,
    CNY: cny,
    timestamp: payload.time_last_update_utc || new Date().toISOString(),
  };

  fxRatesCache = { data, timestamp: now };
  return data;
}

export async function getHistoryDailyCloses(
  symbol: string,
  startDate?: string,
  endDate?: string,
): Promise<HistoricalDailyClose[]> {
  const cacheKey = `${symbol}|${startDate || ''}|${endDate || ''}`;
  const now = Date.now();
  const cached = historyCache.get(cacheKey);
  if (cached && now - cached.timestamp < HISTORY_CACHE_TTL) {
    return cached.data;
  }

  const ctx = await getQuoteContext();
  const start = toNaiveDate(startDate);
  const end = toNaiveDate(endDate);
  const candles = await ctx.historyCandlesticksByDate(
    symbol,
    Period.Day,
    AdjustType.NoAdjust,
    start,
    end,
  );

  const rows = candles
    .map((candle) => ({
      date: toMarketDateString(candle.timestamp, symbol),
      close: Number(candle.close?.toString() || 0),
    }))
    .filter((row) => row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  historyCache.set(cacheKey, { data: rows, timestamp: now });
  return rows;
}

/**
 * 单只股票行情
 */
export interface QuoteInfo {
  symbol: string;
  name: string;
  lastDone: string;   // 最新价
  change: string;     // 涨跌额
  changeRate: string; // 涨跌幅
  open: string;       // 开盘价
  high: string;       // 最高价
  low: string;        // 最低价
  volume: string;      // 成交量
  turnover: string;   // 成交额
  timestamp: Date;    // 更新时间戳
}
