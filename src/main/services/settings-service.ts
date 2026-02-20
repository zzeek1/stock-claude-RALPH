import { queryOne, execute } from '../database/connection';
import { Settings } from '../../shared/types';
import { safeStorage } from 'electron';

const DEFAULT_SETTINGS: Record<string, string> = {
  initial_capital: '100000',
  ai_provider: 'anthropic',
  ai_model: 'claude-sonnet-4-20250514',
  default_commission_rate: '0.00025',
  default_stamp_tax_rate: '0.0005',
  custom_strategies: JSON.stringify(['趋势跟踪', '均值回归', '突破', '价值投资', '事件驱动']),
  custom_tags: JSON.stringify(['短线', '中线', '长线', '打板', '低吸', '追涨']),
  is_setup_complete: 'false',
  // 预警设置
  alert_enabled: 'true',
  alert_interval: '60',
  consecutive_loss_threshold: '3',
  // 自动备份设置
  auto_backup_enabled: 'true',
  auto_backup_frequency: 'daily',
  // 本地AI设置
  local_ai_enabled: 'false',
  local_ai_endpoint: 'http://localhost:11434',
  local_ai_model: 'llama2',
};

export function getSetting(key: string): string | null {
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? DEFAULT_SETTINGS[key] ?? null;
}

export function setSetting(key: string, value: string): void {
  execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export function getAllSettings(): Settings {
  return {
    initial_capital: parseFloat(getSetting('initial_capital') || '100000'),
    ai_provider: getSetting('ai_provider') || 'anthropic',
    api_key_encrypted: getSetting('api_key_encrypted') || '',
    ai_model: getSetting('ai_model') || 'claude-sonnet-4-20250514',
    default_commission_rate: parseFloat(getSetting('default_commission_rate') || '0.00025'),
    default_stamp_tax_rate: parseFloat(getSetting('default_stamp_tax_rate') || '0.0005'),
    custom_strategies: JSON.parse(getSetting('custom_strategies') || '[]'),
    custom_tags: JSON.parse(getSetting('custom_tags') || '[]'),
    is_setup_complete: getSetting('is_setup_complete') === 'true',
    // Longbridge 配置
    longbridgeAppKey: getSetting('longbridge_app_key') || '',
    longbridgeAppSecret: getSetting('longbridge_app_secret') || '',
    longbridgeAccessToken: getSetting('longbridge_access_token') || '',
    // 预警设置
    alert_enabled: getSetting('alert_enabled') === 'true',
    alert_interval: parseInt(getSetting('alert_interval') || '60', 10),
    consecutive_loss_threshold: parseInt(getSetting('consecutive_loss_threshold') || '3', 10),
    // 自动备份设置
    auto_backup_enabled: getSetting('auto_backup_enabled') === 'true',
    auto_backup_frequency: (getSetting('auto_backup_frequency') as 'daily' | 'weekly') || 'daily',
    // 本地AI设置
    local_ai_enabled: getSetting('local_ai_enabled') === 'true',
    local_ai_endpoint: getSetting('local_ai_endpoint') || 'http://localhost:11434',
    local_ai_model: getSetting('local_ai_model') || 'llama2',
  };
}

export function saveSettings(settings: Partial<Settings>): void {
  if (settings.initial_capital !== undefined) setSetting('initial_capital', settings.initial_capital.toString());
  if (settings.ai_provider !== undefined) setSetting('ai_provider', settings.ai_provider);
  if (settings.ai_model !== undefined) setSetting('ai_model', settings.ai_model);
  if (settings.default_commission_rate !== undefined) setSetting('default_commission_rate', settings.default_commission_rate.toString());
  if (settings.default_stamp_tax_rate !== undefined) setSetting('default_stamp_tax_rate', settings.default_stamp_tax_rate.toString());
  if (settings.custom_strategies !== undefined) setSetting('custom_strategies', JSON.stringify(settings.custom_strategies));
  if (settings.custom_tags !== undefined) setSetting('custom_tags', JSON.stringify(settings.custom_tags));
  if (settings.is_setup_complete !== undefined) setSetting('is_setup_complete', settings.is_setup_complete.toString());
  // Longbridge 配置
  if (settings.longbridgeAppKey !== undefined) setSetting('longbridge_app_key', settings.longbridgeAppKey);
  if (settings.longbridgeAppSecret !== undefined) setSetting('longbridge_app_secret', settings.longbridgeAppSecret);
  if (settings.longbridgeAccessToken !== undefined) setSetting('longbridge_access_token', settings.longbridgeAccessToken);
  // 预警设置
  if (settings.alert_enabled !== undefined) setSetting('alert_enabled', settings.alert_enabled.toString());
  if (settings.alert_interval !== undefined) setSetting('alert_interval', settings.alert_interval.toString());
  if (settings.consecutive_loss_threshold !== undefined) setSetting('consecutive_loss_threshold', settings.consecutive_loss_threshold.toString());
  // 自动备份设置
  if (settings.auto_backup_enabled !== undefined) setSetting('auto_backup_enabled', settings.auto_backup_enabled.toString());
  if (settings.auto_backup_frequency !== undefined) setSetting('auto_backup_frequency', settings.auto_backup_frequency);
  // 本地AI设置
  if (settings.local_ai_enabled !== undefined) setSetting('local_ai_enabled', settings.local_ai_enabled.toString());
  if (settings.local_ai_endpoint !== undefined) setSetting('local_ai_endpoint', settings.local_ai_endpoint);
  if (settings.local_ai_model !== undefined) setSetting('local_ai_model', settings.local_ai_model);
}

export function saveApiKey(apiKey: string): void {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      setSetting('api_key_encrypted', encrypted.toString('base64'));
    } else {
      setSetting('api_key_encrypted', apiKey);
    }
  } catch {
    setSetting('api_key_encrypted', apiKey);
  }
}

export function getApiKey(): string {
  const encrypted = getSetting('api_key_encrypted');
  if (!encrypted) return '';

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    }
    return encrypted;
  } catch {
    return encrypted;
  }
}

// 测试 Ollama 连接
export async function testOllamaConnection(): Promise<{ success: boolean; message: string; models?: string[] }> {
  const endpoint = getSetting('local_ai_endpoint') || 'http://localhost:11434';

  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return { success: false, message: `Ollama 服务返回错误: ${response.status} ${response.statusText}` };
    }

    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];

    if (models.length === 0) {
      return { success: false, message: '未找到已安装的模型，请运行 "ollama pull <model-name>" 安装模型' };
    }

    return { success: true, message: `连接成功! 已安装模型: ${models.join(', ')}`, models };
  } catch (error: any) {
    return { success: false, message: `无法连接到 Ollama: ${error.message}. 请确保 Ollama 已启动。` };
  }
}
