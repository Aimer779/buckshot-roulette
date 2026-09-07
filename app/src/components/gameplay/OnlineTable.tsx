import HealthBar from '@/components/HealthBar';
import ResignButton from '@/components/gameplay/ResignButton';
import { ITEM_INFO } from '@/store/gameStore';
import type { RoomAction, RoomView } from '@/lib/online/protocol';

interface Props { room: RoomView; disabled: boolean; act: (action: RoomAction) => Promise<void> }
export default function OnlineTable({ room, disabled, act }: Props) {
  const me = room.players[room.seat]!;
  const opponent = room.players[room.seat === 0 ? 1 : 0]!;
  const canPlay = !disabled && room.phase === 'playing' && room.turn === room.seat && opponent.connected;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 items-center gap-3 rounded-lg border border-white/15 bg-black/50 p-4 sm:grid-cols-[1fr_auto_1fr]">
        <div className="min-w-0 break-all [&_svg]:h-4 [&_svg]:w-4 sm:[&_svg]:h-6 sm:[&_svg]:w-6">
          <HealthBar current={me.hp} max={me.maxHP} label={`${me.name}（你）`} />
        </div>
        <div className="order-first col-span-2 text-center sm:order-none sm:col-span-1"><p className="text-xs text-stone-400">第 {room.round} 局 · 三局两胜</p>
          <p className="font-pixel text-3xl text-amber-400">{me.score} : {opponent.score}</p></div>
        <div className="min-w-0 break-all [&_svg]:h-4 [&_svg]:w-4 sm:[&_svg]:h-6 sm:[&_svg]:w-6">
          <HealthBar current={opponent.hp} max={opponent.maxHP} label={opponent.name} />
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-sm text-stone-300">
        <span>对方道具：</span>{opponent.items.length === 0 ? '暂无' : opponent.items.map(item => (
          <span key={item.id} title={ITEM_INFO[item.type].description}>{ITEM_INFO[item.type].name}</span>
        ))}
        {opponent.saw && <span className="text-red-400">对方手锯已装备</span>}
        {opponent.cuffed && <span className="text-amber-400">对方被铐住</span>}
      </div>
      <div className="rounded-lg border border-white/10 bg-black/40 p-5 text-center">
        <p className="text-sm tracking-widest"><span className="text-red-400">实弹 {room.counts.live}</span>
          <span className="mx-5 text-stone-300">空包弹 {room.counts.blank}</span></p>
        <img src="/shotgun-idle.png" alt="桌上的霰弹枪" className="mx-auto h-32 w-full max-w-md object-contain" />
        <p className="mb-4 text-lg text-amber-300" role="status">
          {room.phase !== 'playing' ? `${room.players[room.winner ?? 0]!.name} 赢得${room.phase === 'finished' ? '比赛' : '本局'}`
            : !opponent.connected ? '对方暂时离线，等待重连…' : room.turn === room.seat ? '轮到你了' : `等待 ${opponent.name} 操作…`}
        </p>
        {room.phase === 'playing' ? <div className="flex flex-wrap justify-center gap-3">
          <button className="btn-secondary disabled:opacity-40" disabled={!canPlay} onClick={() => void act({ type: 'shoot', target: 'self' })}>向自己开枪</button>
          <button className="btn-primary disabled:opacity-40" disabled={!canPlay} onClick={() => void act({ type: 'shoot', target: 'opponent' })}>向对方开枪</button>
        </div> : <button className="btn-primary disabled:opacity-40" disabled={disabled || me.ready || !opponent.connected}
          onClick={() => void act({ type: room.phase === 'finished' ? 'rematch' : 'next' })}>
          {me.ready ? '等待对方确认…' : room.phase === 'finished' ? '再来一场' : '准备下一局'}
        </button>}
      </div>
      <section aria-label="你的道具" className="rounded-lg border border-white/10 bg-black/50 p-4">
        <p className="mb-3 text-sm text-stone-300">你的道具 · 点击使用
          {me.saw && <span className="ml-3 text-red-400">手锯已装备</span>}
          {me.cuffed && <span className="ml-3 text-amber-400">你被铐住了</span>}</p>
        <div className="flex flex-wrap gap-2">
          {me.items.length === 0 && <p className="text-sm text-stone-500">暂无道具，装弹时补充。</p>}
          {me.items.map(item => <button key={item.id} disabled={!canPlay}
            onClick={() => void act({ type: 'item', itemId: item.id })} title={ITEM_INFO[item.type].description}
            className="flex w-24 flex-col items-center gap-1 rounded border border-stone-600 bg-stone-900 p-2 text-xs hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40">
            <img src={ITEM_INFO[item.type].image} alt="" className="h-12 w-12 object-contain" />{ITEM_INFO[item.type].name}
          </button>)}
        </div>
      </section>
      {room.knownShells.length > 0 && <aside className="rounded border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-200">
        <p>仅你可见的情报（从当前子弹起计数）</p>
        {room.knownShells.map(shell => <span className="mr-4" key={shell.position}>第 {shell.position} 发：{shell.type === 'live' ? '实弹' : '空包弹'}</span>)}
      </aside>}
      <section aria-label="对局记录" className="max-h-44 overflow-y-auto rounded border border-white/10 bg-black/50 p-3 text-sm text-stone-400">
        {[...room.logs].reverse().map((message, i) => <p key={`${room.logs.length - i}-${message}`}>{message}</p>)}
      </section>
      {(room.phase === 'playing' || room.phase === 'round-end') && <div className="flex justify-end">
        <ResignButton disabled={disabled} resign={() => void act({ type: 'resign' })} />
      </div>}
    </div>
  );
}
