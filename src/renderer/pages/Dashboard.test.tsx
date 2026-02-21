import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dashboard, { normalizeAssetCurveData } from './Dashboard';
import { useCurrencyStore } from '../stores';

const STORAGE_KEY = 'app.displayCurrency';
const mockOverview = {
  total_pnl: 999,
  total_return: 0.1,
  win_rate: 0.5,
  profit_loss_ratio: 1.2,
  total_trades: 10,
  winning_trades: 5,
  losing_trades: 5,
  max_drawdown: 0.1,
  max_consecutive_wins: 3,
  max_consecutive_losses: 2,
  current_consecutive_wins: 0,
  current_consecutive_losses: 1,
  avg_holding_days: 5,
  impulsive_trade_count: 1,
  impulsive_trade_win_rate: 0,
  stop_loss_execution_rate: 0.4,
  expectancy: 10,
  avg_win: 100,
  avg_loss: -80,
};

const mockPositions = [
  {
    stock_code: 'AAPL',
    stock_name: 'Apple',
    market: 'US',
    quantity: 1,
    avg_cost: 100,
    total_cost: 100,
    current_price: 120,
    current_value: 120,
    floating_pnl: 20,
    floating_pnl_ratio: 0.2,
    first_buy_date: '2026-01-01',
    last_trade_date: '2026-02-20',
    holding_days: 10,
  },
];

const mockSellTrades = [
  {
    id: '1',
    stock_code: 'AAPL',
    stock_name: 'Apple',
    market: 'US',
    direction: 'SELL',
    trade_date: '2026-02-20',
    price: 120,
    quantity: 1,
    amount: 120,
    commission: 0,
    stamp_tax: 0,
    total_cost: 120,
    realized_pnl: 100,
    created_at: '2026-02-20T10:00:00.000Z',
    updated_at: '2026-02-20T10:00:00.000Z',
  },
  {
    id: '2',
    stock_code: '0700',
    stock_name: '腾讯',
    market: 'HK',
    direction: 'SELL',
    trade_date: '2026-02-20',
    price: 400,
    quantity: 1,
    amount: 400,
    commission: 0,
    stamp_tax: 0,
    total_cost: 400,
    realized_pnl: 78,
    created_at: '2026-02-20T11:00:00.000Z',
    updated_at: '2026-02-20T11:00:00.000Z',
  },
];

function mockElectronAPI(): void {
  (window as any).electronAPI = {
    stats: {
      overview: vi.fn().mockResolvedValue({ success: true, data: mockOverview }),
      pnlCurve: vi.fn().mockResolvedValue({
        success: true,
        data: [{ date: '2026-02-20', daily_pnl: 999, cumulative_pnl: 999 }],
      }),
      assetCurve: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            date: '2026-02-20',
            total_assets: 100130,
            cash: 60000,
            market_value: 40130,
            daily_pnl: 130,
            daily_return: 0.0013,
            cumulative_return: 0.0013,
          },
        ],
      }),
      monthly: vi.fn().mockResolvedValue({
        success: true,
        data: [{ month: '2026-02', pnl: 999, trade_count: 2, win_rate: 1 }],
      }),
    },
    position: {
      list: vi.fn().mockResolvedValue({ success: true, data: mockPositions }),
    },
    goal: {
      progress: vi.fn().mockResolvedValue({ success: false, error: 'no-goal' }),
    },
    settings: {
      get: vi.fn().mockResolvedValue({
        success: true,
        data: {
          initial_capital: 100000,
        },
      }),
    },
    quote: {
      getFxRates: vi.fn().mockResolvedValue({
        success: true,
        data: {
          USD: 1,
          HKD: 7.8,
          CNY: 7.2,
          timestamp: '2026-02-21T00:00:00.000Z',
        },
      }),
    },
    trade: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: {
          trades: mockSellTrades,
          total: mockSellTrades.length,
          page: 1,
          pageSize: 500,
        },
      }),
    },
  };
}

describe('Dashboard currency controls', () => {
  beforeEach(() => {
    mockElectronAPI();
    localStorage.clear();
    useCurrencyStore.setState({ displayCurrency: 'USD' });
  });

  afterEach(() => {
    cleanup();
  });

  it('uses global USD currency preference by default', async () => {
    render(<Dashboard />);

    await screen.findByText('总盈亏');
    const totalPnlCard = screen.getByText('总盈亏').closest('.ant-card');

    expect(screen.queryByText('货币口径')).not.toBeInTheDocument();
    expect(totalPnlCard).toBeInTheDocument();
    await waitFor(() => {
      expect(totalPnlCard).toHaveTextContent('$');
    });
  });

  it('reacts to shared currency preference updates and persists selection', async () => {
    render(<Dashboard />);

    await screen.findByText('总盈亏');
    const totalPnlCard = screen.getByText('总盈亏').closest('.ant-card');
    expect(totalPnlCard).toBeInTheDocument();
    const beforeText = totalPnlCard?.textContent || '';
    await waitFor(() => {
      expect(totalPnlCard).toHaveTextContent('$');
    });

    act(() => {
      useCurrencyStore.getState().setDisplayCurrency('CNY');
    });

    await waitFor(() => {
      expect(totalPnlCard).toHaveTextContent('¥');
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('CNY');
    expect(totalPnlCard?.textContent || '').not.toBe(beforeText);
  });

  it('opens details modal when clicking profit-loss ratio card', async () => {
    render(<Dashboard />);

    const ratioTitle = await screen.findByText('盈亏比');
    const ratioCard = ratioTitle.closest('.ant-card');
    expect(ratioCard).toBeInTheDocument();

    fireEvent.click(ratioCard!);
    await screen.findByText('盈亏比详情');
  });

  it('shows total assets metric', async () => {
    render(<Dashboard />);
    await screen.findByText('总资产');
  });

  it('normalizes asset curve endpoints to baseline and current totals', () => {
    const curve = [
      { date: '2025-07-07', total_assets: 154675, daily_pnl: 0, cumulative_return_pct: 0 },
      { date: '2025-07-08', total_assets: 160000, daily_pnl: 5325, cumulative_return_pct: 0 },
      { date: '2025-07-09', total_assets: 237834, daily_pnl: 77834, cumulative_return_pct: 0 },
    ];

    const normalized = normalizeAssetCurveData(curve, 338761, 237834);

    expect(Math.round(normalized[0].total_assets)).toBe(338761);
    expect(Math.round(normalized[normalized.length - 1].total_assets)).toBe(237834);
    expect(Math.round(normalized[0].daily_pnl)).toBe(0);
    expect(normalized[0].cumulative_return_pct).toBe(0);
  });

  it('uses non-negative total assets fallback and integer money display when asset snapshot is invalid', async () => {
    const api = (window as any).electronAPI;
    api.stats.assetCurve.mockResolvedValueOnce({
      success: true,
      data: [
        {
          date: '2026-02-20',
          total_assets: -100,
          cash: 0,
          market_value: 0,
          daily_pnl: -10,
          daily_return: -0.01,
          cumulative_return: -0.01,
        },
      ],
    });

    render(<Dashboard />);

    const totalAssetsTitle = await screen.findByText('总资产');
    const totalAssetsCard = totalAssetsTitle.closest('.ant-card');
    expect(totalAssetsCard).toBeInTheDocument();

    await waitFor(() => {
      const text = totalAssetsCard?.textContent || '';
      expect(text).not.toContain('-');
      expect(text).toContain('$');
      expect(text).not.toContain('.');
      const matchedNumber = text.replace(/,/g, '').match(/\d+/);
      expect(matchedNumber).toBeTruthy();
      expect(Number(matchedNumber?.[0] || 0)).toBeGreaterThan(0);
    });

    const totalPnlCard = screen.getByText('总盈亏').closest('.ant-card');
    expect(totalPnlCard).toBeInTheDocument();
    expect(totalPnlCard?.textContent || '').not.toContain('.');
  });

  it('derives total assets from cash and market value when snapshot total_assets is zero', async () => {
    const api = (window as any).electronAPI;
    api.stats.assetCurve.mockResolvedValueOnce({
      success: true,
      data: [
        {
          date: '2026-02-20',
          total_assets: 0,
          cash: 72000,
          market_value: 28800,
          daily_pnl: 100,
          daily_return: 0.001,
          cumulative_return: 0.001,
        },
      ],
    });

    render(<Dashboard />);

    const totalAssetsTitle = await screen.findByText('总资产');
    const totalAssetsCard = totalAssetsTitle.closest('.ant-card');
    expect(totalAssetsCard).toBeInTheDocument();

    await waitFor(() => {
      const text = totalAssetsCard?.textContent || '';
      const matchedNumber = text.replace(/,/g, '').match(/\d+/);
      expect(matchedNumber).toBeTruthy();
      expect(Number(matchedNumber?.[0] || 0)).toBeGreaterThan(0);
      expect(text).toContain('$');
      expect(text).not.toContain('.');
    });
  });
});
