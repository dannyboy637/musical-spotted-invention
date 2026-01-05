// Chart configuration following DESIGN_SYSTEM.md
// Navy + Gold theme with consistent styling

import type { NumberFormat } from '../stores/settingsStore'

export const chartColors = [
  '#334e68', // Navy 700 - Primary
  '#f59e0b', // Gold 500 - Accent
  '#10b981', // Emerald - Success
  '#3b82f6', // Blue - Info
  '#8b5cf6', // Violet
  '#ec4899', // Pink
] as const;

// Quadrant colors for Menu Engineering
export const quadrantColors = {
  Star: '#10b981',      // Emerald - high profit, high popularity
  Plowhorse: '#3b82f6', // Blue - low profit, high popularity
  Puzzle: '#f59e0b',    // Gold - high profit, low popularity
  Dog: '#64748b',       // Slate - low profit, low popularity
} as const;

export const chartConfig = {
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  grid: {
    stroke: '#e2e8f0',
    strokeDasharray: '3 3',
  },
  axis: {
    tick: { fill: '#64748b', fontSize: 12 },
    axisLine: { stroke: '#e2e8f0' },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      padding: '8px 12px',
    },
    labelStyle: {
      color: '#1e293b',
      fontWeight: 600,
      marginBottom: '4px',
    },
    itemStyle: {
      color: '#64748b',
      fontSize: '14px',
    },
  },
} as const;

// Number format configurations
const NUMBER_LOCALES: Record<NumberFormat, string> = {
  us: 'en-US',
  eu: 'de-DE',
  fr: 'fr-FR',
};

// Format number according to user's preferred format
export function formatNumberWithLocale(value: number, format: NumberFormat, decimals: number = 0): string {
  return value.toLocaleString(NUMBER_LOCALES[format], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Formatters (default to PH/US format for backwards compatibility)
export function formatCurrency(cents: number, format: NumberFormat = 'us'): string {
  const pesos = cents / 100;
  if (pesos >= 1_000_000) {
    return `₱${formatNumberWithLocale(pesos / 1_000_000, format, 1)}M`;
  }
  if (pesos >= 1_000) {
    return `₱${formatNumberWithLocale(pesos / 1_000, format, 1)}K`;
  }
  return `₱${formatNumberWithLocale(pesos, format, 0)}`;
}

export function formatCurrencyFull(cents: number, format: NumberFormat = 'us'): string {
  const pesos = cents / 100;
  return `₱${formatNumberWithLocale(pesos, format, 2)}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number, format: NumberFormat = 'us'): string {
  if (value >= 1_000_000) {
    return `${formatNumberWithLocale(value / 1_000_000, format, 1)}M`;
  }
  if (value >= 1_000) {
    return `${formatNumberWithLocale(value / 1_000, format, 1)}K`;
  }
  return formatNumberWithLocale(value, format, 0);
}

// Day labels for heatmap
export const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Hour labels - full format for tooltips and display (user-friendly)
export const hourLabels = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return '12:00 AM'
  if (i < 12) return `${i}:00 AM`
  if (i === 12) return '12:00 PM'
  return `${i - 12}:00 PM`
});

// Hour labels - compact format for heatmap axis (space-constrained)
export const hourLabelsCompact = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
);

// Get color by index (cycles through palette)
export function getChartColor(index: number): string {
  return chartColors[index % chartColors.length];
}
