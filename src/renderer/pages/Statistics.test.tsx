import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useCurrencyStore } from '../stores';
import Statistics, {
  CalendarHeatmap,
  buildStrategyTrendPivot,
  buildStrategyWinRatePivot,
} from './Statistics';

function createSellTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sell-1',
    stock_code: 'TEST',
    stock_name: 'Test',
    market: 'SH',
    direction: 'SELL',
    trade_date: '2026-02-20',
    price: 10,
    quantity: 100,
    amount: 1000,
    commission: 0,
    stamp_tax: 0,
    total_cost: 1000,
    created_at: '2026-02-20T00:00:00Z',
    updated_at: '2026-02-20T00:00:00Z',
    realized_pnl: 0,
    ...overrides,
  };
}

function mockElectronAPIForStatistics() {
  const api = {
    stats: {
      overview: vi.fn().mockResolvedValue({
        success: true,
        data: {
          total_pnl: 1000,
          total_return: 0.1,
          win_rate: 0.6,
          profit_loss_ratio: 1.8,
          total_trades: 10,
          winning_trades: 6,
          losing_trades: 4,
          max_drawdown: 0.12,
          max_consecutive_wins: 3,
          max_consecutive_losses: 2,
          avg_holding_days: 5,
          impulsive_trade_count: 1,
          impulsive_trade_win_rate: 0.5,
          stop_loss_execution_rate: 0.8,
          expectancy: 100,
          avg_win: 300,
          avg_loss: -120,
        },
      }),
      pnlCurve: vi.fn().mockResolvedValue({
        success: true,
        data: [{ date: '2026-02-20', cumulative_pnl: 1000, daily_pnl: 100 }],
      }),
      pnlDistribution: vi.fn().mockResolvedValue({
        success: true,
        data: [{ range: '0~100', count: 2, rangeStart: 0, rangeEnd: 100 }],
      }),
      strategy: vi.fn().mockResolvedValue({ success: true, data: [] }),
      emotion: vi.fn().mockResolvedValue({ success: true, data: [] }),
      monthly: vi.fn().mockResolvedValue({ success: true, data: [] }),
      drawdown: vi.fn().mockResolvedValue({ success: true, data: [] }),
      calendar: vi.fn().mockResolvedValue({ success: true, data: [] }),
      planExecution: vi.fn().mockResolvedValue({ success: true, data: null }),
      assetCurve: vi.fn().mockResolvedValue({ success: true, data: [] }),
      riskAssessment: vi.fn().mockResolvedValue({ success: false, error: 'no-risk' }),
      strategyTrend: vi.fn().mockResolvedValue({ success: true, data: [] }),
      strategyWinRateTrend: vi.fn().mockResolvedValue({ success: true, data: [] }),
      emotionHeatmap: vi.fn().mockResolvedValue({ success: true, data: [] }),
    },
    trade: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: { trades: [], total: 0, page: 1, pageSize: 500 },
      }),
      exportPdfReport: vi.fn().mockResolvedValue({ success: true, data: 'report.pdf' }),
    },
    position: {
      list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    },
    settings: {
      get: vi.fn().mockResolvedValue({
        success: true,
        data: { initial_capital: 100000 },
      }),
    },
    quote: {
      getFxRates: vi.fn().mockResolvedValue({
        success: true,
        data: { USD: 1, HKD: 7.8, CNY: 7.2, timestamp: '2026-02-21T00:00:00Z' },
      }),
    },
  };

  (window as any).electronAPI = api;
  return api;
}

function statisticText(title: string): string {
  const candidates = screen.getAllByText(title);
  const titleNode = candidates.find((node) => node.classList.contains('ant-statistic-title')) || candidates[0];
  const statRoot = titleNode.closest('.ant-statistic');
  return statRoot?.textContent || '';
}

describe('Statistics regressions', () => {
  beforeEach(() => {
    localStorage.clear();
    useCurrencyStore.setState({ displayCurrency: 'USD' });
    mockElectronAPIForStatistics();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses total wording for headline metrics', async () => {
    render(<Statistics />);
    await screen.findByText('总盈亏');
    expect(screen.getByText('总收益率')).toBeInTheDocument();
    expect(screen.queryByText('已实现盈亏')).not.toBeInTheDocument();
    expect(screen.queryByText('已实现收益率')).not.toBeInTheDocument();
  });

  it('computes total return from total assets baseline instead of stale overview total_return', async () => {
    useCurrencyStore.setState({ displayCurrency: 'CNY' });
    const api = (window as any).electronAPI;

    api.stats.overview.mockResolvedValueOnce({
      success: true,
      data: {
        total_pnl: -999999,
        total_return: 3.21,
        win_rate: 0.6,
        profit_loss_ratio: 1.8,
        total_trades: 10,
        winning_trades: 6,
        losing_trades: 4,
        max_drawdown: 0.12,
        max_consecutive_wins: 3,
        max_consecutive_losses: 2,
        avg_holding_days: 5,
        impulsive_trade_count: 1,
        impulsive_trade_win_rate: 0.5,
        stop_loss_execution_rate: 0.8,
        expectancy: 100,
        avg_win: 300,
        avg_loss: -120,
      },
    });

    api.trade.list.mockResolvedValueOnce({
      success: true,
      data: {
        trades: [
          createSellTrade({
            id: 'sell-cny-1',
            trade_date: '2026-02-20',
            realized_pnl: -10000,
            total_cost: 100000,
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 500,
      },
    });

    api.position.list.mockResolvedValueOnce({
      success: true,
      data: [{ market: 'SH', floating_pnl: -5000 }],
    });

    api.stats.assetCurve.mockResolvedValueOnce({
      success: true,
      data: [
        {
          date: '2026-02-19',
          total_assets: 100000,
          cash: 50000,
          market_value: 50000,
          daily_pnl: 0,
          daily_return: 0,
          cumulative_return: 0,
        },
        {
          date: '2026-02-20',
          total_assets: 85000,
          cash: 35000,
          market_value: 50000,
          daily_pnl: -15000,
          daily_return: -0.15,
          cumulative_return: -0.15,
        },
      ],
    });

    render(<Statistics />);

    await screen.findByText('总收益率');
    const totalReturnText = statisticText('总收益率');
    expect(totalReturnText).toContain('-15.0%');
    expect(totalReturnText).not.toContain('321.0%');
  });

  it('derives max drawdown from asset curve instead of stale overview max_drawdown', async () => {
    useCurrencyStore.setState({ displayCurrency: 'CNY' });
    const api = (window as any).electronAPI;

    api.stats.overview.mockResolvedValueOnce({
      success: true,
      data: {
        total_pnl: 0,
        total_return: 0,
        win_rate: 0.5,
        profit_loss_ratio: 1,
        total_trades: 1,
        winning_trades: 1,
        losing_trades: 0,
        max_drawdown: 0.01,
        max_consecutive_wins: 1,
        max_consecutive_losses: 0,
        avg_holding_days: 2,
        impulsive_trade_count: 0,
        impulsive_trade_win_rate: 0,
        stop_loss_execution_rate: 1,
        expectancy: 0,
        avg_win: 0,
        avg_loss: 0,
      },
    });

    api.trade.list.mockResolvedValueOnce({
      success: true,
      data: {
        trades: [createSellTrade({ id: 'sell-cny-2', realized_pnl: 10000, total_cost: 100000 })],
        total: 1,
        page: 1,
        pageSize: 500,
      },
    });

    api.position.list.mockResolvedValueOnce({
      success: true,
      data: [],
    });

    api.stats.assetCurve.mockResolvedValueOnce({
      success: true,
      data: [
        { date: '2026-02-17', total_assets: 100000, cash: 40000, market_value: 60000, daily_pnl: 0, daily_return: 0, cumulative_return: 0 },
        { date: '2026-02-18', total_assets: 120000, cash: 50000, market_value: 70000, daily_pnl: 20000, daily_return: 0.2, cumulative_return: 0.2 },
        { date: '2026-02-19', total_assets: 90000, cash: 30000, market_value: 60000, daily_pnl: -30000, daily_return: -0.25, cumulative_return: -0.1 },
        { date: '2026-02-20', total_assets: 110000, cash: 45000, market_value: 65000, daily_pnl: 20000, daily_return: 0.2222, cumulative_return: 0.1 },
      ],
    });

    render(<Statistics />);

    await screen.findAllByText('最大回撤');
    const maxDrawdownText = statisticText('最大回撤');
    expect(maxDrawdownText).toContain('25.0%');
  });

  it('calendar heatmap uses selected year grid for title mapping', () => {
    render(
      <CalendarHeatmap
        year={2025}
        data={[{ date: '2025-02-20', pnl: 120, trade_count: 1 }]}
      />,
    );

    expect(document.querySelector('div[title^="2025-02-20"]')).toBeTruthy();
    expect(document.querySelector('div[title^="2026-02-20"]')).toBeFalsy();
  });

  it('builds strategy trend pivot rows by period and strategy', () => {
    const { rows, strategies } = buildStrategyTrendPivot([
      { strategy: 'Breakout', period: '2026-01', total_pnl: 800, win_rate: 0.6, trade_count: 4, avg_pnl: 200, winning_trades: 3, losing_trades: 1 },
      { strategy: 'MeanReversion', period: '2026-01', total_pnl: 300, win_rate: 0.5, trade_count: 2, avg_pnl: 150, winning_trades: 1, losing_trades: 1 },
      { strategy: 'Breakout', period: '2026-02', total_pnl: 1000, win_rate: 0.6, trade_count: 5, avg_pnl: 200, winning_trades: 3, losing_trades: 2 },
    ]);

    expect(strategies).toEqual(['Breakout', 'MeanReversion']);
    expect(rows).toEqual([
      { period: '2026-01', Breakout: 800, MeanReversion: 300 },
      { period: '2026-02', Breakout: 1000 },
    ]);
  });

  it('builds strategy win-rate pivot rows by period and strategy', () => {
    const { rows, strategies } = buildStrategyWinRatePivot([
      { strategy: 'Breakout', period: '2026-01', win_rate: 0.6, trade_count: 4 },
      { strategy: 'MeanReversion', period: '2026-01', win_rate: 0.5, trade_count: 2 },
      { strategy: 'Breakout', period: '2026-02', win_rate: 0.7, trade_count: 5 },
    ]);

    expect(strategies).toEqual(['Breakout', 'MeanReversion']);
    expect(rows).toEqual([
      { period: '2026-01', Breakout: 0.6, MeanReversion: 0.5 },
      { period: '2026-02', Breakout: 0.7 },
    ]);
  });
});
