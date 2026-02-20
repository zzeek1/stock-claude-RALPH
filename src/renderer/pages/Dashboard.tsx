import React, { useEffect, useState, useMemo } from 'react';
import { Card, Row, Col, Statistic, Spin, Typography, Tag, Space, Progress, Alert } from 'antd';
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
  CheckCircleOutlined,
  FlagOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
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
import { useGoalStore } from '../stores';
import type { GoalProgress } from '../../shared/types';

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

interface MonthlyStats {
  month: string;
  pnl: number;
  trade_count: number;
  win_rate: number;
}

interface DailyBrief {
  yesterdayTrades: number;
  yesterdayPnl: number;
  yesterdayWinRate: number;
  currentPositions: number;
  floatingPnl: number;
  consecutiveLosses: number;
  consecutiveWins: number;
  impulsiveCount: number;
  recentTrades: any[];
  topHoldings: any[];
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [pnlCurve, setPnlCurve] = useState<PnlDataPoint[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const { currentProgress, fetchCurrentProgress } = useGoalStore();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [overviewRes, pnlRes, monthlyRes, positionsRes] = await Promise.all([
          window.electronAPI.stats.overview(),
          window.electronAPI.stats.pnlCurve(),
          window.electronAPI.stats.monthly(),
          window.electronAPI.position.list(),
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
          setPositions(positionsRes.data ?? []);
        }

        const today = dayjs();
        const yesterday = today.subtract(1, 'day');
        const yesterdayStr = yesterday.format('YYYY-MM-DD');
        
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

        const posData = positionsRes.data || [];
        const brief: DailyBrief = {
          yesterdayTrades,
          yesterdayPnl,
          yesterdayWinRate,
          currentPositions: posData.length,
          floatingPnl: posData.reduce((sum: number, p: any) => sum + (p.floating_pnl || 0), 0),
          consecutiveLosses: overviewRes.data?.max_consecutive_losses || 0,
          consecutiveWins: overviewRes.data?.max_consecutive_wins || 0,
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
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 100 }}>
        <Spin size="large">加载中...</Spin>
      </div>
    );
  }

  const totalPnl = overview?.total_pnl ?? 0;
  const winRate = overview?.win_rate ?? 0;
  const profitLossRatio = overview?.profit_loss_ratio ?? 0;
  const totalTrades = overview?.total_trades ?? 0;

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
                  value={dailyBrief.yesterdayPnl}
                  precision={2}
                  valueStyle={{ color: dailyBrief.yesterdayPnl >= 0 ? '#52c41a' : '#ff4d4f' }}
                  prefix={dailyBrief.yesterdayPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  suffix="元"
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
                  浮动盈亏: <span style={{ color: dailyBrief.floatingPnl >= 0 ? '#52c41a' : '#ff4d4f' }}>
                    {dailyBrief.floatingPnl >= 0 ? '+' : ''}{dailyBrief.floatingPnl.toFixed(2)} 元
                  </span>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" hoverable>
                <Statistic
                  title="当前状态"
                  value={dailyBrief.consecutiveWins}
                  suffix="连盈"
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<TrophyOutlined />}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                  最大连亏: {dailyBrief.consecutiveLosses} 次
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
                {dailyBrief.topHoldings.map((p: any) => (
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
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" hoverable>
            <Statistic
              title="总盈亏"
              value={totalPnl.toFixed(2)}
              precision={2}
              valueStyle={{ color: totalPnl >= 0 ? '#52c41a' : '#ff4d4f' }}
              prefix={totalPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              suffix="元"
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
          <Card variant="borderless" hoverable>
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
        {pnlCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
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
        {monthlyStats.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis yAxisId="left" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" fontSize={12} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === '盈亏') return [value.toFixed(2) + ' 元', name];
                  if (name === '交易次数') return [value, name];
                  if (name === '胜率') return [(value * 100).toFixed(1) + '%', name];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="pnl"
                name="盈亏"
                fill="#1677ff"
                radius={[4, 4, 0, 0]}
              >
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
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无数据</div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
