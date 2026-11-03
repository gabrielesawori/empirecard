import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEROES, MAX_ENERGY } from '../public/heroes.js';
import { createPlayer, createGame, joinGame, readyPlayer, selectHero, lockCard, advanceGame, publicGame, requestRematch, leaveGame, availableSkills, COUNTDOWN_MS, REVEAL_MS } from '../lib/game.mjs';

function gameWithHeroes(first = 'strom', second = 'roger') {
  const game = createGame('ABCDEF', createPlayer('a', 'Alice', first), 0);
  joinGame(game, createPlayer('b', 'Bob', second), 0);
  readyPlayer(game, 'a', 0);
  readyPlayer(game, 'b', 0);
  return game;
}
function play(game, a, b, now = 0, random = () => 0) {
  if (!game.players[0].skipped) lockCard(game, 'a', a, game.round, now);
  if (!game.players[1].skipped) lockCard(game, 'b', b, game.round, now);
  assert.equal(game.phase, 'countdown');
  advanceGame(game, now + COUNTDOWN_MS, random);
  return now + COUNTDOWN_MS + REVEAL_MS;
}

const skillIds = ['lightning', 'silent', 'ultimate'];
const rivalIds = ['free-fire', 'long-fire', 'bom'];
// Sword > shield, arrow > sword, shield > arrow; equal types both fail.
const winnerByPair = [[-1, 1, 0], [0, -1, 1], [1, 0, -1]];
for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
  test(`counter matrix: ${skillIds[a]} vs ${rivalIds[b]}`, () => {
    const game = gameWithHeroes();
    play(game, skillIds[a], rivalIds[b]);
    const winner = winnerByPair[a][b];
    game.lastRound.entries.forEach((entry, i) => {
      assert.equal(entry.outcome, winner === i ? 'counter' : 'countered');
      assert.equal(entry.attack > 0, winner === i);
    });
    assert.equal(game.lastRound.entries[1].passiveAttack, winner === 1 ? 0 : 5);
    assert.equal(game.players[0].energy[skillIds[a]], 2);
    assert.equal(game.players[1].energy[rivalIds[b]], 2);
  });
}

test('stats, skill numbering, and readiness follow the updated concept', () => {
  assert.deepEqual(HEROES.strom.skills.map(s => s.type), ['sword', 'arrow', 'shield']);
  assert.deepEqual(HEROES.roger.skills.map(s => s.type), ['sword', 'arrow', 'shield']);
  assert.equal(HEROES.strom.skills[0].damage[0], 10);
  assert.equal(HEROES.strom.skills[1].damage[0], 10);
  const game = createGame('ABCDEF', createPlayer('a', 'Alice', 'strom'), 0);
  assert.deepEqual([game.players[0].hp, game.players[0].defense], [160, 60]);
  readyPlayer(game, 'a', 0);
  assert.equal(game.phase, 'lobby');
  selectHero(game, 'a', 'roger', 0);
  assert.equal(game.players[0].ready, false);
  assert.deepEqual([game.players[0].hp, game.players[0].defense], [120, 20]);
  assert.deepEqual(Object.values(game.players[0].energy), [3, 3, 3]);
});

test('hidden card and energy cost cannot disclose the opponent selection before four seconds', () => {
  const game = gameWithHeroes();
  lockCard(game, 'a', 'lightning', 1, 100);
  assert.equal(game.phase, 'selecting');
  assert.equal(game.deadline, null);
  assert.equal(publicGame(game, 'b').players[0].choice, null);
  assert.equal(publicGame(game, 'a').players[0].choice, 'lightning');
  assert.equal(publicGame(game, 'a').players[0].energy.lightning, 2);
  assert.equal(publicGame(game, 'b').players[0].energy.lightning, 3);
  lockCard(game, 'b', 'bom', 1, 300);
  assert.equal(game.deadline, 4300);
  assert.equal(advanceGame(game, 4299), false);
  assert.equal(publicGame(game, 'a').players[1].choice, null);
  assert.equal(publicGame(game, 'a').players[1].energy.bom, 3);
  advanceGame(game, 4300);
  assert.equal(publicGame(game, 'a').players[1].choice, 'bom');
  assert.equal(publicGame(game, 'a').players[1].energy.bom, 2);
  assert.equal(publicGame(game, 'b').players[0].energy.lightning, 2);
});

test('invalid, duplicate, outsider, and stale-round choices are rejected', () => {
  const game = gameWithHeroes();
  assert.throws(() => lockCard(game, 'a', 'bom', 1), /tidak dimiliki/);
  assert.throws(() => lockCard(game, 'a', 'lightning', 99), /Babak sudah berubah/);
  assert.throws(() => lockCard(game, 'outsider', 'lightning', 1), /tidak ditemukan/);
  lockCard(game, 'a', 'lightning', 1, 0);
  assert.throws(() => lockCard(game, 'a', 'silent', 1), /sudah dikunci/);
  lockCard(game, 'b', 'bom', 1, 0);
  assert.throws(() => lockCard(game, 'b', 'long-fire', 1), /Babak sudah berubah/);
  assert.throws(() => selectHero(game, 'b', 'strom'), /tidak bisa diganti/);
});

test('countered Lightning gives neither damage, defense nor stun', () => {
  const game = gameWithHeroes();
  game.players[0].defense = 10;
  play(game, 'lightning', 'long-fire');
  assert.deepEqual([game.players[0].hp, game.players[0].defense], [140, 0]);
  assert.equal(game.lastRound.entries[0].attack, 0);
  assert.equal(game.lastRound.entries[0].defenseGained, 0);
  assert.equal(game.players[1].stun, 0);
});

test('Lightning restores 20 defense before passive damage, caps at 60, and cancels Bom burn', () => {
  const game = gameWithHeroes();
  game.players[0].defense = 10;
  play(game, 'lightning', 'bom');
  assert.deepEqual([game.players[0].hp, game.players[0].defense], [160, 25]);
  assert.equal(game.lastRound.entries[0].defenseGained, 20);
  assert.equal(game.players[1].defense, 10);
  assert.equal(game.players[1].stun, 1);
  assert.equal(game.players[0].burn, 0);
  const capped = gameWithHeroes();
  play(capped, 'lightning', 'bom');
  assert.equal(capped.players[0].defense, 55);
  assert.equal(capped.lastRound.entries[0].defenseGained, 0);
});

test('stun skips exactly the next selection without energy or passive and allows an unopposed attack', () => {
  const game = gameWithHeroes();
  const next = play(game, 'lightning', 'bom');
  advanceGame(game, next);
  assert.equal(game.players[1].skipped, true);
  assert.equal(publicGame(game, 'b').players[1].locked, true);
  assert.throws(() => lockCard(game, 'b', 'bom', 2, next), /stun/);
  assert.deepEqual(availableSkills(game.players[1]), []);
  const energy = { ...game.players[1].energy };
  const third = play(game, 'ultimate', null, next);
  assert.equal(game.lastRound.entries[0].outcome, 'unopposed');
  assert.equal(game.lastRound.entries[1].outcome, 'stunned');
  assert.equal(game.lastRound.entries[1].passiveAttack, 0);
  assert.equal(game.players[1].hp, 90);
  assert.deepEqual(game.players[1].energy, energy);
  assert.equal(game.players[1].stun, 0);
  advanceGame(game, third);
  assert.equal(game.players[1].skipped, false);
  assert.equal(game.phase, 'selecting');
});

test('both heroes stunned advances automatically and does not deadlock or consume energy', () => {
  const game = gameWithHeroes();
  const next = play(game, 'silent', 'long-fire');
  game.players.forEach(p => { p.stun = 1; });
  advanceGame(game, next);
  assert.equal(game.phase, 'countdown');
  const energy = game.players.map(p => ({ ...p.energy }));
  advanceGame(game, next + COUNTDOWN_MS);
  assert.deepEqual(game.lastRound.entries.map(e => e.outcome), ['stunned', 'stunned']);
  assert.deepEqual(game.players.map(p => p.energy), energy);
  assert.deepEqual(game.players.map(p => p.stun), [0, 0]);
});

test('Silent lasts three rounds including activation, persists through counters, then expires', () => {
  const game = gameWithHeroes();
  let next = play(game, 'silent', 'free-fire');
  assert.equal(game.players[0].reductionTurns, 2);
  advanceGame(game, next);
  next = play(game, 'lightning', 'long-fire', next);
  assert.equal(game.lastRound.entries[0].received, 27);
  assert.equal(game.lastRound.entries[0].prevented, 3);
  assert.equal(game.players[0].reductionTurns, 1);
  advanceGame(game, next);
  next = play(game, 'lightning', 'long-fire', next);
  assert.equal(game.lastRound.entries[0].received, 27);
  assert.equal(game.players[0].reductionTurns, 0);
  assert.equal(game.players[0].reduction, 0);
  advanceGame(game, next);
  play(game, 'lightning', 'long-fire', next);
  assert.equal(game.lastRound.entries[0].received, 30);
});

test('countered Silent does not activate; a successful second Silent refreshes without stacking', () => {
  const failed = gameWithHeroes();
  play(failed, 'silent', 'bom');
  assert.equal(failed.players[0].reductionTurns, 0);
  assert.equal(failed.lastRound.entries[0].received, 60);
  const game = gameWithHeroes();
  const next = play(game, 'silent', 'free-fire');
  advanceGame(game, next);
  play(game, 'silent', 'free-fire', next);
  assert.equal(game.players[0].reduction, 0.1);
  assert.equal(game.players[0].reductionTurns, 2);
});

test('Silent reduces old burn, rounds up damage and also persists while stunned', () => {
  const game = gameWithHeroes();
  game.players[0].burn = 3;
  game.players[0].burnDamage = 10;
  const next = play(game, 'silent', 'free-fire');
  assert.equal(game.lastRound.entries[0].burnDamage, 9);
  assert.equal(game.lastRound.entries[0].passiveReceived, 5);
  game.players[0].stun = 1;
  advanceGame(game, next);
  play(game, null, 'long-fire', next);
  assert.equal(game.lastRound.entries[0].received, 27);
  assert.equal(game.lastRound.entries[0].burnDamage, 9);
  assert.equal(game.players[0].reductionTurns, 1);
});

test('Bom burn ticks exactly three following rounds; a countered Bom does not refresh it', () => {
  const game = gameWithHeroes();
  let next = play(game, 'silent', 'bom');
  assert.equal(game.players[0].burn, 3);
  assert.equal(game.lastRound.entries[0].burnDamage, 0);
  for (const [a, b, remaining] of [['silent', 'long-fire', 2], ['ultimate', 'bom', 1], ['ultimate', 'bom', 0]]) {
    advanceGame(game, next);
    next = play(game, a, b, next);
    assert.equal(game.players[0].burn, remaining);
    assert.equal(game.lastRound.entries[0].burnDamage, 10);
  }
  advanceGame(game, next);
  play(game, 'ultimate', 'long-fire', next);
  assert.equal(game.lastRound.entries[0].burnDamage, 0);
  assert.equal(game.players[0].burnDamage, 0);
});

test('successful Bom refreshes to three rounds without stacking burn damage', () => {
  const game = gameWithHeroes();
  const next = play(game, 'silent', 'bom');
  advanceGame(game, next);
  play(game, 'silent', 'bom', next);
  assert.equal(game.lastRound.entries[0].burnDamage, 10);
  assert.equal(game.players[0].burn, 3);
  assert.equal(game.players[0].burnDamage, 10);
});

test('Roger passive triggers on equal types for both Rogers and can produce a simultaneous draw', () => {
  const game = gameWithHeroes('roger', 'roger');
  game.players.forEach(p => { p.hp = 5; p.defense = 0; });
  play(game, 'free-fire', 'free-fire');
  assert.deepEqual(game.lastRound.entries.map(e => e.attack), [0, 0]);
  assert.deepEqual(game.lastRound.entries.map(e => e.passiveAttack), [5, 5]);
  assert.deepEqual(game.players.map(p => p.hp), [0, 0]);
  assert.deepEqual(game.result, { winnerId: null, reason: 'draw' });
  assert.equal(advanceGame(game, 999999), false);
});

test('passive damage still lands when its owner is defeated in the same resolution', () => {
  const game = gameWithHeroes();
  game.players[0].hp = 5;
  game.players[0].defense = 0;
  game.players[1].hp = 1;
  game.players[1].defense = 0;
  play(game, 'ultimate', 'long-fire');
  assert.deepEqual(game.players.map(p => p.hp), [0, 0]);
  assert.equal(game.result.reason, 'draw');
});

test('energy bans after three uses even when countered, then refills all skills after nine uses', () => {
  const game = gameWithHeroes('strom', 'strom');
  let next = 0;
  for (let skillIndex = 0; skillIndex < skillIds.length; skillIndex++) {
    const id = skillIds[skillIndex];
    for (let use = 0; use < MAX_ENERGY; use++) {
      next = play(game, id, id, next);
      if (skillIndex === 2 && use === 2) break;
      advanceGame(game, next);
    }
    if (skillIndex < 2) {
      assert.equal(game.players[0].energy[id], 0);
      assert.throws(() => lockCard(game, 'a', id, game.round, next), /diban/);
      assert.equal(availableSkills(game.players[0]).some(s => s.id === id), false);
    }
  }
  assert.deepEqual(Object.values(game.players[0].energy), [3, 3, 3]);
  assert.deepEqual(Object.values(game.players[1].energy), [3, 3, 3]);
  assert.equal(game.lastRound.entries[0].energyRefilled, true);
  assert.equal(game.players[0].hp, 160);
});

test('Hypno redirects a successful counter to self, leaves opponent untouched, and expires', () => {
  const game = gameWithHeroes();
  game.players[0].hypno = 1;
  const next = play(game, 'ultimate', 'long-fire');
  assert.equal(game.lastRound.entries[0].reflected, true);
  assert.equal(game.lastRound.entries[0].reflectedDamage, 40);
  assert.equal(game.players[0].defense, 15); // 40 self + 5 Roger passive.
  assert.equal(game.players[1].defense, 20);
  assert.equal(game.players[0].hypno, 0);
  advanceGame(game, next);
  play(game, 'ultimate', 'long-fire', next);
  assert.equal(game.lastRound.entries[0].reflected, false);
  assert.equal(game.players[1].hp, 100);
});

test('Hypno cannot revive a countered attack and does not redirect an unopposed skill', () => {
  const game = gameWithHeroes();
  game.players[0].hypno = 2;
  const next = play(game, 'lightning', 'long-fire');
  assert.equal(game.lastRound.entries[0].reflectedDamage, 0);
  assert.equal(game.lastRound.entries[0].attack, 0);
  game.players[1].stun = 1;
  advanceGame(game, next);
  play(game, 'ultimate', null, next);
  assert.equal(game.lastRound.entries[0].outcome, 'unopposed');
  assert.equal(game.lastRound.entries[0].reflected, false);
  assert.equal(game.players[1].hp, 100);
});

test('Ultimate keeps the full 40–45 range and locks clear only after the reveal delay', () => {
  const game = gameWithHeroes();
  const next = play(game, 'ultimate', 'long-fire', 0, () => 0.999);
  assert.equal(game.lastRound.entries[0].attack, 45);
  assert.equal(advanceGame(game, next - 1), false);
  assert.equal(advanceGame(game, next), true);
  assert.equal(game.round, 2);
  assert.deepEqual(game.players.map(p => p.choice), [null, null]);
  play(game, 'ultimate', 'long-fire', next, () => 0);
  assert.equal(game.lastRound.entries[0].attack, 40);
});

test('mutual rematch resets energy, control effects, burn, reduction, HP and history', () => {
  const game = gameWithHeroes();
  game.players[1].hp = 1;
  game.players[1].defense = 0;
  play(game, 'ultimate', 'long-fire');
  assert.equal(game.result.winnerId, 'a');
  game.players[0].burn = 2;
  game.players[0].hypno = 2;
  game.players[0].stun = 1;
  requestRematch(game, 'a', 5000);
  assert.equal(game.phase, 'finished');
  requestRematch(game, 'b', 5000);
  assert.equal(game.phase, 'lobby');
  assert.equal(game.round, 0);
  assert.equal(game.history.length, 0);
  assert.deepEqual(game.players.map(p => [p.hp, p.defense, p.burn, p.stun, p.hypno, p.reductionTurns, p.choice]), [[160, 60, 0, 0, 0, 0, null], [120, 20, 0, 0, 0, 0, null]]);
  game.players.forEach(p => assert.deepEqual(Object.values(p.energy), [3, 3, 3]));
  readyPlayer(game, 'a', 6000);
  readyPlayer(game, 'b', 6000);
  assert.equal(game.phase, 'selecting');
  assert.equal(game.round, 1);
});

test('forfeit preserves card secrecy and full rooms reject a third player', () => {
  const game = gameWithHeroes();
  assert.throws(() => joinGame(game, createPlayer('c', 'Third', 'strom')), /penuh/);
  lockCard(game, 'a', 'ultimate', 1, 0);
  leaveGame(game, 'b', 10);
  assert.deepEqual(game.result, { winnerId: 'a', reason: 'forfeit' });
  assert.equal(publicGame(game, 'b').players[0].choice, null);
  assert.equal(publicGame(game, 'b').players[0].energy.ultimate, 3);
});

test('hero catalog cannot be accessed through prototype properties', () => {
  assert.throws(() => createPlayer('a', 'Test', '__proto__'), /Hero tidak tersedia/);
});
