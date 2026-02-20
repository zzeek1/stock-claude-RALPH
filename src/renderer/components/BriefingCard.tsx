import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Spin, Typography, Tag, Space, Alert, Button, Divider } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  WarningOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { DailyBriefing } from '../../shared/types';

const { Text, Title, Paragraph } = Typography;

const BriefingCard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.briefing.getToday();
      if (result.success) {
        setBriefing(result.data);
      } else {
        setError(result.error || '获取简报失败');
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
      <Card>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">加载每日简报...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title={<><CalendarOutlined /> 每日简报</>}>
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={fetchBriefing}>
              重试
            </Button>
          }
        />
      </Card>
    );
  }

  if (!briefing) {
    return (
      <Card title={<><CalendarOutlined /> 每日简报</>}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Paragraph type="secondary">暂无今日简报</Paragraph>
          <Button type="primary" icon={<ReloadOutlined />} onClick={generateBriefing}>
            生成今日简报
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={<><CalendarOutlined /> 每日简报 - {briefing.date}</>}
      extra={
        <Button type="link" icon={<ReloadOutlined />} onClick={generateBriefing}>
          刷新
        </Button>
      }
    >
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
        <Col span={6}>
          <Statistic
            title="今日交易"
            value={briefing.today_trades}
            suffix="笔"
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="今日盈亏"
            value={briefing.today_pnl}
            precision={2}
            prefix={briefing.today_pnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            valueStyle={{ color: briefing.today_pnl >= 0 ? '#3f8600' : '#cf1322' }}
            suffix="元"
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="本周盈亏"
            value={briefing.week_pnl}
            precision={2}
            prefix={briefing.week_pnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            valueStyle={{ color: briefing.week_pnl >= 0 ? '#3f8600' : '#cf1322' }}
            suffix="元"
          />
        </Col>
        <Col span={6}>
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
        <Col span={8}>
          <Statistic
            title="持仓数量"
            value={briefing.positions_count}
            suffix="只"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="持仓市值"
            value={briefing.positions_value}
            precision={2}
            suffix="元"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="连续亏损"
            value={briefing.consecutive_losses}
            suffix="笔"
            valueStyle={{ color: briefing.consecutive_losses >= 3 ? '#cf1322' : undefined }}
          />
        </Col>
      </Row>

      {briefing.content && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
            fontSize: 12,
            maxHeight: 200,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
          }}>
            {briefing.content}
          </pre>
        </>
      )}
    </Card>
  );
};

export default BriefingCard;
