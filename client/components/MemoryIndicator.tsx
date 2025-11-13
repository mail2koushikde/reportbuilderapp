import React from 'react';
import { Cpu } from 'lucide-react';

type PerfMemory = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export default function MemoryIndicator() {
  const [supported, setSupported] = React.useState<boolean>(false);
  const [used, setUsed] = React.useState<number>(0);
  const [limit, setLimit] = React.useState<number>(0);
  const [total, setTotal] = React.useState<number>(0);

  const update = React.useCallback(() => {
    const perf: any = typeof performance !== 'undefined' ? performance : null;
    const mem: PerfMemory | undefined = perf && perf.memory ? (perf.memory as PerfMemory) : undefined;
    if (!mem) return;
    setUsed(mem.usedJSHeapSize || 0);
    setLimit(mem.jsHeapSizeLimit || 0);
    setTotal(mem.totalJSHeapSize || 0);
  }, []);

  React.useEffect(() => {
    const perf: any = typeof performance !== 'undefined' ? performance : null;
    const mem = perf && perf.memory ? (perf.memory as PerfMemory) : undefined;
    setSupported(!!mem);
    if (!mem) return;

    update();
    const id = window.setInterval(update, 2000);
    return () => window.clearInterval(id);
  }, [update]);

  const percent = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;
  const levelClass = !supported
    ? 'bg-gray-500/20 text-gray-300 border-gray-400/30'
    : percent >= 90
      ? 'bg-red-500/20 text-red-300 border-red-400/30'
      : percent >= 70
        ? 'bg-orange-500/20 text-orange-300 border-orange-400/30'
        : 'bg-green-500/20 text-green-300 border-green-400/30';

  const title = supported
    ? `JS Heap: ${formatMB(used)} MB / ${formatMB(limit)} MB (${percent.toFixed(0)}%)` + (total ? `\nTotal JS Heap: ${formatMB(total)} MB` : '')
    : 'Memory usage not supported in this browser';

  return (
    <div
      className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg border ${levelClass}`}
      title={title}
      aria-label={title}
    >
      <Cpu className="w-3 h-3" />
      <span className="text-xs font-medium">
        {supported ? `${formatMB(used)} MB` : 'Mem N/A'}
      </span>
      {supported && (
        <span className="text-[10px] opacity-80">({percent.toFixed(0)}%)</span>
      )}
    </div>
  );
}
