// ===== 交易记录 =====
export interface Trade {
  id: string;
  stock_code: string;
  stock_name: string;
  market: Market;
  direction: Direction;
  trade_date: string;
  trade_time?: string;
  price: number;
  quantity: number;
  amount: number;
  commission: number;
  stamp_tax: number;
  total_cost: number;
  position_before?: number;
  position_after?: number;
  position_ratio?: number;
  realized_pnl?: number;
  pnl_ratio?: number;
  holding_days?: number;
  strategy?: string;
  entry_reason?: string;
  exit_plan?: string;
  stop_loss?: number;
  take_profit?: number;
  plan_executed?: PlanExecuted;
  emotion_before?: Emotion;
  emotion_after?: Emotion;
  confidence?: number;
  is_impulsive?: boolean;
  lesson?: string;
  market_trend?: MarketTrend;
  sector_trend?: MarketTrend;
  market_note?: string;
  related_trade_id?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export type Market = 'SH' | 'SZ' | 'BJ' | 'HK' | 'US';
export type Direction = 'BUY' | 'SELL';
export type Emotion = '冷静' | '兴奋' | '焦虑' | '恐惧' | '贪婪' | '犹豫' | '自信' | '沮丧';
export type MarketTrend = '上涨' | '下跌' | '震荡' | '不确定';
export type PlanExecuted = 'EXECUTED' | 'PARTIAL' | 'MISSED';

export interface TradeFilter {
  startDate?: string;
  endDate?: string;
  stock_code?: string;
  stock_name?: string;
  direction?: Direction;
  strategy?: string;
  market?: Market;
  pnlType?: 'profit' | 'loss' | 'all';
  tags?: string[];
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TradeListResult {
  trades: Trade[];
  total: number;
  page: number;
  pageSize: number;
}

// ===== 账户快照 =====
export interface AccountSnapshot {
  id: string;
  date: string;
  total_assets: number;
  cash: number;
  market_value: number;
  daily_pnl: number;
  daily_return: number;
  cumulative_return: number;
  created_at: string;
}

// ===== AI复盘 =====
export interface AIReview {
  id: string;
  review_type: ReviewType;
  start_date: string;
  end_date: string;
  prompt_used: string;
  ai_response: string;
  key_findings?: KeyFinding[];
  user_note?: string;
  is_favorite: boolean;
  created_at: string;
}

export type ReviewType = 'daily' | 'weekly' | 'monthly' | 'custom';

// AI对话消息
export interface AIConversationMessage {
  id: string;
  review_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// AI多轮对话请求
export interface AIConversationRequest {
  reviewId: string;
  question: string;
}

export interface KeyFinding {
  category: string;
  content: string;
  severity: 'info' | 'warning' | 'error';
}

// ===== 设置 =====
export interface Settings {
  initial_capital: number;
  ai_provider: string;
  api_key_encrypted: string;
  ai_model: string;
  default_commission_rate: number;
  default_stamp_tax_rate: number;
  custom_strategies: string[];
  custom_tags: string[];
  is_setup_complete: boolean;
  // Longbridge 配置
  longbridgeAppKey?: string;
  longbridgeAppSecret?: string;
  longbridgeAccessToken?: string;
  // 预警设置
  alert_enabled?: boolean;
  alert_interval?: number;
  consecutive_loss_threshold?: number;
  // 自动备份设置
  auto_backup_enabled?: boolean;
  auto_backup_frequency?: 'daily' | 'weekly';
  // 云同步设置
  cloud_folder_path?: string;
  cloud_backup_encrypted?: boolean;
  // 多账户设置
  current_account_id?: string;
  // 本地AI设置 (Ollama)
  local_ai_enabled?: boolean;
  local_ai_endpoint?: string;  // e.g., http://localhost:11434
  local_ai_model?: string;    // e.g., llama2, mistral, etc.
}

// 交易账户
export interface TradingAccount {
  id: string;
  name: string;                    // 账户名称（如：主账户、模拟账户）
  account_type: 'real' | 'simulated';  // 账户类型
  initial_capital: number;          // 初始资金
  broker_name?: string;             // 券商名称
  account_number?: string;          // 账户号码（部分）
  created_at: string;
  is_active: boolean;
}

// ===== 统计 =====
export interface StatsOverview {
  total_pnl: number;
  total_return: number;
  win_rate: number;
  profit_loss_ratio: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  max_drawdown: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  avg_holding_days: number;
  impulsive_trade_count: number;
  impulsive_trade_win_rate: number;
  stop_loss_execution_rate: number;
  plan_execution_rate?: number;
  plan_executed_count?: number;
  plan_partial_count?: number;
  plan_missed_count?: number;
  plan_with_plan_count?: number;
  expectancy: number;
  avg_win: number;
  avg_loss: number;
}

export interface PnlDataPoint {
  date: string;
  cumulative_pnl: number;
  daily_pnl: number;
}

export interface StrategyStats {
  strategy: string;
  total_pnl: number;
  win_rate: number;
  trade_count: number;
  avg_pnl: number;
}

// 策略效果趋势 - 用于展示策略收益和胜率随时间的变化
export interface StrategyTrendData {
  strategy: string;
  period: string;              // 月份或周
  total_pnl: number;
  win_rate: number;
  trade_count: number;
  avg_pnl: number;
  winning_trades: number;
  losing_trades: number;
}

// 策略胜率变化 - 用于展示胜率随时间的变化趋势
export interface StrategyWinRateTrend {
  strategy: string;
  period: string;
  win_rate: number;
  trade_count: number;
}

export interface EmotionWinRate {
  emotion: string;
  win_rate: number;
  trade_count: number;
  avg_pnl: number;
}

// 情绪-胜率热力图数据
export interface EmotionHeatmapData {
  emotion: string;
  period: string;  // 月份
  win_rate: number;
  trade_count: number;
  avg_pnl: number;
}

export interface MonthlyStats {
  month: string;
  pnl: number;
  trade_count: number;
  win_rate: number;
}

export interface CalendarHeatmapData {
  date: string;
  pnl: number;
  trade_count: number;
}

export interface DrawdownData {
  date: string;
  drawdown: number;
  peak: number;
  value: number;
}

export interface PnlDistribution {
  range: string;
  count: number;
  rangeStart: number;
  rangeEnd: number;
}

export interface PlanExecutionStats {
  total_with_plan: number;
  executed_count: number;
  partial_count: number;
  missed_count: number;
  execution_rate: number;
  executed_avg_pnl: number;
  partial_avg_pnl: number;
  missed_avg_pnl: number;
}

export interface PlanExecutionDetail {
  stock_code: string;
  stock_name: string;
  trade_date: string;
  sell_price: number;
  stop_loss?: number;
  take_profit?: number;
  plan_executed: PlanExecuted;
  realized_pnl?: number;
  reason: string;
}

// ===== 资产曲线 =====
export interface AssetCurveData {
  date: string;
  total_assets: number;
  cash: number;
  market_value: number;
  daily_pnl: number;
  daily_return: number;
  cumulative_return: number;
}

// ===== 持仓 =====
export interface Position {
  stock_code: string;
  stock_name: string;
  market: Market;
  quantity: number;
  avg_cost: number;
  total_cost: number;
  current_price: number;      // 当前价格
  current_value: number;      // 当前市值
  floating_pnl: number;       // 浮动盈亏
  floating_pnl_ratio: number; // 盈亏比例
  first_buy_date: string;
  last_trade_date: string;
  holding_days: number;
  stop_loss?: number;        // 止损价
  take_profit?: number;      // 止盈价
}

// ===== 股票代码 =====
export interface StockCode {
  code: string;
  name: string;
  market: Market;
}

// ===== IPC 响应 =====
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===== AI 流式事件 =====
export interface AIStreamEvent {
  type: 'start' | 'delta' | 'done' | 'error';
  content?: string;
  reviewId?: string;
  error?: string;
}

// ===== 交易目标 =====
export type GoalPeriod = 'monthly' | 'yearly';

export interface TradingGoal {
  id: string;
  period: GoalPeriod;
  year: number;
  month?: number;
  target_return?: number;
  target_win_rate?: number;
  target_profit_loss_ratio?: number;
  target_max_drawdown?: number;
  target_trade_count?: number;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  goal: TradingGoal;
  actual_return: number;
  actual_win_rate: number;
  actual_profit_loss_ratio: number;
  actual_max_drawdown: number;
  actual_trade_count: number;
  return_progress: number;
  win_rate_progress: number;
  profit_loss_ratio_progress: number;
  warnings: GoalWarning[];
}

export interface GoalWarning {
  type: 'return' | 'win_rate' | 'profit_loss_ratio' | 'max_drawdown';
  severity: 'warning' | 'danger';
  message: string;
  actual: number;
  target: number;
}

// ===== 每日简报 =====
export interface DailyBriefing {
  id: string;
  date: string;
  content: string;
  today_trades: number;
  today_pnl: number;
  week_pnl: number;
  month_pnl: number;
  positions_count: number;
  positions_value: number;
  consecutive_losses: number;
  risk_alert: string | null;
  created_at: string;
}

// ===== 备份 =====
export interface BackupInfo {
  name: string;
  path: string;
  time: number;
  size: number;
}

// 云备份配置
export interface CloudBackupConfig {
  enabled: boolean;
  provider: 'folder' | 'webdav';  // folder: 本地文件夹(可同步到云), webdav: WebDAV服务器
  folder_path?: string;             // 云同步文件夹路径
  webdav_url?: string;            // WebDAV服务器URL
  webdav_username?: string;       // WebDAV用户名
  encrypted: boolean;              // 是否加密
}

// ===== 风险评估 =====
export interface RiskExposure {
  total_market_value: number;      // 总市值
  total_exposure: number;          // 总风险敞口（市值/账户总资产）
  largest_position_pct: number;     // 最大单一仓位占比
  market_exposure: {                // 各市场敞口
    market: Market;
    value: number;
    percentage: number;
  }[];
  stock_exposure: {                 // 各股票敞口（Top 10）
    stock_code: string;
    stock_name: string;
    value: number;
    percentage: number;
  }[];
}

export interface RiskReward {
  current_risk_reward: number;     // 当前持仓风险收益比
  avg_historical_risk_reward: number; // 历史平均风险收益比
  positions_with_sl: number;        // 设置止损的仓位数量
  potential_upside: number;        // 潜在上涨空间
  potential_downside: number;       // 潜在下跌风险
}

export interface MaxPotentialLoss {
  if_all_stop_loss: number;         // 如果全部止损的最大损失
  if_all_stop_loss_pct: number;     // 损失占比
  largest_single_loss: number;      // 单笔最大潜在损失
  loss_from_concentration: number;  // 集中度风险导致的潜在损失
  cash_available: number;           // 可用资金
  can_cover_loss: boolean;          // 能否覆盖最大损失
}

export interface RiskAssessment {
  exposure: RiskExposure;
  risk_reward: RiskReward;
  max_potential_loss: MaxPotentialLoss;
  overall_risk_level: 'low' | 'medium' | 'high';
  risk_warnings: string[];
}

// ===== 交易日记 =====
export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  mood?: Emotion;
  energy_level?: number;        // 精力水平 1-5
  weather?: string;            // 天气
  sleep_quality?: number;      // 睡眠质量 1-5
  health_status?: string;       // 健康状况
  focus_time?: number;         // 专注时长（分钟）
  distractions?: string;       // 干扰因素
  trading_decision_quality?: number;  // 交易决策质量 1-5
  follow_plan_rate?: number;    // 计划执行率 0-100
  mistake_type?: string;       // 错误类型
  improvement_area?: string;   // 改进方向
  wins?: string;              // 当日亮点/成就
  gratitude?: string;         // 感恩事项
  tomorrow_plan?: string;      // 明日计划
  related_trade_ids?: string[]; // 关联的交易ID
  tags?: string[];
  created_at: string;
  updated_at: string;
}
