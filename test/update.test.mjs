import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { HEROES, SKILL_TYPES } from '../public/heroes.js';
import { BATTLE_SPELLS } from '../public/spells.js';
import { createPlayer, createGame, joinGame, readyPlayer, selectHero, selectSpell, lockCard, advanceGame, publicGame, requestRematch, leaveGame } from '../lib/game.mjs';

function duel(first = 'golar', second = 'golar', spell = null, rivalSpell = null) {
  const game = createGame('NEW234', createPlayer('a', 'A', first, false, spell), 0);
  joinGame(game, createPlayer('b', 'B', second, false, rivalSpell), 0);
  readyPlayer(game, 'a', 0); readyPlayer(game, 'b', 0);
  return game;
}
function play(game, first, second, type = 'sword', rivalType = 'sword') {
  const now = game.updatedAt + 1;
  if (!game.players[0].skipped) lockCard(game, 'a', first, game.round, now, type);
  if (!game.players[1].skipped) lockCard(game, 'b', second, game.round, now, rivalType);
  assert.equal(game.phase, 'countdown');
  advanceGame(game, game.deadline, () => 0);
  return game.lastRound.entries;
}
function next(game) { assert.equal(game.phase, 'reveal'); advanceGame(game, game.deadline); }

const stats = { strom: [160, 60], roger: [120, 20], kristina: [130, 40], golar: [190, 60], warfet: [50, 150], nextland: [170, 30], rafel: [100, 100], quexyana: [100, 70] };
test('all eight heroes and six spells have real supplied assets and current attributes', async () => {
  assert.deepEqual(Object.keys(HEROES), Object.keys(stats));
  assert.equal(Object.keys(BATTLE_SPELLS).length, 6);
  for (const hero of Object.values(HEROES)) {
    assert.deepEqual([hero.hp, hero.defense], stats[hero.id]);
    assert.deepEqual(hero.skills.map(s => s.type), Object.keys(SKILL_TYPES));
    for (const image of [hero.image, ...hero.skills.map(s => s.image), hero.ultimate.image]) assert.ok((await stat(new URL(`..${image}`, import.meta.url))).size > 0, image);
  }
  for (const spell of Object.values(BATTLE_SPELLS)) assert.ok((await stat(new URL(`..${spell.image}`, import.meta.url))).size > 0);
});

for (const hero of Object.values(HEROES)) test(`${hero.name}: nine uses charge ultimate, failed ultimate still consumes charge and chosen energy`, () => {
  const g = duel(hero.id, hero.id);
  for (const skill of hero.skills) for (let use = 0; use < 3; use++) {
    play(g, skill.id, skill.id);
    next(g);
  }
  assert.ok(g.players.every(p => p.ultimateReady));
  assert.deepEqual(Object.values(g.players[0].energy), [3, 3, 3]);
  play(g, hero.ultimate.id, hero.skills[0].id);
  assert.equal(g.lastRound.entries[0].outcome, 'countered');
  assert.equal(g.players[0].ultimateReady, false);
  assert.equal(g.players[0].energy[hero.skills[0].id], 2);
});

test('Super Buff lasts indefinitely, does not stack, and excludes special ultimate', () => {
  const g = duel('strom');
  g.players[0].ultimateReady = true;
  play(g, 'super-buff', 'analysis-system');
  assert.equal(g.players[0].basicBuff, 30);
  next(g);
  assert.equal(play(g, 'silent', 'deadly-slash')[0].attack, 40);
  next(g);
  g.players[0].ultimateReady = true;
  assert.equal(play(g, 'super-buff', 'analysis-system')[0].attack, 25);
  assert.equal(g.players[0].basicBuff, 30);
  next(g);
  assert.equal(play(g, 'ultimate', 'mark')[0].attack, 70);
});

test('Time Boom deals 150 and always pays 40 direct HP even when countered or immune', () => {
  for (const rivalSkill of ['analysis-system', 'mark', 'deadly-slash']) {
    const g = duel('roger');
    g.players[0].ultimateReady = true;
    g.players[0].immuneTurns = 1;
    const entries = play(g, 'time-boom', rivalSkill);
    assert.equal(g.players[0].hp, 80);
    assert.equal(g.players[0].defense, 20);
    assert.equal(entries[0].hpCost, 40);
    assert.equal(entries[0].attack, rivalSkill === 'analysis-system' ? 150 : 0);
  }
});

test('Time Boom sacrifice and opponent knockout resolve as a draw without resurrection', () => {
  const g = duel('roger', 'golar', 'healing');
  g.round = 3; g.players[0].hp = 40; g.players[0].ultimateReady = true;
  g.players[1].hp = 80; g.players[1].defense = 0;
  play(g, 'time-boom', 'analysis-system');
  assert.equal(g.result.reason, 'draw');
  assert.equal(g.lastRound.entries[0].spellHealed, 0);
});

test('Fly Over pierces HP and drains 38% of remaining defense, blocked by immunity', () => {
  for (const immune of [false, true]) {
    const g = duel('kristina');
    if (immune) g.players[1].immuneTurns = 1;
    play(g, 'fly-over', 'mark');
    assert.deepEqual([g.players[1].hp, g.players[1].defense], immune ? [190, 60] : [150, 37]);
    assert.equal(g.lastRound.entries[1].defenseDrained, immune ? 0 : 23);
  }
});

test('Golar Luka starts next round, bypasses defense, and expires after two ticks', () => {
  const g = duel();
  play(g, 'deadly-slash', 'analysis-system');
  assert.deepEqual([g.players[1].hp, g.players[1].defense, g.players[1].woundTurns], [190, 40, 2]);
  for (const [skill, hp, turns] of [['mark', 180, 1], ['analysis-system', 170, 0], ['mark', 170, 0]]) {
    next(g); play(g, skill, skill);
    assert.deepEqual([g.players[1].hp, g.players[1].defense, g.players[1].woundTurns], [hp, 40, turns]);
  }
});

test('Golar Mark buffs all attacks including Laser; Analysis reduces damage for three rounds', () => {
  const g = duel();
  play(g, 'mark', 'deadly-slash'); next(g);
  g.players[0].ultimateReady = true;
  assert.equal(play(g, 'laser', 'analysis-system')[0].attack, 60);
  assert.equal(g.players[1].burn, 7);
  const reduced = duel();
  play(reduced, 'analysis-system', 'mark');
  assert.equal(reduced.players[0].reductionTurns, 2);
  next(reduced); play(reduced, 'analysis-system', 'deadly-slash');
  assert.equal(reduced.lastRound.entries[0].received, 16);
  assert.equal(reduced.players[0].reductionTurns, 1);
});

test('Laser burn ticks exactly seven following rounds', () => {
  const g = duel();
  g.players[0].ultimateReady = true;
  play(g, 'laser', 'analysis-system');
  g.players[1].energy = { ...g.players[0].energy }; // Align costs to isolate burn duration.
  for (let round = 0; round < 8; round++) {
    next(g);
    const skill = HEROES.golar.skills.find(s => g.players[0].energy[s.id] > 0 && g.players[1].energy[s.id] > 0);
    play(g, skill.id, skill.id);
    assert.equal(g.lastRound.entries[1].burnDamage, round < 7 ? 10 : 0);
    assert.equal(g.players[1].burn, Math.max(0, 6 - round));
  }
});

test('Soul Thief drains HP next round, accumulates healing stacks, and Soul User respects HP cap', () => {
  const g = duel('warfet');
  play(g, 'soul-thief', 'deadly-slash');
  assert.equal(g.players[0].soulStacks, 1);
  assert.deepEqual([g.players[1].hp, g.players[1].defense], [190, 30]);
  next(g);
  g.players[0].hp = 20;
  play(g, 'soul-user', 'mark');
  assert.deepEqual([g.players[0].hp, g.players[0].soulStacks], [40, 1]);
  assert.deepEqual([g.players[1].hp, g.players[1].defense], [170, 30]);
  next(g); play(g, 'soul-user', 'mark');
  assert.equal(g.players[0].hp, 50);
  assert.equal(g.lastRound.entries[0].healed, 10);
  assert.equal(g.players[1].soulDrainTurns, 0);
});

test('Soul Lock stuns next round and a missed Soul Thief does not add stacks', () => {
  const g = duel('warfet');
  play(g, 'soul-thief', 'analysis-system');
  assert.equal(g.players[0].soulStacks, 0);
  assert.equal(g.players[1].soulDrainTurns, 0);
  next(g); play(g, 'soul-lock', 'analysis-system');
  assert.equal(g.players[1].stun, 1);
  next(g); assert.equal(g.players[1].skipped, true);
});

test('Curse persists, bypasses defense, is blocked but not removed by temporary immunity', () => {
  const g = duel('warfet');
  g.players[0].ultimateReady = true;
  play(g, 'curser-of-souls', 'analysis-system');
  assert.equal(g.players[1].cursed, true);
  for (let round = 0; round < 5; round++) {
    next(g);
    if (round === 2) g.players[1].immuneTurns = 1;
    const index = round < 3 ? 1 : 2;
    play(g, HEROES.warfet.skills[index].id, HEROES.golar.skills[index].id);
    assert.equal(g.lastRound.entries[1].dotDamage, round === 2 ? 0 : 10);
    assert.equal(g.players[1].cursed, true);
    assert.equal(g.players[1].defense, 55);
  }
  assert.equal(g.players[1].hp, 150);
});

test('Blood Thirst stacks on hits, applies to ultimate, but does not stack on immune or failed attacks', () => {
  const g = duel('nextland');
  assert.equal(play(g, 'wind-slasher', 'analysis-system')[0].attack, 40);
  assert.equal(g.players[0].hitBonus, 5);
  next(g); g.players[1].immuneTurns = 1;
  assert.equal(play(g, 'wind-slasher', 'analysis-system')[0].attack, 45);
  assert.equal(g.players[0].hitBonus, 5);
  next(g); g.players[0].ultimateReady = true;
  assert.equal(play(g, 'shadow-of-a-killer', 'analysis-system')[0].attack, 75);
  assert.equal(g.players[0].hitBonus, 10);
  next(g); play(g, 'critical-hit', 'mark');
  assert.equal(g.players[0].hitBonus, 10);
});

test('Scar damages DEF first for two next rounds; Shadow subtracts 30 without negative damage', () => {
  const g = duel('nextland');
  play(g, 'critical-hit', 'deadly-slash');
  assert.equal(g.players[1].scarTurns, 2);
  next(g); play(g, 'critical-hit', 'mark');
  assert.equal(g.lastRound.entries[1].dotDamage, 10);
  assert.equal(g.players[1].defense, 20);
  next(g); play(g, 'shadow', 'mark');
  assert.equal(g.players[0].flatReductionTurns, 2);
  assert.equal(g.players[1].scarTurns, 0);
  next(g); play(g, 'shadow', 'deadly-slash');
  assert.equal(g.lastRound.entries[0].received, 0);
  assert.equal(g.lastRound.entries[0].prevented, 20);
  assert.equal(g.players[0].flatReductionTurns, 1);
});

test('Rafel doubles primary damage for three following rounds; ultimate destroys DEF first', () => {
  const g = duel('rafel');
  assert.equal(play(g, 'fighter-spirit', 'mark')[0].attack, 2);
  assert.equal(g.players[0].multiplierTurns, 3);
  next(g);
  assert.equal(play(g, 'chain-blade', 'deadly-slash')[0].attack, 60);
  next(g); g.players[0].ultimateReady = true;
  const entries = play(g, 'twin-chain-blades', 'analysis-system');
  assert.equal(entries[0].attack, 60);
  assert.equal(g.players[0].multiplierTurns, 1);
  const fresh = duel('rafel');
  fresh.players[0].ultimateReady = true;
  play(fresh, 'twin-chain-blades', 'analysis-system');
  assert.deepEqual([fresh.players[1].hp, fresh.players[1].defense], [130, 0]);
  assert.equal(fresh.lastRound.entries[1].defenseDrained, 60);
});

test('Technology Shield reflects a countering skill once, while status effects still land', () => {
  const g = duel('quexyana', 'strom');
  const entries = play(g, 'technology-shield', 'lightning');
  assert.equal(entries[0].shieldReflected, true);
  assert.equal(entries[1].reflectedDamage, 10);
  assert.deepEqual([g.players[0].hp, g.players[0].defense, g.players[0].stun], [100, 70, 1]);
  assert.equal(g.players[1].defense, 50);
  const same = duel('quexyana', 'quexyana');
  play(same, 'technology-shield', 'technology-shield');
  assert.equal(same.lastRound.entries[0].shieldReflected, false);
  assert.equal(same.players[0].defense, 70);
});

test('Quexyana burn uses 5 damage; Crushing Technology deals 90', () => {
  const g = duel('quexyana');
  play(g, 'burning-laser', 'analysis-system');
  assert.equal(g.players[1].burnDamage, 5);
  next(g); g.players[0].ultimateReady = true;
  const e = play(g, 'crushing-technology', 'analysis-system');
  assert.equal(e[0].attack, 90);
  assert.equal(e[1].burnDamage, 5);
});

test('spell selection validates identifiers, resets ready, preserves hero, and cannot change mid-duel', () => {
  const player = createPlayer('a', 'A', 'golar', false, 'armor');
  const g = createGame('SPELL2', player, 0);
  readyPlayer(g, 'a', 0);
  selectSpell(g, 'a', 'dodge', 0);
  assert.equal(player.ready, false);
  selectHero(g, 'a', 'nextland', 0);
  assert.equal(player.battleSpellId, 'dodge');
  for (const invalid of ['bad', '__proto__', {}, ['armor']]) assert.throws(() => selectSpell(g, 'a', invalid), /tidak tersedia/);
  joinGame(g, createPlayer('b', 'B', 'golar'), 0);
  readyPlayer(g, 'a', 0); readyPlayer(g, 'b', 0);
  assert.throws(() => selectSpell(g, 'a', 'armor'), /saat duel/);
  assert.equal(publicGame(g, 'b').players[0].battleSpellId, 'dodge');
});

test('Retribution stacks +5 after each actual counter, excludes ties and unopposed attacks', () => {
  const g = duel('golar', 'golar', 'retribution');
  play(g, 'mark', 'deadly-slash');
  assert.equal(g.players[0].spellBonus, 5);
  next(g); assert.equal(play(g, 'mark', 'deadly-slash')[0].attack, 30); // 5 base +20 Mark +5 spell
  assert.equal(g.players[0].spellBonus, 10);
  next(g); play(g, 'mark', 'mark');
  assert.equal(g.players[0].spellBonus, 10);
  g.players[1].stun = 1; next(g); play(g, 'analysis-system', null);
  assert.equal(g.players[0].spellBonus, 10);
  assert.equal(g.players[0].spellCounters, 2);
});

test('Inspire triggers on each third successful counter, after adding damage buffs', () => {
  const g = duel('golar', 'golar', 'inspire');
  const damage = [];
  for (let i = 0; i < 3; i++) {
    damage.push(play(g, 'mark', 'deadly-slash')[0].attack);
    if (i < 2) next(g);
  }
  assert.deepEqual(damage, [5, 25, 75]);
  assert.equal(g.lastRound.entries[0].inspired, true);
  assert.equal(g.players[0].spellCounters, 3);
});

test('Dodge third lost counter blocks damage and new effects, but old burn continues', () => {
  const g = duel('golar', 'golar', 'dodge');
  for (let i = 0; i < 3; i++) {
    if (i === 2) { g.players[0].burn = 1; g.players[0].burnDamage = 10; g.players[0].woundTurns = 0; }
    play(g, 'analysis-system', 'deadly-slash');
    if (i < 2) next(g);
  }
  const e = g.lastRound.entries[0];
  assert.equal(e.dodged, true);
  assert.equal(e.received, 0);
  assert.equal(e.burnDamage, 10);
  assert.equal(g.players[0].woundTurns, 0);
  assert.equal(g.players[0].spellCountered, 3);
});

test('Dodge and Armor do not count equal types or stunned turns', () => {
  for (const spell of ['dodge', 'armor']) {
    const g = duel('golar', 'golar', spell);
    play(g, 'mark', 'mark');
    assert.equal(g.players[0].spellCountered, 0);
    g.players[0].stun = 1; next(g); play(g, null, 'deadly-slash');
    assert.equal(g.lastRound.entries[0].received, 20);
    assert.equal(g.players[0].spellCountered, 0);
  }
});

test('Armor reduces only the countering skill, not old damage over time', () => {
  const g = duel('golar', 'golar', 'armor');
  g.players[0].burn = 1; g.players[0].burnDamage = 10;
  play(g, 'analysis-system', 'deadly-slash');
  assert.equal(g.lastRound.entries[0].received, 5);
  assert.equal(g.lastRound.entries[0].burnDamage, 10);
  assert.equal(g.lastRound.entries[0].prevented, 15);
});

test('Healing ticks every third round, caps at maximum HP, and never resurrects', () => {
  const g = duel('golar', 'golar', 'healing');
  g.players[0].hp = 170;
  for (let i = 0; i < 3; i++) {
    play(g, 'mark', 'mark');
    assert.equal(g.players[0].hp, i === 2 ? 190 : 170);
    if (i < 2) next(g);
  }
  assert.equal(g.lastRound.entries[0].spellHealed, 20);
  const dead = duel('golar', 'golar', 'healing');
  dead.round = 3; dead.players[0].hp = 10; dead.players[0].defense = 0;
  play(dead, 'analysis-system', 'deadly-slash');
  assert.equal(dead.players[0].hp, 0);
  assert.equal(dead.lastRound.entries[0].spellHealed, 0);
});

test('Execute spell includes exactly 30%, works on failed skills, and precedes Healing', () => {
  for (const hp of [57, 58]) {
    const g = duel('golar', 'golar', 'execute', 'healing');
    g.round = 3; g.players[1].hp = hp;
    play(g, 'mark', 'mark');
    assert.equal(g.players[1].hp, hp === 57 ? 0 : 88);
    assert.equal(g.lastRound.entries[0].spellExecuted, hp === 57);
  }
  const immune = duel('golar', 'golar', 'execute');
  immune.players[1].hp = 38; immune.players[1].immuneTurns = 1;
  play(immune, 'mark', 'mark');
  assert.equal(immune.players[1].hp, 38);
});

test('Execute spells resolve simultaneously and all new effects reset on rematch', () => {
  const g = duel('golar', 'golar', 'execute', 'execute');
  g.players.forEach(p => { p.hp = 38; p.hitBonus = 10; p.spellBonus = 5; p.soulStacks = 2; p.cursed = true; });
  play(g, 'mark', 'mark');
  assert.deepEqual(g.result, { winnerId: null, reason: 'draw' });
  requestRematch(g, 'a'); requestRematch(g, 'b');
  g.players.forEach(p => {
    assert.equal(p.battleSpellId, 'execute');
    assert.deepEqual([p.hp, p.defense, p.hitBonus, p.spellBonus, p.soulStacks, p.cursed, p.spellCounters, p.spellCountered], [190, 60, 0, 0, 0, false, 0, 0]);
  });
});

test('new loadout snapshots keep locked skill and spell counters private until reveal', () => {
  const g = duel('nextland', 'warfet', 'retribution', 'dodge');
  lockCard(g, 'a', 'critical-hit', 1, 0);
  const hidden = publicGame(g, 'b').players[0];
  assert.equal(hidden.choice, null);
  assert.equal(hidden.energy['critical-hit'], 3);
  assert.equal(hidden.spellBonus, 0);
  assert.equal(hidden.hitBonus, 0);
  leaveGame(g, 'b', 0);
  assert.equal(publicGame(g, 'b').players[0].choice, null);
});

test('mixed hero/spell duels keep HP, DEF, energy, timers and snapshots valid across 64 matchups', async () => {
  const { availableSkills } = await import('../lib/game.mjs');
  const ids = Object.keys(HEROES), spells = Object.keys(BATTLE_SPELLS);
  let seed = 74125;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let first = 0; first < ids.length; first++) for (let second = 0; second < ids.length; second++) {
    const g = duel(ids[first], ids[second], spells[(first + second) % 6], spells[(first * 2 + second) % 6]);
    for (let round = 0; round < 40 && g.phase !== 'finished'; round++) {
      for (const player of g.players) {
        if (player.skipped) continue;
        const choices = availableSkills(player);
        assert.ok(choices.length > 0);
        const skill = choices[Math.floor(random() * choices.length)];
        lockCard(g, player.id, skill.id, g.round, g.updatedAt, skill.type);
      }
      assert.equal(g.phase, 'countdown');
      for (const viewer of g.players) assert.equal(publicGame(g, viewer.id).players.find(p => p.id !== viewer.id).choice, null);
      advanceGame(g, g.deadline, random);
      for (const player of g.players) {
        assert.ok(Number.isInteger(player.hp) && player.hp >= 0 && player.hp <= HEROES[player.heroId].hp);
        assert.ok(Number.isInteger(player.defense) && player.defense >= 0 && player.defense <= HEROES[player.heroId].defense);
        assert.ok(Object.values(player.energy).every(n => Number.isInteger(n) && n >= 0 && n <= 3));
        assert.ok(Object.values(player.energy).some(n => n > 0));
      }
      assert.deepEqual(publicGame(g, 'a').players, publicGame(g, 'b').players);
      if (g.phase === 'reveal') next(g);
    }
  }
});
