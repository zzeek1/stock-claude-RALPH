
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
    const stocks = rows.map(r => {
      let code = r[0] as string;
      const market = r[1] as string;
      
      // Fix specific issues if any
      if (code === '3635.T') code = '3635.JP'; // Guessing
      else if (market === 'US' && !code.includes('.')) code = `${code}.US`;
      else if (market === 'HK' && !code.includes('.')) code = `${code}.HK`;
      
      return code;
    });
    console.log(JSON.stringify(stocks, null, 2));
    fs.writeFileSync('scripts/full_symbols.json', JSON.stringify(stocks, null, 2));
  } else {
    console.log("[]");
  }
}

main();
