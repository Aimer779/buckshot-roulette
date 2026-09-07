import { BlockList, isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';

const normalize = (address: string) => address.startsWith('::ffff:') ? address.slice(7) : address;

/** Only proxies explicitly configured by the operator may supply client addresses. */
export function clientAddressResolver(trustedProxies = '') {
  const trusted = new BlockList();
  for (const entry of trustedProxies.split(',').map(value => value.trim()).filter(Boolean)) {
    const [raw, prefix, extra] = entry.split('/');
    const address = normalize(raw);
    const version = isIP(address);
    if (!version || extra !== undefined) throw new Error(`无效的 TRUSTED_PROXIES 地址：${entry}`);
    const family = version === 4 ? 'ipv4' : 'ipv6';
    if (prefix === undefined) trusted.addAddress(address, family);
    else {
      if (!/^\d+$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128)) {
        throw new Error(`无效的 TRUSTED_PROXIES 网段：${entry}`);
      }
      trusted.addSubnet(address, Number(prefix), family);
    }
  }
  const isTrusted = (address: string) => trusted.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6');
  return (request: IncomingMessage) => {
    let address = normalize(request.socket.remoteAddress ?? '0.0.0.0');
    const forwarded = request.headers['x-forwarded-for'];
    if (!isTrusted(address) || !forwarded) return address;
    if (Array.isArray(forwarded)) throw new Error('无效的代理地址头。');
    const chain = forwarded.split(',').map(value => normalize(value.trim()));
    if (chain.length > 16 || chain.some(value => !isIP(value))) throw new Error('无效的代理地址链。');
    // Walk toward the client until the first untrusted hop, ignoring spoofed prefixes.
    for (let i = chain.length - 1; i >= 0 && isTrusted(address); i--) address = chain[i];
    return address;
  };
}
