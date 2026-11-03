import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';

async function fixture(t, options = {}) {
  let time = 10000;
  const app = createApp({...options, now:() => time, random:() => 0});
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { app.dispose(); await new Promise(resolve => app.server.close(resolve)); await app.closeStore(); });
  async function request(route, body, cookie, token, headers = {}) {
    const response = await fetch(`${base}/api/${route}`, {method: body === undefined ? 'GET' : 'POST', headers:{'Content-Type':'application/json', ...(cookie ? {Cookie:cookie}:{}), ...(token ? {Authorization:`Bearer ${token}`} : {}), ...headers}, body:body === undefined ? undefined : JSON.stringify(body)});
    return {status:response.status, data:await response.json(), cookie:response.headers.get('set-cookie')};
  }
  async function register(name) {
    const res = await request('register', {username:name, email:`${name}@example.test`, password:'empire-test-password'});
    assert.equal(res.status,200); return {profile:res.data.profile, cookie:res.cookie.split(';')[0]};
  }
  return {...app, request, register, advance(ms) {time += ms; app.tick();}};
}

test('HTTP login is required, cookies protect sessions, room tokens are account-bound, and origin checks cannot be spoofed', async t => {
  const f = await fixture(t, {publicOrigin:'https://empire.example'});
  assert.equal((await f.request('me')).data.profile, null);
  assert.equal((await f.request('rooms',{heroId:'strom'})).status,401);
  const registered = await f.request('register',{username:'Alice', email:'alice@example.test', password:'empire-test-password'});
  assert.match(registered.cookie,/HttpOnly/); assert.match(registered.cookie,/SameSite=Lax/); assert.match(registered.cookie,/Secure/);
  assert.equal('token' in registered.data,false);
  const a = {cookie:registered.cookie.split(';')[0]}, b = await f.register('Bob');
  for (const headers of [{Origin:'https://evil.example'}, {Origin:'https://evil.example','X-Forwarded-Host':'evil.example'},{'Sec-Fetch-Site':'cross-site'}]) assert.equal((await f.request('rooms',{heroId:'strom'},a.cookie,null,headers)).status,403);
  const room = await f.request('rooms',{heroId:'strom',name:'Spoofed',bestOf:3,mode:'ranked'},a.cookie);
  assert.equal(room.status,201); assert.equal(room.data.state.players[0].name,'Alice');
  const {token,state} = room.data;
  assert.equal((await f.request('state',undefined,b.cookie,token)).status,403);
  assert.equal((await f.request('state',undefined,undefined,token)).status,401);
  assert.equal((await f.request('current-room',undefined,a.cookie)).data.token,token);
  assert.equal((await f.request('current-room',undefined,b.cookie)).data.state,null);
  assert.equal('accountId' in state.players[0], false);
  assert.equal((await f.request('rooms',{heroId:'roger'},a.cookie)).status,409);
  assert.equal((await f.request('logout',{},a.cookie)).status,200);
  assert.equal((await f.request('me',undefined,a.cookie)).data.profile,null);
});

test('UID invitations join without a room code, are recipient-only, and lobby/global chats enforce limits', async t => {
  const f = await fixture(t), a = await f.register('Alice'), b = await f.register('Bob'), c = await f.register('Carol');
  await f.request('friends/request',{uid:b.profile.uid},a.cookie);
  const social = (await f.request('social',undefined,b.cookie)).data;
  assert.equal((await f.request('friends/respond',{id:social.incoming[0].id,accept:true},c.cookie)).status,404);
  await f.request('friends/respond',{id:social.incoming[0].id,accept:true},b.cookie);
  const room = (await f.request('rooms',{heroId:'strom',bestOf:3,mode:'ranked'},a.cookie)).data;
  assert.equal((await f.request('invite',{uid:c.profile.uid},a.cookie,room.token)).status,403);
  assert.equal((await f.request('invite',{uid:b.profile.uid},a.cookie,room.token)).status,200);
  const invite = (await f.request('social',undefined,b.cookie)).data.invites[0];
  assert.equal((await f.request('social',undefined,c.cookie)).data.invites.length,0);
  assert.equal((await f.request('join',{heroId:'roger',inviteId:invite.id},c.cookie)).status,404);
  const joined = await f.request('join',{heroId:'roger',inviteId:invite.id},b.cookie);
  assert.equal(joined.status,200); assert.equal(joined.data.state.code,room.state.code);
  assert.equal(joined.data.state.series.bestOf,3);
  assert.equal((await f.request('social',undefined,b.cookie)).data.invites.length,0);
  const message = '<script>alert(1)</script>';
  assert.equal((await f.request('chat',{message},a.cookie,room.token)).status,200);
  assert.equal((await f.request('state',undefined,b.cookie,joined.data.token)).data.chat[0].text,message);
  assert.equal((await f.request('chat',{message:'too fast'},a.cookie,room.token)).status,429);
  f.advance(1000);
  assert.equal((await f.request('global-chat',{message:'Halo arena'},a.cookie)).status,200);
  assert.equal((await f.request('global-chat',undefined,b.cookie)).data.messages[0].text,'Halo arena');
  await f.request('ready',{},a.cookie,room.token); await f.request('ready',{},b.cookie,joined.data.token);
  f.advance(1000);
  assert.equal((await f.request('chat',{message:'in battle'},a.cookie,room.token)).status,400);
});

test('a ranked forfeit settles both players once, logout also forfeits, and training never rewards', async t => {
  const f = await fixture(t), a = await f.register('Alice'), b = await f.register('Bob');
  const room = (await f.request('rooms',{heroId:'strom',mode:'ranked',bestOf:5},a.cookie)).data;
  const joined = (await f.request('join',{heroId:'roger',code:room.state.code},b.cookie)).data;
  await f.request('ready',{},a.cookie,room.token); await f.request('ready',{},b.cookie,joined.token);
  assert.equal((await f.request('leave',{},b.cookie,joined.token)).data.series.winnerId,room.state.you);
  assert.equal((await f.request('me',undefined,a.cookie)).data.profile.points,15);
  assert.equal((await f.request('me',undefined,b.cookie)).data.profile.losses,1);
  await f.request('leave',{},a.cookie,room.token); await f.flush();
  assert.equal((await f.request('me',undefined,a.cookie)).data.profile.wins,1);
  const practice = (await f.request('rooms',{heroId:'strom',mode:'training'},a.cookie)).data;
  await f.request('ready',{},a.cookie,practice.token); await f.request('leave',{},a.cookie,practice.token);
  assert.equal((await f.request('me',undefined,a.cookie)).data.profile.played,1);
  const second = (await f.request('rooms',{heroId:'strom',mode:'ranked'},a.cookie)).data;
  const rival = (await f.request('join',{heroId:'roger',code:second.state.code},b.cookie)).data;
  await f.request('ready',{},a.cookie,second.token); await f.request('ready',{},b.cookie,rival.token);
  await f.request('logout',{},a.cookie); await f.flush();
  assert.equal((await f.request('me',undefined,b.cookie)).data.profile.points,15);
});

test('auth attempts are bounded and untrusted profile fields never alter points, coins or ownership', async t => {
  const f = await fixture(t), a = await f.register('Alice');
  const edited = (await f.request('profile',{name:'New Alice',points:99999,coins:99999,ownedHeroes:[]},a.cookie)).data.profile;
  assert.equal(edited.name,'New Alice'); assert.equal(edited.points,0); assert.equal(edited.coins,0); assert.equal(edited.ownedHeroes.length,8);
  for (let i=0;i<19;i++) assert.equal((await f.request('register',{username:'x'})).status,400);
  assert.equal((await f.request('login',{})).status,429);
  f.advance(300000);
  assert.equal((await f.request('login',{})).status,401);
});
