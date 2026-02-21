import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Typography, Tag, Space, Progress, Alert, Modal, Descriptions } from 'antd';
const { Text } = Typography;
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  TrophyOutlined,
  SwapOutlined,
  BarChartOutlined,
  LineChartOutlined,
  BellOutlined,
  WalletOutlined,
  ThunderboltOutlined,
  FlagOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import dayjs from 'dayjs';
import { useCurrencyStore, useGoalStore } from '../stores';
import type { Trade, AssetCurveData } from '../../shared/types';
import { convertAmount, currencySymbol, marketCurrency } from '../utils/currency';
import type { FxRates } from '../utils/currency';

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
  current_consecutive_wins: number;
  current_consecutive_losses: number;
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

interface AssetCurvePoint {
  date: string;
  total_assets: number;
  daily_pnl: number;
  cumulative_return_pct: number;
}

export function normalizeAssetCurveData(
  assetChartData: AssetCurvePoint[],
  targetStartAssets: number,
  targetEndAssets: number,
): AssetCurvePoint[] {
  if (!assetChartData.length) return [];

  const rawStart = Number(assetChartData[0].total_assets || 0);
  const rawEnd = Number(assetChartData[assetChartData.length - 1].total_assets || 0);
  const totalSteps = Math.max(1, assetChartData.length - 1);
  const startOffset = targetStartAssets - rawStart;
  const endOffset = targetEndAssets - rawEnd;

  let previousAdjustedAssets = 0;
  return assetChartData.map((point, index) => {
    const progress = assetChartData.length === 1 ? 1 : index / totalSteps;
    const offset = startOffset + (endOffset - startOffset) * progress;
    const adjustedTotalAssets = Number(point.total_assets || 0) + offset;
    const adjustedDailyPnl = index === 0 ? 0 : adjustedTotalAssets - previousAdjustedAssets;
    previousAdjustedAssets = adjustedTotalAssets;

    return {
      ...point,
      total_assets: adjustedTotalAssets,
      daily_pnl: adjustedDailyPnl,
      cumulative_return_pct: targetStartAssets > 0
        ? ((adjustedTotalAssets - targetStartAssets) / targetStartAssets) * 100
        : 0,
    };
  });
}

interface MonthlyStats {
  month: string;
  pnl: number;
  trade_count: number;
  win_rate: number;
}

interface PositionBrief {
  stock_code: string;
  stock_name: string;
  market: string;
  floating_pnl: number;
  floating_pnl_ratio: number;
}

interface DailyBrief {
  yesterdayTrades: number;
  yesterdayPnl: number;
  yesterdayWinRate: number;
  currentPositions: number;
  floatingPnl: number;
  currentConsecutiveLosses: number;
  currentConsecutiveWins: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  impulsiveCount: number;
  recentTrades: any[];
  topHoldings: PositionBrief[];
}

async function fetchAllSellTrades(): Promise<Trade[]> {
  const all: Trade[] = [];
  let page = 1;
  const pageSize = 500;
  let total = 0;

  while (page === 1 || all.length < total) {
    const result = await window.electronAPI.trade.list({
      direction: 'SELL',
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
      if (typeof trade.realized_pnl === 'number') {
        all.push(trade);
      }
    }

    if (chunk.length === 0) {
      break;
    }

    page += 1;
  }

  return all;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [pnlCurve, setPnlCurve] = useState<PnlDataPoint[]>([]);
  const [assetCurve, setAssetCurve] = useState<AssetCurveData[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [positions, setPositions] = useState<PositionBrief[]>([]);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [sellTrades, setSellTrades] = useState<Trade[]>([]);
  const [fxRates, setFxRates] = useState<FxRates | undefined>(undefined);
  const [initialCapital, setInitialCapital] = useState(0);
  const [pnlRatioModalOpen, setPnlRatioModalOpen] = useState(false);
  const { displayCurrency } = useCurrencyStore();
  const { currentProgress, fetchCurrentProgress } = useGoalStore();

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [overviewRes, pnlRes, monthlyRes, positionsRes, assetCurveRes, settingsRes, allSells] = await Promise.all([
          window.electronAPI.stats.overview(),
          window.electronAPI.stats.pnlCurve(),
          window.electronAPI.stats.monthly(),
          window.electronAPI.position.list(),
          window.electronAPI.stats.assetCurve(),
          window.electronAPI.settings.get(),
          fetchAllSellTrades(),
        ]);

        if (overviewRes.success) {
          setOverview(overviewRes.data ?? null);
        }
        if (pnlRes.success) {
          setPnlCurve(pnlRes.data ?? []);
        }
        if (monthlyRes.success) {
          setMonthlyStats(monthlyRes.data ?? []);
        }
        if (positionsRes.success) {
          setPositions((positionsRes.data ?? []) as PositionBrief[]);
        }
        if (assetCurveRes.success) {
          setAssetCurve((assetCurveRes.data ?? []) as AssetCurveData[]);
        }
        if (settingsRes.success && settingsRes.data) {
          setInitialCapital(Number(settingsRes.data.initial_capital || 0));
        }
        setSellTrades(allSells);

        const yesterdayStr = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
        const yesterdayStatsRes = await window.electronAPI.stats.overview(yesterdayStr, yesterdayStr);

        let yesterdayTrades = 0;
        let yesterdayPnl = 0;
        let yesterdayWinRate = 0;

        const pnlData = pnlRes.data || [];
        const yesterdayPnlData = pnlData.filter((p: PnlDataPoint) => p.date === yesterdayStr);
        yesterdayPnl = yesterdayPnlData.reduce((sum: number, p: PnlDataPoint) => sum + (p.daily_pnl || 0), 0);

        if (yesterdayStatsRes.success && yesterdayStatsRes.data) {
          yesterdayTrades = yesterdayStatsRes.data.total_trades || 0;
          yesterdayWinRate = yesterdayStatsRes.data.win_rate || 0;
        }

        const posData = (positionsRes.data || []) as PositionBrief[];
        const brief: DailyBrief = {
          yesterdayTrades,
          yesterdayPnl,
          yesterdayWinRate,
          currentPositions: posData.length,
          floatingPnl: posData.reduce((sum: number, p: PositionBrief) => sum + (p.floating_pnl || 0), 0),
          currentConsecutiveLosses: overviewRes.data?.current_consecutive_losses || 0,
          currentConsecutiveWins: overviewRes.data?.current_consecutive_wins || 0,
          maxConsecutiveLosses: overviewRes.data?.max_consecutive_losses || 0,
          maxConsecutiveWins: overviewRes.data?.max_consecutive_wins || 0,
          impulsiveCount: overviewRes.data?.impulsive_trade_count || 0,
          recentTrades: [],
          topHoldings: posData.slice(0, 3),
        };

        setDailyBrief(brief);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchCurrentProgress();
  }, [fetchCurrentProgress]);

  const convertedTradeMetrics = useMemo(() => {
    if (sellTrades.length === 0) {
      return null;
    }

    let realizedPnl = 0;
    let winCount = 0;
    let lossCount = 0;
    let flatCount = 0;
    let winPnlSum = 0;
    let lossPnlSum = 0;
    const dailyMap = new Map<string, number>();
    const monthlyMap = new Map<string, { pnl: number; trade_count: number; win_count: number }>();

    for (const trade of sellTrades) {
      const rawPnl = Number(trade.realized_pnl || 0);
      const convertedPnl = convertAmount(rawPnl, marketCurrency(trade.market), displayCurrency, fxRates);

      realizedPnl += convertedPnl;
      if (convertedPnl > 0) {
        winCount += 1;
        winPnlSum += convertedPnl;
      } else if (convertedPnl < 0) {
        lossCount += 1;
        lossPnlSum += convertedPnl;
      } else {
        flatCount += 1;
      }

      const date = trade.trade_date;
      dailyMap.set(date, (dailyMap.get(date) || 0) + convertedPnl);

      const month = String(date).slice(0, 7);
      const monthly = monthlyMap.get(month) || { pnl: 0, trade_count: 0, win_count: 0 };
      monthly.pnl += convertedPnl;
      monthly.trade_count += 1;
      if (rawPnl > 0) {
        monthly.win_count += 1;
      }
      monthlyMap.set(month, monthly);
    }

    const dailyRows = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    const curve = dailyRows.map(([date, daily_pnl]) => {
      cumulative += daily_pnl;
      return {
        date,
        daily_pnl,
        cumulative_pnl: cumulative,
      };
    });

    const months = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, value]) => ({
        month,
        pnl: value.pnl,
        trade_count: value.trade_count,
        win_rate: value.trade_count > 0 ? value.win_count / value.trade_count : 0,
      }));

    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const avgWin = winCount > 0 ? winPnlSum / winCount : 0;
    const avgLoss = lossCount > 0 ? lossPnlSum / lossCount : 0;
    const profitLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
    const sellCount = winCount + lossCount + flatCount;
    const winRate = sellCount > 0 ? winCount / sellCount : 0;
    const expectancy = winRate * avgWin + (1 - winRate) * avgLoss;

    return {
      realizedPnl,
      curve,
      months,
      yesterdayPnl: dailyMap.get(yesterday) || 0,
      winCount,
      lossCount,
      flatCount,
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

  const convertedAssetCurve = useMemo<AssetCurvePoint[]>(() => {
    if (!assetCurve.length) return [];
    let lastValidTotalAssets = 0;
    return assetCurve.map((row) => {
      const convertedTotalAssets = convertAmount(Number(row.total_assets || 0), 'CNY', displayCurrency, fxRates);
      const convertedCash = convertAmount(Number(row.cash || 0), 'CNY', displayCurrency, fxRates);
      const convertedMarketValue = convertAmount(Number(row.market_value || 0), 'CNY', displayCurrency, fxRates);
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
        date: row.date,
        total_assets: totalAssets > 0 ? totalAssets : 0,
        daily_pnl: convertAmount(Number(row.daily_pnl || 0), 'CNY', displayCurrency, fxRates),
        cumulative_return_pct: 0,
      };
    });
  }, [assetCurve, displayCurrency, fxRates]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 100 }}>
        <Spin size="large">加载中...</Spin>
      </div>
    );
  }

  const displaySymbol = currencySymbol(displayCurrency);
  const realizedPnl = convertedTradeMetrics?.realizedPnl ?? (overview?.total_pnl ?? 0);
  const unrealizedPnl = floatingPnlDisplay;
  const totalPnl = realizedPnl + unrealizedPnl;
  const winRate = overview?.win_rate ?? 0;
  const profitLossRatio = convertedTradeMetrics?.profitLossRatio ?? (overview?.profit_loss_ratio ?? 0);
  const totalTrades = overview?.total_trades ?? 0;
  const avgWin = convertedTradeMetrics?.avgWin ?? (overview?.avg_win ?? 0);
  const avgLoss = convertedTradeMetrics?.avgLoss ?? (overview?.avg_loss ?? 0);
  const winCount = convertedTradeMetrics?.winCount ?? (overview?.winning_trades ?? 0);
  const lossCount = convertedTradeMetrics?.lossCount ?? (overview?.losing_trades ?? 0);
  const expectancy = convertedTradeMetrics?.expectancy ?? (overview?.expectancy ?? 0);

  const legacyChartData = convertedTradeMetrics?.curve.length ? convertedTradeMetrics.curve : pnlCurve;
  const baseCapital = convertAmount(Number(initialCapital || 0), 'CNY', displayCurrency, fxRates);
  const fallbackAssetChartData: AssetCurvePoint[] = legacyChartData.map((row) => ({
    date: row.date,
    total_assets: baseCapital + Number(row.cumulative_pnl || 0),
    daily_pnl: Number(row.daily_pnl || 0),
    cumulative_return_pct: baseCapital > 0 ? (Number(row.cumulative_pnl || 0) / baseCapital) * 100 : 0,
  }));
  const assetChartData = convertedAssetCurve.length ? convertedAssetCurve : fallbackAssetChartData;
  const latestValidAssetPoint = [...assetChartData].reverse().find((point) => Number(point.total_assets) > 0) ?? null;
  const computedTotalAssets = baseCapital + totalPnl;
  const totalAssets = latestValidAssetPoint
    ? latestValidAssetPoint.total_assets
    : computedTotalAssets > 0
      ? computedTotalAssets
      : baseCapital > 0
        ? baseCapital
        : 0;
  const baselineAssetsForReturn = totalAssets - totalPnl;
  const normalizedAssetChartData = normalizeAssetCurveData(
    assetChartData,
    baselineAssetsForReturn,
    totalAssets,
  );
  const hasAssetChartData = normalizedAssetChartData.length > 0;
  const monthlyData = convertedTradeMetrics?.months.length ? convertedTradeMetrics.months : monthlyStats;
  const monthlyStyledData = monthlyData.map((item) => ({
    ...item,
    win_rate_pct: item.win_rate * 100,
  }));
  const yesterdayDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  const yesterdayAssetPnl = normalizedAssetChartData.find((point) => point.date === yesterdayDate)?.daily_pnl;
  const yesterdayPnl = yesterdayAssetPnl ?? convertedTradeMetrics?.yesterdayPnl ?? (dailyBrief?.yesterdayPnl ?? 0);
  const currentStreakWins = dailyBrief?.currentConsecutiveWins ?? 0;
  const currentStreakLosses = dailyBrief?.currentConsecutiveLosses ?? 0;
  const isWinningStreak = currentStreakWins > 0;
  const isLosingStreak = currentStreakLosses > 0;
  const currentStreakValue = isWinningStreak ? currentStreakWins : (isLosingStreak ? currentStreakLosses : 0);
  const currentStreakSuffix = isWinningStreak ? '连盈' : (isLosingStreak ? '连亏' : '平');
  const currentStreakColor = isWinningStreak ? '#52c41a' : (isLosingStreak ? '#ff4d4f' : '#1677ff');

  return (
    <div style={{ padding: 24 }}>
      {/* Daily Brief Section */}
      {dailyBrief && (
        <Card
          title={
            <span>
              <BellOutlined style={{ marginRight: 8 }} />
              每日简报 - {dayjs().format('YYYY-MM-DD')}
            </span>
          }
          variant="borderless"
          style={{ marginBottom: 24 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" hoverable>
                <Statistic
                  title="昨日盈亏"
                  value={yesterdayPnl}
                  precision={0}
                  valueStyle={{ color: yesterdayPnl >= 0 ? '#52c41a' : '#ff4d4f' }}
                  prefix={yesterdayPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  suffix={displaySymbol}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                  交易 {dailyBrief.yesterdayTrades} 笔，胜率 {(dailyBrief.yesterdayWinRate * 100).toFixed(0)}%
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" hoverable>
                <Statistic
                  title="当前持仓"
                  value={dailyBrief.currentPositions}
                  suffix="只"
                  prefix={<WalletOutlined />}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                  浮动盈亏: <span style={{ color: floatingPnlDisplay >= 0 ? '#52c41a' : '#ff4d4f' }}>
                    {floatingPnlDisplay >= 0 ? '+' : ''}{floatingPnlDisplay.toFixed(0)} {displaySymbol}
                  </span>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" hoverable>
                <Statistic
                  title="当前状态"
                  value={currentStreakValue}
                  suffix={currentStreakSuffix}
                  valueStyle={{ color: currentStreakColor }}
                  prefix={isWinningStreak ? <TrophyOutlined /> : (isLosingStreak ? <WarningOutlined /> : <SwapOutlined />)}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                  历史最大连盈: {dailyBrief.maxConsecutiveWins} 次，历史最大连亏: {dailyBrief.maxConsecutiveLosses} 次
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" hoverable>
                <Statistic
                  title="本月冲动交易"
                  value={dailyBrief.impulsiveCount}
                  suffix="次"
                  valueStyle={{ color: dailyBrief.impulsiveCount > 0 ? '#ff4d4f' : '#52c41a' }}
                  prefix={<ThunderboltOutlined />}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                  保持纪律，理性交易
                </div>
              </Card>
            </Col>
          </Row>
          {dailyBrief.topHoldings.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>重点持仓：</Text>
              <Space style={{ marginTop: 8 }}>
                {dailyBrief.topHoldings.map((p: PositionBrief) => (
                  <Tag key={p.stock_code} color="blue">
                    {p.stock_name} ({p.stock_code})
                    <span style={{ marginLeft: 4, color: p.floating_pnl >= 0 ? '#52c41a' : '#ff4d4f' }}>
                      {p.floating_pnl >= 0 ? '+' : ''}{(p.floating_pnl_ratio * 100).toFixed(1)}%
                    </span>
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </Card>
      )}

      {/* Overview Stats Cards */}
      <Card
        title={
          <span>
            <WalletOutlined style={{ marginRight: 8 }} />
            核心指标
          </span>
        }
        variant="borderless"
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" hoverable>
              <Statistic
                title="总资产"
                value={totalAssets}
                precision={0}
                valueStyle={{ color: totalAssets >= 0 ? '#1677ff' : '#ff4d4f' }}
                prefix={<WalletOutlined />}
                suffix={displaySymbol}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" hoverable>
              <Statistic
                title="总盈亏"
                value={totalPnl}
                precision={0}
                valueStyle={{ color: totalPnl >= 0 ? '#52c41a' : '#ff4d4f' }}
                prefix={totalPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                suffix={displaySymbol}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" hoverable>
              <Statistic
                title="已实现盈亏"
                value={realizedPnl}
                precision={0}
                valueStyle={{ color: realizedPnl >= 0 ? '#52c41a' : '#ff4d4f' }}
                prefix={realizedPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                suffix={displaySymbol}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" hoverable>
              <Statistic
                title="未实现盈亏"
                value={unrealizedPnl}
                precision={0}
                valueStyle={{ color: unrealizedPnl >= 0 ? '#52c41a' : '#ff4d4f' }}
                prefix={unrealizedPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                suffix={displaySymbol}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" hoverable>
              <Statistic
                title="胜率"
                value={(winRate * 100).toFixed(1) + '%'}
                valueStyle={{ color: winRate >= 0.5 ? '#52c41a' : '#ff4d4f' }}
                prefix={<TrophyOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              variant="borderless"
              hoverable
              onClick={() => setPnlRatioModalOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="盈亏比"
                value={profitLossRatio.toFixed(2)}
                valueStyle={{ color: profitLossRatio >= 1 ? '#52c41a' : '#ff4d4f' }}
                prefix={<SwapOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" hoverable>
              <Statistic
                title="总交易次数"
                value={totalTrades}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Modal
        title="盈亏比详情"
        open={pnlRatioModalOpen}
        onCancel={() => setPnlRatioModalOpen(false)}
        footer={null}
      >
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="盈亏比">
            {profitLossRatio.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="盈利笔数">
            {winCount}
          </Descriptions.Item>
          <Descriptions.Item label="亏损笔数">
            {lossCount}
          </Descriptions.Item>
          <Descriptions.Item label="平均盈利">
            {avgWin.toFixed(0)} {displaySymbol}
          </Descriptions.Item>
          <Descriptions.Item label="平均亏损">
            {avgLoss.toFixed(0)} {displaySymbol}
          </Descriptions.Item>
          <Descriptions.Item label="期望值">
            {expectancy.toFixed(0)} {displaySymbol}
          </Descriptions.Item>
          <Descriptions.Item label="口径说明">
            盈亏比 = |平均盈利 / 平均亏损|。仅统计已平仓 SELL，盈亏为 0 会中断连盈/连亏。
          </Descriptions.Item>
        </Descriptions>
      </Modal>

      {/* Goal Progress Section */}
      {currentProgress && (
        <>
          <Card
            title={
              <span>
                <FlagOutlined style={{ marginRight: 8 }} />
                目标进度 - {currentProgress.goal.period === 'monthly'
                  ? `${currentProgress.goal.year}年${currentProgress.goal.month}月`
                  : `${currentProgress.goal.year}年`}
              </span>
            }
            variant="borderless"
            style={{ marginBottom: 24 }}
          >
            <Row gutter={[16, 16]}>
              {currentProgress.goal.target_return !== undefined && currentProgress.goal.target_return !== null && (
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" hoverable>
                    <Statistic
                      title="收益率目标"
                      value={(currentProgress.goal.target_return * 100).toFixed(1)}
                      suffix="%"
                      prefix={<ArrowUpOutlined />}
                    />
                    <Progress
                      percent={Math.round(currentProgress.return_progress * 100)}
                      size="small"
                      status={currentProgress.return_progress >= 1 ? 'success' : 'active'}
                      style={{ marginTop: 8 }}
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                      当前: {(currentProgress.actual_return * 100).toFixed(2)}%
                    </div>
                  </Card>
                </Col>
              )}
              {currentProgress.goal.target_win_rate !== undefined && currentProgress.goal.target_win_rate !== null && (
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" hoverable>
                    <Statistic
                      title="胜率目标"
                      value={(currentProgress.goal.target_win_rate * 100).toFixed(1)}
                      suffix="%"
                      prefix={<TrophyOutlined />}
                    />
                    <Progress
                      percent={Math.round(currentProgress.win_rate_progress * 100)}
                      size="small"
                      status={currentProgress.win_rate_progress >= 1 ? 'success' : 'active'}
                      style={{ marginTop: 8 }}
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                      当前: {(currentProgress.actual_win_rate * 100).toFixed(2)}%
                    </div>
                  </Card>
                </Col>
              )}
              {currentProgress.goal.target_profit_loss_ratio !== undefined && currentProgress.goal.target_profit_loss_ratio !== null && (
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" hoverable>
                    <Statistic
                      title="盈亏比目标"
                      value={currentProgress.goal.target_profit_loss_ratio.toFixed(2)}
                      prefix={<SwapOutlined />}
                    />
                    <Progress
                      percent={Math.round(currentProgress.profit_loss_ratio_progress * 100)}
                      size="small"
                      status={currentProgress.profit_loss_ratio_progress >= 1 ? 'success' : 'active'}
                      style={{ marginTop: 8 }}
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                      当前: {currentProgress.actual_profit_loss_ratio.toFixed(2)}
                    </div>
                  </Card>
                </Col>
              )}
              {currentProgress.goal.target_trade_count !== undefined && currentProgress.goal.target_trade_count !== null && (
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" hoverable>
                    <Statistic
                      title="交易次数目标"
                      value={currentProgress.goal.target_trade_count}
                      suffix="次"
                      prefix={<BarChartOutlined />}
                    />
                    <Progress
                      percent={Math.min(Math.round((currentProgress.actual_trade_count / currentProgress.goal.target_trade_count) * 100), 100)}
                      size="small"
                      status={currentProgress.actual_trade_count >= currentProgress.goal.target_trade_count ? 'success' : 'active'}
                      style={{ marginTop: 8 }}
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                      当前: {currentProgress.actual_trade_count} 次
                    </div>
                  </Card>
                </Col>
              )}
            </Row>
          </Card>

          {/* Goal Warnings */}
          {currentProgress.warnings.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              {currentProgress.warnings.map((warning, index) => (
                <Alert
                  key={index}
                  message={warning.message}
                  type={warning.severity === 'danger' ? 'error' : 'warning'}
                  showIcon
                  icon={warning.severity === 'danger' ? <WarningOutlined /> : <WarningOutlined />}
                  style={{ marginBottom: 8 }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Profit Curve */}
      <Card
        title={
          <span>
            <LineChartOutlined style={{ marginRight: 8 }} />
            收益曲线
          </span>
        }
        variant="borderless"
        style={{ marginBottom: 24 }}
      >
        {hasAssetChartData ? (
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={normalizedAssetChartData} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" fontSize={12} tick={{ fill: '#666' }} />
              <YAxis yAxisId="left" fontSize={12} tick={{ fill: '#666' }} />
              <YAxis yAxisId="right" orientation="right" fontSize={12} tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fill: '#666' }} />
              <Tooltip
                labelFormatter={(label: string) => `日期: ${label}`}
                formatter={(value: number, name: string) => {
                  if (name === '累计盈亏(%)') return [`${value.toFixed(2)}%`, name];
                  return [`${Number(value).toFixed(0)} ${displaySymbol}`, name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="daily_pnl" name="当日盈亏" radius={[6, 6, 0, 0]}>
                {normalizedAssetChartData.map((entry, index) => (
                  <Cell key={`asset-daily-${index}`} fill={entry.daily_pnl >= 0 ? '#52c41a' : '#ff7875'} />
                ))}
              </Bar>
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="total_assets"
                name="总资产"
                stroke="#1677ff"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative_return_pct"
                name="累计盈亏(%)"
                stroke="#faad14"
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 4"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : legacyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={legacyChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(value: number) => [Number(value).toFixed(0) + ` ${displaySymbol}`, '']}
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
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无数据</div>
        )}
      </Card>

      {/* Monthly Stats Bar Chart */}
      <Card
        title={
          <span>
            <BarChartOutlined style={{ marginRight: 8 }} />
            月度统计
          </span>
        }
        variant="borderless"
      >
        {monthlyStyledData.length > 0 ? (
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={monthlyStyledData} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" fontSize={12} tick={{ fill: '#666' }} />
              <YAxis yAxisId="left" fontSize={12} tick={{ fill: '#666' }} />
              <YAxis yAxisId="right" orientation="right" fontSize={12} tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fill: '#666' }} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === '月度盈亏') return [`${value.toFixed(0)} ${displaySymbol}`, name];
                  if (name === '胜率') return [`${value.toFixed(1)}%`, name];
                  if (name === '交易次数') return [value.toFixed(0), name];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="pnl" name="月度盈亏" radius={[8, 8, 0, 0]} barSize={22}>
                {monthlyStyledData.map((entry, index) => (
                  <Cell key={`month-pnl-${index}`} fill={entry.pnl >= 0 ? '#73d13d' : '#ff7875'} />
                ))}
              </Bar>
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="trade_count"
                name="交易次数"
                stroke="#1677ff"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="win_rate_pct"
                name="胜率"
                stroke="#faad14"
                strokeWidth={2}
                dot={{ r: 2 }}
                strokeDasharray="4 4"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无数据</div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
