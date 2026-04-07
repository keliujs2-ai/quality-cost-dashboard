import React, { useMemo, useState } from 'react';
import { Card, Row, Col, Select, Slider, Switch, Typography, Space, Tag, Empty } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart, ReferenceLine } from 'recharts';
import { useQualityCost } from '../../context/QualityCostContext';
import { CATEGORY_LABELS } from '../../data/constants';
import { predict } from '../../utils/prediction';
import { formatCurrency, formatMonth, formatNumber } from '../../utils/formatters';
import type { TimeSeriesPoint } from '../../data/types';

const { Text } = Typography;

const PredictionPage: React.FC = () => {
  const { costRecords, metricDefinitions, stations } = useQualityCost();

  const [selectedMetricId, setSelectedMetricId] = useState<string>('__total__');
  const [stepsAhead, setStepsAhead] = useState(6);
  const [showCI, setShowCI] = useState(true);
  const [showDecomposition, setShowDecomposition] = useState(false);
  const [selectedStation, setSelectedStation] = useState<string>('__all__');

  // Build metric options
  const metricOptions = useMemo(() => {
    const options = [
      { label: '--- 汇总指标 ---', value: '__total__', disabled: true },
      { label: '总质量成本', value: '__total_cost__' },
      ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: `__cat_${k}__` })),
      { label: '--- 明细指标 ---', value: '__detail__', disabled: true },
      ...metricDefinitions
        .filter((m) => m.status === 'active')
        .map((m) => ({ label: m.name_zh, value: m.id })),
    ];
    return options;
  }, [metricDefinitions]);

  // Build time series from filtered records
  const historical = useMemo((): TimeSeriesPoint[] => {
    let records = costRecords;

    // Filter by station
    if (selectedStation !== '__all__') {
      records = records.filter((r) => r.station_id === selectedStation);
    }

    // Filter by selected metric/category
    if (selectedMetricId === '__total_cost__') {
      // all records
    } else if (selectedMetricId.startsWith('__cat_')) {
      const cat = selectedMetricId.replace('__cat_', '').replace('__', '');
      records = records.filter((r) => r.category === cat);
    } else if (selectedMetricId !== '__total__') {
      records = records.filter((r) => r.metric_id === selectedMetricId);
    }

    // Aggregate by month
    const monthMap = new Map<string, number>();
    for (const r of records) {
      monthMap.set(r.month, (monthMap.get(r.month) || 0) + r.calculated_cost);
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, value }));
  }, [costRecords, selectedMetricId, selectedStation]);

  // Run prediction
  const predictionResult = useMemo(() => {
    if (historical.length < 4) return null;
    return predict(historical, stepsAhead);
  }, [historical, stepsAhead]);

  // Build chart data
  const chartData = useMemo(() => {
    if (!predictionResult) return [];

    const data: Array<{
      month: string;
      monthLabel: string;
      actual?: number;
      predicted?: number;
      upper?: number;
      lower?: number;
      ciRange?: [number, number];
    }> = [];

    // Historical points
    for (const p of predictionResult.historical) {
      data.push({
        month: p.month,
        monthLabel: formatMonth(p.month),
        actual: p.value,
      });
    }

    // Add last historical point as start of prediction for continuity
    const lastHistorical = predictionResult.historical[predictionResult.historical.length - 1];
    if (lastHistorical && data.length > 0) {
      data[data.length - 1].predicted = lastHistorical.value;
    }

    // Predicted points
    for (let i = 0; i < predictionResult.predicted.length; i++) {
      const p = predictionResult.predicted[i];
      data.push({
        month: p.month,
        monthLabel: formatMonth(p.month),
        predicted: p.value,
        upper: predictionResult.upperBound[i].value,
        lower: predictionResult.lowerBound[i].value,
        ciRange: [predictionResult.lowerBound[i].value, predictionResult.upperBound[i].value],
      });
    }

    return data;
  }, [predictionResult]);

  // Decomposition chart data
  const decompositionData = useMemo(() => {
    if (!predictionResult || !showDecomposition) return [];
    return historical.map((p, i) => ({
      month: formatMonth(p.month),
      trend: predictionResult.trend[i] ? Math.round(predictionResult.trend[i]) : null,
      seasonal: predictionResult.seasonal[i % predictionResult.seasonal.length]
        ? Math.round(predictionResult.seasonal[i % predictionResult.seasonal.length])
        : null,
      original: p.value,
    }));
  }, [predictionResult, historical, showDecomposition]);

  const selectedLabel = metricOptions.find((o) => o.value === selectedMetricId)?.label || '总质量成本';

  // Boundary month for reference line
  const boundaryMonth = historical.length > 0 ? formatMonth(historical[historical.length - 1].month) : '';

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card title="预测控制" size="small">
            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>预测指标</Text>
              <Select
                value={selectedMetricId}
                onChange={setSelectedMetricId}
                options={metricOptions}
                style={{ width: '100%' }}
                showSearch
                optionFilterProp="label"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>换电站筛选</Text>
              <Select
                value={selectedStation}
                onChange={setSelectedStation}
                style={{ width: '100%' }}
                options={[
                  { label: '全部换电站', value: '__all__' },
                  ...stations.map((s) => ({ label: s.name, value: s.id })),
                ]}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>预测月数: {stepsAhead} 个月</Text>
              <Slider min={1} max={6} value={stepsAhead} onChange={setStepsAhead} marks={{ 1: '1', 3: '3', 6: '6' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <Space>
                <Switch checked={showCI} onChange={setShowCI} size="small" />
                <Text style={{ fontSize: 12 }}>显示置信区间</Text>
              </Space>
            </div>

            <div>
              <Space>
                <Switch checked={showDecomposition} onChange={setShowDecomposition} size="small" />
                <Text style={{ fontSize: 12 }}>显示分解图</Text>
              </Space>
            </div>

            {predictionResult && (
              <Card type="inner" title="预测摘要" size="small" style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12 }}>
                  <div>历史数据: {historical.length} 个月</div>
                  <div>预测区间: {stepsAhead} 个月</div>
                  {predictionResult.predicted.length > 0 && (
                    <>
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">下月预测:</Text>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}>
                          {formatCurrency(predictionResult.predicted[0].value)}
                        </div>
                      </div>
                      {predictionResult.predicted.length > 1 && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary">末月预测:</Text>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>
                            {formatCurrency(predictionResult.predicted[predictionResult.predicted.length - 1].value)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            )}
          </Card>
        </Col>
        <Col span={18}>
          <Card
            title={
              <Space>
                <span>{selectedLabel} - 趋势预测</span>
                <Tag color="blue">季节性分解 + 移动平均</Tag>
              </Space>
            }
            size="small"
          >
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" style={{ fontSize: 11 }} />
                  <YAxis style={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  {boundaryMonth && (
                    <ReferenceLine x={boundaryMonth} stroke="#999" strokeDasharray="5 5" label={{ value: '预测起点', position: 'top', style: { fontSize: 11 } }} />
                  )}
                  {showCI && (
                    <Area
                      type="monotone"
                      dataKey="ciRange"
                      name="95%置信区间"
                      fill="#1890ff"
                      fillOpacity={0.1}
                      stroke="none"
                    />
                  )}
                  <Line type="monotone" dataKey="actual" name="历史数据" stroke="#1890ff" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  <Line type="monotone" dataKey="predicted" name="预测值" stroke="#f5222d" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3 }} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="数据不足，至少需要4个月的历史数据" style={{ padding: 80 }} />
            )}
          </Card>

          {showDecomposition && decompositionData.length > 0 && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Card title="趋势分量" size="small">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={decompositionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" style={{ fontSize: 10 }} />
                      <YAxis style={{ fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
                      <Tooltip />
                      <Line type="monotone" dataKey="trend" name="趋势" stroke="#52c41a" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="original" name="原始" stroke="#d9d9d9" strokeWidth={1} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="季节性分量" size="small">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={decompositionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" style={{ fontSize: 10 }} />
                      <YAxis style={{ fontSize: 10 }} />
                      <Tooltip />
                      <ReferenceLine y={0} stroke="#999" />
                      <Line type="monotone" dataKey="seasonal" name="季节性" stroke="#faad14" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default PredictionPage;
