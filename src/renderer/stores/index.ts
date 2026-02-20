import { create } from 'zustand';
import type { Trade, TradeFilter, TradeListResult, Settings, StatsOverview, Position, TradingGoal, GoalProgress, GoalPeriod } from '../../shared/types';

interface ThemeStore {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  isDarkMode: localStorage.getItem('theme') === 'dark',

  toggleDarkMode: () => {
    set((state) => {
      const newValue = !state.isDarkMode;
      localStorage.setItem('theme', newValue ? 'dark' : 'light');
      return { isDarkMode: newValue };
    });
  },

  setDarkMode: (isDark: boolean) => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    set({ isDarkMode: isDark });
  },
}));

interface TradeStore {
  trades: Trade[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  filter: TradeFilter;
  setFilter: (filter: Partial<TradeFilter>) => void;
  fetchTrades: () => Promise<void>;
  createTrade: (trade: any) => Promise<Trade | null>;
  updateTrade: (id: string, updates: Partial<Trade>) => Promise<Trade | null>;
  deleteTrade: (id: string) => Promise<void>;
}

export const useTradeStore = create<TradeStore>((set, get) => ({
  trades: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  filter: { page: 1, pageSize: 20, sortField: 'trade_date', sortOrder: 'desc' },

  setFilter: (filter) => {
    set(state => ({ filter: { ...state.filter, ...filter } }));
    get().fetchTrades();
  },

  fetchTrades: async () => {
    set({ loading: true });
    try {
      const result = await window.electronAPI.trade.list(get().filter);
      if (result.success && result.data) {
        const data = result.data as TradeListResult;
        set({ trades: data.trades, total: data.total, page: data.page, pageSize: data.pageSize });
      }
    } finally {
      set({ loading: false });
    }
  },

  createTrade: async (trade) => {
    const result = await window.electronAPI.trade.create(trade);
    if (result.success) {
      get().fetchTrades();
      return result.data as Trade;
    }
    return null;
  },

  deleteTrade: async (id) => {
    await window.electronAPI.trade.delete(id);
    get().fetchTrades();
  },

  updateTrade: async (id, updates) => {
    const result = await window.electronAPI.trade.update(id, updates);
    if (result.success) {
      get().fetchTrades();
      return result.data as Trade;
    }
    return null;
  },
}));

interface SettingsStore {
  settings: Settings | null;
  loading: boolean;
  fetchSettings: () => Promise<void>;
  saveSettings: (settings: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });
    try {
      const result = await window.electronAPI.settings.get();
      if (result.success) {
        set({ settings: result.data as Settings });
      }
    } finally {
      set({ loading: false });
    }
  },

  saveSettings: async (settings) => {
    await window.electronAPI.settings.save(settings);
    const result = await window.electronAPI.settings.get();
    if (result.success) {
      set({ settings: result.data as Settings });
    }
  },
}));

interface StatsStore {
  overview: StatsOverview | null;
  loading: boolean;
  fetchOverview: (startDate?: string, endDate?: string) => Promise<void>;
}

export const useStatsStore = create<StatsStore>((set) => ({
  overview: null,
  loading: false,

  fetchOverview: async (startDate, endDate) => {
    set({ loading: true });
    try {
      const result = await window.electronAPI.stats.overview(startDate, endDate);
      if (result.success) {
        set({ overview: result.data as StatsOverview });
      }
    } finally {
      set({ loading: false });
    }
  },
}));

interface PositionStore {
  positions: Position[];
  loading: boolean;
  fetchPositions: () => Promise<void>;
}

export const usePositionStore = create<PositionStore>((set) => ({
  positions: [],
  loading: false,

  fetchPositions: async () => {
    set({ loading: true });
    try {
      const result = await window.electronAPI.position.list();
      if (result.success) {
        set({ positions: result.data as Position[] });
      }
    } finally {
      set({ loading: false });
    }
  },
}));

interface GoalStore {
  goals: TradingGoal[];
  currentProgress: GoalProgress | null;
  loading: boolean;
  fetchGoals: (period?: GoalPeriod, year?: number) => Promise<void>;
  saveGoal: (goal: Partial<TradingGoal> & { period: GoalPeriod; year: number; month?: number }) => Promise<TradingGoal | null>;
  deleteGoal: (id: string) => Promise<void>;
  fetchCurrentProgress: () => Promise<void>;
}

export const useGoalStore = create<GoalStore>((set, get) => ({
  goals: [],
  currentProgress: null,
  loading: false,

  fetchGoals: async (period, year) => {
    set({ loading: true });
    try {
      const result = await window.electronAPI.goal.list(period, year);
      if (result.success) {
        set({ goals: result.data as TradingGoal[] });
      }
    } finally {
      set({ loading: false });
    }
  },

  saveGoal: async (goal) => {
    const result = await window.electronAPI.goal.save(goal);
    if (result.success) {
      get().fetchGoals();
      return result.data as TradingGoal;
    }
    return null;
  },

  deleteGoal: async (id) => {
    await window.electronAPI.goal.delete(id);
    get().fetchGoals();
  },

  fetchCurrentProgress: async () => {
    set({ loading: true });
    try {
      const result = await window.electronAPI.goal.progress();
      if (result.success) {
        set({ currentProgress: result.data as GoalProgress });
      } else {
        set({ currentProgress: null });
      }
    } finally {
      set({ loading: false });
    }
  },
}));
