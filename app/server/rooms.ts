import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { act, newMatch, player, type Match } from './match';
import { countShells } from '../src/lib/shellFlow';
import type { JoinResult, RoomAction, RoomView, Seat } from '../src/lib/online/protocol';
import { EntryRequests } from './entryRequests';

const deriveKey = promisify(scrypt);
const IDLE_TTL = 30 * 60_000;
const HEARTBEAT_TTL = 15_000;
interface Room {
  code: string;
  salt: string;
  password: Buffer;
  tokens: [string, string | null];
  seen: [number, number];
  revision: number;
  phaseRevision: number;
  acted: [number, number];
  match: Match;
}

export class RoomError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class Rooms {
  private rooms = new Map<string, Room>();
  private entries = new EntryRequests();
  private now: () => number;
  constructor(now = Date.now) { this.now = now; }

  async enter(input: { name: string; password: string; code?: string; requestId: string }): Promise<JoinResult> {
    const { requestId, ...credentials } = input;
    const session = await this.entries.run(requestId, credentials, this.now(), async () => {
      const result = input.code ? await this.join(input.code, input.name, input.password)
        : await this.create(input.name, input.password);
      return result.session;
    });
    // An old entry receipt cannot reclaim a revoked or expired seat.
    return { session, room: this.read(session.code, session.token) };
  }

  prune() {
    for (const [code, room] of this.rooms) {
      if (this.now() - Math.max(...room.seen) > IDLE_TTL) this.rooms.delete(code);
    }
  }

  async create(name: string, password: string): Promise<JoinResult> {
    this.prune();
    if (this.rooms.size >= 500) throw new RoomError('房间已满，请稍后再试。', 503);
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt, 64) as Buffer;
    if (this.rooms.size >= 500) throw new RoomError('房间已满，请稍后再试。', 503);
    let code: string;
    do { code = String(randomInt(100000, 1000000)); } while (this.rooms.has(code));
    const token = randomBytes(32).toString('hex');
    const room: Room = { code, salt, password: key, tokens: [token, null],
      seen: [this.now(), 0], revision: 0, phaseRevision: 0, acted: [-1, -1], match: newMatch(name) };
    this.rooms.set(code, room);
    return { session: { code, token }, room: this.view(room, 0) };
  }

  async join(code: string, name: string, password: string): Promise<JoinResult> {
    const room = this.get(code);
    const key = await deriveKey(password, room.salt, 64) as Buffer;
    if (!timingSafeEqual(key, room.password)) throw new RoomError('房号或密码不正确。', 403);
    // Password hashing yields; recheck membership and capacity before assigning the seat.
    if (this.rooms.get(code) !== room) throw new RoomError('房间已关闭。', 404);
    if (room.tokens[1]) throw new RoomError('房间已有两位玩家。', 409);
    if (room.match.phase !== 'waiting') throw new RoomError('游戏已经开始。', 409);
    const token = randomBytes(32).toString('hex');
    room.tokens[1] = token;
    room.seen[1] = this.now();
    room.match.players[1] = player(name);
    room.revision++;
    return { session: { code, token }, room: this.view(room, 1) };
  }

  private get(code: string) {
    this.prune();
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('房间不存在或已关闭。', 404);
    return room;
  }

  private authenticate(code: string, token: string) {
    const room = this.get(code);
    const index = room.tokens.findIndex(candidate => candidate !== null && candidate === token);
    if (index < 0) throw new RoomError('房间凭证失效，请重新加入。', 401);
    const seat = index as Seat;
    room.seen[seat] = this.now();
    for (const id of [0, 1] as const) {
      const participant = room.match.players[id];
      const connected = this.now() - room.seen[id] <= HEARTBEAT_TTL;
      if (participant && participant.connected !== connected) {
        participant.connected = connected;
        room.revision++;
      }
    }
    return { room, seat };
  }

  read(code: string, token: string): RoomView {
    const { room, seat } = this.authenticate(code, token);
    return this.view(room, seat);
  }

  action(code: string, token: string, revision: number, action: RoomAction) {
    const { room, seat } = this.authenticate(code, token);
    // Both seats may confirm readiness from the same snapshot. A confirmation
    // cannot cross a phase boundary or overwrite a newer action by its own seat.
    const independentConfirmation = ['ready', 'next', 'rematch'].includes(action.type)
      && revision >= Math.max(room.phaseRevision, room.acted[seat]) && revision <= room.revision;
    if (room.revision !== revision && !independentConfirmation) {
      throw new RoomError('对局已更新，请查看最新状态后操作。', 409);
    }
    const phase = room.match.phase;
    act(room.match, seat, action);
    room.revision++;
    room.acted[seat] = room.revision;
    if (phase !== room.match.phase) room.phaseRevision = room.revision;
    return this.view(room, seat);
  }

  leave(code: string, token: string) {
    this.authenticate(code, token);
    this.rooms.delete(code);
  }

  private view(room: Room, seat: Seat): RoomView {
    const match = room.match;
    return structuredClone({ code: room.code, revision: room.revision, seat,
      phase: match.phase, players: match.players, turn: match.turn, round: match.round,
      winner: match.winner, counts: countShells(match.shells.slice(match.index)),
      knownShells: [...match.known[seat]].filter(i => i >= match.index).sort((a, b) => a - b)
        .map(i => ({ position: i - match.index + 1, type: match.shells[i].type })),
      logs: match.logs });
  }
}
