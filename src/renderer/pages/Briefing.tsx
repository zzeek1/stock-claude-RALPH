import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Spin, Typography, Tag, Space, Alert, Button, Divider, Timeline, List } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  WarningOutlined,
  CalendarOutlined,
  TrophyOutlined,
  WalletOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { DailyBriefing } from '../../shared/types';

const { Text, Title, Paragraph } = Typography;

const BriefingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [recentBriefings, setRecentBriefings] = useState<DailyBriefing[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayResult, recentResult] = await Promise.all([
        window.electronAPI.briefing.getToday(),
        window.electronAPI.briefing.getRecent(30),
      ]);

      if (todayResult.success) {
        setBriefing(todayResult.data);
      } else {
        setError(todayResult.error || '获取简报失败');
      }

      if (recentResult.success) {
        setRecentBriefings(recentResult.data);
      }
    } catch (err: any) {
      setError(err?.message || '获取简报失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const generateBriefing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.briefing.generate();
      if (result.success) {
        setBriefing(result.data);
        // Refresh recent briefings
        const recentResult = await window.electronAPI.briefing.getRecent(30);
        if (recentResult.success) {
          setRecentBriefings(recentResult.data);
        }
      } else {
        setError(result.error || '生成简报失败');
      }
    } catch (err: any) {
      setError(err?.message || '生成简报失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  if (loading) {
    return (
      <div>
        <Title level={4}>每日简报</Title>
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">加载每日简报...</Text>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Title level={4}>每日简报</Title>

      {error && (
        <Alert
          message="操作失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={fetchBriefing}>
              重试
            </Button>
          }
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={<><CalendarOutlined /> 今日简报 - {briefing?.date || dayjs().format('YYYY-MM-DD')}</>}
            extra={
              <Button type="primary" icon={<ReloadOutlined />} onClick={generateBriefing}>
                生成简报
              </Button>
            }
          >
            {!briefing ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Paragraph type="secondary">暂无今日简报</Paragraph>
                <Button type="primary" icon={<ReloadOutlined />} onClick={generateBriefing}>
                  生成今日简报
                </Button>
              </div>
            ) : (
              <>
                {briefing.risk_alert && (
                  <Alert
                    message="风险提示"
                    description={briefing.risk_alert}
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    style={{ marginBottom: 16 }}
                  />
                )}

                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="今日交易"
                      value={briefing.today_trades}
                      suffix="笔"
                      prefix={<SwapOutlined />}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="今日盈亏"
                      value={briefing.today_pnl}
                      precision={2}
                      prefix={briefing.today_pnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      valueStyle={{ color: briefing.today_pnl >= 0 ? '#3f8600' : '#cf1322' }}
                      suffix="元"
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="本周盈亏"
                      value={briefing.week_pnl}
                      precision={2}
                      prefix={briefing.week_pnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      valueStyle={{ color: briefing.week_pnl >= 0 ? '#3f8600' : '#cf1322' }}
                      suffix="元"
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="本月盈亏"
                      value={briefing.month_pnl}
                      precision={2}
                      prefix={briefing.month_pnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      valueStyle={{ color: briefing.month_pnl >= 0 ? '#3f8600' : '#cf1322' }}
                      suffix="元"
                    />
                  </Col>
                </Row>

                <Divider style={{ margin: '16px 0' }} />

                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={8}>
                    <Statistic
                      title="持仓数量"
                      value={briefing.positions_count}
                      suffix="只"
                      prefix={<WalletOutlined />}
                    />
                  </Col>
                  <Col xs={12} sm={8}>
                    <Statistic
                      title="持仓市值"
                      value={briefing.positions_value}
                      precision={2}
                      suffix="元"
                    />
                  </Col>
                  <Col xs={12} sm={8}>
                    <Statistic
                      title="连续亏损"
                      value={briefing.consecutive_losses}
                      suffix="笔"
                      valueStyle={{ color: briefing.consecutive_losses >= 3 ? '#cf1322' : undefined }}
                      prefix={<WarningOutlined />}
                    />
                  </Col>
                </Row>

                {briefing.content && (
                  <>
                    <Divider style={{ margin: '16px 0' }} />
                    <pre style={{
                      background: '#f5f5f5',
                      padding: 16,
                      borderRadius: 4,
                      fontSize: 13,
                      maxHeight: 300,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      lineHeight: 1.6,
                    }}>
                      {briefing.content}
                    </pre>
                  </>
                )}
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<><CalendarOutlined /> 历史简报</>}>
            {recentBriefings.length === 0 ? (
              <Text type="secondary">暂无历史简报</Text>
            ) : (
              <List
                size="small"
                dataSource={recentBriefings.slice(0, 10)}
                renderItem={(item) => (
                  <List.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Text>{item.date}</Text>
                      <Space>
                        <Tag color={item.today_pnl >= 0 ? 'green' : 'red'}>
                          今日 {item.today_pnl >= 0 ? '+' : ''}{item.today_pnl.toFixed(0)}
                        </Tag>
                        <Tag color={item.week_pnl >= 0 ? 'green' : 'red'}>
                          本周 {item.week_pnl >= 0 ? '+' : ''}{item.week_pnl.toFixed(0)}
                        </Tag>
                      </Space>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default BriefingPage;
