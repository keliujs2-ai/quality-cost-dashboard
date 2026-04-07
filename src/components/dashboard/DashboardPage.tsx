import React, { useMemo, useState } from 'react';
import { Card, Row, Col, Statistic, Select, DatePicker, Space, Tag, Typography, Modal, Input, Checkbox, Button, List, Popconfirm } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import dayjs from 'dayjs';
import { useQualityCost } from '../../context/QualityCostContext';
import { CATEGORY_COLORS, CATEGORY_LABELS, ALL_METRIC_DEFINITIONS } from '../../data/constants';
import { formatCurrency, formatMonth, formatNumber } from '../../utils/formatters';
import type { DashboardView, StationModel } from '../../data/types';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const DashboardPage: React.FC = () => {
  const { costRecords, stations, dashboardViews, addDashboardView, deleteDashboardView } = useQualityCost();
  const [activeViewId, setActiveViewId] = useState(dashboardViews[0]?.id || '');
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<StationModel[]>([]);
  const [dateRange, setDateRange] = useState<[string, string]>(['2025-04', '2026-03']);
  const [showNewViewModal, setShowNewViewModal] = useState(false);

  const activeView = dashboardViews.find((v) => v.id === activeViewId) || dashboardViews[0];

  // Filter records
  const filtered = useMemo(() => {
    if (!activeView) return [];
    const viewMetricIds = new Set(activeView.metric_ids);
    return costRecords.filter((r) => {
      if (!viewMetricIds.has(r.metric_id)) return false;
      if (selectedStations.length > 0 && !selectedStations.includes(r.station_id)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(r.station_model)) return false;
      if (r.month < dateRange[0] || r.month > dateRange[1]) return false;
      return true;
    });
  }, [costRecords, activeView, selectedStations, selectedTypes, dateRange]);

  // Summary stats
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const r of filtered) {
      totals[r.category] = (totals[r.category] || 0) + r.calculated_cost;
    }
    return totals;
  }, [filtered]);

  const totalCost = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const monthMap = new Map<string, Record<string, number>>();
    for (const r of filtered) {
      if (!monthMap.has(r.month)) {
        monthMap.set(r.month, {});
      }
      const entry = monthMap.get(r.month)!;
      entry[r.category] = (entry[r.category] || 0) + r.calculated_cost;
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cats]) => ({
        month: formatMonth(month),
        ...cats,
        total: Object.values(cats).reduce((a, b) => a + b, 0),
      }));
  }, [filtered]);

  // Pie chart data
  const pieData = useMemo(() => {
    return Object.entries(categoryTotals)
      .filter(([, v]) => v > 0)
      .map(([cat, value]) => ({
        name: CATEGORY_LABELS[cat],
        value: Math.round(value),
        category: cat,
      }));
  }, [categoryTotals]);

  // Top 10 stations
  const topStations = useMemo(() => {
    const stationTotals = new Map<string, { name: string; total: number; categories: Record<string, number> }>();
    for (const r of filtered) {
      if (!stationTotals.has(r.station_id)) {
        stationTotals.set(r.station_id, { name: r.station_name, total: 0, categories: {} });
      }
      const entry = stationTotals.get(r.station_id)!;
      entry.total += r.calculated_cost;
      entry.categories[r.category] = (entry.categories[r.category] || 0) + r.calculated_cost;
    }
    return Array.from(stationTotals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((s) => ({ name: s.name, ...s.categories, total: Math.round(s.total) }));
  }, [filtered]);

  // MoM change (compare last 2 months)
  const momChange = useMemo(() => {
    const months = Array.from(new Set(filtered.map((r) => r.month))).sort();
    if (months.length < 2) return null;
    const lastMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];
    const lastTotal = filtered.filter((r) => r.month === lastMonth).reduce((s, r) => s + r.calculated_cost, 0);
    const prevTotal = filtered.filter((r) => r.month === prevMonth).reduce((s, r) => s + r.calculated_cost, 0);
    if (prevTotal === 0) return null;
    return (lastTotal - prevTotal) / prevTotal;
  }, [filtered]);

  return (
    <div>
      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>看板视图</div>
            <Select
              value={activeViewId}
              onChange={setActiveViewId}
              style={{ width: 200 }}
              options={dashboardViews.map((v) => ({ label: v.name, value: v.id }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>换电站</div>
            <Select
              mode="multiple"
              placeholder="全部"
              style={{ width: 200 }}
              options={stations.map((s) => ({ label: s.name, value: s.id }))}
              value={selectedStations}
              onChange={setSelectedStations}
              maxTagCount={1}
              allowClear
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>换电站类型</div>
            <Select
              mode="multiple"
              placeholder="全部"
              style={{ width: 160 }}
              options={[
                { label: 'PS2', value: 'PS2' },
                { label: 'PS3', value: 'PS3' },
                { label: 'PS4', value: 'PS4' },
              ]}
              value={selectedTypes}
              onChange={setSelectedTypes}
              allowClear
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>时间区间</div>
            <RangePicker
              picker="month"
              value={[dayjs(dateRange[0]), dayjs(dateRange[1])]}
              onChange={(dates) => {
                if (dates?.[0] && dates?.[1]) {
                  setDateRange([dates[0].format('YYYY-MM'), dates[1].format('YYYY-MM')]);
                }
              }}
            />
          </div>
        </Space>
      </Card>

      {/* Summary cards */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '3px solid #1890ff' }}>
            <Statistic
              title="总质量成本"
              value={totalCost}
              precision={0}
              prefix="¥"
              suffix={momChange != null ? (
                <span style={{ fontSize: 13, color: momChange > 0 ? '#f5222d' : '#52c41a' }}>
                  {momChange > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  {(Math.abs(momChange) * 100).toFixed(1)}%
                </span>
              ) : undefined}
            />
          </Card>
        </Col>
        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
          <Col span={Math.floor(18 / Object.keys(CATEGORY_LABELS).length)} key={cat}>
            <Card size="small" style={{ borderLeft: `3px solid ${CATEGORY_COLORS[cat]}` }}>
              <Statistic
                title={label}
                value={categoryTotals[cat] || 0}
                precision={0}
                prefix="¥"
                valueStyle={{ fontSize: 16 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title="成本趋势" size="small">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" style={{ fontSize: 11 }} />
                <YAxis style={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="total" name="总计" stroke="#333" strokeWidth={2} dot={{ r: 3 }} />
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                  <Line key={cat} type="monotone" dataKey={cat} name={label} stroke={CATEGORY_COLORS[cat]} strokeWidth={1.5} dot={{ r: 2 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="成本占比" size="small">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Station comparison */}
      <Card title="换电站成本 TOP 10" size="small" style={{ marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topStations} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => formatNumber(v)} style={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" style={{ fontSize: 11 }} width={100} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Legend />
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
              <Bar key={cat} dataKey={cat} name={label} stackId="a" fill={CATEGORY_COLORS[cat]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* View management */}
      <Card
        title="看板视图管理"
        size="small"
        extra={<Button icon={<PlusOutlined />} size="small" onClick={() => setShowNewViewModal(true)}>新建视图</Button>}
      >
        <List
          size="small"
          dataSource={dashboardViews}
          renderItem={(view) => (
            <List.Item
              actions={[
                <Popconfirm title="确定删除此视图?" onConfirm={() => deleteDashboardView(view.id)} key="del">
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={dashboardViews.length <= 1} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={view.name}
                description={`包含 ${view.metric_ids.length} 个指标`}
              />
            </List.Item>
          )}
        />
      </Card>

      <NewViewModal
        open={showNewViewModal}
        onClose={() => setShowNewViewModal(false)}
        onAdd={(view) => { addDashboardView(view); setActiveViewId(view.id); }}
      />
    </div>
  );
};

// New view modal
function NewViewModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (view: DashboardView) => void }) {
  const [name, setName] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof ALL_METRIC_DEFINITIONS> = {};
    for (const m of ALL_METRIC_DEFINITIONS) {
      if (m.status !== 'active') continue;
      (g[m.category] ||= []).push(m);
    }
    return g;
  }, []);

  const handleOk = () => {
    if (!name.trim() || selectedMetrics.length === 0) return;
    onAdd({
      id: `view_${Date.now()}`,
      name: name.trim(),
      metric_ids: selectedMetrics,
      dimensions: ['month', 'station'],
      chart_types: ['line', 'pie', 'bar'],
    });
    setName('');
    setSelectedMetrics([]);
    onClose();
  };

  return (
    <Modal title="新建看板视图" open={open} onCancel={onClose} onOk={handleOk} okText="创建" cancelText="取消" width={600}>
      <div style={{ marginBottom: 16 }}>
        <Text>视图名称</Text>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="输入视图名称" style={{ marginTop: 4 }} />
      </div>
      <Text>选择指标</Text>
      {Object.entries(grouped).map(([cat, metrics]) => (
        <div key={cat} style={{ marginTop: 8 }}>
          <Tag color={CATEGORY_COLORS[cat]}>{CATEGORY_LABELS[cat]}</Tag>
          <div style={{ marginTop: 4, paddingLeft: 8 }}>
            <Checkbox.Group
              options={metrics.map((m) => ({ label: m.name_zh, value: m.id }))}
              value={selectedMetrics.filter((id) => metrics.some((m) => m.id === id))}
              onChange={(vals) => {
                const otherIds = selectedMetrics.filter((id) => !metrics.some((m) => m.id === id));
                setSelectedMetrics([...otherIds, ...(vals as string[])]);
              }}
            />
          </div>
        </div>
      ))}
    </Modal>
  );
}

export default DashboardPage;
