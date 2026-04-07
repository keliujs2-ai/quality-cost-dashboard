export type StationModel = 'PS2' | 'PS3' | 'PS4';

export interface SwapStation {
  id: string;
  name: string;
  model: StationModel;
  city_company: string;
  region: string;
  activation_date: string;
}

export type CostCategory = 'labor' | 'spare_parts' | 'tech_renovation' | 'accident' | 'inspection';

export type MetricStatus = 'active' | 'not_configured' | 'coming_soon';

export type FormulaType =
  | 'count_times_unit'
  | 'hours_times_rate'
  | 'subtraction'
  | 'checkbox_sum'
  | 'hardcoded'
  | 'regex_extract';

export interface SparePartSubItem {
  key: string;
  label_zh: string;
  enabled: boolean;
  coefficient: number;
}

export interface FormulaConfig {
  type: FormulaType;
  unit_cost?: number;
  unit_label?: string;
  hourly_rate?: number;
  standard_hours?: number;
  standard_minutes?: number;
  multipliers?: number[];
  sub_items?: SparePartSubItem[];
  hardcoded_rates?: Record<string, number>;
  description?: string;
}

export interface DataSourceConfig {
  table_name: string;
  database: string;
  key_fields: string[];
  filter_conditions?: string;
  connection_status: 'connected' | 'disconnected' | 'not_configured';
}

export interface MetricDefinition {
  id: string;
  name_zh: string;
  category: CostCategory;
  field_name: string;
  status: MetricStatus;
  data_source: DataSourceConfig | null;
  formula: FormulaConfig;
  description?: string;
}

export interface CostRecord {
  id: string;
  station_id: string;
  station_name: string;
  station_model: StationModel;
  region: string;
  city: string;
  month: string;
  category: CostCategory;
  metric_id: string;
  metric_name: string;
  raw_value: number;
  calculated_cost: number;
  unit: string;
}

export interface DashboardView {
  id: string;
  name: string;
  metric_ids: string[];
  dimensions: DashboardDimension[];
  chart_types: ChartType[];
}

export type DashboardDimension = 'station' | 'month' | 'quarter' | 'region' | 'city' | 'station_type';
export type ChartType = 'line' | 'pie' | 'bar' | 'stacked_bar';

export interface TimeSeriesPoint {
  month: string;
  value: number;
}

export interface PredictionResult {
  historical: TimeSeriesPoint[];
  predicted: TimeSeriesPoint[];
  upperBound: TimeSeriesPoint[];
  lowerBound: TimeSeriesPoint[];
  trend: number[];
  seasonal: number[];
}

export interface TableSchema {
  table_name: string;
  database: string;
  description: string;
  columns: ColumnSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  description: string;
  sample_value: string;
}

export interface FilterState {
  stations: string[];
  dateRange: [string, string];
  categories: CostCategory[];
  regions: string[];
  stationTypes: StationModel[];
}
