import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEROES, SKILL_TYPES } from '../public/heroes.js';
import { createPlayer, createGame, joinGame, readyPlayer, lockCard, advanceGame, publicGame, requestRematch, availableSkills } from '../lib/game.mjs';

function duel(rival = 'kristina') {
  const game = createGame('KRIS23', createPlayer('a', 'Kristina', 'kristina'), 0);
  joinGame(game, createPlayer('b', 'Rival', rival), 0);
  readyPlayer(game, 'a', 0);
  readyPlayer(game, 'b', 0);
  return game;
}
function play(game, a, b, type = null, rivalType = null) {
  const now = game.updatedAt + 1;
  if (!game.players[0].skipped) lockCard(game, 'a', a, game.round, now, type);
  if (!game.players[1].skipped) lockCard(game, 'b', b, game.round, now, rivalType);
  assert.equal(game.phase, 'countdown');
  advanceGame(game, game.deadline, () => 0);
  return game.lastRound.entries;
}
function next(game) {
  assert.equal(game.phase, 'reveal');
  advanceGame(game, game.deadline);
}

test('Kristina has three numbered types, her own assets, and a separate Execute card', () => {
  const p = createPlayer('a', 'Kristina', 'kristina');
  assert.deepEqual([p.hp, p.defense], [130, 40]);
  assert.deepEqual(HEROES.kristina.skills.map(s => s.type), ['sword', 'arrow', 'shield']);
  assert.deepEqual(Object.values(p.energy), [3, 3, 3]);
  assert.equal(p.ultimateReady, false);
  assert.equal(HEROES.kristina.ultimate.id, 'execute');
  assert.ok(HEROES.kristina.image.includes('/KRISTINA/'));
});

test('Shadow Burst deals 40 then buffs three following rounds, including a failed sweep', () => {
  const g = duel();
  g.players[1].hp = 300; // Keep the target alive while checking all three buff rounds.
  assert.equal(play(g, 'shadow-burst', 'fly-over')[0].attack, 40);
  assert.equal(g.players[0].damageBuffTurns, 3);
  next(g);
  assert.equal(play(g, 'fly-over', 'dust')[0].attack, 50);
  assert.equal(g.players[0].damageBuffTurns, 2);
  next(g);
  assert.equal(play(g, 'dust', 'dust')[0].attack, 0);
  assert.equal(g.players[0].damageBuffTurns, 1);
  next(g);
  assert.equal(play(g, 'fly-over', 'dust')[0].attack, 50);
  assert.equal(g.players[0].damageBuffTurns, 0);
  next(g);
  assert.equal(play(g, 'shadow-burst', 'fly-over')[0].attack, 40);
});

test('Shadow Burst refreshes without stacking, while a countered one grants no buff', () => {
  const g = duel();
  play(g, 'shadow-burst', 'fly-over');
  next(g);
  assert.equal(play(g, 'shadow-burst', 'fly-over')[0].attack, 50);
  assert.deepEqual([g.players[0].damageBuff, g.players[0].damageBuffTurns], [10, 3]);
  const failed = duel();
  play(failed, 'shadow-burst', 'dust');
  assert.equal(failed.players[0].damageBuffTurns, 0);
});

test('Dust blocks passive and old burn immediately, all damage next round, then expires', () => {
  const g = duel('roger');
  g.players[0].burn = 2;
  g.players[0].burnDamage = 10;
  const first = play(g, 'dust', 'free-fire')[0];
  assert.equal(first.prevented, 15);
  assert.equal(first.burnDamage, 0);
  assert.equal(g.players[0].immuneTurns, 1);
  assert.equal(publicGame(g, 'a').players[0].immuneTurns, 1);
  next(g);
  play(g, 'dust', 'bom');
  assert.deepEqual([g.players[0].hp, g.players[0].defense, g.players[0].burn, g.players[0].immuneTurns], [130, 40, 0, 0]);
  next(g);
  play(g, 'dust', 'bom');
  assert.deepEqual([g.players[0].hp, g.players[0].defense, g.players[0].burn], [110, 0, 3]);
});

test('immunity blocks new stun and expires before the following unprotected attack', () => {
  const g = duel('strom');
  play(g, 'dust', 'lightning');
  next(g);
  play(g, 'fly-over', 'lightning');
  assert.equal(g.players[0].stun, 0);
  assert.equal(g.players[0].defense, 40);
  next(g);
  play(g, 'fly-over', 'lightning');
  assert.equal(g.players[0].stun, 1);
  assert.equal(g.players[0].defense, 30);
});

test('buff duration continues during stun and bonuses also apply to Execute', () => {
  const g = duel();
  play(g, 'shadow-burst', 'fly-over');
  g.players[0].stun = 1;
  next(g);
  play(g, null, 'dust');
  assert.equal(g.players[0].damageBuffTurns, 2);
  next(g);
  g.players[0].ultimateReady = true;
  assert.equal(play(g, 'execute', 'dust', 'shield')[0].attack, 112);
});

test('nine primary uses refill energy and charge one ultimate; locked choice stays private', () => {
  const g = duel();
  for (const skill of HEROES.kristina.skills) {
    for (let i = 0; i < 3; i++) {
      assert.equal(g.players[0].ultimateReady, false);
      play(g, skill.id, skill.id);
      next(g);
    }
  }
  assert.deepEqual(Object.values(g.players[0].energy), [3, 3, 3]);
  assert.equal(g.players[0].ultimateReady, true);
  assert.equal(g.lastRound.entries[0].ultimateActivated, true);
  assert.equal(availableSkills(g.players[0]).filter(s => s.isUltimate).length, 3);
  lockCard(g, 'a', 'execute', g.round, g.updatedAt, 'arrow');
  const mine = publicGame(g, 'a').players[0];
  const hidden = publicGame(g, 'b').players[0];
  assert.equal(mine.choiceType, 'arrow');
  assert.equal(mine.ultimate.ready, false);
  assert.equal(mine.energy.dust, 2);
  assert.equal(hidden.choice, null);
  assert.equal(hidden.choiceType, null);
  assert.equal(hidden.ultimate.ready, true);
  assert.equal(hidden.energy.dust, 3);
  lockCard(g, 'b', 'fly-over', g.round, g.updatedAt);
  advanceGame(g, g.deadline);
  assert.equal(g.players[0].ultimateReady, false);
  assert.equal(g.players[0].energy.dust, 2);
  assert.equal(publicGame(g, 'b').players[0].choiceType, 'arrow');
});

test('ultimate rejects uncharged, missing/invalid types, and exhausted energy', () => {
  const g = duel();
  assert.throws(() => lockCard(g, 'a', 'execute', 1, 0, 'sword'), /belum aktif/);
  g.players[0].ultimateReady = true;
  for (const type of [null, 'unknown', '__proto__']) assert.throws(() => lockCard(g, 'a', 'execute', 1, 0, type), /Pilih tipe/);
  g.players[0].energy.dust = 0;
  assert.throws(() => lockCard(g, 'a', 'execute', 1, 0, 'arrow'), /energi habis/);
  assert.equal(g.players[0].ultimateReady, true);
  assert.equal(g.players[0].choice, null);
});

for (const type of Object.keys(SKILL_TYPES)) for (const rival of HEROES.kristina.skills) {
  test(`Execute counter: ${type} vs ${rival.type}; one charge and one selected energy spent`, () => {
    const g = duel();
    g.players[0].ultimateReady = true;
    const entries = play(g, 'execute', rival.id, type);
    assert.equal(entries[0].outcome, SKILL_TYPES[type].counters === rival.type ? 'counter' : 'countered');
    assert.equal(entries[0].attack, SKILL_TYPES[type].counters === rival.type ? 102 : 0);
    assert.equal(g.players[0].ultimateReady, false);
    for (const skill of HEROES.kristina.skills) assert.equal(g.players[0].energy[skill.id], skill.type === type ? 2 : 3);
  });
}

test('Execute kills below 60% before damage, ignores defense, but not at exactly 60%', () => {
  for (const hp of [95, 96, 100]) {
    const g = duel('strom');
    g.players[0].ultimateReady = true;
    g.players[1].hp = hp;
    const entries = play(g, 'execute', 'ultimate', 'sword');
    assert.equal(entries[0].executed, hp < 96);
    assert.equal(g.players[1].hp, hp < 96 ? 0 : hp - 72);
    assert.equal(g.players[1].defense, hp < 96 ? 60 : 0);
  }
});

test('immunity blocks Execute damage and instant elimination; Hypno reflects it', () => {
  const immune = duel('strom');
  immune.players[0].ultimateReady = true;
  immune.players[1].hp = 44;
  immune.players[1].immuneTurns = 1;
  assert.equal(play(immune, 'execute', 'ultimate', 'sword')[0].executed, false);
  assert.deepEqual([immune.players[1].hp, immune.players[1].defense], [44, 60]);
  const reflected = duel();
  reflected.players[0].ultimateReady = true;
  reflected.players[0].hp = 35;
  reflected.players[0].hypno = 1;
  const entries = play(reflected, 'execute', 'dust', 'shield');
  assert.equal(entries[0].reflected, true);
  assert.equal(entries[0].executed, true);
  assert.deepEqual(reflected.players.map(p => p.hp), [0, 130]);
});

test('rematch resets buffs, immunity, ultimate readiness and selected type', () => {
  const g = duel('strom');
  g.players[0].ultimateReady = true;
  g.players[0].immuneTurns = 2;
  g.players[0].damageBuffTurns = 3;
  g.players[0].damageBuff = 10;
  g.players[1].hp = 44;
  play(g, 'execute', 'ultimate', 'sword');
  requestRematch(g, 'a');
  requestRematch(g, 'b');
  const p = g.players[0];
  assert.deepEqual([p.hp, p.defense, p.damageBuff, p.damageBuffTurns, p.immuneTurns, p.ultimateReady, p.choiceType], [130, 40, 0, 0, 0, false, null]);
});
