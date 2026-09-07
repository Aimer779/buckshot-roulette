import type { RoomView } from './protocol';

type Turn = Pick<RoomView, 'code' | 'seat' | 'phase' | 'turn' | 'round'>;

/** Alerts on a newly assigned human turn, not refreshes, repeated snapshots or self-blank shots. */
export function isNewLocalTurn(previous: Turn | null, current: Turn | null): boolean {
  if (!previous || !current || previous.code !== current.code || previous.seat !== current.seat) return false;
  return current.phase === 'playing' && current.turn === current.seat
    && (previous.phase !== 'playing' || previous.turn !== current.turn || previous.round !== current.round);
}
