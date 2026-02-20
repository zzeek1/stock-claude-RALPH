import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Input,
  Button,
  Space,
  Tag,
  Rate,
  Slider,
  Select,
  message,
  Typography,
  Divider,
  List,
  Empty,
} from 'antd';
import {
  SaveOutlined,
  CalendarOutlined,
  SmileOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { JournalEntry, Emotion } from '../../shared/types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const moodOptions: { label: string; value: Emotion }[] = [
  { label: '冷静', value: '冷静' },
  { label: '兴奋', value: '兴奋' },
  { label: '焦虑', value: '焦虑' },
  { label: '恐惧', value: '恐惧' },
  { label: '贪婪', value: '贪婪' },
  { label: '犹豫', value: '犹豫' },
  { label: '自信', value: '自信' },
  { label: '沮丧', value: '沮丧' },
];

const weatherOptions = ['晴', '多云', '阴', '雨', '雪', '雷暴', '雾'];
const healthOptions = ['良好', '疲劳', '感冒', '头痛', '其他'];

const JournalPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [currentJournal, setCurrentJournal] = useState<JournalEntry | null>(null);
  const [recentJournals, setRecentJournals] = useState<JournalEntry[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<Emotion | undefined>();
  const [energyLevel, setEnergyLevel] = useState<number>(3);
  const [weather, setWeather] = useState<string | undefined>();
  const [sleepQuality, setSleepQuality] = useState<number>(3);
  const [healthStatus, setHealthStatus] = useState<string | undefined>();
  const [focusTime, setFocusTime] = useState<number | undefined>();
  const [distractions, setDistractions] = useState('');
  const [tradingDecisionQuality, setTradingDecisionQuality] = useState<number>(3);
  const [followPlanRate, setFollowPlanRate] = useState<number>(50);
  const [mistakeType, setMistakeType] = useState('');
  const [improvementArea, setImprovementArea] = useState('');
  const [wins, setWins] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Fetch journal for selected date
  const fetchJournal = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const result = await window.electronAPI.journal.getByDate(date);
      if (result.success && result.data) {
        const journal = result.data;
        setCurrentJournal(journal);
        setTitle(journal.title || '');
        setContent(journal.content || '');
        setMood(journal.mood);
        setEnergyLevel(journal.energy_level || 3);
        setWeather(journal.weather);
        setSleepQuality(journal.sleep_quality || 3);
        setHealthStatus(journal.health_status);
        setFocusTime(journal.focus_time);
        setDistractions(journal.distractions || '');
        setTradingDecisionQuality(journal.trading_decision_quality || 3);
        setFollowPlanRate(journal.follow_plan_rate || 50);
        setMistakeType(journal.mistake_type || '');
        setImprovementArea(journal.improvement_area || '');
        setWins(journal.wins || '');
        setGratitude(journal.gratitude || '');
        setTomorrowPlan(journal.tomorrow_plan || '');
        setTags(journal.tags || []);
      } else {
        // New day - reset form
        setCurrentJournal(null);
        resetForm();
      }
    } catch (err: any) {
      message.error(err?.message || '获取日记失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch recent journals
  const fetchRecentJournals = useCallback(async () => {
    try {
      const endDate = dayjs().format('YYYY-MM-DD');
      const startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
      const result = await window.electronAPI.journal.getByDateRange(startDate, endDate);
      if (result.success) {
        setRecentJournals(result.data || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch recent journals:', err);
    }
  }, []);

  useEffect(() => {
    fetchJournal(selectedDate.format('YYYY-MM-DD'));
    fetchRecentJournals();
  }, [selectedDate, fetchJournal, fetchRecentJournals]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setMood(undefined);
    setEnergyLevel(3);
    setWeather(undefined);
    setSleepQuality(3);
    setHealthStatus(undefined);
    setFocusTime(undefined);
    setDistractions('');
    setTradingDecisionQuality(3);
    setFollowPlanRate(50);
    setMistakeType('');
    setImprovementArea('');
    setWins('');
    setGratitude('');
    setTomorrowPlan('');
    setTags([]);
  };

  const handleDateChange = (date: Dayjs | null) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      message.warning('请输入日记标题');
      return;
    }

    setLoading(true);
    try {
      const journalData = {
        date: selectedDate.format('YYYY-MM-DD'),
        title: title.trim(),
        content: content.trim(),
        mood,
        energy_level: energyLevel,
        weather,
        sleep_quality: sleepQuality,
        health_status: healthStatus,
        focus_time: focusTime,
        distractions: distractions.trim() || undefined,
        trading_decision_quality: tradingDecisionQuality,
        follow_plan_rate: followPlanRate,
        mistake_type: mistakeType.trim() || undefined,
        improvement_area: improvementArea.trim() || undefined,
        wins: wins.trim() || undefined,
        gratitude: gratitude.trim() || undefined,
        tomorrow_plan: tomorrowPlan.trim() || undefined,
        tags,
      };

      const result = await window.electronAPI.journal.save(journalData);
      if (result.success) {
        setCurrentJournal(result.data);
        message.success('日记已保存');
        fetchRecentJournals();
      } else {
        message.error(result.error || '保存失败');
      }
    } catch (err: any) {
      message.error(err?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentJournal) return;

    try {
      const result = await window.electronAPI.journal.delete(currentJournal.id);
      if (result.success) {
        setCurrentJournal(null);
        resetForm();
        message.success('日记已删除');
        fetchRecentJournals();
      } else {
        message.error(result.error || '删除失败');
      }
    } catch (err: any) {
      message.error(err?.message || '删除失败');
    }
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev'
      ? selectedDate.subtract(1, 'day')
      : selectedDate.add(1, 'day');
    // Don't allow future dates
    if (newDate.isAfter(dayjs())) {
      message.warning('不能选择未来的日期');
      return;
    }
    setSelectedDate(newDate);
  };

  const isToday = selectedDate.isSame(dayjs(), 'day');

  return (
    <div>
      <Title level={4}>交易日记</Title>

      <Row gutter={[16, 16]}>
        {/* Left column - Calendar and recent journals */}
        <Col xs={24} md={6}>
          <Card title="选择日期" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <DatePicker
                value={selectedDate}
                onChange={handleDateChange}
                style={{ width: '100%' }}
                disabledDate={(current) => current && current.isAfter(dayjs())}
              />
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button
                  icon={<LeftOutlined />}
                  onClick={() => navigateDay('prev')}
                  size="small"
                >
                  前一天
                </Button>
                <Button
                  type={isToday ? 'primary' : 'default'}
                  onClick={() => setSelectedDate(dayjs())}
                  size="small"
                >
                  今天
                </Button>
                <Button
                  icon={<RightOutlined />}
                  onClick={() => navigateDay('next')}
                  size="small"
                  disabled={isToday}
                >
                  后一天
                </Button>
              </Space>
            </Space>
          </Card>

          <Card
            title="最近日记"
            size="small"
            style={{ marginTop: 16 }}
            bodyStyle={{ maxHeight: 400, overflow: 'auto' }}
          >
            {recentJournals.length > 0 ? (
              <List
                size="small"
                dataSource={recentJournals}
                renderItem={(item) => (
                  <List.Item
                    style={{ cursor: 'pointer', padding: '8px 12px' }}
                    onClick={() => setSelectedDate(dayjs(item.date))}
                  >
                    <Space direction="vertical" size={0}>
                      <Text strong>{dayjs(item.date).format('MM/DD')}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.title.substring(0, 15)}
                        {item.title.length > 15 ? '...' : ''}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无日记" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        {/* Right column - Journal form */}
        <Col xs={24} md={18}>
          <Card
            title={currentJournal ? `编辑日记 - ${selectedDate.format('YYYY年MM月DD日')}` : `新日记 - ${selectedDate.format('YYYY年MM月DD日')}`}
            extra={
              <Space>
                {currentJournal && (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleDelete}
                    size="small"
                  >
                    删除
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={loading}
                >
                  保存
                </Button>
              </Space>
            }
          >
            <Row gutter={[16, 16]}>
              {/* Title and basic info */}
              <Col span={24}>
                <Input
                  placeholder="日记标题"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ fontWeight: 'bold', fontSize: 16 }}
                />
              </Col>

              <Col span={24}>
                <TextArea
                  placeholder="今日交易总结：记录你的交易思路、决策过程、执行情况..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                />
              </Col>

              {/* Morning status */}
              <Col span={24}>
                <Divider orientation="left">晨间状态</Divider>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>情绪</Text>
                  <Select
                    placeholder="选择情绪"
                    value={mood}
                    onChange={setMood}
                    allowClear
                    style={{ width: '100%' }}
                    options={moodOptions}
                  />
                </Space>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>精力水平: {energyLevel}</Text>
                  <Slider
                    min={1}
                    max={5}
                    value={energyLevel}
                    onChange={setEnergyLevel}
                    marks={{ 1: '低', 3: '中', 5: '高' }}
                  />
                </Space>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>天气</Text>
                  <Select
                    placeholder="选择天气"
                    value={weather}
                    onChange={setWeather}
                    allowClear
                    style={{ width: '100%' }}
                    options={weatherOptions.map((w) => ({ label: w, value: w }))}
                  />
                </Space>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>睡眠质量: {sleepQuality}</Text>
                  <Slider
                    min={1}
                    max={5}
                    value={sleepQuality}
                    onChange={setSleepQuality}
                    marks={{ 1: '差', 3: '一般', 5: '好' }}
                  />
                </Space>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>健康状况</Text>
                  <Select
                    placeholder="选择状态"
                    value={healthStatus}
                    onChange={setHealthStatus}
                    allowClear
                    style={{ width: '100%' }}
                    options={healthOptions.map((h) => ({ label: h, value: h }))}
                  />
                </Space>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>专注时长（分钟）</Text>
                  <Input
                    type="number"
                    placeholder="今日专注时长"
                    value={focusTime}
                    onChange={(e) => setFocusTime(e.target.value ? parseInt(e.target.value) : undefined)}
                    min={0}
                  />
                </Space>
              </Col>

              <Col span={24}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>干扰因素</Text>
                  <Input
                    placeholder="今日受到的干扰（社交媒体、噪音等）"
                    value={distractions}
                    onChange={(e) => setDistractions(e.target.value)}
                  />
                </Space>
              </Col>

              {/* Trading status */}
              <Col span={24}>
                <Divider orientation="left">交易状态</Divider>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>决策质量: {tradingDecisionQuality}</Text>
                  <Rate
                    count={5}
                    value={tradingDecisionQuality}
                    onChange={setTradingDecisionQuality}
                  />
                </Space>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>计划执行率: {followPlanRate}%</Text>
                  <Slider
                    min={0}
                    max={100}
                    value={followPlanRate}
                    onChange={setFollowPlanRate}
                    marks={{ 0: '0%', 50: '50%', 100: '100%' }}
                  />
                </Space>
              </Col>

              {/* Evening reflection */}
              <Col span={24}>
                <Divider orientation="left">晚间反思</Divider>
              </Col>

              <Col xs={24} md={12}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>今日亮点/成就</Text>
                  <TextArea
                    placeholder="今日做得好的地方..."
                    value={wins}
                    onChange={(e) => setWins(e.target.value)}
                    rows={2}
                  />
                </Space>
              </Col>

              <Col xs={24} md={12}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>感恩事项</Text>
                  <TextArea
                    placeholder="今日感恩的事情..."
                    value={gratitude}
                    onChange={(e) => setGratitude(e.target.value)}
                    rows={2}
                  />
                </Space>
              </Col>

              <Col xs={24} md={12}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>错误类型</Text>
                  <Input
                    placeholder="今日犯的错误（冲动、追涨、不止损等）"
                    value={mistakeType}
                    onChange={(e) => setMistakeType(e.target.value)}
                  />
                </Space>
              </Col>

              <Col xs={24} md={12}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>改进方向</Text>
                  <Input
                    placeholder="明日需要改进的地方..."
                    value={improvementArea}
                    onChange={(e) => setImprovementArea(e.target.value)}
                  />
                </Space>
              </Col>

              <Col span={24}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>明日计划</Text>
                  <TextArea
                    placeholder="明日的交易计划和目标..."
                    value={tomorrowPlan}
                    onChange={(e) => setTomorrowPlan(e.target.value)}
                    rows={2}
                  />
                </Space>
              </Col>

              <Col span={24}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text>标签</Text>
                  <Select
                    mode="tags"
                    placeholder="输入标签后回车"
                    value={tags}
                    onChange={setTags}
                    style={{ width: '100%' }}
                  />
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default JournalPage;
