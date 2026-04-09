import React, { useState, useMemo } from 'react';
import { Row, Col, Tree, Card, Table, Tag, Typography, Empty, Alert, Descriptions, Input, Button, Modal, Form, Select, Space, Popconfirm, message, Spin, Result } from 'antd';
import { DatabaseOutlined, TableOutlined, ExclamationCircleOutlined, PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, LinkOutlined, SyncOutlined, SearchOutlined } from '@ant-design/icons';
import { useQualityCost } from '../../context/QualityCostContext';
import type { TableSchema, ColumnSchema } from '../../data/types';
import { MOCK_TABLE_SCHEMAS } from '../../data/mock/tableSchemas';

const { Text, Title } = Typography;
const { Search } = Input;

const DIMENSION_LABELS: Record<string, string> = {
  station_field: '站点',
  time_field: '时间',
};

// ========== Mock DW metadata fetch ==========
// Simulates querying data warehouse metadata API.
// In production, this would call Hive Metastore API or similar service.
interface DWFetchResult {
  status: 'success' | 'not_found' | 'no_permission';
  schema?: TableSchema;
  message?: string;
}

// Additional mock tables that exist in DW but haven't been registered yet
const EXTRA_DW_TABLES: TableSchema[] = [
  {
    table_name: 'ue_power_swap_battery_charge_cycle_1d_f',
    warehouse_layer: 'dwd',
    description: '换电站电池充放电循环明细表',
    columns: [
      { name: 'cycle_id', type: 'STRING', description: '', remark: '' },
      { name: 'swap_station_id', type: 'STRING', description: '', remark: '' },
      { name: 'battery_sn', type: 'STRING', description: '', remark: '' },
      { name: 'charge_start_time', type: 'TIMESTAMP', description: '', remark: '' },
      { name: 'charge_end_time', type: 'TIMESTAMP', description: '', remark: '' },
      { name: 'soc_start', type: 'DOUBLE', description: '', remark: '' },
      { name: 'soc_end', type: 'DOUBLE', description: '', remark: '' },
      { name: 'energy_kwh', type: 'DOUBLE', description: '', remark: '' },
      { name: 'dt', type: 'STRING', description: '', remark: '' },
    ],
  },
  {
    table_name: 'ue_power_swap_agv_fault_record_1d_f',
    warehouse_layer: 'dwm',
    description: 'AGV故障记录表',
    columns: [
      { name: 'fault_id', type: 'STRING', description: '', remark: '' },
      { name: 'swap_station_id', type: 'STRING', description: '', remark: '' },
      { name: 'agv_id', type: 'STRING', description: '', remark: '' },
      { name: 'fault_type', type: 'STRING', description: '', remark: '' },
      { name: 'fault_time', type: 'TIMESTAMP', description: '', remark: '' },
      { name: 'recovery_time', type: 'TIMESTAMP', description: '', remark: '' },
      { name: 'downtime_minutes', type: 'BIGINT', description: '', remark: '' },
      { name: 'dt', type: 'STRING', description: '', remark: '' },
    ],
  },
];

// Tables where user has no permission (for demo)
const NO_PERMISSION_TABLES = ['ods.ue_finance_cost_detail_1d_f', 'dws.ue_power_revenue_summary_1d_f'];

function simulateDWFetch(fullTableName: string): Promise<DWFetchResult> {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      const trimmed = fullTableName.trim();

      // Check no-permission tables
      if (NO_PERMISSION_TABLES.includes(trimmed)) {
        resolve({
          status: 'no_permission',
          message: `无权限访问表 "${trimmed}"，请联系数仓管理员申请权限`,
        });
        return;
      }

      // Parse layer.table_name
      const dotIndex = trimmed.indexOf('.');
      if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
        resolve({
          status: 'not_found',
          message: '请输入完整的表名，格式：数仓层级.表名（例如 dwm.ue_power_occ_seat_event_log_1d_f）',
        });
        return;
      }

      const layer = trimmed.substring(0, dotIndex);
      const tableName = trimmed.substring(dotIndex + 1);

      // Search in existing mock schemas
      const existing = MOCK_TABLE_SCHEMAS.find(
        (s) => s.warehouse_layer === layer && s.table_name === tableName,
      );
      if (existing) {
        // Return fresh copy from DW (fields have no user descriptions — simulate raw metadata)
        resolve({
          status: 'success',
          schema: {
            ...existing,
            columns: existing.columns.map((c) => ({
              name: c.name,
              type: c.type,
              description: '', // DW only returns name + type
              remark: '',
            })),
          },
        });
        return;
      }

      // Search in extra DW tables
      const extra = EXTRA_DW_TABLES.find(
        (s) => s.warehouse_layer === layer && s.table_name === tableName,
      );
      if (extra) {
        resolve({ status: 'success', schema: { ...extra } });
        return;
      }

      resolve({
        status: 'not_found',
        message: `表 "${trimmed}" 在数仓中不存在，请检查表名是否正确`,
      });
    }, 800 + Math.random() * 700); // 0.8-1.5s delay
  });
}

// Resync: merge new fields from DW into existing schema
function mergeFields(existingColumns: ColumnSchema[], dwColumns: ColumnSchema[]): { merged: ColumnSchema[]; newCount: number } {
  const existingNames = new Set(existingColumns.map((c) => c.name));
  const newFields = dwColumns.filter((c) => !existingNames.has(c.name));
  return {
    merged: [...existingColumns, ...newFields],
    newCount: newFields.length,
  };
}

// ========== Main Page ==========

const DataSourcePage: React.FC = () => {
  const { metricDefinitions, tableSchemas, addTableSchema, updateTableSchema, deleteTableSchema } = useQualityCost();
  const [selectedTableKey, setSelectedTableKey] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTable, setEditingTable] = useState<TableSchema | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  // Build tree data grouped by warehouse_layer
  const treeData = useMemo(() => {
    const groups = new Map<string, TableSchema[]>();
    for (const schema of tableSchemas) {
      const list = groups.get(schema.warehouse_layer) || [];
      list.push(schema);
      groups.set(schema.warehouse_layer, list);
    }

    const filtered = Array.from(groups.entries()).map(([layer, tables]) => {
      const filteredTables = searchText
        ? tables.filter((t) => t.table_name.toLowerCase().includes(searchText.toLowerCase()))
        : tables;
      return {
        title: layer,
        key: layer,
        icon: <DatabaseOutlined />,
        children: filteredTables.map((t) => ({
          title: t.table_name,
          key: `${t.warehouse_layer}.${t.table_name}`,
          icon: <TableOutlined />,
          isLeaf: true,
        })),
      };
    });

    return searchText ? filtered.filter((g) => g.children.length > 0) : filtered;
  }, [tableSchemas, searchText]);

  const selectedTable = useMemo(() => {
    if (!selectedTableKey) return null;
    return tableSchemas.find((s) => `${s.warehouse_layer}.${s.table_name}` === selectedTableKey) || null;
  }, [selectedTableKey, tableSchemas]);

  const handleSelect = (keys: React.Key[]) => {
    if (keys.length === 0) return;
    const key = keys[0] as string;
    if (key.includes('.')) {
      setSelectedTableKey(key);
    }
  };

  const linkedMetrics = useMemo(() => {
    if (!selectedTable) return [];
    return metricDefinitions.filter(
      (m) => m.data_source && m.data_source.table_name === selectedTable.table_name,
    );
  }, [selectedTable, metricDefinitions]);

  const dimensionMappingInfo = useMemo(() => {
    if (!selectedTable) return [];
    const result: { metricName: string; dimension: string; fieldName: string }[] = [];
    for (const m of linkedMetrics) {
      if (!m.data_source?.dimension_mapping) continue;
      const mapping = m.data_source.dimension_mapping;
      for (const [dimKey, label] of Object.entries(DIMENSION_LABELS)) {
        const fieldValue = (mapping as Record<string, string | undefined>)[dimKey];
        if (fieldValue) {
          result.push({ metricName: m.name_zh, dimension: label, fieldName: fieldValue });
        }
      }
    }
    return result;
  }, [selectedTable, linkedMetrics]);

  const notConfiguredMetrics = metricDefinitions.filter((m) => m.status === 'not_configured');

  const handleDeleteTable = (schema: TableSchema) => {
    deleteTableSchema(schema.warehouse_layer, schema.table_name);
    if (selectedTableKey === `${schema.warehouse_layer}.${schema.table_name}`) {
      setSelectedTableKey(null);
    }
    messageApi.success(`已删除数据源表 ${schema.table_name}`);
  };

  // Handle resync from detail view
  const handleResync = async () => {
    if (!selectedTable) return;
    const fullName = `${selectedTable.warehouse_layer}.${selectedTable.table_name}`;
    const result = await simulateDWFetch(fullName);
    if (result.status === 'success' && result.schema) {
      const { merged, newCount } = mergeFields(selectedTable.columns, result.schema.columns);
      if (newCount === 0) {
        messageApi.info('字段已是最新，无需同步');
      } else {
        updateTableSchema(selectedTable.warehouse_layer, selectedTable.table_name, { columns: merged });
        messageApi.success(`同步完成，新增 ${newCount} 个字段`);
      }
    } else {
      messageApi.error(result.message || '同步失败');
    }
  };

  const fieldColumns = [
    { title: '字段名', dataIndex: 'name', key: 'name', render: (v: string) => <Text code>{v}</Text> },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '业务描述', dataIndex: 'description', key: 'description' },
    { title: '备注', dataIndex: 'remark', key: 'remark', render: (v: string) => <Text type="secondary">{v || '-'}</Text> },
  ];

  const dimensionMappingColumns = [
    { title: '关联指标', dataIndex: 'metricName', key: 'metricName' },
    { title: '维度', dataIndex: 'dimension', key: 'dimension', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '映射字段', dataIndex: 'fieldName', key: 'fieldName', render: (v: string) => <Text code>{v}</Text> },
  ];

  return (
    <div>
      {contextHolder}
      <Row gutter={16}>
        <Col span={8}>
          <Card
            title="数据源表目录"
            size="small"
            style={{ height: 'calc(100vh - 180px)', overflow: 'auto' }}
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setShowAddModal(true)}>
                新增
              </Button>
            }
          >
            <Search
              placeholder="搜索表名..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ marginBottom: 12 }}
              allowClear
            />
            <Tree
              showIcon
              defaultExpandAll
              treeData={treeData}
              onSelect={handleSelect}
              selectedKeys={selectedTableKey ? [selectedTableKey] : []}
              filterTreeNode={(node) => {
                if (!searchText) return false;
                return (node.title as string)?.toLowerCase().includes(searchText.toLowerCase());
              }}
            />
            {notConfiguredMetrics.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>待接入数据源:</Text>
                {notConfiguredMetrics.map((m) => (
                  <Alert
                    key={m.id}
                    message={m.name_zh}
                    description={m.description || '数据源尚未配置'}
                    type="warning"
                    icon={<ExclamationCircleOutlined />}
                    showIcon
                    style={{ marginTop: 8, fontSize: 12 }}
                    banner
                  />
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col span={16}>
          {selectedTable ? (
            <Card
              title={
                <Text strong>{selectedTable.warehouse_layer}.{selectedTable.table_name}</Text>
              }
              size="small"
              style={{ height: 'calc(100vh - 180px)', overflow: 'auto' }}
              extra={
                <Space>
                  <Button
                    size="small"
                    icon={<SyncOutlined />}
                    onClick={handleResync}
                  >
                    重新同步
                  </Button>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => setEditingTable(selectedTable)}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定删除此数据源表？"
                    description={linkedMetrics.length > 0 ? `该表关联了 ${linkedMetrics.length} 个指标，删除后指标可能受影响` : undefined}
                    onConfirm={() => handleDeleteTable(selectedTable)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              }
            >
              <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="数仓层级">{selectedTable.warehouse_layer}</Descriptions.Item>
                <Descriptions.Item label="表名">{selectedTable.table_name}</Descriptions.Item>
                <Descriptions.Item label="业务描述" span={2}>{selectedTable.description}</Descriptions.Item>
                <Descriptions.Item label="字段数">{selectedTable.columns.length}</Descriptions.Item>
              </Descriptions>

              <Title level={5}>字段列表</Title>
              <Table
                dataSource={selectedTable.columns}
                columns={fieldColumns}
                rowKey="name"
                size="small"
                pagination={false}
              />

              {linkedMetrics.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Title level={5}>关联指标</Title>
                  {linkedMetrics.map((m) => (
                    <Tag key={m.id} color={m.status === 'active' ? 'blue' : 'orange'} style={{ marginBottom: 4 }}>
                      {m.name_zh}
                    </Tag>
                  ))}
                </div>
              )}

              {dimensionMappingInfo.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Title level={5}><LinkOutlined /> 维度映射</Title>
                  <Table
                    dataSource={dimensionMappingInfo}
                    columns={dimensionMappingColumns}
                    rowKey={(r) => `${r.metricName}-${r.dimension}`}
                    size="small"
                    pagination={false}
                  />
                </div>
              )}
            </Card>
          ) : (
            <Card style={{ height: 'calc(100vh - 180px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description="请从左侧选择一个数据源表查看详情" />
            </Card>
          )}
        </Col>
      </Row>

      {/* Add Modal — auto-sync from DW */}
      <AddDataSourceModal
        open={showAddModal}
        existingKeys={new Set(tableSchemas.map((s) => `${s.warehouse_layer}.${s.table_name}`))}
        onClose={() => setShowAddModal(false)}
        onConfirm={(schema) => {
          addTableSchema(schema);
          setSelectedTableKey(`${schema.warehouse_layer}.${schema.table_name}`);
          messageApi.success('数据源表已创建');
          setShowAddModal(false);
        }}
      />

      {/* Edit Modal — read-only layer/name, resync button */}
      <EditDataSourceModal
        open={!!editingTable}
        table={editingTable}
        onClose={() => setEditingTable(null)}
        onSave={(updates) => {
          if (editingTable) {
            updateTableSchema(editingTable.warehouse_layer, editingTable.table_name, updates);
            setSelectedTableKey(`${editingTable.warehouse_layer}.${editingTable.table_name}`);
            messageApi.success('数据源表已更新');
            setEditingTable(null);
          }
        }}
        onResync={async () => {
          if (!editingTable) return;
          const fullName = `${editingTable.warehouse_layer}.${editingTable.table_name}`;
          const result = await simulateDWFetch(fullName);
          if (result.status === 'success' && result.schema) {
            const { merged, newCount } = mergeFields(editingTable.columns, result.schema.columns);
            if (newCount === 0) {
              messageApi.info('字段已是最新，无需同步');
              return editingTable.columns;
            } else {
              messageApi.success(`同步完成，新增 ${newCount} 个字段`);
              return merged;
            }
          } else {
            messageApi.error(result.message || '同步失败');
            return editingTable.columns;
          }
        }}
      />
    </div>
  );
};

// ========== Add DataSource Modal ==========
// User inputs a full table name (e.g. dwm.table_name), system fetches metadata from DW,
// shows preview, user confirms to create.

type AddStep = 'input' | 'loading' | 'preview' | 'error';

function AddDataSourceModal({
  open,
  existingKeys,
  onClose,
  onConfirm,
}: {
  open: boolean;
  existingKeys: Set<string>;
  onClose: () => void;
  onConfirm: (schema: TableSchema) => void;
}) {
  const [step, setStep] = useState<AddStep>('input');
  const [tableName, setTableName] = useState('');
  const [fetchedSchema, setFetchedSchema] = useState<TableSchema | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorType, setErrorType] = useState<'not_found' | 'no_permission'>('not_found');

  const reset = () => {
    setStep('input');
    setTableName('');
    setFetchedSchema(null);
    setErrorMsg('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFetch = async () => {
    const trimmed = tableName.trim();
    if (!trimmed) return;

    // Check if already registered
    if (existingKeys.has(trimmed)) {
      setErrorMsg(`表 "${trimmed}" 已在系统中注册，请直接编辑已有数据源`);
      setErrorType('not_found');
      setStep('error');
      return;
    }

    setStep('loading');
    const result = await simulateDWFetch(trimmed);

    if (result.status === 'success' && result.schema) {
      setFetchedSchema(result.schema);
      setStep('preview');
    } else {
      setErrorMsg(result.message || '未知错误');
      setErrorType(result.status === 'no_permission' ? 'no_permission' : 'not_found');
      setStep('error');
    }
  };

  const handleConfirm = () => {
    if (fetchedSchema) {
      onConfirm(fetchedSchema);
      reset();
    }
  };

  const previewColumns = [
    { title: '字段名', dataIndex: 'name', key: 'name', render: (v: string) => <Text code>{v}</Text> },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
  ];

  return (
    <Modal
      title="新增数据源表"
      open={open}
      onCancel={handleClose}
      width={640}
      destroyOnClose
      footer={
        step === 'input' ? (
          <Space>
            <Button onClick={handleClose}>取消</Button>
            <Button type="primary" icon={<SearchOutlined />} disabled={!tableName.trim()} onClick={handleFetch}>
              查询数仓
            </Button>
          </Space>
        ) : step === 'loading' ? null : step === 'preview' ? (
          <Space>
            <Button onClick={() => setStep('input')}>返回修改</Button>
            <Button type="primary" onClick={handleConfirm}>确认创建</Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={() => setStep('input')}>返回修改</Button>
          </Space>
        )
      }
    >
      {step === 'input' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              输入数仓表的完整名称（格式：数仓层级.表名），系统将自动从数仓中读取表元数据。
            </Text>
          </div>
          <Input
            size="large"
            placeholder="例如：dwm.ue_power_occ_seat_event_log_1d_f"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            onPressEnter={handleFetch}
            prefix={<DatabaseOutlined style={{ color: '#bbb' }} />}
            allowClear
          />
          <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
            <div>支持的数仓层级：ods、dwd、dwm、dws、dim、ads 等</div>
            <div style={{ marginTop: 4 }}>示例：dwd.ue_power_swap_battery_charge_cycle_1d_f</div>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#666' }}>正在查询数仓元数据...</div>
        </div>
      )}

      {step === 'preview' && fetchedSchema && (
        <div>
          <Result
            status="success"
            title="表元数据获取成功"
            subTitle={`${fetchedSchema.warehouse_layer}.${fetchedSchema.table_name}`}
            style={{ padding: '12px 0' }}
          />
          <Descriptions bordered size="small" column={2} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="数仓层级">
              <Tag color="blue">{fetchedSchema.warehouse_layer.toUpperCase()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="字段数">{fetchedSchema.columns.length}</Descriptions.Item>
            <Descriptions.Item label="表名" span={2}>
              <Text code>{fetchedSchema.table_name}</Text>
            </Descriptions.Item>
            {fetchedSchema.description && (
              <Descriptions.Item label="描述" span={2}>{fetchedSchema.description}</Descriptions.Item>
            )}
          </Descriptions>
          <Title level={5}>字段列表</Title>
          <Table
            dataSource={fetchedSchema.columns}
            columns={previewColumns}
            rowKey="name"
            size="small"
            pagination={false}
            scroll={{ y: 240 }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            确认创建后，可通过「编辑」功能补充字段的业务描述和备注。
          </div>
        </div>
      )}

      {step === 'error' && (
        <Result
          status={errorType === 'no_permission' ? '403' : '404'}
          title={errorType === 'no_permission' ? '无访问权限' : '表不存在'}
          subTitle={errorMsg}
          style={{ padding: '24px 0' }}
        />
      )}
    </Modal>
  );
}

// ========== Edit DataSource Modal ==========
// warehouse_layer and table_name are read-only.
// Supports resync button to merge new fields from DW.

function EditDataSourceModal({
  open,
  table,
  onClose,
  onSave,
  onResync,
}: {
  open: boolean;
  table: TableSchema | null;
  onClose: () => void;
  onSave: (updates: Partial<TableSchema>) => void;
  onResync: () => Promise<ColumnSchema[] | undefined>;
}) {
  const [form] = Form.useForm();
  const [syncing, setSyncing] = useState(false);

  if (!table) return null;

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const columns: ColumnSchema[] = (values.columns || []).map((c: Record<string, string>) => ({
        name: c.name?.trim() || '',
        type: c.type || 'STRING',
        description: c.description?.trim() || '',
        remark: c.remark?.trim() || '',
      })).filter((c: ColumnSchema) => c.name);

      onSave({
        description: values.description?.trim() || '',
        columns,
      });
      form.resetFields();
    } catch {
      // validation error
    }
  };

  const handleResync = async () => {
    setSyncing(true);
    try {
      const merged = await onResync();
      if (merged) {
        form.setFieldsValue({ columns: merged });
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Modal
      title="编辑数据源表"
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      width={720}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={{
          description: table.description,
          columns: table.columns,
        }}
      >
        {/* Read-only layer and table name */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="数仓层级">
              <Input value={table.warehouse_layer.toUpperCase()} disabled />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item label="表名">
              <Input value={table.table_name} disabled />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="业务描述">
          <Input.TextArea placeholder="表的业务用途描述" rows={2} />
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
          <Title level={5} style={{ margin: 0 }}>字段定义</Title>
          <Button
            size="small"
            icon={<SyncOutlined spin={syncing} />}
            onClick={handleResync}
            loading={syncing}
          >
            重新同步
          </Button>
        </div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
          重新同步将从数仓获取最新字段列表，新增字段会追加到末尾，已有字段保留您填写的业务描述和备注。
        </div>

        <Row gutter={8} style={{ marginBottom: 4, paddingLeft: 4 }}>
          <Col span={6}><Text type="secondary" style={{ fontSize: 12 }}>字段名</Text></Col>
          <Col span={4}><Text type="secondary" style={{ fontSize: 12 }}>类型</Text></Col>
          <Col span={7}><Text type="secondary" style={{ fontSize: 12 }}>业务描述</Text></Col>
          <Col span={5}><Text type="secondary" style={{ fontSize: 12 }}>备注</Text></Col>
          <Col span={2} />
        </Row>
        <Form.List name="columns">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Row gutter={8} key={key} align="middle" style={{ marginBottom: 4 }}>
                  <Col span={6}>
                    <Form.Item {...restField} name={[name, 'name']} noStyle rules={[{ required: true, message: '字段名' }]}>
                      <Input placeholder="字段名" size="small" />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item {...restField} name={[name, 'type']} noStyle>
                      <Select size="small" options={[
                        { label: 'STRING', value: 'STRING' },
                        { label: 'BIGINT', value: 'BIGINT' },
                        { label: 'DOUBLE', value: 'DOUBLE' },
                        { label: 'TIMESTAMP', value: 'TIMESTAMP' },
                        { label: 'BOOLEAN', value: 'BOOLEAN' },
                        { label: 'DATE', value: 'DATE' },
                        { label: 'INT', value: 'INT' },
                        { label: 'DECIMAL', value: 'DECIMAL' },
                      ]} />
                    </Form.Item>
                  </Col>
                  <Col span={7}>
                    <Form.Item {...restField} name={[name, 'description']} noStyle>
                      <Input placeholder="业务描述" size="small" />
                    </Form.Item>
                  </Col>
                  <Col span={5}>
                    <Form.Item {...restField} name={[name, 'remark']} noStyle>
                      <Input placeholder="备注" size="small" />
                    </Form.Item>
                  </Col>
                  <Col span={2}>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#f5222d', cursor: 'pointer' }} />
                  </Col>
                </Row>
              ))}
              <Button type="dashed" onClick={() => add({ name: '', type: 'STRING', description: '', remark: '' })} block icon={<PlusOutlined />} size="small" style={{ marginTop: 8 }}>
                添加字段
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}

export default DataSourcePage;
