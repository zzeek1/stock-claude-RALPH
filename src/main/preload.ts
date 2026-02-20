import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { Trade, TradeFilter, ReviewType, Settings, AIStreamEvent, GoalPeriod, JournalEntry } from '../shared/types';

const api = {
  // 交易
  trade: {
    create: (trade: any) => ipcRenderer.invoke(IPC_CHANNELS.TRADE_CREATE, trade),
    update: (id: string, updates: any) => ipcRenderer.invoke(IPC_CHANNELS.TRADE_UPDATE, id, updates),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TRADE_DELETE, id),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TRADE_GET, id),
    list: (filter: TradeFilter) => ipcRenderer.invoke(IPC_CHANNELS.TRADE_LIST, filter),
    getRelated: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TRADE_GET_RELATED, id),
    exportCsv: (filter: TradeFilter) => ipcRenderer.invoke(IPC_CHANNELS.TRADE_EXPORT_CSV, filter),
    exportPdfReport: (reportType: 'summary' | 'trades' | 'monthly' | 'custom', startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPORT_PDF_REPORT, reportType, startDate, endDate),
  },

  // 持仓
  position: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.POSITION_LIST),
  },

  // 账户快照
  accountSnapshot: {
    saveSnapshot: (snapshot: any) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_SNAPSHOT_SAVE, snapshot),
    listSnapshots: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_SNAPSHOT_LIST, startDate, endDate),
    autoSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_SNAPSHOT_AUTO),
  },

  // 统计
  stats: {
    overview: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_OVERVIEW, startDate, endDate),
    pnlCurve: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_PNL_CURVE, startDate, endDate),
    strategy: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_STRATEGY, startDate, endDate),
    emotion: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_EMOTION, startDate, endDate),
    monthly: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_MONTHLY, startDate, endDate),
    calendar: (year: number) => ipcRenderer.invoke(IPC_CHANNELS.STATS_CALENDAR, year),
    drawdown: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_DRAWDOWN, startDate, endDate),
    pnlDistribution: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_PNL_DISTRIBUTION, startDate, endDate),
    planExecution: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_PLAN_EXECUTION, startDate, endDate),
    assetCurve: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_ASSET_CURVE, startDate, endDate),
    riskAssessment: () =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_RISK_ASSESSMENT),
    strategyTrend: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_STRATEGY_TREND, startDate, endDate),
    strategyWinRateTrend: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_STRATEGY_WIN_RATE_TREND, startDate, endDate),
    emotionHeatmap: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_EMOTION_HEATMAP, startDate, endDate),
  },

  // AI 复盘
  ai: {
    startReview: (type: ReviewType, startDate: string, endDate: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_REVIEW_START, type, startDate, endDate),
    onStream: (callback: (event: AIStreamEvent) => void) => {
      const handler = (_: any, data: AIStreamEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.AI_REVIEW_STREAM, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_REVIEW_STREAM, handler);
    },
    listReviews: () => ipcRenderer.invoke(IPC_CHANNELS.AI_REVIEW_LIST),
    getReview: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_REVIEW_GET, id),
    deleteReview: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_REVIEW_DELETE, id),
    toggleFavorite: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_REVIEW_TOGGLE_FAVORITE, id),
    updateNote: (id: string, note: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_REVIEW_UPDATE_NOTE, id, note),
    askConversation: (reviewId: string, question: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_CONVERSATION_ASK, reviewId, question),
    getConversations: (reviewId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_CONVERSATION_GET, reviewId),
  },

  // 设置
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    save: (settings: Partial<Settings>) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
    saveApiKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE_API_KEY, key),
    getApiKey: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_API_KEY),
    testOllama: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_TEST_OLLAMA),
  },

  // 股票搜索
  stock: {
    search: (keyword: string) => ipcRenderer.invoke(IPC_CHANNELS.STOCK_SEARCH, keyword),
    importCsv: (csvContent: string) => ipcRenderer.invoke(IPC_CHANNELS.STOCK_IMPORT_CSV, csvContent),
  },

  // 实时行情
  quote: {
    get: (symbols: string[]) => ipcRenderer.invoke(IPC_CHANNELS.QUOTE_GET, symbols),
  },

  // 备份
  backup: {
    export: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_EXPORT),
    import: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_IMPORT),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_LIST),
    exportEncrypted: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_EXPORT_ENCRYPTED),
    importEncrypted: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_IMPORT_ENCRYPTED),
    cloudSync: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CLOUD_SYNC, config),
  },

  // 快捷键
  shortcut: {
    onNewTrade: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC_CHANNELS.SHORTCUT_NEW_TRADE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_NEW_TRADE, handler);
    },
    onSave: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC_CHANNELS.SHORTCUT_SAVE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_SAVE, handler);
    },
    onRefresh: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC_CHANNELS.SHORTCUT_REFRESH, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_REFRESH, handler);
    },
    onEdit: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC_CHANNELS.SHORTCUT_EDIT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_EDIT, handler);
    },
    onEscape: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC_CHANNELS.SHORTCUT_ESCAPE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_ESCAPE, handler);
    },
  },

  // 数据导入
  import: {
    preview: (content: string) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_PREVIEW, content),
    trades: (content: string, fieldMapping: any, defaultValues?: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.IMPORT_TRADES, content, fieldMapping, defaultValues),
    logs: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_LOGS),
  },

  // 交易目标
  goal: {
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.GOAL_GET, id),
    list: (period?: GoalPeriod, year?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.GOAL_LIST, period, year),
    save: (goal: any) => ipcRenderer.invoke(IPC_CHANNELS.GOAL_SAVE, goal),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.GOAL_DELETE, id),
    progress: (id?: string) => ipcRenderer.invoke(IPC_CHANNELS.GOAL_PROGRESS, id),
  },

  // 每日简报
  briefing: {
    generate: () => ipcRenderer.invoke(IPC_CHANNELS.BRIEFING_GENERATE),
    getToday: () => ipcRenderer.invoke(IPC_CHANNELS.BRIEFING_GET_TODAY),
    getRecent: (days?: number) => ipcRenderer.invoke(IPC_CHANNELS.BRIEFING_GET_RECENT, days),
  },

  // 交易日记
  journal: {
    save: (journal: Partial<JournalEntry> & { date: string; title: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOURNAL_SAVE, journal),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.JOURNAL_GET, id),
    getByDate: (date: string) => ipcRenderer.invoke(IPC_CHANNELS.JOURNAL_GET_BY_DATE, date),
    getByDateRange: (startDate: string, endDate: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOURNAL_GET_BY_DATE_RANGE, startDate, endDate),
    list: (options?: { page?: number; pageSize?: number; keyword?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.JOURNAL_LIST, options),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.JOURNAL_DELETE, id),
  },

  // 账户管理
  accountMgmt: {
    create: (account: any) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_CREATE, account),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_LIST),
    setActive: (accountId: string) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_SET_ACTIVE, accountId),
    delete: (accountId: string) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_DELETE, accountId),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
