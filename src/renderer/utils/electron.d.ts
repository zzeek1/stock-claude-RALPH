import type { Trade, TradeFilter, TradeListResult, ReviewType, Settings, AIStreamEvent, StatsOverview, PnlDataPoint, StrategyStats, EmotionWinRate, MonthlyStats, CalendarHeatmapData, DrawdownData, PnlDistribution, Position, AccountSnapshot, StockCode, IpcResponse, TradingGoal, GoalProgress, GoalPeriod, PlanExecutionStats, DailyBriefing, BackupInfo, AssetCurveData, RiskAssessment, JournalEntry, StrategyTrendData, StrategyWinRateTrend, EmotionHeatmapData, AIConversationMessage, CloudBackupConfig, TradingAccount } from '../../shared/types';

interface ElectronAPI {
  trade: {
    create: (trade: any) => Promise<IpcResponse<Trade>>;
    update: (id: string, updates: any) => Promise<IpcResponse<Trade>>;
    delete: (id: string) => Promise<IpcResponse<boolean>>;
    get: (id: string) => Promise<IpcResponse<Trade>>;
    list: (filter: TradeFilter) => Promise<IpcResponse<TradeListResult>>;
    getRelated: (id: string) => Promise<IpcResponse<Trade[]>>;
    exportCsv: (filter: TradeFilter) => Promise<IpcResponse<string>>;
    exportPdfReport: (reportType: 'summary' | 'trades' | 'monthly' | 'custom', startDate?: string, endDate?: string) => Promise<IpcResponse<string>>;
  };
  position: {
    list: () => Promise<IpcResponse<Position[]>>;
  };
  accountSnapshot: {
    saveSnapshot: (snapshot: any) => Promise<IpcResponse<AccountSnapshot>>;
    listSnapshots: (startDate?: string, endDate?: string) => Promise<IpcResponse<AccountSnapshot[]>>;
    autoSnapshot: () => Promise<IpcResponse<AccountSnapshot>>;
  };
  accountMgmt: {
    create: (account: Omit<TradingAccount, 'id' | 'created_at' | 'is_active'>) => Promise<IpcResponse<TradingAccount>>;
    list: () => Promise<IpcResponse<TradingAccount[]>>;
    setActive: (accountId: string) => Promise<IpcResponse<void>>;
    delete: (accountId: string) => Promise<IpcResponse<void>>;
  };
  stats: {
    overview: (startDate?: string, endDate?: string) => Promise<IpcResponse<StatsOverview>>;
    pnlCurve: (startDate?: string, endDate?: string) => Promise<IpcResponse<PnlDataPoint[]>>;
    strategy: (startDate?: string, endDate?: string) => Promise<IpcResponse<StrategyStats[]>>;
    emotion: (startDate?: string, endDate?: string) => Promise<IpcResponse<EmotionWinRate[]>>;
    monthly: (startDate?: string, endDate?: string) => Promise<IpcResponse<MonthlyStats[]>>;
    calendar: (year: number) => Promise<IpcResponse<CalendarHeatmapData[]>>;
    drawdown: (startDate?: string, endDate?: string) => Promise<IpcResponse<DrawdownData[]>>;
    pnlDistribution: (startDate?: string, endDate?: string) => Promise<IpcResponse<PnlDistribution[]>>;
    planExecution: (startDate?: string, endDate?: string) => Promise<IpcResponse<PlanExecutionStats>>;
    assetCurve: (startDate?: string, endDate?: string) => Promise<IpcResponse<AssetCurveData[]>>;
    riskAssessment: () => Promise<IpcResponse<RiskAssessment>>;
    strategyTrend: (startDate?: string, endDate?: string) => Promise<IpcResponse<StrategyTrendData[]>>;
    strategyWinRateTrend: (startDate?: string, endDate?: string) => Promise<IpcResponse<StrategyWinRateTrend[]>>;
    emotionHeatmap: (startDate?: string, endDate?: string) => Promise<IpcResponse<EmotionHeatmapData[]>>;
  };
  ai: {
    startReview: (type: ReviewType, startDate: string, endDate: string) => Promise<IpcResponse<string>>;
    onStream: (callback: (event: AIStreamEvent) => void) => () => void;
    listReviews: () => Promise<IpcResponse<any[]>>;
    getReview: (id: string) => Promise<IpcResponse<any>>;
    deleteReview: (id: string) => Promise<IpcResponse<boolean>>;
    toggleFavorite: (id: string) => Promise<IpcResponse<boolean>>;
    updateNote: (id: string, note: string) => Promise<IpcResponse<boolean>>;
    askConversation: (reviewId: string, question: string) => Promise<IpcResponse<void>>;
    getConversations: (reviewId: string) => Promise<IpcResponse<AIConversationMessage[]>>;
  };
  settings: {
    get: () => Promise<IpcResponse<Settings>>;
    save: (settings: Partial<Settings>) => Promise<IpcResponse<void>>;
    saveApiKey: (key: string) => Promise<IpcResponse<void>>;
    getApiKey: () => Promise<IpcResponse<string>>;
    testOllama: () => Promise<{ success: boolean; message: string; models?: string[] }>;
  };
  stock: {
    search: (keyword: string) => Promise<IpcResponse<StockCode[]>>;
    importCsv: (csvContent: string) => Promise<IpcResponse<{ added: number; total: number }>>;
  };
  quote: {
    get: (symbols: string[]) => Promise<IpcResponse<QuoteInfo[]>>;
  };
  backup: {
    export: () => Promise<IpcResponse<string>>;
    import: () => Promise<IpcResponse<boolean>>;
    list: () => Promise<IpcResponse<BackupInfo[]>>;
    exportEncrypted: () => Promise<IpcResponse<string>>;
    importEncrypted: () => Promise<IpcResponse<boolean>>;
    cloudSync: (config: CloudBackupConfig) => Promise<IpcResponse<string>>;
  };
  shortcut: {
    onNewTrade: (callback: () => void) => () => void;
    onSave: (callback: () => void) => () => void;
    onRefresh: (callback: () => void) => () => void;
    onEdit: (callback: () => void) => () => void;
    onEscape: (callback: () => void) => () => void;
  };
  import: {
    preview: (content: string) => Promise<IpcResponse<ImportPreview>>;
    trades: (content: string, fieldMapping: Record<string, string>, defaultValues?: any) => Promise<IpcResponse<ImportResult>>;
    logs: () => Promise<IpcResponse<any[]>>;
  };
  goal: {
    get: (id: string) => Promise<IpcResponse<TradingGoal>>;
    list: (period?: GoalPeriod, year?: number) => Promise<IpcResponse<TradingGoal[]>>;
    save: (goal: Partial<TradingGoal> & { period: GoalPeriod; year: number; month?: number }) => Promise<IpcResponse<TradingGoal>>;
    delete: (id: string) => Promise<IpcResponse<boolean>>;
    progress: (id?: string) => Promise<IpcResponse<GoalProgress>>;
  };
  briefing: {
    generate: () => Promise<IpcResponse<DailyBriefing>>;
    getToday: () => Promise<IpcResponse<DailyBriefing | null>>;
    getRecent: (days?: number) => Promise<IpcResponse<DailyBriefing[]>>;
  };
  journal: {
    save: (journal: Partial<JournalEntry> & { date: string; title: string }) => Promise<IpcResponse<JournalEntry>>;
    get: (id: string) => Promise<IpcResponse<JournalEntry | null>>;
    getByDate: (date: string) => Promise<IpcResponse<JournalEntry | null>>;
    getByDateRange: (startDate: string, endDate: string) => Promise<IpcResponse<JournalEntry[]>>;
    list: (options?: { page?: number; pageSize?: number; keyword?: string }) => Promise<IpcResponse<{ journals: JournalEntry[]; total: number; page: number; pageSize: number }>>;
    delete: (id: string) => Promise<IpcResponse<boolean>>;
  };
}

interface ImportPreview {
  total: number;
  fields: string[];
  sampleData: any[];
  detectedFormat: string;
  fieldMapping: Record<string, string>;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: ImportError[];
}

interface ImportError {
  row: number;
  message: string;
  data?: any;
}

interface QuoteInfo {
  symbol: string;
  name: string;
  lastDone: string;
  change: string;
  changeRate: string;
  open: string;
  high: string;
  low: string;
  volume: string;
  turnover: string;
  timestamp: Date;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
