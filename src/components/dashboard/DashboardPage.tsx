import React, { useMemo, useState } from 'react';
import { Tabs, Card, Row, Col, Statistic, Select, DatePicker, Space, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line,
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
  const { costRecords, stations, dashboardViews, metricDefinitions } = useQualityCost();
  const [activeViewId, setActiveViewId] = useState(dashboardViews[0]?.id || '');
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<StationModel[]>([]);
  const [dateRange, setDateRange] = useState<[string, string]>(['2025-04', '2026-03']);
  // For per-category trend chart
  const [selectedCategory, setSelectedCategory] = useState<string>('labor');

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

  // === Metric cards: Total + per category ===
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const r of filtered) {
      totals[r.category] = (totals[r.category] || 0) + r.calculated_cost;
    }
    return totals;
  }, [filtered]);

  const totalCost = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  // MoM change
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

  // === Pie: Cost by device type (station model) ===
  const deviceTypePieData = useMemo(() => {
    const modelTotals: Record<string, number> = {};
    for (const r of filtered) {
      modelTotals[r.station_model] = (modelTotals[r.station_model] || 0) + r.calculated_cost;
    }
    return Object.entries(modelTotals)
      .filter(([, v]) => v > 0)
      .map(([model, value]) => ({ name: model, value: Math.round(value), model }));
  }, [filtered]);

  // === Stacked area: Total cost trend by category ===
  const totalTrendData = useMemo(() => {
    const monthMap = new Map<string, Record<string, number>>();
    for (const r of filtered) {
      if (!monthMap.has(r.month)) monthMap.set(r.month, {});
      const entry = monthMap.get(r.month)!;
      entry[r.category] = (entry[r.category] || 0) + r.calculated_cost;
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cats]) => ({
        month: formatMonth(month),
        ...cats,
      }));
  }, [filtered]);

  // === Stacked area: Per-category trend by metric ===
  const categoryMetricNames = useMemo(() => {
    // Get unique metric names for the selected category
    const names = new Set<string>();
    for (const r of filtered) {
      if (r.category === selectedCategory) names.add(r.metric_name);
    }
    return Array.from(names);
  }, [filtered, selectedCategory]);

  const categoryTrendData = useMemo(() => {
    const monthMap = new Map<string, Record<string, number>>();
    for (const r of filtered) {
      if (r.category !== selectedCategory) continue;
      if (!monthMap.has(r.month)) monthMap.set(r.month, {});
      const entry = monthMap.get(r.month)!;
      entry[r.metric_name] = (entry[r.metric_name] || 0) + r.calculated_cost;
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, metrics]) => ({
        month: formatMonth(month),
        ...metrics,
      }));
  }, [filtered, selectedCategory]);

  // Color palette for metrics within a category
  const metricColors = useMemo(() => {
    const palette = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb', '#9254de', '#ff7a45'];
    const map: Record<string, string> = {};
    categoryMetricNames.forEach((name, i) => { map[name] = palette[i % palette.length]; });
    return map;
  }, [categoryMetricNames]);

  // === MIS average cost per station ===
  const misAvgData = useMemo(() => {
    // Group by MIS: { mis -> { totalCost, stationSet } }
    const misMap = new Map<number, { totalCost: number; stationIds: Set<string> }>();
    for (const r of filtered) {
      if (!misMap.has(r.mis)) misMap.set(r.mis, { totalCost: 0, stationIds: new Set() });
      const entry = misMap.get(r.mis)!;
      entry.totalCost += r.calculated_cost;
      entry.stationIds.add(r.station_id);
    }
    return Array.from(misMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([mis, { totalCost, stationIds }]) => ({
        mis,
        avgCost: Math.round(totalCost / stationIds.size),
      }));
  }, [filtered]);

  // === MIS cumulative cost per station ===
  const misCumulativeData = useMemo(() => {
    // For each station, calculate cumulative cost up to each MIS
    // Then average across stations with same MIS
    const stationMisCost = new Map<string, Map<number, number>>();
    for (const r of filtered) {
      if (!stationMisCost.has(r.station_id)) stationMisCost.set(r.station_id, new Map());
      const misCosts = stationMisCost.get(r.station_id)!;
      misCosts.set(r.mis, (misCosts.get(r.mis) || 0) + r.calculated_cost);
    }

    // For each station, compute cumulative sums
    const stationCumulative = new Map<string, Map<number, number>>();
    for (const [stationId, misCosts] of stationMisCost.entries()) {
      const sortedMis = Array.from(misCosts.keys()).sort((a, b) => a - b);
      let cum = 0;
      const cumMap = new Map<number, number>();
      for (const mis of sortedMis) {
        cum += misCosts.get(mis)!;
        cumMap.set(mis, cum);
      }
      stationCumulative.set(stationId, cumMap);
    }

    // Average cumulative cost across stations at each MIS
    const allMis = new Set<number>();
    for (const cumMap of stationCumulative.values()) {
      for (const mis of cumMap.keys()) allMis.add(mis);
    }

    return Array.from(allMis).sort((a, b) => a - b).map((mis) => {
      let sum = 0;
      let count = 0;
      for (const cumMap of stationCumulative.values()) {
        const val = cumMap.get(mis);
        if (val != null) { sum += val; count++; }
      }
      return { mis, cumAvgCost: count > 0 ? Math.round(sum / count) : 0 };
    });
  }, [filtered]);

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

      {/* Summary cards: Total + 5 categories */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={4}>
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
          <Col span={4} key={cat}>
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

      {/* Row 1: Device type pie + Total cost trend (stacked area) */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card title="设备类型成本占比" size="small">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={deviceTypePieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
                >
                  {deviceTypePieData.map((entry) => (
                    <Cell key={entry.model} fill={STATION_MODEL_COLORS[entry.model]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={16}>
          <Card title="总成本趋势（按成本类型堆叠）" size="small">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={totalTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" style={{ fontSize: 11 }} />
                <YAxis style={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                  <Area
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    name={label}
                    stackId="1"
                    fill={CATEGORY_COLORS[cat]}
                    stroke={CATEGORY_COLORS[cat]}
                    fillOpacity={0.7}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Row 2: Per-category trend (stacked area by metric) */}
      <Card
        title={
          <Space>
            <span>成本类型明细趋势（按指标堆叠）</span>
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 140 }}
              options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k }))}
              size="small"
            />
          </Space>
        }
        size="small"
        style={{ marginBottom: 16 }}
      >
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={categoryTrendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" style={{ fontSize: 11 }} />
            <YAxis style={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Legend />
            {categoryMetricNames.map((name) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stackId="1"
                fill={metricColors[name]}
                stroke={metricColors[name]}
                fillOpacity={0.7}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Row 3: MIS charts */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="MIS 单站平均成本" size="small">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={misAvgData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="mis"
                  style={{ fontSize: 11 }}
                  label={{ value: 'MIS（月）', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                />
                <YAxis style={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  labelFormatter={(label) => `MIS ${label}`}
                />
                <Line type="monotone" dataKey="avgCost" name="单站平均成本" stroke="#1890ff" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <Text type="secondary" style={{ fontSize: 11 }}>
              MIS 相同的所有站点成本总和 / 站点数，反映单站在每个服役月龄的平均成本水平
            </Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="MIS 单站累计成本" size="small">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={misCumulativeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="mis"
                  style={{ fontSize: 11 }}
                  label={{ value: 'MIS（月）', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                />
                <YAxis style={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  labelFormatter={(label) => `MIS ${label}`}
                />
                <Line type="monotone" dataKey="cumAvgCost" name="单站累计成本" stroke="#f5222d" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <Text type="secondary" style={{ fontSize: 11 }}>
              每个站从 MIS=1 到当前 MIS 的成本累计值，再按站求平均，反映设备生命周期总投入
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
