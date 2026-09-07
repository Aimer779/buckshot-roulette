import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { clientAddressResolver } from '../clientAddress';

const request = (remoteAddress: string, forwarded: string) => ({
  socket: { remoteAddress }, headers: { 'x-forwarded-for': forwarded },
}) as unknown as IncomingMessage;

describe('trusted proxy address resolution', () => {
  it('ignores spoofed headers from an untrusted peer', () => {
    expect(clientAddressResolver()(request('192.0.2.10', '198.51.100.1'))).toBe('192.0.2.10');
  });
  it('distinguishes clients behind a configured proxy', () => {
    const resolve = clientAddressResolver('127.0.0.1,::1');
    expect(resolve(request('::ffff:127.0.0.1', '198.51.100.1'))).toBe('198.51.100.1');
    expect(resolve(request('::1', '198.51.100.2'))).toBe('198.51.100.2');
    expect(resolve(request('::ffff:7f00:1', '2001:DB8::1'))).toBe('2001:db8::1');
  });
  it('stops at the first untrusted hop instead of trusting the leftmost value', () => {
    const resolve = clientAddressResolver('127.0.0.1,10.0.0.0/8');
    expect(resolve(request('127.0.0.1', '1.1.1.1, 192.0.2.5, 10.1.0.1'))).toBe('192.0.2.5');
  });
  it('rejects malformed trusted configuration and forwarded addresses', () => {
    expect(() => clientAddressResolver('0.0.0.0/33')).toThrow();
    expect(() => clientAddressResolver('127.0.0.1')(request('127.0.0.1', 'garbage'))).toThrow();
  });
});
