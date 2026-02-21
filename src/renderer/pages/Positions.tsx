import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Row, Select, Space, Spin, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowDownOutlined, ArrowUpOutlined, LineChartOutlined, TableOutlined } from '@ant-design/icons';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import { useCurrencyStore, usePositionStore } from '../stores';
import type { Position, Trade } from '../../shared/types';
import { convertAmount, currencySymbol, marketCurrency } from '../utils/currency';
import type { FxRates } from '../utils/currency';

const { Title, Text } = Typography;

interface TradePoint {
  date: string;
  price: number;
  type: 'BUY' | 'SELL';
  quantity: number;
}

interface PositionView extends Position {
  display_avg_cost: number;
  display_current_price: number;
  display_total_cost: number;
  display_current_value: number;
  display_floating_pnl: number;
}

const Positions: React.FC = () => {
  const { positions, loading, fetchPositions } = usePositionStore();
  const { displayCurrency } = useCurrencyStore();
  const [activeTab, setActiveTab] = useState<string>('table');
  const [selectedStock, setSelectedStock] = useState<string>('');
  const [tradeHistory, setTradeHistory] = useState<TradePoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  const [fxRates, setFxRates] = useState<FxRates | undefined>(undefined);

  useEffect(() => {
    fetchPositions();

    const timer = setInterval(() => {
      fetchPositions();
    }, 15000);

    return () => clearInterval(timer);
  }, [fetchPositions]);

  useEffect(() => {
    const fetchFxRates = async () => {
      try {
        const res = await window.electronAPI.quote.getFxRates();
        if (res.success && res.data) {
          setFxRates(res.data);
        }
      } catch {
        // keep previous rates
      }
    };

    fetchFxRates();
    const timer = setInterval(fetchFxRates, 60000);
    return () => clearInterval(timer);
  }, []);

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
        pageSize: 1000,
        sortField: 'trade_date',
        sortOrder: 'asc',
      });
      if (result.success && result.data) {
        const trades = result.data.trades;
        const points: TradePoint[] = trades
          .map((t: Trade) => ({
            date: t.trade_date,
            price: t.price,
            type: t.direction as 'BUY' | 'SELL',
            quantity: t.quantity,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setTradeHistory(points);
      }
    } catch (err) {
      console.error('Failed to fetch trade history:', err);
    } finally {
      setLoadingChart(false);
    }
  };

  const rows: PositionView[] = useMemo(() => {
    return positions.map((p) => {
      const sourceCurrency = marketCurrency(p.market);
      const conv = (value: number) => convertAmount(value, sourceCurrency, displayCurrency, fxRates);

      return {
        ...p,
        // Keep avg/current price in source market currency.
        display_avg_cost: p.avg_cost,
        display_current_price: p.current_price,
        display_total_cost: conv(p.total_cost),
        display_current_value: conv(p.current_value),
        display_floating_pnl: conv(p.floating_pnl),
      };
    });
  }, [positions, displayCurrency, fxRates]);

  const columns: ColumnsType<PositionView> = [
    { title: '股票代码', dataIndex: 'stock_code', key: 'stock_code', width: 100 },
    {
      title: '股票名称',
      dataIndex: 'stock_name',
      key: 'stock_name',
      width: 130,
      render: (name: string, record: PositionView) => (name && name !== record.stock_code) ? name : record.stock_code
    },
    { title: '市场', dataIndex: 'market', key: 'market', width: 70, render: (market: string) => <Tag>{market}</Tag> },
    { title: '持仓数量', dataIndex: 'quantity', key: 'quantity', width: 110, align: 'right' },
    {
      title: '平均成本',
      dataIndex: 'display_avg_cost',
      key: 'avg_cost',
      width: 140,
      align: 'right',
      sorter: (a, b) => a.display_avg_cost - b.display_avg_cost,
      render: (v: number, record: PositionView) => `${v.toFixed(3)} ${marketCurrency(record.market)}`,
    },
    {
      title: '当前价格',
      dataIndex: 'display_current_price',
      key: 'current_price',
      width: 140,
      align: 'right',
      sorter: (a, b) => a.display_current_price - b.display_current_price,
      render: (v: number, record: PositionView) => `${v.toFixed(3)} ${marketCurrency(record.market)}`,
    },
    {
      title: `当前市值 (${currencySymbol(displayCurrency)})`,
      dataIndex: 'display_current_value',
      key: 'current_value',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.display_current_value - b.display_current_value,
      render: (v: number) => Math.round(v).toLocaleString(),
    },
    {
      title: `浮动盈亏 (${currencySymbol(displayCurrency)})`,
      dataIndex: 'display_floating_pnl',
      key: 'floating_pnl',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.display_floating_pnl - b.display_floating_pnl,
      render: (v: number) => {
        const color = v >= 0 ? '#52c41a' : '#ff4d4f';
        const prefix = v >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />;
        return <span style={{ color }}>{prefix} {Math.round(v).toLocaleString()}</span>;
      },
    },
    {
      title: '盈亏比例',
      dataIndex: 'floating_pnl_ratio',
      key: 'floating_pnl_ratio',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.floating_pnl_ratio - b.floating_pnl_ratio,
      render: (v: number) => <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f' }}>{(v * 100).toFixed(2)}%</span>,
    },
    { title: '首次买入', dataIndex: 'first_buy_date', key: 'first_buy_date', width: 120 },
    { title: '最近交易', dataIndex: 'last_trade_date', key: 'last_trade_date', width: 120 },
    { title: '持仓天数', dataIndex: 'holding_days', key: 'holding_days', width: 100, align: 'right', render: (v: number) => `${v}天` },
  ];

  const tabItems = [
    {
      key: 'table',
      label: <span><TableOutlined /> 持仓列表</span>,
      children: (
        <Spin spinning={loading}>
          {rows.length === 0 && !loading ? (
            <Empty description="暂无持仓" />
          ) : (
            <Table
              columns={columns}
              dataSource={rows}
              rowKey="stock_code"
              pagination={false}
              size="middle"
              summary={(data) => {
                const totalCost = data.reduce((sum, p) => sum + (p.display_total_cost || 0), 0);
                const totalCurrentValue = data.reduce((sum, p) => sum + (p.display_current_value || 0), 0);
                const totalFloatingPnl = data.reduce((sum, p) => sum + (p.display_floating_pnl || 0), 0);
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={6}><strong>合计</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="right"><strong>{Math.round(totalCurrentValue).toLocaleString()}</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right">
                      <strong style={{ color: totalFloatingPnl >= 0 ? '#52c41a' : '#ff4d4f' }}>
                        {totalFloatingPnl >= 0 ? '+' : ''}{Math.round(totalFloatingPnl).toLocaleString()}
                      </strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} align="right">
                      <strong style={{ color: totalFloatingPnl >= 0 ? '#52c41a' : '#ff4d4f' }}>
                        {totalCost > 0 ? ((totalFloatingPnl / totalCost) * 100).toFixed(2) : '0.00'}%
                      </strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={9} colSpan={3} />
                  </Table.Summary.Row>
                );
              }}
              scroll={{ x: 1500 }}
            />
          )}
        </Spin>
      ),
    },
    {
      key: 'chart',
      label: <span><LineChartOutlined /> 持仓K线</span>,
      children: (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col>
              <Text>选择股票：</Text>
              <Select
                style={{ width: 220, marginLeft: 8 }}
                placeholder="选择股票查看K线"
                value={selectedStock}
                onChange={setSelectedStock}
                allowClear
                showSearch
                optionFilterProp="children"
              >
                {rows.map((p) => (
                  <Select.Option key={p.stock_code} value={p.stock_code}>
                    {(p.stock_name && p.stock_name !== p.stock_code) ? p.stock_name : p.stock_code} ({p.stock_code})
                  </Select.Option>
                ))}
              </Select>
            </Col>
          </Row>

          {selectedStock && !loadingChart && tradeHistory.length > 0 && (
            <Card title={`${(rows.find((p) => p.stock_code === selectedStock)?.stock_name && rows.find((p) => p.stock_code === selectedStock)?.stock_name !== selectedStock) ? rows.find((p) => p.stock_code === selectedStock)?.stock_name : selectedStock} (${selectedStock}) - 交易记录`} size="small">
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={tradeHistory} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(value) => dayjs(value).format('MM/DD')} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickFormatter={(value) => value.toFixed(2)} />
                  <Tooltip formatter={(value: number) => [value.toFixed(2), '价格']} labelFormatter={(label) => `日期: ${label}`} />
                  <Legend />
                  <Line type="monotone" dataKey="price" name="价格" stroke="#1677ff" strokeWidth={2} dot={false} connectNulls />
                  <Scatter name="买入" data={tradeHistory.filter((t) => t.type === 'BUY')} dataKey="price" fill="#52c41a" shape="triangle" />
                  <Scatter name="卖出" data={tradeHistory.filter((t) => t.type === 'SELL')} dataKey="price" fill="#ff4d4f" shape="triangle" />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          )}

          {!selectedStock && <Empty description="请选择一只股票查看K线图" />}
          {selectedStock && !loadingChart && tradeHistory.length === 0 && <Empty description="该股票暂无交易记录" />}
          {loadingChart && <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>当前持仓</Title>
      <Card style={{ marginBottom: 12 }}>
        <Text type="secondary">汇率更新时间：{fxRates?.timestamp ? dayjs(fxRates.timestamp).format('YYYY-MM-DD HH:mm:ss') : '未获取'}</Text>
      </Card>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </div>
  );
};

export default Positions;
