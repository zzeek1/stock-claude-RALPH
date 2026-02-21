
import fs from 'fs';
import path from 'path';

const MAIN_FILE = path.join(process.cwd(), 'history_prices.json');
const BATCH_FILE = path.join(process.cwd(), 'temp_batch.json');

// Type: symbol -> date -> price
type PriceMap = Record<string, Record<string, number>>;

function main() {
  if (!fs.existsSync(BATCH_FILE)) {
    console.log("No batch file found to merge.");
    return;
  }

  let mainData: PriceMap = {};
  if (fs.existsSync(MAIN_FILE)) {
    try {
      mainData = JSON.parse(fs.readFileSync(MAIN_FILE, 'utf-8'));
    } catch (e) {
      console.error("Error reading main file:", e);
    }
  }

  try {
    const batchData: PriceMap = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf-8'));
    
    // Merge
    for (const [symbol, prices] of Object.entries(batchData)) {
      if (!mainData[symbol]) {
        mainData[symbol] = {};
      }
      Object.assign(mainData[symbol], prices);
    }

    fs.writeFileSync(MAIN_FILE, JSON.stringify(mainData, null, 2));
    console.log(`Merged ${Object.keys(batchData).length} symbols into history_prices.json. Total symbols: ${Object.keys(mainData).length}`);
    
    // Clean up batch file
    fs.unlinkSync(BATCH_FILE);
  } catch (e) {
    console.error("Error merging batch file:", e);
  }
}

main();
