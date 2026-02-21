import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia for Ant Design
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for Recharts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

// Mock getComputedStyle for jsdom
const originalGetComputedStyle = window.getComputedStyle;
vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
  return originalGetComputedStyle(el);
});

// Mock electronAPI
(window as any).electronAPI = {
  shortcut: {
    onEdit: vi.fn(() => vi.fn()),
    onNewTrade: vi.fn(() => vi.fn()),
    onSave: vi.fn(() => vi.fn()),
    onRefresh: vi.fn(() => vi.fn()),
    onEscape: vi.fn(() => vi.fn()),
  },
  trade: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  settings: {
    get: vi.fn().mockResolvedValue({}),
  },
  stock: {
    search: vi.fn().mockResolvedValue([]),
  },
  accountMgmt: {
    list: vi.fn().mockResolvedValue([]),
  }
};
