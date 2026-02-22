import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Row, Col, Statistic, Spin, Tabs, DatePicker, Select, Alert, Table, Progress, Button, message, Dropdown, Space } from 'antd';
import type { CanonicalKpis, RiskAssessment, Trade } from '../../shared/types';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  TrophyOutlined,
  SwapOutlined,
  BarChartOutlined,
  LineChartOutlined,
  FallOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  FireOutlined,
  DollarOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import { useCurrencyStore } from '../stores';
import { convertAmount, currencySymbol, marketCurrency } from '../utils/currency';
import type { FxRates } from '../utils/currency';
import { toDisplayCanonicalKpis } from '../utils/canonical-kpis';

const { RangePicker } = DatePicker;

interface StatsOverview {
  total_pnl: number;
  total_return: number;
  win_rate: number;
  profit_loss_ratio: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  max_drawdown: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  avg_holding_days: number;
  impulsive_trade_count: number;
  impulsive_trade_win_rate: number;
  stop_loss_execution_rate: number;
  expectancy: number;
  avg_win: number;
  avg_loss: number;
}

interface PnlDataPoint {
  date: string;
  cumulative_pnl: number;
  daily_pnl: number;
}

interface StrategyStats {
  strategy: string;
  total_pnl: number;
  win_rate: number;
  trade_count: number;
  avg_pnl: number;
}

interface EmotionWinRate {
  emotion: string;
  win_rate: number;
  trade_count: number;
  avg_pnl: number;
}

interface EmotionHeatmapData {
  emotion: string;
  period: string;
  win_rate: number;
  trade_count: number;
  avg_pnl: number;
}

interface MonthlyStats {
  month: string;
  pnl: number;
  trade_count: number;
  win_rate: number;
}

interface DrawdownData {
  date: string;
  drawdown: number;
  peak: number;
  value: number;
}

interface CalendarHeatmapData {
  date: string;
  pnl: number;
  trade_count: number;
}

interface PnlDistribution {
  range: string;
  count: number;
  rangeStart: number;
  rangeEnd: number;
}

interface StrategyTrendData {
  strategy: string;
  period: string;
  total_pnl: number;
  win_rate: number;
  trade_count: number;
  avg_pnl: number;
  winning_trades: number;
  losing_trades: number;
}

interface StrategyWinRateTrend {
  strategy: string;
  period: string;
  win_rate: number;
  trade_count: number;
}

interface PlanExecutionStats {
  total_with_plan: number;
  executed_count: number;
  partial_count: number;
  missed_count: number;
  execution_rate: number;
  executed_avg_pnl: number;
  partial_avg_pnl: number;
  missed_avg_pnl: number;
}

interface AssetCurveData {
  date: string;
  total_assets: number;
  cash: number;
  market_value: number;
  daily_pnl: number;
  daily_return: number;
  cumulative_return: number;
}

interface PositionBrief {
  market: string;
  floating_pnl: number;
  current_value?: number;
}

interface CalendarHeatmapProps {
  data: CalendarHeatmapData[];
  year: number;
  moneySymbol?: string;
}

type TrendPivotRow = Record<string, number | string>;

export function buildStrategyTrendPivot(data: StrategyTrendData[]): { rows: TrendPivotRow[]; strategies: string[] } {
  const periods = Array.from(new Set(data.map((d) => d.period))).sort();
  const strategies = Array.from(new Set(data.map((d) => d.strategy)));
  const rows = periods.map((period) => ({ period } as TrendPivotRow));
  const rowMap = new Map(rows.map((row) => [row.period as string, row]));

  for (const point of data) {
    const row = rowMap.get(point.period);
    if (row) {
      row[point.strategy] = point.total_pnl;
    }
  }

  return { rows, strategies };
}

export function buildStrategyWinRatePivot(data: StrategyWinRateTrend[]): { rows: TrendPivotRow[]; strategies: string[] } {
  const periods = Array.from(new Set(data.map((d) => d.period))).sort();
  const strategies = Array.from(new Set(data.map((d) => d.strategy)));
  const rows = periods.map((period) => ({ period } as TrendPivotRow));
  const rowMap = new Map(rows.map((row) => [row.period as string, row]));

  for (const point of data) {
    const row = rowMap.get(point.period);
    if (row) {
      row[point.strategy] = point.win_rate;
    }
  }

  return { rows, strategies };
}

export function normalizeAssetCurveData(
  assetCurveData: AssetCurveData[],
  targetStartAssets: number,
  targetEndAssets: number,
): AssetCurveData[] {
  if (!assetCurveData.length) return [];

  const rawStart = Number(assetCurveData[0].total_assets || 0);
  const rawEnd = Number(assetCurveData[assetCurveData.length - 1].total_assets || 0);
  const totalSteps = Math.max(1, assetCurveData.length - 1);
  const startOffset = targetStartAssets - rawStart;
  const endOffset = targetEndAssets - rawEnd;

  let previousAdjustedAssets = 0;
  return assetCurveData.map((row, index) => {
    const progress = assetCurveData.length === 1 ? 1 : index / totalSteps;
    const offset = startOffset + (endOffset - startOffset) * progress;
    const adjustedTotalAssets = Number(row.total_assets || 0) + offset;
    const adjustedDailyPnl = index === 0 ? 0 : adjustedTotalAssets - previousAdjustedAssets;
    const adjustedDailyReturn =
      index === 0 || previousAdjustedAssets === 0 ? 0 : adjustedDailyPnl / previousAdjustedAssets;
    const adjustedCumulativeReturn =
      targetStartAssets > 0 ? (adjustedTotalAssets - targetStartAssets) / targetStartAssets : 0;

    previousAdjustedAssets = adjustedTotalAssets;
    return {
      ...row,
      total_assets: adjustedTotalAssets,
      daily_pnl: adjustedDailyPnl,
      daily_return: adjustedDailyReturn,
      cumulative_return: adjustedCumulativeReturn,
    };
  });
}

export function buildAssetCurveDisplayData(assetCurveData: AssetCurveData[]): AssetCurveData[] {
  if (!assetCurveData.length) {
    return [];
  }

  const alignedRows = assetCurveData.map((row) => {
    const rawTotalAssets = Number(row.total_assets || 0);
    const parsedCash = Number(row.cash);
    const parsedMarketValue = Number(row.market_value);
    const hasParts = Number.isFinite(parsedCash) && Number.isFinite(parsedMarketValue);

    const cash = Number.isFinite(parsedCash) ? parsedCash : 0;
    const marketValue = Number.isFinite(parsedMarketValue) ? parsedMarketValue : 0;
    const totalAssetsFromParts = hasParts ? cash + marketValue : rawTotalAssets;
    const totalAssets = Number.isFinite(totalAssetsFromParts) ? totalAssetsFromParts : rawTotalAssets;

    return {
      ...row,
      total_assets: Number.isFinite(totalAssets) ? totalAssets : 0,
      cash,
      market_value: marketValue,
    };
  });

  const baseAssets = Number(alignedRows[0].total_assets || 0);
  let previousAssets = baseAssets;
  return alignedRows.map((row, index) => {
    const totalAssets = Number(row.total_assets || 0);
    const dailyPnl = index === 0 ? 0 : totalAssets - previousAssets;
    const dailyReturn = index === 0 || previousAssets === 0 ? 0 : dailyPnl / previousAssets;
    const cumulativeReturn = baseAssets > 0 ? (totalAssets - baseAssets) / baseAssets : 0;

    previousAssets = totalAssets;
    return {
      ...row,
      daily_pnl: dailyPnl,
      daily_return: dailyReturn,
      cumulative_return: cumulativeReturn,
    };
  });
}

export function alignLatestAssetCurveWithLiveMarketValue(
  assetCurveData: AssetCurveData[],
  liveMarketValue: number,
  shouldAlign: boolean,
): AssetCurveData[] {
  if (!shouldAlign || assetCurveData.length === 0 || !Number.isFinite(liveMarketValue)) {
    return assetCurveData;
  }

  const lastIndex = assetCurveData.length - 1;
  const lastRow = assetCurveData[lastIndex];
  const cash = Number(lastRow.cash || 0);
  const nextTotalAssets = Number.isFinite(cash)
    ? cash + liveMarketValue
    : Number(lastRow.total_assets || 0);

  const nextRows = [...assetCurveData];
  nextRows[lastIndex] = {
    ...lastRow,
    market_value: liveMarketValue,
    total_assets: Number.isFinite(nextTotalAssets) ? nextTotalAssets : 0,
  };
  return nextRows;
}

function buildDrawdownFromAssetCurve(assetCurveData: AssetCurveData[]): DrawdownData[] {
  if (!assetCurveData.length) {
    return [];
  }

  let peak = 0;
  return assetCurveData.map((point) => {
    const value = Number(point.total_assets || 0);
    peak = Math.max(peak, value);
    const drawdown = peak > 0 ? (peak - value) / peak : 0;
    return {
      date: point.date,
      drawdown,
      peak,
      value,
    };
  });
}

function alignDrawdownSeriesToCanonicalMax(
  series: DrawdownData[],
  canonicalMaxDrawdown?: number,
): DrawdownData[] {
  if (!series.length) {
    return [];
  }

  const targetMax = Number(canonicalMaxDrawdown);
  if (!Number.isFinite(targetMax) || targetMax < 0) {
    return series;
  }

  const currentMax = series.reduce((max, point) => Math.max(max, Number(point.drawdown || 0)), 0);
  if (currentMax > 0) {
    const scale = targetMax / currentMax;
    return series.map((point) => ({
      ...point,
      drawdown: Number(point.drawdown || 0) * scale,
    }));
  }

  if (targetMax === 0) {
    return series;
  }

  const last = series[series.length - 1];
  return [
    ...series.slice(0, -1),
    {
      ...last,
      drawdown: targetMax,
    },
  ];
}

export function buildDisplayDrawdownData(
  normalizedAssetCurve: AssetCurveData[],
  fallbackDrawdownData: DrawdownData[],
  canonicalMaxDrawdown?: number,
): DrawdownData[] {
  const baseSeries = fallbackDrawdownData.length > 0
    ? fallbackDrawdownData.map((point) => ({ ...point, drawdown: Math.abs(Number(point.drawdown || 0)) }))
    : buildDrawdownFromAssetCurve(normalizedAssetCurve);

  return alignDrawdownSeriesToCanonicalMax(baseSeries, canonicalMaxDrawdown);
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchAllSellTrades(startDate?: string, endDate?: string): Promise<Trade[]> {
  const all: Trade[] = [];
  let page = 1;
  const pageSize = 500;
  let total = 0;

  while (page === 1 || all.length < total) {
    const result = await window.electronAPI.trade.list({
      direction: 'SELL',
      startDate,
      endDate,
      page,
      pageSize,
      sortField: 'trade_date',
      sortOrder: 'asc',
    });

    if (!result.success || !result.data) {
      break;
    }

    const chunk = result.data.trades || [];
    total = result.data.total || chunk.length;

    for (const trade of chunk) {
      const normalizedRealizedPnl = toFiniteNumber(trade.realized_pnl);
      if (normalizedRealizedPnl === null) {
        continue;
      }
      all.push({
        ...trade,
        realized_pnl: normalizedRealizedPnl,
      });
    }

    if (chunk.length === 0) {
      break;
    }
    page += 1;
  }

  return all;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ data, year, moneySymbol = '¥' }) => {
  const dataMap = useMemo(() => {
    const map = new Map<string, CalendarHeatmapData>();
    data.forEach(d => map.set(d.date, d));
    return map;
  }, [data]);

  const getColor = useCallback((count: number, pnl: number) => {
    if (count === 0) return '#f0f0f0';
    if (pnl > 0) {
      const intensity = Math.min(1, count / 5);
      return `rgba(82, 196, 26, ${0.2 + intensity * 0.8})`;
    } else if (pnl < 0) {
      const intensity = Math.min(1, count / 5);
      return `rgba(255, 77, 79, ${0.2 + intensity * 0.8})`;
    }
    return '#faad14';
  }, []);

  const months = useMemo(() => {
    const result: { month: number; weeks: { date: string; day: number }[][] }[] = [];
    for (let month = 0; month < 12; month++) {
      const startOfMonth = dayjs().year(year).month(month).startOf('month');
      const endOfMonth = startOfMonth.endOf('month');
      const startDay = startOfMonth.day();
      const daysInMonth = endOfMonth.date();
      
      const weeks: { date: string; day: number }[][] = [];
      let currentWeek: { date: string; day: number }[] = [];
      
      for (let i = 0; i < startDay; i++) {
        currentWeek.push({ date: '', day: 0 });
      }
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        currentWeek.push({ date: dateStr, day });
        
        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
      
      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push({ date: '', day: 0 });
        }
        weeks.push(currentWeek);
      }
      
      result.push({ month, weeks });
    }
    
    return result;
  }, [year]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 4, minWidth: 900 }}>
        {months.map(({ month, weeks }) => (
          <div key={month} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10, textAlign: 'center', marginBottom: 4 }}>
              {month + 1}月
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', gap: 2 }}>
                {week.map((d, di) => {
                  const dayData = d.date ? dataMap.get(d.date) : null;
                  return (
                    <div
                      key={di}
                      title={d.date && dayData ? `${d.date}: ${dayData.trade_count}笔, ${dayData.pnl > 0 ? '+' : ''}${dayData.pnl.toFixed(2)}${moneySymbol}` : ''}
                      style={{
                        width: 14,
                        height: 14,
                        backgroundColor: d.date ? getColor(dayData?.trade_count || 0, dayData?.pnl || 0) : 'transparent',
                        borderRadius: 2,
                        cursor: d.date ? 'pointer' : 'default',
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 16, justifyContent: 'center', fontSize: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, backgroundColor: '#f0f0f0', borderRadius: 2 }}></span>
          无交易
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, backgroundColor: 'rgba(82, 196, 26, 0.8)', borderRadius: 2 }}></span>
          盈利
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, backgroundColor: 'rgba(255, 77, 79, 0.8)', borderRadius: 2 }}></span>
          亏损
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, backgroundColor: '#faad14', borderRadius: 2 }}></span>
          持平
        </span>
      </div>
    </div>
  );
};

// 渲染情绪热力图
const renderEmotionHeatmap = (data: EmotionHeatmapData[]) => {
  // Get unique emotions and periods
  const emotions = Array.from(new Set(data.map(d => d.emotion)));
  const periods = Array.from(new Set(data.map(d => d.period))).sort();

  if (emotions.length === 0 || periods.length === 0) {
    return <div>暂无数据</div>;
  }

  // Create a map for quick data lookup
  const dataMap = new Map<string, EmotionHeatmapData>();
  data.forEach(d => {
    dataMap.set(`${d.emotion}-${d.period}`, d);
  });

  // Get color based on win rate
  const getColor = (winRate: number): string => {
    if (winRate >= 0.8) return '#52c41a'; // High win rate - green
    if (winRate >= 0.6) return '#73d13d'; // Good win rate - light green
    if (winRate >= 0.4) return '#faad14'; // Medium win rate - yellow
    if (winRate >= 0.2) return '#ffbb33'; // Low win rate - orange
    return '#ff4d4f'; // Very low win rate - red
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #f0f0f0', background: '#fafafa' }}>
              情绪 / 月份
            </th>
            {periods.map(period => (
              <th key={period} style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #f0f0f0', background: '#fafafa', minWidth: 60 }}>
                {period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {emotions.map(emotion => (
            <tr key={emotion}>
              <td style={{ padding: '8px 12px', border: '1px solid #f0f0f0', fontWeight: 500, background: '#fafafa' }}>
                {emotion}
              </td>
              {periods.map(period => {
                const cellData = dataMap.get(`${emotion}-${period}`);
                const winRate = cellData?.win_rate ?? 0;
                const tradeCount = cellData?.trade_count ?? 0;
                const hasData = tradeCount > 0;

                return (
                  <td
                    key={`${emotion}-${period}`}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      border: '1px solid #f0f0f0',
                      backgroundColor: hasData ? getColor(winRate) : '#f5f5f5',
                      color: hasData && winRate >= 0.4 ? '#fff' : '#000',
                      cursor: hasData ? 'pointer' : 'default',
                      minWidth: 60,
                    }}
                    title={hasData ? `${emotion} - ${period}: 胜率 ${(winRate * 100).toFixed(1)}%, 交易次数 ${tradeCount}` : '无数据'}
                  >
                    {hasData ? (
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{(winRate * 100).toFixed(0)}%</div>
                        <div style={{ fontSize: 10, opacity: 0.8 }}>{tradeCount}笔</div>
                      </div>
                    ) : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Statistics: React.FC = () => {
  const { displayCurrency } = useCurrencyStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [calendarYear, setCalendarYear] = useState<number>(dayjs().year());
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [pnlCurve, setPnlCurve] = useState<PnlDataPoint[]>([]);
  const [pnlDistribution, setPnlDistribution] = useState<PnlDistribution[]>([]);
  const [strategyStats, setStrategyStats] = useState<StrategyStats[]>([]);
  const [emotionStats, setEmotionStats] = useState<EmotionWinRate[]>([]);
  const [emotionHeatmapData, setEmotionHeatmapData] = useState<EmotionHeatmapData[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [drawdownData, setDrawdownData] = useState<DrawdownData[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarHeatmapData[]>([]);
  const [planStats, setPlanStats] = useState<PlanExecutionStats | null>(null);
  const [assetCurve, setAssetCurve] = useState<AssetCurveData[]>([]);
  const [positions, setPositions] = useState<PositionBrief[]>([]);
  const [sellTrades, setSellTrades] = useState<Trade[]>([]);
  const [fxRates, setFxRates] = useState<FxRates | undefined>(undefined);
  const [initialCapital, setInitialCapital] = useState(0);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [canonicalKpis, setCanonicalKpis] = useState<CanonicalKpis | null>(null);
  const [canonicalKpiFallbackReason, setCanonicalKpiFallbackReason] = useState<string | null>(null);
  const [strategyTrendData, setStrategyTrendData] = useState<StrategyTrendData[]>([]);
  const [strategyWinRateTrend, setStrategyWinRateTrend] = useState<StrategyWinRateTrend[]>([]);

  useEffect(() => {
    const fetchFxRates = async () => {
      try {
        const result = await window.electronAPI.quote.getFxRates();
        if (result.success && result.data) {
          setFxRates(result.data);
        }
      } catch {
        // keep previous rates
      }
    };

    fetchFxRates();
    const timer = setInterval(fetchFxRates, 60_000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async (startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      const [
        overviewRes,
        pnlRes,
        distributionRes,
        strategyRes,
        emotionRes,
        monthlyRes,
        drawdownRes,
        calendarRes,
        planRes,
        assetCurveRes,
        positionsRes,
        riskRes,
        strategyTrendRes,
        strategyWinRateTrendRes,
        emotionHeatmapRes,
        canonicalKpisRes,
        settingsRes,
        allSells,
      ] = await Promise.all([
        window.electronAPI.stats.overview(startDate, endDate),
        window.electronAPI.stats.pnlCurve(startDate, endDate),
        window.electronAPI.stats.pnlDistribution(startDate, endDate),
        window.electronAPI.stats.strategy(startDate, endDate),
        window.electronAPI.stats.emotion(startDate, endDate),
        window.electronAPI.stats.monthly(startDate, endDate),
        window.electronAPI.stats.drawdown(startDate, endDate),
        window.electronAPI.stats.calendar(calendarYear),
        window.electronAPI.stats.planExecution(startDate, endDate),
        window.electronAPI.stats.assetCurve(startDate, endDate),
        window.electronAPI.position.list(),
        window.electronAPI.stats.riskAssessment(),
        window.electronAPI.stats.strategyTrend(startDate, endDate),
        window.electronAPI.stats.strategyWinRateTrend(startDate, endDate),
        window.electronAPI.stats.emotionHeatmap(startDate, endDate),
        window.electronAPI.stats.canonicalKpis(startDate, endDate),
        window.electronAPI.settings.get(),
        fetchAllSellTrades(startDate, endDate),
      ]);

      if (overviewRes.success) setOverview(overviewRes.data ?? null);
      if (pnlRes.success) setPnlCurve(pnlRes.data ?? []);
      if (distributionRes.success) setPnlDistribution(distributionRes.data ?? []);
      if (strategyRes.success) setStrategyStats(strategyRes.data ?? []);
      if (emotionRes.success) setEmotionStats(emotionRes.data ?? []);
      if (monthlyRes.success) setMonthlyStats(monthlyRes.data ?? []);
      if (drawdownRes.success) setDrawdownData(drawdownRes.data ?? []);
      if (calendarRes.success) setCalendarData(calendarRes.data ?? []);
      if (planRes.success) setPlanStats(planRes.data ?? null);
      if (assetCurveRes.success) setAssetCurve(assetCurveRes.data ?? []);
      if (positionsRes.success) setPositions((positionsRes.data ?? []) as PositionBrief[]);
      if (riskRes.success) setRiskAssessment(riskRes.data ?? null);
      if (strategyTrendRes.success) setStrategyTrendData(strategyTrendRes.data ?? []);
      if (strategyWinRateTrendRes.success) setStrategyWinRateTrend(strategyWinRateTrendRes.data ?? []);
      if (emotionHeatmapRes.success) setEmotionHeatmapData(emotionHeatmapRes.data ?? []);
      if (canonicalKpisRes.success && canonicalKpisRes.data) {
        setCanonicalKpis(canonicalKpisRes.data as CanonicalKpis);
        setCanonicalKpiFallbackReason(null);
      } else {
        setCanonicalKpis(null);
        setCanonicalKpiFallbackReason(canonicalKpisRes.error ?? 'canonical-kpi-unavailable');
      }
      if (settingsRes.success && settingsRes.data) {
        setInitialCapital(Number(settingsRes.data.initial_capital || 0));
      }
      setSellTrades(allSells);
    } catch (error) {
      console.error('Failed to fetch statistics data:', error);
      setCanonicalKpiFallbackReason(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [calendarYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      const start = dates[0].format('YYYY-MM-DD');
      const end = dates[1].format('YYYY-MM-DD');
      setDateRange([dates[0], dates[1]]);
      fetchData(start, end);
    } else {
      setDateRange(null);
      fetchData();
    }
  };

  // PDF 导出
  const handleExportPdf = async (reportType: 'summary' | 'monthly') => {
    try {
      const startDate = dateRange?.[0]?.format('YYYY-MM-DD');
      const endDate = dateRange?.[1]?.format('YYYY-MM-DD');
      const result = await window.electronAPI.trade.exportPdfReport(reportType, startDate, endDate);
      if (result.success) {
        message.success('PDF 报告已导出到: ' + result.data);
      } else if (result.error !== '用户取消') {
        message.error(result.error || '导出失败');
      }
    } catch (err) {
      message.error('导出失败');
    }
  };

  const exportMenuItems = {
    items: [
      { key: 'summary', label: '综合报告', onClick: () => handleExportPdf('summary') },
      { key: 'monthly', label: '月度报告', onClick: () => handleExportPdf('monthly') },
    ],
  };

  const displaySymbol = currencySymbol(displayCurrency);
  const canonicalKpisDisplay = useMemo(() => {
    return toDisplayCanonicalKpis(canonicalKpis, displayCurrency, fxRates);
  }, [canonicalKpis, displayCurrency, fxRates]);

  const convertedTradeMetrics = useMemo(() => {
    if (sellTrades.length === 0) {
      return null;
    }

    let realizedPnl = 0;
    let realizedCostBasis = 0;
    let winCount = 0;
    let lossCount = 0;
    let flatCount = 0;
    let winPnlSum = 0;
    let lossPnlSum = 0;

    for (const trade of sellTrades) {
      const fromCurrency = marketCurrency(trade.market);
      const rawPnl = toFiniteNumber(trade.realized_pnl) ?? 0;
      const convertedPnl = convertAmount(rawPnl, fromCurrency, displayCurrency, fxRates);
      realizedPnl += convertedPnl;

      const totalCost = toFiniteNumber(trade.total_cost);
      const amount = toFiniteNumber(trade.amount);
      const commission = toFiniteNumber(trade.commission) ?? 0;
      const stampTax = toFiniteNumber(trade.stamp_tax) ?? 0;
      const sellRevenue = totalCost ?? (amount !== null ? amount - commission - stampTax : null);
      if (sellRevenue !== null) {
        const buyCost = sellRevenue - rawPnl;
        if (buyCost > 0) {
          realizedCostBasis += convertAmount(buyCost, fromCurrency, displayCurrency, fxRates);
        }
      }

      if (convertedPnl > 0) {
        winCount += 1;
        winPnlSum += convertedPnl;
      } else if (convertedPnl < 0) {
        lossCount += 1;
        lossPnlSum += convertedPnl;
      } else {
        flatCount += 1;
      }
    }

    const totalTrades = winCount + lossCount + flatCount;
    const winRate = totalTrades > 0 ? winCount / totalTrades : 0;
    const avgWin = winCount > 0 ? winPnlSum / winCount : 0;
    const avgLoss = lossCount > 0 ? lossPnlSum / lossCount : 0;
    const profitLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
    const expectancy = winRate * avgWin + (1 - winRate) * avgLoss;
    const realizedReturn = realizedCostBasis > 0 ? realizedPnl / realizedCostBasis : 0;

    return {
      realizedPnl,
      realizedCostBasis,
      realizedReturn,
      totalTrades,
      winRate,
      avgWin,
      avgLoss,
      profitLossRatio,
      expectancy,
    };
  }, [sellTrades, displayCurrency, fxRates]);

  const floatingPnlDisplay = useMemo(() => {
    return positions.reduce((sum, p) => {
      const converted = convertAmount(
        Number(p.floating_pnl || 0),
        marketCurrency(p.market),
        displayCurrency,
        fxRates,
      );
      return sum + converted;
    }, 0);
  }, [positions, displayCurrency, fxRates]);

  const liveMarketValueDisplay = useMemo(() => {
    return positions.reduce((sum, p) => {
      const converted = convertAmount(
        Number(p.current_value || 0),
        marketCurrency(p.market),
        displayCurrency,
        fxRates,
      );
      return sum + converted;
    }, 0);
  }, [positions, displayCurrency, fxRates]);

  const shouldAlignLatestAssetPointWithLiveValue = useMemo(() => {
    if (!dateRange) {
      return true;
    }
    return dateRange[1].format('YYYY-MM-DD') >= dayjs().format('YYYY-MM-DD');
  }, [dateRange]);

  const hasLiveMarketValueData = useMemo(() => {
    return positions.some((p) => Number.isFinite(Number(p.current_value)));
  }, [positions]);

  const convertedAssetCurve = useMemo<AssetCurveData[]>(() => {
    if (!assetCurve.length) return [];

    let lastValidTotalAssets = 0;
    const convertedRows = assetCurve.map((row) => {
      const convertedTotalAssets = convertAmount(Number(row.total_assets || 0), 'CNY', displayCurrency, fxRates);
      const convertedCash = convertAmount(Number(row.cash || 0), 'CNY', displayCurrency, fxRates);
      const convertedMarketValue = convertAmount(Number(row.market_value || 0), 'CNY', displayCurrency, fxRates);
      const convertedDailyPnl = convertAmount(Number(row.daily_pnl || 0), 'CNY', displayCurrency, fxRates);
      const partsTotalAssets = convertedCash + convertedMarketValue;

      let totalAssets = convertedTotalAssets;
      if (!(totalAssets > 0) && partsTotalAssets > 0) {
        totalAssets = partsTotalAssets;
      }
      if (!(totalAssets > 0) && lastValidTotalAssets > 0) {
        totalAssets = lastValidTotalAssets;
      }
      if (totalAssets > 0) {
        lastValidTotalAssets = totalAssets;
      }

      return {
        ...row,
        total_assets: totalAssets > 0 ? totalAssets : 0,
        cash: convertedCash,
        market_value: convertedMarketValue,
        daily_pnl: convertedDailyPnl,
      };
    });

    return alignLatestAssetCurveWithLiveMarketValue(
      convertedRows,
      liveMarketValueDisplay,
      shouldAlignLatestAssetPointWithLiveValue && hasLiveMarketValueData,
    );
  }, [
    assetCurve,
    displayCurrency,
    fxRates,
    liveMarketValueDisplay,
    shouldAlignLatestAssetPointWithLiveValue,
    hasLiveMarketValueData,
  ]);

  const convertedPnlCurve = useMemo<PnlDataPoint[]>(() => {
    if (convertedTradeMetrics && sellTrades.length > 0) {
      const byDate = new Map<string, number>();
      for (const trade of sellTrades) {
        const rawPnl = Number(trade.realized_pnl || 0);
        const converted = convertAmount(rawPnl, marketCurrency(trade.market), displayCurrency, fxRates);
        byDate.set(trade.trade_date, (byDate.get(trade.trade_date) || 0) + converted);
      }

      const rows = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      let cumulative = 0;
      return rows.map(([date, daily]) => {
        cumulative += daily;
        return {
          date,
          daily_pnl: daily,
          cumulative_pnl: cumulative,
        };
      });
    }

    return pnlCurve.map((row) => ({
      ...row,
      daily_pnl: convertAmount(Number(row.daily_pnl || 0), 'CNY', displayCurrency, fxRates),
      cumulative_pnl: convertAmount(Number(row.cumulative_pnl || 0), 'CNY', displayCurrency, fxRates),
    }));
  }, [convertedTradeMetrics, sellTrades, pnlCurve, displayCurrency, fxRates]);

  const baseCapital = convertAmount(Number(initialCapital || 0), 'CNY', displayCurrency, fxRates);

  const fallbackAssetCurve = useMemo<AssetCurveData[]>(() => {
    return convertedPnlCurve.map((row) => {
      const totalAssets = baseCapital + Number(row.cumulative_pnl || 0);
      return {
        date: row.date,
        total_assets: totalAssets,
        cash: 0,
        market_value: totalAssets,
        daily_pnl: Number(row.daily_pnl || 0),
        daily_return: baseCapital > 0 ? Number(row.daily_pnl || 0) / baseCapital : 0,
        cumulative_return: baseCapital > 0 ? Number(row.cumulative_pnl || 0) / baseCapital : 0,
      };
    });
  }, [convertedPnlCurve, baseCapital]);

  const displayAssetCurve = useMemo<AssetCurveData[]>(() => {
    return convertedAssetCurve.length > 0 ? convertedAssetCurve : fallbackAssetCurve;
  }, [convertedAssetCurve, fallbackAssetCurve]);

  const realizedPnl =
    canonicalKpisDisplay?.realized_pnl
    ?? convertedTradeMetrics?.realizedPnl
    ?? convertAmount(Number(overview?.total_pnl ?? 0), 'CNY', displayCurrency, fxRates);
  const unrealizedPnl = canonicalKpisDisplay?.unrealized_pnl ?? floatingPnlDisplay;
  const totalPnl = canonicalKpisDisplay?.total_pnl ?? (realizedPnl + unrealizedPnl);
  const totalTrades = canonicalKpisDisplay?.total_trades ?? (overview?.total_trades ?? 0);
  const winRate = canonicalKpisDisplay?.win_rate ?? (overview?.win_rate ?? 0);
  const profitLossRatio = canonicalKpisDisplay?.profit_loss_ratio ?? (overview?.profit_loss_ratio ?? 0);
  const avgHoldingDays = overview?.avg_holding_days ?? 0;
  const maxConsecutiveWins = overview?.max_consecutive_wins ?? 0;
  const maxConsecutiveLosses = overview?.max_consecutive_losses ?? 0;
  const expectancy =
    canonicalKpisDisplay?.expectancy
    ?? convertAmount(Number(overview?.expectancy ?? 0), 'CNY', displayCurrency, fxRates);
  const impulsiveTradeCount = overview?.impulsive_trade_count ?? 0;
  const stopLossRate = overview?.stop_loss_execution_rate ?? 0;

  const latestValidAssetPoint = [...displayAssetCurve].reverse().find((point) => Number(point.total_assets) > 0) ?? null;
  const computedTotalAssets = baseCapital + totalPnl;
  const totalAssets = latestValidAssetPoint
    ? latestValidAssetPoint.total_assets
    : computedTotalAssets > 0
      ? computedTotalAssets
      : baseCapital > 0
        ? baseCapital
        : 0;

  const baselineAssetsForReturn = totalAssets - totalPnl;
  const totalReturn = baselineAssetsForReturn > 0 ? totalPnl / baselineAssetsForReturn : 0;
  const headlinePnl = totalPnl;
  const headlineReturn = canonicalKpisDisplay?.total_return ?? totalReturn;

  const normalizedAssetCurve = useMemo<AssetCurveData[]>(() => {
    if (!displayAssetCurve.length) {
      return [];
    }
    return buildAssetCurveDisplayData(displayAssetCurve);
  }, [displayAssetCurve]);

  const canonicalMaxDrawdown = canonicalKpisDisplay?.max_drawdown;
  const displayDrawdownData = useMemo<DrawdownData[]>(() => {
    return buildDisplayDrawdownData(normalizedAssetCurve, drawdownData, canonicalMaxDrawdown);
  }, [normalizedAssetCurve, drawdownData, canonicalMaxDrawdown]);

  const maxDrawdown = canonicalKpisDisplay?.max_drawdown
    ?? (displayDrawdownData.length > 0
      ? displayDrawdownData.reduce((max, point) => Math.max(max, Number(point.drawdown || 0)), 0)
      : (overview?.max_drawdown ?? 0));

  const riskAssessmentDisplay = useMemo<RiskAssessment | null>(() => {
    if (!riskAssessment) {
      return null;
    }

    const convertFromCny = (value: number) => convertAmount(
      Number(value || 0),
      'CNY',
      displayCurrency,
      fxRates,
    );

    return {
      ...riskAssessment,
      exposure: {
        ...riskAssessment.exposure,
        total_market_value: convertFromCny(riskAssessment.exposure.total_market_value),
        market_exposure: riskAssessment.exposure.market_exposure.map((item) => ({
          ...item,
          value: convertFromCny(item.value),
        })),
        stock_exposure: riskAssessment.exposure.stock_exposure.map((item) => ({
          ...item,
          value: convertFromCny(item.value),
        })),
      },
      risk_reward: {
        ...riskAssessment.risk_reward,
        potential_upside: convertFromCny(riskAssessment.risk_reward.potential_upside),
        potential_downside: convertFromCny(riskAssessment.risk_reward.potential_downside),
      },
      max_potential_loss: {
        ...riskAssessment.max_potential_loss,
        if_all_stop_loss: convertFromCny(riskAssessment.max_potential_loss.if_all_stop_loss),
        largest_single_loss: convertFromCny(riskAssessment.max_potential_loss.largest_single_loss),
        loss_from_concentration: convertFromCny(riskAssessment.max_potential_loss.loss_from_concentration),
        cash_available: convertFromCny(riskAssessment.max_potential_loss.cash_available),
      },
    };
  }, [riskAssessment, displayCurrency, fxRates]);
  
  const planTotal = planStats?.total_with_plan ?? 0;
  const planExecuted = planStats?.executed_count ?? 0;
  const planPartial = planStats?.partial_count ?? 0;
  const planMissed = planStats?.missed_count ?? 0;
  const planExecutionRate = planStats?.execution_rate ?? 0;
  const planExecutedAvgPnl = planStats?.executed_avg_pnl ?? 0;
  const planMissedAvgPnl = planStats?.missed_avg_pnl ?? 0;

  const chartTabs = [
    {
      key: 'assetCurve',
      label: '资产曲线',
      children: normalizedAssetCurve.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={normalizedAssetCurve} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === '总资产' || name === '现金' || name === '市值') return [value.toFixed(0) + ` ${displaySymbol}`, name];
                if (name === '当日盈亏') return [value.toFixed(0) + ` ${displaySymbol}`, name];
                if (name === '累计收益率') return [(value * 100).toFixed(2) + '%', name];
                return [value, name];
              }}
              labelFormatter={(label: string) => `日期: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="total_assets"
              name="总资产"
              stroke="#1677ff"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="cash"
              name="现金"
              stroke="#52c41a"
              strokeWidth={1}
              dot={false}
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="market_value"
              name="市值"
              stroke="#faad14"
              strokeWidth={1}
              dot={false}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          暂无账户快照数据，请先在设置中保存账户快照或在持仓页面生成快照
        </div>
      ),
    },
    {
      key: 'pnlCurve',
      label: '收益曲线',
      children: (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={convertedPnlCurve} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              formatter={(value: number) => [value.toFixed(0) + ` ${displaySymbol}`, '']}
              labelFormatter={(label: string) => `日期: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="cumulative_pnl"
              name="累计盈亏"
              stroke="#1677ff"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="daily_pnl"
              name="当日盈亏"
              stroke="#8884d8"
              strokeWidth={1}
              dot={false}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: 'pnlDistribution',
      label: '盈亏分布',
      children: (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={pnlDistribution} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" fontSize={12} />
            <YAxis fontSize={12} allowDecimals={false} />
            <Tooltip
              formatter={(value: number) => [value, '次数']}
              labelFormatter={(label: string) => `区间: ${label}`}
            />
            <Legend />
            <Bar dataKey="count" name="交易次数" radius={[4, 4, 0, 0]}>
              {pnlDistribution.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.rangeStart >= 0 ? '#52c41a' : '#ff4d4f'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: 'strategy',
      label: '策略对比',
      children: (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={strategyStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="strategy" fontSize={12} />
            <YAxis yAxisId="left" fontSize={12} />
            <YAxis yAxisId="right" orientation="right" fontSize={12} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === '总盈亏' || name === '平均盈亏') return [value.toFixed(0) + ` ${displaySymbol}`, name];
                if (name === '胜率') return [(value * 100).toFixed(1) + '%', name];
                return [value, name];
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="total_pnl" name="总盈亏" radius={[4, 4, 0, 0]}>
              {strategyStats.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.total_pnl >= 0 ? '#52c41a' : '#ff4d4f'}
                />
              ))}
            </Bar>
            <Bar
              yAxisId="right"
              dataKey="trade_count"
              name="交易次数"
              fill="#8884d8"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: 'emotion',
      label: '情绪分析',
      children: (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={emotionStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="emotion" fontSize={12} />
            <YAxis yAxisId="left" fontSize={12} domain={[0, 1]} tickFormatter={(v: number) => (v * 100).toFixed(0) + '%'} />
            <YAxis yAxisId="right" orientation="right" fontSize={12} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === '胜率') return [(value * 100).toFixed(1) + '%', name];
                if (name === '平均盈亏') return [value.toFixed(0) + ` ${displaySymbol}`, name];
                return [value, name];
              }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="win_rate"
              name="胜率"
              fill="#1677ff"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="avg_pnl"
              name="平均盈亏"
              radius={[4, 4, 0, 0]}
            >
              {emotionStats.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.avg_pnl >= 0 ? '#52c41a' : '#ff4d4f'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: 'strategyTrend',
      label: '策略趋势',
      children: strategyTrendData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={strategyTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" fontSize={12} />
            <YAxis yAxisId="left" fontSize={12} />
            <YAxis yAxisId="right" orientation="right" fontSize={12} tickFormatter={(v: number) => (v * 100).toFixed(0) + '%'} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === '总盈亏') return [value.toFixed(0) + ` ${displaySymbol}`, name];
                if (name === '胜率') return [(value * 100).toFixed(1) + '%', name];
                return [value, name];
              }}
              labelFormatter={(label: string) => `期间: ${label}`}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="total_pnl" name="总盈亏" stroke="#1677ff" strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="right" type="monotone" dataKey="win_rate" name="胜率" stroke="#52c41a" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          暂无策略趋势数据，请先添加带策略标签的交易记录
        </div>
      ),
    },
    {
      key: 'strategyWinRateTrend',
      label: '策略胜率变化',
      children: strategyWinRateTrend.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={strategyWinRateTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" fontSize={12} />
            <YAxis fontSize={12} domain={[0, 1]} tickFormatter={(v: number) => (v * 100).toFixed(0) + '%'} />
            <Tooltip
              formatter={(value: number) => [(value * 100).toFixed(1) + '%', '胜率']}
              labelFormatter={(label: string) => `期间: ${label}`}
            />
            <Legend />
            {Array.from(new Set(strategyWinRateTrend.map(d => d.strategy))).map((strategy, idx) => {
              const colors = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
              return (
                <Line
                  key={strategy}
                  type="monotone"
                  data={strategyWinRateTrend.filter(d => d.strategy === strategy)}
                  dataKey="win_rate"
                  name={strategy as string}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          暂无胜率趋势数据，请先添加带策略标签的交易记录
        </div>
      ),
    },
    {
      key: 'emotionHeatmap',
      label: '情绪热力图',
      children: emotionHeatmapData.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
            {renderEmotionHeatmap(emotionHeatmapData)}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          暂无情绪热力图数据，请先添加带情绪记录的交易
        </div>
      ),
    },
    {
      key: 'monthly',
      label: '月度收益',
      children: (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis yAxisId="left" fontSize={12} />
            <YAxis yAxisId="right" orientation="right" fontSize={12} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === '盈亏') return [value.toFixed(0) + ` ${displaySymbol}`, name];
                if (name === '胜率') return [(value * 100).toFixed(1) + '%', name];
                return [value, name];
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="pnl" name="盈亏" radius={[4, 4, 0, 0]}>
              {monthlyStats.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.pnl >= 0 ? '#52c41a' : '#ff4d4f'}
                />
              ))}
            </Bar>
            <Bar
              yAxisId="right"
              dataKey="trade_count"
              name="交易次数"
              fill="#8884d8"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: 'drawdown',
      label: '最大回撤',
      children: (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={displayDrawdownData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(v: number) => (v * 100).toFixed(1) + '%'} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === '回撤') return [(value * 100).toFixed(2) + '%', name];
                return [value.toFixed(2), name];
              }}
              labelFormatter={(label: string) => `日期: ${label}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="drawdown"
              name="回撤"
              stroke="#ff4d4f"
              fill="#ff4d4f"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: 'calendar',
      label: '日历热力图',
      children: (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>选择年份：</span>
            <Select
              value={calendarYear}
              onChange={(year) => {
                setCalendarYear(year);
              }}
              style={{ width: 100 }}
            >
              {[dayjs().year(), dayjs().year() - 1, dayjs().year() - 2].map((y) => (
                <Select.Option key={y} value={y}>{y}</Select.Option>
              ))}
            </Select>
          </div>
          <CalendarHeatmap data={calendarData} year={calendarYear} moneySymbol={displaySymbol} />
        </div>
      ),
    },
    {
      key: 'riskAssessment',
      label: '风险评估',
      children: riskAssessmentDisplay ? (
        <div>
          <Alert
            message={
              <span>
                风险等级：
                <span
                  style={{
                    fontWeight: 'bold',
                    color:
                      riskAssessmentDisplay.overall_risk_level === 'high'
                        ? '#ff4d4f'
                        : riskAssessmentDisplay.overall_risk_level === 'medium'
                          ? '#faad14'
                          : '#52c41a',
                  }}
                >
                  {riskAssessmentDisplay.overall_risk_level === 'high'
                    ? '高风险'
                    : riskAssessmentDisplay.overall_risk_level === 'medium'
                      ? '中等风险'
                      : '低风险'}
                </span>
              </span>
            }
            type={
              riskAssessmentDisplay.overall_risk_level === 'high'
                ? 'error'
                : riskAssessmentDisplay.overall_risk_level === 'medium'
                  ? 'warning'
                  : 'success'
            }
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: 16 }}
          />

          {riskAssessmentDisplay.risk_warnings.length > 0 && (
            <Alert
              message="风险提示"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {riskAssessmentDisplay.risk_warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Card title="风险敞口" size="small">
                <Statistic
                  title="总市值"
                  value={riskAssessmentDisplay.exposure.total_market_value}
                  precision={0}
                  suffix={displaySymbol}
                />
                <Statistic
                  title="总敞口占比"
                  value={riskAssessmentDisplay.exposure.total_exposure * 100}
                  precision={1}
                  suffix="%"
                />
                <Statistic
                  title="最大单一仓位"
                  value={riskAssessmentDisplay.exposure.largest_position_pct * 100}
                  precision={1}
                  suffix="%"
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="风险收益比" size="small">
                <Statistic
                  title="当前风险收益比"
                  value={riskAssessmentDisplay.risk_reward.current_risk_reward}
                  precision={2}
                />
                <Statistic
                  title="已设止损仓位数"
                  value={riskAssessmentDisplay.risk_reward.positions_with_sl}
                />
                <Statistic
                  title="潜在上行空间"
                  value={riskAssessmentDisplay.risk_reward.potential_upside}
                  precision={0}
                  suffix={displaySymbol}
                />
                <Statistic
                  title="潜在下行风险"
                  value={riskAssessmentDisplay.risk_reward.potential_downside}
                  precision={0}
                  suffix={displaySymbol}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          {riskAssessmentDisplay.exposure.stock_exposure.length > 0 && (
            <Card title="股票敞口 (Top 10)" size="small" style={{ marginTop: 16 }}>
              <Table
                dataSource={riskAssessmentDisplay.exposure.stock_exposure}
                rowKey="stock_code"
                size="small"
                pagination={false}
                columns={[
                  { title: '代码', dataIndex: 'stock_code', key: 'stock_code' },
                  { title: '名称', dataIndex: 'stock_name', key: 'stock_name' },
                  { title: '市值', dataIndex: 'value', key: 'value', render: (v: number) => v.toFixed(0) },
                  { title: '占比', dataIndex: 'percentage', key: 'percentage', render: (p: number) => `${(p * 100).toFixed(1)}%` },
                ]}
              />
            </Card>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40 }}>
          暂无持仓数据
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Date Range Picker */}
      <Card variant="borderless" style={{ marginBottom: 24 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <span style={{ fontSize: 16, fontWeight: 600 }}>统计分析</span>
          </Col>
          <Col>
            <Space>
              <RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                allowClear
                format="YYYY-MM-DD"
                placeholder={['开始日期', '结束日期']}
                presets={[
                  { label: '最近7天', value: [dayjs().subtract(7, 'day'), dayjs()] },
                  { label: '最近30天', value: [dayjs().subtract(30, 'day'), dayjs()] },
                  { label: '最近90天', value: [dayjs().subtract(90, 'day'), dayjs()] },
                  { label: '今年', value: [dayjs().startOf('year'), dayjs()] },
                ]}
              />
              <Dropdown menu={exportMenuItems} trigger={['click']}>
                <Button icon={<DownloadOutlined />}>
                  导出PDF
                </Button>
              </Dropdown>
            </Space>
          </Col>
        </Row>
      </Card>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 100 }}>
          <Spin size="large">加载中...</Spin>
        </div>
      ) : (
        <>
          {canonicalKpiFallbackReason && (
            <Alert
              type="warning"
              showIcon
              message="共享KPI降级模式"
              description={`原因：${canonicalKpiFallbackReason}。回退口径：总盈亏=已实现+未实现，金额按当前显示币种换算，最大回撤与图表序列保持同源。`}
              style={{ marginBottom: 16 }}
            />
          )}
          {/* Stats Overview Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="总盈亏"
                  value={headlinePnl}
                  precision={0}
                  valueStyle={{ color: headlinePnl >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
                  prefix={headlinePnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  suffix={displaySymbol}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="收益率"
                  value={(headlineReturn * 100).toFixed(1) + '%'}
                  valueStyle={{ color: headlineReturn >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
                  prefix={headlineReturn >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="胜率"
                  value={(winRate * 100).toFixed(1) + '%'}
                  valueStyle={{ color: winRate >= 0.5 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
                  prefix={<TrophyOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="盈亏比"
                  value={profitLossRatio.toFixed(2)}
                  valueStyle={{ color: profitLossRatio >= 1 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
                  prefix={<SwapOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="总交易次数"
                  value={totalTrades}
                  valueStyle={{ color: '#1677ff', fontSize: 18 }}
                  prefix={<BarChartOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="最大回撤"
                  value={(maxDrawdown * 100).toFixed(1) + '%'}
                  valueStyle={{ color: '#ff4d4f', fontSize: 18 }}
                  prefix={<FallOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="平均持仓天数"
                  value={avgHoldingDays.toFixed(2)}
                  valueStyle={{ fontSize: 18 }}
                  prefix={<ClockCircleOutlined />}
                  suffix="天"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="最大连赢"
                  value={maxConsecutiveWins}
                  valueStyle={{ color: '#52c41a', fontSize: 18 }}
                  prefix={<FireOutlined />}
                  suffix="次"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="最大连亏"
                  value={maxConsecutiveLosses}
                  valueStyle={{ color: '#ff4d4f', fontSize: 18 }}
                  prefix={<FallOutlined />}
                  suffix="次"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="期望值"
                  value={expectancy.toFixed(2)}
                  valueStyle={{ color: expectancy >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
                  prefix={<DollarOutlined />}
                  suffix={displaySymbol}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="冲动交易"
                  value={impulsiveTradeCount}
                  valueStyle={{ color: impulsiveTradeCount > 0 ? '#ff4d4f' : '#52c41a', fontSize: 18 }}
                  prefix={<ThunderboltOutlined />}
                  suffix="次"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="止损执行率"
                  value={(stopLossRate * 100).toFixed(1) + '%'}
                  valueStyle={{ color: stopLossRate >= 0.8 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
                  prefix={<SafetyOutlined />}
                />
              </Card>
            </Col>
            {planTotal > 0 && (
              <>
                <Col xs={24} sm={12} md={8} lg={6} xl={4}>
                  <Card variant="borderless" hoverable size="small">
                    <Statistic
                      title="计划执行率"
                      value={(planExecutionRate * 100).toFixed(1) + '%'}
                      valueStyle={{ color: planExecutionRate >= 0.8 ? '#52c41a' : planExecutionRate >= 0.5 ? '#faad14' : '#ff4d4f', fontSize: 18 }}
                      prefix={<SafetyOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6} xl={4}>
                  <Card variant="borderless" hoverable size="small">
                    <Statistic
                      title="完全执行/部分/错过"
                      value={`${planExecuted}/${planPartial}/${planMissed}`}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6} xl={4}>
                  <Card variant="borderless" hoverable size="small">
                    <Statistic
                      title="执行/错过平均盈亏"
                      value={`${planExecutedAvgPnl.toFixed(0)}/${planMissedAvgPnl.toFixed(0)}`}
                      valueStyle={{ color: planExecutedAvgPnl > planMissedAvgPnl ? '#52c41a' : '#ff4d4f', fontSize: 16 }}
                      suffix={displaySymbol}
                    />
                  </Card>
                </Col>
              </>
            )}
          </Row>

          {/* Charts Section */}
          <Card variant="borderless">
            <Tabs
              defaultActiveKey="assetCurve"
              items={chartTabs.map((tab) => ({
                key: tab.key,
                label: tab.label,
                children: tab.children,
              }))}
              size="large"
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default Statistics;
