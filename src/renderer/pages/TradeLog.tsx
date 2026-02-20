import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  DatePicker,
  Button,
  Tag,
  Space,
  Popconfirm,
  Typography,
  Descriptions,
  message,
  Row,
  Col,
  Modal,
  Form,
  AutoComplete,
  InputNumber,
  Radio,
  Rate,
  Checkbox,
} from 'antd';
import {
  SearchOutlined,
  ExportOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Trade, TradeFilter, Direction, Market, Emotion, MarketTrend, StockCode, PlanExecuted } from '../../shared/types';
import { useTradeStore, useSettingsStore } from '../stores';

const { RangePicker } = DatePicker;
const { Text } = Typography;
const { Option } = Select;

const emotionOptions: Emotion[] = ['冷静', '兴奋', '焦虑', '恐惧', '贪婪', '犹豫', '自信', '沮丧'];
const marketTrendOptions: MarketTrend[] = ['上涨', '下跌', '震荡', '不确定'];
const planExecutedLabels: Record<PlanExecuted, string> = {
  'EXECUTED': '按计划执行',
  'PARTIAL': '部分执行',
  'MISSED': '错过计划',
};
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

const TradeLog: React.FC = () => {
  const {
    trades,
    total,
    page,
    pageSize,
    loading,
    filter,
    setFilter,
    fetchTrades,
    deleteTrade,
    updateTrade,
  } = useTradeStore();

  const { settings, fetchSettings } = useSettingsStore();

  // Local filter state for controlled inputs
  const [searchKeyword, setSearchKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [strategyFilter, setStrategyFilter] = useState<string | undefined>(undefined);
  const [pnlFilter, setPnlFilter] = useState<string>('all');

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [editForm] = Form.useForm();
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Fetch initial data
  useEffect(() => {
    fetchTrades();
    fetchSettings();
  }, [fetchTrades, fetchSettings]);

  // Handle Ctrl+E for edit
  useEffect(() => {
    const cleanupEdit = window.electronAPI.shortcut.onEdit(() => {
      // If a row is selected, edit that trade
      if (selectedRowKeys.length > 0 && trades.length > 0) {
        const selectedId = selectedRowKeys[0];
        const trade = trades.find((t) => t.id === selectedId);
        if (trade) {
          handleEdit(trade);
        }
      }
    });
    return () => cleanupEdit();
  }, [selectedRowKeys, trades]);

  // Strategy options from settings
  const strategyOptions = useMemo(() => {
    return settings?.custom_strategies || [];
  }, [settings]);

  // Handle search
  const handleSearch = useCallback(() => {
    const newFilter: Partial<TradeFilter> = {
      page: 1,
      stock_code: searchKeyword || undefined,
      direction: directionFilter === 'all' ? undefined : (directionFilter as Direction),
      strategy: strategyFilter || undefined,
      pnlType: pnlFilter === 'all' ? undefined : (pnlFilter as 'profit' | 'loss'),
      startDate: dateRange?.[0]?.format('YYYY-MM-DD') || undefined,
      endDate: dateRange?.[1]?.format('YYYY-MM-DD') || undefined,
    };
    setFilter(newFilter);
  }, [searchKeyword, directionFilter, strategyFilter, pnlFilter, dateRange, setFilter]);

  // Handle export CSV
  const handleExportCsv = useCallback(async () => {
    try {
      const result = await window.electronAPI.trade.exportCsv(filter);
      if (result.success) {
        message.success('CSV 导出成功');
      } else {
        message.error(result.error || '导出失败');
      }
    } catch (err: any) {
      message.error(err?.message || '导出失败');
    }
  }, [filter]);

  // Handle delete
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTrade(id);
        message.success('交易记录已删除');
      } catch (err: any) {
        message.error(err?.message || '删除失败');
      }
    },
    [deleteTrade],
  );

  // Handle edit click
  const handleEdit = useCallback((record: Trade) => {
    setEditingTrade(record);
    editForm.setFieldsValue({
      ...record,
      trade_date: dayjs(record.trade_date),
      tags: record.tags || [],
    });
    setEditModalVisible(true);
  }, [editForm]);

  // Stock search for edit modal
  const handleStockSearch = useCallback((keyword: string) => {
    if (!keyword || keyword.trim().length === 0) {
      setStockOptions([]);
      return;
    }
    setTimeout(async () => {
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
  }, []);

  // Stock selection
  const handleStockSelect = useCallback((_value: string, option: any) => {
    const stockOption = option as StockOption;
    if (stockOption.stockData) {
      editForm.setFieldsValue({
        stock_name: stockOption.stockData.name,
        market: stockOption.stockData.market,
      });
    }
  }, [editForm]);

  // Recalculate costs in edit form
  const recalculateEditCosts = useCallback(() => {
    const price = editForm.getFieldValue('price') || 0;
    const quantity = editForm.getFieldValue('quantity') || 0;
    const direction: Direction = editForm.getFieldValue('direction') || 'BUY';

    const amount = price * quantity;
    const commissionRate = settings?.default_commission_rate ?? 0.00025;
    const stampTaxRate = settings?.default_stamp_tax_rate ?? 0.0005;
    const commission = Math.max(amount * commissionRate, amount > 0 ? 0.01 : 0);
    const stampTax = direction === 'SELL' ? amount * stampTaxRate : 0;
    const totalCost = direction === 'BUY' ? amount + commission + stampTax : amount - commission - stampTax;

    editForm.setFieldsValue({
      amount: Math.round(amount * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      stamp_tax: Math.round(stampTax * 100) / 100,
      total_cost: Math.round(totalCost * 100) / 100,
    });
  }, [editForm, settings]);

  // Handle edit form submit
  const handleEditSubmit = useCallback(async (values: any) => {
    if (!editingTrade) return;
    try {
      const updates = {
        ...values,
        trade_date: values.trade_date ? values.trade_date.format('YYYY-MM-DD') : undefined,
        is_impulsive: values.is_impulsive || false,
      };
      const result = await updateTrade(editingTrade.id, updates);
      if (result) {
        message.success('交易记录已更新');
        setEditModalVisible(false);
        setEditingTrade(null);
        editForm.resetFields();
      } else {
        message.error('更新失败');
      }
    } catch (err: any) {
      message.error(err?.message || '更新失败');
    }
  }, [editingTrade, updateTrade, editForm]);

  // Handle pagination change
  const handleTableChange = useCallback(
    (pagination: TablePaginationConfig) => {
      setFilter({
        page: pagination.current || 1,
        pageSize: pagination.pageSize || 20,
      });
    },
    [setFilter],
  );

  // Row class name based on pnl
  const getRowClassName = useCallback((record: Trade): string => {
    if (record.realized_pnl !== undefined && record.realized_pnl !== null) {
      if (record.realized_pnl > 0) return 'trade-row-profit';
      if (record.realized_pnl < 0) return 'trade-row-loss';
    }
    return '';
  }, []);

  // Expanded row content
  const expandedRowRender = useCallback((record: Trade) => {
    return (
      <Descriptions column={3} size="small" bordered>
        {record.entry_reason && (
          <Descriptions.Item label="入场理由" span={3}>
            {record.entry_reason}
          </Descriptions.Item>
        )}
        {record.exit_plan && (
          <Descriptions.Item label="出场计划" span={3}>
            {record.exit_plan}
          </Descriptions.Item>
        )}
        {record.lesson && (
          <Descriptions.Item label="经验教训" span={3}>
            {record.lesson}
          </Descriptions.Item>
        )}
        {record.market_trend && (
          <Descriptions.Item label="大盘趋势">
            {record.market_trend}
          </Descriptions.Item>
        )}
        {record.stop_loss !== undefined && record.stop_loss !== null && (
          <Descriptions.Item label="止损价">
            {record.stop_loss.toFixed(3)}
          </Descriptions.Item>
        )}
        {record.take_profit !== undefined && record.take_profit !== null && (
          <Descriptions.Item label="止盈价">
            {record.take_profit.toFixed(3)}
          </Descriptions.Item>
        )}
        {record.plan_executed && (
          <Descriptions.Item label="计划执行">
            <Tag color={
              record.plan_executed === 'EXECUTED' ? 'green' :
              record.plan_executed === 'PARTIAL' ? 'orange' : 'red'
            }>
              {planExecutedLabels[record.plan_executed]}
            </Tag>
          </Descriptions.Item>
        )}
        {record.holding_days !== undefined && record.holding_days !== null && (
          <Descriptions.Item label="持仓天数">
            {record.holding_days} 天
          </Descriptions.Item>
        )}
        {record.tags && record.tags.length > 0 && (
          <Descriptions.Item label="标签" span={2}>
            {record.tags.map((tag) => (
              <Tag key={tag} color="blue">
                {tag}
              </Tag>
            ))}
          </Descriptions.Item>
        )}
      </Descriptions>
    );
  }, []);

  // Table columns
  const columns: ColumnsType<Trade> = useMemo(
    () => [
      {
        title: '交易日期',
        dataIndex: 'trade_date',
        key: 'trade_date',
        width: 110,
        render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
      },
      {
        title: '代码',
        dataIndex: 'stock_code',
        key: 'stock_code',
        width: 90,
      },
      {
        title: '名称',
        dataIndex: 'stock_name',
        key: 'stock_name',
        width: 90,
        ellipsis: true,
      },
      {
        title: '方向',
        dataIndex: 'direction',
        key: 'direction',
        width: 70,
        render: (direction: Direction) => (
          <Tag color={direction === 'BUY' ? 'blue' : 'red'}>
            {direction === 'BUY' ? '买入' : '卖出'}
          </Tag>
        ),
      },
      {
        title: '价格',
        dataIndex: 'price',
        key: 'price',
        width: 90,
        align: 'right',
        render: (price: number) => price.toFixed(3),
      },
      {
        title: '数量',
        dataIndex: 'quantity',
        key: 'quantity',
        width: 80,
        align: 'right',
        render: (quantity: number) => quantity.toLocaleString(),
      },
      {
        title: '金额',
        dataIndex: 'amount',
        key: 'amount',
        width: 110,
        align: 'right',
        render: (amount: number) => amount.toFixed(2),
      },
      {
        title: '盈亏',
        dataIndex: 'realized_pnl',
        key: 'realized_pnl',
        width: 110,
        align: 'right',
        render: (pnl: number | undefined) => {
          if (pnl === undefined || pnl === null) return '-';
          const color = pnl > 0 ? '#3f8600' : pnl < 0 ? '#cf1322' : undefined;
          const prefix = pnl > 0 ? '+' : '';
          return (
            <Text style={{ color }} strong>
              {prefix}{pnl.toFixed(2)}
            </Text>
          );
        },
      },
      {
        title: '策略',
        dataIndex: 'strategy',
        key: 'strategy',
        width: 90,
        ellipsis: true,
        render: (strategy: string | undefined) => strategy || '-',
      },
      {
        title: '情绪',
        dataIndex: 'emotion_before',
        key: 'emotion_before',
        width: 70,
        render: (emotion: string | undefined) => emotion || '-',
      },
      {
        title: '操作',
        key: 'action',
        width: 120,
        fixed: 'right',
        render: (_: unknown, record: Trade) => (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除"
              description="确定要删除这条交易记录吗？此操作不可恢复。"
              onConfirm={() => handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" danger icon={<DeleteOutlined />} size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDelete, handleEdit],
  );

  return (
    <div>
      <style>
        {`
          .trade-row-profit {
            background-color: #f6ffed !important;
          }
          .trade-row-profit:hover > td {
            background-color: #d9f7be !important;
          }
          .trade-row-loss {
            background-color: #fff2f0 !important;
          }
          .trade-row-loss:hover > td {
            background-color: #ffccc7 !important;
          }
        `}
      </style>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Space wrap size={[12, 8]}>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
                placeholder={['开始日期', '结束日期']}
                allowClear
              />
              <Input
                placeholder="股票代码/名称"
                prefix={<SearchOutlined />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 160 }}
                allowClear
              />
              <Select
                value={directionFilter}
                onChange={setDirectionFilter}
                style={{ width: 100 }}
              >
                <Select.Option value="all">全部方向</Select.Option>
                <Select.Option value="BUY">买入</Select.Option>
                <Select.Option value="SELL">卖出</Select.Option>
              </Select>
              <Select
                value={strategyFilter}
                onChange={setStrategyFilter}
                placeholder="全部策略"
                style={{ width: 120 }}
                allowClear
              >
                {strategyOptions.map((s) => (
                  <Select.Option key={s} value={s}>
                    {s}
                  </Select.Option>
                ))}
              </Select>
              <Select
                value={pnlFilter}
                onChange={setPnlFilter}
                style={{ width: 100 }}
              >
                <Select.Option value="all">全部盈亏</Select.Option>
                <Select.Option value="profit">盈利</Select.Option>
                <Select.Option value="loss">亏损</Select.Option>
              </Select>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
              >
                查询
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setSearchKeyword('');
                  setDateRange(null);
                  setDirectionFilter('all');
                  setStrategyFilter(undefined);
                  setPnlFilter('all');
                  setFilter({
                    page: 1,
                    stock_code: undefined,
                    direction: undefined,
                    strategy: undefined,
                    pnlType: undefined,
                    startDate: undefined,
                    endDate: undefined,
                  });
                }}
              >
                重置
              </Button>
              <Button
                icon={<ExportOutlined />}
                onClick={handleExportCsv}
              >
                导出 CSV
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table<Trade>
          columns={columns}
          dataSource={trades}
          rowKey="id"
          loading={loading}
          rowClassName={getRowClassName}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
          }}
          expandable={{
            expandedRowRender,
            rowExpandable: (record) =>
              !!(
                record.entry_reason ||
                record.exit_plan ||
                record.lesson ||
                record.market_trend ||
                record.stop_loss !== undefined ||
                record.take_profit !== undefined ||
                record.holding_days !== undefined ||
                (record.tags && record.tags.length > 0)
              ),
          }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 1060 }}
          size="middle"
        />
      </Card>

      <Modal
        title="编辑交易"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingTrade(null);
          editForm.resetFields();
        }}
        width={800}
        footer={null}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditSubmit}
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
                <Radio.Group>
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
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} precision={3} onChange={() => recalculateEditCosts()} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} step={100} precision={0} onChange={() => recalculateEditCosts()} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="amount" label="成交金额">
                <InputNumber style={{ width: '100%' }} precision={2} disabled />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="commission" label="佣金">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} onChange={() => recalculateEditCosts()} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="stamp_tax" label="印花税">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} onChange={() => recalculateEditCosts()} />
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
                  {strategyOptions.map((s) => (
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
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存修改
              </Button>
              <Button onClick={() => {
                setEditModalVisible(false);
                setEditingTrade(null);
                editForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TradeLog;
