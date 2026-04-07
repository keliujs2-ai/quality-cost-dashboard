import type { CostRecord, MetricDefinition, SwapStation, StationModel } from '../types';
import { MOCK_STATIONS } from './stations';
import { ALL_METRIC_DEFINITIONS } from '../constants';

// ========== Seeded PRNG ==========
// Simple LCG (Linear Congruential Generator) for deterministic data
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

// Simple string hash for creating deterministic seeds
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

// ========== Station model multipliers ==========
// PS4 has more components and complexity, PS2 is simplest
const MODEL_SCALE: Record<StationModel, number> = {
  PS2: 0.8,
  PS3: 1.0,
  PS4: 1.25,
};

// Map station model to generation prefix for inspection matching
const MODEL_TO_GEN: Record<StationModel, string> = {
  PS2: 'gen2',
  PS3: 'gen3',
  PS4: 'gen4',
};

// ========== Seasonal patterns ==========
// Month index (0=Jan...11=Dec) -> seasonal factor
function getSeasonalFactor(month: string, category: string): number {
  const m = parseInt(month.split('-')[1], 10); // 1-12
  // Summer months (Jun-Aug): higher maintenance and labor
  // Winter months (Dec-Feb): higher inspections (preventive before cold)
  if (category === 'labor' || category === 'spare_parts') {
    // Summer peak for maintenance
    const summerFactors = [0.92, 0.90, 0.95, 1.0, 1.05, 1.15, 1.20, 1.18, 1.10, 1.02, 0.95, 0.88];
    return summerFactors[m - 1];
  }
  if (category === 'inspection') {
    // Winter peak for inspections
    const winterFactors = [1.15, 1.12, 1.05, 1.0, 0.95, 0.90, 0.88, 0.90, 0.95, 1.02, 1.08, 1.18];
    return winterFactors[m - 1];
  }
  if (category === 'tech_renovation') {
    // Slight spring/fall peaks for tech upgrades
    const techFactors = [0.90, 0.95, 1.10, 1.15, 1.10, 1.0, 0.95, 0.92, 1.05, 1.12, 1.08, 0.88];
    return techFactors[m - 1];
  }
  // accident - no strong seasonal pattern, slight summer increase
  const accidentFactors = [0.95, 0.90, 0.95, 1.0, 1.05, 1.10, 1.15, 1.12, 1.05, 1.0, 0.95, 0.90];
  return accidentFactors[m - 1];
}

// ========== Check if metric applies to station model ==========
function isMetricApplicable(metric: MetricDefinition, station: SwapStation): boolean {
  // Inspection metrics are generation-specific
  if (metric.id.startsWith('inspection_gen')) {
    const gen = MODEL_TO_GEN[station.model];
    return metric.id.startsWith(`inspection_${gen}`);
  }
  return true;
}

// ========== Generate raw value ==========
export function generateRawValue(
  station: SwapStation,
  metric: MetricDefinition,
  month: string,
  rng: () => number,
): number {
  // Skip not_configured metrics
  if (metric.status === 'not_configured') {
    return 0;
  }

  // Skip inspection metrics that don't match the station generation
  if (!isMetricApplicable(metric, station)) {
    return 0;
  }

  const scale = MODEL_SCALE[station.model];
  const seasonal = getSeasonalFactor(month, metric.category);

  // Check if station was active in this month
  const activationMonth = station.activation_date.substring(0, 7); // YYYY-MM
  if (month < activationMonth) {
    return 0;
  }

  // Random variation: base * (0.8 to 1.2)
  const variation = 0.8 + rng() * 0.4;

  let baseValue: number;

  switch (metric.id) {
    // === Labor ===
    case 'labor_offline':
      // Offline work orders: 5-30 per station per month
      baseValue = 8 + rng() * 18;
      return Math.round(baseValue * scale * seasonal * variation);

    case 'labor_online':
      // Online events: 20-80 per station per month
      baseValue = 30 + rng() * 40;
      return Math.round(baseValue * scale * seasonal * variation);

    case 'labor_maintenance':
      // Maintenance hours: 10-50 hours per month
      baseValue = 15 + rng() * 25;
      return Math.round((baseValue * scale * seasonal * variation) * 10) / 10;

    // === Spare Parts ===
    case 'spare_parts_material':
      // Spare parts cost: 5000-30000 per station per month
      baseValue = 8000 + rng() * 18000;
      return Math.round(baseValue * scale * seasonal * variation);

    // === Tech Renovation ===
    case 'tech_renovation_labor_old':
      // Tech renovation hours: 5-25 hours per month
      baseValue = 8 + rng() * 14;
      return Math.round((baseValue * scale * seasonal * variation) * 10) / 10;

    case 'tech_material_2026':
      // Tech material cost 2026: 500-5000 per month
      baseValue = 1000 + rng() * 3500;
      return Math.round(baseValue * scale * seasonal * variation);

    case 'tech_material_2025':
      // Hardcoded - raw value is just 1 (multiplied by daily rate * 30 in cost calc)
      return 1;

    case 'tech_bolt_manual':
      // Bolt manual trigger: 0-5 per month
      baseValue = 1 + rng() * 3;
      return Math.round(baseValue * scale * seasonal * variation);

    case 'tech_bolt_auto':
      // Bolt auto trigger: 0-8 per month
      baseValue = 2 + rng() * 5;
      return Math.round(baseValue * scale * seasonal * variation);

    case 'tech_reflux_bolt':
      // Reflux battery bolt: 0-4 per month
      baseValue = 0.5 + rng() * 2.5;
      return Math.round(baseValue * scale * seasonal * variation);

    case 'tech_battery_reflux_bolt':
      // Battery reflux bolt check: 0-4 per month
      baseValue = 0.5 + rng() * 2;
      return Math.round(baseValue * scale * seasonal * variation);

    case 'tech_external_gear':
      // External gear ring check: 0-3 per month
      baseValue = 0.5 + rng() * 2;
      return Math.round(baseValue * scale * seasonal * variation);

    // === Accident ===
    case 'accident_swap':
      // Sparse events: ~15% chance of an accident in any month
      if (rng() > 0.15) return 0;
      // When accident happens: 5000-50000
      baseValue = 5000 + rng() * 45000;
      return Math.round(baseValue * seasonal);

    case 'accident_battery_damage':
      // Sparse events: ~20% chance per month
      if (rng() > 0.20) return 0;
      // When damage happens: 3000-35000
      baseValue = 3000 + rng() * 32000;
      return Math.round(baseValue * seasonal);

    // === Inspection ===
    case 'inspection_gen2_weekly':
    case 'inspection_gen3_weekly':
    case 'inspection_gen4_weekly':
      // Weekly inspection: ~4 per month
      baseValue = 3.5 + rng() * 1.5;
      return Math.round(baseValue * seasonal * variation);

    case 'inspection_gen2_monthly':
    case 'inspection_gen3_monthly':
    case 'inspection_gen4_monthly':
      // Monthly inspection: ~1 per month
      baseValue = 0.8 + rng() * 0.4;
      return Math.round(baseValue * seasonal);

    case 'inspection_gen2_bimonthly':
    case 'inspection_gen3_bimonthly':
    case 'inspection_gen4_bimonthly':
      // Bimonthly inspection: ~0.5 per month average (1 every 2 months)
      if (rng() > 0.55) return 0;
      return 1;

    case 'inspection_gen2_semi_annual':
    case 'inspection_gen3_semi_annual':
    case 'inspection_gen4_semi_annual':
      // Semi-annual inspection: ~0.17 per month average (1 every 6 months)
      if (rng() > 0.18) return 0;
      return 1;

    default:
      return 0;
  }
}

// ========== Calculate cost from raw value ==========
export function calculateCost(
  metric: MetricDefinition,
  rawValue: number,
  station: SwapStation,
): number {
  if (rawValue === 0) return 0;

  const formula = metric.formula;

  switch (formula.type) {
    case 'count_times_unit':
      if (formula.unit_cost != null) {
        // rawValue * unit_cost
        return Math.round(rawValue * formula.unit_cost * 100) / 100;
      }
      return rawValue;

    case 'hours_times_rate':
      if (formula.hourly_rate != null) {
        return Math.round(rawValue * formula.hourly_rate * 100) / 100;
      }
      return rawValue;

    case 'subtraction':
      // rawValue is already a cost value
      return Math.round(rawValue * 100) / 100;

    case 'checkbox_sum':
      // rawValue is already an aggregated cost value
      return Math.round(rawValue * 100) / 100;

    case 'hardcoded':
      if (formula.hardcoded_rates) {
        const dailyRate = formula.hardcoded_rates[station.model] || 0;
        // Daily rate * 30 days per month
        return Math.round(dailyRate * 30 * 100) / 100;
      }
      return 0;

    default:
      return rawValue;
  }
}

// ========== Generate month strings ==========
function generateMonths(start: string, end: string): string[] {
  const months: string[] = [];
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

// ========== Get unit label for a metric ==========
function getUnitLabel(metric: MetricDefinition): string {
  switch (metric.formula.type) {
    case 'count_times_unit':
      return metric.formula.raw_value_unit ? `元/${metric.formula.raw_value_unit}` : '元/次';
    case 'hours_times_rate':
      return metric.formula.raw_value_unit ? `元/${metric.formula.raw_value_unit}` : '元/小时';
    case 'subtraction':
    case 'checkbox_sum':
      return '元';
    case 'hardcoded':
      return '元/站/天';
    default:
      return '次';
  }
}

// ========== Generate generic raw value for custom/unknown metrics ==========
function generateGenericRawValue(
  station: SwapStation,
  metric: MetricDefinition,
  month: string,
  rng: () => number,
): number {
  if (metric.status === 'not_configured') return 0;

  const scale = MODEL_SCALE[station.model];
  const seasonal = getSeasonalFactor(month, metric.category);
  const activationMonth = station.activation_date.substring(0, 7);
  if (month < activationMonth) return 0;

  const variation = 0.8 + rng() * 0.4;

  // Generate based on formula type
  switch (metric.formula.type) {
    case 'count_times_unit':
      // count * unit_cost: 5-30 per month
      return Math.round((5 + rng() * 25) * scale * seasonal * variation);

    case 'hours_times_rate':
      // 10-40 hours per month
      return Math.round((10 + rng() * 30) * scale * seasonal * variation * 10) / 10;

    case 'subtraction':
      // 2000-20000 per month
      return Math.round((2000 + rng() * 18000) * scale * seasonal * variation);

    case 'checkbox_sum':
      // 5000-30000 per month
      return Math.round((5000 + rng() * 25000) * scale * seasonal * variation);

    case 'hardcoded':
      return 1;

    default:
      return Math.round((5 + rng() * 20) * scale * seasonal * variation);
  }
}

// ========== Main generator ==========
export function generateAllMockData(customMetrics?: MetricDefinition[]): CostRecord[] {
  const metrics = customMetrics || ALL_METRIC_DEFINITIONS;
  const months = generateMonths('2025-04', '2026-03'); // 12 months
  const records: CostRecord[] = [];

  for (const station of MOCK_STATIONS) {
    for (const metric of metrics) {
      // Skip not_configured metrics
      if (metric.status === 'not_configured') continue;

      // Skip inspection metrics not applicable to this station model
      if (!isMetricApplicable(metric, station)) continue;

      for (const month of months) {
        // Deterministic seed based on station + metric + month
        const seed = hashString(`${station.id}|${metric.id}|${month}`);
        const rng = seededRandom(seed);

        // Try known metric first, fall back to generic
        let rawValue = generateRawValue(station, metric, month, rng);
        if (rawValue === 0) {
          rawValue = generateGenericRawValue(station, metric, month, rng);
        }
        if (rawValue === 0) continue;

        const cost = calculateCost(metric, rawValue, station);
        if (cost === 0) continue;

        const recordId = `${station.id}_${metric.id}_${month}`;

        records.push({
          id: recordId,
          station_id: station.id,
          station_name: station.name,
          station_model: station.model,
          region: station.region,
          city: station.city_company,
          month,
          category: metric.category,
          metric_id: metric.id,
          metric_name: metric.name_zh,
          raw_value: rawValue,
          calculated_cost: cost,
          unit: getUnitLabel(metric),
        });
      }
    }
  }

  return records;
}
