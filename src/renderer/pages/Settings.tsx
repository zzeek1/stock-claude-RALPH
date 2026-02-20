import React, { useEffect, useState, useRef } from 'react';
import {
  Card, Form, InputNumber, Input, Button, Select, Space, Divider,
  Typography, message, Tag, Switch, Modal, DatePicker, Table, Upload,
  Descriptions, Progress, Popconfirm, Empty, Tabs, Row, Col, Alert,
} from 'antd';
import { SaveOutlined, PlusOutlined, MinusCircleOutlined, ExportOutlined, ImportOutlined, PlusCircleOutlined, UploadOutlined, SyncOutlined, SettingOutlined, DeleteOutlined, FlagOutlined, WarningOutlined, EditOutlined } from '@ant-design/icons';
import { useSettingsStore, useThemeStore, useGoalStore } from '../stores';
import type { TradingGoal, GoalPeriod, TradingAccount } from '../../shared/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface SnapshotRecord {
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

const Settings: React.FC = () => {
  const { settings, fetchSettings, saveSettings } = useSettingsStore();
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const { goals, fetchGoals, saveGoal, deleteGoal } = useGoalStore();
  const [form] = Form.useForm();
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [saving, setSaving] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [snapshotModalVisible, setSnapshotModalVisible] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<TradingGoal | null>(null);
  const [goalForm] = Form.useForm();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [accountForm] = Form.useForm();
  const [testingOllama, setTestingOllama] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
    loadApiKey();
    fetchGoals();
    loadAccounts();
  }, []);

  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        initial_capital: settings.initial_capital,
        default_commission_rate: settings.default_commission_rate * 100,
        default_stamp_tax_rate: settings.default_stamp_tax_rate * 100,
        ai_model: settings.ai_model,
        custom_strategies: settings.custom_strategies,
        custom_tags: settings.custom_tags,
        longbridgeAppKey: settings.longbridgeAppKey,
        longbridgeAppSecret: settings.longbridgeAppSecret,
        longbridgeAccessToken: settings.longbridgeAccessToken,
        alert_enabled: settings.alert_enabled !== false,
        alert_interval: settings.alert_interval || 60,
        consecutive_loss_threshold: settings.consecutive_loss_threshold || 3,
        auto_backup_enabled: settings.auto_backup_enabled !== false,
        auto_backup_frequency: settings.auto_backup_frequency || 'daily',
        cloud_folder_path: settings.cloud_folder_path || '',
        cloud_backup_encrypted: settings.cloud_backup_encrypted || false,
        local_ai_enabled: settings.local_ai_enabled || false,
        local_ai_endpoint: settings.local_ai_endpoint || 'http://localhost:11434',
        local_ai_model: settings.local_ai_model || 'llama2',
      });
    }
  }, [settings]);

  const loadApiKey = async () => {
    const result = await window.electronAPI.settings.getApiKey();
    if (result.success && result.data) {
      const key = result.data as string;
      if (key) {
        setApiKeyMasked(key.slice(0, 10) + '...' + key.slice(-4));
      }
    }
  };

  const loadSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const result = await window.electronAPI.accountSnapshot.listSnapshots();
      if (result.success && result.data) {
        setSnapshots(result.data as SnapshotRecord[]);
      }
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const result = await window.electronAPI.accountMgmt.list();
      if (result.success && result.data) {
        setAccounts(result.data);
        const active = result.data.find((a: TradingAccount) => a.is_active);
        if (active) {
          setActiveAccountId(active.id);
        }
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const [snapshotForm] = Form.useForm();

  const handleAddSnapshot = async (values: any) => {
    try {
      const snapshot = {
        date: values.snapshot_date.format('YYYY-MM-DD'),
        total_assets: values.total_assets,
        cash: values.cash,
        market_value: values.market_value,
        daily_pnl: values.daily_pnl || 0,
        daily_return: values.daily_return || 0,
        cumulative_return: values.cumulative_return || 0,
      };
      const result = await window.electronAPI.account.saveSnapshot(snapshot);
      if (result.success) {
        message.success('账户快照已保存');
        setSnapshotModalVisible(false);
        snapshotForm.resetFields();
        loadSnapshots();
      } else {
        message.error(result.error || '保存失败');
      }
    } catch (err: any) {
      message.error(err?.message || '保存失败');
    }
  };

  const handleAutoSnapshot = async () => {
    try {
      const result = await window.electronAPI.account.autoSnapshot();
      if (result.success) {
        message.success('自动快照已生成并保存');
        loadSnapshots();
      } else {
        message.error(result.error || '生成快照失败');
      }
    } catch (err: any) {
      message.error(err?.message || '生成快照失败');
    }
  };

  const handleTestOllama = async () => {
    setTestingOllama(true);
    setOllamaStatus(null);
    try {
      const result = await window.electronAPI.settings.testOllama();
      setOllamaStatus(result);
    } catch (err: any) {
      setOllamaStatus({ success: false, message: err?.message || '测试失败' });
    } finally {
      setTestingOllama(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      await saveSettings({
        initial_capital: values.initial_capital,
        default_commission_rate: values.default_commission_rate / 100,
        default_stamp_tax_rate: values.default_stamp_tax_rate / 100,
        ai_model: values.ai_model,
        custom_strategies: values.custom_strategies || [],
        custom_tags: values.custom_tags || [],
        is_setup_complete: true,
        // Longbridge 配置
        longbridgeAppKey: values.longbridgeAppKey || '',
        longbridgeAppSecret: values.longbridgeAppSecret || '',
        longbridgeAccessToken: values.longbridgeAccessToken || '',
        // 预警设置
        alert_enabled: values.alert_enabled,
        alert_interval: values.alert_interval || 60,
        consecutive_loss_threshold: values.consecutive_loss_threshold || 3,
        // 自动备份设置
        auto_backup_enabled: values.auto_backup_enabled,
        auto_backup_frequency: values.auto_backup_frequency || 'daily',
        cloud_folder_path: values.cloud_folder_path || '',
        cloud_backup_encrypted: values.cloud_backup_encrypted || false,
        // 本地AI设置
        local_ai_enabled: values.local_ai_enabled || false,
        local_ai_endpoint: values.local_ai_endpoint || 'http://localhost:11434',
        local_ai_model: values.local_ai_model || 'llama2',
      });

      if (apiKey) {
        await window.electronAPI.settings.saveApiKey(apiKey);
        setApiKeyMasked(apiKey.slice(0, 10) + '...' + apiKey.slice(-4));
        setApiKey('');
      }

      message.success('设置已保存');
    } catch (err) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleBackupExport = async () => {
    try {
      const result = await window.electronAPI.backup.export();
      if (result.success) {
        message.success('数据库已导出到: ' + result.data);
      } else if (result.error !== '用户取消') {
        message.error(result.error || '导出失败');
      }
    } catch (err) {
      message.error('导出失败');
    }
  };

  const handleBackupImport = async () => {
    try {
      const result = await window.electronAPI.backup.import();
      if (result.success) {
        message.success('数据库已恢复，系统将刷新');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else if (result.error !== '用户取消') {
        message.error(result.error || '恢复失败');
      }
    } catch (err) {
      message.error('恢复失败');
    }
  };

  // 加密备份
  const handleEncryptedExport = async () => {
    try {
      const result = await window.electronAPI.backup.exportEncrypted();
      if (result.success) {
        message.success('加密备份已导出到: ' + result.data);
      } else if (result.error !== '用户取消') {
        message.error(result.error || '导出失败');
      }
    } catch (err) {
      message.error('导出失败');
    }
  };

  const handleEncryptedImport = async () => {
    try {
      const result = await window.electronAPI.backup.importEncrypted();
      if (result.success) {
        message.success('加密备份已恢复，系统将刷新');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else if (result.error !== '用户取消') {
        message.error(result.error || '恢复失败');
      }
    } catch (err) {
      message.error('恢复失败');
    }
  };

  // 云同步
  const handleCloudSync = async () => {
    try {
      const cloudFolder = settings.cloud_folder_path;
      if (!cloudFolder) {
        message.warning('请先设置云同步文件夹路径');
        return;
      }
      const result = await window.electronAPI.backup.cloudSync({
        enabled: true,
        provider: 'folder',
        folder_path: cloudFolder,
        encrypted: settings.cloud_backup_encrypted || false,
      });
      if (result.success) {
        message.success('已同步到云文件夹: ' + result.data);
      } else {
        message.error(result.error || '同步失败');
      }
    } catch (err) {
      message.error('同步失败');
    }
  };

  // 账户管理
  const handleCreateAccount = async (values: any) => {
    try {
      const result = await window.electronAPI.accountMgmt.create({
        name: values.account_name,
        account_type: values.account_type,
        initial_capital: values.initial_capital,
        broker_name: values.broker_name,
        account_number: values.account_number,
      });
      if (result.success) {
        message.success('账户已创建');
        loadAccounts();
        setAccountModalVisible(false);
        accountForm.resetFields();
      } else {
        message.error(result.error || '创建失败');
      }
    } catch (err) {
      message.error('创建失败');
    }
  };

  const handleSwitchAccount = async (accountId: string) => {
    try {
      const result = await window.electronAPI.accountMgmt.setActive(accountId);
      if (result.success) {
        message.success('已切换账户');
        loadAccounts();
      } else {
        message.error(result.error || '切换失败');
      }
    } catch (err) {
      message.error('切换失败');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const result = await window.electronAPI.accountMgmt.delete(accountId);
      if (result.success) {
        message.success('账户已删除');
        loadAccounts();
      } else {
        message.error(result.error || '删除失败');
      }
    } catch (err: any) {
      message.error(err?.message || '删除失败');
    }
  };

  const handleStockCsvImport = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        const result = await window.electronAPI.stock.importCsv(content);
        if (result.success && result.data) {
          message.success(`成功导入 ${result.data.added} 只股票，当前共 ${result.data.total} 只`);
        } else {
          message.error(result.error || '导入失败');
        }
      };
      reader.readAsText(file);
      return false; // Prevent default upload behavior
    } catch (err) {
      message.error('导入失败');
      return false;
    }
  };

  const handleAddGoal = () => {
    setEditingGoal(null);
    goalForm.resetFields();
    const now = new Date();
    goalForm.setFieldsValue({
      period: 'monthly',
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
    setGoalModalVisible(true);
  };

  const handleEditGoal = (goal: TradingGoal) => {
    setEditingGoal(goal);
    goalForm.setFieldsValue({
      id: goal.id,
      period: goal.period,
      year: goal.year,
      month: goal.month,
      target_return: goal.target_return ? goal.target_return * 100 : undefined,
      target_win_rate: goal.target_win_rate ? goal.target_win_rate * 100 : undefined,
      target_profit_loss_ratio: goal.target_profit_loss_ratio,
      target_max_drawdown: goal.target_max_drawdown ? goal.target_max_drawdown * 100 : undefined,
      target_trade_count: goal.target_trade_count,
    });
    setGoalModalVisible(true);
  };

  const handleSaveGoal = async () => {
    try {
      const values = await goalForm.validateFields();
      const goalData = {
        id: editingGoal?.id,
        period: values.period,
        year: values.year,
        month: values.period === 'monthly' ? values.month : undefined,
        target_return: values.target_return ? values.target_return / 100 : undefined,
        target_win_rate: values.target_win_rate ? values.target_win_rate / 100 : undefined,
        target_profit_loss_ratio: values.target_profit_loss_ratio,
        target_max_drawdown: values.target_max_drawdown ? values.target_max_drawdown / 100 : undefined,
        target_trade_count: values.target_trade_count,
      };
      const result = await saveGoal(goalData);
      if (result) {
        message.success(editingGoal ? '目标已更新' : '目标已创建');
        setGoalModalVisible(false);
      }
    } catch (err: any) {
      message.error(err?.message || '保存失败');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    await deleteGoal(id);
    message.success('目标已删除');
  };

  // 账户创建Modal
  const AccountModal = (
    <Modal
      title="新增账户"
      open={accountModalVisible}
      onCancel={() => setAccountModalVisible(false)}
      footer={null}
    >
      <Form form={accountForm} layout="vertical" onFinish={handleCreateAccount}>
        <Form.Item
          label="账户名称"
          name="account_name"
          rules={[{ required: true, message: '请输入账户名称' }]}
        >
          <Input placeholder="例如：主账户、模拟账户" />
        </Form.Item>
        <Form.Item
          label="账户类型"
          name="account_type"
          rules={[{ required: true, message: '请选择账户类型' }]}
        >
          <Select
            options={[
              { label: '实盘账户', value: 'real' },
              { label: '模拟账户', value: 'simulated' },
            ]}
          />
        </Form.Item>
        <Form.Item
          label="初始资金"
          name="initial_capital"
          rules={[{ required: true, message: '请输入初始资金' }]}
        >
          <InputNumber style={{ width: '100%' }} min={0} step={10000} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '元'} />
        </Form.Item>
        <Form.Item label="券商名称" name="broker_name">
          <Input placeholder="可选" />
        </Form.Item>
        <Form.Item label="账户号码" name="account_number">
          <Input placeholder="可选（部分显示）" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            创建账户
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );

  return (
    <div>
      <Title level={4}>系统设置</Title>

      {AccountModal}

      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Card title="外观设置" style={{ marginBottom: 16 }}>
          <Form.Item label="深色模式">
            <Switch
              checked={isDarkMode}
              onChange={toggleDarkMode}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Form.Item>
        </Card>

        <Card title="快捷键" style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="新建交易"><Tag>Ctrl + N</Tag></Descriptions.Item>
            <Descriptions.Item label="保存表单"><Tag>Ctrl + S</Tag></Descriptions.Item>
            <Descriptions.Item label="刷新页面"><Tag>Ctrl + R</Tag></Descriptions.Item>
            <Descriptions.Item label="关闭弹窗"><Tag>Esc</Tag></Descriptions.Item>
          </Descriptions>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            快捷键在应用启动时自动注册，全局可用。
          </Text>
        </Card>

        <Card title="账户设置" style={{ marginBottom: 16 }}>
          <Form.Item
            label="初始资金"
            name="initial_capital"
            rules={[{ required: true, message: '请输入初始资金' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={10000}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              addonAfter="元"
            />
          </Form.Item>

          <Form.Item
            label="默认佣金费率 (%)"
            name="default_commission_rate"
          >
            <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.001} addonAfter="%" />
          </Form.Item>

          <Form.Item
            label="默认印花税率 (%)"
            name="default_stamp_tax_rate"
          >
            <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.001} addonAfter="%" />
          </Form.Item>
        </Card>

        <Card
          title="多账户管理"
          style={{ marginBottom: 16 }}
          extra={
            <Button type="primary" size="small" onClick={() => setAccountModalVisible(true)}>
              新增账户
            </Button>
          }
        >
          <List
            size="small"
            dataSource={accounts}
            renderItem={(account) => (
              <List.Item
                actions={[
                  account.is_active ? (
                    <Tag color="green">当前</Tag>
                  ) : (
                    <Button type="link" size="small" onClick={() => handleSwitchAccount(account.id)}>
                      切换
                    </Button>
                  ),
                  accounts.length > 1 && (
                    <Popconfirm
                      title="确定删除此账户？"
                      onConfirm={() => handleDeleteAccount(account.id)}
                    >
                      <Button type="link" danger size="small">
                        删除
                      </Button>
                    </Popconfirm>
                  ),
                ]}
              >
                <List.Item.Meta
                  title={account.name}
                  description={
                    <Space>
                      <Tag color={account.account_type === 'real' ? 'blue' : 'orange'}>
                        {account.account_type === 'real' ? '实盘' : '模拟'}
                      </Tag>
                      <Text type="secondary">初始资金: {account.initial_capital.toLocaleString()}元</Text>
                      {account.broker_name && <Text type="secondary">{account.broker_name}</Text>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
          {accounts.length === 0 && (
            <Empty description="暂无账户，请添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        <Card title="AI 设置" style={{ marginBottom: 16 }}>
          <Form.Item label="使用本地AI (Ollama)" name="local_ai_enabled" valuePropName="checked">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>

          {form.getFieldValue('local_ai_enabled') ? (
            <>
              <Form.Item label="Ollama 地址" name="local_ai_endpoint" tooltip="Ollama 服务的地址">
                <Input placeholder="http://localhost:11434" />
              </Form.Item>
              <Form.Item label="本地模型" name="local_ai_model" tooltip="已安装的 Ollama 模型">
                <Input placeholder="llama2" />
              </Form.Item>
              <Button
                onClick={handleTestOllama}
                loading={testingOllama}
                style={{ marginBottom: 8 }}
              >
                测试连接
              </Button>
              {ollamaStatus && (
                <Text
                  type={ollamaStatus.success ? 'success' : 'danger'}
                  style={{ fontSize: 12, display: 'block', marginBottom: 16 }}
                >
                  {ollamaStatus.message}
                </Text>
              )}
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
                请确保 Ollama 已启动并安装了对应模型。可在终端运行 "ollama list" 查看已安装模型。
              </Text>
            </>
          ) : (
            <>
              <Form.Item label="API Key">
                <Space.Compact style={{ width: '100%' }}>
                  <Input.Password
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={apiKeyMasked || '请输入 Anthropic API Key'}
                  />
                </Space.Compact>
                {apiKeyMasked && !apiKey && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    已配置: {apiKeyMasked}
                  </Text>
                )}
              </Form.Item>

              <Form.Item label="AI 模型" name="ai_model">
                <Select
                  options={[
                    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
                    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
                    { value: 'claude-haiku-4-20250514', label: 'Claude Haiku 4' },
                  ]}
                />
              </Form.Item>
            </>
          )}
        </Card>

        <Card title="实时行情 (Longbridge)" style={{ marginBottom: 16 }}>
          <Form.Item
            label="App Key"
            name="longbridgeAppKey"
          >
            <Input.Password placeholder="从 Longbridge 用户中心获取" />
          </Form.Item>

          <Form.Item
            label="App Secret"
            name="longbridgeAppSecret"
          >
            <Input.Password placeholder="从 Longbridge 用户中心获取" />
          </Form.Item>

          <Form.Item
            label="Access Token"
            name="longbridgeAccessToken"
          >
            <Input.Password placeholder="从 Longbridge 用户中心获取" />
          </Form.Item>
          
          <Text type="secondary" style={{ fontSize: 12 }}>
            申请地址: <a href="https://open.longbridge.com/" target="_blank" rel="noopener noreferrer">https://open.longbridge.com/</a>
          </Text>
        </Card>

        <Card title="价格预警" style={{ marginBottom: 16 }}>
          <Form.Item label="启用预警" name="alert_enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            label="检查间隔(秒)"
            name="alert_interval"
            tooltip="价格检查的时间间隔，建议设为60秒"
          >
            <InputNumber min={30} max={300} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="连续亏损阈值"
            name="consecutive_loss_threshold"
            tooltip="连续多少笔亏损后提醒"
          >
            <InputNumber min={2} max={10} style={{ width: '100%' }} />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            message="预警说明"
            description="当持仓价格触及止损/止盈位，或连续亏损达到阈值时，将发送桌面通知。需开启系统通知权限。"
            style={{ marginTop: 8 }}
          />
        </Card>

        <Card title="自定义选项" style={{ marginBottom: 16 }}>
          <Form.Item label="策略列表" name="custom_strategies">
            <Select
              mode="tags"
              placeholder="输入策略名称后回车添加"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label="标签列表" name="custom_tags">
            <Select
              mode="tags"
              placeholder="输入标签名称后回车添加"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Card>

        <Card
          title="账户快照"
          style={{ marginBottom: 16 }}
          extra={
            <Space>
              <Button
                icon={<SyncOutlined />}
                size="small"
                onClick={() => {
                  loadSnapshots();
                  handleAutoSnapshot();
                }}
              >
                自动生成
              </Button>
              <Button
                type="primary"
                icon={<PlusCircleOutlined />}
                size="small"
                onClick={() => {
                  loadSnapshots();
                  setSnapshotModalVisible(true);
                }}
              >
                手动添加
              </Button>
            </Space>
          }
        >
          <Table
            dataSource={snapshots}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5 }}
            columns={[
              { title: '日期', dataIndex: 'date', key: 'date' },
              { title: '总资产', dataIndex: 'total_assets', key: 'total_assets', render: (v: number) => v?.toFixed(2) },
              { title: '现金', dataIndex: 'cash', key: 'cash', render: (v: number) => v?.toFixed(2) },
              { title: '市值', dataIndex: 'market_value', key: 'market_value', render: (v: number) => v?.toFixed(2) },
              { title: '当日盈亏', dataIndex: 'daily_pnl', key: 'daily_pnl', render: (v: number) => v?.toFixed(2) },
              { title: '当日收益率', dataIndex: 'daily_return', key: 'daily_return', render: (v: number) => v ? `${(v * 100).toFixed(2)}%` : '-' },
            ]}
            loading={loadingSnapshots}
          />
        </Card>

        <Card title="数据备份" style={{ marginBottom: 16 }}>
          <Typography.Paragraph type="secondary">
            导出数据库备份文件，或从备份文件恢复数据。恢复前系统会自动创建自动备份。
          </Typography.Paragraph>
          <Form.Item
            label="自动备份"
            name="auto_backup_enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="备份频率"
            name="auto_backup_frequency"
            tooltip="每天或每周自动备份一次"
          >
            <Select>
              <Select.Option value="daily">每天</Select.Option>
              <Select.Option value="weekly">每周</Select.Option>
            </Select>
          </Form.Item>
          <Space>
            <Button
              icon={<ExportOutlined />}
              onClick={handleBackupExport}
            >
              导出备份
            </Button>
            <Button
              icon={<ImportOutlined />}
              onClick={() => setImportModalVisible(true)}
            >
              恢复数据
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={handleEncryptedExport}
            >
              导出加密备份
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={handleEncryptedImport}
            >
              恢复加密备份
            </Button>
          </Space>
        </Card>

        <Card title="云同步备份" style={{ marginBottom: 16 }}>
          <Typography.Paragraph type="secondary">
            将加密备份同步到云文件夹（如OneDrive、 Google Drive、Dropbox等），实现跨设备同步。
          </Typography.Paragraph>
          <Form.Item
            label="云同步文件夹"
            name="cloud_folder_path"
            tooltip="选择一个云同步服务的本地文件夹（如 OneDrive、 Google Drive、Dropbox的同步文件夹）"
          >
            <Input placeholder="例如：C:\Users\你的用户名\OneDrive\备份" />
          </Form.Item>
          <Form.Item
            label="加密备份"
            name="cloud_backup_encrypted"
            valuePropName="checked"
            tooltip="启用后备份文件将加密，只有在此设备上才能解密恢复"
          >
            <Switch />
          </Form.Item>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={handleCloudSync}
            disabled={!settings.cloud_folder_path}
          >
            立即同步到云文件夹
          </Button>
        </Card>

        <Card title="股票代码管理" style={{ marginBottom: 16 }}>
          <Typography.Paragraph type="secondary">
            导入股票代码CSV文件以扩充可选股票列表。CSV格式：股票代码,股票名称（每行一条）
          </Typography.Paragraph>
          <Upload
            accept=".csv,.txt"
            showUploadList={false}
            beforeUpload={handleStockCsvImport}
          >
            <Button icon={<UploadOutlined />}>
              导入股票代码CSV
            </Button>
          </Upload>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            当前内置约100只常用股票，支持A股、港股、美股。导入CSV可添加更多股票。
          </Typography.Paragraph>
        </Card>

        <Card
          title={
            <span>
              <FlagOutlined style={{ marginRight: 8 }} />
              交易目标
            </span>
          }
          style={{ marginBottom: 16 }}
          extra={
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAddGoal}>
              添加目标
            </Button>
          }
        >
          {goals.length > 0 ? (
            <Table
              dataSource={goals}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
              columns={[
                { 
                  title: '周期', 
                  dataIndex: 'period', 
                  key: 'period',
                  render: (period: string, record: TradingGoal) => 
                    period === 'monthly' ? `${record.year}年${record.month}月` : `${record.year}年`
                },
                { title: '收益率目标', dataIndex: 'target_return', key: 'target_return', render: (v: number) => v ? `${(v * 100).toFixed(1)}%` : '-' },
                { title: '胜率目标', dataIndex: 'target_win_rate', key: 'target_win_rate', render: (v: number) => v ? `${(v * 100).toFixed(1)}%` : '-' },
                { title: '盈亏比目标', dataIndex: 'target_profit_loss_ratio', key: 'target_profit_loss_ratio', render: (v: number) => v ? v.toFixed(2) : '-' },
                { title: '交易次数目标', dataIndex: 'target_trade_count', key: 'target_trade_count', render: (v: number) => v ? `${v}次` : '-' },
                {
                  title: '操作',
                  key: 'action',
                  render: (_: any, record: TradingGoal) => (
                    <Space>
                      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditGoal(record)}>
                        编辑
                      </Button>
                      <Popconfirm
                        title="确定删除此目标？"
                        onConfirm={() => handleDeleteGoal(record.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          ) : (
            <Empty description="暂无目标设置，点击添加按钮创建" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
          size="large"
          block
        >
          保存设置
        </Button>
      </Form>

      <Modal
        title="确认恢复数据"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onOk={handleBackupImport}
        okText="确认恢复"
        okButtonProps={{ danger: true }}
      >
        <Typography.Paragraph>
          恢复数据库将覆盖当前所有数据。此操作不可撤销。
        </Typography.Paragraph>
        <Typography.Paragraph>
          系统会在恢复前自动创建一个备份文件，保存在应用数据目录中。
        </Typography.Paragraph>
      </Modal>

      <Modal
        title="添加账户快照"
        open={snapshotModalVisible}
        onCancel={() => {
          setSnapshotModalVisible(false);
          snapshotForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={snapshotForm}
          layout="vertical"
          onFinish={handleAddSnapshot}
        >
          <Form.Item
            label="快照日期"
            name="snapshot_date"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="总资产 (元)"
            name="total_assets"
            rules={[{ required: true, message: '请输入总资产' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={1000}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item
            label="现金 (元)"
            name="cash"
            rules={[{ required: true, message: '请输入现金' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={1000}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item
            label="持仓市值 (元)"
            name="market_value"
            rules={[{ required: true, message: '请输入持仓市值' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={1000}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item
            label="当日盈亏 (元)"
            name="daily_pnl"
          >
            <InputNumber
              style={{ width: '100%' }}
              step={100}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item
            label="当日收益率 (%)"
            name="daily_return"
          >
            <InputNumber
              style={{ width: '100%' }}
              step={0.1}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              addonAfter="%"
            />
          </Form.Item>

          <Form.Item
            label="累计收益率 (%)"
            name="cumulative_return"
          >
            <InputNumber
              style={{ width: '100%' }}
              step={0.1}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              addonAfter="%"
            />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setSnapshotModalVisible(false);
                snapshotForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingGoal ? '编辑交易目标' : '添加交易目标'}
        open={goalModalVisible}
        onCancel={() => setGoalModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={goalForm}
          layout="vertical"
          initialValues={{
            period: 'monthly',
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
          }}
        >
          <Form.Item
            label="目标周期"
            name="period"
            rules={[{ required: true, message: '请选择周期' }]}
          >
            <Select
              options={[
                { value: 'monthly', label: '月度目标' },
                { value: 'yearly', label: '年度目标' },
              ]}
              onChange={(value) => {
                if (value === 'yearly') {
                  goalForm.setFieldsValue({ month: undefined });
                }
              }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="年份"
                name="year"
                rules={[{ required: true, message: '请输入年份' }]}
              >
                <InputNumber style={{ width: '100%' }} min={2020} max={2030} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="月份"
                name="month"
                rules={[{ required: true, message: '请选择月份' }]}
              >
                <Select
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: i + 1,
                    label: `${i + 1}月`,
                  }))}
                  disabled={goalForm.getFieldValue('period') === 'yearly'}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="收益率目标 (%)"
            name="target_return"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={100}
              step={0.1}
              placeholder="如: 10 表示目标收益10%"
            />
          </Form.Item>

          <Form.Item
            label="胜率目标 (%)"
            name="target_win_rate"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={100}
              step={1}
              placeholder="如: 60 表示目标胜率60%"
            />
          </Form.Item>

          <Form.Item
            label="盈亏比目标"
            name="target_profit_loss_ratio"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={0.1}
              placeholder="如: 2.0 表示止盈:止损 = 2:1"
            />
          </Form.Item>

          <Form.Item
            label="最大回撤目标 (%)"
            name="target_max_drawdown"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={100}
              step={1}
              placeholder="如: 15 表示最大回撤不超过15%"
            />
          </Form.Item>

          <Form.Item
            label="交易次数目标"
            name="target_trade_count"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={1}
              placeholder="如: 20 表示本月计划交易20次"
            />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setGoalModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" onClick={handleSaveGoal}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Settings;
