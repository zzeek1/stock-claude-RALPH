import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import * as settingsService from '../services/settings-service';
import * as backupService from '../services/backup-service';
import { StockCode } from '../../shared/types';
import { inferMarketFromCode } from '../../shared/market-utils';

// In-memory stock code cache
let stockCodes: StockCode[] = [];

// Extended stock list with common stocks
const DEFAULT_STOCK_CODES: StockCode[] = [
    // A股
    { code: '600519', name: '贵州茅台', market: 'SH' },
    { code: '601318', name: '中国平安', market: 'SH' },
    { code: '600036', name: '招商银行', market: 'SH' },
    { code: '000858', name: '五粮液', market: 'SZ' },
    { code: '000333', name: '美的集团', market: 'SZ' },
    { code: '002594', name: '比亚迪', market: 'SZ' },
    { code: '600900', name: '长江电力', market: 'SH' },
    { code: '601012', name: '隆基绿能', market: 'SH' },
    { code: '000001', name: '平安银行', market: 'SZ' },
    { code: '600276', name: '恒瑞医药', market: 'SH' },
    { code: '601888', name: '中国中免', market: 'SH' },
    { code: '300750', name: '宁德时代', market: 'SZ' },
    { code: '002475', name: '立讯精密', market: 'SZ' },
    { code: '600809', name: '山西汾酒', market: 'SH' },
    { code: '000568', name: '泸州老窖', market: 'SZ' },
    { code: '002714', name: '牧原股份', market: 'SZ' },
    { code: '601166', name: '兴业银行', market: 'SH' },
    { code: '600030', name: '中信证券', market: 'SH' },
    { code: '300059', name: '东方财富', market: 'SZ' },
    { code: '603259', name: '药明康德', market: 'SH' },
    { code: '600887', name: '伊利股份', market: 'SH' },
    { code: '000651', name: '格力电器', market: 'SZ' },
    { code: '601398', name: '工商银行', market: 'SH' },
    { code: '601939', name: '建设银行', market: 'SH' },
    { code: '600000', name: '浦发银行', market: 'SH' },
    { code: '002304', name: '洋河股份', market: 'SZ' },
    { code: '300760', name: '迈瑞医疗', market: 'SZ' },
    { code: '601899', name: '紫金矿业', market: 'SH' },
    { code: '002415', name: '海康威视', market: 'SZ' },
    { code: '600585', name: '海螺水泥', market: 'SH' },
    // 美股ETF
    { code: 'QQQ', name: 'Invesco QQQ Trust', market: 'US' },
    { code: 'SPY', name: 'SPDR S&P 500 ETF', market: 'US' },
    { code: 'IWM', name: 'iShares Russell 2000 ETF', market: 'US' },
    { code: 'DIA', name: 'SPDR Dow Jones ETF', market: 'US' },
    { code: 'VOO', name: 'Vanguard S&P 500 ETF', market: 'US' },
    { code: 'VTI', name: 'Vanguard Total Stock Market ETF', market: 'US' },
    { code: 'VEA', name: 'Vanguard FTSE Developed Markets ETF', market: 'US' },
    { code: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF', market: 'US' },
    { code: 'BND', name: 'Vanguard Total Bond Market ETF', market: 'US' },
    { code: 'GLD', name: 'SPDR Gold Shares', market: 'US' },
    { code: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', market: 'US' },
    { code: 'XLF', name: 'Financial Select Sector SPDR Fund', market: 'US' },
    { code: 'XLE', name: 'Energy Select Sector SPDR Fund', market: 'US' },
    { code: 'XLV', name: 'Health Care Select Sector SPDR Fund', market: 'US' },
    { code: 'XLK', name: 'Technology Select Sector SPDR Fund', market: 'US' },
    { code: 'XLE', name: 'Energy Select Sector SPDR Fund', market: 'US' },
    // 热门美股
    { code: 'AAPL', name: 'Apple Inc.', market: 'US' },
    { code: 'MSFT', name: 'Microsoft Corporation', market: 'US' },
    { code: 'GOOGL', name: 'Alphabet Inc.', market: 'US' },
    { code: 'AMZN', name: 'Amazon.com Inc.', market: 'US' },
    { code: 'NVDA', name: 'NVIDIA Corporation', market: 'US' },
    { code: 'META', name: 'Meta Platforms Inc.', market: 'US' },
    { code: 'TSLA', name: 'Tesla Inc.', market: 'US' },
    { code: 'BRK.B', name: 'Berkshire Hathaway Inc.', market: 'US' },
    { code: 'JPM', name: 'JPMorgan Chase & Co.', market: 'US' },
    { code: 'V', name: 'Visa Inc.', market: 'US' },
    { code: 'JNJ', name: 'Johnson & Johnson', market: 'US' },
    { code: 'WMT', name: 'Walmart Inc.', market: 'US' },
    { code: 'PG', name: 'Procter & Gamble Co.', market: 'US' },
    { code: 'MA', name: 'Mastercard Inc.', market: 'US' },
    { code: 'HD', name: 'Home Depot Inc.', market: 'US' },
    { code: 'UNH', name: 'UnitedHealth Group Inc.', market: 'US' },
    { code: 'DIS', name: 'Walt Disney Co.', market: 'US' },
    { code: 'NFLX', name: 'Netflix Inc.', market: 'US' },
    { code: 'AMD', name: 'Advanced Micro Devices Inc.', market: 'US' },
    { code: 'INTC', name: 'Intel Corporation', market: 'US' },
    { code: 'COST', name: 'Costco Wholesale Corp.', market: 'US' },
    // 港股
    { code: '00700', name: '腾讯控股', market: 'HK' },
    { code: '09988', name: '阿里巴巴-SW', market: 'HK' },
    { code: '00981', name: '中芯国际', market: 'HK' },
    { code: '03690', name: '美团-W', market: 'HK' },
    { code: '02318', name: '中国平安', market: 'HK' },
    { code: '01179', name: '华润燃气', market: 'HK' },
    { code: '01810', name: '小米集团-W', market: 'HK' },
    { code: '02269', name: '药明生物', market: 'HK' },
    { code: '03888', name: '金山软件', market: 'HK' },
    { code: '00267', name: '新天绿色', market: 'HK' },
    // 更多港股
    { code: '00553', name: '南京熊猫电子股份', market: 'HK' },
    { code: '01318', name: '金川国际', market: 'HK' },
    { code: '00968', name: '信义能源', market: 'HK' },
    { code: '01776', name: '华润电力', market: 'HK' },
    { code: '01816', name: '小鹏汽车-W', market: 'HK' },
    { code: '02020', name: '安踏体育', market: 'HK' },
    { code: '02050', name: '中国平安(繁体)', market: 'HK' },
    { code: '02259', name: '新天绿色能源', market: 'HK' },
    { code: '02513', name: '中国平安(繁体2)', market: 'HK' },
    { code: '06862', name: '海底捞', market: 'HK' },
    { code: '07709', name: '中国中铁', market: 'HK' },
    { code: '09868', name: '小鹏汽车-W', market: 'HK' },
    { code: '01000', name: '华润燃气', market: 'HK' },
    { code: '01428', name: '民生银行', market: 'HK' },
    { code: '06881', name: '中国中铁', market: 'HK' },
    { code: '09992', name: '泡泡玛特', market: 'HK' },
    { code: '06181', name: '中国中铁', market: 'HK' },
    { code: '00799', name: '中国平安(繁体3)', market: 'HK' },
    { code: '01024', name: '快手-W', market: 'HK' },
    { code: '02202', name: '万科企业', market: 'HK' },
    { code: '00960', name: '龙湖集团', market: 'HK' },
    { code: '01896', name: '微博-SW', market: 'HK' },
    { code: '00763', name: '中兴通讯', market: 'HK' },
    { code: '03888', name: '金山软件', market: 'HK' },
    // 指数ETF
    { code: '510300', name: '沪深300ETF', market: 'SH' },
    { code: '510500', name: '中证500ETF', market: 'SH' },
    { code: '159915', name: '创业板ETF', market: 'SZ' },
    { code: '513050', name: '中证100ETF', market: 'SH' },
    { code: '159919', name: '沪深300ETF', market: 'SZ' },
    { code: '159941', name: '纳指ETF', market: 'SZ' },
    { code: '513360', name: '科创50ETF', market: 'SH' },
  ];

function initStockCodes(): void {
  stockCodes = [...DEFAULT_STOCK_CODES];
}

// Load additional stock codes from CSV file if exists
export function loadStockCodesFromCsv(csvContent: string): void {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const newStocks: StockCode[] = [];

  for (const line of lines) {
    // Skip header
    if (line.includes('代码') || line.includes('code') || line.includes('股票代码')) continue;

    const parts = line.split(',');
    if (parts.length >= 2) {
      const code = parts[0].trim();
      const name = parts[1].trim();
      const market = inferMarketFromCode(code) || 'SH';

      newStocks.push({ code, name, market });
    }
  }

  // Merge with existing, avoiding duplicates
  const existingCodes = new Set(stockCodes.map(s => s.code));
  for (const stock of newStocks) {
    if (!existingCodes.has(stock.code)) {
      stockCodes.push(stock);
    }
  }
}

/**
 * 更新所有交易记录的股票名称
 * 根据 stockCodes 列表中的代码匹配
 */
export function updateAllTradeStockNames(): number {
  const { queryAll, execute, saveDb, getChanges } = require('../database/connection');

  // 获取所有交易记录中不重复的股票代码
  const trades = queryAll(`
    SELECT DISTINCT stock_code, market
    FROM trades
    WHERE market IN ('SH', 'SZ', 'BJ', 'HK')
  `) as { stock_code: string; market: StockCode['market'] }[];

  if (trades.length === 0) return 0;

  let updatedCount = 0;

  for (const trade of trades) {
    const code = trade.stock_code;
    const market = trade.market;
    // 查找对应的股票名称
    const stockInfo = stockCodes.find(s => s.code === code && s.market === market);
    if (stockInfo && stockInfo.name && stockInfo.name !== code) {
      execute(
        `UPDATE trades
         SET stock_name = ?
         WHERE stock_code = ?
           AND market = ?
           AND (stock_name IS NULL OR stock_name <> ?)`,
        [stockInfo.name, code, market, stockInfo.name]
      );
      updatedCount += Number(getChanges?.() || 0);
    }
  }

  if (updatedCount > 0) {
    saveDb();
  }

  return updatedCount;
}

export function registerSettingsHandlers(): void {
  initStockCodes();

  // One-time normalization on startup: fix legacy stock names by code+market.
  if (process.env.NODE_ENV !== 'test') {
    try {
      updateAllTradeStockNames();
    } catch (error) {
      console.error('Failed to normalize trade stock names on startup:', error);
    }
  }

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    try {
      return { success: true, data: settingsService.getAllSettings() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_, settings) => {
    try {
      settingsService.saveSettings(settings);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_API_KEY, async (_, key) => {
    try {
      settingsService.saveApiKey(key);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_API_KEY, async () => {
    try {
      return { success: true, data: settingsService.getApiKey() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STOCK_SEARCH, async (_, keyword: string) => {
    try {
      if (!keyword || keyword.length < 1) return { success: true, data: [] };
      const lowerKeyword = keyword.toLowerCase();
      const results = stockCodes.filter(
        s => s.code.toLowerCase().includes(lowerKeyword) || s.name.toLowerCase().includes(lowerKeyword)
      ).slice(0, 10);
      return { success: true, data: results };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.STOCK_IMPORT_CSV, async (_, csvContent: string) => {
    try {
      const countBefore = stockCodes.length;
      loadStockCodesFromCsv(csvContent);
      const countAfter = stockCodes.length;
      return { success: true, data: { added: countAfter - countBefore, total: countAfter } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 更新交易记录的股票名称
  ipcMain.handle(IPC_CHANNELS.STOCK_UPDATE_NAMES, async () => {
    try {
      const updatedCount = updateAllTradeStockNames();
      return { success: true, data: { updated: updatedCount } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_SNAPSHOT_SAVE, async (_, snapshot) => {
    try {
      const { saveSnapshot } = require('../services/account-service');
      return { success: true, data: saveSnapshot(snapshot) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_SNAPSHOT_LIST, async (_, startDate, endDate) => {
    try {
      const { listSnapshots } = require('../services/account-service');
      return { success: true, data: listSnapshots(startDate, endDate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_SNAPSHOT_AUTO, async () => {
    try {
      const {
        getLatestSnapshot,
        rebuildHistoricalSnapshots,
        generateAutoSnapshot,
        saveSnapshot,
      } = require('../services/account-service');

      const latestBefore = getLatestSnapshot();
      const anchorTotalAssets = latestBefore?.total_assets && latestBefore.total_assets > 0
        ? Number(latestBefore.total_assets)
        : undefined;

      const rebuiltLatest = await rebuildHistoricalSnapshots(anchorTotalAssets);
      if (rebuiltLatest) {
        return { success: true, data: rebuiltLatest };
      }

      const snapshotData = await generateAutoSnapshot();
      if (!snapshotData) {
        return { success: false, error: 'Failed to generate snapshot data' };
      }

      const saved = saveSnapshot(snapshotData);
      return { success: true, data: saved };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_EXPORT, async () => {
    try {
      const filePath = await backupService.exportDatabase();
      return { success: true, data: filePath };
    } catch (error: any) {
      if (error.message === '用户取消') {
        return { success: false, error: '用户取消' };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_IMPORT, async () => {
    try {
      await backupService.importDatabase();
      return { success: true };
    } catch (error: any) {
      if (error.message === '用户取消') {
        return { success: false, error: '用户取消' };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_LIST, async () => {
    try {
      const backups = backupService.listBackups();
      return { success: true, data: backups };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_EXPORT_ENCRYPTED, async () => {
    try {
      const filePath = await backupService.exportEncryptedBackup();
      return { success: true, data: filePath };
    } catch (error: any) {
      if (error.message === '用户取消') {
        return { success: false, error: '用户取消' };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_IMPORT_ENCRYPTED, async () => {
    try {
      await backupService.importEncryptedBackup();
      return { success: true };
    } catch (error: any) {
      if (error.message === '用户取消') {
        return { success: false, error: '用户取消' };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_CLOUD_SYNC, async (_, config: any) => {
    try {
      const filePath = await backupService.syncToCloudFolder(config);
      return { success: true, data: filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_TEST_OLLAMA, async () => {
    try {
      const result = await settingsService.testOllamaConnection();
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });
}
