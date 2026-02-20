import { queryAll, queryOne, execute, saveDb } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { JournalEntry } from '../../shared/types';

function rowToJournal(row: any): JournalEntry {
  return {
    ...row,
    related_trade_ids: row.related_trade_ids ? JSON.parse(row.related_trade_ids) : [],
    tags: row.tags ? JSON.parse(row.tags) : [],
  };
}

export function saveJournal(journal: Partial<JournalEntry> & { date: string; title: string }): JournalEntry {
  const now = new Date().toISOString();

  // Check if a journal for this date already exists
  const existing = queryOne('SELECT id FROM journals WHERE date = ?', [journal.date]);

  if (existing) {
    // Update existing journal
    const updates: string[] = [];
    const values: any[] = [];

    if (journal.title !== undefined) {
      updates.push('title = ?');
      values.push(journal.title);
    }
    if (journal.content !== undefined) {
      updates.push('content = ?');
      values.push(journal.content);
    }
    if (journal.mood !== undefined) {
      updates.push('mood = ?');
      values.push(journal.mood);
    }
    if (journal.energy_level !== undefined) {
      updates.push('energy_level = ?');
      values.push(journal.energy_level);
    }
    if (journal.weather !== undefined) {
      updates.push('weather = ?');
      values.push(journal.weather);
    }
    if (journal.sleep_quality !== undefined) {
      updates.push('sleep_quality = ?');
      values.push(journal.sleep_quality);
    }
    if (journal.health_status !== undefined) {
      updates.push('health_status = ?');
      values.push(journal.health_status);
    }
    if (journal.focus_time !== undefined) {
      updates.push('focus_time = ?');
      values.push(journal.focus_time);
    }
    if (journal.distractions !== undefined) {
      updates.push('distractions = ?');
      values.push(journal.distractions);
    }
    if (journal.trading_decision_quality !== undefined) {
      updates.push('trading_decision_quality = ?');
      values.push(journal.trading_decision_quality);
    }
    if (journal.follow_plan_rate !== undefined) {
      updates.push('follow_plan_rate = ?');
      values.push(journal.follow_plan_rate);
    }
    if (journal.mistake_type !== undefined) {
      updates.push('mistake_type = ?');
      values.push(journal.mistake_type);
    }
    if (journal.improvement_area !== undefined) {
      updates.push('improvement_area = ?');
      values.push(journal.improvement_area);
    }
    if (journal.wins !== undefined) {
      updates.push('wins = ?');
      values.push(journal.wins);
    }
    if (journal.gratitude !== undefined) {
      updates.push('gratitude = ?');
      values.push(journal.gratitude);
    }
    if (journal.tomorrow_plan !== undefined) {
      updates.push('tomorrow_plan = ?');
      values.push(journal.tomorrow_plan);
    }
    if (journal.related_trade_ids !== undefined) {
      updates.push('related_trade_ids = ?');
      values.push(JSON.stringify(journal.related_trade_ids));
    }
    if (journal.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(journal.tags));
    }

    updates.push('updated_at = ?');
    values.push(now);

    values.push(journal.date);

    execute(`UPDATE journals SET ${updates.join(', ')} WHERE date = ?`, values);
    saveDb();

    const updated = queryOne('SELECT * FROM journals WHERE date = ?', [journal.date]);
    return rowToJournal(updated);
  } else {
    // Insert new journal
    const id = uuidv4();
    const newJournal: JournalEntry = {
      id,
      date: journal.date,
      title: journal.title,
      content: journal.content || '',
      mood: journal.mood,
      energy_level: journal.energy_level,
      weather: journal.weather,
      sleep_quality: journal.sleep_quality,
      health_status: journal.health_status,
      focus_time: journal.focus_time,
      distractions: journal.distractions,
      trading_decision_quality: journal.trading_decision_quality,
      follow_plan_rate: journal.follow_plan_rate,
      mistake_type: journal.mistake_type,
      improvement_area: journal.improvement_area,
      wins: journal.wins,
      gratitude: journal.gratitude,
      tomorrow_plan: journal.tomorrow_plan,
      related_trade_ids: journal.related_trade_ids || [],
      tags: journal.tags || [],
      created_at: now,
      updated_at: now,
    };

    execute(`
      INSERT INTO journals (
        id, date, title, content, mood, energy_level, weather, sleep_quality,
        health_status, focus_time, distractions, trading_decision_quality,
        follow_plan_rate, mistake_type, improvement_area, wins, gratitude,
        tomorrow_plan, related_trade_ids, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newJournal.id,
      newJournal.date,
      newJournal.title,
      newJournal.content,
      newJournal.mood,
      newJournal.energy_level,
      newJournal.weather,
      newJournal.sleep_quality,
      newJournal.health_status,
      newJournal.focus_time,
      newJournal.distractions,
      newJournal.trading_decision_quality,
      newJournal.follow_plan_rate,
      newJournal.mistake_type,
      newJournal.improvement_area,
      newJournal.wins,
      newJournal.gratitude,
      newJournal.tomorrow_plan,
      JSON.stringify(newJournal.related_trade_ids),
      JSON.stringify(newJournal.tags),
      newJournal.created_at,
      newJournal.updated_at,
    ]);
    saveDb();

    return newJournal;
  }
}

export function getJournalById(id: string): JournalEntry | null {
  const row = queryOne('SELECT * FROM journals WHERE id = ?', [id]);
  if (!row) return null;
  return rowToJournal(row);
}

export function getJournalByDate(date: string): JournalEntry | null {
  const row = queryOne('SELECT * FROM journals WHERE date = ?', [date]);
  if (!row) return null;
  return rowToJournal(row);
}

export function getJournalByDateRange(startDate: string, endDate: string): JournalEntry[] {
  const rows = queryAll(
    'SELECT * FROM journals WHERE date >= ? AND date <= ? ORDER BY date DESC',
    [startDate, endDate]
  );
  return rows.map(rowToJournal);
}

export function getJournalList(options?: { page?: number; pageSize?: number; keyword?: string }): {
  journals: JournalEntry[];
  total: number;
  page: number;
  pageSize: number;
} {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  let whereClause = '';
  const params: any[] = [];

  if (options?.keyword) {
    whereClause = 'WHERE title LIKE ? OR content LIKE ?';
    params.push(`%${options.keyword}%`, `%${options.keyword}%`);
  }

  const countResult = queryOne(
    `SELECT COUNT(*) as total FROM journals ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  const rows = queryAll(
    `SELECT * FROM journals ${whereClause} ORDER BY date DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const journals = rows.map(rowToJournal);

  return {
    journals,
    total,
    page,
    pageSize,
  };
}

export function deleteJournal(id: string): boolean {
  execute('DELETE FROM journals WHERE id = ?', [id]);
  saveDb();
  return true;
}
