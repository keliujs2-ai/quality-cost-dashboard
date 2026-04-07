import type { TimeSeriesPoint, PredictionResult } from '../data/types';

/**
 * Time series decomposition and prediction using classical decomposition:
 * Y(t) = Trend(t) + Seasonal(t) + Residual(t)
 */

// Centered moving average for trend extraction
function movingAverage(series: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  const half = Math.floor(window / 2);
  for (let i = 0; i < series.length; i++) {
    if (i < half || i >= series.length - half) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - half; j <= i + half; j++) {
        sum += series[j];
      }
      result.push(sum / window);
    }
  }
  return result;
}

// Linear regression on non-null values, returns [slope, intercept]
function linearRegression(values: (number | null)[]): [number, number] {
  const points: [number, number][] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null) {
      points.push([i, values[i]!]);
    }
  }
  if (points.length < 2) return [0, values.find((v) => v != null) ?? 0];

  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const [x, y] of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return [0, sumY / n];
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return [slope, intercept];
}

// Extract seasonal component
function extractSeasonal(series: number[], trend: (number | null)[], period: number): number[] {
  const detrended: (number | null)[] = series.map((v, i) =>
    trend[i] != null ? v - trend[i]! : null,
  );

  // Average detrended values for each position in the cycle
  const seasonal = new Array(period).fill(0);
  const counts = new Array(period).fill(0);
  for (let i = 0; i < detrended.length; i++) {
    if (detrended[i] != null) {
      seasonal[i % period] += detrended[i]!;
      counts[i % period]++;
    }
  }
  for (let i = 0; i < period; i++) {
    seasonal[i] = counts[i] > 0 ? seasonal[i] / counts[i] : 0;
  }

  // Center the seasonal component (mean = 0)
  const mean = seasonal.reduce((a, b) => a + b, 0) / period;
  return seasonal.map((s) => s - mean);
}

// Decompose time series
function decompose(series: number[], period: number = 12) {
  // Use a smaller window if series is short
  const window = Math.min(period, Math.floor(series.length / 2) * 2 - 1);
  const effectiveWindow = window < 3 ? 3 : window % 2 === 0 ? window - 1 : window;

  const trend = movingAverage(series, effectiveWindow);
  const seasonal = extractSeasonal(series, trend, period);

  // Fill in trend nulls with linear regression extrapolation
  const [slope, intercept] = linearRegression(trend);
  const fullTrend = trend.map((v, i) => (v != null ? v : slope * i + intercept));

  const residual = series.map((v, i) => v - fullTrend[i] - seasonal[i % period]);

  return { trend: fullTrend, seasonal, residual };
}

// Standard deviation
function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Predict future values based on historical time series
 */
export function predict(
  historical: TimeSeriesPoint[],
  stepsAhead: number = 6,
  period: number = 12,
): PredictionResult {
  const values = historical.map((p) => p.value);
  const { trend, seasonal, residual } = decompose(values, period);

  // Extrapolate trend using linear regression
  const [slope, intercept] = linearRegression(trend);
  const residualStd = stddev(residual);

  const predicted: TimeSeriesPoint[] = [];
  const upperBound: TimeSeriesPoint[] = [];
  const lowerBound: TimeSeriesPoint[] = [];

  // Generate future months
  const lastMonth = historical[historical.length - 1].month;
  const [lastYear, lastMon] = lastMonth.split('-').map(Number);

  for (let step = 1; step <= stepsAhead; step++) {
    let futureYear = lastYear;
    let futureMonth = lastMon + step;
    while (futureMonth > 12) {
      futureMonth -= 12;
      futureYear++;
    }
    const monthStr = `${futureYear}-${String(futureMonth).padStart(2, '0')}`;

    const trendValue = slope * (values.length - 1 + step) + intercept;
    const seasonalValue = seasonal[(values.length - 1 + step) % period];
    const predictedValue = Math.max(0, trendValue + seasonalValue);

    // Confidence interval widens with each step
    const ci = 1.96 * residualStd * Math.sqrt(step);

    predicted.push({ month: monthStr, value: Math.round(predictedValue * 100) / 100 });
    upperBound.push({ month: monthStr, value: Math.round(Math.max(0, predictedValue + ci) * 100) / 100 });
    lowerBound.push({ month: monthStr, value: Math.round(Math.max(0, predictedValue - ci) * 100) / 100 });
  }

  return {
    historical,
    predicted,
    upperBound,
    lowerBound,
    trend,
    seasonal,
  };
}

/**
 * Aggregate multiple time series by month and predict the total
 */
export function predictAggregated(
  seriesMap: Map<string, TimeSeriesPoint[]>,
  stepsAhead: number = 6,
): PredictionResult {
  // Merge all series by month
  const monthMap = new Map<string, number>();
  for (const series of seriesMap.values()) {
    for (const point of series) {
      monthMap.set(point.month, (monthMap.get(point.month) || 0) + point.value);
    }
  }

  const sortedMonths = Array.from(monthMap.keys()).sort();
  const aggregated: TimeSeriesPoint[] = sortedMonths.map((m) => ({
    month: m,
    value: monthMap.get(m)!,
  }));

  return predict(aggregated, stepsAhead);
}
