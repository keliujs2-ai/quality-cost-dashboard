import React, { useMemo, useState } from 'react';
import { Card, Button, List, Tag, Modal, Input, Checkbox, Popconfirm, Space, Typography, Empty, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQualityCost } from '../../context/QualityCostContext';
import { ALL_METRIC_DEFINITIONS, CATEGORY_LABELS, CATEGORY_COLORS } from '../../data/constants';
import type { DashboardView } from '../../data/types';

const { Text, Title } = Typography;

const DashboardConfigPage: React.FC = () => {
  const { dashboardViews, addDashboardView, updateDashboardView, deleteDashboardView } = useQualityCost();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingView, setEditingView] = useState<DashboardView | null>(null);
  const [formName, setFormName] = useState('');
  const [formMetrics, setFormMetrics] = useState<string[]>([]);

  // Group active metrics by category
  const grouped = useMemo(() => {
    const g: Record<string, typeof ALL_METRIC_DEFINITIONS> = {};
    for (const m of ALL_METRIC_DEFINITIONS) {
      if (m.status !== 'active') continue;
      (g[m.category] ||= []).push(m);
    }
    return g;
  }, []);

  // Map metric id to definition for display
  const metricMap = useMemo(() => {
    const map = new Map<string, (typeof ALL_METRIC_DEFINITIONS)[0]>();
    for (const m of ALL_METRIC_DEFINITIONS) {
      map.set(m.id, m);
    }
    return map;
  }, []);

  const openCreateModal = () => {
    setEditingView(null);
    setFormName('');
    setFormMetrics([]);
    setModalOpen(true);
  };

  const openEditModal = (view: DashboardView) => {
    setEditingView(view);
    setFormName(view.name);
    setFormMetrics([...view.metric_ids]);
    setModalOpen(true);
  };

  const handleOk = () => {
    if (!formName.trim()) {
      message.warning('请输入视图名称');
      return;
    }
    if (formMetrics.length === 0) {
      message.warning('请至少选择一个指标');
      return;
    }

    if (editingView) {
      updateDashboardView(editingView.id, {
        name: formName.trim(),
        metric_ids: formMetrics,
      });
      message.success('视图已更新');
    } else {
      const newView: DashboardView = {
        id: `view_${Date.now()}`,
        name: formName.trim(),
        metric_ids: formMetrics,
        dimensions: ['month', 'station'],
        chart_types: ['line', 'pie', 'bar'],
      };
      addDashboardView(newView);
      message.success('视图已创建');
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (dashboardViews.length <= 1) {
      message.warning('至少保留一个视图');
      return;
    }
    deleteDashboardView(id);
    message.success('视图已删除');
  };

  // Group a view's metrics by category for display
  const groupViewMetrics = (metricIds: string[]) => {
    const byCategory: Record<string, string[]> = {};
    for (const id of metricIds) {
      const m = metricMap.get(id);
      if (!m) continue;
      (byCategory[m.category] ||= []).push(m.name_zh);
    }
    return byCategory;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>看板视图管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          新增视图
        </Button>
      </div>

      {dashboardViews.length === 0 ? (
        <Card>
          <Empty description="暂无视图，请新增" />
        </Card>
      ) : (
        <List
          grid={{ gutter: 16, column: 1 }}
          dataSource={dashboardViews}
          renderItem={(view) => {
            const metricsByCategory = groupViewMetrics(view.metric_ids);
            return (
              <List.Item>
                <Card
                  size="small"
                  title={
                    <Space>
                      <Text strong>{view.name}</Text>
                      <Tag>{view.metric_ids.length} 个指标</Tag>
                      {view.chart_types.map((ct) => (
                        <Tag key={ct} color="blue">{ct}</Tag>
                      ))}
                    </Space>
                  }
                  extra={
                    <Space>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(view)}>
                        编辑
                      </Button>
                      <Popconfirm
                        title="确定删除此视图？"
                        onConfirm={() => handleDelete(view.id)}
                        disabled={dashboardViews.length <= 1}
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          disabled={dashboardViews.length <= 1}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  }
                >
                  {Object.entries(metricsByCategory).length === 0 ? (
                    <Text type="secondary">无指标</Text>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                      {Object.entries(metricsByCategory).map(([cat, names]) => (
                        <div key={cat} style={{ minWidth: 200 }}>
                          <Tag color={CATEGORY_COLORS[cat]} style={{ marginBottom: 4 }}>
                            {CATEGORY_LABELS[cat]}
                          </Tag>
                          <div style={{ paddingLeft: 4 }}>
                            {names.map((name) => (
                              <div key={name} style={{ fontSize: 12, color: '#666', lineHeight: '20px' }}>
                                {name}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </List.Item>
            );
          }}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        title={editingView ? '编辑看板视图' : '新增看板视图'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleOk}
        okText={editingView ? '保存' : '创建'}
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>视图名称</Text>
          <Input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="输入视图名称"
            style={{ marginTop: 4 }}
          />
        </div>

        <Text strong>选择指标</Text>
        <div style={{ marginTop: 8 }}>
          {Object.entries(grouped).map(([cat, metrics]) => {
            const catMetricIds = metrics.map((m) => m.id);
            const selectedInCat = formMetrics.filter((id) => catMetricIds.includes(id));
            const allChecked = selectedInCat.length === catMetricIds.length;
            const indeterminate = selectedInCat.length > 0 && selectedInCat.length < catMetricIds.length;

            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 4 }}>
                  <Checkbox
                    checked={allChecked}
                    indeterminate={indeterminate}
                    onChange={(e) => {
                      const otherIds = formMetrics.filter((id) => !catMetricIds.includes(id));
                      if (e.target.checked) {
                        setFormMetrics([...otherIds, ...catMetricIds]);
                      } else {
                        setFormMetrics(otherIds);
                      }
                    }}
                  >
                    <Tag color={CATEGORY_COLORS[cat]}>{CATEGORY_LABELS[cat]}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ({selectedInCat.length}/{catMetricIds.length})
                    </Text>
                  </Checkbox>
                </div>
                <div style={{ paddingLeft: 24 }}>
                  <Checkbox.Group
                    options={metrics.map((m) => ({ label: m.name_zh, value: m.id }))}
                    value={formMetrics.filter((id) => catMetricIds.includes(id))}
                    onChange={(vals) => {
                      const otherIds = formMetrics.filter((id) => !catMetricIds.includes(id));
                      setFormMetrics([...otherIds, ...(vals as string[])]);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
};

export default DashboardConfigPage;
