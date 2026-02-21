
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { v4 as uuidv4 } from 'uuid';

const CSV_PATH = String.raw`d:\code\stock-claude-RALPH\交易数据\交易数据-至260221.csv`;

function findDb() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'stock-claude', 'stock-claude.db'),
    path.join(process.env.APPDATA || '', 'stock-claude-RALPH', 'stock-claude.db'),
    path.join(process.cwd(), 'userData', 'stock-claude.db'),
    path.join(process.cwd(), 'stock-claude.db'),
  ];
  
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function parseIbkrCsv(content: string) {
  const lines = content.split(/\r?\n/);
  const trades: any[] = [];
  
  // Header: 交易,Header,DataDiscriminator,资产分类,货币,代码,日期/时间,数量,交易价格,收盘价格,收益,佣金/税,基础,已实现的损益,按市值计算的损益,代码
  // Data:   交易,Data,Order,股票,HKD,100,"2026-02-12, 01:03:58",100,628,588,-62800,-103.3756,62903.3756,0,-4000,O;P

  for (const line of lines) {
    if (!line.startsWith('交易,Data,Order')) continue;
    
    // Simple CSV split (handling quotes manually is better but let's try regex split for simplicity first, assuming no commas in fields except date)
    // IBKR Date field is quoted: "2026-02-12, 01:03:58". This contains comma!
    // So we must handle quotes.
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current);

    // Indices (based on header):
    // 0: 交易
    // 1: Data
    // 2: Order
    // 3: Asset Category (股票)
    // 4: Currency (HKD)
    // 5: Symbol (100)
    // 6: Date/Time ("2026-02-12, 01:03:58")
    // 7: Quantity (100)
    // 8: Price (628)
    // 9: Close Price
    // 10: Proceeds (-62800)
    // 11: Comm/Fee (-103.3756)
    // 12: Basis
    // 13: Realized PnL
    // 14: MTM PnL
    // 15: Code (O;P)

    if (parts[3] !== '股票') continue; // Only process stocks

    const currency = parts[4];
    let stockCode = parts[5];
    const dateTimeStr = parts[6];
    const quantityRaw = parseFloat(parts[7].replace(/,/g, ''));
    const price = parseFloat(parts[8].replace(/,/g, ''));
    const proceeds = parseFloat(parts[10].replace(/,/g, ''));
    const commFee = parseFloat(parts[11].replace(/,/g, '')); // usually negative
    const realizedPnl = parseFloat(parts[13].replace(/,/g, '')) || 0;

    let market = 'US';
    if (currency === 'HKD') {
      market = 'HK';
      // Pad stock code to 5 digits
      stockCode = stockCode.padStart(5, '0');
    } else if (currency === 'USD') {
      market = 'US';
    } else if (currency === 'CNY') {
      // Simple heuristic for SH/SZ
      if (stockCode.startsWith('6')) market = 'SH';
      else market = 'SZ';
    }

    const direction = quantityRaw > 0 ? 'BUY' : 'SELL';
    const quantity = Math.abs(quantityRaw);
    const amount = Math.abs(proceeds); // Transaction amount
    const commission = Math.abs(commFee);
    const stampTax = 0; // IBKR usually bundles stamp tax in fee for HK stocks, or separates it. Assuming bundled in Comm/Fee for now or 0 if separate.
    // In the CSV sample, Comm/Fee is -103.3756 for 62800 amount. 103/62800 ~ 0.16%. 
    // HK Stamp Duty is 0.1%. Platform fee + others. So likely included.

    // Calculate total cost
    // BUY: Cost = Amount + Comm
    // SELL: Return = Amount - Comm
    const totalCost = direction === 'BUY' 
      ? amount + commission 
      : amount - commission;

    // Date parsing "2026-02-12, 01:03:58" -> "2026-02-12", "01:03:58"
    const [datePart, timePart] = dateTimeStr.split(', ');
    
    trades.push({
      id: uuidv4(),
      stock_code: stockCode,
      stock_name: stockCode, // Placeholder, app might fetch name later
      market,
      direction,
      trade_date: datePart,
      trade_time: timePart,
      price,
      quantity,
      amount,
      commission,
      stamp_tax: stampTax,
      total_cost: totalCost,
      realized_pnl: realizedPnl !== 0 ? realizedPnl : null, // Only if non-zero
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: '["Imported"]',
      is_impulsive: 0
    });
  }
  return trades;
}

async function main() {
  const dbPath = findDb();
  if (!dbPath) {
    console.error('错误: 找不到数据库文件 (stock-claude.db)。请确保应用至少运行过一次。');
    process.exit(1);
  }
  console.log('找到数据库:', dbPath);
  console.log('正在读取 CSV...');

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const trades = parseIbkrCsv(csvContent);
  console.log(`解析到 ${trades.length} 条股票交易记录。`);

  if (trades.length === 0) {
    console.log('没有发现可导入的交易。');
    return;
  }

  // Backup
  const backupPath = dbPath + `.${Date.now()}.bak`;
  fs.copyFileSync(dbPath, backupPath);
  console.log(`数据库已备份至: ${backupPath}`);

  console.log('警告: 请确保 "stock-claude" 应用已完全关闭！');
  console.log('如果应用正在运行，导入的数据可能会丢失或导致数据库损坏。');
  console.log('正在写入数据库...');

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const stmt = db.prepare(`
    INSERT INTO trades (
      id, stock_code, stock_name, market, direction, 
      trade_date, trade_time, price, quantity, amount, 
      commission, stamp_tax, total_cost, realized_pnl, 
      tags, created_at, updated_at, is_impulsive
    ) VALUES (
      $id, $stock_code, $stock_name, $market, $direction, 
      $trade_date, $trade_time, $price, $quantity, $amount, 
      $commission, $stamp_tax, $total_cost, $realized_pnl, 
      $tags, $created_at, $updated_at, $is_impulsive
    )
  `);

  db.run("BEGIN TRANSACTION");
  let inserted = 0;
  for (const t of trades) {
    try {
      stmt.run({
        $id: t.id,
        $stock_code: t.stock_code,
        $stock_name: t.stock_name,
        $market: t.market,
        $direction: t.direction,
        $trade_date: t.trade_date,
        $trade_time: t.trade_time,
        $price: t.price,
        $quantity: t.quantity,
        $amount: t.amount,
        $commission: t.commission,
        $stamp_tax: t.stamp_tax,
        $total_cost: t.total_cost,
        $realized_pnl: t.realized_pnl,
        $tags: t.tags,
        $created_at: t.created_at,
        $updated_at: t.updated_at,
        $is_impulsive: t.is_impulsive
      });
      inserted++;
    } catch (e) {
      console.error('Error inserting trade:', e);
    }
  }
  db.run("COMMIT");
  stmt.free();

  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
  
  console.log(`成功导入 ${inserted} 条记录。`);
  console.log('请启动/重启应用查看数据。');
}

main().catch(console.error);
