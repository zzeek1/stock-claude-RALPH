import React, { useEffect, useCallback, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Row,
  Col,
  InputNumber,
  Radio,
  Checkbox,
  Rate,
  AutoComplete,
  message
} from 'antd';
import dayjs from 'dayjs';
import type { Trade, Direction, Market, Emotion, MarketTrend, StockCode, Settings } from '../../../shared/types';

const { Option } = Select;

const emotionOptions: Emotion[] = ['冷静', '兴奋', '焦虑', '恐惧', '贪婪', '犹豫', '自信', '沮丧'];
const marketTrendOptions: MarketTrend[] = ['上涨', '下跌', '震荡', '不确定'];
const marketOptions: { label: string; value: Market }[] = [
  { label: '上海 (SH)', value: 'SH' },
  { label: '深圳 (SZ)', value: 'SZ' },
  { label: '北京 (BJ)', value: 'BJ' },
  { label: '香港 (HK)', value: 'HK' },
  { label: '美国 (US)', value: 'US' },
];

interface StockOption {
  value: string;
  label: string;
  stockData: StockCode;
}

interface EditTradeModalProps {
  visible: boolean;
  trade: Trade | null;
  onCancel: () => void;
  onSuccess: () => void;
  settings: Settings | null;
  updateTrade: (id: string, updates: Partial<Trade>) => Promise<boolean>;
}

const EditTradeModal: React.FC<EditTradeModalProps> = ({
  visible,
  trade,
  onCancel,
  onSuccess,
  settings,
  updateTrade,
}) => {
  const [form] = Form.useForm();
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);

  // Initialize form
  useEffect(() => {
    if (visible && trade) {
      form.setFieldsValue({
        ...trade,
        trade_date: dayjs(trade.trade_date),
        tags: trade.tags || [],
      });
      // Recalculate costs to ensure consistency
      recalculateEditCosts();
    } else {
      form.resetFields();
    }
  }, [visible, trade, form]);

  // Stock search
  const handleStockSearch = useCallback((keyword: string) => {
    if (!keyword || keyword.trim().length === 0) {
      setStockOptions([]);
      return;
    }
    // Debounce search
    const timer = setTimeout(async () => {
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
        // Silently ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Stock selection
  const handleStockSelect = useCallback((_value: string, option: any) => {
    const stockOption = option as StockOption;
    if (stockOption.stockData) {
      form.setFieldsValue({
        stock_name: stockOption.stockData.name,
        market: stockOption.stockData.market,
      });
    }
  }, [form]);

  // Recalculate costs
  const recalculateEditCosts = useCallback(() => {
    const price = form.getFieldValue('price') || 0;
    const quantity = form.getFieldValue('quantity') || 0;
    const direction: Direction = form.getFieldValue('direction') || 'BUY';

    const amount = price * quantity;
    const commissionRate = settings?.default_commission_rate ?? 0.00025;
    const stampTaxRate = settings?.default_stamp_tax_rate ?? 0.0005;
    const commission = Math.max(amount * commissionRate, amount > 0 ? 0.01 : 0);
    const stampTax = direction === 'SELL' ? amount * stampTaxRate : 0;
    const totalCost = direction === 'BUY' ? amount + commission + stampTax : amount - commission - stampTax;

    form.setFieldsValue({
      amount: Math.round(amount * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      stamp_tax: Math.round(stampTax * 100) / 100,
      total_cost: Math.round(totalCost * 100) / 100,
    });
  }, [form, settings]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!trade) return;
    try {
      const values = await form.validateFields();
      const updates = {
        ...values,
        trade_date: values.trade_date ? values.trade_date.format('YYYY-MM-DD') : undefined,
        is_impulsive: values.is_impulsive || false,
      };
      
      const result = await updateTrade(trade.id, updates);
      if (result) {
        message.success('交易记录已更新');
        onSuccess();
      } else {
        message.error('更新失败');
      }
    } catch (err: any) {
      if (err?.errorFields) {
        // Validation failed
        return;
      }
      message.error(err?.message || '更新失败');
    }
  }, [trade, updateTrade, form, onSuccess]);

  return (
    <Modal
      title="编辑交易"
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit}>
          保存修改
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="stock_code" label="股票代码" rules={[{ required: true }]}>
              <AutoComplete
                options={stockOptions}
                onSearch={handleStockSearch}
                onSelect={handleStockSelect}
                placeholder="输入代码搜索"
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="stock_name" label="股票名称">
              <Input placeholder="自动填入" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="market" label="市场" rules={[{ required: true }]}>
              <Select placeholder="选择市场" options={marketOptions} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="direction" label="方向" rules={[{ required: true }]}>
              <Radio.Group onChange={recalculateEditCosts}>
                <Radio.Button value="BUY">买入</Radio.Button>
                <Radio.Button value="SELL">卖出</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="trade_date" label="交易日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="price" label="价格" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.01} precision={3} onBlur={recalculateEditCosts} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} step={100} precision={0} onBlur={recalculateEditCosts} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="amount" label="成交金额">
              <InputNumber style={{ width: '100%' }} precision={2} disabled />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="commission" label="佣金">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} onBlur={recalculateEditCosts} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="stamp_tax" label="印花税">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} onBlur={recalculateEditCosts} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="total_cost" label="总费用">
              <InputNumber style={{ width: '100%' }} precision={2} disabled />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="strategy" label="策略">
              <Select placeholder="选择策略" allowClear>
                {(settings?.custom_strategies || []).map((s) => (
                  <Option key={s} value={s}>{s}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="entry_reason" label="入场理由">
              <Input.TextArea rows={2} placeholder="入场理由" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="exit_plan" label="出场计划">
              <Input.TextArea rows={2} placeholder="出场计划" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="stop_loss" label="止损价">
              <InputNumber style={{ width: '100%' }} min={0} precision={3} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="take_profit" label="止盈价">
              <InputNumber style={{ width: '100%' }} min={0} precision={3} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="emotion_before" label="交易前情绪">
              <Select placeholder="选择情绪" allowClear>
                {emotionOptions.map((e) => (
                  <Option key={e} value={e}>{e}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="emotion_after" label="交易后情绪">
              <Select placeholder="选择情绪" allowClear>
                {emotionOptions.map((e) => (
                  <Option key={e} value={e}>{e}</Option>
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
            <Form.Item name="market_trend" label="大盘趋势">
              <Select placeholder="选择趋势" allowClear>
                {marketTrendOptions.map((t) => (
                  <Option key={t} value={t}>{t}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="sector_trend" label="板块趋势">
              <Select placeholder="选择趋势" allowClear>
                {marketTrendOptions.map((t) => (
                  <Option key={t} value={t}>{t}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="is_impulsive" valuePropName="checked">
              <Checkbox>冲动交易</Checkbox>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="tags" label="标签">
              <Select mode="tags" placeholder="输入标签后回车" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lesson" label="经验教训">
              <Input.TextArea rows={2} placeholder="经验教训" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default EditTradeModal;
