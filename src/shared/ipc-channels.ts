// IPC 通道常量
export const IPC_CHANNELS = {
  // 交易
  TRADE_CREATE: 'trade:create',
  TRADE_UPDATE: 'trade:update',
  TRADE_DELETE: 'trade:delete',
  TRADE_GET: 'trade:get',
  TRADE_LIST: 'trade:list',
  TRADE_GET_RELATED: 'trade:getRelated',
  TRADE_EXPORT_CSV: 'trade:exportCsv',

  // 持仓
  POSITION_LIST: 'position:list',

  // 账户快照
  ACCOUNT_SNAPSHOT_SAVE: 'account:snapshotSave',
  ACCOUNT_SNAPSHOT_LIST: 'account:snapshotList',
  ACCOUNT_SNAPSHOT_AUTO: 'account:snapshotAuto',

  // 统计
  STATS_OVERVIEW: 'stats:overview',
  STATS_PNL_CURVE: 'stats:pnlCurve',
  STATS_STRATEGY: 'stats:strategy',
  STATS_EMOTION: 'stats:emotion',
  STATS_MONTHLY: 'stats:monthly',
  STATS_CALENDAR: 'stats:calendar',
  STATS_DRAWDOWN: 'stats:drawdown',
  STATS_PNL_DISTRIBUTION: 'stats:pnlDistribution',
  STATS_PLAN_EXECUTION: 'stats:planExecution',
  STATS_ASSET_CURVE: 'stats:assetCurve',
  STATS_RISK_ASSESSMENT: 'stats:riskAssessment',

  // 策略效果追踪
  STATS_STRATEGY_TREND: 'stats:strategyTrend',
  STATS_STRATEGY_WIN_RATE_TREND: 'stats:strategyWinRateTrend',

  // 情绪热力图
  STATS_EMOTION_HEATMAP: 'stats:emotionHeatmap',

  // AI 复盘
  AI_REVIEW_START: 'ai:reviewStart',
  AI_REVIEW_STREAM: 'ai:reviewStream',
  AI_REVIEW_LIST: 'ai:reviewList',
  AI_REVIEW_GET: 'ai:reviewGet',
  AI_REVIEW_DELETE: 'ai:reviewDelete',
  AI_REVIEW_TOGGLE_FAVORITE: 'ai:reviewToggleFavorite',
  AI_REVIEW_UPDATE_NOTE: 'ai:reviewUpdateNote',
  AI_CONVERSATION_ASK: 'ai:conversationAsk',
  AI_CONVERSATION_GET: 'ai:conversationGet',

  // 设置
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_SAVE_API_KEY: 'settings:saveApiKey',
  SETTINGS_GET_API_KEY: 'settings:getApiKey',
  SETTINGS_TEST_OLLAMA: 'settings:testOllama',

  // 股票代码搜索
  STOCK_SEARCH: 'stock:search',
  STOCK_IMPORT_CSV: 'stock:importCsv',
  STOCK_UPDATE_NAMES: 'stock:updateNames',

  // 实时行情
  QUOTE_GET: 'quote:get',
  QUOTE_FX_RATES: 'quote:fxRates',

  // 备份
  BACKUP_EXPORT: 'backup:export',
  BACKUP_IMPORT: 'backup:import',
  BACKUP_LIST: 'backup:list',
  BACKUP_EXPORT_ENCRYPTED: 'backup:exportEncrypted',
  BACKUP_IMPORT_ENCRYPTED: 'backup:importEncrypted',
  BACKUP_CLOUD_SYNC: 'backup:cloudSync',

  // 快捷键
  SHORTCUT_NEW_TRADE: 'shortcut:newTrade',
  SHORTCUT_SAVE: 'shortcut:save',
  SHORTCUT_REFRESH: 'shortcut:refresh',
  SHORTCUT_EDIT: 'shortcut:edit',
  SHORTCUT_ESCAPE: 'shortcut:escape',

  // 数据导入
  IMPORT_PREVIEW: 'import:preview',
  IMPORT_TRADES: 'import:trades',
  IMPORT_LOGS: 'import:logs',

  // 通用
  APP_GET_PATH: 'app:getPath',

  // 交易目标
  GOAL_GET: 'goal:get',
  GOAL_LIST: 'goal:list',
  GOAL_SAVE: 'goal:save',
  GOAL_DELETE: 'goal:delete',
  GOAL_PROGRESS: 'goal:progress',

  // 每日简报
  BRIEFING_GENERATE: 'briefing:generate',
  BRIEFING_GET_TODAY: 'briefing:getToday',
  BRIEFING_GET_RECENT: 'briefing:getRecent',

  // 交易日记
  JOURNAL_SAVE: 'journal:save',
  JOURNAL_GET: 'journal:get',
  JOURNAL_LIST: 'journal:list',
  JOURNAL_DELETE: 'journal:delete',
  JOURNAL_GET_BY_DATE: 'journal:getByDate',
  JOURNAL_GET_BY_DATE_RANGE: 'journal:getByDateRange',

  // 账户管理
  ACCOUNT_CREATE: 'account:create',
  ACCOUNT_LIST: 'account:list',
  ACCOUNT_SET_ACTIVE: 'account:setActive',
  ACCOUNT_DELETE: 'account:delete',

  // PDF导出
  EXPORT_PDF_REPORT: 'export:pdfReport',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
