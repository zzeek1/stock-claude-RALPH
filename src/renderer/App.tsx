import React, { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spin, Button } from 'antd';
import AppLayout from './components/Layout/AppLayout';

console.log('[App] Starting...');

const Dashboard = lazy(() => import('./pages/Dashboard'));
const TradeLog = lazy(() => import('./pages/TradeLog'));
const NewTrade = lazy(() => import('./pages/NewTrade'));
const Statistics = lazy(() => import('./pages/Statistics'));
const AIReview = lazy(() => import('./pages/AIReview'));
const Positions = lazy(() => import('./pages/Positions'));
const Settings = lazy(() => import('./pages/Settings'));
const Wizard = lazy(() => import('./pages/Wizard'));
const DataImport = lazy(() => import('./pages/DataImport'));
const Briefing = lazy(() => import('./pages/Briefing'));
const Journal = lazy(() => import('./pages/Journal'));

const PageLoader: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" />
  </div>
);

const App: React.FC = () => {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    console.log('[App] Checking setup...');
    const checkSetup = async () => {
      try {
        console.log('[App] Calling settings.get()...');
        const result = await window.electronAPI.settings.get();
        console.log('[App] settings.get() result:', result);
        if (result.success && result.data) {
          setIsSetupComplete(result.data.is_setup_complete === true);
        } else {
          console.log('[App] Setup not complete, showing wizard');
          setIsSetupComplete(false);
        }
      } catch (err) {
        console.error('[App] Error checking setup:', err);
        setIsSetupComplete(false);
      }
    };
    checkSetup();
  }, []);

  // Show loading while checking setup status
  if (isSetupComplete === null) {
    return <PageLoader />;
  }

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {!isSetupComplete ? (
            <Route path="*" element={<Wizard />} />
          ) : (
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="new-trade" element={<NewTrade />} />
              <Route path="trade-log" element={<TradeLog />} />
              <Route path="positions" element={<Positions />} />
              <Route path="statistics" element={<Statistics />} />
              <Route path="ai-review" element={<AIReview />} />
              <Route path="briefing" element={<Briefing />} />
              <Route path="journal" element={<Journal />} />
              <Route path="import" element={<DataImport />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          )}
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

export default App;
