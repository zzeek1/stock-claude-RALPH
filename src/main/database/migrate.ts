import { getDb, execute, queryOne } from './connection';

const MIGRATIONS: { version: number; sqls: string[] }[] = [
  {
    version: 6,
    sqls: [
      `CREATE TABLE IF NOT EXISTS trading_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL DEFAULT 'real',
        initial_capital REAL NOT NULL,
        broker_name TEXT,
        account_number TEXT,
        created_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE INDEX IF NOT EXISTS idx_trading_accounts_active ON trading_accounts(is_active)`,
    ],
  },
  {
    version: 5,
    sqls: [
      `CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (review_id) REFERENCES ai_reviews(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ai_conversations_review ON ai_conversations(review_id)`,
    ],
  },
  {
    version: 4,
    sqls: [
      `CREATE TABLE IF NOT EXISTS journals (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        mood TEXT,
        energy_level INTEGER,
        weather TEXT,
        sleep_quality INTEGER,
        health_status TEXT,
        focus_time INTEGER,
        distractions TEXT,
        trading_decision_quality INTEGER,
        follow_plan_rate REAL,
        mistake_type TEXT,
        improvement_area TEXT,
        wins TEXT,
        gratitude TEXT,
        tomorrow_plan TEXT,
        related_trade_ids TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_journals_date ON journals(date)`,
    ],
  },
  {
    version: 3,
    sqls: [
      `CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        period TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER,
        target_return REAL,
        target_win_rate REAL,
        target_profit_loss_ratio REAL,
        target_max_drawdown REAL,
        target_trade_count INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period, year, month)`,
    ],
  },
  {
    version: 2,
    sqls: [
      `ALTER TABLE trades ADD COLUMN plan_executed TEXT DEFAULT NULL`,
    ],
  },
  {
    version: 1,
    sqls: [
      `CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        stock_code TEXT NOT NULL,
        stock_name TEXT NOT NULL,
        market TEXT NOT NULL DEFAULT 'SH',
        direction TEXT NOT NULL,
        trade_date TEXT NOT NULL,
        trade_time TEXT,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        amount REAL NOT NULL,
        commission REAL NOT NULL DEFAULT 0,
        stamp_tax REAL NOT NULL DEFAULT 0,
        total_cost REAL NOT NULL DEFAULT 0,
        position_before INTEGER,
        position_after INTEGER,
        position_ratio REAL,
        realized_pnl REAL,
        pnl_ratio REAL,
        holding_days INTEGER,
        strategy TEXT,
        entry_reason TEXT,
        exit_plan TEXT,
        stop_loss REAL,
        take_profit REAL,
        emotion_before TEXT,
        emotion_after TEXT,
        confidence INTEGER,
        is_impulsive INTEGER DEFAULT 0,
        lesson TEXT,
        market_trend TEXT,
        sector_trend TEXT,
        market_note TEXT,
        related_trade_id TEXT,
        tags TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(trade_date)`,
      `CREATE INDEX IF NOT EXISTS idx_trades_stock ON trades(stock_code)`,
      `CREATE INDEX IF NOT EXISTS idx_trades_direction ON trades(direction)`,
      `CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy)`,
      `CREATE TABLE IF NOT EXISTS account_snapshots (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        total_assets REAL NOT NULL,
        cash REAL NOT NULL,
        market_value REAL NOT NULL,
        daily_pnl REAL NOT NULL DEFAULT 0,
        daily_return REAL NOT NULL DEFAULT 0,
        cumulative_return REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_snapshots_date ON account_snapshots(date)`,
      `CREATE TABLE IF NOT EXISTS ai_reviews (
        id TEXT PRIMARY KEY,
        review_type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        prompt_used TEXT NOT NULL,
        ai_response TEXT NOT NULL DEFAULT '',
        key_findings TEXT DEFAULT '[]',
        user_note TEXT,
        is_favorite INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_reviews_date ON ai_reviews(start_date, end_date)`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ],
  },
];

export function runMigrations(): void {
  const db = getDb();

  db.run(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const currentVersion = queryOne('SELECT MAX(version) as version FROM schema_version');
  const appliedVersion = currentVersion?.version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > appliedVersion) {
      for (const sql of migration.sqls) {
        db.run(sql);
      }
      execute(
        'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
        [migration.version, new Date().toISOString()]
      );
      console.log(`Migration v${migration.version} applied`);
    }
  }
}
