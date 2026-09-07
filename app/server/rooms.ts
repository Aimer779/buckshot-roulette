import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { act, newMatch, player } from './match';
import { countShells } from '../src/lib/shellFlow';
import type { JoinResult, RoomAction, RoomView, Seat } from '../src/lib/online/protocol';
import { EntryRequests } from './entryRequests';
import type { Room } from './roomState';
import { closeRoom, CLOSED_RETENTION_MS, expireConnections, reconnectDeadline, recordEvent, refreshPresence, ROOM_IDLE_MS } from './roomLifecycle';

const deriveKey = promisify(scrypt);

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
  private passwordJobs = 0;
  private now: () => number;
  constructor(now = Date.now) { this.now = now; }

  private async hashPassword(password: string, salt: string) {
    if (this.passwordJobs >= 8) throw new RoomError('入座服务繁忙，请稍后重试。', 503);
    this.passwordJobs++;
    try { return await deriveKey(password, salt, 64) as Buffer; }
    finally { this.passwordJobs--; }
  }

  async enter(input: { name: string; password: string; code?: string; requestId: string }): Promise<JoinResult> {
    const { requestId, ...credentials } = input;
    const session = await this.entries.run(requestId, credentials, this.now(), async () => {
      const result = input.code ? await this.join(input.code, input.name, input.password)
        : await this.create(input.name, input.password);
      return result.session;
    });
    // An old entry receipt cannot reclaim a revoked or expired seat.
    const room = this.read(session.code, session.token);
    if (room.closure) throw new RoomError('此前的房间已经结束，请重新创建或加入。', 410);
    return { session, room };
  }

  prune() {
    for (const [code, room] of this.rooms) {
      expireConnections(room, this.now());
      if (room.closure) {
        if (this.now() - room.closure.at >= CLOSED_RETENTION_MS) this.rooms.delete(code);
      } else if (this.now() - Math.max(...room.seen) > ROOM_IDLE_MS) {
        closeRoom(room, 'expired', null, '房间因长时间无人在线而关闭。', this.now());
      }
    }
  }

  async create(name: string, password: string): Promise<JoinResult> {
    this.prune();
    if (this.rooms.size >= 500) throw new RoomError('房间已满，请稍后再试。', 503);
    const salt = randomBytes(16).toString('hex');
    const key = await this.hashPassword(password, salt);
    if (this.rooms.size >= 500) throw new RoomError('房间已满，请稍后再试。', 503);
    let code: string;
    do { code = String(randomInt(100000, 1000000)); } while (this.rooms.has(code));
    const token = randomBytes(32).toString('hex');
    const room: Room = { code, salt, password: key, tokens: [token, null],
      seen: [this.now(), 0], revision: 0, phaseRevision: 0, acted: [-1, -1], match: newMatch(name),
      events: [], eventId: 0, closure: null };
    recordEvent(room, 'joined', 0, `${name} 创建了房间。`, this.now());
    this.rooms.set(code, room);
    return { session: { code, token }, room: this.view(room, 0) };
  }

  async join(code: string, name: string, password: string): Promise<JoinResult> {
    const room = this.get(code);
    const key = await this.hashPassword(password, room.salt);
    if (!timingSafeEqual(key, room.password)) throw new RoomError('房号或密码不正确。', 403);
    // Password hashing yields; recheck membership and capacity before assigning the seat.
    if (this.rooms.get(code) !== room) throw new RoomError('房间已关闭。', 404);
    if (room.tokens[1]) throw new RoomError('房间已有两位玩家。', 409);
    if (room.match.phase !== 'waiting') throw new RoomError('游戏已经开始。', 409);
    const token = randomBytes(32).toString('hex');
    room.tokens[1] = token;
    room.seen[1] = this.now();
    room.match.players[1] = player(name);
    recordEvent(room, 'joined', 1, `${name} 加入了房间。`, this.now());
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
    if (room.closure) return { room, seat };
    room.seen[seat] = this.now();
    refreshPresence(room, this.now());
    return { room, seat };
  }

  read(code: string, token: string): RoomView {
    const { room, seat } = this.authenticate(code, token);
    return this.view(room, seat);
  }

  action(code: string, token: string, revision: number, action: RoomAction) {
    const { room, seat } = this.authenticate(code, token);
    if (room.closure) throw new RoomError('房间已经结束。', 409);
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
    const { room, seat } = this.authenticate(code, token);
    closeRoom(room, 'left', seat, `${room.match.players[seat]!.name} 主动退出了房间。`, this.now());
  }

  private view(room: Room, seat: Seat): RoomView {
    const match = room.match;
    return structuredClone({ code: room.code, revision: room.revision, seat,
      phase: match.phase, players: match.players, turn: match.turn, round: match.round,
      winner: match.winner, counts: countShells(match.shells.slice(match.index)),
      knownShells: [...match.known[seat]].filter(i => i >= match.index).sort((a, b) => a - b)
        .map(i => ({ position: i - match.index + 1, type: match.shells[i].type })),
      logs: match.logs, events: room.events, closure: room.closure, serverTime: this.now(),
      reconnectUntil: ([0, 1] as const).map(id => !room.closure && match.players[id] && !match.players[id]!.connected
        ? reconnectDeadline(room, id) : null) as [number | null, number | null] });
  }
}
