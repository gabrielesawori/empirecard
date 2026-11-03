import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStore } from '../lib/store.mjs';
import { createAccounts } from '../lib/accounts.mjs';
import { rankFor } from '../public/ranks.js';
const password = 'empire-test-password';
const registration = name => ({ username: name, email: `${name}@example.test`, password });
async function users(store = createStore()) {
  const accounts = createAccounts(store);
  const a = await accounts.register(registration('Alice'));
  const b = await accounts.register(registration('Bob'));
  return { store, accounts, a: { ...a, ...(await accounts.authenticate(a.token)) }, b: { ...b, ...(await accounts.authenticate(b.token)) } };
}

test('rank boundaries follow all five divisions and God points remain uncapped', () => {
  for (const [points, label, progress] of [[0,'Bronze I',0],[9,'Bronze I',9],[10,'Bronze II',0],[49,'Bronze V',9],[50,'Elite I',0],[149,'Elite V',19],[150,'Master I',0],[349,'Master V',39],[350,'Grandmaster I',0],[749,'Grandmaster V',79],[750,'Legendary I',0],[1549,'Legendary V',159],[1550,'God',0],[99999,'God',0]]) {
    assert.equal(rankFor(points).label, label); assert.equal(rankFor(points).progress, progress);
  }
  assert.equal(rankFor(99999).points, 99999); assert.equal(rankFor(1550).required, null);
});

test('accounts persist across restart; passwords and sessions are hashed, and logout revokes sessions', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'empire-accounts-')); t.after(() => rm(dir, {recursive:true, force:true}));
  const file = path.join(dir, 'accounts.json');
  const store = createStore({file});
  const accounts = createAccounts(store);
  const first = await accounts.register(registration('Alice'));
  assert.equal(first.profile.coins, 0); assert.equal(first.profile.ownedHeroes.length, 8);
  const raw = await readFile(file, 'utf8');
  assert.equal(raw.includes(password), false); assert.equal(raw.includes(first.token), false);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  await store.close();
  const reopened = createStore({file}), again = createAccounts(reopened);
  const identity = await again.authenticate(first.token);
  assert.equal(identity.uid, first.profile.uid);
  const login = await again.login({email: 'ALICE@example.test', password}, first.token);
  assert.equal(login.profile.uid, first.profile.uid);
  await assert.rejects(again.authenticate(first.token), {status:401});
  await again.logout(login.token);
  await assert.rejects(again.authenticate(login.token), {status:401});
  await reopened.close();
});

test('invalid credentials, duplicate registration, private profile fields and session expiration', async () => {
  let now = 100;
  const store = createStore(), accounts = createAccounts(store, () => now);
  for (const patch of [{username:'x'},{email:'invalid'},{password:'short'}]) await assert.rejects(accounts.register({...registration('Alice'),...patch}), {status:400});
  const outcomes = await Promise.allSettled([accounts.register(registration('Alice')), accounts.register(registration('alice'))]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(x => x.status === 'rejected').reason.status, 409);
  const user = outcomes.find(x => x.status === 'fulfilled').value;
  for (const email of ['alice@example.test', 'absent@example.test']) await assert.rejects(accounts.login({email,password:'wrong-password'}), {status:401, message:'Email atau password salah.'});
  const profile = await accounts.authenticate(user.token);
  for (const key of ['email','passwordHash','salt']) assert.equal(key in profile, false);
  const leaders = await accounts.leaderboard();
  for (const key of ['id','email','passwordHash','salt','ownedHeroes','coins']) assert.equal(key in leaders[0], false);
  now += 7 * 86400000;
  await assert.rejects(accounts.authenticate(user.token), {status:401});
});

test('a failed transaction never replaces durable state; corrupted data is not reset', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'empire-store-')); t.after(() => rm(dir, {recursive:true, force:true}));
  const file = path.join(dir,'data.json'), store = createStore({file});
  await store.transaction(data => data.messages.push({text:'saved'}));
  await assert.rejects(store.transaction(data => { data.messages.push({text:'discard'}); throw new Error('abort'); }), /abort/);
  assert.equal((await store.read(data => data.messages)).length, 1);
  assert.equal(JSON.parse(await readFile(file,'utf8')).messages.length, 1);
  await Promise.all(Array.from({length:20}, (_,i) => store.transaction(data => data.messages.push({text:String(i)}))));
  assert.equal((await store.read(data => data.messages)).length, 21);
  await store.close(); await writeFile(file, 'broken');
  const broken = createStore({file}); await assert.rejects(broken.ready, SyntaxError);
  assert.equal(await readFile(file,'utf8'), 'broken');
});

test('friends require recipient acceptance and chats expose only public identity', async () => {
  const {accounts, a,b} = await users();
  await assert.rejects(accounts.requestFriend(a.id, a.uid), /diri sendiri/);
  await assert.rejects(accounts.friendAccount(a.id,b.uid), {status:403});
  await accounts.requestFriend(a.id, b.uid.toLowerCase());
  await assert.rejects(accounts.requestFriend(b.id, a.uid), {status:409});
  const request = (await accounts.social(b.id)).incoming[0];
  await assert.rejects(accounts.respondFriend(a.id, request.id, true), {status:404});
  await accounts.respondFriend(b.id, request.id, true);
  assert.equal((await accounts.social(a.id)).friends[0].uid, b.uid);
  assert.equal((await accounts.social(b.id)).friends[0].uid, a.uid);
  await accounts.sendGlobal(a.id, '<img src=x onerror=alert(1)>');
  const message = (await accounts.globalMessages())[0];
  assert.equal(message.name, 'Alice'); assert.equal(message.uid, a.uid); assert.equal('email' in message, false);
  await assert.rejects(accounts.sendGlobal(a.id, 'x'.repeat(241)), {status:400});
});

test('rank and records settle once per completed series, with no economy transactions or practice rewards', async () => {
  const {accounts,store,a,b} = await users();
  const game = {series:{id:'one',finished:false,winnerId:'a'}, mode:'ranked',players:[{id:'a',accountId:a.id},{id:'b',accountId:b.id}]};
  await accounts.settle(game); assert.equal((await accounts.profile(a.id)).points,0);
  game.series.finished = true;
  await Promise.all(Array.from({length:10},() => accounts.settle(game)));
  assert.equal((await accounts.profile(a.id)).points,15); assert.equal((await accounts.profile(a.id)).wins,1);
  assert.equal((await accounts.profile(b.id)).points,0); assert.equal((await accounts.profile(b.id)).losses,1);
  game.series = {id:'two',finished:true,winnerId:'b'}; await accounts.settle(game);
  assert.equal((await accounts.profile(a.id)).points,10); assert.equal((await accounts.profile(b.id)).points,15);
  game.mode = 'casual'; game.series.id = 'three'; await accounts.settle(game);
  assert.equal((await accounts.profile(b.id)).wins,2); assert.equal((await accounts.profile(b.id)).points,15);
  game.mode = 'training'; game.series.id = 'four'; await accounts.settle(game);
  assert.equal((await accounts.profile(b.id)).wins,2);
  assert.equal((await accounts.profile(a.id)).coins,0); assert.equal((await store.read(d => d.results)).length,3);
  assert.equal((await accounts.leaderboard())[0].uid,b.uid);
});
