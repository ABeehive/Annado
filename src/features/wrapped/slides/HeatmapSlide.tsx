import { SlideProps } from '../types';
import { SHORT_MONTH_NAMES } from '../../../utils/dates';
import { NoDataFallback } from './NoDataFallback';

const CELL_SIZE = 11;
const CELL_GAP = 2;

function getMonthPositions(days: { date: string }[]): { label: string; col: number }[] {
  const positions: { label: string; col: number }[] = [];
  let lastMonth = -1;
  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i].date + 'T00:00:00');
    const m = d.getMonth();
    const col = Math.floor(i / 7);
    if (m !== lastMonth) {
      positions.push({ label: SHORT_MONTH_NAMES[m], col });
      lastMonth = m;
    }
  }
  return positions;
}

export function HeatmapSlide({ data, active }: SlideProps) {
  const { heatmapDays } = data;

  if (heatmapDays.length === 0) {
    return <NoDataFallback message="No data for this year" />;
  }

  const maxCount = Math.max(...heatmapDays.map((d) => d.count), 1);
  const monthPositions = getMonthPositions(heatmapDays);

  // Find day-of-week of first entry to offset the grid start
  const firstDow = new Date(heatmapDays[0].date + 'T00:00:00').getDay(); // 0=Sun

  return (
    <div className="h-full flex flex-col">
      <h2
        className="text-[24px] font-bold mb-1 wrapped-fade-in"
        style={{ color: 'var(--slide-accent)', letterSpacing: '-0.02em' }}
      >
        Your year in tasks
      </h2>
      <p
        className="text-[14px] mb-4 wrapped-fade-in"
        style={{ animationDelay: '0.1s', color: 'var(--slide-accent)', opacity: 0.5 }}
      >
        {heatmapDays.filter((d) => d.count > 0).length} active days · {data.totalCompleted} tasks completed
      </p>

      <div className="flex-1 flex flex-col justify-center">
        <div style={{ overflowX: 'auto' }}>
          {/* Month labels */}
          <div
            className="flex mb-1"
            style={{ paddingLeft: `${(CELL_SIZE + CELL_GAP) * 0}px` }}
          >
            {monthPositions.map(({ label, col }) => (
              <div
                key={label}
                className="text-[9px] font-medium absolute"
                style={{
                  color: 'var(--slide-accent)',
                  opacity: 0.5,
                  left: `${col * (CELL_SIZE + CELL_GAP)}px`,
                  position: 'absolute',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grid: columns = weeks, rows = days of week */}
          <div
            className="relative"
            style={{ height: `${(CELL_SIZE + CELL_GAP) * 7 + 14}px` }}
          >
            {/* Month labels (positioned above grid) */}
            {monthPositions.map(({ label, col }) => (
              <div
                key={label}
                className="text-[9px] font-medium"
                style={{
                  color: 'var(--slide-accent)',
                  opacity: 0.5,
                  position: 'absolute',
                  top: 0,
                  left: `${col * (CELL_SIZE + CELL_GAP)}px`,
                }}
              >
                {label}
              </div>
            ))}

            {/* Cells */}
            {heatmapDays.map((day, idx) => {
              // Shift by firstDow so the grid starts on the correct column
              const adjustedIdx = idx + firstDow;
              const col = Math.floor(adjustedIdx / 7);
              const row = adjustedIdx % 7;
              const intensity = day.count === 0 ? 0 : 0.15 + (day.count / maxCount) * 0.85;
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.count} tasks`}
                  style={{
                    position: 'absolute',
                    top: `${14 + row * (CELL_SIZE + CELL_GAP)}px`,
                    left: `${col * (CELL_SIZE + CELL_GAP)}px`,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    borderRadius: 2,
                    opacity: active ? (day.count === 0 ? 0.08 : intensity) : 0,
                    transition: `opacity 0.05s ease ${0.01 * idx}s`,
                    backgroundColor: 'var(--slide-accent)',
                  }}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div
            className="flex items-center gap-1.5 mt-3"
            style={{ color: 'var(--slide-accent)', opacity: 0.5 }}
          >
            <span className="text-[10px]">Less</span>
            {[0.08, 0.3, 0.55, 0.75, 1.0].map((op, i) => (
              <div
                key={i}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 2,
                  backgroundColor: 'var(--slide-accent)',
                  opacity: op,
                }}
              />
            ))}
            <span className="text-[10px]">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
