import { useState, useEffect } from 'react';
import { DAY_START, DAY_END, PIXELS_PER_MINUTE } from './constants';

export function NowLine() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < DAY_START || minutes > DAY_END) return null;

  const top = (minutes - DAY_START) * PIXELS_PER_MINUTE;

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
      style={{ top }}
    >
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0 agenda-now-dot" />
      <div className="flex-1 h-[2px] bg-red-500" />
    </div>
  );
}
