import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Upload,
  Button,
  Table,
  Typography,
  Space,
  Alert,
  Progress,
  Descriptions,
  Tag,
  Select,
  Divider,
  message,
  Row,
  Col,
  Statistic,
  Modal,
  List,
} from 'antd';
import {
  UploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const FIELD_OPTIONS = [
  { label: '股票代码', value: 'stock_code' },
  { label: '股票名称', value: 'stock_name' },
  { label: '市场', value: 'market' },
  { label: '方向', value: 'direction' },
  { label: '交易日期', value: 'trade_date' },
  { label: '价格', value: 'price' },
  { label: '数量', value: 'quantity' },
  { label: '金额', value: 'amount' },
  { label: '佣金', value: 'commission' },
  { label: '印花税', value: 'stamp_tax' },
  { label: '策略', value: 'strategy' },
  { label: '入场理由', value: 'entry_reason' },
  { label: '止损价', value: 'stop_loss' },
  { label: '止盈价', value: 'take_profit' },
  { label: '忽略', value: '' },
];

const DataImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [preview, setPreview] = useState<any>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [importLogs, setImportLogs] = useState<any[]>([]);

  const handleFileRead = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
      setFile(file);

      try {
        const previewResult = await window.electronAPI.import.preview(content);
        if (previewResult.success && previewResult.data) {
          setPreview(previewResult.data);
          setFieldMapping(previewResult.data.fieldMapping || {});
          setResult(null);
        } else {
          message.error(previewResult.error || '预览失败');
        }
      } catch (err: any) {
        message.error(err?.message || '预览失败');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleUpload = useCallback((uploadFile: UploadFile) => {
    const rawFile = uploadFile as unknown as File;
    if (rawFile) {
      handleFileRead(rawFile);
    }
    return false;
  }, [handleFileRead]);

  const handleFieldMappingChange = useCallback((csvField: string, tradeField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [csvField]: tradeField,
    }));
  }, []);

  const handleImport = useCallback(async () => {
    if (!fileContent) {
      message.warning('请先选择文件');
      return;
    }

    setImporting(true);
    try {
      const importResult = await window.electronAPI.import.trades(fileContent, fieldMapping);
      if (importResult.success && importResult.data) {
        setResult(importResult.data);
        if (importResult.data.success > 0) {
          message.success(`成功导入 ${importResult.data.success} 条交易记录`);
        }
      } else {
        message.error(importResult.error || '导入失败');
      }
    } catch (err: any) {
      message.error(err?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  }, [fileContent, fieldMapping]);

  const handleViewLogs = useCallback(async () => {
    const logsResult = await window.electronAPI.import.logs();
    if (logsResult.success && logsResult.data) {
      setImportLogs(logsResult.data);
    }
    setLogsModalVisible(true);
  }, []);

  const previewColumns = useMemo(() => {
    if (!preview?.fields) return [];
    return preview.fields.map((field: string) => ({
      title: (
        <Select
          value={fieldMapping[field]}
          onChange={(value) => handleFieldMappingChange(field, value)}
          style={{ width: 120 }}
          size="small"
          options={FIELD_OPTIONS}
          placeholder="选择字段"
        />
      ),
      dataIndex: field,
      key: field,
      ellipsis: true,
      width: 150,
      render: (value: any) => <Text style={{ fontSize: 12 }}>{String(value || '-')}</Text>,
    }));
  }, [preview, fieldMapping, handleFieldMappingChange]);

  const successRate = result ? Math.round((result.success / result.total) * 100) : 0;

  return (
    <div>
      <Title level={4}>数据导入</Title>

      <Card style={{ marginBottom: 16 }}>
        <Paragraph type="secondary">
          支持导入 CSV、TXT 格式的交易记录文件。系统会自动识别常见券商导出格式，
          也可以手动映射字段。
        </Paragraph>
        <Space>
          <Upload
            accept=".csv,.txt,.xlsx,.xls"
            showUploadList={false}
            beforeUpload={handleUpload}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
          <Button icon={<HistoryOutlined />} onClick={handleViewLogs}>
            导入历史
          </Button>
        </Space>
        {file && (
          <div style={{ marginTop: 12 }}>
            <Tag icon={<FileTextOutlined />} color="blue">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </Tag>
          </div>
        )}
      </Card>

      {preview && (
        <>
          <Card title="文件预览" style={{ marginBottom: 16 }} size="small">
            <Descriptions column={4} size="small">
              <Descriptions.Item label="检测格式">
                <Tag color="blue">{preview.detectedFormat || '通用格式'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="总行数">{preview.total}</Descriptions.Item>
              <Descriptions.Item label="字段数">{preview.fields.length}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color="green">已解析</Tag>
              </Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary">选择每个CSV字段对应的交易字段：</Text>
            <div style={{ marginTop: 8, overflowX: 'auto' }}>
              <Table
                dataSource={preview.sampleData}
                columns={previewColumns}
                rowKey={(_, index) => `row-${index}`}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleImport}
                loading={importing}
                size="large"
              >
                开始导入
              </Button>
              <Button onClick={() => {
                setFile(null);
                setFileContent('');
                setPreview(null);
                setFieldMapping({});
                setResult(null);
              }}>
                清除
              </Button>
            </Space>
          </Card>
        </>
      )}

      {result && (
        <Card title="导入结果" style={{ marginBottom: 16 }}>
          <Row gutter={24}>
            <Col span={6}>
              <Statistic
                title="总计"
                value={result.total}
                suffix="条"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="成功"
                value={result.success}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
                suffix="条"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="失败"
                value={result.failed}
                valueStyle={{ color: result.failed > 0 ? '#ff4d4f' : '#52c41a' }}
                prefix={<CloseCircleOutlined />}
                suffix="条"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="成功率"
                value={successRate}
                suffix="%"
                valueStyle={{ color: successRate >= 80 ? '#52c41a' : successRate >= 50 ? '#faad14' : '#ff4d4f' }}
              />
            </Col>
          </Row>
          <Progress
            percent={successRate}
            status={successRate === 100 ? 'success' : 'active'}
            style={{ marginTop: 16 }}
          />
          {result.errors && result.errors.length > 0 && (
            <>
              <Divider />
              <Alert
                message={`有 ${result.errors.length} 条记录导入失败`}
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
              />
              <List
                size="small"
                dataSource={result.errors.slice(0, 10)}
                renderItem={(error: any) => (
                  <List.Item>
                    <Text type="danger">第 {error.row} 行: {error.message}</Text>
                  </List.Item>
                )}
                locale={{ emptyText: '无错误' }}
              />
              {result.errors.length > 10 && (
                <Text type="secondary">...还有 {result.errors.length - 10} 条错误</Text>
              )}
            </>
          )}
        </Card>
      )}

      <Card title="支持的格式说明" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="同花顺">自动识别</Descriptions.Item>
          <Descriptions.Item label="东方财富">自动识别</Descriptions.Item>
          <Descriptions.Item label="券商标准格式">自动识别</Descriptions.Item>
          <Descriptions.Item label="自定义CSV">手动映射字段</Descriptions.Item>
        </Descriptions>
        <Divider style={{ margin: '12px 0' }} />
        <Text type="secondary">
          必填字段：股票代码、买卖方向、交易日期、价格、数量。<br/>
          方向识别：买入/Buy/B/买；卖出/Sell/S/卖。<br/>
          市场识别：上海/SH/6开头；深圳/SZ/0/3开头；北京/BJ/4/8开头。
        </Text>
      </Card>

      <Modal
        title="导入历史"
        open={logsModalVisible}
        onCancel={() => setLogsModalVisible(false)}
        footer={null}
        width={600}
      >
        <List
          dataSource={importLogs}
          renderItem={(log: any) => (
            <List.Item>
              <List.Item.Meta
                title={dayjs(log.imported_at).format('YYYY-MM-DD HH:mm:ss')}
                description={
                  <Space>
                    <span>总计: {log.total}</span>
                    <span style={{ color: '#52c41a' }}>成功: {log.success}</span>
                    <span style={{ color: log.failed > 0 ? '#ff4d4f' : undefined }}>
                      失败: {log.failed}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无导入记录' }}
        />
      </Modal>
    </div>
  );
};

export default DataImport;
