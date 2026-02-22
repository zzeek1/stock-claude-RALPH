import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useCurrencyStore } from '../stores';
import Statistics, {
  alignLatestAssetCurveWithLiveMarketValue,
  CalendarHeatmap,
  buildAssetCurveDisplayData,
  buildDisplayDrawdownData,
  buildStrategyTrendPivot,
  buildStrategyWinRatePivot,
} from './Statistics';

const LABEL_HEADLINE_PNL = '\u603b\u76c8\u4e8f';
const LABEL_HEADLINE_RETURN = '\u6536\u76ca\u7387';
const LABEL_REALIZED_PNL = '\u5df2\u5b9e\u73b0\u76c8\u4e8f';
const LABEL_REALIZED_RETURN = '\u5df2\u5b9e\u73b0\u6536\u76ca\u7387';
const LABEL_TOTAL_TRADES = '\u603b\u4ea4\u6613\u6b21\u6570';
const LABEL_MAX_DRAWDOWN = '\u6700\u5927\u56de\u64a4';

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
      canonicalKpis: vi.fn().mockResolvedValue({ success: false, error: 'not-configured' }),
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

  it('uses total-account wording for headline metrics', async () => {
    render(<Statistics />);
    await screen.findByText(LABEL_HEADLINE_PNL);
    expect(screen.getByText(LABEL_HEADLINE_RETURN)).toBeInTheDocument();
    expect(screen.queryByText(LABEL_REALIZED_PNL)).not.toBeInTheDocument();
    expect(screen.queryByText(LABEL_REALIZED_RETURN)).not.toBeInTheDocument();
  });

  it('shows explicit degraded-state warning when canonical KPI request fails', async () => {
    render(<Statistics />);
    await screen.findByText('共享KPI降级模式');
    expect(screen.getByText(/原因：not-configured/)).toBeInTheDocument();
  });

  it('keeps drawdown chart max consistent with canonical headline max when canonical max is present', () => {
    const series = buildDisplayDrawdownData(
      [
        {
          date: '2026-02-18',
          total_assets: 120000,
          cash: 0,
          market_value: 120000,
          daily_pnl: 0,
          daily_return: 0,
          cumulative_return: 0,
        },
        {
          date: '2026-02-19',
          total_assets: 90000,
          cash: 0,
          market_value: 90000,
          daily_pnl: -30000,
          daily_return: -0.25,
          cumulative_return: -0.25,
        },
        {
          date: '2026-02-20',
          total_assets: 108000,
          cash: 0,
          market_value: 108000,
          daily_pnl: 18000,
          daily_return: 0.2,
          cumulative_return: -0.1,
        },
      ],
      [],
      0.4,
    );

    const chartMax = series.reduce((max, point) => Math.max(max, Number(point.drawdown || 0)), 0);
    expect(chartMax).toBeCloseTo(0.4, 6);
  });

  it('computes headline return from total pnl baseline instead of stale overview total_return', async () => {
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
            market: 'SH',
            realized_pnl: -10000,
            total_cost: 90000,
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

    await screen.findByText(LABEL_HEADLINE_RETURN);
    const headlineReturnText = statisticText(LABEL_HEADLINE_RETURN);
    expect(headlineReturnText).toContain('-15.0%');
    expect(headlineReturnText).not.toContain('321.0%');
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

    await screen.findAllByText(LABEL_MAX_DRAWDOWN);
    const maxDrawdownText = statisticText(LABEL_MAX_DRAWDOWN);
    expect(maxDrawdownText).toContain('25.0%');
  });

  it('builds self-consistent asset-curve rows for display so total equals cash plus market value', () => {
    const rows = buildAssetCurveDisplayData([
      {
        date: '2026-02-19',
        total_assets: 100000,
        cash: 40000,
        market_value: 60000,
        daily_pnl: 0,
        daily_return: 0,
        cumulative_return: 0,
      },
      {
        date: '2026-02-20',
        total_assets: 110000,
        cash: 30000,
        market_value: 85000,
        daily_pnl: 9999,
        daily_return: 0.99,
        cumulative_return: 9.99,
      },
    ]);

    expect(rows[0].total_assets).toBeCloseTo(100000, 6);
    expect(rows[1].total_assets).toBeCloseTo(115000, 6);
    expect(rows[1].daily_pnl).toBeCloseTo(15000, 6);
    expect(rows[1].daily_return).toBeCloseTo(0.15, 6);
    expect(rows[1].cumulative_return).toBeCloseTo(0.15, 6);
    rows.forEach((row) => {
      expect(row.total_assets).toBeCloseTo(row.cash + row.market_value, 6);
    });
  });

  it('aligns latest asset-curve market value with live positions value when requested', () => {
    const aligned = alignLatestAssetCurveWithLiveMarketValue(
      [
        {
          date: '2026-02-19',
          total_assets: 100000,
          cash: 40000,
          market_value: 60000,
          daily_pnl: 0,
          daily_return: 0,
          cumulative_return: 0,
        },
        {
          date: '2026-02-20',
          total_assets: 120000,
          cash: 20000,
          market_value: 100000,
          daily_pnl: 20000,
          daily_return: 0.2,
          cumulative_return: 0.2,
        },
      ],
      85000,
      true,
    );

    expect(aligned[0].market_value).toBeCloseTo(60000, 6);
    expect(aligned[1].market_value).toBeCloseTo(85000, 6);
    expect(aligned[1].total_assets).toBeCloseTo(105000, 6);
  });

  it('converts headline pnl to selected USD even when realized_pnl is numeric string', async () => {
    useCurrencyStore.setState({ displayCurrency: 'USD' });
    const api = (window as any).electronAPI;

    api.stats.overview.mockResolvedValueOnce({
      success: true,
      data: {
        total_pnl: 780,
        total_return: 0,
        win_rate: 1,
        profit_loss_ratio: 1,
        total_trades: 1,
        winning_trades: 1,
        losing_trades: 0,
        max_drawdown: 0,
        max_consecutive_wins: 1,
        max_consecutive_losses: 0,
        avg_holding_days: 1,
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
        trades: [
          createSellTrade({
            id: 'sell-hk-string-pnl',
            market: 'HK',
            realized_pnl: '780',
            amount: 10000,
            commission: 0,
            stamp_tax: 0,
            total_cost: 10000,
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 500,
      },
    });

    api.position.list.mockResolvedValueOnce({
      success: true,
      data: [],
    });

    render(<Statistics />);
    await screen.findByText(LABEL_HEADLINE_PNL);
    const headlinePnlText = statisticText(LABEL_HEADLINE_PNL);
    expect(headlinePnlText).toContain('100');
    expect(headlinePnlText).not.toContain('108');
  });

  it('uses overview total_trades for headline count instead of sell-only list count', async () => {
    const api = (window as any).electronAPI;

    api.trade.list.mockResolvedValueOnce({
      success: true,
      data: {
        trades: [
          createSellTrade({
            id: 'sell-only-1',
            realized_pnl: 100,
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 500,
      },
    });

    api.position.list.mockResolvedValueOnce({
      success: true,
      data: [],
    });

    render(<Statistics />);
    await screen.findByText(LABEL_TOTAL_TRADES);
    const totalTradesText = statisticText(LABEL_TOTAL_TRADES).replace(/\s+/g, '');
    expect(totalTradesText).toContain(`${LABEL_TOTAL_TRADES}10`);
  });

  it('prefers canonical KPI trade count over overview fallback', async () => {
    const api = (window as any).electronAPI;

    api.stats.canonicalKpis.mockResolvedValueOnce({
      success: true,
      data: {
        base_currency: 'CNY',
        realized_pnl: 1000,
        unrealized_pnl: 0,
        total_pnl: 1000,
        total_assets: 101000,
        total_return: 0.01,
        max_drawdown: 0.12,
        total_trades: 88,
        winning_trades: 50,
        losing_trades: 30,
        flat_trades: 8,
        win_rate: 0.625,
        avg_win: 120,
        avg_loss: -80,
        profit_loss_ratio: 1.5,
        expectancy: 45,
      },
    });

    render(<Statistics />);

    await screen.findByText(LABEL_TOTAL_TRADES);
    const totalTradesText = statisticText(LABEL_TOTAL_TRADES).replace(/\s+/g, '');
    expect(totalTradesText).toContain(`${LABEL_TOTAL_TRADES}88`);
  });

  it('converts risk-assessment monetary values from CNY to selected display currency', async () => {
    useCurrencyStore.setState({ displayCurrency: 'USD' });
    const api = (window as any).electronAPI;

    api.stats.riskAssessment.mockResolvedValueOnce({
      success: true,
      data: {
        exposure: {
          total_market_value: 720,
          total_exposure: 0.072,
          largest_position_pct: 0.03,
          market_exposure: [{ market: 'US', value: 720, percentage: 0.072 }],
          stock_exposure: [{ stock_code: 'AAPL', stock_name: 'Apple', value: 720, percentage: 0.072 }],
        },
        risk_reward: {
          current_risk_reward: 2,
          avg_historical_risk_reward: 1.8,
          positions_with_sl: 1,
          potential_upside: 144,
          potential_downside: 72,
        },
        max_potential_loss: {
          if_all_stop_loss: 72,
          if_all_stop_loss_pct: 0.0072,
          largest_single_loss: 72,
          loss_from_concentration: 0,
          cash_available: 10000,
          can_cover_loss: true,
        },
        overall_risk_level: 'low',
        risk_warnings: [],
      },
    });

    render(<Statistics />);
    await screen.findByText(LABEL_HEADLINE_PNL);

    const riskTab = screen.getAllByRole('tab').find((tab) => {
      const id = String(tab.getAttribute('id') || '');
      const controls = String(tab.getAttribute('aria-controls') || '');
      return id.includes('riskAssessment') || controls.includes('riskAssessment');
    });
    expect(riskTab).toBeTruthy();
    if (riskTab) {
      fireEvent.click(riskTab);
    }

    await screen.findByText('\u603b\u5e02\u503c');
    const totalMarketValueText = statisticText('\u603b\u5e02\u503c');
    const potentialUpsideText = statisticText('\u6f5c\u5728\u4e0a\u884c\u7a7a\u95f4');

    expect(totalMarketValueText).toContain('100');
    expect(totalMarketValueText).not.toContain('720');
    expect(potentialUpsideText).toContain('20');
    expect(potentialUpsideText).not.toContain('144');
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
