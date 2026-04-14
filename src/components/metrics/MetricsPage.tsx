import React, { useState, useRef, useCallback } from 'react';
import { Row, Col, Collapse, List, Tag, Card, InputNumber, Form, Switch, Typography, Empty, Alert, Space, message, Button, Modal, Input, Select, Popconfirm, Divider } from 'antd';
import { LockOutlined, ExclamationCircleOutlined, SettingOutlined, PlusOutlined, DeleteOutlined, EditOutlined, MinusCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useQualityCost } from '../../context/QualityCostContext';
import { CATEGORY_LABELS, CATEGORY_COLORS, FORMULA_TYPE_LABELS, WAREHOUSE_LAYERS } from '../../data/constants';
import type { MetricDefinition, SparePartSubItem, FormulaType, DataSourceConfig } from '../../data/types';
import { formatMetricStatus } from '../../utils/formatters';

const { Text, Paragraph } = Typography;

const FORMULA_TYPE_OPTIONS: { label: string; value: FormulaType }[] = (
  Object.entries(FORMULA_TYPE_LABELS) as [FormulaType, string][]
).map(([value, label]) => ({ label, value }));

function groupByCategory(metrics: MetricDefinition[]): Record<string, MetricDefinition[]> {
  const groups: Record<string, MetricDefinition[]> = {};
  for (const m of metrics) {
    (groups[m.category] ||= []).push(m);
  }
  return groups;
}

// ==================== Main Page ====================

const MetricsPage: React.FC = () => {
  const { metricDefinitions, updateMetricDefinition, addMetricDefinition, deleteMetricDefinition, tableSchemas, triggerRecalculate } = useQualityCost();
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
              onRecalculate={triggerRecalculate}
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

      {selectedMetric && (
        <EditBasicInfoModal
          key={selectedMetric.id}
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

// ==================== Formula Preview ====================

function FormulaPreview({ formula }: { formula: string }) {
  return (
    <div style={{ background: '#f6f8fa', padding: '8px 12px', borderRadius: 4, marginTop: 8, border: '1px solid #e8e8e8' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>计算公式: </Text>
      <Text code style={{ fontSize: 13 }}>{formula}</Text>
    </div>
  );
}

// ==================== Metric Config Panel (right side) ====================

function MetricConfigPanel({
  metric,
  onUpdate,
  onRecalculate,
  tableSchemas,
  onEditBasicInfo,
}: {
  metric: MetricDefinition;
  onUpdate: (id: string, updates: Partial<MetricDefinition>) => void;
  onRecalculate: () => void;
  tableSchemas: { table_name: string; warehouse_layer: string }[];
  onEditBasicInfo: () => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const [recalculating, setRecalculating] = useState(false);
  const recalcCooldownRef = useRef(false);
  void tableSchemas;

  const handleRecalculate = useCallback(() => {
    if (recalcCooldownRef.current || recalculating) {
      messageApi.warning('正在重算中，请稍后再试');
      return;
    }
    setRecalculating(true);
    recalcCooldownRef.current = true;
    messageApi.loading({ content: `正在重算「${metric.name_zh}」当月数据...`, key: 'recalc', duration: 0 });

    // Simulate recalculation delay (1.5-3s)
    setTimeout(() => {
      onRecalculate();
      setRecalculating(false);
      messageApi.success({ content: `「${metric.name_zh}」当月数据重算完成`, key: 'recalc', duration: 2 });
      // Cooldown: prevent re-trigger for 3 seconds after completion
      setTimeout(() => {
        recalcCooldownRef.current = false;
      }, 3000);
    }, 1500 + Math.random() * 1500);
  }, [metric.name_zh, onRecalculate, recalculating, messageApi]);

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
  const rawValueName = formula.raw_value_name || '数值';
  const rawValueUnit = formula.raw_value_unit || '';

  const handleSave = (field: string, value: unknown) => {
    const newFormula = { ...formula, [field]: value };
    onUpdate(metric.id, { formula: newFormula });
    messageApi.success('参数已更新');
  };

  const formulaTypeLabel = FORMULA_TYPE_LABELS[formula.type] || formula.type;

  // Sub-items management for checkbox_sum (detail panel: toggle + coefficient only)
  const handleToggleSubItem = (key: string, enabled: boolean) => {
    const currentItems = formula.sub_items || [];
    handleSave('sub_items', currentItems.map((item) => (item.key === key ? { ...item, enabled } : item)));
  };

  const handleSubItemCoefficient = (key: string, coefficient: number) => {
    const currentItems = formula.sub_items || [];
    handleSave('sub_items', currentItems.map((item) => (item.key === key ? { ...item, coefficient } : item)));
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
      extra={
        <Space>
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={handleRecalculate}
            loading={recalculating}
            disabled={recalculating}
          >
            {recalculating ? '重算中...' : '重算当月数据'}
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={onEditBasicInfo}>编辑基本信息</Button>
        </Space>
      }
    >
      {contextHolder}

      {/* Data source card */}
      {metric.data_source && (
        <Card type="inner" title="数据源" size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>数仓层级</Text>
              <div><Text code>{metric.data_source.warehouse_layer}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>表名</Text>
              <div><Text code style={{ fontSize: 12 }}>{metric.data_source.table_name}</Text></div>
            </div>
          </div>
          {metric.data_source.filter_conditions && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>过滤条件</Text>
              <div><Text code style={{ fontSize: 11 }}>{metric.data_source.filter_conditions}</Text></div>
            </div>
          )}
          {metric.data_source.dimension_mapping && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>维度映射</Text>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>站点字段: </Text>
                  <Text code style={{ fontSize: 11 }}>{metric.data_source.dimension_mapping.station_field || '-'}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>时间字段: </Text>
                  <Text code style={{ fontSize: 11 }}>{metric.data_source.dimension_mapping.time_field || '-'}</Text>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Formula configuration card */}
      <Card type="inner" title={`计算公式配置 - ${formulaTypeLabel}`} size="small" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {formula.description}
        </Paragraph>

        {/* count_times_unit */}
        {formula.type === 'count_times_unit' && (
          <Form layout="vertical" size="small">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="原始值名称 (raw_value_name)">
                  <Input
                    value={formula.raw_value_name || ''}
                    onChange={(e) => handleSave('raw_value_name', e.target.value)}
                    placeholder="例: 工单数、事件数"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="原始值单位 (raw_value_unit)">
                  <Input
                    value={formula.raw_value_unit || ''}
                    onChange={(e) => handleSave('raw_value_unit', e.target.value)}
                    placeholder="例: 单、次"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="单价 (unit_cost)">
              <InputNumber
                value={formula.unit_cost ?? 0}
                min={0}
                step={1}
                style={{ width: 240 }}
                onChange={(v) => v != null && handleSave('unit_cost', v)}
                addonAfter={`元/${rawValueUnit || '次'}`}
              />
            </Form.Item>
            <FormulaPreview formula={`${rawValueName} × ${formula.unit_cost ?? 0} = 成本（元/${rawValueUnit || '次'}）`} />
          </Form>
        )}

        {/* hours_times_rate */}
        {formula.type === 'hours_times_rate' && (
          <Form layout="vertical" size="small">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="原始值名称 (raw_value_name)">
                  <Input
                    value={formula.raw_value_name || ''}
                    onChange={(e) => handleSave('raw_value_name', e.target.value)}
                    placeholder="例: 工时数"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="原始值单位 (raw_value_unit)">
                  <Input
                    value={formula.raw_value_unit || ''}
                    onChange={(e) => handleSave('raw_value_unit', e.target.value)}
                    placeholder="例: 小时"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="工时字段名 (value_field)">
              <Input
                value={formula.value_field || ''}
                onChange={(e) => handleSave('value_field', e.target.value)}
                placeholder="数据源中的工时字段名"
              />
            </Form.Item>
            <Form.Item label="时薪 (hourly_rate)">
              <InputNumber
                value={formula.hourly_rate ?? 0}
                min={0}
                step={1}
                style={{ width: 240 }}
                onChange={(v) => v != null && handleSave('hourly_rate', v)}
                addonAfter={`元/${rawValueUnit || '小时'}`}
              />
            </Form.Item>
            <FormulaPreview formula={`SUM(${rawValueName}) × ${formula.hourly_rate ?? 0}（元/${rawValueUnit || '小时'}）`} />
          </Form>
        )}

        {/* subtraction */}
        {formula.type === 'subtraction' && (
          <Form layout="vertical" size="small">
            <Form.Item label="汇总字段 (value_field)">
              <Input
                value={formula.value_field || ''}
                onChange={(e) => handleSave('value_field', e.target.value)}
                placeholder="数据源中需要 SUM 的金额字段名"
              />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="原始值名称 (raw_value_name)">
                  <Input
                    value={formula.raw_value_name || ''}
                    onChange={(e) => handleSave('raw_value_name', e.target.value)}
                    placeholder="例: 费用"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="原始值单位 (raw_value_unit)">
                  <Input
                    value={formula.raw_value_unit || ''}
                    onChange={(e) => handleSave('raw_value_unit', e.target.value)}
                    placeholder="例: 元"
                  />
                </Form.Item>
              </Col>
            </Row>
            <FormulaPreview formula={`SUM(${formula.value_field || '?'}) → ${formula.raw_value_name || '金额'}（${formula.raw_value_unit || '元'}）`} />
          </Form>
        )}

        {/* checkbox_sum */}
        {formula.type === 'checkbox_sum' && (
          <Form layout="vertical" size="small">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="原始值名称 (raw_value_name)">
                  <Input
                    value={formula.raw_value_name || ''}
                    onChange={(e) => handleSave('raw_value_name', e.target.value)}
                    placeholder="例: 物料成本"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="原始值单位 (raw_value_unit)">
                  <Input
                    value={formula.raw_value_unit || ''}
                    onChange={(e) => handleSave('raw_value_unit', e.target.value)}
                    placeholder="例: 元"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
              选择纳入计算的子项，并设置系数（默认为1）。如需增删子项，请通过「编辑基本信息」操作。
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(formula.sub_items || []).map((item) => (
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
                  <Switch size="small" checked={item.enabled} onChange={(v) => handleToggleSubItem(item.key, v)} />
                  <Text style={{ flex: 1, opacity: item.enabled ? 1 : 0.5 }}>{item.label_zh}</Text>
                  <Text code style={{ fontSize: 11, opacity: item.enabled ? 1 : 0.5 }}>{item.key}</Text>
                  <InputNumber
                    size="small"
                    value={item.coefficient}
                    min={0}
                    max={10}
                    step={0.1}
                    style={{ width: 100 }}
                    onChange={(v) => v != null && handleSubItemCoefficient(item.key, v)}
                    disabled={!item.enabled}
                    addonBefore="x"
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                已选 {(formula.sub_items || []).filter((i) => i.enabled).length}/{(formula.sub_items || []).length} 项
              </Text>
            </div>
          </Form>
        )}

        {/* hardcoded */}
        {formula.type === 'hardcoded' && (
          <Form layout="vertical" size="small">
            {(['PS2', 'PS3', 'PS4'] as const).map((model) => (
              <Form.Item label={`${model} 每日均摊值`} key={model}>
                <InputNumber
                  value={formula.hardcoded_rates?.[model] ?? 0}
                  min={0}
                  step={0.01}
                  style={{ width: 240 }}
                  onChange={(v) => {
                    if (v != null) {
                      const newRates = { ...formula.hardcoded_rates, [model]: v };
                      handleSave('hardcoded_rates', newRates);
                    }
                  }}
                  addonAfter="元/站/天"
                />
              </Form.Item>
            ))}
            <FormulaPreview formula="每日均摊值 × 30天 = 月度成本（元/站/月）" />
          </Form>
        )}
      </Card>
    </Card>
  );
}

// ==================== Add Metric Modal ====================

function AddMetricModal({
  open,
  tableSchemas,
  onClose,
  onAdd,
}: {
  open: boolean;
  tableSchemas: { table_name: string; warehouse_layer: string }[];
  onClose: () => void;
  onAdd: (metric: MetricDefinition) => void;
}) {
  const [form] = Form.useForm();
  const formulaType = Form.useWatch('formula_type', form);
  const [messageApi, addModalContextHolder] = message.useMessage();
  const [modalSubItems, setModalSubItems] = useState<SparePartSubItem[]>([]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();

      let dataSource: DataSourceConfig | null = null;
      if (values.ds_table) {
        dataSource = {
          table_name: values.ds_table,
          warehouse_layer: values.ds_warehouse_layer || '',
          filter_conditions: values.ds_filter || undefined,
          dimension_mapping: {
            station_field: values.dim_station_field || '',
            time_field: values.dim_time_field || '',
          },
        };
      } else {
        messageApi.warning('未配置数据源，指标已创建但可能需要后续配置');
      }

      const formulaConfig: Record<string, unknown> = {
        type: values.formula_type,
        description: values.formula_description || '',
      };

      switch (values.formula_type as FormulaType) {
        case 'count_times_unit':
          formulaConfig.unit_cost = values.unit_cost || 0;
          formulaConfig.raw_value_name = values.raw_value_name || '';
          formulaConfig.raw_value_unit = values.raw_value_unit || '';
          break;
        case 'hours_times_rate':
          formulaConfig.hourly_rate = values.hourly_rate || 113;
          formulaConfig.value_field = values.value_field || '';
          formulaConfig.raw_value_name = values.raw_value_name || '';
          formulaConfig.raw_value_unit = values.raw_value_unit || '';
          break;
        case 'subtraction':
          formulaConfig.value_field = values.value_field || '';
          formulaConfig.raw_value_name = values.raw_value_name || '';
          formulaConfig.raw_value_unit = values.raw_value_unit || '';
          break;
        case 'checkbox_sum':
          formulaConfig.sub_items = modalSubItems;
          formulaConfig.raw_value_name = values.raw_value_name || '';
          formulaConfig.raw_value_unit = values.raw_value_unit || '';
          break;
        case 'hardcoded':
          formulaConfig.hardcoded_rates = {
            PS2: values.rate_ps2 || 0,
            PS3: values.rate_ps3 || 0,
            PS4: values.rate_ps4 || 0,
          };
          break;
      }

      const metric: MetricDefinition = {
        id: `custom_${Date.now()}`,
        name_zh: values.name_zh,
        category: values.category,
        field_name: values.field_name || '',
        status: 'active',
        data_source: dataSource,
        formula: formulaConfig as unknown as MetricDefinition['formula'],
        description: values.description,
      };

      onAdd(metric);
      form.resetFields();
      setModalSubItems([]);
    } catch {
      // validation error
    }
  };

  return (
    <Modal
      title="新增质量成本指标"
      open={open}
      onCancel={() => { form.resetFields(); setModalSubItems([]); onClose(); }}
      onOk={handleOk}
      okText="创建"
      cancelText="取消"
      width={640}
      destroyOnClose
    >
      {addModalContextHolder}
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={{
          category: 'labor',
          formula_type: 'count_times_unit',
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
            <Form.Item name="field_name" label="字段标识">
              <Input placeholder="英文字段名（可选）" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="description" label="说明">
              <Input placeholder="指标说明（可选）" />
            </Form.Item>
          </Col>
        </Row>

        <Divider plain>数据源配置</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="ds_warehouse_layer" label="数仓层级">
              <Select
                showSearch
                allowClear
                placeholder="选择数仓层级"
                options={[...new Set([...WAREHOUSE_LAYERS, ...tableSchemas.map((s) => s.warehouse_layer)])].map((wl) => ({ label: wl, value: wl }))}
              />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="ds_table" label="表名">
              <Select
                showSearch
                allowClear
                placeholder="选择数据表"
                options={tableSchemas.map((s) => ({ label: `${s.warehouse_layer}.${s.table_name}`, value: s.table_name }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="ds_filter" label="过滤条件">
          <Input placeholder="status = '已完成'" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="dim_station_field" label="站点字段">
              <Input placeholder="swap_station_id" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dim_time_field" label="时间字段">
              <Input placeholder="dt 或 create_time" />
            </Form.Item>
          </Col>
        </Row>

        <Divider plain>计算公式</Divider>
        <Form.Item name="formula_type" label="计算方式" rules={[{ required: true }]}>
          <Select options={FORMULA_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="formula_description" label="公式描述">
          <Input placeholder="公式的文字描述" />
        </Form.Item>

        {/* count_times_unit params */}
        {formulaType === 'count_times_unit' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="raw_value_name" label="原始值名称">
                  <Input placeholder="例: 工单数、事件数" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="raw_value_unit" label="原始值单位">
                  <Input placeholder="例: 单、次" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="unit_cost" label="单价 (元/次)">
              <InputNumber min={0} step={1} style={{ width: 200 }} addonAfter="元/次" />
            </Form.Item>
          </>
        )}

        {/* hours_times_rate params */}
        {formulaType === 'hours_times_rate' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="raw_value_name" label="原始值名称">
                  <Input placeholder="例: 工时数" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="raw_value_unit" label="原始值单位">
                  <Input placeholder="例: 小时" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="value_field" label="工时字段名">
              <Input placeholder="数据源中的工时字段名" />
            </Form.Item>
            <Form.Item name="hourly_rate" label="时薪 (元/小时)">
              <InputNumber min={0} step={1} style={{ width: 200 }} addonAfter="元/小时" />
            </Form.Item>
          </>
        )}

        {/* subtraction params */}
        {formulaType === 'subtraction' && (
          <>
            <Form.Item name="value_field" label="汇总字段">
              <Input placeholder="数据源中需要 SUM 的金额字段名" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="raw_value_name" label="原始值名称">
                  <Input placeholder="例: 费用" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="raw_value_unit" label="原始值单位">
                  <Input placeholder="例: 元" />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        {/* checkbox_sum params */}
        {formulaType === 'checkbox_sum' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="raw_value_name" label="原始值名称">
                  <Input placeholder="例: 物料成本" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="raw_value_unit" label="原始值单位">
                  <Input placeholder="例: 元" />
                </Form.Item>
              </Col>
            </Row>
            <SubItemsEditor subItems={modalSubItems} onChange={setModalSubItems} />
          </>
        )}

        {/* hardcoded params */}
        {formulaType === 'hardcoded' && (
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="rate_ps2" label="PS2 (元/站/天)">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="元/站/天" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="rate_ps3" label="PS3 (元/站/天)">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="元/站/天" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="rate_ps4" label="PS4 (元/站/天)">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="元/站/天" />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Form>
    </Modal>
  );
}

// ==================== Edit Basic Info Modal ====================

function EditBasicInfoModal({
  open,
  metric,
  tableSchemas,
  onClose,
  onSave,
}: {
  open: boolean;
  metric: MetricDefinition;
  tableSchemas: { table_name: string; warehouse_layer: string }[];
  onClose: () => void;
  onSave: (updates: Partial<MetricDefinition>) => void;
}) {
  const [form] = Form.useForm();
  const formulaType = Form.useWatch('formula_type', form);
  const [editSubItems, setEditSubItems] = useState<SparePartSubItem[]>(
    metric.formula.sub_items ? metric.formula.sub_items.map((i) => ({ ...i })) : [],
  );

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const updates: Partial<MetricDefinition> = {
        name_zh: values.name_zh,
        category: values.category,
        field_name: values.field_name || '',
        description: values.description,
      };

      if (values.ds_table) {
        updates.data_source = {
          table_name: values.ds_table,
          warehouse_layer: values.ds_warehouse_layer || '',
          filter_conditions: values.ds_filter || undefined,
          dimension_mapping: {
            station_field: values.dim_station_field || '',
            time_field: values.dim_time_field || '',
          },
        };
      }

      const formulaConfig: Record<string, unknown> = {
        type: values.formula_type,
        description: values.formula_description || metric.formula.description || '',
      };

      switch (values.formula_type as FormulaType) {
        case 'count_times_unit':
          formulaConfig.unit_cost = values.unit_cost ?? metric.formula.unit_cost ?? 0;
          formulaConfig.raw_value_name = values.raw_value_name || '';
          formulaConfig.raw_value_unit = values.raw_value_unit || '';
          break;
        case 'hours_times_rate':
          formulaConfig.hourly_rate = values.hourly_rate ?? metric.formula.hourly_rate ?? 113;
          formulaConfig.value_field = values.value_field ?? metric.formula.value_field ?? '';
          formulaConfig.raw_value_name = values.raw_value_name || '';
          formulaConfig.raw_value_unit = values.raw_value_unit || '';
          break;
        case 'subtraction':
          formulaConfig.value_field = values.value_field ?? metric.formula.value_field ?? '';
          formulaConfig.raw_value_name = values.raw_value_name || '';
          formulaConfig.raw_value_unit = values.raw_value_unit || '';
          break;
        case 'checkbox_sum':
          formulaConfig.sub_items = editSubItems;
          formulaConfig.raw_value_name = values.raw_value_name || '';
          formulaConfig.raw_value_unit = values.raw_value_unit || '';
          break;
        case 'hardcoded':
          formulaConfig.hardcoded_rates = {
            PS2: values.rate_ps2 ?? metric.formula.hardcoded_rates?.PS2 ?? 0,
            PS3: values.rate_ps3 ?? metric.formula.hardcoded_rates?.PS3 ?? 0,
            PS4: values.rate_ps4 ?? metric.formula.hardcoded_rates?.PS4 ?? 0,
          };
          break;
      }

      updates.formula = formulaConfig as unknown as MetricDefinition['formula'];

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
      width={640}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={{
          name_zh: metric.name_zh,
          category: metric.category,
          field_name: metric.field_name,
          description: metric.description,
          raw_value_name: metric.formula.raw_value_name || '',
          raw_value_unit: metric.formula.raw_value_unit || '',
          ds_warehouse_layer: metric.data_source?.warehouse_layer,
          ds_table: metric.data_source?.table_name,
          ds_filter: metric.data_source?.filter_conditions,
          dim_station_field: metric.data_source?.dimension_mapping?.station_field,
          dim_time_field: metric.data_source?.dimension_mapping?.time_field,
          formula_type: metric.formula.type,
          formula_description: metric.formula.description,
          unit_cost: metric.formula.unit_cost,
          hourly_rate: metric.formula.hourly_rate ?? 113,
          value_field: metric.formula.value_field || '',
          rate_ps2: metric.formula.hardcoded_rates?.PS2,
          rate_ps3: metric.formula.hardcoded_rates?.PS3,
          rate_ps4: metric.formula.hardcoded_rates?.PS4,
        }}
      >
        <Divider plain>基本信息</Divider>
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
            <Form.Item name="field_name" label="字段标识">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="description" label="说明">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider plain>数据源</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="ds_warehouse_layer" label="数仓层级">
              <Select
                showSearch
                allowClear
                options={[...new Set([...WAREHOUSE_LAYERS, ...tableSchemas.map((s) => s.warehouse_layer)])].map((wl) => ({ label: wl, value: wl }))}
              />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="ds_table" label="表名">
              <Select
                showSearch
                allowClear
                options={tableSchemas.map((s) => ({ label: `${s.warehouse_layer}.${s.table_name}`, value: s.table_name }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="ds_filter" label="过滤条件">
          <Input />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="dim_station_field" label="站点字段">
              <Input placeholder="swap_station_id" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dim_time_field" label="时间字段">
              <Input placeholder="dt 或 create_time" />
            </Form.Item>
          </Col>
        </Row>

        <Divider plain>计算公式</Divider>
        <Form.Item name="formula_type" label="计算方式" rules={[{ required: true }]}>
          <Select options={FORMULA_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="formula_description" label="公式描述">
          <Input placeholder="公式的文字描述" />
        </Form.Item>

        {/* count_times_unit */}
        {formulaType === 'count_times_unit' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="raw_value_name" label="原始值名称">
                  <Input placeholder="例: 工单数、事件数" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="raw_value_unit" label="原始值单位">
                  <Input placeholder="例: 单、次" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="unit_cost" label="单价 (元/次)">
              <InputNumber min={0} step={1} style={{ width: 200 }} addonAfter="元/次" />
            </Form.Item>
          </>
        )}

        {/* hours_times_rate */}
        {formulaType === 'hours_times_rate' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="raw_value_name" label="原始值名称">
                  <Input placeholder="例: 工时数" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="raw_value_unit" label="原始值单位">
                  <Input placeholder="例: 小时" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="value_field" label="工时字段名">
              <Input placeholder="数据源中的工时字段名" />
            </Form.Item>
            <Form.Item name="hourly_rate" label="时薪 (元/小时)">
              <InputNumber min={0} step={1} style={{ width: 200 }} addonAfter="元/小时" />
            </Form.Item>
          </>
        )}

        {/* subtraction */}
        {formulaType === 'subtraction' && (
          <>
            <Form.Item name="value_field" label="汇总字段">
              <Input placeholder="数据源中需要 SUM 的金额字段名" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="raw_value_name" label="原始值名称">
                  <Input placeholder="例: 费用" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="raw_value_unit" label="原始值单位">
                  <Input placeholder="例: 元" />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        {/* checkbox_sum */}
        {formulaType === 'checkbox_sum' && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="raw_value_name" label="原始值名称">
                  <Input placeholder="例: 物料成本" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="raw_value_unit" label="原始值单位">
                  <Input placeholder="例: 元" />
                </Form.Item>
              </Col>
            </Row>
            <SubItemsEditor subItems={editSubItems} onChange={setEditSubItems} />
          </>
        )}

        {/* hardcoded */}
        {formulaType === 'hardcoded' && (
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="rate_ps2" label="PS2 (元/站/天)">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="元/站/天" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="rate_ps3" label="PS3 (元/站/天)">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="元/站/天" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="rate_ps4" label="PS4 (元/站/天)">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="元/站/天" />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Form>
    </Modal>
  );
}

// ==================== Sub-Items Editor (for checkbox_sum in modals) ====================

function SubItemsEditor({
  subItems,
  onChange,
}: {
  subItems: SparePartSubItem[];
  onChange: (items: SparePartSubItem[]) => void;
}) {
  const handleAdd = () => {
    onChange([...subItems, { key: '', label_zh: '', enabled: true, coefficient: 1 }]);
  };

  const handleRemove = (index: number) => {
    onChange(subItems.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof SparePartSubItem, value: unknown) => {
    onChange(subItems.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
        配置求和子项（字段名对应数据源列名）:
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subItems.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              background: '#fafafa',
              borderRadius: 4,
              border: '1px solid #e8e8e8',
            }}
          >
            <Input
              size="small"
              value={item.label_zh}
              onChange={(e) => handleChange(index, 'label_zh', e.target.value)}
              placeholder="显示名称"
              style={{ width: 120 }}
            />
            <Input
              size="small"
              value={item.key}
              onChange={(e) => handleChange(index, 'key', e.target.value)}
              placeholder="字段名"
              style={{ width: 160 }}
            />
            <InputNumber
              size="small"
              value={item.coefficient}
              min={0}
              max={10}
              step={0.1}
              style={{ width: 90 }}
              onChange={(v) => v != null && handleChange(index, 'coefficient', v)}
              addonBefore="x"
            />
            <Button size="small" type="text" danger icon={<MinusCircleOutlined />} onClick={() => handleRemove(index)} />
          </div>
        ))}
      </div>
      <Button
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        style={{ marginTop: 8, width: '100%' }}
      >
        添加子项
      </Button>
    </div>
  );
}

export default MetricsPage;
