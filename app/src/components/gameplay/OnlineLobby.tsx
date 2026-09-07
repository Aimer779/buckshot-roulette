import { BookOpen, Check, CircleCheck, Clock3, Crown, LoaderCircle, LockKeyhole, Radio, UserRound, UserRoundPlus, WifiOff } from 'lucide-react';
import type { OnlinePlayer, RoomAction, RoomView } from '@/lib/online/protocol';

interface Props {
  room: RoomView;
  connected: boolean;
  busy: boolean;
  act: (action: RoomAction) => Promise<void>;
}

function PlayerSeat({ player, host, self, connected }: {
  player: OnlinePlayer | null; host: boolean; self: boolean; connected: boolean;
}) {
  const online = connected && player?.connected;
  const ready = online && player?.ready;
  const StatusIcon = !online ? WifiOff : ready ? CircleCheck : Clock3;
  const status = !connected ? '正在同步' : !player?.connected ? '暂时离线' : ready ? '已准备' : '未准备';
  return (
    <article aria-label={player ? `${player.name}${self ? '（你）' : ''}` : '空座位'}
      className={`relative min-w-0 overflow-hidden rounded-xl border p-5 transition-[border-color,box-shadow,background-color] duration-300 motion-reduce:transition-none ${
        ready ? 'border-[color-mix(in_srgb,var(--hp-full)_50%,transparent)] bg-[color-mix(in_srgb,var(--hp-full)_6%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_24px_rgba(16,185,129,0.06)]'
          : player ? 'border-[var(--bg-elevated)] bg-[color-mix(in_srgb,var(--bg-surface)_60%,transparent)]' : 'border-dashed border-[color-mix(in_srgb,var(--text-dim)_40%,transparent)] bg-[color-mix(in_srgb,var(--bg-dark)_40%,transparent)]'}`}>
      <div aria-hidden="true" className={`absolute inset-x-5 top-0 h-px ${ready ? 'bg-[color-mix(in_srgb,var(--hp-full)_70%,transparent)]' : host ? 'bg-[color-mix(in_srgb,var(--accent-gold)_50%,transparent)]' : 'bg-transparent'}`} />
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="font-pixel text-sm tracking-[0.2em] text-[var(--text-secondary)]">SEAT {host ? '01' : '02'}</span>
        {host && <span className="inline-flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--accent-gold)_25%,transparent)] bg-[color-mix(in_srgb,var(--accent-gold)_8%,transparent)] px-2 py-1 text-xs text-[var(--accent-gold)]">
          <Crown className="h-3.5 w-3.5" aria-hidden="true" />房主
        </span>}
      </div>
      <div className="mb-5 flex items-center gap-3">
        <div aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${
          ready ? 'border-[color-mix(in_srgb,var(--hp-full)_30%,transparent)] bg-[color-mix(in_srgb,var(--hp-full)_10%,transparent)] text-[var(--hp-full)]'
            : 'border-[var(--bg-elevated)] bg-[color-mix(in_srgb,var(--bg-void)_40%,transparent)] text-[var(--text-secondary)]'}`}>
          {player ? <UserRound className="h-6 w-6" /> : <UserRoundPlus className="h-6 w-6" />}
        </div>
        <div className="min-w-0">
          <h3 className="break-all text-lg font-bold text-[var(--text-primary)]">{player?.name ?? '等待朋友入座'}</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{player ? self ? '你的位置' : '对手的位置' : '分享房号和密码，邀请朋友加入'}</p>
        </div>
      </div>
      <div className="flex min-h-10 items-center border-t border-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] pt-4">
        {player ? <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
          ready ? 'border-[color-mix(in_srgb,var(--hp-full)_30%,transparent)] bg-[color-mix(in_srgb,var(--hp-full)_10%,transparent)] text-[var(--hp-full)]'
            : 'border-[color-mix(in_srgb,var(--text-secondary)_20%,transparent)] bg-[color-mix(in_srgb,var(--bg-void)_25%,transparent)] text-[var(--text-secondary)]'}`}>
          <StatusIcon className="h-4 w-4" aria-hidden="true" />{status}
        </span> : <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><LockKeyhole className="h-4 w-4" aria-hidden="true" />仅限受邀玩家</span>}
      </div>
    </article>
  );
}

export default function OnlineLobby({ room, connected, busy, act }: Props) {
  const me = room.players[room.seat]!;
  const opponent = room.players[room.seat === 0 ? 1 : 0];
  const readyCount = connected ? room.players.filter(p => p?.connected && p.ready).length : 0;
  const allReady = readyCount === 2;
  const hint = !connected ? '正在同步房间状态，请稍候。'
    : !opponent ? '把房号和密码发给朋友，也可以先准备好。'
      : !opponent.connected ? '对方暂时离线，连接恢复后即可继续。'
        : !me.ready ? '点击准备，告诉对方你已就绪。'
          : !opponent.ready ? '你已准备就绪，等待对方准备。'
            : room.seat === 0 ? '双方已就绪，由你开启这场对决。' : '双方已就绪，等待房主开始对战。';
  const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg-dark)]';
  const buttonClass = `flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-lg border px-4 text-base font-semibold transition-[background-color,border-color,box-shadow] motion-reduce:transition-none disabled:cursor-not-allowed ${focusClass}`;
  return (
    <div className="space-y-4">
    <section aria-labelledby="online-lobby-title" className="overflow-hidden rounded-xl border border-[var(--bg-elevated)] bg-[color-mix(in_srgb,var(--bg-dark)_90%,transparent)] shadow-[0_16px_48px_rgba(0,0,0,0.3)]">
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1.5 font-pixel text-xs tracking-[0.25em] text-[var(--accent-gold)]">PRIVATE TABLE</p>
            <h2 id="online-lobby-title" className="text-xl font-bold text-[var(--text-primary)]">对局准备</h2>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-[var(--bg-elevated)] bg-[color-mix(in_srgb,var(--bg-void)_35%,transparent)] px-3 py-2">
            <div className="flex gap-1.5" aria-hidden="true">{[0, 1].map(i => <span key={i} className={`h-5 w-1.5 rounded-sm transition-colors motion-reduce:transition-none ${i < readyCount ? 'bg-[var(--hp-full)] shadow-[0_0_8px_rgba(16,185,129,0.2)]' : 'bg-[var(--bg-elevated)]'}`} />)}</div>
            <span className="text-sm text-[var(--text-secondary)]"><span className="font-mono-data text-[var(--text-primary)]">{readyCount} / 2</span> 已准备</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {room.players.map((player, i) => <PlayerSeat key={i} player={player} host={i === 0} self={i === room.seat} connected={connected} />)}
        </div>
      </div>
      <div className="border-t border-[var(--bg-elevated)] bg-[color-mix(in_srgb,var(--bg-void)_30%,transparent)] p-4 sm:p-6">
        <div role="status" aria-live="polite" aria-atomic="true" className={`mb-5 flex items-start gap-2.5 text-sm leading-6 ${allReady ? 'text-[var(--hp-full)]' : 'text-[var(--text-secondary)]'}`}>
          {allReady ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <Radio className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-gold)]" aria-hidden="true" />}
          <p>{hint}</p>
        </div>
        <div className={`grid gap-3 ${room.seat === 0 ? 'sm:grid-cols-2' : ''}`}>
          <button type="button" disabled={busy || !connected} onClick={() => void act({ type: 'ready', ready: !me.ready })}
            className={`${buttonClass} disabled:opacity-40 ${
              me.ready ? 'border-[color-mix(in_srgb,var(--hp-full)_40%,transparent)] bg-[color-mix(in_srgb,var(--hp-full)_8%,transparent)] text-[var(--hp-full)] enabled:hover:bg-[color-mix(in_srgb,var(--hp-full)_15%,transparent)]'
                : 'border-[color-mix(in_srgb,var(--accent-gold)_50%,transparent)] bg-[color-mix(in_srgb,var(--accent-gold)_8%,transparent)] text-[var(--accent-gold)] enabled:hover:bg-[color-mix(in_srgb,var(--accent-gold)_15%,transparent)]'}`}>
            {busy ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {me.ready ? '取消准备' : '准备'}
          </button>
          {room.seat === 0 && <button type="button" disabled={busy || !allReady} aria-describedby="online-start-help"
            onClick={() => void act({ type: 'start' })}
            className={`${buttonClass} ${allReady
              ? 'border-[color-mix(in_srgb,var(--accent-red-glow)_60%,transparent)] bg-gradient-to-br from-[var(--accent-red)] to-[var(--accent-crimson)] text-[var(--text-primary)] shadow-[0_0_20px_rgba(220,38,38,0.15)] enabled:hover:shadow-[0_0_28px_rgba(220,38,38,0.3)] disabled:opacity-50'
              : 'border-[var(--bg-elevated)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'}`}>
            {allReady ? <Radio className="h-4 w-4" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4" aria-hidden="true" />}开始对战
          </button>}
        </div>
        <p id="online-start-help" className="mt-3 text-center text-xs leading-5 text-[var(--text-secondary)]">双方准备后，由房主开始对战。开始前可随时取消准备。</p>
      </div>
    </section>
    <aside aria-labelledby="online-room-guide" className="rounded-xl border border-[var(--bg-elevated)] bg-[color-mix(in_srgb,var(--bg-dark)_80%,transparent)] p-4 sm:p-5">
      <h2 id="online-room-guide" className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <BookOpen className="h-4 w-4 text-[var(--accent-gold)]" aria-hidden="true" />入局须知
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          ['对局规则', '三局两胜，每局轮换先手。双方准备后由房主开始。'],
          ['回合与情报', '向自己打出空包弹可继续行动；道具揭示的情报仅自己可见。'],
          ['断线重连', '刷新当前页面可恢复座位；对方离线时暂停，重连后继续。'],
          ['退出房间', '任意一方退出都会关闭整个房间，双方需要重新入座。'],
        ].map(([title, description]) => <div key={title} className="border-l-2 border-[color-mix(in_srgb,var(--accent-gold)_20%,transparent)] pl-3">
          <dt className="mb-1 text-xs font-medium text-[var(--accent-gold)]">{title}</dt>
          <dd className="text-sm leading-6 text-[var(--text-secondary)]">{description}</dd>
        </div>)}
      </dl>
    </aside>
    </div>
  );
}
