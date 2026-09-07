import { createHash } from 'node:crypto';
import type { RoomSession } from '../src/lib/online/protocol';

/** Shares a pending entry operation and its result across lost-response retries. */
export class EntryRequests {
  private requests = new Map<string, {
    fingerprint: string; expiresAt: number; result: Promise<RoomSession>;
  }>();

  run(id: string, input: unknown, now: number, operation: () => Promise<RoomSession>) {
    for (const [key, request] of this.requests) {
      if (request.expiresAt <= now) this.requests.delete(key);
    }
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const existing = this.requests.get(id);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('重试时请使用上次相同的昵称、房号和密码。');
      return existing.result;
    }
    if (this.requests.size >= 2000) throw new Error('入座请求过多，请稍后重试。');
    const result = operation().catch(error => {
      this.requests.delete(id);
      throw error;
    });
    this.requests.set(id, { fingerprint, expiresAt: now + 30 * 60_000, result });
    return result;
  }
}
