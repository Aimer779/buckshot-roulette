import { LoaderCircle, Wifi } from 'lucide-react';

export default function ConnectionStatus({ connected, latencyMs }: { connected: boolean; latencyMs: number | null }) {
  const slow = latencyMs !== null && latencyMs > 800;
  return <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
    <p role="status" className={`flex items-center gap-2 ${connected && !slow ? 'text-[var(--hp-full)]' : 'text-[var(--accent-gold)]'}`}>
      {connected ? <Wifi className="h-4 w-4" aria-hidden="true" /> : <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
      {connected ? slow ? '网络较慢，请等待操作确认' : '连接正常' : '正在连接或恢复网络…'}
    </p>
    {connected && latencyMs !== null && <span title="最近一次采样的请求往返耗时，每 5 秒更新">同步耗时 <span className="font-mono-data">{latencyMs} ms</span></span>}
  </div>;
}
