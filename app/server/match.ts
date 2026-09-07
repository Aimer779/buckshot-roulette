import { ROUND_CONFIG } from '../src/data/roundConfig';
import { distributeItems, loadShells } from '../src/lib/gameEngine';
import { executeItemEffect } from '../src/lib/itemEffects';
import { resolveShotOutcome } from '../src/lib/shotResolution';
import { countShells, getReloadReason } from '../src/lib/shellFlow';
import type { Shell } from '../src/store/gameStore';
import type { OnlinePlayer, RoomAction, RoomPhase, Seat } from '../src/lib/online/protocol';

export interface Match {
  players: [OnlinePlayer, OnlinePlayer | null];
  phase: RoomPhase;
  round: number;
  turn: Seat;
  winner: Seat | null;
  shells: Shell[];
  index: number;
  known: [Set<number>, Set<number>];
  logs: string[];
}

export function player(name: string): OnlinePlayer {
  return { name, ready: false, connected: true, hp: 0, maxHP: 0, score: 0,
    items: [], saw: false, cuffed: false };
}

export function newMatch(name: string): Match {
  return { players: [player(name), null], phase: 'waiting', round: 1, turn: 0,
    winner: null, shells: [], index: 0, known: [new Set(), new Set()], logs: [] };
}

export function log(match: Match, message: string) {
  match.logs = [...match.logs, message].slice(-60);
}

function reload(match: Match) {
  match.shells = loadShells(match.round);
  match.index = 0;
  match.known = [new Set(), new Set()];
  for (const participant of match.players) {
    if (participant) {
      // Both humans receive the player pool, including private-information items.
      participant.items = [...participant.items, ...distributeItems(match.round).player].slice(0, 8);
    }
  }
  const counts = countShells(match.shells);
  log(match, `装弹：${counts.live} 发实弹，${counts.blank} 发空包弹。`);
}

function startRound(match: Match) {
  match.phase = 'playing';
  match.winner = null;
  match.turn = ((match.round - 1) % 2) as Seat;
  for (const participant of match.players) {
    if (!participant) continue;
    participant.hp = participant.maxHP = ROUND_CONFIG[match.round].playerHP;
    participant.items = [];
    participant.saw = participant.cuffed = participant.ready = false;
  }
  log(match, `第 ${match.round} 局开始。`);
  reload(match);
}

function finishAction(match: Match) {
  const loser = match.players.findIndex(p => p && p.hp <= 0);
  if (loser >= 0) {
    const winner = (1 - loser) as Seat;
    match.winner = winner;
    const participant = match.players[winner]!;
    participant.score++;
    match.phase = participant.score >= 2 ? 'finished' : 'round-end';
    match.players.forEach(p => { if (p) p.ready = false; });
    log(match, `${participant.name} 赢得${match.phase === 'finished' ? '整场比赛' : '本局'}。`);
  } else if (getReloadReason(match.shells, match.index)) {
    reload(match);
  }
}

export function act(match: Match, seat: Seat, action: RoomAction) {
  const me = match.players[seat]!;
  const otherSeat = (1 - seat) as Seat;
  const opponent = match.players[otherSeat];
  if (action.type === 'ready') {
    if (match.phase !== 'waiting') throw new Error('现在不能修改准备状态。');
    me.ready = action.ready;
    return;
  }
  if (!opponent || !opponent.connected) throw new Error('等待对方连接后继续。');
  if (action.type === 'start') {
    if (seat !== 0 || match.phase !== 'waiting' || !me.ready || !opponent.ready) {
      throw new Error('两人准备后，由房主开始游戏。');
    }
    startRound(match);
    return;
  }
  if (action.type === 'next' || action.type === 'rematch') {
    const expected = action.type === 'next' ? 'round-end' : 'finished';
    if (match.phase !== expected) throw new Error('当前不能继续。');
    me.ready = true;
    if (opponent.ready) {
      if (action.type === 'rematch') {
        match.round = 1;
        me.score = opponent.score = 0;
        match.logs = [];
      } else match.round++;
      startRound(match);
    }
    return;
  }
  if (match.phase !== 'playing' || match.turn !== seat) throw new Error('还没有轮到你。');
  if (action.type === 'shoot') {
    const target = action.target === 'self' ? me : opponent;
    const shell = match.shells[match.index++];
    const outcome = resolveShotOutcome({ actor: 'player',
      target: action.target === 'self' ? 'player' : 'dealer',
      shellType: shell.type, actorSawActive: me.saw });
    target.hp = Math.max(0, target.hp - outcome.damage);
    if (outcome.sawConsumed) me.saw = false;
    log(match, `${me.name} 向${action.target === 'self' ? '自己' : opponent.name}开枪：${outcome.hit ? `实弹，-${outcome.damage} HP` : '空包弹'}。`);
    if (!outcome.keepsTurn) {
      if (opponent.cuffed) {
        opponent.cuffed = false;
        log(match, `${opponent.name} 被手铐跳过一回合。`);
      } else match.turn = otherSeat;
    }
  } else if (action.type === 'item') {
    const item = me.items.find(candidate => candidate.id === action.itemId);
    if (!item) throw new Error('道具不存在或已使用。');
    if (item.type === 'handcuffs' && opponent.cuffed) throw new Error('对方已被手铐限制。');
    // Normalize the acting human as "player" so both seats use identical rules.
    const result = executeItemEffect({ actor: 'player', item,
      playerHP: me.hp, playerMaxHP: me.maxHP, dealerHP: opponent.hp, dealerMaxHP: opponent.maxHP,
      shells: match.shells.map((shell, i) => ({ ...shell, revealed: match.known[seat].has(i) })),
      currentShellIndex: match.index, currentShell: match.shells[match.index] ?? null,
      actorSawActive: me.saw, guillotineTriggered: false, opponentItems: opponent.items });
    if (!result) throw new Error('现在无法使用这个道具。');
    me.items = me.items.filter(i => !result.consumedItemIds.includes(i.id));
    me.items.push(...result.addedItems ?? []);
    opponent.items = opponent.items.filter(i => !result.removedOpponentItemIds?.includes(i.id));
    for (const change of result.hpChanges ?? []) {
      const target = change.target === 'player' ? me : opponent;
      target.hp = Math.max(0, Math.min(target.maxHP, target.hp + (change.kind === 'heal' ? change.amount : -change.amount)));
    }
    if (result.actorSawActive !== undefined) me.saw = result.actorSawActive;
    if (result.skipDealerTurn) opponent.cuffed = true;
    if (result.shellUpdates) match.shells = result.shellUpdates;
    for (const index of result.revealedShellIndices ?? []) match.known[seat].add(index);
    if (result.consumeCurrentShell) match.index++;
    const names = { magnifier: '放大镜', handcuffs: '手铐', cigarette: '香烟', beer: '啤酒',
      handsaw: '手锯', adrenaline: '肾上腺素', medicine: '过期药品', inverter: '逆变器', phone: '手机' };
    // Private reveals never enter the public log.
    log(match, `${me.name} 使用了${names[item.type]}${result.ejectedShellType ? `，弹出${result.ejectedShellType === 'live' ? '实弹' : '空包弹'}` : ''}。`);
  }
  finishAction(match);
}
