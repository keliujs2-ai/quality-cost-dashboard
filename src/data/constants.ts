import type { MetricDefinition, SparePartSubItem } from './types';

// ========== Business Parameters ==========
export const HOURLY_RATE = 113;
export const OFFLINE_INTERVENTION_UNIT_COST = 246;
export const ONLINE_INTERVENTION_MULTIPLIERS = [13, 0.56];
export const TECH_RENOVATION_2025_RATES: Record<string, number> = {
  PS2: 20.92,
  PS3: 26.92,
  PS4: 18.99,
};
export const BOLT_STANDARD_HOURS = 2.3;
export const REFLUX_BATTERY_STANDARD_HOURS = 1.8;
export const EXTERNAL_GEAR_STANDARD_HOURS = 1.8;

export const INSPECTION_MINUTES: Record<string, number> = {
  gen2_weekly: 6.5,
  gen2_monthly: 6.5,
  gen2_bimonthly: 55,
  gen2_semi_annual: 180,
  gen3_weekly: 10,
  gen3_monthly: 10,
  gen3_bimonthly: 26.5,
  gen3_semi_annual: 212,
  gen4_weekly: 9,
  gen4_monthly: 9,
  gen4_bimonthly: 39,
  gen4_semi_annual: 58.5,
};

export const DEFAULT_SPARE_PART_SUB_ITEMS: SparePartSubItem[] = [
  { key: 'spare_parts', label_zh: '备件', enabled: true, coefficient: 1 },
  { key: 'emergency_spare_parts', label_zh: '应急直发备件', enabled: true, coefficient: 1 },
  { key: 'so_parts', label_zh: 'SO物料', enabled: true, coefficient: 1 },
  { key: 'storage', label_zh: '仓储', enabled: true, coefficient: 1 },
  { key: 'logistics', label_zh: '物流', enabled: true, coefficient: 1 },
  { key: 'tools_materials', label_zh: '工具物资', enabled: true, coefficient: 1 },
  { key: 'vehicle', label_zh: '车辆', enabled: true, coefficient: 1 },
  { key: 'subcontract_maintain', label_zh: '委外维修', enabled: true, coefficient: 1 },
];

// ========== Warehouse Layers ==========
export const WAREHOUSE_LAYERS = ['ods', 'dwd', 'dwm', 'dws', 'dim'];

// ========== Color Palette ==========
export const CATEGORY_COLORS: Record<string, string> = {
  labor: '#1890ff',
  spare_parts: '#52c41a',
  tech_renovation: '#faad14',
  accident: '#f5222d',
  inspection: '#722ed1',
};

export const CATEGORY_LABELS: Record<string, string> = {
  labor: '人力成本',
  spare_parts: '备件成本',
  tech_renovation: '技改成本',
  accident: '事故费用',
  inspection: '额外点检费用',
};

// ========== Formula Type Labels ==========
export const FORMULA_TYPE_LABELS: Record<string, string> = {
  count_times_unit: '计数 × 单价',
  hours_times_rate: '工时 × 时薪',
  subtraction: '直接汇总',
  checkbox_sum: '多字段勾选求和',
  hardcoded: '维度映射均摊',
  regex_extract: '正则提取',
};

// ========== Metric Definitions ==========
export const ALL_METRIC_DEFINITIONS: MetricDefinition[] = [
  // === 人力成本 ===
  {
    id: 'labor_offline',
    name_zh: '线下介入人力（机动值守工单）',
    category: 'labor',
    field_name: 'on_site_intervention_work_order_count',
    status: 'active',
    data_source: {
      table_name: 'ue_power_auto_swap_mobile_duty_worksheet_info_1d_f',
      warehouse_layer: 'dwd',
      filter_conditions: "worksheet_status = '处理完成'",
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'update_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'count_times_unit',
      unit_cost: 246,
      unit_label: 'RMB/单',
      raw_value_name: '工单数',
      raw_value_unit: '单',
      description: '按站按月统计已完成工单数 × 246元/单',
    },
  },
  {
    id: 'labor_online',
    name_zh: '线上介入人力',
    category: 'labor',
    field_name: 'online_intervention_work_order_count',
    status: 'active',
    data_source: {
      table_name: 'ue_power_occ_event_worksheet_1d_f',
      warehouse_layer: 'dwm',
      filter_conditions: "role = 'LOCC' AND state_name IN ('处理完成','关闭','已处理','已关闭','已确认','已确诊','已完成','申请确认')",
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'update_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'count_times_unit',
      multipliers: [13, 0.56],
      unit_label: 'RMB/事件',
      raw_value_name: '事件数',
      raw_value_unit: '次',
      description: '按站按月统计LOCC角色的已完成事件数 × 13 × 0.56 = 7.28元/单',
    },
  },
  {
    id: 'labor_online_office',
    name_zh: '线上介入人力（办公室）',
    category: 'labor',
    field_name: '',
    status: 'not_configured',
    data_source: null,
    formula: { type: 'count_times_unit', description: '待定', raw_value_name: '事件数', raw_value_unit: '次' },
    description: '办公室线上介入人力成本，数据源待接入',
  },
  {
    id: 'labor_maintenance',
    name_zh: '备件维修工单人力',
    category: 'labor',
    field_name: 'post_battery_swap_material_manpower_hour',
    status: 'active',
    data_source: {
      table_name: 'workflow_new_oss_powerswap_maintenance_1d_a',
      warehouse_layer: 'ods_pe_es_sec2_prod',
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'hours_times_rate',
      hourly_rate: 113,
      unit_label: 'RMB/h',
      raw_value_name: '工时数',
      raw_value_unit: '小时',
      description: '按站按月汇总实际处理工时 × 113元/小时',
    },
  },
  // === 备件成本 ===
  {
    id: 'spare_parts_material',
    name_zh: '换电后市场物料',
    category: 'spare_parts',
    field_name: 'Post_swap_Market_Materials',
    status: 'active',
    data_source: {
      table_name: 'ue_power_swap_maintenance_cost_daily_summary_1d_f',
      warehouse_layer: 'dws',
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'dt', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'checkbox_sum',
      sub_items: [...DEFAULT_SPARE_PART_SUB_ITEMS],
      raw_value_name: '物料成本',
      raw_value_unit: '元',
      description: 'total_cost - sim_flow - other_cost - box_test - po_maintainance - subcontract_maintain_box_petty（仅保外备件）',
    },
  },
  // === 技改成本 ===
  {
    id: 'tech_renovation_labor_old',
    name_zh: '纯技改工单人力（老）',
    category: 'tech_renovation',
    field_name: 'technical_renovation_working_hours',
    status: 'active',
    data_source: {
      table_name: 'workflow_wcsprdwhlkmwpwog_1h_a',
      warehouse_layer: 'ods_pe_es_sec2_prod',
      filter_conditions: "status IN ('已完成', '审核中')",
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'hours_times_rate',
      hourly_rate: 113,
      unit_label: 'RMB/h',
      raw_value_name: '工时数',
      raw_value_unit: '小时',
      description: '从task_description正则提取标准工时(H/min)，按站按月汇总 × 113元/小时',
    },
  },
  {
    id: 'tech_renovation_labor_new',
    name_zh: '技改人力成本（base任务模块，新增）',
    category: 'tech_renovation',
    field_name: '',
    status: 'not_configured',
    data_source: null,
    formula: { type: 'hours_times_rate', description: '每个技改任务会带标准工时和实际工时，基于业务需求和人力价格折算', raw_value_name: '工时数', raw_value_unit: '小时' },
    description: '技改任务表待开发',
  },
  {
    id: 'tech_material_2026',
    name_zh: '技改物料（2026年起）',
    category: 'tech_renovation',
    field_name: 'technical_renovation_material_cost',
    status: 'active',
    data_source: {
      table_name: 'pp_lmp_worksheet_buffer_1d_i',
      warehouse_layer: 'dwm',
      filter_conditions: "device_type = 'powerswap'",
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'subtraction',
      raw_value_name: '物料费用',
      raw_value_unit: '元',
      description: '按站按月汇总cost_estimation',
    },
  },
  {
    id: 'tech_material_2025',
    name_zh: '技改物料（2025年）',
    category: 'tech_renovation',
    field_name: '2025年的技改物料',
    status: 'active',
    data_source: {
      table_name: '硬编码均摊值',
      warehouse_layer: '-',
      dimension_mapping: { station_field: '', time_field: '', station_model_field: 'station_model', region_field: '' },
    },
    formula: {
      type: 'hardcoded',
      hardcoded_rates: { PS2: 20.92, PS3: 26.92, PS4: 18.99 },
      raw_value_name: '站点',
      raw_value_unit: '站',
      description: 'PS2: 20.92元/站/天; PS3: 26.92元/站/天; PS4: 18.99元/站/天',
    },
  },
  {
    id: 'tech_bolt_manual',
    name_zh: '旧螺栓加垫片（手动触发）',
    category: 'tech_renovation',
    field_name: 'old_bolt_with_washer_manually_triggered_duration_hours',
    status: 'active',
    data_source: {
      table_name: 'workflow_qljssfnppdxqjspo_1d_a',
      warehouse_layer: 'ods_pe_es_sec2_prod',
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'count_times_unit',
      standard_hours: 2.3,
      hourly_rate: 113,
      unit_label: 'RMB',
      raw_value_name: '工单数',
      raw_value_unit: '单',
      description: '工单数 × 2.3小时/单 × 113元/小时',
    },
  },
  {
    id: 'tech_bolt_auto',
    name_zh: '旧螺栓加垫片（自动触发）',
    category: 'tech_renovation',
    field_name: 'old_bolt_with_washer_auto_duration_hours',
    status: 'active',
    data_source: {
      table_name: 'workflow_ecegbgqhxgzteasz_1d_a',
      warehouse_layer: 'ods_pe_es_sec2_prod',
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'count_times_unit',
      standard_hours: 2.3,
      hourly_rate: 113,
      unit_label: 'RMB',
      raw_value_name: '工单数',
      raw_value_unit: '单',
      description: '工单数 × 2.3小时/单 × 113元/小时',
    },
  },
  {
    id: 'tech_reflux_bolt',
    name_zh: '回流电池螺栓处置',
    category: 'tech_renovation',
    field_name: 'Reflux_Battery_Bolt_duration_hours',
    status: 'active',
    data_source: {
      table_name: 'workflow_battery_bolt_fault_handling_worksheet_1d_a',
      warehouse_layer: 'ods_pe_es_sec2_prod',
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'count_times_unit',
      standard_hours: 1.8,
      hourly_rate: 113,
      unit_label: 'RMB',
      raw_value_name: '工单数',
      raw_value_unit: '单',
      description: '工单数 × 1.8小时/单(标准0.5h+路途1.3h) × 113元/小时',
    },
  },
  {
    id: 'tech_battery_reflux_bolt',
    name_zh: '电池回流螺栓检查',
    category: 'tech_renovation',
    field_name: 'Battery_Reflux_Bolt_duration_hours',
    status: 'active',
    data_source: {
      table_name: 'workflow_ubqwfwidmehdoevx_1d_a',
      warehouse_layer: 'ods_pe_es_sec2_prod',
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'count_times_unit',
      standard_hours: 1.8,
      hourly_rate: 113,
      unit_label: 'RMB',
      raw_value_name: '工单数',
      raw_value_unit: '单',
      description: '工单数 × 1.8小时/单 × 113元/小时',
    },
  },
  {
    id: 'tech_external_gear',
    name_zh: '外齿圈检查',
    category: 'tech_renovation',
    field_name: 'External_Gear_Ring_duration_hours',
    status: 'active',
    data_source: {
      table_name: 'workflow_check_external_ring_1d_a',
      warehouse_layer: 'ods_pe_es_sec2_prod',
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'count_times_unit',
      standard_hours: 1.8,
      hourly_rate: 113,
      unit_label: 'RMB',
      raw_value_name: '工单数',
      raw_value_unit: '单',
      description: '工单数 × 1.8小时/单 × 113元/小时',
    },
  },
  // === 事故费用 ===
  {
    id: 'accident_swap',
    name_zh: '换电事故',
    category: 'accident',
    field_name: 'accident_costs',
    status: 'active',
    data_source: {
      table_name: 'workflow_hyiuozqrcknbwwfz_1d_a',
      warehouse_layer: 'ods_pe_es_sec2_prod',
      filter_conditions: "accident_resp = '1'",
      dimension_mapping: { station_field: 'swap_station_id', time_field: 'accident_time', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'subtraction',
      raw_value_name: '事故费用',
      raw_value_unit: '元',
      description: "筛选accident_resp='1'（我方责任），汇总fee_repair_swap + fee_repair_user",
    },
  },
  {
    id: 'accident_battery_damage',
    name_zh: '电池损伤',
    category: 'accident',
    field_name: 'battery_damage_cost',
    status: 'active',
    data_source: {
      table_name: 'ue_power_feishu_data_swap_station_battery_damage_list_1d_f',
      warehouse_layer: 'ods',
      dimension_mapping: { station_field: 'station_name', time_field: 'damage_date', station_model_field: '', region_field: '' },
    },
    formula: {
      type: 'subtraction',
      raw_value_name: '损伤费用',
      raw_value_unit: '元',
      description: '按站名按月汇总 repair_cost + forklift_logistics_cost + labor_cost',
    },
  },
  {
    id: 'accident_battery_order_new',
    name_zh: '电池损伤工单（新增）',
    category: 'accident',
    field_name: '',
    status: 'not_configured',
    data_source: null,
    formula: { type: 'subtraction', description: '待开发', raw_value_name: '损伤费用', raw_value_unit: '元' },
    description: '电池损伤工单，数据源待开发',
  },
  // === 额外点检费用 ===
  {
    id: 'inspection_labor_new',
    name_zh: '点检人力成本（base任务模块，新增）',
    category: 'inspection',
    field_name: '',
    status: 'not_configured',
    data_source: null,
    formula: { type: 'hours_times_rate', description: '每个点检任务会带标准工时，基于业务需求和人力价格折算', raw_value_name: '工时数', raw_value_unit: '小时' },
    description: '点检任务表待接入',
  },
  // Inspection items - gen2
  {
    id: 'inspection_gen2_weekly', name_zh: '二代周检', category: 'inspection',
    field_name: 'gen2_swap_station_weekly_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_fxvhkowqucftdohg_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 6.5, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 6.5min/60 × 113元/小时' },
  },
  {
    id: 'inspection_gen2_monthly', name_zh: '二代月检', category: 'inspection',
    field_name: 'gen2_swap_station_monthly_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_sqbykuamldpwrjpm_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 6.5, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 6.5min/60 × 113元/小时' },
  },
  {
    id: 'inspection_gen2_bimonthly', name_zh: '二代双月检', category: 'inspection',
    field_name: 'gen2_swap_station_bimonthly_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_swap_check_two_generation_special_manintenance_new_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 55, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 55min/60 × 113元/小时' },
  },
  {
    id: 'inspection_gen2_semi_annual', name_zh: '二代半年检', category: 'inspection',
    field_name: 'gen2_swap_station_semi_annual_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_grviahrpanlgvyzonew_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 180, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 180min/60 × 113元/小时' },
  },
  // Inspection items - gen3
  {
    id: 'inspection_gen3_weekly', name_zh: '三代周检', category: 'inspection',
    field_name: 'gen3_swap_station_weekly_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_nsadfpkxdflnynex_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 10, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 10min/60 × 113元/小时' },
  },
  {
    id: 'inspection_gen3_monthly', name_zh: '三代月检', category: 'inspection',
    field_name: 'gen3_swap_station_monthly_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_piockciagtevqcxb_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 10, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 10min/60 × 113元/小时' },
  },
  {
    id: 'inspection_gen3_bimonthly', name_zh: '三代双月检', category: 'inspection',
    field_name: 'gen3_swap_station_bimonthly_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_ahzajwwdaecgdhka_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 26.5, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 26.5min/60 × 113元/小时' },
  },
  {
    id: 'inspection_gen3_semi_annual', name_zh: '三代半年检', category: 'inspection',
    field_name: 'gen3_swap_station_semi_annual_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_ncrejxzrtboizpodnew_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 212, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 212min/60 × 113元/小时' },
  },
  // Inspection items - gen4
  {
    id: 'inspection_gen4_weekly', name_zh: '四代周检', category: 'inspection',
    field_name: 'gen4_swap_station_weekly_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_oxtcuvqygcdmfjvh_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 9, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 9min/60 × 113元/小时' },
  },
  {
    id: 'inspection_gen4_monthly', name_zh: '四代月检', category: 'inspection',
    field_name: 'gen4_swap_station_monthly_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_akkdcuflnypvjalk_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 9, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 9min/60 × 113元/小时' },
  },
  {
    id: 'inspection_gen4_bimonthly', name_zh: '四代双月检', category: 'inspection',
    field_name: 'gen4_swap_station_bimonthly_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_odcucisufbyyyhfw_1h_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 39, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 39min/60 × 113元/小时' },
  },
  {
    id: 'inspection_gen4_semi_annual', name_zh: '四代半年检', category: 'inspection',
    field_name: 'gen4_swap_station_semi_annual_inspection_count', status: 'active',
    data_source: { table_name: 'workflow_rehazvvqwemaofea_1d_a', warehouse_layer: 'ods_pe_es_sec2_prod', dimension_mapping: { station_field: 'swap_station_id', time_field: 'create_time' } },
    formula: { type: 'count_times_unit', standard_minutes: 58.5, hourly_rate: 113, raw_value_name: '工单数', raw_value_unit: '单', description: '工单数 × 58.5min/60 × 113元/小时' },
  },
];
