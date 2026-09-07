import type { Room } from './roomState';
import type { RoomClosure, RoomEvent, Seat } from '../src/lib/online/protocol';

export const ROOM_IDLE_MS = 30 * 60_000;
export const CLOSED_RETENTION_MS = 5 * 60_000;
export const HEARTBEAT_MS = 15_000;
export const RECONNECT_MS = 90_000;

export const reconnectDeadline = (room: Room, seat: Seat) => room.seen[seat] + HEARTBEAT_MS + RECONNECT_MS;

export function expireConnections(room: Room, now: number) {
  if (room.closure || !room.match.players[1]) return;
  const expired = ([0, 1] as const).filter(seat => now >= reconnectDeadline(room, seat));
  if (!expired.length) return;
  const actor = expired.length === 2 ? null : expired[0];
  if (room.match.phase === 'waiting' && actor === 1) {
    releaseGuest(room, 'timed-out', `${room.match.players[1]!.name} 重连超时，座位已释放。`, now);
    return;
  }
  const message = actor === null ? '双方均未在重连期限内返回，房间已结束。'
    : `${room.match.players[actor]!.name} 重连超时，已退出房间。`;
  closeRoom(room, 'connection-timeout', actor, message, now);
}

export function releaseGuest(room: Room, type: 'left' | 'timed-out', message: string, now: number) {
  const token = room.tokens[1];
  if (room.match.phase !== 'waiting' || !token) return;
  room.removedSeats = [...room.removedSeats.filter(seat => now - seat.at < CLOSED_RETENTION_MS), {
    token, message: type === 'timed-out' ? '你的重连期限已过，座位已释放，请重新加入。' : '你已退出该房间，原座位凭证已失效。', at: now,
  }].slice(-20);
  room.tokens[1] = null;
  room.seen[1] = 0;
  room.match.players[1] = null;
  room.match.players[0].ready = false;
  room.match.known[1].clear();
  room.acted[1] = -1;
  recordEvent(room, type, 1, message, now);
  // A new opponent requires a fresh ready decision, including pending host requests.
  room.phaseRevision = room.revision;
}

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
  recordEvent(room, reason === 'resigned' ? 'resigned' : reason === 'connection-timeout' ? 'timed-out' : 'closed', actor, message, now);
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
