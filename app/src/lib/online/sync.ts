import type { RoomView } from './protocol';

/** Keeps object identity for duplicate or out-of-order snapshots of the same seat. */
export function newerRoom<T extends Pick<RoomView, 'code' | 'seat' | 'revision'>>(current: T | null, incoming: T): T {
  if (!current || current.code !== incoming.code || current.seat !== incoming.seat) return incoming;
  return incoming.revision > current.revision ? incoming : current;
}
