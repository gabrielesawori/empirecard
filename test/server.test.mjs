import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { BATTLE_SPELLS } from '../public/spells.js';
import { HEROES } from '../public/heroes.js';

async function fixture(t) {
  let time = 10000;
  const app = createApp({ now: () => time, random: () => 0, requireAccounts: false });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { app.dispose(); await new Promise(resolve => app.server.close(resolve)); });
  async function request(route, body, token, extraHeaders = {}) {
    const res = await fetch(`${base}/api/${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  }
  return { ...app, base, request, advance(ms) { time += ms; app.tick(); } };
}

test('two clients create, join, lock secretly, reveal in sync, resume, and forfeit', async t => {
  const f = await fixture(t);
  const first = await f.request('rooms', { name: 'Alice', heroId: 'strom' });
  assert.equal(first.status, 201);
  const a = first.data;
  const second = await f.request('join', { name: 'Bob', heroId: 'roger', code: a.state.code.toLowerCase() });
  assert.equal(second.status, 200);
  const b = second.data;
  assert.notEqual(a.token, b.token);
  assert.equal((await f.request('join', { name: 'Third', heroId: 'roger', code: a.state.code })).status, 409);
  assert.equal((await f.request('state', undefined, 'fake')).status, 401);
  await f.request('ready', {}, a.token);
  const start = await f.request('ready', {}, b.token);
  assert.equal(start.data.phase, 'selecting');
  await f.request('lock', { skillId: 'lightning', round: 1 }, a.token);
  const hidden = await f.request('state', undefined, b.token);
  assert.equal(hidden.data.players[0].choice, null);
  assert.equal(hidden.data.players[0].locked, true);
  assert.equal(hidden.data.players[0].energy.lightning, 3);
  await f.request('lock', { skillId: 'bom', round: 1 }, b.token);
  f.advance(3999);
  assert.equal((await f.request('state', undefined, a.token)).data.phase, 'countdown');
  f.advance(1);
  const [sa, sb] = await Promise.all([f.request('state', undefined, a.token), f.request('state', undefined, b.token)]);
  assert.equal(sa.data.phase, 'reveal');
  assert.deepEqual(sa.data.players, sb.data.players);
  assert.equal(sa.data.players[0].hp, 160);
  assert.equal(sa.data.players[0].defense, 55);
  assert.equal(sa.data.players[1].hp, 120);
  assert.equal(sa.data.players[1].defense, 10);
  assert.equal(sa.data.players[1].stun, 1);
  assert.equal(sa.data.players[0].energy.lightning, 2);
  assert.equal('token' in sa.data.players[1], false);
  f.advance(5500);
  assert.equal((await f.request('state', undefined, a.token)).data.round, 2);
  assert.equal((await f.request('lock', { skillId: 'lightning', round: 1 }, a.token)).status, 409);
  assert.equal((await f.request('lock', { skillId: 'bom', round: 2 }, b.token)).status, 409);
  assert.equal((await f.request('lock', { skillId: 'ultimate', round: 2 }, a.token)).data.phase, 'countdown');
  f.advance(4000);
  const stunned = (await f.request('state', undefined, b.token)).data;
  assert.equal(stunned.lastRound.entries[1].outcome, 'stunned');
  assert.equal(stunned.players[1].hp, 90);
  assert.equal(stunned.players[1].energy.bom, 2);
  assert.equal(stunned.lastRound.entries[1].passiveAttack, 0);
  const left = await f.request('leave', {}, b.token);
  assert.deepEqual(left.data.result, { winnerId: a.state.you, reason: 'forfeit' });
  assert.equal((await f.request('state', undefined, b.token)).status, 401);
  const finish = (await f.request('state', undefined, a.token)).data;
  assert.equal(finish.result.reason, 'forfeit');
  assert.equal(finish.result.winnerId, a.state.you);
  assert.equal((await f.request('rematch', {}, a.token)).status, 409);
});

test('event stream sends personalized state; reconnect retains the locked card', async t => {
  const f = await fixture(t);
  const { data: a } = await f.request('rooms', { name: 'Alice', heroId: 'strom', mode: 'training' });
  const response = await fetch(`${f.base}/api/events?session=${a.token}`);
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  const reader = response.body.getReader();
  const chunk = new TextDecoder().decode((await reader.read()).value);
  assert.match(chunk, /event: state/);
  assert.match(chunk, new RegExp(`"you":"${a.state.you}"`));
  await reader.cancel();
  await f.request('ready', {}, a.token);
  await f.request('lock', { skillId: 'lightning', round: 1 }, a.token);
  const resumed = await f.request('state', undefined, a.token);
  assert.equal(resumed.data.players[0].choice, 'lightning');
  assert.equal(resumed.data.phase, 'selecting');
  f.advance(0);
  f.advance(700);
  assert.equal((await f.request('state', undefined, a.token)).data.phase, 'countdown');
  f.advance(4000);
  assert.equal((await f.request('state', undefined, a.token)).data.phase, 'reveal');
});

test('Kristina mirror duel unlocks Execute through the API while its type and energy remain private', async t => {
  const f = await fixture(t);
  const { data: a } = await f.request('rooms', { name: 'Kristina A', heroId: 'kristina' });
  const { data: b } = await f.request('join', { name: 'Kristina B', heroId: 'kristina', code: a.state.code });
  await f.request('ready', {}, a.token);
  await f.request('ready', {}, b.token);
  assert.equal((await f.request('lock', { skillId: 'execute', ultimateType: 'sword', round: 1 }, a.token)).status, 409);
  let round = 1;
  for (const skill of HEROES.kristina.skills) for (let i = 0; i < 3; i++, round++) {
    assert.equal((await f.request('lock', { skillId: skill.id, round }, a.token)).status, 200);
    await f.request('lock', { skillId: skill.id, round }, b.token);
    f.advance(4000);
    f.advance(5500);
  }
  assert.equal((await f.request('state', undefined, a.token)).data.players[0].ultimate.ready, true);
  assert.equal((await f.request('lock', { skillId: 'execute', ultimateType: 'invalid', round }, a.token)).status, 400);
  await f.request('lock', { skillId: 'execute', ultimateType: 'arrow', round }, a.token);
  const hidden = (await f.request('state', undefined, b.token)).data.players[0];
  assert.equal(hidden.choice, null);
  assert.equal(hidden.choiceType, null);
  assert.equal(hidden.energy.dust, 3);
  assert.equal(hidden.ultimate.ready, true);
  await f.request('lock', { skillId: 'shadow-burst', round }, b.token);
  f.advance(4000);
  const result = (await f.request('state', undefined, b.token)).data;
  assert.equal(result.players[0].choiceType, 'arrow');
  assert.equal(result.players[0].ultimate.ready, false);
  assert.equal(result.players[0].energy.dust, 2);
  assert.equal(result.players[1].hp, 68);
});

test('static server serves actual assets but never exposes source or allows cross-origin mutations', async t => {
  const f = await fixture(t);
  for (const route of ['/', '/styles.css', '/hub.css', '/app.js', '/interface.js', '/bgm.js', '/audio.js', '/heroes.js', '/spells.js', '/favicon.svg', '/assets/Heroes/Roger/Roger%20Hero%20card.png']) {
    const res = await fetch(`${f.base}${route}`);
    assert.equal(res.status, 200, route);
    assert.ok((await res.arrayBuffer()).byteLength > 0);
  }
  for (const [route, mime] of [['/assets/Audios/BGM.mp3', 'audio/mpeg'], ['/assets/Audios/Card%20Locked.wav', 'audio/wav'], ['/assets/Audios/Welcome%20to%20the%20empire%20card.wav', 'audio/wav'], ['/assets/Audios/ENEMI%20ELIMINATED.wav', 'audio/wav'], ['/assets/Audios/YOU%20HAVE%20BEEN%20SLAIN.wav', 'audio/wav']]) {
    const res = await fetch(`${f.base}${route}`, { method: 'HEAD' });
    assert.equal(res.status, 200, route);
    assert.equal(res.headers.get('content-type'), mime);
    assert.ok(Number(res.headers.get('content-length')) > 0);
  }
  for (const image of [...Object.values(HEROES).flatMap(hero => [hero.image, ...hero.skills.map(skill => skill.image), hero.ultimate.image]), ...Object.values(BATTLE_SPELLS).map(spell => spell.image)]) {
    const res = await fetch(`${f.base}${image}`, { method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), image.endsWith('.jpeg') ? 'image/jpeg' : 'image/png');
  }
  for (const route of ['/server.mjs', '/package.json', '/concept/hero.md', '/assets/%2e%2e%2fserver.mjs']) {
    assert.equal((await fetch(`${f.base}${route}`)).status, 404, route);
  }
  const forbidden = await f.request('rooms', { name: 'Test', heroId: 'strom' }, undefined, { Origin: 'https://unrelated.example' });
  assert.equal(forbidden.status, 403);
  assert.equal((await f.request('rooms', { name: 'Test', heroId: '__proto__' })).status, 400);
  assert.equal((await f.request('rooms', { name: '', heroId: 'strom' })).status, 400);
  assert.equal((await f.request('join', { name: 'Test', heroId: 'strom', code: 'MISSING' })).status, 404);
});

test('bot continues when the human is stunned without waiting for a forbidden human choice', async t => {
  const f = await fixture(t);
  const { data: a } = await f.request('rooms', { name: 'Roger', heroId: 'roger', mode: 'training' });
  await f.request('ready', {}, a.token);
  await f.request('lock', { skillId: 'bom', round: 1 }, a.token);
  f.advance(0);
  f.advance(700);
  f.advance(4000);
  assert.equal((await f.request('state', undefined, a.token)).data.players[0].stun, 1);
  f.advance(5500);
  const skipped = (await f.request('state', undefined, a.token)).data;
  assert.equal(skipped.players[0].skipped, true);
  assert.equal((await f.request('lock', { skillId: 'free-fire', round: 2 }, a.token)).status, 409);
  f.advance(700);
  assert.equal((await f.request('state', undefined, a.token)).data.phase, 'countdown');
  f.advance(4000);
  const revealed = (await f.request('state', undefined, a.token)).data;
  assert.equal(revealed.lastRound.entries[1].outcome, 'unopposed');
  assert.equal(revealed.lastRound.entries[0].passiveAttack, 0);
  assert.deepEqual(revealed.players[0].energy, skipped.players[0].energy);
});

test('bot excludes exhausted skills and continues with remaining energy', async t => {
  const f = await fixture(t);
  const { data: a } = await f.request('rooms', { name: 'Strom', heroId: 'strom', mode: 'training' });
  await f.request('ready', {}, a.token);
  for (let round = 1; round <= 3; round++) {
    await f.request('lock', { skillId: 'lightning', round }, a.token);
    f.advance(0);
    f.advance(700);
    f.advance(4000);
    f.advance(5500);
  }
  assert.equal((await f.request('state', undefined, a.token)).data.players[1].energy['free-fire'], 0);
  assert.equal((await f.request('lock', { skillId: 'lightning', round: 4 }, a.token)).status, 409);
  await f.request('lock', { skillId: 'ultimate', round: 4 }, a.token);
  f.advance(0);
  f.advance(700);
  f.advance(4000);
  const state = (await f.request('state', undefined, a.token)).data;
  assert.equal(state.phase, 'reveal');
  assert.equal(state.players[1].choice, 'long-fire');
});

test('battle spell loadout persists across hero change, reconnect and rematch, and rejects mid-duel changes', async t => {
  const f = await fixture(t);
  for (const battleSpellId of ['__proto__', 'bad', {}, ['armor']]) assert.equal((await f.request('rooms', { name: 'A', heroId: 'golar', battleSpellId })).status, 400);
  const { data: a } = await f.request('rooms', { name: 'A', heroId: 'golar', battleSpellId: 'retribution' });
  const { data: b } = await f.request('join', { name: 'B', heroId: 'warfet', battleSpellId: 'armor', code: a.state.code });
  await f.request('ready', {}, a.token);
  const changed = (await f.request('spell', { battleSpellId: 'inspire' }, a.token)).data;
  assert.equal(changed.players[0].battleSpellId, 'inspire');
  assert.equal(changed.players[0].ready, false);
  await f.request('hero', { heroId: 'nextland' }, a.token);
  const resumed = (await f.request('state', undefined, a.token)).data;
  assert.equal(resumed.players[0].battleSpellId, 'inspire');
  await f.request('ready', {}, a.token); await f.request('ready', {}, b.token);
  assert.equal((await f.request('spell', { battleSpellId: 'execute' }, a.token)).status, 400);
  await f.request('lock', { skillId: 'critical-hit', round: 1 }, a.token);
  const hidden = (await f.request('state', undefined, b.token)).data.players[0];
  assert.equal(hidden.choice, null);
  assert.equal(hidden.hitBonus, 0);
  await f.request('lock', { skillId: 'soul-lock', round: 1 }, b.token);
  f.advance(4000);
  const [one, two] = await Promise.all([f.request('state', undefined, a.token), f.request('state', undefined, b.token)]);
  assert.deepEqual(one.data.players, two.data.players);
  assert.equal(one.data.players[0].hitBonus, 5);
  assert.equal(one.data.players[0].spellCounters, 1);
  assert.equal(one.data.players[1].defense, 135); // 30 damage minus Armor 15.
  assert.equal(one.data.players[1].scarTurns, 2);
});
