import React, { useEffect, useRef, createContext, useContext } from 'react';
import { Layout, Menu, Segmented, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  PlusCircleOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  RobotOutlined,
  WalletOutlined,
  SettingOutlined,
  ImportOutlined,
  CalendarOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useCurrencyStore } from '../../stores';
import type { CurrencyCode } from '../../utils/currency';

const { Sider, Content } = Layout;
const { Text } = Typography;

type SaveCallback = () => void;

const SaveContext = createContext<React.MutableRefObject<SaveCallback | null> | null>(null);

export const useSaveCallback = () => {
  const ref = useContext(SaveContext);
  return {
    setSaveCallback: (callback: SaveCallback) => {
      if (ref) ref.current = callback;
    },
    clearSaveCallback: () => {
      if (ref) ref.current = null;
    },
  };
};

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '首页看板' },
  { key: '/new-trade', icon: <PlusCircleOutlined />, label: '新建交易' },
  { key: '/trade-log', icon: <UnorderedListOutlined />, label: '交易日志' },
  { key: '/positions', icon: <WalletOutlined />, label: '当前持仓' },
  { key: '/statistics', icon: <BarChartOutlined />, label: '统计分析' },
  { key: '/ai-review', icon: <RobotOutlined />, label: 'AI复盘' },
  { key: '/briefing', icon: <CalendarOutlined />, label: '每日简报' },
  { key: '/journal', icon: <BookOutlined />, label: '交易日记' },
  { key: '/import', icon: <ImportOutlined />, label: '数据导入' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const saveCallbackRef = useRef<SaveCallback | null>(null);
  const { displayCurrency, setDisplayCurrency } = useCurrencyStore();
  const showCurrencyControl = location.pathname !== '/new-trade';

  useEffect(() => {
    const cleanupNewTrade = window.electronAPI.shortcut.onNewTrade(() => {
      navigate('/new-trade');
    });

    const cleanupSave = window.electronAPI.shortcut.onSave(() => {
      if (saveCallbackRef.current) {
        saveCallbackRef.current();
      }
    });

    const cleanupRefresh = window.electronAPI.shortcut.onRefresh(() => {
      window.location.reload();
    });

    return () => {
      cleanupNewTrade();
      cleanupSave();
      cleanupRefresh();
    };
  }, [navigate]);

  return (
    <SaveContext.Provider value={saveCallbackRef}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          width={200}
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
          }}
        >
          <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
            fontWeight: 'bold',
            fontSize: 16,
            color: '#1677ff',
          }}>
            交易复盘系统
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0, paddingTop: 8 }}
          />
        </Sider>
        <Layout>
          <Content style={{
            padding: 24,
            background: '#f5f5f5',
            overflow: 'auto',
          }}>
            {showCurrencyControl && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <Space size={8}>
                  <Text type="secondary">统一币种</Text>
                  <Segmented<CurrencyCode>
                    size="small"
                    value={displayCurrency}
                    onChange={(next) => setDisplayCurrency(next as CurrencyCode)}
                    options={[
                      { label: '人民币 CNY', value: 'CNY' },
                      { label: '港币 HKD', value: 'HKD' },
                      { label: '美元 USD', value: 'USD' },
                    ]}
                  />
                </Space>
              </div>
            )}
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </SaveContext.Provider>
  );
};

export default AppLayout;
