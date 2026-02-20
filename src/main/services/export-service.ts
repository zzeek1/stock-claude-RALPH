import { dialog, BrowserWindow } from 'electron';
import { listTrades } from './trade-service';
import { Trade, TradeFilter } from '../../shared/types';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getStatsOverview, getMonthlyStats, getStrategyStats, getEmotionStats, getPlanExecutionStats } from './stats-service';
import { getAllSettings } from './settings-service';

// PDF Report generation using Electron's printToPDF
export async function exportPdfReport(
  reportType: 'summary' | 'trades' | 'monthly' | 'custom',
  startDate?: string,
  endDate?: string,
  win?: BrowserWindow
): Promise<string> {
  const settings = getAllSettings();
  const dateRange = startDate && endDate ? `${startDate} ~ ${endDate}` : '全部时间';

  // Get data based on report type
  const overview = getStatsOverview(startDate, endDate);
  const monthly = getMonthlyStats(startDate, endDate);
  const strategies = getStrategyStats(startDate, endDate);
  const emotions = getEmotionStats(startDate, endDate);
  const planStats = getPlanExecutionStats(startDate, endDate);

  // Generate HTML content for the report
  const htmlContent = generateReportHtml(reportType, {
    overview,
    monthly,
    strategies,
    emotions,
    planStats,
    dateRange,
    initialCapital: settings.initial_capital,
  });

  // Create a temporary HTML file
  const tempHtmlPath = path.join(app.getPath('temp'), `report-${Date.now()}.html`);
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

  // If no window provided, create a hidden one
  let pdfWindow: BrowserWindow | undefined = win;
  if (!pdfWindow) {
    pdfWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
  }

  try {
    await pdfWindow.loadFile(tempHtmlPath);

    const defaultPath = path.join(
      app.getPath('documents'),
      `stock-report-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`
    );

    const result = await dialog.showSaveDialog({
      title: '导出PDF报告',
      defaultPath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      throw new Error('用户取消');
    }

    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        marginType: 'custom',
        top: 0.5,
        bottom: 0.5,
        left: 0.5,
        right: 0.5,
      },
    });

    fs.writeFileSync(result.filePath, pdfData);

    // Clean up temp HTML
    fs.unlinkSync(tempHtmlPath);

    return result.filePath;
  } finally {
    // Only close the window if we created it
    if (!win && pdfWindow) {
      pdfWindow.close();
    }
  }
}

interface ReportData {
  overview: any;
  monthly: any[];
  strategies: any[];
  emotions: any[];
  planStats: any;
  dateRange: string;
  initialCapital: number;
}

function generateReportHtml(reportType: string, data: ReportData): string {
  const { overview, monthly, strategies, emotions, planStats, dateRange, initialCapital } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      padding: 20px;
      color: #333;
      font-size: 12px;
    }
    h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 5px; }
    h2 { font-size: 18px; color: #333; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
    h3 { font-size: 14px; color: #666; margin-top: 15px; }
    .header { margin-bottom: 20px; }
    .date-range { color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: 600; }
    .positive { color: #52c41a; }
    .negative { color: #ff4d4f; }
    .summary-grid { display: flex; flex-wrap: wrap; gap: 15px; margin: 15px 0; }
    .summary-item { flex: 1; min-width: 120px; padding: 10px; background: #fafafa; border-radius: 4px; }
    .summary-label { font-size: 11px; color: #666; }
    .summary-value { font-size: 18px; font-weight: 600; color: #1a1a1a; }
    .positive-bg { background: #f6ffed; }
    .negative-bg { background: #fff2f0; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; color: #999; font-size: 10px; }
    .chart-placeholder { height: 150px; background: #f9f9f9; border: 1px dashed #ddd; display: flex; align-items: center; justify-content: center; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 股票交易报告</h1>
    <p class="date-range">报告期间：${dateRange}</p>
    <p class="date-range">生成时间：${new Date().toLocaleString('zh-CN')}</p>
  </div>

  <h2>📈 核心指标</h2>
  <div class="summary-grid">
    <div class="summary-item ${overview.total_pnl >= 0 ? 'positive-bg' : 'negative-bg'}">
      <div class="summary-label">总盈亏</div>
      <div class="summary-value ${overview.total_pnl >= 0 ? 'positive' : 'negative'}">
        ${overview.total_pnl >= 0 ? '+' : ''}${overview.total_pnl.toFixed(2)} 元
      </div>
    </div>
    <div class="summary-item">
      <div class="summary-label">总收益率</div>
      <div class="summary-value ${overview.total_return >= 0 ? 'positive' : 'negative'}">
        ${(overview.total_return * 100).toFixed(2)}%
      </div>
    </div>
    <div class="summary-item">
      <div class="summary-label">胜率</div>
      <div class="summary-value">
        ${(overview.win_rate * 100).toFixed(1)}%
      </div>
    </div>
    <div class="summary-item">
      <div class="summary-label">交易次数</div>
      <div class="summary-value">${overview.total_trades}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-item">
      <div class="summary-label">盈利次数</div>
      <div class="summary-value positive">${overview.winning_trades}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">亏损次数</div>
      <div class="summary-value negative">${overview.losing_trades}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">盈亏比</div>
      <div class="summary-value">${overview.profit_loss_ratio.toFixed(2)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">期望收益</div>
      <div class="summary-value ${overview.expectancy >= 0 ? 'positive' : 'negative'}">
        ${overview.expectancy.toFixed(2)} 元/笔
      </div>
    </div>
  </div>

  <h2>📅 月度收益</h2>
  <table>
    <thead>
      <tr>
        <th>月份</th>
        <th>交易次数</th>
        <th>盈亏(元)</th>
        <th>胜率</th>
      </tr>
    </thead>
    <tbody>
      ${monthly.slice(0, 12).map(m => `
        <tr>
          <td>${m.month}</td>
          <td>${m.trade_count}</td>
          <td class="${m.pnl >= 0 ? 'positive' : 'negative'}">${m.pnl >= 0 ? '+' : ''}${m.pnl.toFixed(2)}</td>
          <td>${(m.win_rate * 100).toFixed(1)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>📋 策略分析</h2>
  ${strategies.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>策略</th>
        <th>交易次数</th>
        <th>总盈亏(元)</th>
        <th>胜率</th>
        <th>平均盈亏(元)</th>
      </tr>
    </thead>
    <tbody>
      ${strategies.map(s => `
        <tr>
          <td>${s.strategy || '未分类'}</td>
          <td>${s.trade_count}</td>
          <td class="${s.total_pnl >= 0 ? 'positive' : 'negative'}">${s.total_pnl >= 0 ? '+' : ''}${s.total_pnl.toFixed(2)}</td>
          <td>${(s.win_rate * 100).toFixed(1)}%</td>
          <td>${s.avg_pnl.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<p>暂无策略数据</p>'}

  <h2>😊 情绪分析</h2>
  ${emotions.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>情绪</th>
        <th>交易次数</th>
        <th>胜率</th>
        <th>平均盈亏(元)</th>
      </tr>
    </thead>
    <tbody>
      ${emotions.map(e => `
        <tr>
          <td>${e.emotion || '未记录'}</td>
          <td>${e.trade_count}</td>
          <td>${(e.win_rate * 100).toFixed(1)}%</td>
          <td class="${e.avg_pnl >= 0 ? 'positive' : 'negative'}">${e.avg_pnl.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<p>暂无情绪数据</p>'}

  ${planStats && planStats.total_with_plan > 0 ? `
  <h2>📝 计划执行</h2>
  <table>
    <thead>
      <tr>
        <th>指标</th>
        <th>数值</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>有计划的交易</td>
        <td>${planStats.total_with_plan}</td>
      </tr>
      <tr>
        <td>完全执行</td>
        <td>${planStats.executed_count}</td>
      </tr>
      <tr>
        <td>部分执行</td>
        <td>${planStats.partial_count}</td>
      </tr>
      <tr>
        <td>完全错过</td>
        <td>${planStats.missed_count}</td>
      </tr>
      <tr>
        <td>执行率</td>
        <td>${(planStats.execution_rate * 100).toFixed(1)}%</td>
      </tr>
    </tbody>
  </table>
  ` : ''}

  <div class="footer">
    <p>本报告由 Stock Claude 自动生成</p>
    <p>初始资金：${initialCapital.toLocaleString()} 元</p>
  </div>
</body>
</html>
  `;
}

export async function exportTradesToCsv(filter: TradeFilter): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: '导出交易记录',
    defaultPath: `交易记录_${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });

  if (result.canceled || !result.filePath) return null;

  const { trades } = listTrades({ ...filter, page: 1, pageSize: 100000 });
  const csv = tradesToCsv(trades);

  // Write with BOM for Excel compatibility
  const bom = '\uFEFF';
  fs.writeFileSync(result.filePath, bom + csv, 'utf-8');

  return result.filePath;
}

function tradesToCsv(trades: Trade[]): string {
  const headers = [
    '日期', '时间', '股票代码', '股票名称', '市场', '方向',
    '价格', '数量', '金额', '手续费', '印花税', '实际成本',
    '已实现盈亏', '盈亏比例', '持仓天数',
    '策略', '交易理由', '离场计划', '止损价', '止盈价',
    '交易前情绪', '交易后情绪', '信心', '是否冲动',
    '教训', '大盘趋势', '板块趋势', '标签',
  ];

  const rows = trades.map(t => [
    t.trade_date,
    t.trade_time || '',
    t.stock_code,
    t.stock_name,
    t.market,
    t.direction === 'BUY' ? '买入' : '卖出',
    t.price,
    t.quantity,
    t.amount,
    t.commission,
    t.stamp_tax,
    t.total_cost,
    t.realized_pnl ?? '',
    t.pnl_ratio ? `${(t.pnl_ratio * 100).toFixed(2)}%` : '',
    t.holding_days ?? '',
    t.strategy || '',
    escapeCsv(t.entry_reason || ''),
    escapeCsv(t.exit_plan || ''),
    t.stop_loss ?? '',
    t.take_profit ?? '',
    t.emotion_before || '',
    t.emotion_after || '',
    t.confidence ?? '',
    t.is_impulsive ? '是' : '否',
    escapeCsv(t.lesson || ''),
    t.market_trend || '',
    t.sector_trend || '',
    (t.tags || []).join(';'),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
