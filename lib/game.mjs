import { randomUUID } from 'node:crypto';
import { HEROES, MAX_ENERGY, SKILL_TYPES, findSkill } from '../public/heroes.js';

import { BATTLE_SPELLS } from '../public/spells.js';

export const COUNTDOWN_MS = 4000;
export const REVEAL_MS = 5500;

export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function createPlayer(id, name, heroId, bot = false, battleSpellId = null) {
  if (typeof heroId !== 'string' || !Object.hasOwn(HEROES, heroId)) throw new GameError('Hero tidak tersedia.');
  if (battleSpellId !== null && (typeof battleSpellId !== 'string' || !Object.hasOwn(BATTLE_SPELLS, battleSpellId))) throw new GameError('Battle spell tidak tersedia.');
  const hero = HEROES[heroId];
  return {
    id, name, heroId, bot, hp: hero.hp, defense: hero.defense,
    energy: Object.fromEntries(hero.skills.map(skill => [skill.id, MAX_ENERGY])),
    burn: 0, burnDamage: 0, stun: 0, hypno: 0, reduction: 0, reductionTurns: 0,
    battleSpellId, spellCounters: 0, spellCountered: 0, spellBonus: 0,
    woundTurns: 0, soulDrainTurns: 0, scarTurns: 0, cursed: false,
    flatReduction: 0, flatReductionTurns: 0, basicBuff: 0, soulStacks: 0, hitBonus: 0,
    damageMultiplier: 1, multiplierTurns: 0,
    damageBuff: 0, damageBuffTurns: 0, immuneTurns: 0, ultimateReady: false,
    skipped: false, choice: null, choiceType: null, ready: false, rematch: false,
  };
}

export function createGame(code, player, now = Date.now(), bestOf = 1, mode = 'casual') {
  if (![1, 3, 5].includes(bestOf)) throw new GameError('Pilih seri 1, 3, atau 5 pertandingan.');
  if (!['casual', 'ranked', 'training'].includes(mode)) throw new GameError('Mode duel tidak tersedia.');
  return { series: newSeries(bestOf), mode, chat: [], code, phase: 'lobby', players: [player], round: 0, deadline: null, result: null, lastRound: null, history: [], updatedAt: now, version: 1 };
}

function newSeries(bestOf) {
  return { id: randomUUID(), bestOf, targetWins: Math.floor(bestOf / 2) + 1, match: 1, scores: {}, matches: [], finished: false, winnerId: null };
}

function finishMatch(game, result, now) {
  if (game.phase === 'finished') return;
  game.phase = 'finished';
  game.deadline = null;
  game.result = result;
  const series = game.series;
  if (result.winnerId) series.scores[result.winnerId] = (series.scores[result.winnerId] || 0) + 1;
  series.matches.push({ number: series.match, ...result, rounds: game.round, finishedAt: now });
  if (result.winnerId && series.scores[result.winnerId] >= series.targetWins) {
    series.finished = true;
    series.winnerId = result.winnerId;
  }
}

function touch(game, now) { game.updatedAt = now; game.version++; }

export function joinGame(game, player, now = Date.now()) {
  if (game.phase !== 'lobby' || game.players.length >= 2) throw new GameError('Room ini sudah penuh atau duel sudah dimulai.', 409);
  if (game.series.matches.length) throw new GameError('Seri sudah dimulai.', 409);
  game.players.push(player);
  touch(game, now);
}

export function selectHero(game, playerId, heroId, now = Date.now()) {
  if (game.phase !== 'lobby') throw new GameError('Hero tidak bisa diganti saat duel.');
  const player = getPlayer(game, playerId);
  const fresh = createPlayer(player.id, player.name, heroId, player.bot, player.battleSpellId);
  Object.assign(player, fresh);
  touch(game, now);
}

export function selectSpell(game, playerId, battleSpellId, now = Date.now()) {
  if (game.phase !== 'lobby') throw new GameError('Battle spell tidak bisa diganti saat duel.');
  const player = getPlayer(game, playerId);
  const fresh = createPlayer(player.id, player.name, player.heroId, player.bot, battleSpellId);
  Object.assign(player, fresh);
  touch(game, now);
}

export function getPlayer(game, playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) throw new GameError('Sesi pemain tidak ditemukan.', 401);
  return player;
}

export function readyPlayer(game, playerId, now = Date.now()) {
  if (game.phase !== 'lobby') throw new GameError('Duel sudah dimulai.', 409);
  const player = getPlayer(game, playerId);
  player.ready = !player.ready;
  if (game.players.length === 2 && game.players.every(p => p.ready)) startGame(game, now);
  else touch(game, now);
}

export function startGame(game, now = Date.now()) {
  if (game.players.length !== 2) throw new GameError('Duel membutuhkan dua pemain.');
  for (const player of game.players) {
    Object.assign(player, createPlayer(player.id, player.name, player.heroId, player.bot, player.battleSpellId), { ready: true });
  }
  Object.assign(game, { phase: 'selecting', round: 1, deadline: null, result: null, lastRound: null, history: [] });
  touch(game, now);
}

export function lockCard(game, playerId, skillId, round, now = Date.now(), ultimateType = null) {
  if (game.phase !== 'selecting' || round !== game.round) throw new GameError('Babak sudah berubah. Tunggu sinkronisasi.', 409);
  const player = getPlayer(game, playerId);
  if (player.skipped) throw new GameError('Hero terkena stun dan tidak bisa memilih kartu pada babak ini.', 409);
  if (player.choice) throw new GameError('Kartu sudah dikunci untuk babak ini.', 409);
  const hero = HEROES[player.heroId];
  const skill = findSkill(player.heroId, skillId, ultimateType);
  if (!skill) throw new GameError('Kartu skill tidak dimiliki hero ini.');
  if (skill.isUltimate && !player.ultimateReady) throw new GameError('Ultimate belum aktif. Habiskan seluruh energi skill utama terlebih dahulu.', 409);
  if (!skill.type) throw new GameError('Pilih tipe pedang, panah, atau perisai untuk ultimate.');
  const energyId = skill.isUltimate ? hero.skills.find(s => s.type === skill.type).id : skill.id;
  if (player.energy[energyId] <= 0) throw new GameError('Skill diban karena energi habis. Habiskan energi skill lain untuk mengisi ulang.', 409);
  player.choice = skillId;
  player.choiceType = skill.type;
  startCountdownIfReady(game, now);
  touch(game, now);
}

function startCountdownIfReady(game, now) {
  if (game.players.every(p => p.choice || p.skipped)) {
    game.phase = 'countdown';
    game.deadline = now + COUNTDOWN_MS;
  }
}

export function availableSkills(player) {
  if (player.skipped) return [];
  const hero = HEROES[player.heroId];
  const skills = hero.skills.filter(skill => player.energy[skill.id] > 0);
  return hero.ultimate && player.ultimateReady ? [...skills, ...skills.map(skill => ({ ...hero.ultimate, type: skill.type }))] : skills;
}

function outcomeFor(skill, opponent) {
  if (!skill) return 'stunned';
  if (!opponent) return 'unopposed';
  return SKILL_TYPES[skill.type].counters === opponent.type ? 'counter' : 'countered';
}

function damagePlayer(player, amount) {
  const defenseDamage = Math.min(player.defense, amount);
  const hpDamage = Math.min(player.hp, amount - defenseDamage);
  player.defense -= defenseDamage;
  player.hp -= hpDamage;
  return { defenseDamage, hpDamage, total: defenseDamage + hpDamage };
}

export function resolveRound(game, now = Date.now(), random = Math.random) {
  if (game.phase !== 'countdown' || now < game.deadline) return false;
  const players = game.players;
  const skills = players.map(p => p.skipped ? null : findSkill(p.heroId, p.choice, p.choiceType));
  const outcomes = skills.map((skill, i) => outcomeFor(skill, skills[1 - i]));
  const active = outcomes.map(outcome => outcome === 'counter' || outcome === 'unopposed');
  const old = players.map(p => ({ ...p }));
  const dodged = players.map((p, i) => p.battleSpellId === 'dodge' && outcomes[1 - i] === 'counter' && (p.spellCountered + 1) % 3 === 0);
  const inspired = players.map((p, i) => p.battleSpellId === 'inspire' && outcomes[i] === 'counter' && (p.spellCounters + 1) % 3 === 0);
  const attacks = skills.map((skill, i) => {
    if (!active[i]) return 0;
    const p = players[i];
    const redirected = outcomes[i] === 'counter' && (old[i].hypno > 0 || skills[1 - i]?.reflectOnCounter && !dodged[1 - i] && players[1 - i].immuneTurns === 0);
    const targetHero = HEROES[players[redirected ? i : 1 - i].heroId];
    const base = skill.damagePercent ? Math.ceil((targetHero.hp + targetHero.defense) * skill.damagePercent) : skill.damage[0] + Math.floor(random() * (skill.damage[1] - skill.damage[0] + 1));
    const bonus = (p.damageBuffTurns > 0 ? p.damageBuff : 0) + p.hitBonus + p.spellBonus + (!skill.isUltimate ? p.basicBuff : 0);
    const multiplier = !skill.isUltimate && p.multiplierTurns > 0 ? p.damageMultiplier : 1;
    return (base + bonus) * multiplier * (inspired[i] ? 3 : 1);
  });
  const passives = players.map((p, i) => outcomes[i] === 'countered' ? HEROES[p.heroId].passive?.damage || 0 : 0);

  // Fix both outcomes first. Defensive buffs start immediately; offensive buffs start next round.
  const entries = players.map((player, index) => {
    const skill = skills[index];
    const before = { hp: player.hp, defense: player.defense };
    if (active[index]) {
      if (skill.defense) player.defense = Math.min(HEROES[player.heroId].defense, player.defense + skill.defense);
      if (skill.reduction) { player.reduction = skill.reduction; player.reductionTurns = skill.reductionDuration; }
      if (skill.flatReduction) { player.flatReduction = skill.flatReduction; player.flatReductionTurns = skill.flatReductionDuration; }
      if (skill.immunity) player.immuneTurns = skill.immunity;
      if (skill.heal) player.hp = Math.min(HEROES[player.heroId].hp, player.hp + skill.heal + (skill.healPerSoul || 0) * player.soulStacks);
    }
    if (outcomes[index] === 'counter') player.spellCounters++;
    if (outcomes[1 - index] === 'counter') player.spellCountered++;
    if (skill) {
      const energyId = skill.isUltimate ? HEROES[player.heroId].skills.find(s => s.type === skill.type).id : skill.id;
      player.energy[energyId]--;
      if (skill.isUltimate) player.ultimateReady = false;
    }
    const energyRefilled = Object.values(player.energy).every(value => value === 0);
    if (energyRefilled) for (const id of Object.keys(player.energy)) player.energy[id] = MAX_ENERGY;
    if (energyRefilled && HEROES[player.heroId].ultimate) player.ultimateReady = true;
    return {
      playerId: player.id, skillId: skill?.id ?? null, type: skill?.type ?? null,
      outcome: outcomes[index], attack: attacks[index], passiveAttack: passives[index],
      reflected: outcomes[index] === 'counter' && old[index].hypno > 0, before,
      defenseGained: player.defense - before.defense, healed: player.hp - before.hp,
      energyRefilled, ultimateActivated: energyRefilled && Boolean(HEROES[player.heroId].ultimate),
      received: 0, passiveReceived: 0, reflectedDamage: 0, burnDamage: 0, dotDamage: 0,
      prevented: 0, defenseDrained: 0, hpCost: 0, executed: false,
      dodged: dodged[index], inspired: inspired[index], shieldReflected: false, spellExecuted: false, spellHealed: 0,
    };
  });
  const immune = players.map(p => p.immuneTurns > 0);
  const reductions = players.map(p => ({ percent: p.reductionTurns > 0 ? p.reduction : 0, flat: p.flatReductionTurns > 0 ? p.flatReduction : 0 }));
  const hit = (index, amount, { pierce = false, armor = false, blocked = false } = {}) => {
    const player = players[index];
    const reduction = reductions[index];
    const reduced = immune[index] || blocked ? 0 : Math.max(0, Math.ceil(amount * (1 - reduction.percent)) - reduction.flat - (armor ? 15 : 0));
    entries[index].prevented += amount - reduced;
    if (pierce) { const total = Math.min(player.hp, reduced); player.hp -= total; return total; }
    return damagePlayer(player, reduced).total;
  };
  const hitRival = [false, false];
  // Damage reflection never recurses; secondary status effects retain their original target.
  skills.forEach((skill, i) => {
    if (!active[i]) return;
    const rival = 1 - i;
    const shieldReflects = !entries[i].reflected && skills[rival]?.reflectOnCounter && outcomes[rival] === 'countered' && !immune[rival] && !dodged[rival];
    const target = entries[i].reflected || shieldReflects ? i : rival;
    if (shieldReflects) entries[rival].shieldReflected = true;
    const blocked = target === rival && dodged[rival];
    const protectedTarget = immune[target] || blocked;
    const victim = players[target];
    const execute = skill.executeBelow && entries[target].before.hp < HEROES[victim.heroId].hp * skill.executeBelow && !protectedTarget;
    let damage = 0;
    if (execute) {
      damage = victim.hp;
      victim.hp = 0;
      entries[i].executed = true;
    } else {
      if (!protectedTarget && skill.destroyDefense) {
        entries[target].defenseDrained += victim.defense;
        victim.defense = 0;
      }
      damage = hit(target, attacks[i], { pierce: skill.pierce, blocked, armor: target === rival && outcomes[rival] === 'countered' && victim.battleSpellId === 'armor' });
      if (!protectedTarget && skill.drainDefense) {
        const drained = Math.ceil(victim.defense * skill.drainDefense);
        victim.defense -= drained;
        entries[target].defenseDrained += drained;
      }
    }
    entries[target].received += damage;
    if (target === i) entries[target].reflectedDamage += damage;
    if (target === rival && damage > 0) hitRival[i] = true;
  });
  players.forEach((player, i) => {
    const entry = entries[i];
    entry.passiveReceived = hit(i, passives[1 - i]);
    entry.received += entry.passiveReceived;
    if (old[i].burn > 0) entry.burnDamage = hit(i, old[i].burnDamage);
    if (old[i].woundTurns > 0) entry.dotDamage += hit(i, 10, { pierce: true });
    if (old[i].soulDrainTurns > 0) entry.dotDamage += hit(i, 20, { pierce: true });
    if (old[i].cursed) entry.dotDamage += hit(i, 10, { pierce: true });
    if (old[i].scarTurns > 0) entry.dotDamage += hit(i, 10);
    // Time Boom's HP payment applies even on a failed counter and bypasses protection.
    if (skills[i]?.hpCost) { entry.hpCost = Math.min(player.hp, skills[i].hpCost); player.hp -= entry.hpCost; }
    player.burn = Math.max(0, old[i].burn - 1);
    if (!player.burn) player.burnDamage = 0;
    for (const key of ['stun', 'hypno', 'woundTurns', 'soulDrainTurns', 'scarTurns', 'reductionTurns', 'flatReductionTurns', 'damageBuffTurns', 'multiplierTurns', 'immuneTurns']) player[key] = Math.max(0, player[key] - 1);
    if (!player.reductionTurns) player.reduction = 0;
    if (!player.flatReductionTurns) player.flatReduction = 0;
    if (!player.damageBuffTurns) player.damageBuff = 0;
    if (!player.multiplierTurns) player.damageMultiplier = 1;
  });
  players.forEach((player, i) => {
    const skill = skills[i];
    if (outcomes[i] === 'counter' && player.battleSpellId === 'retribution') player.spellBonus += 5;
    if (!active[i]) return;
    if (skill.damageBuff) { player.damageBuff = skill.damageBuff; player.damageBuffTurns = skill.damageBuffDuration; }
    if (skill.basicBuff) player.basicBuff = skill.basicBuff;
    if (skill.damageMultiplier) { player.damageMultiplier = skill.damageMultiplier; player.multiplierTurns = skill.multiplierDuration; }
    if (hitRival[i]) {
      player.hitBonus += HEROES[player.heroId].passive?.hitBonus || 0;
      if (skill.soulStack) player.soulStacks++;
    }
    const target = players[1 - i];
    // Fresh statuses start on the next round, never retroactively cancel a locked card.
    if (!immune[1 - i] && !dodged[1 - i]) {
      if (skill.burn) { target.burn = skill.burn; target.burnDamage = skill.burnDamage; }
      if (skill.stun) target.stun = Math.max(target.stun, skill.stun);
      if (skill.hypno) target.hypno = Math.max(target.hypno, skill.hypno);
      if (skill.wound) target.woundTurns = skill.wound;
      if (skill.soulDrain) target.soulDrainTurns = skill.soulDrain;
      if (skill.scar) target.scarTurns = skill.scar;
      if (skill.curse) target.cursed = true;
    }
  });
  // Decide both Execute spells from the same post-damage snapshot, before any healing.
  const spellKills = players.map((p, i) => p.battleSpellId === 'execute' && !immune[1 - i] && players[1 - i].hp > 0 && players[1 - i].hp <= HEROES[players[1 - i].heroId].hp * 0.3);
  spellKills.forEach((kill, i) => {
    if (!kill) return;
    entries[i].spellExecuted = true;
    entries[1 - i].received += players[1 - i].hp;
    players[1 - i].hp = 0;
  });
  players.forEach((player, i) => {
    const entry = entries[i];
    if (player.battleSpellId === 'healing' && game.round % 3 === 0 && player.hp > 0) {
      entry.spellHealed = Math.min(30, HEROES[player.heroId].hp - player.hp);
      player.hp += entry.spellHealed;
    }
    Object.assign(entry, {
      after: { hp: player.hp, defense: player.defense },
      burnRemaining: player.burn, stunRemaining: player.stun, hypnoRemaining: player.hypno,
      reductionRemaining: player.reductionTurns, buffRemaining: player.damageBuffTurns, immuneRemaining: player.immuneTurns,
    });
  });
  game.lastRound = { round: game.round, entries };
  game.history.push(game.lastRound);
  game.history = game.history.slice(-30);
  const defeated = players.filter(p => p.hp <= 0);
  if (defeated.length) {
    finishMatch(game, { winnerId: defeated.length === 2 ? null : players.find(p => p.hp > 0).id, reason: defeated.length === 2 ? 'draw' : 'knockout' }, now);
  } else {
    game.phase = 'reveal';
    game.deadline = now + REVEAL_MS;
  }
  touch(game, now);
  return true;
}

export function advanceGame(game, now = Date.now(), random = Math.random) {
  if (game.phase === 'countdown') return resolveRound(game, now, random);
  if (game.phase === 'reveal' && now >= game.deadline) {
    game.phase = 'selecting';
    game.round++;
    game.deadline = null;
    game.players.forEach(p => { p.choice = null; p.choiceType = null; p.skipped = p.stun > 0; });
    startCountdownIfReady(game, now);
    touch(game, now);
    return true;
  }
  return false;
}

export function requestRematch(game, playerId, now = Date.now()) {
  if (game.phase !== 'finished') throw new GameError('Pertandingan belum selesai.', 409);
  if (game.result.reason === 'forfeit') throw new GameError('Lawan sudah keluar. Buat room baru.', 409);
  getPlayer(game, playerId).rematch = true;
  game.players.filter(p => p.bot).forEach(p => { p.rematch = true; });
  if (game.players.length === 2 && game.players.every(p => p.rematch)) {
    game.series = game.series.finished ? newSeries(game.series.bestOf) : { ...game.series, match: game.series.match + 1 };
    for (const player of game.players) Object.assign(player, createPlayer(player.id, player.name, player.heroId, player.bot, player.battleSpellId), { ready: player.bot });
    Object.assign(game, { phase: 'lobby', round: 0, result: null, lastRound: null, history: [], deadline: null });
  }
  touch(game, now);
}

export function leaveGame(game, playerId, now = Date.now()) {
  getPlayer(game, playerId);
  if (game.phase === 'lobby' && !game.series.matches.length) game.players = game.players.filter(p => p.id !== playerId);
  else if (!game.series.finished) {
    const result = { winnerId: game.players.find(p => p.id !== playerId)?.id ?? null, reason: 'forfeit' };
    if (game.phase !== 'finished') finishMatch(game, result, now);
    Object.assign(game, { phase: 'finished', deadline: null, result });
    Object.assign(game.series, { finished: true, winnerId: result.winnerId });
  }
  touch(game, now);
}

export function publicGame(game, viewerId, now = Date.now()) {
  getPlayer(game, viewerId);
  const revealed = ['reveal', 'finished'].includes(game.phase) && game.result?.reason !== 'forfeit';
  return {
    series: structuredClone(game.series), mode: game.mode, chat: structuredClone(game.chat),
    code: game.code, phase: game.phase, round: game.round, deadline: game.deadline,
    version: game.version, serverTime: now, you: viewerId, result: game.result,
    lastRound: game.lastRound, history: game.history,
    players: game.players.map(p => {
      const energy = { ...p.energy };
      // Show only the owner's pending energy cost: opponent energy would leak the card.
      const pending = p.id === viewerId && p.choice && ['selecting', 'countdown'].includes(game.phase);
      const skill = pending && findSkill(p.heroId, p.choice, p.choiceType);
      if (skill) energy[skill.isUltimate ? HEROES[p.heroId].skills.find(s => s.type === skill.type).id : skill.id]--;
      return {
        id: p.id, name: p.name, heroId: p.heroId, bot: p.bot,
        hp: p.hp, defense: p.defense, burn: p.burn, stun: p.stun, hypno: p.hypno,
        reduction: p.reduction, reductionTurns: p.reductionTurns, energy, skipped: p.skipped,
        battleSpellId: p.battleSpellId, spellCounters: p.spellCounters, spellCountered: p.spellCountered, spellBonus: p.spellBonus,
        woundTurns: p.woundTurns, soulDrainTurns: p.soulDrainTurns, scarTurns: p.scarTurns, cursed: p.cursed,
        flatReduction: p.flatReduction, flatReductionTurns: p.flatReductionTurns, basicBuff: p.basicBuff, soulStacks: p.soulStacks, hitBonus: p.hitBonus,
        damageMultiplier: p.damageMultiplier, multiplierTurns: p.multiplierTurns,
        damageBuff: p.damageBuff, damageBuffTurns: p.damageBuffTurns, immuneTurns: p.immuneTurns,
        ultimate: HEROES[p.heroId].ultimate ? { ready: p.ultimateReady && !skill?.isUltimate } : null,
        ready: p.ready, rematch: p.rematch,
        locked: Boolean(p.choice) || p.skipped, choice: revealed || p.id === viewerId ? p.choice : null,
        choiceType: revealed || p.id === viewerId ? p.choiceType : null,
      };
    }),
  };
}
