import React from 'react';
import { Layout, Menu, Typography, Tag } from 'antd';
import {
  DatabaseOutlined,
  TableOutlined,
  SettingOutlined,
  DashboardOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '质量成本看板' },
  { key: '/detail', icon: <TableOutlined />, label: '明细查看' },
  { key: '/datasource', icon: <DatabaseOutlined />, label: '数据源配置' },
  { key: '/metrics', icon: <SettingOutlined />, label: '指标配置' },
  { key: '/prediction', icon: <LineChartOutlined />, label: '指标预测' },
  { type: 'divider' as const },
  { key: '/dashboard-config', icon: <SettingOutlined />, label: '看板配置' },
];

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark" style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 10 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Title level={4} style={{ color: '#fff', margin: 0, fontSize: 16 }}>
            质量成本管理系统
          </Title>
          <Tag color="blue" style={{ marginTop: 8 }}>产品概念 Demo</Tag>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8 }}
        />
      </Sider>
      <Layout style={{ marginLeft: 220 }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text strong style={{ fontSize: 16 }}>
            {menuItems.find((item) => item.key === location.pathname)?.label || '质量成本看板'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            数据区间: 2025年4月 - 2026年3月 (Mock数据)
          </Text>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 8, minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
