import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryAllMock,
  queryOneMock,
  getQuotesMock,
  getFxRatesMock,
} = vi.hoisted(() => ({
  queryAllMock: vi.fn(),
  queryOneMock: vi.fn(),
  getQuotesMock: vi.fn(),
  getFxRatesMock: vi.fn(),
}));

vi.mock('../main/database/connection', () => ({
  queryAll: queryAllMock,
  queryOne: queryOneMock,
}));

vi.mock('../main/services/quote-service', () => ({
  getQuotes: getQuotesMock,
  getFxRates: getFxRatesMock,
}));

import { getRiskAssessment } from '../main/services/stats-service';

describe('stats-service risk assessment currency normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes cross-market position values to CNY before aggregation', async () => {
    getFxRatesMock.mockResolvedValue({
      USD: 1,
      HKD: 7.8,
      CNY: 7.2,
      timestamp: '2026-02-22T00:00:00.000Z',
    });

    getQuotesMock.mockResolvedValue([
      { symbol: '0005.HK', lastDone: '12', timestamp: new Date('2026-02-22T00:00:00.000Z') },
      { symbol: 'AAPL.US', lastDone: '60', timestamp: new Date('2026-02-22T00:00:00.000Z') },
    ]);

    queryAllMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM trades') && sql.includes('stock_code') && sql.includes('total_cost')) {
        return [
          {
            stock_code: '0005',
            stock_name: 'HSBC',
            market: 'HK',
            direction: 'BUY',
            trade_date: '2026-02-20',
            quantity: 100,
            total_cost: 1000,
            stop_loss: 8,
            take_profit: 15,
          },
          {
            stock_code: 'AAPL',
            stock_name: 'Apple',
            market: 'US',
            direction: 'BUY',
            trade_date: '2026-02-20',
            quantity: 2,
            total_cost: 100,
            stop_loss: 45,
            take_profit: 70,
          },
        ];
      }

      return [];
    });

    queryOneMock.mockImplementation((sql: string) => {
      if (sql.includes("SELECT value FROM settings WHERE key = 'initial_capital'")) {
        return { value: '100000' };
      }

      if (sql.includes('SELECT cash FROM account_snapshots ORDER BY date DESC LIMIT 1')) {
        return { cash: 10000 };
      }

      if (sql.includes('COALESCE(SUM(CASE WHEN direction = \'BUY\'')) {
        return { total_buy_cost: 0, total_sell_amount: 0 };
      }

      return null;
    });

    const assessment = await getRiskAssessment();

    const expectedHkValueCny = 1200 * (7.2 / 7.8);
    const expectedUsValueCny = 120 * (7.2 / 1);
    const expectedMarketValueCny = expectedHkValueCny + expectedUsValueCny;
    const expectedTotalAssetsCny = 10000 + expectedMarketValueCny;
    const expectedDownsideCny = (200 * (7.2 / 7.8)) + (10 * 7.2);
    const expectedUpsideCny = (500 * (7.2 / 7.8)) + (40 * 7.2);

    expect(assessment.exposure.total_market_value).toBeCloseTo(expectedMarketValueCny, 6);
    expect(assessment.exposure.total_exposure).toBeCloseTo(expectedMarketValueCny / expectedTotalAssetsCny, 6);
    expect(assessment.exposure.market_exposure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ market: 'HK', value: expect.closeTo(expectedHkValueCny, 6) }),
        expect.objectContaining({ market: 'US', value: expect.closeTo(expectedUsValueCny, 6) }),
      ]),
    );
    expect(assessment.risk_reward.potential_downside).toBeCloseTo(expectedDownsideCny, 6);
    expect(assessment.risk_reward.potential_upside).toBeCloseTo(expectedUpsideCny, 6);
  });
});
