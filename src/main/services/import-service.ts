import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../database/connection';
import { createTrade } from './trade-service';
import { Trade, Market, Direction } from '../../shared/types';

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  message: string;
  data?: any;
}

export interface ImportPreview {
  total: number;
  fields: string[];
  sampleData: any[];
  detectedFormat: string;
  fieldMapping: FieldMapping;
}

export interface FieldMapping {
  [key: string]: string;
}

const FIELD_ALIASES: { [key: string]: string[] } = {
  stock_code: ['股票代码', '代码', 'code', '股票代码(不含市场)', '证券代码'],
  stock_name: ['股票名称', '名称', 'name', '证券名称'],
  market: ['市场', '交易市场', 'market', '市场类型'],
  direction: ['方向', '买卖方向', 'direction', '交易类型', '买卖'],
  trade_date: ['交易日期', '日期', 'date', '成交日期', '发生日期'],
  price: ['价格', '成交价格', 'price', '买入价', '卖出价', '成交均价'],
  quantity: ['数量', '成交数量', 'quantity', '成交股数', '成交数量(股)'],
  amount: ['金额', '成交金额', 'amount', '成交金额(元)', '发生金额'],
  commission: ['佣金', '手续费', 'commission', '佣金费', '交易费用'],
  stamp_tax: ['印花税', 'stamp_tax', '印花税费'],
  strategy: ['策略', 'strategy', '交易策略'],
  emotion_before: ['交易前情绪', '情绪', 'emotion', 'emotion_before'],
  entry_reason: ['入场理由', '理由', 'entry_reason', '买入理由'],
  exit_plan: ['出场计划', 'exit_plan', '卖出理由'],
  stop_loss: ['止损价', 'stop_loss', '止损'],
  take_profit: ['止盈价', 'take_profit', '止盈'],
};

const DEFAULT_FIELD_MAPPING: FieldMapping = {
  '股票代码': 'stock_code',
  '代码': 'stock_code',
  '股票名称': 'stock_name',
  '名称': 'stock_name',
  '市场': 'market',
  '买卖方向': 'direction',
  '方向': 'direction',
  '交易日期': 'trade_date',
  '日期': 'trade_date',
  '成交价格': 'price',
  '价格': 'price',
  '成交数量': 'quantity',
  '数量': 'quantity',
  '成交金额': 'amount',
  '金额': 'amount',
  '佣金': 'commission',
  '手续费': 'commission',
  '印花税': 'stamp_tax',
  '策略': 'strategy',
  '交易前情绪': 'emotion_before',
  '情绪': 'emotion_before',
  '入场理由': 'entry_reason',
  '出场计划': 'exit_plan',
  '止损价': 'stop_loss',
  '止盈价': 'take_profit',
};

export function parseCSV(content: string): any[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter);
  const results: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const row: any = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    results.push(row);
  }

  return results;
}

function detectDelimiter(line: string): string {
  const delimiters = [',', '\t', ';', '|'];
  let maxCount = 0;
  let bestDelimiter = ',';

  for (const d of delimiters) {
    const count = (line.match(new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = d;
    }
  }

  return bestDelimiter;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export function detectFormat(data: any[]): string {
  if (data.length === 0) return 'unknown';

  const headers = Object.keys(data[0]).map(h => h.toLowerCase());
  
  if (headers.some(h => h.includes('同花顺') || h.includes('ths'))) {
    return 'ths';
  }
  if (headers.some(h => h.includes('东方财富') || h.includes('eastmoney'))) {
    return 'eastmoney';
  }
  if (headers.some(h => h.includes('证券代码') || h.includes('证券名称'))) {
    return 'broker_standard';
  }

  return 'generic';
}

export function createFieldMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};

  for (const header of headers) {
    const headerLower = header.toLowerCase().trim();
    
    if (DEFAULT_FIELD_MAPPING[header]) {
      mapping[header] = DEFAULT_FIELD_MAPPING[header];
      continue;
    }

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.some(alias => headerLower.includes(alias.toLowerCase()))) {
        mapping[header] = field;
        break;
      }
    }
  }

  return mapping;
}

export function previewImport(content: string): ImportPreview {
  const data = parseCSV(content);
  const fields = data.length > 0 ? Object.keys(data[0]) : [];
  const sampleData = data.slice(0, 5);
  const detectedFormat = detectFormat(data);
  const fieldMapping = createFieldMapping(fields);

  return {
    total: data.length,
    fields,
    sampleData,
    detectedFormat,
    fieldMapping,
  };
}

export function importTrades(
  content: string,
  fieldMapping: FieldMapping,
  defaultValues?: Partial<Trade>
): ImportResult {
  const data = parseCSV(content);
  const result: ImportResult = {
    total: data.length,
    success: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2;

    try {
      const trade = mapRowToTrade(row, fieldMapping, defaultValues, rowNumber);
      if (trade) {
        createTrade(trade);
        result.success++;
      }
    } catch (error: any) {
      result.failed++;
      result.errors.push({
        row: rowNumber,
        message: error.message || '导入失败',
        data: row,
      });
    }
  }

  logImport(result);
  return result;
}

function mapRowToTrade(
  row: any,
  fieldMapping: FieldMapping,
  defaultValues?: Partial<Trade>,
  rowNumber?: number
): Omit<Trade, 'id' | 'created_at' | 'updated_at'> | null {
  const mapped: any = {};

  for (const [header, field] of Object.entries(fieldMapping)) {
    const value = row[header];
    if (value !== undefined && value !== '') {
      mapped[field] = value;
    }
  }

  const stockCode = mapped.stock_code || '';
  if (!stockCode) {
    throw new Error('缺少股票代码');
  }

  const direction = parseDirection(mapped.direction);
  if (!direction) {
    throw new Error('无法识别买卖方向');
  }

  const market = parseMarket(mapped.market, stockCode);

  const trade: any = {
    stock_code: stockCode.replace(/[^\w]/g, ''),
    stock_name: mapped.stock_name || stockCode,
    market,
    direction,
    trade_date: parseDate(mapped.trade_date),
    price: parseFloat(mapped.price) || 0,
    quantity: parseInt(mapped.quantity) || 0,
    amount: parseFloat(mapped.amount) || 0,
    commission: parseFloat(mapped.commission) || 0,
    stamp_tax: parseFloat(mapped.stamp_tax) || 0,
    strategy: mapped.strategy || defaultValues?.strategy,
    emotion_before: mapped.emotion_before || defaultValues?.emotion_before,
    entry_reason: mapped.entry_reason,
    exit_plan: mapped.exit_plan,
    stop_loss: parseFloat(mapped.stop_loss) || undefined,
    take_profit: parseFloat(mapped.take_profit) || undefined,
    tags: defaultValues?.tags || [],
    is_impulsive: false,
    ...defaultValues,
  };

  if (!trade.price || trade.price <= 0) {
    throw new Error('价格必须大于0');
  }
  if (!trade.quantity || trade.quantity <= 0) {
    throw new Error('数量必须大于0');
  }
  if (!trade.trade_date) {
    throw new Error('缺少交易日期');
  }

  return trade;
}

function parseDirection(value: string): Direction | null {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  
  if (['买入', 'buy', 'b', '购入', '建仓'].includes(v)) return 'BUY';
  if (['卖出', 'sell', 's', '售出', '清仓', '卖出(撤单)'].some(x => v.includes(x.toLowerCase()))) return 'SELL';
  
  if (v.includes('买') || v.includes('入')) return 'BUY';
  if (v.includes('卖') || v.includes('出')) return 'SELL';
  
  return null;
}

function parseMarket(value: string, stockCode: string): Market {
  if (value) {
    const v = value.toUpperCase().trim();
    if (['SH', '上海', '沪', 'SSE'].some(x => v.includes(x))) return 'SH';
    if (['SZ', '深圳', '深', 'SZSE'].some(x => v.includes(x))) return 'SZ';
    if (['BJ', '北京', '京', 'BSE'].some(x => v.includes(x))) return 'BJ';
    if (['HK', '香港', '港'].some(x => v.includes(x))) return 'HK';
    if (['US', '美国', '美股'].some(x => v.includes(x))) return 'US';
  }

  if (stockCode.startsWith('6') || stockCode.startsWith('5')) return 'SH';
  if (stockCode.startsWith('0') || stockCode.startsWith('3') || stockCode.startsWith('2')) return 'SZ';
  if (stockCode.startsWith('4') || stockCode.startsWith('8')) return 'BJ';
  if (stockCode.length === 5 || stockCode.startsWith('0') && stockCode.length === 5) return 'HK';
  
  return 'SH';
}

function parseDate(value: string): string {
  if (!value) return '';
  
  const cleaned = value.replace(/[年月日\/\s]/g, '-').replace(/-+/g, '-').replace(/-$/, '');
  
  const patterns = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    /^(\d{4})(\d{2})(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return value;
}

function logImport(result: ImportResult): void {
  const id = uuidv4();
  const now = new Date().toISOString();

  execute(`
    CREATE TABLE IF NOT EXISTS import_logs (
      id TEXT PRIMARY KEY,
      imported_at TEXT NOT NULL,
      total INTEGER,
      success INTEGER,
      failed INTEGER,
      errors TEXT
    )
  `);

  execute(`
    INSERT INTO import_logs (id, imported_at, total, success, failed, errors)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, now, result.total, result.success, result.failed, JSON.stringify(result.errors)]);
}

export function getImportLogs(): any[] {
  try {
    return queryAll('SELECT * FROM import_logs ORDER BY imported_at DESC LIMIT 10');
  } catch {
    return [];
  }
}
