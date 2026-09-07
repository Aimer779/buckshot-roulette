import { DoorClosed, Trophy } from 'lucide-react';
import type { RoomView } from '@/lib/online/protocol';

export default function RoomEnded({ room, dismiss }: { room: RoomView; dismiss: () => void }) {
  const winner = room.winner === null ? null : room.players[room.winner];
  return <section aria-labelledby="room-ended-title" className="rounded-xl border border-[var(--bg-elevated)] bg-[var(--bg-dark)] p-6 text-center">
    <DoorClosed className="mx-auto mb-4 h-8 w-8 text-[var(--accent-gold)]" aria-hidden="true" />
    <h2 id="room-ended-title" className="mb-3 text-2xl font-bold">房间已结束</h2>
    <p role="status" className="break-words text-[var(--text-secondary)]">{room.closure?.message}</p>
    {winner && <p className="mt-4 flex items-center justify-center gap-2 break-all text-[var(--accent-gold)]"><Trophy className="h-5 w-5 shrink-0" aria-hidden="true" />{winner.name} 获得本场胜利</p>}
    {room.players[1] && <div className="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-[var(--bg-surface)] p-4">
      <span className="min-w-0 break-all">{room.players[0].name}</span>
      <div><p className="text-xs text-[var(--text-secondary)]">已完成局数比分</p><p className="font-pixel text-3xl">{room.players[0].score} : {room.players[1].score}</p></div>
      <span className="min-w-0 break-all">{room.players[1].name}</span>
    </div>}
    <button className="mt-4 min-h-12 rounded-lg border border-[var(--accent-gold)] px-5 py-3 text-[var(--accent-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]" onClick={dismiss}>返回联机大厅</button>
  </section>;
}
