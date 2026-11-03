import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatchAudio } from '../public/audio.js';

function fixture() {
  const memory = new Map();
  const played = [];
  const storage = { get: key => memory.get(key), set: (key, value) => memory.set(key, value), remove: key => memory.delete(key) };
  const options = { storage, play: name => played.push(name) };
  return { played, options, audio: createMatchAudio(options) };
}

function snapshot(overrides = {}) {
  return {
    code: 'ABC234', you: 'alice', phase: 'selecting', round: 1, result: null,
    players: [{ id: 'alice', locked: false, choice: null }, { id: 'bob', locked: false, choice: null }],
    ...overrides,
  };
}
const finished = (winnerId, extra = {}) => snapshot({ phase: 'finished', result: { winnerId, reason: winnerId === null ? 'draw' : 'knockout' }, ...extra });

test('each player hears only their own result, including reversed winners and bot matches', () => {
  for (const winner of ['alice', 'bob', 'bot']) {
    for (const you of ['alice', 'bob']) {
      const f = fixture();
      f.audio.observe(finished(winner, { you }));
      assert.deepEqual(f.played, [winner === you ? 'victory' : 'defeat']);
    }
  }
});

test('duplicate snapshots, reconnect, rematch requests and refresh do not replay the result', () => {
  const f = fixture();
  f.audio.observe(finished('alice'));
  f.audio.observe(finished('alice', { version: 99 }));
  f.audio.observe(finished('alice', { players: [{ id: 'alice', rematch: true }, { id: 'bob' }] }));
  const refreshed = createMatchAudio(f.options);
  refreshed.observe(finished('alice', { version: 100 }));
  assert.deepEqual(f.played, ['victory']);
});

test('a rematch in the same room rearms result audio even with the same winner and round', () => {
  const f = fixture();
  f.audio.observe(finished('alice'));
  f.audio.observe(snapshot());
  f.audio.observe(finished('alice'));
  assert.deepEqual(f.played, ['victory', 'victory']);
});

test('draws do not play either winning or losing announcements', () => {
  const f = fixture();
  f.audio.observe(finished(null));
  f.audio.observe(finished(null));
  assert.deepEqual(f.played, []);
});

test('forfeit uses the server winner, and leaving a finished game does not repeat audio', () => {
  const f = fixture();
  f.audio.observe(snapshot());
  f.audio.observe(finished('bob', { result: { winnerId: 'bob', reason: 'forfeit' } }));
  f.audio.observe(finished('bob', { result: { winnerId: 'bob', reason: 'forfeit' } }));
  f.audio.reset();
  f.audio.observe(finished('bob', { result: { winnerId: 'bob', reason: 'forfeit' } }));
  assert.deepEqual(f.played, ['defeat']);
});

test('lock audio plays once only for a confirmed local card, never for the opponent or stun', () => {
  const f = fixture();
  f.audio.observe(snapshot());
  const rivalLocked = snapshot({ players: [{ id: 'alice', locked: false }, { id: 'bob', locked: true }] });
  f.audio.observe(rivalLocked);
  assert.deepEqual(f.played, []);
  const mineLocked = snapshot({ phase: 'countdown', players: [{ id: 'alice', locked: true, choice: 'lightning' }, { id: 'bob', locked: true }] });
  f.audio.observe(mineLocked);
  f.audio.observe(mineLocked);
  f.audio.observe(snapshot({ round: 2, players: [{ id: 'alice', locked: true, skipped: true }, { id: 'bob', locked: false }] }));
  assert.deepEqual(f.played, ['lock']);
});

test('restoring an already locked card never replays the lock announcement', () => {
  const f = fixture();
  f.audio.observe(snapshot({ players: [{ id: 'alice', locked: true, choice: 'lightning' }, { id: 'bob' }] }));
  assert.deepEqual(f.played, []);
});


test('series audio identifies each match and an intermission forfeit overrides the prior match result', () => {
  const f = fixture();
  const series = { id: 'series-one', match: 1 };
  f.audio.observe(finished('alice', { series }));
  f.audio.observe(finished('bob', { series, result: { winnerId: 'bob', reason: 'forfeit' } }));
  f.audio.observe(finished('bob', { series, result: { winnerId: 'bob', reason: 'forfeit' } }));
  f.audio.observe(finished('alice', { series: { ...series, match: 2 } }));
  createMatchAudio(f.options).observe(finished('alice', { series: { ...series, match: 2 } }));
  assert.deepEqual(f.played, ['victory', 'defeat', 'victory']);
});
