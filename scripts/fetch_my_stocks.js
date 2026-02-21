
const { Config, QuoteContext } = require("longbridge");
const fs = require('fs');
const path = require('path');

// Symbols to fetch
const symbols = [
  "1428.HK", "6881.HK", "700.HK", "9992.HK", "6181.HK", 
  "981.HK", "799.HK", "1024.HK", "2202.HK", "960.HK", 
  "1896.HK", "763.HK", "6862.HK", "1318.HK", "1114.HK", 
  "3690.HK", "9660.HK", "2400.HK", "7226.HK", "1357.HK", 
  "751.HK", "1022.HK", "9698.HK", "388.HK", "1816.HK", 
  "1776.HK", "2020.HK", "2050.HK", "7709.HK", "9868.HK", 
  "2259.HK", "553.HK", "2513.HK", "100.HK"
];

// Target directory
const OUTPUT_DIR = path.join(process.cwd(), '股票数据');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Get keys from quote-service.ts
const QUOTE_SERVICE_FILE = path.join(process.cwd(), 'src/main/services/quote-service.ts');

function getKeys() {
  if (!fs.existsSync(QUOTE_SERVICE_FILE)) {
    console.error(`Quote service file not found: ${QUOTE_SERVICE_FILE}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(QUOTE_SERVICE_FILE, 'utf-8');
  
  const appKeyMatch = content.match(/const APP_KEY = "(.*?)";/);
  const appSecretMatch = content.match(/const APP_SECRET = "(.*?)";/);
  const accessTokenMatch = content.match(/const ACCESS_TOKEN = "(.*?)";/);
  
  if (!appKeyMatch || !appSecretMatch || !accessTokenMatch) {
    console.error('Could not find API keys in quote-service.ts');
    process.exit(1);
  }
  
  return {
    appKey: appKeyMatch[1],
    appSecret: appSecretMatch[1],
    accessToken: accessTokenMatch[1]
  };
}

async function main() {
  const { appKey, appSecret, accessToken } = getKeys();
  console.log(`Using App Key: ${appKey.substring(0, 4)}...`);

  const config = new Config({
    appKey,
    appSecret,
    accessToken,
  });

  const ctx = await QuoteContext.new(config);
  
  console.log(`Starting fetch for ${symbols.length} symbols...`);

  for (const symbol of symbols) {
    const outputPath = path.join(OUTPUT_DIR, `${symbol}.csv`);
    
    try {
      console.log(`Fetching ${symbol}...`);
      // Fetch daily candles, 1000 count (approx 4 years), forward adjusted
      const candles = await ctx.candlesticks(symbol, "day", 1000, "forward_adjust");
      
      if (!candles || candles.length === 0) {
        console.log(`  No data for ${symbol}`);
        continue;
      }

      // Prepare CSV content
      const header = "Date,Open,High,Low,Close,Volume,Turnover\n";
      const rows = candles.map(c => {
        const dateStr = new Date(c.timestamp).toISOString().split('T')[0];
        return `${dateStr},${c.open},${c.high},${c.low},${c.close},${c.volume},${c.turnover}`;
      }).join('\n');

      fs.writeFileSync(outputPath, header + rows, 'utf-8');
      console.log(`  Saved ${candles.length} records to ${outputPath}`);
      
    } catch (err) {
      console.error(`  Error fetching ${symbol}:`, err);
    }
    
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log("All done!");
  process.exit(0);
}

main().catch(console.error);
