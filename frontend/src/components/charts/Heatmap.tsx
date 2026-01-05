import { useMemo, useState } from 'react';
import { dayLabels, hourLabels, hourLabelsCompact, formatNumber } from '../../lib/chartConfig';

interface HeatmapDataItem {
  day: number;  // 0-6 (Mon-Sun)
  hour: number; // 0-23
  value: number;
}

interface HeatmapProps {
  data: HeatmapDataItem[];
  height?: number;
  colorScale?: [string, string]; // [low, high]
  formatValue?: (value: number) => string;
  valueLabel?: string;
}

function interpolateColor(low: string, high: string, ratio: number): string {
  // Parse hex colors
  const lowRgb = {
    r: parseInt(low.slice(1, 3), 16),
    g: parseInt(low.slice(3, 5), 16),
    b: parseInt(low.slice(5, 7), 16),
  };
  const highRgb = {
    r: parseInt(high.slice(1, 3), 16),
    g: parseInt(high.slice(3, 5), 16),
    b: parseInt(high.slice(5, 7), 16),
  };

  // Interpolate
  const r = Math.round(lowRgb.r + (highRgb.r - lowRgb.r) * ratio);
  const g = Math.round(lowRgb.g + (highRgb.g - lowRgb.g) * ratio);
  const b = Math.round(lowRgb.b + (highRgb.b - lowRgb.b) * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}

export function Heatmap({
  data,
  height = 280,
  colorScale = ['#f0f4f8', '#334e68'], // Navy 50 to Navy 700
  formatValue = formatNumber,
  valueLabel = 'Value',
}: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    day: number;
    hour: number;
    value: number;
  } | null>(null);

  // Create a map for quick lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      map.set(`${item.day}-${item.hour}`, item.value);
    });
    return map;
  }, [data]);

  // Calculate min/max for color scaling
  const { minValue, maxValue } = useMemo(() => {
    if (data.length === 0) return { minValue: 0, maxValue: 1 };
    const values = data.map((d) => d.value);
    return {
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };
  }, [data]);

  const getCellColor = (value: number): string => {
    if (maxValue === minValue) return colorScale[0];
    const ratio = (value - minValue) / (maxValue - minValue);
    return interpolateColor(colorScale[0], colorScale[1], ratio);
  };

  // Show only key hours to reduce clutter
  const visibleHours = [0, 4, 8, 12, 16, 20];

  return (
    <div className="relative" style={{ height }}>
      <div className="flex h-full">
        {/* Y-axis labels (days) */}
        <div className="flex flex-col justify-around pr-2 py-2" style={{ width: 40 }}>
          {dayLabels.map((day) => (
            <div
              key={day}
              className="text-xs text-slate-500 text-right leading-none"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 grid grid-rows-7 gap-1">
            {Array.from({ length: 7 }).map((_, dayIndex) => (
              <div key={dayIndex} className="grid grid-cols-24 gap-0.5">
                {Array.from({ length: 24 }).map((_, hourIndex) => {
                  const value = dataMap.get(`${dayIndex}-${hourIndex}`) ?? 0;
                  return (
                    <div
                      key={hourIndex}
                      className="rounded-sm cursor-pointer transition-transform hover:scale-110 hover:z-10"
                      style={{
                        backgroundColor: getCellColor(value),
                        aspectRatio: '1',
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          visible: true,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                          day: dayIndex,
                          hour: hourIndex,
                          value,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* X-axis labels (hours) - compact format for space */}
          <div className="flex justify-between pt-2 px-1">
            {visibleHours.map((hour) => (
              <div
                key={hour}
                className="text-xs text-slate-500"
                style={{ width: `${100 / 6}%`, textAlign: 'center' }}
              >
                {hourLabelsCompact[hour]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip?.visible && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-md shadow-lg px-3 py-2 text-sm pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 60,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-medium text-slate-800">
            {dayLabels[tooltip.day]} {hourLabels[tooltip.hour]}
          </div>
          <div className="text-slate-600">
            {valueLabel}: {formatValue(tooltip.value)}
          </div>
        </div>
      )}

      {/* Color legend */}
      <div className="absolute bottom-0 right-0 flex items-center gap-2">
        <span className="text-xs text-slate-500">Low</span>
        <div
          className="h-2 w-24 rounded"
          style={{
            background: `linear-gradient(to right, ${colorScale[0]}, ${colorScale[1]})`,
          }}
        />
        <span className="text-xs text-slate-500">High</span>
      </div>
    </div>
  );
}
