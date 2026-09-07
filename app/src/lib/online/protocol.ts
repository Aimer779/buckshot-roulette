import type { Item, ShellType } from '@/store/gameStore';

export type Seat = 0 | 1;
export type RoomPhase = 'waiting' | 'playing' | 'round-end' | 'finished';
export type RoomAction =
  | { type: 'ready'; ready: boolean }
  | { type: 'start' }
  | { type: 'shoot'; target: 'self' | 'opponent' }
  | { type: 'item'; itemId: string }
  | { type: 'next' }
  | { type: 'rematch' };

export interface OnlinePlayer {
  name: string;
  ready: boolean;
  connected: boolean;
  hp: number;
  maxHP: number;
  score: number;
  items: Item[];
  saw: boolean;
  cuffed: boolean;
}

export interface RoomView {
  code: string;
  revision: number;
  seat: Seat;
  phase: RoomPhase;
  players: [OnlinePlayer, OnlinePlayer | null];
  turn: Seat;
  round: number;
  winner: Seat | null;
  counts: Record<ShellType, number>;
  knownShells: Array<{ position: number; type: ShellType }>;
  logs: string[];
}

export interface RoomSession {
  code: string;
  token: string;
}

export interface JoinResult {
  session: RoomSession;
  room: RoomView;
}
