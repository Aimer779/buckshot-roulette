import { useState } from 'react';
import { Link } from 'react-router';
import { Bell, BellOff, LockKeyhole, LogOut, Users } from 'lucide-react';
import { useOnlineRoom } from '@/hooks/useOnlineRoom';
import OnlineTable from '@/components/gameplay/OnlineTable';
import OnlineLobby from '@/components/gameplay/OnlineLobby';
import RoomActivity from '@/components/gameplay/RoomActivity';
import RoomEnded from '@/components/gameplay/RoomEnded';
import RoomConnection from '@/components/gameplay/RoomConnection';
import RoomInvite from '@/components/gameplay/RoomInvite';
import { useOnlineTurnAlert } from '@/hooks/useOnlineTurnAlert';
import ConnectionStatus from '@/components/gameplay/ConnectionStatus';

export default function OnlineScreen() {
  const requestedRoom = new URLSearchParams(window.location.search).get('room') ?? '';
  const inviteCode = /^\d{6}$/.test(requestedRoom) ? requestedRoom : '';
  const { room, session, connected, latencyMs, busy, error, enter, act, leave, dismiss } = useOnlineRoom();
  const turnAlert = useOnlineTurnAlert(room, connected);
  const [mode, setMode] = useState<'create' | 'join'>(() => inviteCode ? 'join' : 'create');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState(inviteCode);
  const inputClass = 'w-full rounded border border-stone-600 bg-black/60 px-4 py-3 text-stone-100 outline-none focus:border-amber-400';
  const exitLabel = room?.phase === 'closed' ? '返回联机大厅'
    : room?.phase === 'waiting' ? room.seat === 0 ? '退出并关闭房间' : '退出房间'
      : room?.phase === 'playing' || room?.phase === 'round-end' ? '退出并认负' : '退出房间';
  return (
    <main className="h-[100dvh] overflow-y-auto bg-cover bg-center px-4 py-8 font-chinese text-stone-100"
      style={{ backgroundImage: 'linear-gradient(rgba(8,8,12,.9),rgba(8,8,12,.95)),url(/bg-title.jpg)' }}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div><p className="mb-2 font-pixel text-xs tracking-[.3em] text-red-400">BUCKSHOT ROULETTE / ONLINE</p>
            <h1 className="flex items-center gap-3 text-3xl font-bold"><Users aria-hidden="true" />双人联机</h1></div>
          <Link className="rounded px-2 py-2 text-sm text-stone-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]" to="/"
            title={session ? '保留当前标签页的重连凭证；回到联机页面可重新连接。' : undefined}>
            {session ? '暂时返回主菜单' : '返回主菜单'}
          </Link>
        </header>
        {error && <p role="alert" className="mb-4 rounded border border-red-500/50 bg-red-950/50 p-3 text-red-200">{error}</p>}
        {session && inviteCode && inviteCode !== session.code && <p className="mb-4 rounded border border-[var(--accent-gold)] bg-[var(--bg-dark)] p-3 text-sm text-[var(--text-secondary)]">
          邀请来自房间 {inviteCode}。你仍在房间 {session.code}，请先退出当前房间再加入邀请。
        </p>}
        {!session ? <section className="mx-auto max-w-lg rounded-xl border border-white/15 bg-black/50 p-6 shadow-2xl">
          <div className="mb-6 grid grid-cols-2 gap-2">
            <button className={`rounded p-3 ${mode === 'create' ? 'bg-red-900 text-white' : 'bg-stone-900 text-stone-400'}`} onClick={() => setMode('create')}>创建房间</button>
            <button className={`rounded p-3 ${mode === 'join' ? 'bg-red-900 text-white' : 'bg-stone-900 text-stone-400'}`} onClick={() => setMode('join')}>加入房间</button>
          </div>
          <p className="mb-6 text-sm leading-6 text-stone-400">邀请一位朋友坐到桌子另一边。每间房最多两人，双方准备后由房主开始。</p>
          <form className="flex flex-col gap-5" onSubmit={event => {
            event.preventDefault();
            void enter(name.trim(), password, mode === 'join' ? code : undefined);
          }}>
            <label className="flex flex-col gap-2 text-sm">你的昵称
              <input className={inputClass} value={name} onChange={e => setName(e.target.value)} required maxLength={20} autoComplete="nickname" placeholder="输入昵称" /></label>
            {mode === 'join' && <label className="flex flex-col gap-2 text-sm">六位房号
              <input className={inputClass} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required pattern="[0-9]{6}" inputMode="numeric" placeholder="例如 123456" /></label>}
            <label className="flex flex-col gap-2 text-sm"><span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" />房间密码</span>
              <input className={inputClass} value={password} onChange={e => setPassword(e.target.value)} required minLength={4} maxLength={64} type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} placeholder={mode === 'create' ? '设置 4–64 字密码' : '输入房主提供的密码'} /></label>
            <button className="btn-primary mt-2 w-full disabled:opacity-40" disabled={busy || !name.trim()}>{busy ? '正在连接…' : mode === 'create' ? '创建双人房间' : '加入房间'}</button>
          </form>
        </section> : <>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 rounded border border-white/15 bg-black/60 p-4">
            <RoomInvite code={session.code} />
            <button type="button" disabled={busy} onClick={() => room?.phase === 'closed' ? dismiss() : void leave()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--accent-red)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent-crimson)_10%,transparent)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors enabled:hover:border-[var(--accent-red-glow)] enabled:hover:bg-[color-mix(in_srgb,var(--accent-crimson)_30%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-red-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-dark)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40">
              <LogOut className="h-4 w-4" aria-hidden="true" />{exitLabel}
            </button>
          </div>
          {!connected && <p role="status" className="mb-4 rounded bg-amber-950/60 p-3 text-amber-200">正在连接房间… 连接恢复后自动同步，暂时无法操作。</p>}
          {room?.phase !== 'closed' && <ConnectionStatus connected={connected} latencyMs={latencyMs} />}
          {room && <RoomActivity events={room.events} />}
          {room && <RoomConnection room={room} />}
          <div className="mb-4 flex justify-end">
            <button onClick={turnAlert.toggle} aria-pressed={turnAlert.enabled} title={turnAlert.soundEnabled ? '轮到你行动时播放一次提示音' : '主菜单的音效总开关已关闭'}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--bg-elevated)] bg-[var(--bg-dark)] px-3 text-xs text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]">
              {turnAlert.enabled ? <Bell className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}回合提示音：{turnAlert.enabled ? '开启' : '关闭'}
            </button>
          </div>
          {room?.phase === 'closed' && <RoomEnded room={room} dismiss={dismiss} />}
          {room?.phase === 'waiting' && <OnlineLobby room={room} connected={connected} busy={busy} act={act} />}
          {room && room.phase !== 'waiting' && room.phase !== 'closed' && <OnlineTable room={room} disabled={busy || !connected} act={act} />}
        </>}
      </div>
    </main>
  );
}
