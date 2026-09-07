import type { Room } from './roomState';
import type { RoomClosure, RoomEvent, Seat } from '../src/lib/online/protocol';

export const ROOM_IDLE_MS = 30 * 60_000;
export const CLOSED_RETENTION_MS = 5 * 60_000;
export const HEARTBEAT_MS = 15_000;

export function recordEvent(room: Room, type: RoomEvent['type'], actor: Seat | null, message: string, now: number) {
  room.events = [...room.events, { id: ++room.eventId, type, actor, message, at: now }].slice(-20);
  room.revision++;
}

export function closeRoom(room: Room, reason: RoomClosure['reason'], actor: Seat | null, message: string, now: number) {
  if (room.closure) return;
  if ((room.match.phase === 'playing' || room.match.phase === 'round-end') && actor !== null) {
    room.match.winner = actor === 0 ? 1 : 0;
  }
  room.closure = { reason, actor, message, at: now };
  room.match.phase = 'closed';
  recordEvent(room, 'closed', actor, message, now);
  room.phaseRevision = room.revision;
}

export function refreshPresence(room: Room, now: number) {
  if (room.closure) return;
  for (const seat of [0, 1] as const) {
    const participant = room.match.players[seat];
    if (!participant) continue;
    const connected = now - room.seen[seat] <= HEARTBEAT_MS;
    if (participant.connected === connected) continue;
    participant.connected = connected;
    recordEvent(room, connected ? 'reconnected' : 'disconnected', seat,
      `${participant.name} ${connected ? '已重新连接。' : '暂时离线，等待重连。'}`, now);
  }
}
