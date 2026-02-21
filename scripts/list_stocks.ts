
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

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

async function main() {
  const dbPath = findDb();
  if (!dbPath) {
    console.error('Database not found');
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const result = db.exec("SELECT DISTINCT stock_code, market FROM trades ORDER BY trade_date ASC");
  if (result.length > 0) {
    const rows = result[0].values;
    const stocks = rows.map(r => ({ code: r[0], market: r[1] }));
    console.log(JSON.stringify(stocks));
  } else {
    console.log("[]");
  }
  
  // Get earliest date
  const dateRes = db.exec("SELECT MIN(trade_date) FROM trades");
  if (dateRes.length > 0 && dateRes[0].values.length > 0) {
    console.log("Earliest Date:", dateRes[0].values[0][0]);
  }
}

main();
