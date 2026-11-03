import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createPlayer, joinGame, readyPlayer, lockCard, advanceGame, requestRematch, selectHero, selectSpell, leaveGame, publicGame } from '../lib/game.mjs';

function fixture(bestOf = 3) {
  const game = createGame('SERIES', createPlayer('a', 'Alice', 'strom'), 0, bestOf, 'ranked');
  joinGame(game, createPlayer('b', 'Bob', 'roger'), 0);
  return game;
}
function win(game, winner = 'a') {
  for (const player of game.players) { selectHero(game, player.id, 'strom', 0); readyPlayer(game, player.id, 0); }
  const loser = game.players.find(p => p.id !== winner);
  loser.hp = 1; loser.defense = 0;
  lockCard(game, winner, 'ultimate', 1, 0);
  lockCard(game, loser.id, 'silent', 1, 0);
  advanceGame(game, 4000, () => 0);
  assert.equal(game.phase, 'finished');
  assert.equal(game.result.winnerId, winner);
}
function next(game) { requestRematch(game, 'a', 5000); requestRematch(game, 'b', 5000); }

for (const bestOf of [1, 3, 5]) test(`best of ${bestOf} ends early at ${Math.floor(bestOf / 2) + 1} wins and starts a fresh series only by mutual consent`, () => {
  const game = fixture(bestOf), id = game.series.id, target = Math.floor(bestOf / 2) + 1;
  for (let i = 1; i <= target; i++) {
    win(game);
    assert.equal(game.series.scores.a, i);
    assert.equal(game.series.match, i);
    assert.equal(game.series.finished, i === target);
    if (i < target) { next(game); assert.equal(game.phase, 'lobby'); assert.equal(game.series.id, id); }
  }
  assert.equal(game.series.winnerId, 'a');
  assert.equal(game.series.matches.length, target);
  requestRematch(game, 'a');
  assert.equal(game.phase, 'finished');
  requestRematch(game, 'b');
  assert.equal(game.phase, 'lobby');
  assert.notEqual(game.series.id, id);
  assert.equal(game.series.bestOf, bestOf);
  assert.deepEqual(game.series.scores, {});
  assert.equal(game.series.match, 1);
});

test('a deciding fifth match is possible; match winners and series winner are distinct', () => {
  const game = fixture(5);
  for (const [i, winner] of ['a', 'b', 'a', 'b', 'b'].entries()) {
    win(game, winner);
    if (i < 4) { assert.equal(game.series.finished, false); next(game); }
  }
  assert.equal(game.series.winnerId, 'b');
  assert.deepEqual(game.series.scores, { a: 2, b: 3 });
});

test('intermission requires both players, allows new loadouts, and preserves account binding and scores', () => {
  const game = fixture(); game.players[0].accountId = 'private-id';
  win(game);
  requestRematch(game, 'a');
  assert.throws(() => selectHero(game, 'a', 'kristina'), /duel/);
  requestRematch(game, 'b');
  assert.equal(game.round, 0);
  assert.ok(game.players.every(p => !p.ready));
  selectHero(game, 'a', 'kristina'); selectSpell(game, 'a', 'armor');
  readyPlayer(game, 'a');
  assert.equal(game.phase, 'lobby');
  readyPlayer(game, 'b');
  assert.equal(game.players[0].accountId, 'private-id');
  assert.equal(game.players[0].heroId, 'kristina');
  assert.equal(game.players[0].battleSpellId, 'armor');
  assert.equal(game.players[0].hp, 130);
  assert.equal(game.series.scores.a, 1);
  assert.equal('accountId' in publicGame(game, 'b').players[0], false);
});

test('a draw earns no win and replays even in best of one', () => {
  const game = fixture(1);
  readyPlayer(game, 'a'); readyPlayer(game, 'b');
  for (const p of game.players) { p.hp = 1; p.defense = 0; p.cursed = true; }
  lockCard(game, 'a', 'silent', 1, 0); lockCard(game, 'b', 'long-fire', 1, 0);
  advanceGame(game, 4000);
  assert.equal(game.result.reason, 'draw');
  assert.equal(game.series.finished, false);
  assert.deepEqual(game.series.scores, {});
  next(game); win(game, 'b');
  assert.equal(game.series.finished, true);
  assert.equal(game.series.match, 2);
});

for (const stage of ['results', 'intermission', 'playing']) test(`leaving during ${stage} forfeits the unfinished series, regardless of score`, () => {
  const game = fixture(5); win(game);
  if (stage !== 'results') next(game);
  if (stage === 'playing') { readyPlayer(game, 'a'); readyPlayer(game, 'b'); lockCard(game, 'a', 'silent', 1); }
  leaveGame(game, 'a');
  assert.equal(game.series.finished, true);
  assert.equal(game.series.winnerId, 'b');
  assert.equal(game.result.reason, 'forfeit');
  assert.equal(publicGame(game, 'b').players[0].choice, null);
  assert.throws(() => requestRematch(game, 'b'), /keluar/);
});

test('leaving an untouched lobby gives no series win and invalid format/mode are rejected', () => {
  const game = fixture(); leaveGame(game, 'b');
  assert.equal(game.players.length, 1); assert.equal(game.series.finished, false);
  for (const value of [0, 2, 4, '3', null]) assert.throws(() => fixture(value), /seri/);
  assert.throws(() => createGame('X', createPlayer('a', 'A', 'strom'), 0, 1, 'unknown'), /Mode/);
});
