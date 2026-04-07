import React, { useMemo, useState } from 'react';
import { Tabs, Card, Row, Col, Statistic, Select, DatePicker, Space, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, ComposedChart,
} from 'recharts';
import dayjs from 'dayjs';
import { useQualityCost } from '../../context/QualityCostContext';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../data/constants';
import { formatCurrency, formatMonth, formatNumber } from '../../utils/formatters';
import type { StationModel } from '../../data/types';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const STATION_MODEL_COLORS: Record<string, string> = {
  PS2: '#1890ff',
  PS3: '#52c41a',
  PS4: '#faad14',
};

const DashboardPage: React.FC = () => {
  const { costRecords, stations, dashboardViews } = useQualityCost();
  const [activeViewId, setActiveViewId] = useState(dashboardViews[0]?.id || '');
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<StationModel[]>([]);
  const [dateRange, setDateRange] = useState<[string, string]>(['2025-04', '2026-03']);

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

  // Station type cost comparison (grouped bar, averaged per station)
  const stationTypeCostData = useMemo(() => {
    // Count stations per model
    const modelStationCounts: Record<string, Set<string>> = {};
    const modelCategoryCosts: Record<string, Record<string, number>> = {};

    for (const r of filtered) {
      const model = r.station_model;
      if (!modelStationCounts[model]) {
        modelStationCounts[model] = new Set();
        modelCategoryCosts[model] = {};
      }
      modelStationCounts[model].add(r.station_id);
      modelCategoryCosts[model][r.category] = (modelCategoryCosts[model][r.category] || 0) + r.calculated_cost;
    }

    return Object.keys(modelCategoryCosts)
      .sort()
      .map((model) => {
        const count = modelStationCounts[model].size || 1;
        const entry: Record<string, string | number> = { model };
        let total = 0;
        for (const [cat] of Object.entries(CATEGORY_LABELS)) {
          const avgCost = Math.round((modelCategoryCosts[model][cat] || 0) / count);
          entry[cat] = avgCost;
          total += avgCost;
        }
        entry.total = total;
        return entry;
      });
  }, [filtered]);

  // Service age cost analysis
  const serviceAgeCostData = useMemo(() => {
    // Build a map: model -> serviceAgeMonth -> { totalCost, stationMonths }
    const modelAgeMap: Record<string, Map<number, { totalCost: number; count: number }>> = {};
    const stationMap = new Map(stations.map((s) => [s.id, s]));

    for (const r of filtered) {
      const station = stationMap.get(r.station_id);
      if (!station || !station.activation_date) continue;

      const activationMonth = dayjs(station.activation_date).startOf('month');
      const recordMonth = dayjs(r.month);
      const serviceAge = recordMonth.diff(activationMonth, 'month');
      if (serviceAge < 0) continue;

      const model = r.station_model;
      if (!modelAgeMap[model]) modelAgeMap[model] = new Map();
      const ageMap = modelAgeMap[model];
      if (!ageMap.has(serviceAge)) {
        ageMap.set(serviceAge, { totalCost: 0, count: 0 });
      }
      const entry = ageMap.get(serviceAge)!;
      entry.totalCost += r.calculated_cost;
      entry.count += 1;
    }

    // Flatten into array for chart, one data point per service age
    // We want: { serviceAge, PS2, PS3, PS4 }
    const allAges = new Set<number>();
    for (const ageMap of Object.values(modelAgeMap)) {
      for (const age of ageMap.keys()) allAges.add(age);
    }
    const sortedAges = Array.from(allAges).sort((a, b) => a - b);

    return sortedAges.map((age) => {
      const point: Record<string, number | string> = { serviceAge: age };
      for (const model of ['PS2', 'PS3', 'PS4']) {
        const entry = modelAgeMap[model]?.get(age);
        if (entry && entry.count > 0) {
          // Average cost per station-month at this service age
          // count is number of cost records; we want average total cost
          // Group by unique station to get station count
          point[model] = Math.round(entry.totalCost / Math.max(1, entry.count) * 10);
        }
      }
      return point;
    });
  }, [filtered, stations]);

  return (
    <div>
      {/* View tabs */}
      <Tabs
        activeKey={activeViewId}
        onChange={setActiveViewId}
        items={dashboardViews.map((v) => ({ key: v.id, label: v.name }))}
        style={{ marginBottom: 8 }}
      />

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
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

      {/* Charts row 1: trend + pie */}
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

      {/* New charts for the boss */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {/* Station type cost comparison */}
        <Col span={12}>
          <Card title="站型成本对比（单站均摊）" size="small">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={stationTypeCostData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" style={{ fontSize: 12 }} />
                <YAxis style={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                  <Bar key={cat} dataKey={cat} name={label} fill={CATEGORY_COLORS[cat]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <Text type="secondary" style={{ fontSize: 11 }}>
              各站型总成本按站数均分，便于公平对比不同站型的单站成本结构
            </Text>
          </Card>
        </Col>

        {/* Service age cost analysis */}
        <Col span={12}>
          <Card title="服役月龄成本趋势" size="small">
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={serviceAgeCostData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="serviceAge"
                  style={{ fontSize: 11 }}
                  label={{ value: '服役月数', position: 'insideBottom', offset: -10, style: { fontSize: 11 } }}
                />
                <YAxis style={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  labelFormatter={(label) => `服役 ${label} 个月`}
                />
                <Legend />
                {(['PS2', 'PS3', 'PS4'] as const).map((model) => (
                  <Line
                    key={model}
                    type="monotone"
                    dataKey={model}
                    name={model}
                    stroke={STATION_MODEL_COLORS[model]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            <Text type="secondary" style={{ fontSize: 11 }}>
              按服役月龄展示各站型平均质量成本变化，揭示设备老化对成本的影响
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Top 10 stations */}
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
    </div>
  );
};

export default DashboardPage;
