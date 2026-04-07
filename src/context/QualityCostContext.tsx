import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import type { CostRecord, MetricDefinition, SwapStation, DashboardView, CostCategory, StationModel, TableSchema } from '../data/types';
import { ALL_METRIC_DEFINITIONS } from '../data/constants';
import { MOCK_STATIONS } from '../data/mock/stations';
import { MOCK_TABLE_SCHEMAS } from '../data/mock/tableSchemas';
import { generateAllMockData } from '../data/mock/mockDataGenerator';

export interface FilterState {
  stations: string[];
  dateRange: [string, string];
  categories: CostCategory[];
  regions: string[];
  stationTypes: StationModel[];
}

interface QualityCostContextType {
  stations: SwapStation[];
  metricDefinitions: MetricDefinition[];
  costRecords: CostRecord[];
  dashboardViews: DashboardView[];
  tableSchemas: TableSchema[];
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  // Metric CRUD
  addMetricDefinition: (metric: MetricDefinition) => void;
  updateMetricDefinition: (id: string, updates: Partial<MetricDefinition>) => void;
  deleteMetricDefinition: (id: string) => void;
  // Dashboard view CRUD
  addDashboardView: (view: DashboardView) => void;
  updateDashboardView: (id: string, updates: Partial<DashboardView>) => void;
  deleteDashboardView: (id: string) => void;
  // Table schema CRUD
  addTableSchema: (schema: TableSchema) => void;
  updateTableSchema: (database: string, tableName: string, updates: Partial<TableSchema>) => void;
  deleteTableSchema: (database: string, tableName: string) => void;
  filteredRecords: CostRecord[];
  // Version counter to force re-generation
  dataVersion: number;
}

const QualityCostContext = createContext<QualityCostContextType | null>(null);

const DEFAULT_VIEWS: DashboardView[] = [
  {
    id: 'default_all',
    name: '全口径质量成本',
    metric_ids: ALL_METRIC_DEFINITIONS.filter((m) => m.status === 'active').map((m) => m.id),
    dimensions: ['month', 'station'],
    chart_types: ['line', 'pie', 'bar'],
  },
  {
    id: 'labor_only',
    name: '人力成本专项',
    metric_ids: ALL_METRIC_DEFINITIONS.filter((m) => m.category === 'labor' && m.status === 'active').map((m) => m.id),
    dimensions: ['month', 'station'],
    chart_types: ['line', 'bar'],
  },
  {
    id: 'tech_renovation_only',
    name: '技改成本专项',
    metric_ids: ALL_METRIC_DEFINITIONS.filter((m) => m.category === 'tech_renovation' && m.status === 'active').map((m) => m.id),
    dimensions: ['month', 'station_type'],
    chart_types: ['line', 'stacked_bar'],
  },
];

function deepCloneMetrics(metrics: MetricDefinition[]): MetricDefinition[] {
  return metrics.map((m) => ({
    ...m,
    formula: {
      ...m.formula,
      sub_items: m.formula.sub_items?.map((s) => ({ ...s })),
      multipliers: m.formula.multipliers ? [...m.formula.multipliers] : undefined,
      hardcoded_rates: m.formula.hardcoded_rates ? { ...m.formula.hardcoded_rates } : undefined,
    },
    data_source: m.data_source ? { ...m.data_source, key_fields: [...m.data_source.key_fields] } : null,
  }));
}

export function QualityCostProvider({ children }: { children: React.ReactNode }) {
  const [metricDefinitions, setMetricDefinitions] = useState<MetricDefinition[]>(
    () => deepCloneMetrics(ALL_METRIC_DEFINITIONS),
  );
  const [dashboardViews, setDashboardViews] = useState<DashboardView[]>(DEFAULT_VIEWS);
  const [tableSchemas, setTableSchemas] = useState<TableSchema[]>(
    () => MOCK_TABLE_SCHEMAS.map((s) => ({ ...s, columns: s.columns.map((c) => ({ ...c })) })),
  );
  const [filters, setFilters] = useState<FilterState>({
    stations: [],
    dateRange: ['2025-04', '2026-03'],
    categories: [],
    regions: [],
    stationTypes: [],
  });
  // Version counter — bumped on metric changes to trigger costRecords regeneration
  const [dataVersion, setDataVersion] = useState(0);

  // Regenerate mock data whenever metrics or version change
  const costRecords = useMemo(
    () => generateAllMockData(metricDefinitions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metricDefinitions, dataVersion],
  );

  const filteredRecords = useMemo(() => {
    return costRecords.filter((r) => {
      if (filters.stations.length > 0 && !filters.stations.includes(r.station_id)) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(r.category)) return false;
      if (filters.regions.length > 0 && !filters.regions.includes(r.region)) return false;
      if (filters.stationTypes.length > 0 && !filters.stationTypes.includes(r.station_model)) return false;
      if (r.month < filters.dateRange[0] || r.month > filters.dateRange[1]) return false;
      return true;
    });
  }, [costRecords, filters]);

  // === Metric CRUD ===
  const addMetricDefinition = useCallback((metric: MetricDefinition) => {
    setMetricDefinitions((prev) => [...prev, metric]);
    setDataVersion((v) => v + 1);
  }, []);

  const updateMetricDefinition = useCallback((id: string, updates: Partial<MetricDefinition>) => {
    setMetricDefinitions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    );
    // Only bump version if status or formula changed (affects cost calculation)
    if (updates.status || updates.formula) {
      setDataVersion((v) => v + 1);
    }
  }, []);

  const deleteMetricDefinition = useCallback((id: string) => {
    setMetricDefinitions((prev) => prev.filter((m) => m.id !== id));
    // Also remove from dashboard views
    setDashboardViews((prev) =>
      prev.map((v) => ({ ...v, metric_ids: v.metric_ids.filter((mid) => mid !== id) })),
    );
    setDataVersion((v) => v + 1);
  }, []);

  // === Dashboard view CRUD ===
  const addDashboardView = useCallback((view: DashboardView) => {
    setDashboardViews((prev) => [...prev, view]);
  }, []);

  const updateDashboardView = useCallback((id: string, updates: Partial<DashboardView>) => {
    setDashboardViews((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    );
  }, []);

  const deleteDashboardView = useCallback((id: string) => {
    setDashboardViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  // === Table schema CRUD ===
  const addTableSchema = useCallback((schema: TableSchema) => {
    setTableSchemas((prev) => [...prev, schema]);
  }, []);

  const updateTableSchema = useCallback((database: string, tableName: string, updates: Partial<TableSchema>) => {
    setTableSchemas((prev) =>
      prev.map((s) =>
        s.database === database && s.table_name === tableName ? { ...s, ...updates } : s,
      ),
    );
  }, []);

  const deleteTableSchema = useCallback((database: string, tableName: string) => {
    setTableSchemas((prev) =>
      prev.filter((s) => !(s.database === database && s.table_name === tableName)),
    );
  }, []);

  const value = useMemo(
    () => ({
      stations: MOCK_STATIONS,
      metricDefinitions,
      costRecords,
      dashboardViews,
      tableSchemas,
      filters,
      setFilters,
      addMetricDefinition,
      updateMetricDefinition,
      deleteMetricDefinition,
      addDashboardView,
      updateDashboardView,
      deleteDashboardView,
      addTableSchema,
      updateTableSchema,
      deleteTableSchema,
      filteredRecords,
      dataVersion,
    }),
    [metricDefinitions, costRecords, dashboardViews, tableSchemas, filters, filteredRecords, dataVersion,
     addMetricDefinition, updateMetricDefinition, deleteMetricDefinition,
     addDashboardView, updateDashboardView, deleteDashboardView,
     addTableSchema, updateTableSchema, deleteTableSchema],
  );

  return <QualityCostContext.Provider value={value}>{children}</QualityCostContext.Provider>;
}

export function useQualityCost() {
  const ctx = useContext(QualityCostContext);
  if (!ctx) throw new Error('useQualityCost must be used within QualityCostProvider');
  return ctx;
}
