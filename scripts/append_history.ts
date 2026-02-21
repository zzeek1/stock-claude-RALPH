
import fs from 'fs';
import path from 'path';

const MAIN_FILE = path.join(process.cwd(), 'history_prices.json');

function main() {
  const symbol = process.argv[2];
  const tempFile = process.argv[3];

  if (!symbol || !tempFile) {
    console.error("Usage: tsx append_history.ts <SYMBOL> <TEMP_FILE>");
    process.exit(1);
  }

  if (!fs.existsSync(tempFile)) {
    console.error(`Temp file not found: ${tempFile}`);
    process.exit(1);
  }

  let mainData: Record<string, any> = {};
  if (fs.existsSync(MAIN_FILE)) {
    try {
      mainData = JSON.parse(fs.readFileSync(MAIN_FILE, 'utf-8'));
    } catch (e) {
      console.error("Error reading main file, starting fresh.");
    }
  }

  try {
    const rawData = fs.readFileSync(tempFile, 'utf-8');
    const candles = JSON.parse(rawData);

    if (!mainData[symbol]) {
      mainData[symbol] = {};
    }

    if (Array.isArray(candles)) {
      const priceMap: Record<string, any> = {};
      for (const c of candles) {
        // timestamp: "2022-02-25T05:00:00Z" -> "2022-02-25"
        const date = c.timestamp.split('T')[0];
        // Store close price. 
        // We can also store OHLCV if we want, but for NAV we just need close.
        // Let's store object { close, open, high, low, volume } for future proofing.
        priceMap[date] = {
          close: parseFloat(c.close),
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          volume: parseFloat(c.volume)
        };
      }
      Object.assign(mainData[symbol], priceMap);
      console.log(`Merged ${candles.length} candles for ${symbol}`);
    } else {
        console.error(`Invalid candle data for ${symbol}: not an array`);
    }

    fs.writeFileSync(MAIN_FILE, JSON.stringify(mainData, null, 2));
    
  } catch (e) {
    console.error("Error processing data:", e);
    process.exit(1);
  }
}

main();
