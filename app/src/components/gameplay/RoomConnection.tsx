import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import type { RoomView } from '@/lib/online/protocol';

function Countdown({ deadline, serverTime }: { deadline: number; serverTime: number }) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((deadline - serverTime) / 1000)));
  useEffect(() => {
    const receivedAt = performance.now();
    const timer = setInterval(() => {
      const estimatedServerTime = serverTime + performance.now() - receivedAt;
      setSeconds(Math.max(0, Math.ceil((deadline - estimatedServerTime) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, [deadline, serverTime]);
  return <span className="font-mono-data text-lg" aria-live="off">{seconds} 秒</span>;
}

export default function RoomConnection({ room }: { room: RoomView }) {
  const opponent = room.seat === 0 ? 1 : 0;
  const deadline = room.reconnectUntil[opponent];
  if (!deadline || room.phase === 'closed') return null;
  return <aside className="mb-4 rounded-lg border border-[var(--accent-gold)] bg-[var(--bg-dark)] p-4 text-sm">
    <p role="status" className="mb-2 flex items-center gap-2 text-[var(--accent-gold)]"><WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />{room.players[opponent]!.name} 暂时离线，等待重连</p>
    <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--text-secondary)]">
      <span>{room.phase === 'waiting' ? room.seat === 0 ? '超时后释放对方座位，你可以继续邀请。' : '房主重连超时后将关闭房间。' : '对局已暂停；重连超时按离开处理并结算。'}</span>
      <Countdown key={`${deadline}:${room.serverTime}`} deadline={deadline} serverTime={room.serverTime} />
    </div>
  </aside>;
}
