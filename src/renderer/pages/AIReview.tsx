import React, { useState, useEffect, useCallback } from 'react';
import { Card, Select, DatePicker, Button, Space, Input, Spin, Typography, Divider, List, Tag, Modal, message } from 'antd';
import { RobotOutlined, StarOutlined, StarFilled, DeleteOutlined, HistoryOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import dayjs from 'dayjs';
import type { AIReview, ReviewType, AIStreamEvent, AIConversationMessage } from '../../shared/types';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const AIReviewPage: React.FC = () => {
  const [reviewType, setReviewType] = useState<ReviewType>('daily');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs(), dayjs()]);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [currentReviewId, setCurrentReviewId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [reviews, setReviews] = useState<AIReview[]>([]);
  const [selectedReview, setSelectedReview] = useState<AIReview | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [conversations, setConversations] = useState<AIConversationMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    const cleanup = window.electronAPI.ai.onStream((event: AIStreamEvent) => {
      switch (event.type) {
        case 'start':
          setStreaming(true);
          setStreamContent('');
          setError('');
          setCurrentReviewId(event.reviewId || '');
          break;
        case 'delta':
          setStreamContent(prev => prev + (event.content || ''));
          break;
        case 'done':
          setStreaming(false);
          fetchReviews();
          break;
        case 'error':
          setStreaming(false);
          setError(event.error || '分析失败');
          message.error(event.error || '分析失败');
          break;
      }
    });
    return cleanup;
  }, []);

  const fetchReviews = async () => {
    const result = await window.electronAPI.ai.listReviews();
    if (result.success) {
      setReviews(result.data as AIReview[]);
    }
  };

  const handleReviewTypeChange = (type: ReviewType) => {
    setReviewType(type);
    const today = dayjs();
    switch (type) {
      case 'daily':
        setDateRange([today, today]);
        break;
      case 'weekly':
        setDateRange([today.startOf('week'), today.endOf('week')]);
        break;
      case 'monthly':
        setDateRange([today.startOf('month'), today.endOf('month')]);
        break;
    }
  };

  const startReview = async () => {
    if (!dateRange[0] || !dateRange[1]) {
      message.warning('请选择日期范围');
      return;
    }
    setStreamContent('');
    setError('');
    setSelectedReview(null);
    await window.electronAPI.ai.startReview(
      reviewType,
      dateRange[0].format('YYYY-MM-DD'),
      dateRange[1].format('YYYY-MM-DD')
    );
  };

  const viewReview = async (review: AIReview) => {
    setSelectedReview(review);
    setStreamContent(review.ai_response);
    setUserNote(review.user_note || '');
    setShowHistory(false);
  };

  const toggleFavorite = async (id: string) => {
    await window.electronAPI.ai.toggleFavorite(id);
    fetchReviews();
  };

  const deleteReview = async (id: string) => {
    await window.electronAPI.ai.deleteReview(id);
    fetchReviews();
    if (selectedReview?.id === id) {
      setSelectedReview(null);
      setStreamContent('');
    }
  };

  const saveNote = async () => {
    if (selectedReview) {
      await window.electronAPI.ai.updateNote(selectedReview.id, userNote);
      message.success('笔记已保存');
      fetchReviews();
    }
  };

  // Fetch conversation when a review is selected
  const fetchConversations = useCallback(async (reviewId: string) => {
    const result = await window.electronAPI.ai.getConversations(reviewId);
    if (result.success) {
      setConversations(result.data || []);
    }
  }, []);

  // When selected review changes, fetch conversations
  useEffect(() => {
    if (selectedReview) {
      fetchConversations(selectedReview.id);
      setUserNote(selectedReview.user_note || '');
    }
  }, [selectedReview, fetchConversations]);

  // Ask a follow-up question
  const askQuestion = async () => {
    if (!question.trim() || !selectedReview || asking) return;

    setAsking(true);
    try {
      await window.electronAPI.ai.askConversation(selectedReview.id, question.trim());
      setQuestion('');
      // Refresh conversations after asking
      await fetchConversations(selectedReview.id);
    } catch (err: any) {
      message.error(err?.message || '提问失败');
    } finally {
      setAsking(false);
    }
  };

  const reviewTypeLabels: Record<ReviewType, string> = {
    daily: '日复盘',
    weekly: '周复盘',
    monthly: '月复盘',
    custom: '自定义',
  };

  return (
    <div>
      <Title level={4}>AI 智能复盘</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <span>复盘类型：</span>
          <Select
            value={reviewType}
            onChange={handleReviewTypeChange}
            style={{ width: 120 }}
            options={[
              { value: 'daily', label: '日复盘' },
              { value: 'weekly', label: '周复盘' },
              { value: 'monthly', label: '月复盘' },
              { value: 'custom', label: '自定义' },
            ]}
          />
          <span>日期范围：</span>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates) setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs]);
            }}
          />
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={startReview}
            loading={streaming}
          >
            {streaming ? '分析中...' : '开始复盘'}
          </Button>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => setShowHistory(true)}
          >
            历史记录 ({reviews.length})
          </Button>
        </Space>
      </Card>

      {error && (
        <Card style={{ marginBottom: 16, borderColor: '#ff4d4f' }}>
          <Text type="danger">{error}</Text>
        </Card>
      )}

      {(streamContent || streaming) && (
        <Card
          title={
            selectedReview
              ? `${reviewTypeLabels[selectedReview.review_type as ReviewType]} - ${selectedReview.start_date} ~ ${selectedReview.end_date}`
              : '分析结果'
          }
          extra={streaming ? <Spin size="small" /> : null}
        >
          <div style={{ minHeight: 200 }}>
            <ReactMarkdown>{streamContent || '等待分析结果...'}</ReactMarkdown>
          </div>

          {selectedReview && !streaming && (
            <>
              <Divider />
              <div>
                <Text strong>我的笔记：</Text>
                <TextArea
                  value={userNote}
                  onChange={e => setUserNote(e.target.value)}
                  rows={3}
                  placeholder="记录你的想法和行动计划..."
                  style={{ marginTop: 8 }}
                />
                <Button type="primary" size="small" onClick={saveNote} style={{ marginTop: 8 }}>
                  保存笔记
                </Button>
              </div>
            </>
          )}

          {/* Multi-turn conversation section */}
          {selectedReview && conversations.length > 0 && (
            <>
              <Divider />
              <div>
                <Text strong style={{ marginBottom: 16, display: 'block' }}>追问记录：</Text>
                <div style={{ maxHeight: 300, overflow: 'auto', marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
                  {conversations.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        marginBottom: 12,
                        textAlign: msg.role === 'user' ? 'right' : 'left',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-block',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: msg.role === 'user' ? '#1677ff' : '#fff',
                          color: msg.role === 'user' ? '#fff' : '#000',
                          maxWidth: '80%',
                          textAlign: 'left',
                        }}
                      >
                        <Text strong style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                          {msg.role === 'user' ? '你' : 'AI'}
                        </Text>
                        <ReactMarkdown style={{ margin: 0 }}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>

                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="继续追问AI..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onPressEnter={askQuestion}
                    disabled={asking}
                  />
                  <Button type="primary" onClick={askQuestion} loading={asking}>
                    发送
                  </Button>
                </Space.Compact>
              </div>
            </>
          )}

          {/* Show ask button even if no conversations yet, but review exists */}
          {selectedReview && conversations.length === 0 && !streaming && (
            <>
              <Divider />
              <div>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>有问题需要AI解答？</Text>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="继续追问AI..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onPressEnter={askQuestion}
                    disabled={asking}
                  />
                  <Button type="primary" onClick={askQuestion} loading={asking}>
                    发送
                  </Button>
                </Space.Compact>
              </div>
            </>
          )}
        </Card>
      )}

      <Modal
        title="历史复盘记录"
        open={showHistory}
        onCancel={() => setShowHistory(false)}
        footer={null}
        width={600}
      >
        <List
          dataSource={reviews}
          renderItem={(review) => (
            <List.Item
              actions={[
                <Button
                  type="text"
                  icon={review.is_favorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                  onClick={() => toggleFavorite(review.id)}
                />,
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => deleteReview(review.id)}
                />,
              ]}
            >
              <List.Item.Meta
                title={
                  <a onClick={() => viewReview(review)}>
                    <Tag color="blue">{reviewTypeLabels[review.review_type as ReviewType]}</Tag>
                    {review.start_date} ~ {review.end_date}
                  </a>
                }
                description={dayjs(review.created_at).format('YYYY-MM-DD HH:mm')}
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无复盘记录' }}
        />
      </Modal>
    </div>
  );
};

export default AIReviewPage;
