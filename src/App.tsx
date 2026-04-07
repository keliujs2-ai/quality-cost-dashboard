import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QualityCostProvider } from './context/QualityCostContext';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './components/dashboard/DashboardPage';
import DetailPage from './components/detail/DetailPage';
import DataSourcePage from './components/datasource/DataSourcePage';
import MetricsPage from './components/metrics/MetricsPage';
import PredictionPage from './components/prediction/PredictionPage';

function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1890ff' } }}>
      <QualityCostProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/detail" element={<DetailPage />} />
              <Route path="/datasource" element={<DataSourcePage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/prediction" element={<PredictionPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QualityCostProvider>
    </ConfigProvider>
  );
}

export default App;
