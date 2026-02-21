import fs from 'fs';
import path from 'path';

const MAIN_FILE = path.join(process.cwd(), 'history_prices.json');
const BATCH_FILE = path.join(process.cwd(), 'temp_batch_input.json');

function main() {
  if (!fs.existsSync(BATCH_FILE)) {
    console.log("No batch file found.");
    return;
  }

  let mainData = {};
  if (fs.existsSync(MAIN_FILE)) {
    try {
      mainData = JSON.parse(fs.readFileSync(MAIN_FILE, 'utf-8'));
    } catch (e) {
      console.error("Error reading main file:", e);
    }
  }

  try {
    const batchData = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf-8'));
    
    for (const [symbol, candles] of Object.entries(batchData)) {
      if (!mainData[symbol]) {
        mainData[symbol] = {};
      }
      
      // candles is array of objects. We want date -> close price (or object)
      // The user wants "Net Asset Value", so we need Close Price.
      // But maybe we should store OHLC if we want to be thorough.
      // The previous 'merge_prices.ts' expected Record<string, number> (date -> price).
      // But the tool returns full candles.
      // Let's store full candles or just close?
      // "stats-service.ts" likely needs daily close.
      // Let's look at what 'stats-service.ts' expects later.
      // For now, let's store: date -> { close, open, high, low, volume }
      // Or just date -> close.
      
      // Let's check what 'scripts/merge_prices.ts' defined:
      // type PriceMap = Record<string, Record<string, number>>; 
      // It seems it expected symbol -> date -> price.
      
      // So let's map it to date -> close price.
      
      if (Array.isArray(candles)) {
         const priceMap = {};
         for (const c of candles) {
           // timestamp: "2022-02-25T05:00:00Z"
           // We need YYYY-MM-DD
           const date = c.timestamp.split('T')[0];
           priceMap[date] = parseFloat(c.close);
         }
         Object.assign(mainData[symbol], priceMap);
      }
    }

    fs.writeFileSync(MAIN_FILE, JSON.stringify(mainData, null, 2));
    console.log(`Merged ${Object.keys(batchData).length} symbols.`);
    
    // fs.unlinkSync(BATCH_FILE); // Keep it for now or delete? Delete is cleaner.
    fs.unlinkSync(BATCH_FILE);
  } catch (e) {
    console.error("Error processing batch:", e);
  }
}

main();