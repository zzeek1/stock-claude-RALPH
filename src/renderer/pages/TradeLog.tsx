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
import type { Trade, TradeFilter, Direction, PlanExecuted } from '../../shared/types';
import { useTradeStore, useSettingsStore } from '../stores';
import EditTradeModal from '../components/Trade/EditTradeModal';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const planExecutedLabels: Record<PlanExecuted, string> = {
  'EXECUTED': '按计划执行',
  'PARTIAL': '部分执行',
  'MISSED': '错过计划',
};

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
    setEditModalVisible(true);
  }, []);

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

      <EditTradeModal
        visible={editModalVisible}
        trade={editingTrade}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingTrade(null);
        }}
        onSuccess={() => {
          setEditModalVisible(false);
          setEditingTrade(null);
          fetchTrades();
        }}
        settings={settings}
        updateTrade={updateTrade}
      />
    </div>
  );
};

export default TradeLog;
