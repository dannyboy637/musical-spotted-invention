interface ChartSkeletonProps {
  type: 'line' | 'bar' | 'donut' | 'heatmap' | 'scatter';
  height?: number;
}

export function ChartSkeleton({ type, height = 300 }: ChartSkeletonProps) {
  const baseClass = 'animate-pulse bg-slate-200 rounded';

  switch (type) {
    case 'line':
      return (
        <div className="w-full" style={{ height }}>
          <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
            <path
              d="M 0 150 Q 50 120 100 130 T 200 100 T 300 120 T 400 80"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="3"
              className="animate-pulse"
            />
            <rect x="0" y="180" width="400" height="2" fill="#e2e8f0" />
            <rect x="0" y="0" width="2" height="180" fill="#e2e8f0" />
          </svg>
        </div>
      );

    case 'bar':
      return (
        <div className="w-full flex items-end justify-around gap-2 px-4" style={{ height }}>
          {[75, 45, 90, 60, 80, 50, 70].map((h, i) => (
            <div
              key={i}
              className={baseClass}
              style={{ height: `${h}%`, flex: 1 }}
            />
          ))}
        </div>
      );

    case 'donut':
      return (
        <div className="w-full flex items-center justify-center" style={{ height }}>
          <div className="relative">
            <div
              className={`${baseClass} rounded-full`}
              style={{ width: height * 0.7, height: height * 0.7 }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full"
              style={{ width: height * 0.4, height: height * 0.4 }}
            />
          </div>
        </div>
      );

    case 'heatmap':
      return (
        <div className="w-full" style={{ height }}>
          <div className="grid grid-cols-12 gap-1 h-full">
            {Array.from({ length: 84 }).map((_, i) => (
              <div
                key={i}
                className={baseClass}
                style={{ opacity: 0.3 + ((i * 7 + 3) % 10) * 0.05 }}
              />
            ))}
          </div>
        </div>
      );

    case 'scatter':
      return (
        <div className="w-full relative" style={{ height }}>
          <div className="absolute inset-0 border-l-2 border-b-2 border-slate-200">
            {[
              { x: 20, y: 30 },
              { x: 35, y: 45 },
              { x: 50, y: 25 },
              { x: 65, y: 60 },
              { x: 75, y: 40 },
              { x: 30, y: 70 },
              { x: 80, y: 20 },
              { x: 45, y: 55 },
            ].map((pos, i) => (
              <div
                key={i}
                className={`absolute ${baseClass} rounded-full`}
                style={{
                  left: `${pos.x}%`,
                  bottom: `${pos.y}%`,
                  width: 12,
                  height: 12,
                  transform: 'translate(-50%, 50%)',
                }}
              />
            ))}
          </div>
        </div>
      );

    default:
      return <div className={baseClass} style={{ height }} />;
  }
}
