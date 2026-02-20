import React, { useEffect, useState } from 'react';
import { Table, Card, Typography, Tag, Empty, Spin, Tabs, Select, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { usePositionStore } from '../stores';
import type { Position, Trade } from '../../shared/types';
import { ArrowUpOutlined, ArrowDownOutlined, LineChartOutlined, TableOutlined } from '@ant-design/icons';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
  ReferenceLine,
} from 'recharts';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface TradePoint {
  date: string;
  price: number;
  type: 'BUY' | 'SELL';
  quantity: number;
}

const Positions: React.FC = () => {
  const { positions, loading, fetchPositions } = usePositionStore();
  const [activeTab, setActiveTab] = useState<string>('table');
  const [selectedStock, setSelectedStock] = useState<string>('');
  const [tradeHistory, setTradeHistory] = useState<TradePoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    fetchPositions();
  }, []);

  // Fetch trade history when a stock is selected
  useEffect(() => {
    if (selectedStock) {
      fetchTradeHistory(selectedStock);
    }
  }, [selectedStock]);

  const fetchTradeHistory = async (stockCode: string) => {
    setLoadingChart(true);
    try {
      const result = await window.electronAPI.trade.list({
        stock_code: stockCode,
        page: 1,
        pageSize: 100,
      });
      if (result.success && result.data) {
        const trades = result.data.trades;
        const points: TradePoint[] = trades.map(t => ({
          date: t.trade_date,
          price: t.price,
          type: t.direction as 'BUY' | 'SELL',
          quantity: t.quantity,
        })).sort((a, b) => a.date.localeCompare(b.date));
        setTradeHistory(points);
      }
    } catch (err) {
      console.error('Failed to fetch trade history:', err);
    } finally {
      setLoadingChart(false);
    }
  };

  const columns: ColumnsType<Position> = [
    {
      title: '股票代码',
      dataIndex: 'stock_code',
      key: 'stock_code',
      width: 100,
    },
    {
      title: '股票名称',
      dataIndex: 'stock_name',
      key: 'stock_name',
      width: 120,
    },
    {
      title: '市场',
      dataIndex: 'market',
      key: 'market',
      width: 60,
      render: (market: string) => <Tag>{market}</Tag>,
    },
    {
      title: '持仓数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '平均成本',
      dataIndex: 'avg_cost',
      key: 'avg_cost',
      width: 100,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '当前价格',
      dataIndex: 'current_price',
      key: 'current_price',
      width: 100,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '当前市值',
      dataIndex: 'current_value',
      key: 'current_value',
      width: 120,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '浮动盈亏',
      dataIndex: 'floating_pnl',
      key: 'floating_pnl',
      width: 120,
      align: 'right',
      render: (v: number, record: Position) => {
        const color = v >= 0 ? '#52c41a' : '#ff4d4f';
        const prefix = v >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />;
        return (
          <span style={{ color }}>
            {prefix} {v?.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '盈亏比例',
      dataIndex: 'floating_pnl_ratio',
      key: 'floating_pnl_ratio',
      width: 90,
      align: 'right',
      render: (v: number) => {
        const color = v >= 0 ? '#52c41a' : '#ff4d4f';
        return <span style={{ color }}>{(v * 100).toFixed(2)}%</span>;
      },
    },
    {
      title: '首次买入',
      dataIndex: 'first_buy_date',
      key: 'first_buy_date',
      width: 110,
    },
    {
      title: '最近交易',
      dataIndex: 'last_trade_date',
      key: 'last_trade_date',
      width: 110,
    },
    {
      title: '持仓天数',
      dataIndex: 'holding_days',
      key: 'holding_days',
      width: 90,
      align: 'right',
      render: (v: number) => `${v}天`,
    },
    {
      title: '止损价',
      dataIndex: 'stop_loss',
      key: 'stop_loss',
      width: 90,
      align: 'right',
      render: (v: number | undefined) => v ? (
        <span style={{ color: '#ff4d4f' }}>{v.toFixed(2)}</span>
      ) : '-',
    },
    {
      title: '止盈价',
      dataIndex: 'take_profit',
      key: 'take_profit',
      width: 90,
      align: 'right',
      render: (v: number | undefined) => v ? (
        <span style={{ color: '#52c41a' }}>{v.toFixed(2)}</span>
      ) : '-',
    },
  ];

  const tabItems = [
    {
      key: 'table',
      label: (
        <span>
          <TableOutlined /> 持仓列表
        </span>
      ),
      children: (
        <Spin spinning={loading}>
          {positions.length === 0 && !loading ? (
            <Empty description="暂无持仓" />
          ) : (
            <Table
              columns={columns}
              dataSource={positions}
              rowKey="stock_code"
              pagination={false}
              size="middle"
              summary={(data) => {
                const totalCost = data.reduce((sum, p) => sum + (p.total_cost || 0), 0);
                const totalCurrentValue = data.reduce((sum, p) => sum + (p.current_value || 0), 0);
                const totalFloatingPnl = data.reduce((sum, p) => sum + (p.floating_pnl || 0), 0);
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={6}>
                      <strong>合计</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="right">
                      <strong>{totalCurrentValue.toFixed(2)}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right">
                      <strong style={{ color: totalFloatingPnl >= 0 ? '#52c41a' : '#ff4d4f' }}>
                        {totalFloatingPnl >= 0 ? '+' : ''}{totalFloatingPnl.toFixed(2)}
                      </strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} align="right">
                      <strong style={{ color: totalFloatingPnl >= 0 ? '#52c41a' : '#ff4d4f' }}>
                        {totalCost > 0 ? ((totalFloatingPnl / totalCost) * 100).toFixed(2) : '0.00'}%
                      </strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={9} colSpan={6} />
                  </Table.Summary.Row>
                );
              }}
            />
          )}
        </Spin>
      ),
    },
    {
      key: 'chart',
      label: (
        <span>
          <LineChartOutlined /> 持仓K线
        </span>
      ),
      children: (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col>
              <Text>选择股票：</Text>
              <Select
                style={{ width: 200, marginLeft: 8 }}
                placeholder="选择股票查看K线"
                value={selectedStock}
                onChange={setSelectedStock}
                allowClear
                showSearch
                optionFilterProp="children"
              >
                {positions.map(p => (
                  <Select.Option key={p.stock_code} value={p.stock_code}>
                    {p.stock_name} ({p.stock_code})
                  </Select.Option>
                ))}
              </Select>
            </Col>
          </Row>

          {selectedStock && !loadingChart && tradeHistory.length > 0 && (
            <Card title={`${positions.find(p => p.stock_code === selectedStock)?.stock_name} (${selectedStock}) - 交易记录`} size="small">
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={tradeHistory} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => dayjs(value).format('MM/DD')}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => value.toFixed(2)}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === '买入') return [value.toFixed(2), name];
                      if (name === '卖出') return [value.toFixed(2), name];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="price"
                    name="价格"
                    stroke="#1677ff"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Scatter
                    name="买入"
                    data={tradeHistory.filter(t => t.type === 'BUY')}
                    dataKey="price"
                    fill="#52c41a"
                    shape="triangle"
                    r={6}
                  />
                  <Scatter
                    name="卖出"
                    data={tradeHistory.filter(t => t.type === 'SELL')}
                    dataKey="price"
                    fill="#ff4d4f"
                    shape="triangle"
                    r={6}
                  />
                </ComposedChart>
              </ResponsiveContainer>

              <div style={{ marginTop: 16 }}>
                <Text type="secondary">
                  图例说明：
                  <Tag color="blue">—</Tag> 价格趋势
                  <Tag color="green" style={{ marginLeft: 8 }}>▲</Tag> 买入点
                  <Tag color="red" style={{ marginLeft: 8 }}>▼</Tag> 卖出点
                </Text>
              </div>
            </Card>
          )}

          {!selectedStock && (
            <Empty description="请选择一只股票查看K线图" />
          )}

          {selectedStock && !loadingChart && tradeHistory.length === 0 && (
            <Empty description="该股票暂无交易记录" />
          )}

          {loadingChart && (
            <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>当前持仓</Title>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default Positions;
