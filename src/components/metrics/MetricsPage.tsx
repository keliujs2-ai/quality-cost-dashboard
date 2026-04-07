import React, { useState } from 'react';
import { Row, Col, Collapse, List, Tag, Card, InputNumber, Form, Switch, Typography, Empty, Alert, Space, message, Button, Modal, Input, Select, Popconfirm, Divider } from 'antd';
import { LockOutlined, CheckCircleOutlined, ExclamationCircleOutlined, SettingOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQualityCost } from '../../context/QualityCostContext';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../data/constants';
import type { MetricDefinition, SparePartSubItem, FormulaType, DataSourceConfig } from '../../data/types';
import { formatMetricStatus } from '../../utils/formatters';

const { Text, Paragraph } = Typography;

// Group metrics by category
function groupByCategory(metrics: MetricDefinition[]): Record<string, MetricDefinition[]> {
  const groups: Record<string, MetricDefinition[]> = {};
  for (const m of metrics) {
    (groups[m.category] ||= []).push(m);
  }
  return groups;
}

const MetricsPage: React.FC = () => {
  const { metricDefinitions, updateMetricDefinition, addMetricDefinition, deleteMetricDefinition, tableSchemas } = useQualityCost();
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBasicInfo, setEditingBasicInfo] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const grouped = groupByCategory(metricDefinitions);
  const selectedMetric = metricDefinitions.find((m) => m.id === selectedMetricId);

  const handleDelete = (id: string) => {
    deleteMetricDefinition(id);
    if (selectedMetricId === id) setSelectedMetricId(null);
    messageApi.success('指标已删除');
  };

  return (
    <div>
      {contextHolder}
      <Row gutter={16}>
        <Col span={8}>
          <Card
            title="指标列表"
            size="small"
            style={{ height: 'calc(100vh - 180px)', overflow: 'auto' }}
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setShowAddModal(true)}>
                新增
              </Button>
            }
          >
            <Collapse
              defaultActiveKey={Object.keys(grouped)}
              size="small"
              items={Object.entries(grouped).map(([cat, metrics]) => ({
                key: cat,
                label: (
                  <Space>
                    <Tag color={CATEGORY_COLORS[cat]}>{CATEGORY_LABELS[cat]}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{metrics.length} 个指标</Text>
                  </Space>
                ),
                children: (
                  <List
                    size="small"
                    dataSource={metrics}
                    renderItem={(m) => {
                      const status = formatMetricStatus(m.status);
                      return (
                        <List.Item
                          onClick={() => setSelectedMetricId(m.id)}
                          style={{
                            cursor: 'pointer',
                            background: selectedMetricId === m.id ? '#e6f7ff' : 'transparent',
                            padding: '8px 12px',
                            borderRadius: 4,
                            opacity: m.status === 'not_configured' ? 0.6 : 1,
                          }}
                          actions={[
                            <Popconfirm title="确认删除此指标？" onConfirm={(e) => { e?.stopPropagation(); handleDelete(m.id); }} key="del">
                              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                            </Popconfirm>,
                          ]}
                        >
                          <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 13 }}>
                                {m.status === 'not_configured' && <LockOutlined style={{ marginRight: 4 }} />}
                                {m.name_zh}
                              </Text>
                              <Tag color={status.color} style={{ fontSize: 11 }}>{status.text}</Tag>
                            </div>
                            {m.field_name && (
                              <Text type="secondary" style={{ fontSize: 11 }}>{m.field_name}</Text>
                            )}
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                ),
              }))}
            />
          </Card>
        </Col>
        <Col span={16}>
          {selectedMetric ? (
            <MetricConfigPanel
              metric={selectedMetric}
              onUpdate={updateMetricDefinition}
              tableSchemas={tableSchemas}
              onEditBasicInfo={() => setEditingBasicInfo(true)}
            />
          ) : (
            <Card style={{ height: 'calc(100vh - 180px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description="请从左侧选择一个指标进行配置" />
            </Card>
          )}
        </Col>
      </Row>

      {/* Add Metric Modal */}
      <AddMetricModal
        open={showAddModal}
        tableSchemas={tableSchemas}
        onClose={() => setShowAddModal(false)}
        onAdd={(metric) => {
          addMetricDefinition(metric);
          setSelectedMetricId(metric.id);
          setShowAddModal(false);
          messageApi.success('指标已创建');
        }}
      />

      {/* Edit Basic Info Modal */}
      {selectedMetric && (
        <EditBasicInfoModal
          open={editingBasicInfo}
          metric={selectedMetric}
          tableSchemas={tableSchemas}
          onClose={() => setEditingBasicInfo(false)}
          onSave={(updates) => {
            updateMetricDefinition(selectedMetric.id, updates);
            setEditingBasicInfo(false);
            messageApi.success('指标基本信息已更新');
          }}
        />
      )}
    </div>
  );
};

// === Metric Config Panel (right side) ===
function MetricConfigPanel({
  metric,
  onUpdate,
  tableSchemas,
  onEditBasicInfo,
}: {
  metric: MetricDefinition;
  onUpdate: (id: string, updates: Partial<MetricDefinition>) => void;
  tableSchemas?: { table_name: string; database: string }[];
  onEditBasicInfo: () => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  void tableSchemas; // available for future use

  if (metric.status === 'not_configured') {
    return (
      <Card
        title={metric.name_zh}
        size="small"
        extra={<Button size="small" icon={<EditOutlined />} onClick={onEditBasicInfo}>编辑基本信息</Button>}
      >
        {contextHolder}
        <Alert
          message="数据源未配置"
          description={
            <div>
              <p>{metric.description || '该指标的数据源尚未接入，暂时无法配置计算参数。'}</p>
              <p>请联系数据团队完成数据源接入后再配置此指标。</p>
            </div>
          }
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
        <Card type="inner" title="预期配置" size="small">
          <Paragraph type="secondary">
            <ul>
              <li>数据源: 待确认</li>
              <li>计算公式: {metric.formula.description || '待定'}</li>
              <li>状态: 待开发</li>
            </ul>
          </Paragraph>
        </Card>
      </Card>
    );
  }

  const formula = metric.formula;

  const handleSave = (field: string, value: unknown) => {
    const newFormula = { ...formula, [field]: value };
    onUpdate(metric.id, { formula: newFormula });
    messageApi.success('参数已更新');
  };

  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          {metric.name_zh}
          <Tag color="green">已接入</Tag>
        </Space>
      }
      size="small"
      style={{ height: 'calc(100vh - 180px)', overflow: 'auto' }}
      extra={<Button size="small" icon={<EditOutlined />} onClick={onEditBasicInfo}>编辑基本信息</Button>}
    >
      {contextHolder}
      {/* Data source info */}
      {metric.data_source && (
        <Card type="inner" title="数据源" size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>数据库</Text>
              <div><Text code>{metric.data_source.database}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>表名</Text>
              <div><Text code style={{ fontSize: 12 }}>{metric.data_source.table_name}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>连接状态</Text>
              <div><Tag icon={<CheckCircleOutlined />} color="success">已连接</Tag></div>
            </div>
          </div>
          {metric.data_source.filter_conditions && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>过滤条件</Text>
              <div><Text code style={{ fontSize: 11 }}>{metric.data_source.filter_conditions}</Text></div>
            </div>
          )}
        </Card>
      )}

      {/* Formula configuration */}
      <Card type="inner" title="计算公式配置" size="small" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {formula.description}
        </Paragraph>

        {/* count_times_unit with unit_cost */}
        {formula.type === 'count_times_unit' && formula.unit_cost != null && (
          <Form layout="vertical" size="small">
            <Form.Item label="单个工单成本 (RMB/单)">
              <InputNumber
                value={formula.unit_cost}
                min={0}
                step={1}
                style={{ width: 200 }}
                onChange={(v) => v != null && handleSave('unit_cost', v)}
                addonAfter={formula.unit_label || 'RMB/单'}
              />
            </Form.Item>
            <FormulaPreview formula={`工单数 x ${formula.unit_cost} = 成本`} />
          </Form>
        )}

        {/* count_times_unit with multipliers */}
        {formula.type === 'count_times_unit' && formula.multipliers && formula.multipliers.length > 0 && (
          <Form layout="vertical" size="small">
            {formula.multipliers.map((m, i) => (
              <Form.Item label={`乘数 ${i + 1}`} key={i}>
                <InputNumber
                  value={m}
                  min={0}
                  step={0.01}
                  style={{ width: 200 }}
                  onChange={(v) => {
                    if (v != null) {
                      const newMultipliers = [...formula.multipliers!];
                      newMultipliers[i] = v;
                      handleSave('multipliers', newMultipliers);
                    }
                  }}
                />
              </Form.Item>
            ))}
            <FormulaPreview
              formula={`事件数 x ${formula.multipliers.join(' x ')} = ${formula.multipliers.reduce((a, b) => a * b, 1).toFixed(2)} RMB/事件`}
            />
          </Form>
        )}

        {/* count_times_unit with standard_hours */}
        {formula.type === 'count_times_unit' && formula.standard_hours != null && (
          <Form layout="vertical" size="small">
            <Form.Item label="标准工时 (小时/单)">
              <InputNumber
                value={formula.standard_hours}
                min={0}
                step={0.1}
                style={{ width: 200 }}
                onChange={(v) => v != null && handleSave('standard_hours', v)}
                addonAfter="小时/单"
              />
            </Form.Item>
            <Form.Item label="工时单价 (RMB/h)">
              <InputNumber
                value={formula.hourly_rate}
                min={0}
                step={1}
                style={{ width: 200 }}
                onChange={(v) => v != null && handleSave('hourly_rate', v)}
                addonAfter="RMB/h"
              />
            </Form.Item>
            <FormulaPreview
              formula={`工单数 x ${formula.standard_hours}h x ${formula.hourly_rate} RMB/h = 成本`}
            />
          </Form>
        )}

        {/* count_times_unit with standard_minutes (inspection) */}
        {formula.type === 'count_times_unit' && formula.standard_minutes != null && (
          <Form layout="vertical" size="small">
            <Form.Item label="标准工时 (分钟/单)">
              <InputNumber
                value={formula.standard_minutes}
                min={0}
                step={0.5}
                style={{ width: 200 }}
                onChange={(v) => v != null && handleSave('standard_minutes', v)}
                addonAfter="分钟/单"
              />
            </Form.Item>
            <Form.Item label="工时单价 (RMB/h)">
              <InputNumber
                value={formula.hourly_rate}
                min={0}
                step={1}
                style={{ width: 200 }}
                onChange={(v) => v != null && handleSave('hourly_rate', v)}
                addonAfter="RMB/h"
              />
            </Form.Item>
            <FormulaPreview
              formula={`工单数 x ${formula.standard_minutes}min/60 x ${formula.hourly_rate} RMB/h = 成本`}
            />
          </Form>
        )}

        {/* hours_times_rate */}
        {formula.type === 'hours_times_rate' && (
          <Form layout="vertical" size="small">
            <Form.Item label="工时单价 (RMB/h)">
              <InputNumber
                value={formula.hourly_rate}
                min={0}
                step={1}
                style={{ width: 200 }}
                onChange={(v) => v != null && handleSave('hourly_rate', v)}
                addonAfter="RMB/h"
              />
            </Form.Item>
            <FormulaPreview formula={`工时数 x ${formula.hourly_rate} RMB/h = 成本`} />
          </Form>
        )}

        {/* checkbox_sum (spare parts) */}
        {formula.type === 'checkbox_sum' && formula.sub_items && (
          <SparePartsConfig
            subItems={formula.sub_items}
            onChange={(items) => handleSave('sub_items', items)}
          />
        )}

        {/* hardcoded */}
        {formula.type === 'hardcoded' && formula.hardcoded_rates && (
          <Form layout="vertical" size="small">
            {Object.entries(formula.hardcoded_rates).map(([model, rate]) => (
              <Form.Item label={`${model} 每日均摊值 (元/站/天)`} key={model}>
                <InputNumber
                  value={rate}
                  min={0}
                  step={0.01}
                  style={{ width: 200 }}
                  onChange={(v) => {
                    if (v != null) {
                      const newRates = { ...formula.hardcoded_rates!, [model]: v };
                      handleSave('hardcoded_rates', newRates);
                    }
                  }}
                  addonAfter="元/站/天"
                />
              </Form.Item>
            ))}
            <FormulaPreview formula="每日均摊值 x 30天 = 月度成本" />
          </Form>
        )}

        {/* subtraction */}
        {formula.type === 'subtraction' && (
          <Alert message="该指标直接从数据源汇总金额，无需额外参数配置" type="info" showIcon />
        )}

        {/* count_times_unit with no specific sub-type (generic new metrics) */}
        {formula.type === 'count_times_unit' && formula.unit_cost == null && !formula.multipliers?.length && formula.standard_hours == null && formula.standard_minutes == null && (
          <Form layout="vertical" size="small">
            <Alert message="该指标使用计数×单价公式，请设置单价参数" type="info" showIcon style={{ marginBottom: 12 }} />
            <Form.Item label="单价 (元/次)">
              <InputNumber
                value={0}
                min={0}
                step={1}
                style={{ width: 200 }}
                onChange={(v) => v != null && handleSave('unit_cost', v)}
                addonAfter="元/次"
              />
            </Form.Item>
          </Form>
        )}
      </Card>
    </Card>
  );
}

// Formula preview component
function FormulaPreview({ formula }: { formula: string }) {
  return (
    <div style={{ background: '#f6f8fa', padding: '8px 12px', borderRadius: 4, marginTop: 8, border: '1px solid #e8e8e8' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>计算公式: </Text>
      <Text code style={{ fontSize: 13 }}>{formula}</Text>
    </div>
  );
}

// Spare parts checkbox config
function SparePartsConfig({
  subItems,
  onChange,
}: {
  subItems: SparePartSubItem[];
  onChange: (items: SparePartSubItem[]) => void;
}) {
  const handleToggle = (key: string, enabled: boolean) => {
    onChange(subItems.map((item) => (item.key === key ? { ...item, enabled } : item)));
  };

  const handleCoefficient = (key: string, coefficient: number) => {
    onChange(subItems.map((item) => (item.key === key ? { ...item, coefficient } : item)));
  };

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
        选择纳入计算的备件子项，并设置系数（默认为1）:
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subItems.map((item) => (
          <div
            key={item.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '6px 12px',
              background: item.enabled ? '#f6ffed' : '#fafafa',
              borderRadius: 4,
              border: `1px solid ${item.enabled ? '#b7eb8f' : '#e8e8e8'}`,
            }}
          >
            <Switch size="small" checked={item.enabled} onChange={(v) => handleToggle(item.key, v)} />
            <Text style={{ flex: 1, opacity: item.enabled ? 1 : 0.5 }}>{item.label_zh}</Text>
            <InputNumber
              size="small"
              value={item.coefficient}
              min={0}
              max={10}
              step={0.1}
              style={{ width: 100 }}
              onChange={(v) => v != null && handleCoefficient(item.key, v)}
              disabled={!item.enabled}
              addonBefore="x"
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          已选 {subItems.filter((i) => i.enabled).length}/{subItems.length} 项
        </Text>
      </div>
    </div>
  );
}

// === Add Metric Modal ===
const FORMULA_TYPE_OPTIONS: { label: string; value: FormulaType }[] = [
  { label: '计数 × 单价', value: 'count_times_unit' },
  { label: '工时 × 时薪', value: 'hours_times_rate' },
  { label: '直接汇总', value: 'subtraction' },
  { label: '勾选求和', value: 'checkbox_sum' },
  { label: '硬编码均摊', value: 'hardcoded' },
];

function AddMetricModal({
  open,
  tableSchemas,
  onClose,
  onAdd,
}: {
  open: boolean;
  tableSchemas: { table_name: string; database: string }[];
  onClose: () => void;
  onAdd: (metric: MetricDefinition) => void;
}) {
  const [form] = Form.useForm();
  const formulaType = Form.useWatch('formula_type', form);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const hasDataSource = values.status === 'active';
      const dsTable = values.ds_table;
      const dsDb = values.ds_database;

      let dataSource: DataSourceConfig | null = null;
      if (hasDataSource && dsTable) {
        dataSource = {
          table_name: dsTable,
          database: dsDb || '',
          key_fields: values.ds_key_fields ? values.ds_key_fields.split(',').map((s: string) => s.trim()) : [],
          filter_conditions: values.ds_filter || undefined,
          connection_status: 'connected',
        };
      }

      const formulaConfig: Record<string, unknown> = {
        type: values.formula_type,
        description: values.formula_description || '',
      };

      // Set defaults based on formula type
      switch (values.formula_type) {
        case 'count_times_unit':
          if (values.param_mode === 'unit_cost') {
            formulaConfig.unit_cost = values.unit_cost || 0;
            formulaConfig.unit_label = 'RMB/单';
          } else if (values.param_mode === 'standard_hours') {
            formulaConfig.standard_hours = values.standard_hours || 1;
            formulaConfig.hourly_rate = values.hourly_rate || 113;
          } else if (values.param_mode === 'standard_minutes') {
            formulaConfig.standard_minutes = values.standard_minutes || 10;
            formulaConfig.hourly_rate = values.hourly_rate || 113;
          }
          break;
        case 'hours_times_rate':
          formulaConfig.hourly_rate = values.hourly_rate || 113;
          break;
        case 'hardcoded':
          formulaConfig.hardcoded_rates = { PS2: values.rate_ps2 || 0, PS3: values.rate_ps3 || 0, PS4: values.rate_ps4 || 0 };
          break;
        case 'checkbox_sum':
          formulaConfig.sub_items = [];
          break;
      }

      const metric: MetricDefinition = {
        id: `custom_${Date.now()}`,
        name_zh: values.name_zh,
        category: values.category,
        field_name: values.field_name || '',
        status: values.status,
        data_source: dataSource,
        formula: formulaConfig as unknown as MetricDefinition['formula'],
        description: values.description,
      };

      onAdd(metric);
      form.resetFields();
    } catch {
      // validation error
    }
  };

  return (
    <Modal
      title="新增质量成本指标"
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      okText="创建"
      cancelText="取消"
      width={640}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={{
          status: 'active',
          category: 'labor',
          formula_type: 'count_times_unit',
          param_mode: 'unit_cost',
          hourly_rate: 113,
        }}
      >
        <Divider plain>基本信息</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name_zh" label="指标名称" rules={[{ required: true, message: '请输入指标名称' }]}>
              <Input placeholder="例: XX成本" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="category" label="成本类型" rules={[{ required: true }]}>
              <Select options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k }))} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="status" label="状态">
              <Select options={[
                { label: '已接入 - 有数据源', value: 'active' },
                { label: '待开发 - 占位', value: 'not_configured' },
              ]} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="field_name" label="字段标识">
              <Input placeholder="英文字段名（可选）" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="说明">
          <Input.TextArea placeholder="指标说明（可选）" rows={2} />
        </Form.Item>

        <Divider plain>数据源配置</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="ds_database" label="数据库">
              <Select
                showSearch
                allowClear
                placeholder="选择数据库"
                options={[...new Set(tableSchemas.map((s) => s.database))].map((db) => ({ label: db, value: db }))}
              />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="ds_table" label="表名">
              <Select
                showSearch
                allowClear
                placeholder="选择数据表"
                options={tableSchemas.map((s) => ({ label: `${s.database}.${s.table_name}`, value: s.table_name }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="ds_key_fields" label="关键字段（逗号分隔）">
              <Input placeholder="field1, field2" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ds_filter" label="过滤条件">
              <Input placeholder="status = '已完成'" />
            </Form.Item>
          </Col>
        </Row>

        <Divider plain>计算公式</Divider>
        <Form.Item name="formula_type" label="公式类型" rules={[{ required: true }]}>
          <Select options={FORMULA_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="formula_description" label="公式描述">
          <Input placeholder="公式的文字描述" />
        </Form.Item>

        {/* Dynamic params based on formula type */}
        {formulaType === 'count_times_unit' && (
          <>
            <Form.Item name="param_mode" label="参数模式">
              <Select options={[
                { label: '计数 × 单价', value: 'unit_cost' },
                { label: '计数 × 标准工时(h) × 时薪', value: 'standard_hours' },
                { label: '计数 × 标准工时(min) × 时薪', value: 'standard_minutes' },
              ]} />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.param_mode !== cur.param_mode}>
              {({ getFieldValue }) => {
                const mode = getFieldValue('param_mode');
                if (mode === 'unit_cost') {
                  return (
                    <Form.Item name="unit_cost" label="单价 (元/单)">
                      <InputNumber min={0} step={1} style={{ width: 200 }} addonAfter="元/单" />
                    </Form.Item>
                  );
                }
                if (mode === 'standard_hours') {
                  return (
                    <Space direction="vertical">
                      <Form.Item name="standard_hours" label="标准工时 (小时/单)">
                        <InputNumber min={0} step={0.1} style={{ width: 200 }} addonAfter="小时/单" />
                      </Form.Item>
                      <Form.Item name="hourly_rate" label="时薪 (元/h)">
                        <InputNumber min={0} step={1} style={{ width: 200 }} addonAfter="元/h" />
                      </Form.Item>
                    </Space>
                  );
                }
                if (mode === 'standard_minutes') {
                  return (
                    <Space direction="vertical">
                      <Form.Item name="standard_minutes" label="标准工时 (分钟/单)">
                        <InputNumber min={0} step={0.5} style={{ width: 200 }} addonAfter="分钟/单" />
                      </Form.Item>
                      <Form.Item name="hourly_rate" label="时薪 (元/h)">
                        <InputNumber min={0} step={1} style={{ width: 200 }} addonAfter="元/h" />
                      </Form.Item>
                    </Space>
                  );
                }
                return null;
              }}
            </Form.Item>
          </>
        )}

        {formulaType === 'hours_times_rate' && (
          <Form.Item name="hourly_rate" label="时薪 (元/h)">
            <InputNumber min={0} step={1} style={{ width: 200 }} addonAfter="元/h" />
          </Form.Item>
        )}

        {formulaType === 'hardcoded' && (
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="rate_ps2" label="PS2 (元/站/天)">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="rate_ps3" label="PS3 (元/站/天)">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="rate_ps4" label="PS4 (元/站/天)">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Form>
    </Modal>
  );
}

// === Edit Basic Info Modal ===
function EditBasicInfoModal({
  open,
  metric,
  tableSchemas,
  onClose,
  onSave,
}: {
  open: boolean;
  metric: MetricDefinition;
  tableSchemas: { table_name: string; database: string }[];
  onClose: () => void;
  onSave: (updates: Partial<MetricDefinition>) => void;
}) {
  const [form] = Form.useForm();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const updates: Partial<MetricDefinition> = {
        name_zh: values.name_zh,
        category: values.category,
        field_name: values.field_name || '',
        status: values.status,
        description: values.description,
      };

      // Update data source if provided
      if (values.status === 'active' && values.ds_table) {
        updates.data_source = {
          table_name: values.ds_table,
          database: values.ds_database || '',
          key_fields: values.ds_key_fields ? values.ds_key_fields.split(',').map((s: string) => s.trim()) : metric.data_source?.key_fields || [],
          filter_conditions: values.ds_filter || metric.data_source?.filter_conditions,
          connection_status: 'connected',
        };
      } else if (values.status === 'not_configured') {
        updates.data_source = null;
      }

      onSave(updates);
      form.resetFields();
    } catch {
      // validation error
    }
  };

  return (
    <Modal
      title="编辑指标基本信息"
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={{
          name_zh: metric.name_zh,
          category: metric.category,
          status: metric.status,
          field_name: metric.field_name,
          description: metric.description,
          ds_database: metric.data_source?.database,
          ds_table: metric.data_source?.table_name,
          ds_key_fields: metric.data_source?.key_fields.join(', '),
          ds_filter: metric.data_source?.filter_conditions,
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name_zh" label="指标名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="category" label="成本类型" rules={[{ required: true }]}>
              <Select options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k }))} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="status" label="状态">
              <Select options={[
                { label: '已接入', value: 'active' },
                { label: '待开发', value: 'not_configured' },
              ]} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="field_name" label="字段标识">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="说明">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Divider plain>数据源</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="ds_database" label="数据库">
              <Select
                showSearch
                allowClear
                options={[...new Set(tableSchemas.map((s) => s.database))].map((db) => ({ label: db, value: db }))}
              />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="ds_table" label="表名">
              <Select
                showSearch
                allowClear
                options={tableSchemas.map((s) => ({ label: `${s.database}.${s.table_name}`, value: s.table_name }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="ds_key_fields" label="关键字段">
              <Input placeholder="逗号分隔" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ds_filter" label="过滤条件">
              <Input />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

export default MetricsPage;
