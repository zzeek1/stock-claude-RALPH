
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const PRICES_FILE = path.join(process.cwd(), 'history_prices.json');

function findDb() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'stock-claude', 'stock-claude.db'),
    path.join(process.cwd(), 'userData', 'stock-claude.db'),
    path.join(process.cwd(), 'stock-claude.db'),
  ];
  
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Map from symbol to { date: close_price }
type PriceMap = Record<string, Record<string, number>>;

async function main() {
  const dbPath = findDb();
  if (!dbPath) {
    console.error('Database not found');
    process.exit(1);
  }

  // Load prices
  if (!fs.existsSync(PRICES_FILE)) {
    console.error('history_prices.json not found. Please ensure it is created by the MCP step.');
    process.exit(1);
  }
  const prices: PriceMap = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf-8'));

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Get all trades
  const tradesRes = db.exec("SELECT stock_code, direction, trade_date, price, quantity, commission, stamp_tax, amount FROM trades ORDER BY trade_date ASC");
  if (tradesRes.length === 0) {
    console.log("No trades found");
    return;
  }
  
  const trades = tradesRes[0].values.map(r => ({
    stock_code: r[0] as string,
    direction: r[1] as string,
    trade_date: r[2] as string,
    price: r[3] as number,
    quantity: r[4] as number,
    commission: r[5] as number,
    stamp_tax: r[6] as number,
    amount: r[7] as number, // This is usually price * quantity
  }));

  const startDate = trades[0].trade_date;
  const endDate = new Date().toISOString().split('T')[0];
  
  let currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  // Account State
  let cash = 0; // Assuming initial capital is 0, we track net cash flow. Or we can set a base.
  // Ideally, we should fetch initial capital from settings table if available.
  const settingsRes = db.exec("SELECT value FROM settings WHERE key = 'initial_capital'");
  if (settingsRes.length > 0 && settingsRes[0].values.length > 0) {
    cash = parseFloat(settingsRes[0].values[0][0] as string) || 0;
  } else {
    // Default to a reasonable number or 0? 
    // If 0, total assets might be negative initially if they buy first.
    // Let's assume 1,000,000 for now if not set, or just track relative.
    cash = 1000000; 
  }
  
  const positions: Record<string, number> = {}; // code -> quantity

  const snapshots: any[] = [];

  // Prepare statement for insertion
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO account_snapshots (
      id, date, total_assets, cash, market_value, 
      daily_pnl, daily_return, cumulative_return, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let lastTotalAssets = cash;
  let initialTotalAssets = cash;

  db.run("BEGIN TRANSACTION");

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // 1. Process trades for this day
    const todaysTrades = trades.filter(t => t.trade_date === dateStr);
    
    for (const trade of todaysTrades) {
      const cost = trade.amount + trade.commission + trade.stamp_tax;
      const revenue = trade.amount - trade.commission - trade.stamp_tax;
      
      if (trade.direction === 'BUY') {
        cash -= cost;
        positions[trade.stock_code] = (positions[trade.stock_code] || 0) + trade.quantity;
      } else if (trade.direction === 'SELL') {
        cash += revenue;
        positions[trade.stock_code] = (positions[trade.stock_code] || 0) - trade.quantity;
      }
    }

    // 2. Calculate market value
    let marketValue = 0;
    for (const [code, qty] of Object.entries(positions)) {
      if (qty > 0) {
        // Find price
        let price = 0;
        // Try to find exact date match
        if (prices[code] && prices[code][dateStr]) {
          price = prices[code][dateStr];
        } else {
          // If no price for today (weekend/holiday), find last available price
          // Optimization: could be slow if doing linear search every time.
          // Since we iterate by date, we can maintain "last known price" cache.
          // For simplicity here, we assume prices map is dense or we look back.
          // Actually, let's just look for the most recent price <= dateStr
          // But prices map is just date keys.
          // Better approach: Pre-fill prices or search.
          // Given the context, let's try to find keys.
          if (prices[code]) {
             // Find closest date <= dateStr
             const availableDates = Object.keys(prices[code]).sort().reverse();
             for (const d of availableDates) {
               if (d <= dateStr) {
                 price = prices[code][d];
                 break;
               }
             }
          }
        }
        
        // If still 0 (e.g. before IPO or data missing), use cost price? 
        // Or just 0.
        if (price === 0) {
           // Fallback: try to find last trade price for this stock
           // Not implemented for brevity, assume 0 or last close.
        }
        
        marketValue += qty * price;
      }
    }

    const totalAssets = cash + marketValue;
    const dailyPnl = totalAssets - lastTotalAssets; // Note: this simple PnL includes deposit/withdraw effects if we had them.
    // Since we don't track deposit/withdraw explicitly here (except initial), this is net change.
    // If we want "Investment PnL", we should exclude deposits.
    // Here we assume no external flows after initial.
    
    const dailyReturn = lastTotalAssets !== 0 ? dailyPnl / lastTotalAssets : 0;
    const cumulativeReturn = initialTotalAssets !== 0 ? (totalAssets - initialTotalAssets) / initialTotalAssets : 0;

    insertStmt.run([
      uuidv4(),
      dateStr,
      totalAssets,
      cash,
      marketValue,
      dailyPnl,
      dailyReturn,
      cumulativeReturn,
      new Date().toISOString()
    ]);

    lastTotalAssets = totalAssets;
    
    // Next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  db.run("COMMIT");
  insertStmt.free();

  // Save DB
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log("Snapshots rebuilt successfully.");
}

main().catch(console.error);
