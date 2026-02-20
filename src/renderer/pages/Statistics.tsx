import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Row, Col, Statistic, Spin, Tabs, DatePicker, Select, Alert, Table, Progress, Button, message, Dropdown, Space } from 'antd';
import type { RiskAssessment } from '../../shared/types';
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

interface CalendarHeatmapProps {
  data: CalendarHeatmapData[];
}

const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ data }) => {
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
    const year = dayjs().year();
    
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
  }, []);

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
                      title={d.date && dayData ? `${d.date}: ${dayData.trade_count}笔, ${dayData.pnl > 0 ? '+' : ''}${dayData.pnl.toFixed(2)}元` : ''}
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
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [strategyTrendData, setStrategyTrendData] = useState<StrategyTrendData[]>([]);
  const [strategyWinRateTrend, setStrategyWinRateTrend] = useState<StrategyWinRateTrend[]>([]);

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
        riskRes,
        strategyTrendRes,
        strategyWinRateTrendRes,
        emotionHeatmapRes,
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
        window.electronAPI.stats.riskAssessment(),
        window.electronAPI.stats.strategyTrend(startDate, endDate),
        window.electronAPI.stats.strategyWinRateTrend(startDate, endDate),
        window.electronAPI.stats.emotionHeatmap(startDate, endDate),
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
      if (riskRes.success) setRiskAssessment(riskRes.data ?? null);
      if (strategyTrendRes.success) setStrategyTrendData(strategyTrendRes.data ?? []);
      if (strategyWinRateTrendRes.success) setStrategyWinRateTrend(strategyWinRateTrendRes.data ?? []);
      if (emotionHeatmapRes.success) setEmotionHeatmapData(emotionHeatmapRes.data ?? []);
    } catch (error) {
      console.error('Failed to fetch statistics data:', error);
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

  // PDF导出
  const handleExportPdf = async (reportType: 'summary' | 'monthly') => {
    try {
      const startDate = dateRange?.[0]?.format('YYYY-MM-DD');
      const endDate = dateRange?.[1]?.format('YYYY-MM-DD');
      const result = await window.electronAPI.trade.exportPdfReport(reportType, startDate, endDate);
      if (result.success) {
        message.success('PDF报告已导出到: ' + result.data);
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

  const totalPnl = overview?.total_pnl ?? 0;
  const winRate = overview?.win_rate ?? 0;
  const profitLossRatio = overview?.profit_loss_ratio ?? 0;
  const maxDrawdown = overview?.max_drawdown ?? 0;
  const avgHoldingDays = overview?.avg_holding_days ?? 0;
  const maxConsecutiveWins = overview?.max_consecutive_wins ?? 0;
  const maxConsecutiveLosses = overview?.max_consecutive_losses ?? 0;
  const expectancy = overview?.expectancy ?? 0;
  const impulsiveTradeCount = overview?.impulsive_trade_count ?? 0;
  const stopLossRate = overview?.stop_loss_execution_rate ?? 0;
  const totalTrades = overview?.total_trades ?? 0;
  const totalReturn = overview?.total_return ?? 0;
  
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
      children: assetCurve.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={assetCurve} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === '总资产' || name === '现金' || name === '市值') return [value.toFixed(2) + ' 元', name];
                if (name === '每日盈亏') return [value.toFixed(2) + ' 元', name];
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
          暂无账户快照数据，请先在"设置"中保存账户快照或在"持仓"页面生成快照
        </div>
      ),
    },
    {
      key: 'pnlCurve',
      label: '收益曲线',
      children: (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={pnlCurve} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              formatter={(value: number) => [value.toFixed(2) + ' 元', '']}
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
              name="每日盈亏"
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
                if (name === '总盈亏' || name === '平均盈亏') return [value.toFixed(2) + ' 元', name];
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
                if (name === '平均盈亏') return [value.toFixed(2) + ' 元', name];
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
                if (name === '总盈亏') return [value.toFixed(2) + ' 元', name];
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
          暂无策略趋势数据，请先添加有策略标签的交易记录
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
          暂无胜率趋势数据，请先添加有策略标签的交易记录
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
          暂无情绪热力图数据，请先添加有情绪记录的交易
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
                if (name === '盈亏') return [value.toFixed(2) + ' 元', name];
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
          <AreaChart data={drawdownData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
          <CalendarHeatmap data={calendarData} />
        </div>
      ),
    },
    {
      key: 'emotionHeatmap',
      label: '情绪-胜率热力图',
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
                if (name === '平均盈亏') return [value.toFixed(2) + ' 元', name];
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
              dataKey="trade_count"
              name="交易次数"
              fill="#faad14"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: 'riskAssessment',
      label: '风险评估',
      children: riskAssessment ? (
        <div>
          {/* Risk Level Banner */}
          <Alert
            message={
              <span>
                风险等级：
                <span style={{
                  fontWeight: 'bold',
                  color: riskAssessment.overall_risk_level === 'high' ? '#ff4d4f' :
                         riskAssessment.overall_risk_level === 'medium' ? '#faad14' : '#52c41a'
                }}>
                  {riskAssessment.overall_risk_level === 'high' ? '高风险' :
                   riskAssessment.overall_risk_level === 'medium' ? '中等风险' : '低风险'}
                </span>
              </span>
            }
            type={riskAssessment.overall_risk_level === 'high' ? 'error' :
                  riskAssessment.overall_risk_level === 'medium' ? 'warning' : 'success'}
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: 16 }}
          />

          {/* Warnings */}
          {riskAssessment.risk_warnings.length > 0 && (
            <Alert
              message="风险提示"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {riskAssessment.risk_warnings.map((w, i) => (
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
            {/* Risk Exposure Section */}
            <Col span={12}>
              <Card title="风险敞口" size="small">
                <Statistic
                  title="总市值"
                  value={riskAssessment.exposure.total_market_value}
                  precision={2}
                  prefix="¥"
                />
                <Statistic
                  title="总敞口占比"
                  value={riskAssessment.exposure.total_exposure * 100}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: riskAssessment.exposure.total_exposure > 0.8 ? '#ff4d4f' : undefined }}
                />
                <Statistic
                  title="最大单一仓位"
                  value={riskAssessment.exposure.largest_position_pct * 100}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: riskAssessment.exposure.largest_position_pct > 0.3 ? '#ff4d4f' : undefined }}
                />
              </Card>
            </Col>

            {/* Risk Reward Section */}
            <Col span={12}>
              <Card title="风险收益比" size="small">
                <Statistic
                  title="当前风险收益比"
                  value={riskAssessment.risk_reward.current_risk_reward}
                  precision={2}
                  valueStyle={{ color: riskAssessment.risk_reward.current_risk_reward >= 1 ? '#52c41a' : '#ff4d4f' }}
                />
                <Statistic
                  title="设置止损的仓位"
                  value={riskAssessment.risk_reward.positions_with_sl}
                />
                <Statistic
                  title="潜在上涨空间"
                  value={riskAssessment.risk_reward.potential_upside}
                  precision={0}
                  prefix="¥"
                />
                <Statistic
                  title="潜在下跌风险"
                  value={riskAssessment.risk_reward.potential_downside}
                  precision={0}
                  prefix="¥"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            {/* Max Potential Loss Section */}
            <Col span={12}>
              <Card title="最大潜在损失" size="small">
                <Statistic
                  title="全部止损损失"
                  value={riskAssessment.max_potential_loss.if_all_stop_loss}
                  precision={0}
                  prefix="¥"
                  valueStyle={{ color: '#ff4d4f' }}
                />
                <Statistic
                  title="损失占比"
                  value={riskAssessment.max_potential_loss.if_all_stop_loss_pct * 100}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: riskAssessment.max_potential_loss.if_all_stop_loss_pct > 0.5 ? '#ff4d4f' : undefined }}
                />
                <Statistic
                  title="单笔最大损失"
                  value={riskAssessment.max_potential_loss.largest_single_loss}
                  precision={0}
                  prefix="¥"
                />
              </Card>
            </Col>

            {/* Cash Coverage */}
            <Col span={12}>
              <Card title="资金状况" size="small">
                <Statistic
                  title="可用资金"
                  value={riskAssessment.max_potential_loss.cash_available}
                  precision={0}
                  prefix="¥"
                />
                <div style={{ marginTop: 16 }}>
                  <div>能否覆盖全部损失：</div>
                  <Progress
                    percent={riskAssessment.max_potential_loss.can_cover_loss ? 100 : 0}
                    status={riskAssessment.max_potential_loss.can_cover_loss ? 'success' : 'exception'}
                    format={() => riskAssessment.max_potential_loss.can_cover_loss ? '是' : '否'}
                  />
                </div>
              </Card>
            </Col>
          </Row>

          {/* Stock Exposure Table */}
          {riskAssessment.exposure.stock_exposure.length > 0 && (
            <Card title="股票敞口 (Top 10)" size="small" style={{ marginTop: 16 }}>
              <Table
                dataSource={riskAssessment.exposure.stock_exposure}
                rowKey="stock_code"
                size="small"
                pagination={false}
                columns={[
                  { title: '代码', dataIndex: 'stock_code', key: 'stock_code' },
                  { title: '名称', dataIndex: 'stock_name', key: 'stock_name' },
                  { title: '市值', dataIndex: 'value', key: 'value', render: (v: number) => v.toFixed(0) },
                  { title: '占比', dataIndex: 'percentage', key: 'percentage', render: (p: number) => (p * 100).toFixed(1) + '%' },
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
          {/* Stats Overview Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="总盈亏"
                  value={totalPnl.toFixed(2)}
                  precision={2}
                  valueStyle={{ color: totalPnl >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
                  prefix={totalPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  suffix="元"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={4}>
              <Card variant="borderless" hoverable size="small">
                <Statistic
                  title="总收益率"
                  value={(totalReturn * 100).toFixed(1) + '%'}
                  valueStyle={{ color: totalReturn >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
                  prefix={totalReturn >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
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
                  title="最大连胜"
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
                  suffix="元"
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
                      suffix="元"
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
