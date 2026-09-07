import type { Match } from './match';
import type { RoomClosure, RoomEvent } from '../src/lib/online/protocol';

export interface Room {
  code: string;
  salt: string;
  password: Buffer;
  tokens: [string, string | null];
  seen: [number, number];
  revision: number;
  phaseRevision: number;
  acted: [number, number];
  match: Match;
  events: RoomEvent[];
  eventId: number;
  closure: RoomClosure | null;
}
