/**
 * Longbridge 实时行情服务
 */
import { Config, QuoteContext } from "longbridge";

// 硬编码的凭证
const APP_KEY = "110cf270ca570e1b8b60b8a74bef3346";
const APP_SECRET = "721b3835d40a07b2a1146ad6f9b3254c1007c8443b3ab9328485a244cb460f39";
const ACCESS_TOKEN = "m_eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJsb25nYnJpZGdlIiwic3ViIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzc3NDc1MTkwLCJpYXQiOjE3Njk2OTkxOTEsImFrIjoiMTEwY2YyNzBjYTU3MGUxYjhiNjBiOGE3NGJlZjMzNDYiLCJhYWlkIjoyMDg2MTQ1NCwiYWMiOiJsYl9wYXBlcnRyYWRpbmciLCJtaWQiOjE2Mzg0NTQ4LCJzaWQiOiJlaW9ick5LT0k2QzdXTGhtYVZSeCtRPT0iLCJibCI6MywidWwiOjAsImlrIjoibGJfcGFwZXJ0cmFkaW5nXzIwODYxNDU0In0.tIayuixRJTc-ZahxVtjl8jZU80wyn2n-UMO5Z-BoBQ8H7yzeJUA9pxGjUHTSsRZm0uLWe1l7oj_eBM-WgmTO4Dty8bs5_l0PTcQjaF2mFW9HNEBj8ITwnxRsnbSzRiLNTFKPJl8ckKV0HfNhed_Kzf7uRkGWoYt3hrKDS8Dr_XwJX6Kv4WUJQ3k9bqO3r8nptqRuY6XI7z7TCwLb-ZhdO67VwPi6KDNC-Gk9wLsoWmaZtLIyGX1f2i2gF70JK-J4BfAIqPMqP3N1Uh6Xoq0h--aAI9YQDl8PYhVyBh-EuxpwjQoaO-kUjRxeQKtgLDj3dj0EW8dmGqsa-VQw2o4xG3px4mPDfsd6JuoeupIfVPiMqmwRK1LiFa0OnCuNajnDIzd-6IGi8QDKfWlk-VpjT9WPsw8be7QKMmt804RA-O8Llmk6ZR4LTxLlRKHJq031IkPsRPUS-tx7QYDWjOxa_mKgOozqIR1YuoiUdYTy1uDX-sT2iXOv2uQ19Cmo79qRFxcPsDkO1XJDr1kSA0_gsBj5GpNawbOPITPtuE6NVcYjHU8lHItrs7QulE_9jUb0CPgO21yC29yMuYEnmCKG9MhVOmkbV9RMAI53VOuk_GlmsptLs0aEewD-A-bts2K0daKp207K3C4qhoJk2F9d2go8fM8cDEJbU2bZgzYwvv4";

// 缓存配置，避免重复创建
let configInstance: Config | null = null;
let quoteContextInstance: QuoteContext | null = null;
const quoteCache = new Map<string, { data: QuoteInfo; timestamp: number }>();
const CACHE_TTL = 3000; // 3 seconds

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
    const ctx = await getQuoteContext();
    const quotes = await ctx.quote(symbolsToFetch);
    
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
    console.error("Failed to fetch quotes:", error);
    // If fetch fails, try to return stale cache if available, or throw
    // For now, let's just re-throw
    throw error;
  }
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
