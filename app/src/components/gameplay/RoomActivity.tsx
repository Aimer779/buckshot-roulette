import { Radio } from 'lucide-react';
import type { RoomEvent } from '@/lib/online/protocol';

export default function RoomActivity({ events }: { events: RoomEvent[] }) {
  return <aside aria-label="房间动态" className="mb-4 rounded-lg border border-[var(--bg-elevated)] bg-[var(--bg-dark)] p-3 text-sm">
    <p className="mb-2 flex items-center gap-2 text-[var(--accent-gold)]"><Radio className="h-4 w-4" aria-hidden="true" />房间动态</p>
    <div role="log" aria-live="polite" aria-relevant="additions" className="space-y-1 text-[var(--text-secondary)]">
      {events.slice(-3).map(event => <p key={event.id} className="break-words">{event.message}</p>)}
    </div>
  </aside>;
}
