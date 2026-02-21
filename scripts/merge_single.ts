import fs from 'fs';
import path from 'path';

const MAIN_FILE = path.join(process.cwd(), 'history_prices.json');

async function main() {
  const tempFile = process.argv[2];
  const symbol = process.argv[3];

  if (!tempFile || !symbol) {
    console.error("Usage: npx ts-node scripts/merge_single.ts <temp_file> <symbol>");
    process.exit(1);
  }

  if (!fs.existsSync(tempFile)) {
    console.error("Temp file not found:", tempFile);
    process.exit(1);
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
    const rawData = fs.readFileSync(tempFile, 'utf-8');
    const candles = JSON.parse(rawData);

    if (!mainData[symbol]) {
      mainData[symbol] = {};
    }

    if (Array.isArray(candles)) {
      const priceMap = {};
      for (const c of candles) {
        // timestamp: "2022-02-25T05:00:00Z" -> "2022-02-25"
        const date = c.timestamp.split('T')[0];
        priceMap[date] = parseFloat(c.close);
      }
      Object.assign(mainData[symbol], priceMap);
    }

    fs.writeFileSync(MAIN_FILE, JSON.stringify(mainData, null, 2));
    console.log(`Merged ${symbol} into history_prices.json.`);
    
    // fs.unlinkSync(tempFile);
  } catch (e) {
    console.error("Error processing temp file:", e);
  }
}

main();