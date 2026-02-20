import Anthropic from '@anthropic-ai/sdk';
import { queryAll, queryOne, execute } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { Trade, AIReview, ReviewType, AIStreamEvent, AIConversationMessage } from '../../shared/types';
import { getTradesByDateRange } from './trade-service';
import { getStatsOverview, getPlanExecutionStats } from './stats-service';
import { BrowserWindow, safeStorage } from 'electron';
import { getAllSettings } from './settings-service';

const SYSTEM_PROMPT = `你是一位经验丰富、严格但鼓励的股票交易教练。你的任务是分析交易员的交易记录，帮助他们发现问题并改进。

分析原则：
1. 数据驱动：所有结论必须基于交易数据，不做无根据的推测
2. 模式识别：重点发现反复出现的错误模式
3. 正面强化：在指出问题的同时，也要肯定做得好的地方
4. 可操作性：给出的建议必须具体、可执行

分析维度：
- 纪律维度：是否执行了止损/止盈计划
- 情绪维度：情绪与交易结果的关联
- 策略维度：各策略有效性对比
- 仓位维度：仓位管理是否合理
- 时机维度：买卖时机质量

输出结构（使用Markdown格式）：
## 交易概览
简要统计本期交易数据

## 核心发现
最重要的2-3个发现

## 错误模式识别
反复出现的问题

## 做得好的地方
值得继续保持的

## 行动计划
具体的改进建议（不超过3条）`;

function buildUserPrompt(trades: Trade[], overview: any, planStats: any, reviewType: ReviewType, dateRange: string, previousFindings?: string): string {
  const typeLabel = reviewType === 'daily' ? '日' : reviewType === 'weekly' ? '周' : reviewType === 'monthly' ? '月' : '';
  let prompt = `请分析以下${typeLabel}交易记录。\n\n`;
  prompt += `## 分析期间：${dateRange}\n\n`;

  prompt += `## 账户概况\n`;
  prompt += `- 总交易次数：${overview.total_trades}\n`;
  prompt += `- 总盈亏：${overview.total_pnl.toFixed(2)}\n`;
  prompt += `- 胜率：${(overview.win_rate * 100).toFixed(1)}%\n`;
  prompt += `- 盈亏比：${overview.profit_loss_ratio.toFixed(2)}\n`;
  prompt += `- 最大回撤：${(overview.max_drawdown * 100).toFixed(1)}%\n\n`;

  if (planStats.total_with_plan > 0) {
    prompt += `## 计划执行统计\n`;
    prompt += `- 有计划的交易数：${planStats.total_with_plan}\n`;
    prompt += `- 完全执行：${planStats.executed_count} (${(planStats.execution_rate * 100).toFixed(1)}%)\n`;
    prompt += `- 部分执行：${planStats.partial_count}\n`;
    prompt += `- 完全错过：${planStats.missed_count}\n`;
    prompt += `- 完全执行平均盈亏：${planStats.executed_avg_pnl.toFixed(2)}元\n`;
    prompt += `- 部分执行平均盈亏：${planStats.partial_avg_pnl.toFixed(2)}元\n`;
    prompt += `- 错过计划平均盈亏：${planStats.missed_avg_pnl.toFixed(2)}元\n\n`;
  }

  prompt += `## 交易明细\n`;
  prompt += `| 日期 | 股票 | 方向 | 价格 | 数量 | 盈亏 | 止损价 | 止盈价 | 计划执行 | 策略 | 情绪 | 冲动 |\n`;
  prompt += `|------|------|------|------|------|------|--------|--------|----------|------|------|------|\n`;

  for (const t of trades) {
    const planLabel = t.plan_executed === 'EXECUTED' ? '✓执行' : t.plan_executed === 'PARTIAL' ? '△部分' : t.plan_executed === 'MISSED' ? '✗错过' : '-';
    prompt += `| ${t.trade_date} | ${t.stock_name}(${t.stock_code}) | ${t.direction} | ${t.price} | ${t.quantity} | ${t.realized_pnl?.toFixed(2) ?? '-'} | ${t.stop_loss ?? '-'} | ${t.take_profit ?? '-'} | ${planLabel} | ${t.strategy || '-'} | ${t.emotion_before || '-'} | ${t.is_impulsive ? '是' : '否'} |\n`;
  }

  if (previousFindings) {
    prompt += `\n## 上期关键发现\n${previousFindings}\n`;
    prompt += `请特别关注上期发现的问题是否有改善。\n`;
  }

  prompt += `\n请按照你的分析框架，给出详细的复盘分析。`;
  return prompt;
}

export async function startReview(
  reviewType: ReviewType,
  startDate: string,
  endDate: string,
  win: BrowserWindow
): Promise<string> {
  const reviewId = uuidv4();
  const trades = getTradesByDateRange(startDate, endDate);

  if (trades.length === 0) {
    win.webContents.send('ai:reviewStream', {
      type: 'error',
      error: '所选日期范围内没有交易记录',
      reviewId,
    } as AIStreamEvent);
    return reviewId;
  }

  const overview = getStatsOverview(startDate, endDate);
  const planStats = getPlanExecutionStats(startDate, endDate);
  const dateRange = `${startDate} ~ ${endDate}`;

  let previousFindings: string | undefined;
  if (reviewType === 'monthly') {
    const prev = queryOne(`
      SELECT key_findings FROM ai_reviews
      WHERE review_type = 'monthly' AND end_date < ?
      ORDER BY end_date DESC LIMIT 1
    `, [startDate]);
    if (prev?.key_findings) {
      try {
        const findings = JSON.parse(prev.key_findings);
        previousFindings = findings.map((f: any) => `- [${f.category}] ${f.content}`).join('\n');
      } catch {}
    }
  }

  const userPrompt = buildUserPrompt(trades, overview, planStats, reviewType, dateRange, previousFindings);

  // Check if local AI is enabled
  const useLocalAI = isLocalAIEnabled();

  if (useLocalAI) {
    // Use local AI (Ollama)
    const endpoint = getLocalAIEndpoint();
    const model = getLocalAIModel();

    const now = new Date().toISOString();
    execute(`
      INSERT INTO ai_reviews (id, review_type, start_date, end_date, prompt_used, ai_response, created_at)
      VALUES (?, ?, ?, ?, ?, '', ?)
    `, [reviewId, reviewType, startDate, endDate, userPrompt, now]);

    win.webContents.send('ai:reviewStream', { type: 'start', reviewId } as AIStreamEvent);

    try {
      const fullResponse = await callOllama(
        endpoint,
        model,
        SYSTEM_PROMPT,
        userPrompt,
        (text) => {
          win.webContents.send('ai:reviewStream', {
            type: 'delta',
            content: text,
            reviewId,
          } as AIStreamEvent);
        }
      );

      execute('UPDATE ai_reviews SET ai_response = ? WHERE id = ?', [fullResponse, reviewId]);

      win.webContents.send('ai:reviewStream', {
        type: 'done',
        reviewId,
      } as AIStreamEvent);
    } catch (error: any) {
      win.webContents.send('ai:reviewStream', {
        type: 'error',
        error: `本地AI调用失败: ${error.message}。请确保Ollama已启动且模型已安装。`,
        reviewId,
      } as AIStreamEvent);
    }
    return reviewId;
  }

  // Use Claude API (original behavior)
  const apiKey = getDecryptedApiKey();
  if (!apiKey) {
    win.webContents.send('ai:reviewStream', {
      type: 'error',
      error: '请先在设置中配置 API Key',
      reviewId,
    } as AIStreamEvent);
    return reviewId;
  }

  const model = getAIModel();

  const now = new Date().toISOString();
  execute(`
    INSERT INTO ai_reviews (id, review_type, start_date, end_date, prompt_used, ai_response, created_at)
    VALUES (?, ?, ?, ?, ?, '', ?)
  `, [reviewId, reviewType, startDate, endDate, userPrompt, now]);

  win.webContents.send('ai:reviewStream', { type: 'start', reviewId } as AIStreamEvent);

  try {
    const client = new Anthropic({ apiKey });
    let fullResponse = '';

    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    stream.on('text', (text) => {
      fullResponse += text;
      win.webContents.send('ai:reviewStream', {
        type: 'delta',
        content: text,
        reviewId,
      } as AIStreamEvent);
    });

    await stream.finalMessage();

    execute('UPDATE ai_reviews SET ai_response = ? WHERE id = ?', [fullResponse, reviewId]);

    win.webContents.send('ai:reviewStream', {
      type: 'done',
      reviewId,
    } as AIStreamEvent);
  } catch (error: any) {
    win.webContents.send('ai:reviewStream', {
      type: 'error',
      error: error.message || 'AI 分析失败',
      reviewId,
    } as AIStreamEvent);
  }

  return reviewId;
}

export function listReviews(): AIReview[] {
  const rows = queryAll('SELECT * FROM ai_reviews ORDER BY created_at DESC');
  return rows.map(r => ({
    ...r,
    is_favorite: r.is_favorite === 1,
    key_findings: r.key_findings ? JSON.parse(r.key_findings) : [],
  }));
}

export function getReview(id: string): AIReview | null {
  const row = queryOne('SELECT * FROM ai_reviews WHERE id = ?', [id]);
  if (!row) return null;
  return {
    ...row,
    is_favorite: row.is_favorite === 1,
    key_findings: row.key_findings ? JSON.parse(row.key_findings) : [],
  };
}

export function deleteReview(id: string): boolean {
  execute('DELETE FROM ai_reviews WHERE id = ?', [id]);
  return true;
}

export function toggleFavorite(id: string): boolean {
  const review = getReview(id);
  if (!review) return false;
  execute('UPDATE ai_reviews SET is_favorite = ? WHERE id = ?', [review.is_favorite ? 0 : 1, id]);
  return true;
}

export function updateNote(id: string, note: string): boolean {
  execute('UPDATE ai_reviews SET user_note = ? WHERE id = ?', [note, id]);
  return true;
}

function getDecryptedApiKey(): string | null {
  const row = queryOne("SELECT value FROM settings WHERE key = 'api_key_encrypted'");
  if (!row) return null;

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(row.value, 'base64');
      return safeStorage.decryptString(buffer);
    }
    return row.value;
  } catch {
    return row.value;
  }
}

function getAIModel(): string {
  const row = queryOne("SELECT value FROM settings WHERE key = 'ai_model'");
  return row?.value || 'claude-sonnet-4-20250514';
}

function isLocalAIEnabled(): boolean {
  const row = queryOne("SELECT value FROM settings WHERE key = 'local_ai_enabled'");
  return row?.value === 'true';
}

function getLocalAIEndpoint(): string {
  const row = queryOne("SELECT value FROM settings WHERE key = 'local_ai_endpoint'");
  return row?.value || 'http://localhost:11434';
}

function getLocalAIModel(): string {
  const row = queryOne("SELECT value FROM settings WHERE key = 'local_ai_model'");
  return row?.value || 'llama2';
}

// Call Ollama API for local AI
async function callOllama(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const response = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to read response stream');
  }

  const decoder = new TextDecoder();
  let fullResponse = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            fullResponse += data.message.content;
            onChunk(data.message.content);
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullResponse;
}

// ===== AI多轮对话 =====

export async function askConversation(
  reviewId: string,
  question: string,
  win: BrowserWindow
): Promise<string> {
  const review = getReview(reviewId);
  if (!review) {
    win.webContents.send('ai:reviewStream', {
      type: 'error',
      error: '找不到对应的复盘记录',
      reviewId,
    } as AIStreamEvent);
    return '';
  }

  // Get conversation history
  const conversations = getConversations(reviewId);

  // Build messages for the API
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  // Add original review prompt and response
  messages.push({
    role: 'user',
    content: review.prompt_used,
  });
  messages.push({
    role: 'assistant',
    content: review.ai_response,
  });

  // Add previous conversation history
  for (const msg of conversations) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add the new question
  messages.push({
    role: 'user',
    content: question,
  });

  // Save user question to database
  const messageId = uuidv4();
  const now = new Date().toISOString();
  execute(
    'INSERT INTO ai_conversations (id, review_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [messageId, reviewId, 'user', question, now]
  );

  // Check if local AI is enabled
  const useLocalAI = isLocalAIEnabled();

  if (useLocalAI) {
    // Use local AI (Ollama)
    const endpoint = getLocalAIEndpoint();
    const model = getLocalAIModel();

    win.webContents.send('ai:reviewStream', { type: 'start', reviewId } as AIStreamEvent);

    try {
      // Build messages in Ollama format (system + conversation history)
      const ollamaMessages = messages.map(m => ({ role: m.role, content: m.content }));

      const fullResponse = await callOllama(
        endpoint,
        model,
        SYSTEM_PROMPT,
        ollamaMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n'),
        (text) => {
          win.webContents.send('ai:reviewStream', {
            type: 'delta',
            content: text,
            reviewId,
          } as AIStreamEvent);
        }
      );

      // Save AI response to database
      const responseId = uuidv4();
      execute(
        'INSERT INTO ai_conversations (id, review_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
        [responseId, reviewId, 'assistant', fullResponse, now]
      );

      win.webContents.send('ai:reviewStream', {
        type: 'done',
        reviewId,
      } as AIStreamEvent);

      return fullResponse;
    } catch (error: any) {
      win.webContents.send('ai:reviewStream', {
        type: 'error',
        error: `本地AI调用失败: ${error.message}`,
        reviewId,
      } as AIStreamEvent);
      return '';
    }
  }

  // Use Claude API (original behavior)
  const apiKey = getDecryptedApiKey();
  if (!apiKey) {
    win.webContents.send('ai:reviewStream', {
      type: 'error',
      error: '请先在设置中配置 API Key',
      reviewId,
    } as AIStreamEvent);
    return '';
  }

  const model = getAIModel();

  win.webContents.send('ai:reviewStream', { type: 'start', reviewId } as AIStreamEvent);

  try {
    const client = new Anthropic({ apiKey });
    let fullResponse = '';

    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    });

    stream.on('text', (text) => {
      fullResponse += text;
      win.webContents.send('ai:reviewStream', {
        type: 'delta',
        content: text,
        reviewId,
      } as AIStreamEvent);
    });

    await stream.finalMessage();

    // Save AI response to database
    const responseId = uuidv4();
    execute(
      'INSERT INTO ai_conversations (id, review_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [responseId, reviewId, 'assistant', fullResponse, now]
    );

    win.webContents.send('ai:reviewStream', {
      type: 'done',
      reviewId,
    } as AIStreamEvent);

    return fullResponse;
  } catch (error: any) {
    win.webContents.send('ai:reviewStream', {
      type: 'error',
      error: error.message || 'AI 对话失败',
      reviewId,
    } as AIStreamEvent);
    return '';
  }
}

export function getConversations(reviewId: string): AIConversationMessage[] {
  const rows = queryAll(
    'SELECT * FROM ai_conversations WHERE review_id = ? ORDER BY created_at ASC',
    [reviewId]
  );
  return rows as AIConversationMessage[];
}
