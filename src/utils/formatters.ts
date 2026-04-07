import { CATEGORY_LABELS } from '../data/constants';
import type { CostCategory, MetricStatus } from '../data/types';

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 10000) {
    return `¥${(value / 10000).toFixed(2)}万`;
  }
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 10000) {
    return `${(value / 10000).toFixed(2)}万`;
  }
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

export function formatMonth(month: string): string {
  const [year, mon] = month.split('-');
  return `${year}年${parseInt(mon)}月`;
}

export function formatCostCategory(category: CostCategory): string {
  return CATEGORY_LABELS[category] || category;
}

export function formatMetricStatus(status: MetricStatus): { text: string; color: string } {
  switch (status) {
    case 'active':
      return { text: '已接入', color: 'green' };
    case 'not_configured':
      return { text: '待开发', color: 'orange' };
    case 'coming_soon':
      return { text: '即将上线', color: 'blue' };
    default:
      return { text: status, color: 'default' };
  }
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}
