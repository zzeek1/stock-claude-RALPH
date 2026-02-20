import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Radio,
  AutoComplete,
  Collapse,
  Button,
  Switch,
  Rate,
  Checkbox,
  message,
  Space,
  Card,
  Typography,
  Divider,
  Row,
  Col,
  Tooltip,
} from 'antd';
import { SaveOutlined, ClearOutlined, ThunderboltOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { StockCode, Market, Direction, Emotion, MarketTrend, PlanExecuted } from '../../shared/types';
import { useSettingsStore } from '../stores';
import { useSaveCallback } from '../components/Layout/AppLayout';

const { TextArea } = Input;
const { Title } = Typography;
const { Option } = Select;

interface StockOption {
  value: string;
  label: string;
  stockData: StockCode;
}

const emotionOptions: Emotion[] = ['冷静', '兴奋', '焦虑', '恐惧', '贪婪', '犹豫', '自信', '沮丧'];
const marketTrendOptions: MarketTrend[] = ['上涨', '下跌', '震荡', '不确定'];
const planExecutedOptions: { label: string; value: PlanExecuted }[] = [
  { label: '按计划执行', value: 'EXECUTED' },
  { label: '部分执行', value: 'PARTIAL' },
  { label: '错过计划', value: 'MISSED' },
];
const marketOptions: { label: string; value: Market }[] = [
  { label: '上海 (SH)', value: 'SH' },
  { label: '深圳 (SZ)', value: 'SZ' },
  { label: '北京 (BJ)', value: 'BJ' },
  { label: '香港 (HK)', value: 'HK' },
  { label: '美国 (US)', value: 'US' },
];

const NewTrade: React.FC = () => {
  const [form] = Form.useForm();
  const [quickMode, setQuickMode] = useState(false);
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeKeys, setActiveKeys] = useState<string[]>(['basic', 'cost']);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { settings, fetchSettings } = useSettingsStore();
  const { setSaveCallback, clearSaveCallback } = useSaveCallback();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Register save callback for Ctrl+S
  useEffect(() => {
    setSaveCallback(() => {
      form.submit();
    });
    return () => clearSaveCallback();
  }, [form, setSaveCallback, clearSaveCallback]);

  // Strategy options from settings
  const strategyOptions = useMemo(() => {
    return settings?.custom_strategies || [];
  }, [settings]);

  // Debounced stock search
  const handleStockSearch = useCallback((keyword: string) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!keyword || keyword.trim().length === 0) {
      setStockOptions([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        const result = await window.electronAPI.stock.search(keyword.trim());
        if (result.success && result.data) {
          const stocks = result.data as StockCode[];
          const options: StockOption[] = stocks.map((stock) => ({
            value: stock.code,
            label: `${stock.code} - ${stock.name}`,
            stockData: stock,
          }));
          setStockOptions(options);
        }
      } catch {
        // Silently ignore search errors
      }
    }, 300);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // Handle stock selection from autocomplete
  const handleStockSelect = useCallback(
    async (_value: string, option: any) => {
      const stockOption = option as StockOption;
      if (stockOption.stockData) {
        form.setFieldsValue({
          stock_name: stockOption.stockData.name,
          market: stockOption.stockData.market,
        });

        // 自动获取实时价格
        fetchRealTimePrice(stockOption.stockData.code, stockOption.stockData.market);
      }
    },
    [form],
  );

  // Recalculate cost fields
  const recalculateCosts = useCallback(() => {
    const price = form.getFieldValue('price') || 0;
    const quantity = form.getFieldValue('quantity') || 0;
    const direction: Direction = form.getFieldValue('direction') || 'BUY';

    const amount = price * quantity;
    const commissionRate = settings?.default_commission_rate ?? 0.00025;
    const stampTaxRate = settings?.default_stamp_tax_rate ?? 0.0005;
    const commission = Math.max(amount * commissionRate, amount > 0 ? 0.01 : 0);
    const stampTax = direction === 'SELL' ? amount * stampTaxRate : 0;
    const totalCost = amount + commission + stampTax;

    form.setFieldsValue({
      amount: Math.round(amount * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      stamp_tax: Math.round(stampTax * 100) / 100,
      total_cost: Math.round(totalCost * 100) / 100,
    });
  }, [form, settings]);

  // 获取实时价格
  const fetchRealTimePrice = useCallback(async (code: string, market: Market) => {
    try {
      // 转换代码格式: A股 600519 -> 600519.SH, 美股 QQQ -> QQQ.US, 港股 00700 -> 00700.HK
      let symbol = code;
      if (market === 'SH') symbol = code + '.SH';
      else if (market === 'SZ') symbol = code + '.SZ';
      else if (market === 'HK') symbol = code + '.HK';
      else if (market === 'US') symbol = code + '.US';

      const result = await window.electronAPI.quote.get([symbol]);
      if (result.success && result.data && result.data.length > 0) {
        const quote = result.data[0];
        const price = parseFloat(quote.lastDone);
        if (price > 0) {
          form.setFieldsValue({ price });
          message.success(`已获取实时价格: $${quote.lastDone}`);
          recalculateCosts();
        }
      }
    } catch (err) {
      console.error('获取实时价格失败:', err);
    }
  }, [form, recalculateCosts]);

  // Handle direction change
  const handleDirectionChange = useCallback(() => {
    recalculateCosts();
  }, [recalculateCosts]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (values: any) => {
      setSubmitting(true);
      try {
        // Format trade_date to string
        const submitValues = {
          ...values,
          trade_date: values.trade_date ? (values.trade_date as Dayjs).format('YYYY-MM-DD') : undefined,
          is_impulsive: values.is_impulsive || false,
        };

        const result = await window.electronAPI.trade.create(submitValues);
        if (result.success) {
          message.success('交易记录创建成功');
          form.resetFields();
          // Restore defaults after reset
          form.setFieldsValue({
            direction: 'BUY',
            trade_date: dayjs(),
            amount: 0,
            commission: 0,
            stamp_tax: 0,
            total_cost: 0,
          });
        } else {
          message.error(result.error || '创建失败，请重试');
        }
      } catch (err: any) {
        message.error(err?.message || '创建失败，请重试');
      } finally {
        setSubmitting(false);
      }
    },
    [form],
  );

  // Handle quick mode toggle
  const handleQuickModeChange = useCallback(
    (checked: boolean) => {
      setQuickMode(checked);
      if (checked) {
        setActiveKeys(['basic', 'cost']);
      } else {
        setActiveKeys(['basic', 'cost']);
      }
    },
    [],
  );

  // Handle collapse change
  const handleCollapseChange = useCallback((keys: string | string[]) => {
    setActiveKeys(typeof keys === 'string' ? [keys] : keys);
  }, []);

  // Collapse items
  const collapseItems = useMemo(() => {
    const items = [
      {
        key: 'basic',
        label: '基础信息',
        collapsible: 'header' as const,
        forceRender: true,
        children: (
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="stock_code"
                label="股票代码"
                rules={[{ required: true, message: '请输入股票代码' }]}
              >
                <AutoComplete
                  options={stockOptions}
                  onSearch={handleStockSearch}
                  onSelect={handleStockSelect}
                  placeholder="输入代码或名称搜索"
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="stock_name"
                label="股票名称"
                rules={[{ required: true, message: '请输入股票名称' }]}
              >
                <Input placeholder="选择股票后自动填入" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="market"
                label="市场"
                rules={[{ required: true, message: '请选择市场' }]}
              >
                <Select placeholder="选择市场" options={marketOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="direction"
                label="方向"
                rules={[{ required: true, message: '请选择方向' }]}
                initialValue="BUY"
              >
                <Radio.Group onChange={handleDirectionChange}>
                  <Radio.Button value="BUY">买入</Radio.Button>
                  <Radio.Button value="SELL">卖出</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="trade_date"
                label="交易日期"
                rules={[{ required: true, message: '请选择交易日期' }]}
                initialValue={dayjs()}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="price"
                label="价格"
                rules={[{ required: true, message: '请输入价格' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  precision={3}
                  placeholder="成交价格"
                  onChange={() => recalculateCosts()}
                />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Form.Item label=" " colon={false}>
                <Button 
                  type="link" 
                  onClick={() => {
                    const code = form.getFieldValue('stock_code');
                    const market = form.getFieldValue('market');
                    if (code && market) {
                      fetchRealTimePrice(code, market);
                    } else {
                      message.warning('请先选择股票');
                    }
                  }}
                >
                  实时价
                </Button>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="quantity"
                label="数量"
                rules={[{ required: true, message: '请输入数量' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={100}
                  precision={0}
                  placeholder="成交数量"
                  onChange={() => recalculateCosts()}
                />
              </Form.Item>
            </Col>
          </Row>
        ),
      },
      {
        key: 'cost',
        label: '费用计算',
        forceRender: true,
        children: (
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="amount" label="成交金额" initialValue={0}>
                <InputNumber
                  style={{ width: '100%' }}
                  precision={2}
                  disabled
                  addonAfter="元"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="commission" label="佣金" initialValue={0}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  precision={2}
                  addonAfter="元"
                  onChange={() => {
                    const commission = form.getFieldValue('commission') || 0;
                    const amount = form.getFieldValue('amount') || 0;
                    const stampTax = form.getFieldValue('stamp_tax') || 0;
                    form.setFieldsValue({
                      total_cost: Math.round((amount + commission + stampTax) * 100) / 100,
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="stamp_tax" label="印花税" initialValue={0}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  precision={2}
                  addonAfter="元"
                  onChange={() => {
                    const commission = form.getFieldValue('commission') || 0;
                    const amount = form.getFieldValue('amount') || 0;
                    const stampTax = form.getFieldValue('stamp_tax') || 0;
                    form.setFieldsValue({
                      total_cost: Math.round((amount + commission + stampTax) * 100) / 100,
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="total_cost" label="总费用" initialValue={0}>
                <InputNumber
                  style={{ width: '100%' }}
                  precision={2}
                  disabled
                  addonAfter="元"
                />
              </Form.Item>
            </Col>
          </Row>
        ),
      },
    ];

    if (!quickMode) {
      items.push(
        {
          key: 'strategy',
          label: '策略计划',
          forceRender: true,
          children: (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="strategy" label="策略">
                  <Select placeholder="选择策略" allowClear>
                    {strategyOptions.map((s) => (
                      <Option key={s} value={s}>
                        {s}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="stop_loss" label="止损价">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    step={0.01}
                    precision={3}
                    placeholder="止损价格"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="take_profit" label="止盈价">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    step={0.01}
                    precision={3}
                    placeholder="止盈价格"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="entry_reason" label="入场理由">
                  <TextArea rows={3} placeholder="描述入场理由..." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="exit_plan" label="出场计划">
                  <TextArea rows={3} placeholder="描述出场计划..." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="plan_executed" label="计划执行情况">
                  <Select placeholder="选择执行情况" allowClear>
                    {planExecutedOptions.map((p) => (
                      <Option key={p.value} value={p.value}>
                        {p.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          ),
        },
        {
          key: 'emotion',
          label: '心态环境',
          forceRender: true,
          children: (
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="emotion_before" label="交易前情绪">
                  <Select placeholder="选择情绪" allowClear>
                    {emotionOptions.map((e) => (
                      <Option key={e} value={e}>
                        {e}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="emotion_after" label="交易后情绪">
                  <Select placeholder="选择情绪" allowClear>
                    {emotionOptions.map((e) => (
                      <Option key={e} value={e}>
                        {e}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="confidence" label="信心程度">
                  <Rate />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="is_impulsive" valuePropName="checked" label=" ">
                  <Checkbox>冲动交易</Checkbox>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="market_trend" label="大盘趋势">
                  <Select placeholder="选择趋势" allowClear>
                    {marketTrendOptions.map((t) => (
                      <Option key={t} value={t}>
                        {t}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="sector_trend" label="板块趋势">
                  <Select placeholder="选择趋势" allowClear>
                    {marketTrendOptions.map((t) => (
                      <Option key={t} value={t}>
                        {t}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="tags" label="标签">
                  <Select mode="tags" placeholder="输入标签后回车" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="lesson" label="经验教训">
                  <TextArea rows={3} placeholder="记录本次交易的经验教训..." />
                </Form.Item>
              </Col>
            </Row>
          ),
        },
      );
    }

    return items;
  }, [
    quickMode,
    stockOptions,
    handleStockSearch,
    handleStockSelect,
    handleDirectionChange,
    recalculateCosts,
    strategyOptions,
    form,
  ]);

  return (
    <div>
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            新建交易
            <Tooltip title="快捷键: Ctrl+N 新建交易, Ctrl+S 保存, Esc 关闭">
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
            </Tooltip>
          </Title>
          <Space>
            <ThunderboltOutlined />
            <span>快速模式</span>
            <Switch checked={quickMode} onChange={handleQuickModeChange} />
          </Space>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            direction: 'BUY',
            trade_date: dayjs(),
            amount: 0,
            commission: 0,
            stamp_tax: 0,
            total_cost: 0,
          }}
        >
          <Collapse
            activeKey={activeKeys}
            onChange={handleCollapseChange}
            items={collapseItems}
            style={{ marginBottom: 24 }}
          />

          <Divider />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={submitting}
                size="large"
              >
                保存交易
              </Button>
              <Button
                icon={<ClearOutlined />}
                onClick={() => {
                  form.resetFields();
                  form.setFieldsValue({
                    direction: 'BUY',
                    trade_date: dayjs(),
                    amount: 0,
                    commission: 0,
                    stamp_tax: 0,
                    total_cost: 0,
                  });
                }}
                size="large"
              >
                重置表单
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default NewTrade;
