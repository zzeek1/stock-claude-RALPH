import React, { useState } from 'react';
import { Steps, Form, InputNumber, Input, Button, Card, Space, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../stores';

const { Title, Paragraph } = Typography;

interface WizardFormValues {
  initialCapital: number;
  commissionRate: number;
  stampTaxRate: number;
  apiKey?: string;
}

const Wizard: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [form] = Form.useForm<WizardFormValues>();
  const navigate = useNavigate();
  const { saveSettings } = useSettingsStore();

  const steps = [
    {
      title: '初始资金',
      content: 'Step 1: Set Initial Capital',
    },
    {
      title: '费率设置',
      content: 'Step 2: Set Commission Rates',
    },
    {
      title: 'API 配置',
      content: 'Step 3: Configure AI (Optional)',
    },
    {
      title: '完成',
      content: 'Step 4: Complete',
    },
  ];

  const handleNext = async () => {
    if (current === steps.length - 2) {
      // Validate current step before moving to next
      try {
        await form.validateFields();
        setCurrent(current + 1);
      } catch {
        // Validation failed
      }
    } else {
      setCurrent(current + 1);
    }
  };

  const handlePrev = () => {
    setCurrent(current - 1);
  };

  const handleFinish = async () => {
    try {
      const values = await form.validateFields();

      // Save settings
      await saveSettings({
        initial_capital: values.initialCapital,
        default_commission_rate: values.commissionRate,
        default_stamp_tax_rate: values.stampTaxRate,
        is_setup_complete: true,
      });

      // Save API key if provided
      if (values.apiKey) {
        await window.electronAPI.settings.saveApiKey(values.apiKey);
      }

      message.success('设置已保存');
      navigate('/dashboard');
    } catch (err) {
      message.error('保存设置失败');
    }
  };

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Title level={3}>欢迎使用股票交易复盘系统</Title>
            <Paragraph type="secondary">
              让我们先设置您的初始资金，这将帮助系统计算收益率和盈亏情况。
            </Paragraph>
            <Form.Item
              name="initialCapital"
              label="初始资金"
              rules={[{ required: true, message: '请输入初始资金' }]}
              style={{ width: 300, margin: '40px auto' }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={10000}
                precision={2}
                placeholder="例如: 100000"
                addonAfter="元"
              />
            </Form.Item>
          </div>
        );

      case 1:
        return (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Title level={3}>设置交易费率</Title>
            <Paragraph type="secondary">
              根据您的券商设置交易佣金和印花税率。默认值为A股常用费率。
            </Paragraph>
            <Space direction="vertical" size="large" style={{ width: 300, margin: '20px auto' }}>
              <Form.Item
                name="commissionRate"
                label="佣金费率"
                rules={[{ required: true, message: '请输入佣金费率' }]}
                initialValue={0.00025}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={0.01}
                  step={0.00001}
                  precision={5}
                  formatter={(value) => `${(value || 0) * 100}%`}
                  parser={(value) => parseFloat(value?.replace('%', '') || '0') / 100}
                />
              </Form.Item>
              <Form.Item
                name="stampTaxRate"
                label="印花税率"
                rules={[{ required: true, message: '请输入印花税率' }]}
                initialValue={0.0005}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={0.01}
                  step={0.0001}
                  precision={4}
                  formatter={(value) => `${(value || 0) * 100}%`}
                  parser={(value) => parseFloat(value?.replace('%', '') || '0') / 100}
                  disabled
                />
              </Form.Item>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                注：印花税仅在卖出时收取，默认值为0.05%（A股）
              </Paragraph>
            </Space>
          </div>
        );

      case 2:
        return (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Title level={3}>配置 AI 复盘（可选）</Title>
            <Paragraph type="secondary">
              配置 Anthropic API Key 以启用 AI 智能复盘功能。您可以在后续设置中随时修改。
            </Paragraph>
            <Form.Item
              name="apiKey"
              label="Anthropic API Key"
              style={{ width: 400, margin: '20px auto' }}
            >
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              没有 API Key？<a href="https://www.anthropic.com" target="_blank" rel="noopener noreferrer">点击这里获取</a>
            </Paragraph>
          </div>
        );

      case 3:
        return (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Title level={2}>设置完成！</Title>
            <Paragraph>
              您已成功完成初始配置，现在可以开始使用股票交易复盘系统了。
            </Paragraph>
            <Space direction="vertical" size="middle" style={{ marginTop: 40 }}>
              <div>✓ 初始资金设置</div>
              <div>✓ 交易费率配置</div>
              {form.getFieldValue('apiKey') && <div>✓ AI API 配置</div>}
            </Space>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f5',
    }}>
      <Card style={{ width: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Steps
          current={current}
          items={steps}
          size="small"
          style={{ marginBottom: 32 }}
        />
        <Form form={form} layout="vertical">
          {renderStepContent()}
        </Form>
        <div style={{ textAlign: 'center', marginTop: 32, borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
          <Space>
            {current > 0 && (
              <Button onClick={handlePrev}>
                上一步
              </Button>
            )}
            {current < steps.length - 1 && (
              <Button type="primary" onClick={handleNext}>
                下一步
              </Button>
            )}
            {current === steps.length - 1 && (
              <Button type="primary" onClick={handleFinish}>
                开始使用
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default Wizard;
