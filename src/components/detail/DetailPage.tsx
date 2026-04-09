import React, { useMemo, useState } from 'react';
import { Table, Select, DatePicker, Button, Tag, Space, Card, Row, Col, Statistic, InputNumber } from 'antd';
// icons available for future use
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useQualityCost } from '../../context/QualityCostContext';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../data/constants';
import { formatCurrency } from '../../utils/formatters';
import type { CostRecord, CostCategory, StationModel } from '../../data/types';

const { RangePicker } = DatePicker;

const MIS_PRESETS = [
  { label: '3个月', value: 3 },
  { label: '半年', value: 6 },
  { label: '1年', value: 12 },
  { label: '3年', value: 36 },
  { label: '5年', value: 60 },
];

const DetailPage: React.FC = () => {
  const { costRecords, stations } = useQualityCost();

  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<CostCategory[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<StationModel[]>([]);
  const [dateRange, setDateRange] = useState<[string, string]>(['2025-04', '2026-03']);
  const [misMin, setMisMin] = useState<number | null>(null);
  const [misMax, setMisMax] = useState<number | null>(null);

  const regions = useMemo(() => [...new Set(stations.map((s) => s.region))], [stations]);

  const filtered = useMemo(() => {
    return costRecords.filter((r) => {
      if (selectedStations.length > 0 && !selectedStations.includes(r.station_id)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(r.category)) return false;
      if (selectedRegions.length > 0 && !selectedRegions.includes(r.region)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(r.station_model)) return false;
      if (r.month < dateRange[0] || r.month > dateRange[1]) return false;
      if (misMin != null && r.mis < misMin) return false;
      if (misMax != null && r.mis > misMax) return false;
      return true;
    });
  }, [costRecords, selectedStations, selectedCategories, selectedRegions, selectedTypes, dateRange, misMin, misMax]);

  const totalCost = useMemo(() => filtered.reduce((sum, r) => sum + r.calculated_cost, 0), [filtered]);

  const columns: ColumnsType<CostRecord> = [
    {
      title: '换电站',
      dataIndex: 'station_name',
      key: 'station_name',
      width: 160,
      filters: stations.map((s) => ({ text: s.name, value: s.name })),
      onFilter: (value, record) => record.station_name === value,
    },
    {
      title: '型号',
      dataIndex: 'station_model',
      key: 'station_model',
      width: 70,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 100,
      sorter: (a, b) => a.month.localeCompare(b.month),
      defaultSortOrder: 'descend',
    },
    {
      title: '成本类型',
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (v: CostCategory) => (
        <Tag color={CATEGORY_COLORS[v]}>{CATEGORY_LABELS[v]}</Tag>
      ),
    },
    {
      title: '指标名称',
      dataIndex: 'metric_name',
      key: 'metric_name',
      width: 200,
    },
    {
      title: '原始值',
      dataIndex: 'raw_value',
      key: 'raw_value',
      width: 100,
      align: 'right',
      render: (v: number, record) => `${v} ${record.unit}`,
      sorter: (a, b) => a.raw_value - b.raw_value,
    },
    {
      title: '计算成本 (元)',
      dataIndex: 'calculated_cost',
      key: 'calculated_cost',
      width: 140,
      align: 'right',
      render: (v: number) => formatCurrency(v),
      sorter: (a, b) => a.calculated_cost - b.calculated_cost,
    },
    {
      title: 'MIS',
      dataIndex: 'mis',
      key: 'mis',
      width: 70,
      align: 'right',
      sorter: (a, b) => a.mis - b.mis,
      render: (v: number) => `${v}`,
    },
    {
      title: '区域公司',
      dataIndex: 'region',
      key: 'region',
      width: 100,
    },
  ];

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>换电站</div>
            <Select
              mode="multiple"
              placeholder="全部换电站"
              style={{ width: 240 }}
              options={stations.map((s) => ({ label: s.name, value: s.id }))}
              value={selectedStations}
              onChange={setSelectedStations}
              maxTagCount={2}
              allowClear
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>成本类型</div>
            <Select
              mode="multiple"
              placeholder="全部类型"
              style={{ width: 200 }}
              options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k }))}
              value={selectedCategories}
              onChange={setSelectedCategories}
              maxTagCount={2}
              allowClear
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>区域公司</div>
            <Select
              mode="multiple"
              placeholder="全部区域公司"
              style={{ width: 160 }}
              options={regions.map((r) => ({ label: r, value: r }))}
              value={selectedRegions}
              onChange={setSelectedRegions}
              allowClear
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>换电站类型</div>
            <Select
              mode="multiple"
              placeholder="全部型号"
              style={{ width: 160 }}
              options={[
                { label: 'PS2 (二代)', value: 'PS2' },
                { label: 'PS3 (三代)', value: 'PS3' },
                { label: 'PS4 (四代)', value: 'PS4' },
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
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0].format('YYYY-MM'), dates[1].format('YYYY-MM')]);
                }
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>MIS 范围</div>
            <Space size={4}>
              <InputNumber
                placeholder="最小"
                value={misMin}
                min={1}
                onChange={(v) => setMisMin(v)}
                style={{ width: 72 }}
                size="middle"
              />
              <span style={{ color: '#999' }}>-</span>
              <InputNumber
                placeholder="最大"
                value={misMax}
                min={1}
                onChange={(v) => setMisMax(v)}
                style={{ width: 72 }}
                size="middle"
              />
              {MIS_PRESETS.map((p) => (
                <Button
                  key={p.value}
                  size="small"
                  type={misMin === 1 && misMax === p.value ? 'primary' : 'default'}
                  onClick={() => { setMisMin(1); setMisMax(p.value); }}
                  style={{ fontSize: 12, padding: '0 6px' }}
                >
                  {p.label}
                </Button>
              ))}
            </Space>
          </div>
          <div style={{ marginTop: 18 }}>
            <Button
              onClick={() => {
                setSelectedStations([]);
                setSelectedCategories([]);
                setSelectedRegions([]);
                setSelectedTypes([]);
                setDateRange(['2025-04', '2026-03']);
                setMisMin(null);
                setMisMax(null);
              }}
            >
              重置
            </Button>
          </div>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="筛选后记录数" value={filtered.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="筛选后总成本" value={totalCost} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="涉及换电站数" value={new Set(filtered.map((r) => r.station_id)).size} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="涉及月份数" value={new Set(filtered.map((r) => r.month)).size} />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条记录` }}
        scroll={{ x: 1100 }}
      />
    </div>
  );
};

export default DetailPage;
