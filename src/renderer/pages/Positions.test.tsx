import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Positions from './Positions';
import { useCurrencyStore } from '../stores';

const mockPositions = [
  {
    stock_code: '0005',
    stock_name: 'HSBC',
    market: 'HK',
    quantity: 10,
    avg_cost: 10,
    total_cost: 100,
    current_price: 11,
    current_value: 110,
    floating_pnl: 10,
    floating_pnl_ratio: 0.1,
    first_buy_date: '2026-01-01',
    last_trade_date: '2026-02-20',
    holding_days: 30,
  },
  {
    stock_code: 'AAPL',
    stock_name: 'Apple',
    market: 'US',
    quantity: 5,
    avg_cost: 20,
    total_cost: 100,
    current_price: 22,
    current_value: 110,
    floating_pnl: 10,
    floating_pnl_ratio: 0.1,
    first_buy_date: '2026-01-01',
    last_trade_date: '2026-02-20',
    holding_days: 30,
  },
];

describe('Positions currency display', () => {
  beforeEach(() => {
    localStorage.clear();
    useCurrencyStore.setState({ displayCurrency: 'CNY' });

    (window as any).electronAPI = {
      position: {
        list: vi.fn().mockResolvedValue({ success: true, data: mockPositions }),
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
          data: { trades: [], total: 0, page: 1, pageSize: 1000 },
        }),
      },
    };
  });

  it('uses market currency for avg cost and current price columns', async () => {
    render(<Positions />);

    await waitFor(() => {
      expect(screen.getByText('0005')).toBeInTheDocument();
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    expect(screen.getAllByText('平均成本').length).toBeGreaterThan(0);
    expect(screen.getAllByText('当前价格').length).toBeGreaterThan(0);

    expect(screen.getByText('10.000 HKD')).toBeInTheDocument();
    expect(screen.getByText('11.000 HKD')).toBeInTheDocument();
    expect(screen.getByText('20.000 USD')).toBeInTheDocument();
    expect(screen.getByText('22.000 USD')).toBeInTheDocument();
  });
});
