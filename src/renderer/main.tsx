import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, Button } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';

// Pre-load Button to ensure it's registered
import 'antd/dist/reset.css';

// Ensure icons are loaded
import '@ant-design/icons';

const ThemedApp: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <App />
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemedApp />
  </React.StrictMode>
);
