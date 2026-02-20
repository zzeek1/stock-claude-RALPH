import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';
let saveTimeout: NodeJS.Timeout | null = null;
let isDirty = false;

export function getDbPath(): string {
  if (!dbPath) {
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'stock-claude.db');
  }
  return dbPath;
}

export async function initDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs();
  const filePath = getDbPath();

  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL-like behavior
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');

  return db;
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

function scheduleSave(): void {
  isDirty = true;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  // Debounce save - wait 1 second after last write
  saveTimeout = setTimeout(() => {
    if (isDirty) {
      saveDb();
    }
  }, 1000);
}

export function saveDb(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const filePath = getDbPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, buffer);
  isDirty = false;
}

// Force save (for critical operations like app close)
export function forceSaveDb(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveDb();
}

export function closeDb(): void {
  if (db) {
    forceSaveDb();
    db.close();
    db = null;
  }
}

// Helper to run a query and get all results as objects
export function queryAll(sql: string, params?: any[]): any[] {
  const database = getDb();
  const stmt = database.prepare(sql);
  if (params) stmt.bind(params);

  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper to run a query and get first result
export function queryOne(sql: string, params?: any[]): any | null {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper to run an insert/update/delete
export function execute(sql: string, params?: any[]): void {
  const database = getDb();
  database.run(sql, params);
  // Schedule auto-save with debouncing
  scheduleSave();
}

// Helper to get changes count after last operation
export function getChanges(): number {
  const database = getDb();
  const result = queryOne('SELECT changes() as changes');
  return result?.changes ?? 0;
}
