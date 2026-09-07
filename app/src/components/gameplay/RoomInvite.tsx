import { useState } from 'react';
import { Copy, Link as LinkIcon } from 'lucide-react';

export default function RoomInvite({ code }: { code: string }) {
  const [feedback, setFeedback] = useState('');
  const [manualCopy, setManualCopy] = useState('');
  const copy = async (kind: 'code' | 'link') => {
    const link = new URL('/online', window.location.origin);
    link.searchParams.set('room', code);
    const value = kind === 'code' ? code : link.href;
    setManualCopy('');
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(kind === 'code' ? '房号已复制。' : '邀请链接已复制，密码请另行告知朋友。');
    } catch {
      setManualCopy(value);
      setFeedback('浏览器未允许自动复制，请选中下方文本复制。');
    }
  };
  const buttonClass = 'inline-flex min-h-10 items-center gap-1.5 rounded-md border border-[var(--bg-elevated)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] hover:border-[var(--accent-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]';
  return <div className="min-w-[min(100%,220px)] flex-1">
    <p className="text-xs text-[var(--text-secondary)]">房间号码 · 密码请另行分享</p>
    <p className="my-1 font-pixel text-3xl tracking-widest text-[var(--accent-gold)]">{code}</p>
    <div className="flex flex-wrap gap-2">
      <button className={buttonClass} onClick={() => void copy('code')}><Copy className="h-3.5 w-3.5" aria-hidden="true" />复制房号</button>
      <button className={buttonClass} onClick={() => void copy('link')}><LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />复制邀请链接</button>
    </div>
    <p role="status" className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{feedback}</p>
    {['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">跨设备邀请请先用局域网 IP 或公网地址打开本页。</p>}
    {manualCopy && <input aria-label="手动复制邀请内容" readOnly value={manualCopy} onFocus={e => e.currentTarget.select()}
      className="mt-2 w-full rounded border border-[var(--accent-gold)] bg-[var(--bg-void)] p-2 text-xs text-[var(--text-primary)]" />}
  </div>;
}
