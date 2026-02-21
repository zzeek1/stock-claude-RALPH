
import { Config, QuoteContext } from "longbridge";
import fs from 'fs';
import path from 'path';

const QUOTE_SERVICE_FILE = path.join(process.cwd(), 'src/main/services/quote-service.ts');
const SYMBOLS_FILE = path.join(__dirname, 'full_symbols.json');
const OUTPUT_FILE = path.join(process.cwd(), 'history_prices.json');

// Map from symbol to { date: close_price }
type PriceMap = Record<string, Record<string, number>>;

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
  
  const priceMap: PriceMap = {};
  
  // Load existing if any
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
        const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
        Object.assign(priceMap, existing);
    } catch (e) {}
  }

  const BATCH_SIZE = 5;
  
  // Start date: 2024-01-01 (or earlier based on trades)
  // We can just fetch last 500 days to be safe.
  // The SDK candlesticks method usually returns latest N.
  // Or we can specify count. 
  // Let's use count=1000 for Day candles, covering ~3-4 years.
  
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    console.log(`Fetching batch ${i / BATCH_SIZE + 1}/${Math.ceil(symbols.length / BATCH_SIZE)}: ${batch.join(', ')}`);
    
    // Fetch one by one to avoid multi-symbol candlestick complexity if SDK doesn't support batch candles well
    // SDK supports `candlesticks(symbol, period, count, type)`
    
    for (const symbol of batch) {
        if (priceMap[symbol] && Object.keys(priceMap[symbol]).length > 10) {
            console.log(`  Skipping ${symbol}, already has data.`);
            continue;
        }

        try {
            const candles = await ctx.candlesticks(symbol, "day", 1000, "forward_adjust");
            
            const symbolData: Record<string, number> = {};
            for (const c of candles) {
                // timestamp is Date object or number?
                // In Node SDK it returns Candlestick object
                const dateStr = new Date(c.timestamp).toISOString().split('T')[0];
                symbolData[dateStr] = Number(c.close);
            }
            
            priceMap[symbol] = symbolData;
            console.log(`  Fetched ${candles.length} candles for ${symbol}`);
        } catch (err) {
            console.error(`  Error fetching ${symbol}:`, err);
        }
        
        // Small delay to be nice
        await new Promise(r => setTimeout(r, 200));
    }
    
    // Save progress
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(priceMap, null, 2));
  }
  
  console.log("Done fetching all prices.");
  // process.exit(0); // Force exit if context keeps open
}

main().catch(console.error);
