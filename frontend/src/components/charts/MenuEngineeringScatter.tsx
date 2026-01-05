import { useState, useMemo, useRef, useCallback } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
  ZAxis,
} from 'recharts';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';
import { chartConfig, quadrantColors, formatCurrency, formatNumber } from '../../lib/chartConfig';

type Quadrant = 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog';

interface MenuEngineeringItem {
  name: string;
  quantity: number;
  price: number;  // avg price in cents
  quadrant: Quadrant;
  revenue?: number;
}

interface MenuEngineeringScatterProps {
  data: MenuEngineeringItem[];
  medianQuantity: number;
  medianPrice: number;  // in cents
  height?: number;
  showQuadrantLabels?: boolean;
  useLogScale?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: MenuEngineeringItem;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;

  return (
    <div
      className="bg-white border border-slate-200 rounded-md shadow-lg px-3 py-2"
      style={chartConfig.tooltip.contentStyle}
    >
      <p className="font-medium text-slate-800 mb-1">{item.name}</p>
      <p className="text-sm text-slate-600">
        Quantity: {formatNumber(item.quantity)}
      </p>
      <p className="text-sm text-slate-600">
        Avg Price: {formatCurrency(item.price)}
      </p>
      {item.revenue && (
        <p className="text-sm text-slate-600">
          Revenue: {formatCurrency(item.revenue)}
        </p>
      )}
      <p className="text-xs text-slate-500 mt-1 pt-1 border-t border-slate-100">
        <span
          className="inline-block w-2 h-2 rounded-full mr-1"
          style={{ backgroundColor: quadrantColors[item.quadrant] }}
        />
        {item.quadrant}
      </p>
    </div>
  );
}

// Zoom levels: 2 = zoom out (show 2x range), 1 = fit all, 0.5 = 2x zoom in, etc.
const ZOOM_LEVELS = [2, 1, 0.5, 0.25, 0.125];
const ZOOM_LABELS = ['0.5x', 'Fit All', '2x', '4x', '8x'];
const DEFAULT_ZOOM_INDEX = 1; // Start at "Fit All"

// Log scale tick values (powers of 10) for clean axis labels
const LOG_TICKS_QUANTITY = [1, 10, 100, 1000, 10000];
const LOG_TICKS_PRICE = [100, 1000, 10000, 100000, 1000000]; // ₱1, ₱10, ₱100, ₱1000, ₱10000

export function MenuEngineeringScatter({
  data,
  medianQuantity,
  medianPrice,
  height = 400,
  showQuadrantLabels = true,
  useLogScale = false,
}: MenuEngineeringScatterProps) {
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomLevel = ZOOM_LEVELS[zoomIndex];

  // Calculate base domain (before pan offset)
  const { baseDomainX, baseDomainY } = useMemo(() => {
    const quantities = data.map((d) => d.quantity);
    const prices = data.map((d) => d.price);

    const maxQ = Math.max(...quantities, medianQuantity * 2, 1);
    const maxP = Math.max(...prices, medianPrice * 2, 100);

    // For log scale, minimum must be > 0
    const logMinX = 1;
    const logMinY = 100;

    if (useLogScale) {
      return {
        baseDomainX: [logMinX, maxQ * 1.1] as [number, number],
        baseDomainY: [logMinY, maxP * 1.1] as [number, number],
      };
    }

    // Calculate domain based on zoom level
    const rangeX = maxQ * zoomLevel;
    const rangeY = maxP * zoomLevel;

    // Center around median
    const centerX = medianQuantity;
    const centerY = medianPrice;

    const minX = Math.max(0, centerX - rangeX / 2);
    const maxX = minX + rangeX;
    const minY = Math.max(0, centerY - rangeY / 2);
    const maxY = minY + rangeY;

    return {
      baseDomainX: [minX, maxX] as [number, number],
      baseDomainY: [minY, maxY] as [number, number],
    };
  }, [data, medianQuantity, medianPrice, zoomLevel, useLogScale]);

  // Apply pan offset to domain
  const domainX = useMemo(() => {
    if (useLogScale) return baseDomainX;
    return [baseDomainX[0] + panOffset.x, baseDomainX[1] + panOffset.x] as [number, number];
  }, [baseDomainX, panOffset.x, useLogScale]);

  const domainY = useMemo(() => {
    if (useLogScale) return baseDomainY;
    return [baseDomainY[0] + panOffset.y, baseDomainY[1] + panOffset.y] as [number, number];
  }, [baseDomainY, panOffset.y, useLogScale]);

  // Count items visible in current view
  const visibleCount = useMemo(() => {
    return data.filter(
      (d) =>
        d.quantity >= domainX[0] &&
        d.quantity <= domainX[1] &&
        d.price >= domainY[0] &&
        d.price <= domainY[1]
    ).length;
  }, [data, domainX, domainY]);

  // Pan/drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (useLogScale || zoomLevel === 1) return; // No pan in log mode or fit-all

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: panOffset.x,
      offsetY: panOffset.y,
    };
  }, [useLogScale, zoomLevel, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const chartWidth = containerRect.width - 100; // Approximate chart area minus margins
    const chartHeight = containerRect.height - 80;

    // Calculate how much the mouse moved
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    // Convert pixel movement to data units
    const rangeX = baseDomainX[1] - baseDomainX[0];
    const rangeY = baseDomainY[1] - baseDomainY[0];

    const dataOffsetX = -(deltaX / chartWidth) * rangeX;
    const dataOffsetY = (deltaY / chartHeight) * rangeY; // Invert Y since chart Y is flipped

    setPanOffset({
      x: dragStartRef.current.offsetX + dataOffsetX,
      y: dragStartRef.current.offsetY + dataOffsetY,
    });
  }, [isDragging, baseDomainX, baseDomainY]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
  }, [isDragging]);

  const handleZoomIn = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      setZoomIndex(zoomIndex + 1);
    }
  };

  const handleZoomOut = () => {
    if (zoomIndex > 0) {
      setZoomIndex(zoomIndex - 1);
    }
  };

  const handleReset = () => {
    setZoomIndex(DEFAULT_ZOOM_INDEX);
    setPanOffset({ x: 0, y: 0 });
  };

  const canPan = !useLogScale && zoomLevel < 1;
  const isNotDefault = zoomIndex !== DEFAULT_ZOOM_INDEX || panOffset.x !== 0 || panOffset.y !== 0;

  return (
    <div
      ref={containerRef}
      className={`relative ${canPan ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Zoom Controls & Scale Indicator */}
      <div className="absolute top-0 right-0 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200 p-1">
        {/* Scale indicator */}
        <span
          className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
            useLogScale
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-600'
          }`}
          title={useLogScale ? 'Logarithmic scale for wide value ranges' : 'Linear scale for precise comparisons'}
        >
          {useLogScale ? 'LOG' : 'LINEAR'}
        </span>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button
          onClick={handleZoomOut}
          disabled={zoomIndex <= 0 || useLogScale}
          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={useLogScale ? 'Zoom disabled in log scale' : 'Zoom Out (show more)'}
        >
          <ZoomOut size={16} className="text-slate-600" />
        </button>
        <button
          onClick={handleZoomIn}
          disabled={zoomIndex >= ZOOM_LEVELS.length - 1 || useLogScale}
          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={useLogScale ? 'Zoom disabled in log scale' : 'Zoom In'}
        >
          <ZoomIn size={16} className="text-slate-600" />
        </button>
        <button
          onClick={handleReset}
          disabled={!isNotDefault || useLogScale}
          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Reset View"
        >
          <Maximize2 size={16} className="text-slate-600" />
        </button>
        {!useLogScale && (
          <span className="px-2 text-xs font-medium text-slate-500 border-l border-slate-200 ml-1">
            {ZOOM_LABELS[zoomIndex]}
          </span>
        )}
      </div>

      {/* Pan indicator */}
      {canPan && (
        <div className="absolute top-0 left-0 z-10 flex items-center gap-1 text-xs text-slate-500 bg-white/80 px-2 py-1 rounded">
          <Move size={12} />
          <span>Drag to pan</span>
        </div>
      )}

      {/* View info indicator */}
      {(zoomLevel !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && !useLogScale && (
        <div className="absolute bottom-2 left-2 z-10 text-xs text-slate-500 bg-white/80 px-2 py-1 rounded">
          Showing {visibleCount} of {data.length} items
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 40, right: 40, bottom: 40, left: 60 }}>
        <CartesianGrid
          stroke={chartConfig.grid.stroke}
          strokeDasharray={chartConfig.grid.strokeDasharray}
        />
        <XAxis
          type="number"
          dataKey="quantity"
          name="Quantity Sold"
          tick={chartConfig.axis.tick}
          axisLine={chartConfig.axis.axisLine}
          tickLine={false}
          domain={domainX}
          allowDataOverflow={true}
          scale={useLogScale ? 'log' : 'auto'}
          ticks={useLogScale ? LOG_TICKS_QUANTITY : undefined}
          tickFormatter={(v) => formatNumber(v)}
          label={{
            value: 'Quantity Sold (Popularity)',
            position: 'bottom',
            offset: 20,
            fill: '#64748b',
            fontSize: 12,
          }}
        />
        <YAxis
          type="number"
          dataKey="price"
          name="Avg Price"
          tick={chartConfig.axis.tick}
          axisLine={false}
          tickLine={false}
          domain={domainY}
          allowDataOverflow={true}
          scale={useLogScale ? 'log' : 'auto'}
          ticks={useLogScale ? LOG_TICKS_PRICE : undefined}
          tickFormatter={(v) => formatCurrency(v)}
          label={{
            value: 'Avg Price (Profitability)',
            angle: -90,
            position: 'insideLeft',
            offset: -10,
            fill: '#64748b',
            fontSize: 12,
          }}
        />
        <ZAxis range={[50, 200]} />

        {/* Quadrant divider lines */}
        <ReferenceLine
          x={medianQuantity}
          stroke="#94a3b8"
          strokeDasharray="5 5"
          strokeWidth={1}
        />
        <ReferenceLine
          y={medianPrice}
          stroke="#94a3b8"
          strokeDasharray="5 5"
          strokeWidth={1}
        />

        {/* Quadrant labels using ReferenceArea - positioned relative to median */}
        {showQuadrantLabels && (
          <>
            {/* Star - top right (high quantity, high price) */}
            <ReferenceArea
              x1={medianQuantity}
              x2={domainX[1]}
              y1={medianPrice}
              y2={domainY[1]}
              fill="transparent"
              label={{
                value: 'Star',
                position: 'center',
                fill: quadrantColors.Star,
                fontSize: 14,
                fontWeight: 600,
              }}
            />
            {/* Puzzle - top left (low quantity, high price) */}
            <ReferenceArea
              x1={domainX[0]}
              x2={medianQuantity}
              y1={medianPrice}
              y2={domainY[1]}
              fill="transparent"
              label={{
                value: 'Puzzle',
                position: 'center',
                fill: quadrantColors.Puzzle,
                fontSize: 14,
                fontWeight: 600,
              }}
            />
            {/* Plowhorse - bottom right (high quantity, low price) */}
            <ReferenceArea
              x1={medianQuantity}
              x2={domainX[1]}
              y1={domainY[0]}
              y2={medianPrice}
              fill="transparent"
              label={{
                value: 'Plowhorse',
                position: 'center',
                fill: quadrantColors.Plowhorse,
                fontSize: 14,
                fontWeight: 600,
              }}
            />
            {/* Dog - bottom left (low quantity, low price) */}
            <ReferenceArea
              x1={domainX[0]}
              x2={medianQuantity}
              y1={domainY[0]}
              y2={medianPrice}
              fill="transparent"
              label={{
                value: 'Dog',
                position: 'center',
                fill: quadrantColors.Dog,
                fontSize: 14,
                fontWeight: 600,
              }}
            />
          </>
        )}

        <Tooltip content={<CustomTooltip />} />

        <Scatter name="Menu Items" data={data}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={quadrantColors[entry.quadrant]}
              fillOpacity={0.8}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
    </div>
  );
}
