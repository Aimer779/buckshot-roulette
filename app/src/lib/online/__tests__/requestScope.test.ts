import { describe, expect, it } from 'vitest';
import { OnlineRequestScope } from '../requestScope';

describe('asynchronous room request lifetime', () => {
  it('rejects a late result after the screen or seat is invalidated', async () => {
    const scope = new OnlineRequestScope();
    let resolve!: (value: string) => void;
    const response = new Promise<string>(done => { resolve = done; });
    const isCurrent = scope.capture();
    let savedSession = 'original';
    const pending = response.then(value => { if (isCurrent()) savedSession = value; });
    scope.invalidate();
    savedSession = 'new seat';
    resolve('stale seat');
    await pending;
    expect(savedSession).toBe('new seat');
  });

  it('allows new operations without reviving any previous generation', () => {
    const scope = new OnlineRequestScope();
    const old = scope.capture();
    scope.invalidate();
    const current = scope.capture();
    expect(old()).toBe(false);
    expect(current()).toBe(true);
    scope.invalidate();
    expect(current()).toBe(false);
    expect(old()).toBe(false);
  });
});
