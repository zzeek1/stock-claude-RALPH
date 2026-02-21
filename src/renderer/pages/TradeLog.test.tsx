import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import TradeLog from '../pages/TradeLog';

// Mock the electron API
vi.mock('../../utils/electron', () => ({
  electronAPI: {
    trade: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: {
          trades: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
      }),
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      getRelated: vi.fn(),
      exportCsv: vi.fn(),
    },
    settings: {
      get: vi.fn().mockResolvedValue({
        success: true,
        data: {
          initial_capital: 100000,
          default_commission_rate: 0.00025,
          default_stamp_tax_rate: 0.0005,
          custom_strategies: ['趋势跟踪', '价值投资', '波段操作'],
          custom_tags: [],
        },
      }),
    },
  },
}));

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    shortcut: {
      onEdit: vi.fn(() => vi.fn()),
      onNewTrade: vi.fn(() => vi.fn()),
      onSave: vi.fn(() => vi.fn()),
      onRefresh: vi.fn(() => vi.fn()),
      onEscape: vi.fn(() => vi.fn()),
    },
    trade: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: {
          trades: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
      }),
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      getRelated: vi.fn(),
      exportCsv: vi.fn(),
    },
    settings: {
      get: vi.fn().mockResolvedValue({
        success: true,
        data: {
          initial_capital: 100000,
          default_commission_rate: 0.00025,
          default_stamp_tax_rate: 0.0005,
          custom_strategies: ['趋势跟踪', '价值投资', '波段操作'],
          custom_tags: [],
        },
      }),
    },
  },
  writable: true,
});

describe('TradeLog', () => {
  it('should render trade log page', () => {
    render(
      <ConfigProvider locale={zhCN}>
        <BrowserRouter>
          <TradeLog />
        </BrowserRouter>
      </ConfigProvider>
    );

    // Check that the page renders - use querySelector for table header
    const table = document.querySelector('.ant-table');
    expect(table).toBeInTheDocument();
  });
});
