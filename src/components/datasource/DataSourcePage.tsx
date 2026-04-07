import React, { useState, useMemo } from 'react';
import { Row, Col, Tree, Card, Table, Tag, Badge, Typography, Empty, Alert, Descriptions, Input, Button, Modal, Form, Select, Space, Popconfirm, message } from 'antd';
import { DatabaseOutlined, TableOutlined, CheckCircleOutlined, ExclamationCircleOutlined, PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useQualityCost } from '../../context/QualityCostContext';
import type { TableSchema, ColumnSchema } from '../../data/types';

const { Text, Title } = Typography;
const { Search } = Input;

const DataSourcePage: React.FC = () => {
  const { metricDefinitions, tableSchemas, addTableSchema, updateTableSchema, deleteTableSchema } = useQualityCost();
  const [selectedTableKey, setSelectedTableKey] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTable, setEditingTable] = useState<TableSchema | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  // Build tree data from context
  const treeData = useMemo(() => {
    const groups = new Map<string, TableSchema[]>();
    for (const schema of tableSchemas) {
      const list = groups.get(schema.database) || [];
      list.push(schema);
      groups.set(schema.database, list);
    }
    return Array.from(groups.entries()).map(([db, tables]) => ({
      title: db,
      key: db,
      icon: <DatabaseOutlined />,
      children: tables.map((t) => ({
        title: t.table_name,
        key: `${t.database}.${t.table_name}`,
        icon: <TableOutlined />,
        isLeaf: true,
      })),
    }));
  }, [tableSchemas]);

  const selectedTable = useMemo(() => {
    if (!selectedTableKey) return null;
    return tableSchemas.find((s) => `${s.database}.${s.table_name}` === selectedTableKey) || null;
  }, [selectedTableKey, tableSchemas]);

  const handleSelect = (keys: React.Key[]) => {
    if (keys.length === 0) return;
    setSelectedTableKey(keys[0] as string);
  };

  // Find metrics using this table
  const linkedMetrics = selectedTable
    ? metricDefinitions.filter(
        (m) => m.data_source && m.data_source.table_name.includes(selectedTable.table_name),
      )
    : [];

  // Not configured metrics
  const notConfiguredMetrics = metricDefinitions.filter((m) => m.status === 'not_configured');

  const handleDeleteTable = (schema: TableSchema) => {
    deleteTableSchema(schema.database, schema.table_name);
    if (selectedTableKey === `${schema.database}.${schema.table_name}`) {
      setSelectedTableKey(null);
    }
    messageApi.success(`已删除数据源表 ${schema.table_name}`);
  };

  const fieldColumns = [
    { title: '字段名', dataIndex: 'name', key: 'name', render: (v: string) => <Text code>{v}</Text> },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '示例值', dataIndex: 'sample_value', key: 'sample_value', render: (v: string) => <Text type="secondary">{v}</Text> },
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
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditingTable(null); setShowAddModal(true); }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong>{selectedTable.database}.{selectedTable.table_name}</Text>
                  <Badge status="success" text="已连接" />
                </div>
              }
              size="small"
              extra={
                <Space>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => { setEditingTable(selectedTable); setShowAddModal(true); }}
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
              <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="数据库">{selectedTable.database}</Descriptions.Item>
                <Descriptions.Item label="表名">{selectedTable.table_name}</Descriptions.Item>
                <Descriptions.Item label="描述">{selectedTable.description}</Descriptions.Item>
                <Descriptions.Item label="字段数">{selectedTable.columns.length}</Descriptions.Item>
                <Descriptions.Item label="连接状态">
                  <Tag icon={<CheckCircleOutlined />} color="success">已连接</Tag>
                </Descriptions.Item>
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
            </Card>
          ) : (
            <Card style={{ height: 'calc(100vh - 180px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description="请从左侧选择一个数据源表查看详情" />
            </Card>
          )}
        </Col>
      </Row>

      <DataSourceModal
        open={showAddModal}
        editingTable={editingTable}
        existingDatabases={[...new Set(tableSchemas.map((s) => s.database))]}
        onClose={() => { setShowAddModal(false); setEditingTable(null); }}
        onSave={(schema, isEdit) => {
          if (isEdit && editingTable) {
            updateTableSchema(editingTable.database, editingTable.table_name, schema);
            setSelectedTableKey(`${schema.database || editingTable.database}.${schema.table_name || editingTable.table_name}`);
            messageApi.success('数据源表已更新');
          } else {
            addTableSchema(schema as TableSchema);
            setSelectedTableKey(`${schema.database}.${schema.table_name}`);
            messageApi.success('数据源表已创建');
          }
          setShowAddModal(false);
          setEditingTable(null);
        }}
      />
    </div>
  );
};

// === Add/Edit DataSource Modal ===
function DataSourceModal({
  open,
  editingTable,
  existingDatabases,
  onClose,
  onSave,
}: {
  open: boolean;
  editingTable: TableSchema | null;
  existingDatabases: string[];
  onClose: () => void;
  onSave: (schema: TableSchema | Partial<TableSchema>, isEdit: boolean) => void;
}) {
  const [form] = Form.useForm();
  const isEdit = !!editingTable;

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const columns: ColumnSchema[] = (values.columns || []).map((c: ColumnSchema) => ({
        name: c.name?.trim() || '',
        type: c.type || 'STRING',
        description: c.description?.trim() || '',
        sample_value: c.sample_value?.trim() || '',
      })).filter((c: ColumnSchema) => c.name);

      const schema: TableSchema = {
        database: values.database?.trim() || '',
        table_name: values.table_name?.trim() || '',
        description: values.description?.trim() || '',
        columns,
      };

      onSave(schema, isEdit);
      form.resetFields();
    } catch {
      // validation error
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑数据源表' : '新增数据源表'}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      okText={isEdit ? '保存' : '创建'}
      cancelText="取消"
      width={720}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        initialValues={editingTable ? {
          database: editingTable.database,
          table_name: editingTable.table_name,
          description: editingTable.description,
          columns: editingTable.columns,
        } : {
          database: '',
          table_name: '',
          description: '',
          columns: [{ name: '', type: 'STRING', description: '', sample_value: '' }],
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="database"
              label="数据库"
              rules={[{ required: true, message: '请输入数据库名' }]}
            >
              <Select
                showSearch
                allowClear
                placeholder="选择或输入数据库名"
                options={existingDatabases.map((db) => ({ label: db, value: db }))}
                // Allow custom input
                mode={undefined}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <div style={{ padding: '4px 8px', fontSize: 11, color: '#999' }}>
                      可直接输入新数据库名
                    </div>
                  </>
                )}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="table_name"
              label="表名"
              rules={[{ required: true, message: '请输入表名' }]}
            >
              <Input placeholder="例: ue_power_xxx_1d_f" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="描述">
          <Input.TextArea placeholder="表的用途描述" rows={2} />
        </Form.Item>

        <Title level={5} style={{ marginTop: 16 }}>字段定义</Title>
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
                      ]} />
                    </Form.Item>
                  </Col>
                  <Col span={7}>
                    <Form.Item {...restField} name={[name, 'description']} noStyle>
                      <Input placeholder="描述" size="small" />
                    </Form.Item>
                  </Col>
                  <Col span={5}>
                    <Form.Item {...restField} name={[name, 'sample_value']} noStyle>
                      <Input placeholder="示例值" size="small" />
                    </Form.Item>
                  </Col>
                  <Col span={2}>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#f5222d', cursor: 'pointer' }} />
                  </Col>
                </Row>
              ))}
              <Button type="dashed" onClick={() => add({ name: '', type: 'STRING', description: '', sample_value: '' })} block icon={<PlusOutlined />} size="small" style={{ marginTop: 8 }}>
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
