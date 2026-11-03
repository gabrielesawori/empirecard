// Complete account/social/ranked-series flow through real UI and isolated cookies.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { createBrowserSession } from './browser-tools.mjs';
import { HEROES, SKILL_TYPES } from '../public/heroes.js';

let time = 10000;
const app = createApp({now:() => time, random:() => 0});
app.server.listen(0,'127.0.0.1'); await once(app.server,'listening');
const browser = await createBrowserSession(`http://127.0.0.1:${app.server.address().port}`);
const {page, send, errors, soundCount} = browser;
const advance = ms => {time += ms; app.tick();};
const me = tab => tab.evaluate(`fetch('/api/me').then(r=>r.json()).then(d=>d.profile)`);
const snapshot = tab => tab.evaluate(`fetch('/api/state', {headers:{Authorization:'Bearer '+sessionStorage.getItem('empire.session')}}).then(r=>r.json())`);

try {
  const a = await page(1440,1000,{register:false}), b = await page(390,844,{register:false});
  await b.noOverflow(); await b.screenshot('v06-login-mobile');
  for (const [tab,name] of [[a,'Astra'],[b,'Luna']]) {
    await tab.click('[data-page="register"]');
    await tab.fill('#account-username',name); await tab.fill('#account-email',`${name}@example.test`); await tab.fill('#account-password','empire-test-password');
    await tab.click('#account-form button[type=submit]');
    await tab.wait('document.querySelector(".menu-layout")');
    await tab.noOverflow();
  }
  assert.equal(await a.evaluate('document.cookie.includes("empire_account")'),false);
  const aProfile = await me(a), bProfile = await me(b);
  assert.equal(aProfile.coins,0); assert.equal(aProfile.ownedHeroes.length,8);
  await a.screenshot('v06-home-desktop'); await b.screenshot('v06-home-mobile');
  // Login restores the same identity, not a new local profile.
  await b.click('[data-page="profile"]'); await b.click('[data-action="logout"]');
  await b.wait('document.querySelector("#account-form")');
  await b.fill('#account-email','Luna@example.test'); await b.fill('#account-password','empire-test-password');
  await b.click('#account-form button[type=submit]'); await b.wait('document.querySelector(".menu-layout")');
  assert.equal((await me(b)).uid,bProfile.uid);
  await a.click('[data-page="friends"]'); await a.fill('#friend-uid',bProfile.uid); await a.click('#friend-form button');
  await a.wait('document.querySelector("#friend-uid").value === ""');
  await b.click('[data-page="friends"]'); await b.wait('document.querySelector("[data-action=friend-accept]")');
  await b.click('[data-action="friend-accept"]'); await b.wait('document.querySelector("[data-action=prepare-invite]")');
  await a.click('.page-back'); await a.click('[data-page="friends"]'); await a.wait('document.querySelector("[data-action=prepare-invite]")');
  await a.fill('#global-chat-input','<img src=x onerror=alert(1)>'); await a.click('#global-chat-form button');
  await a.wait('document.querySelector(".chat-message p")?.textContent.includes("<img")');
  assert.equal(await a.evaluate('document.querySelectorAll(".chat-message img").length'),0);
  await a.click('[data-action="prepare-invite"]');
  await a.click('[data-action="choose-format"][data-count="3"]');
  await a.click('[data-action="choose-mode"][data-mode="ranked"]');
  await a.click('[data-action="choose-hero"][data-hero="nextland"]');
  await a.click('[data-action="choose-spell"][data-spell="execute"]');
  await a.click('#create-form button[type=submit]'); await a.wait('document.querySelector(".room-code-big")');
  await b.click('.page-back'); await b.click('[data-page="friends"]'); await b.wait('document.querySelector("[data-action=accept-invite]")');
  await b.screenshot('v06-friend-invitation'); await b.click('[data-action="accept-invite"]'); await b.wait('document.querySelector(".room-code-big")');
  assert.equal((await snapshot(b)).series.bestOf,3); assert.equal((await snapshot(b)).mode,'ranked');
  await b.click('[data-action="room-hero"][data-hero="roger"]'); await b.wait('document.querySelector("[data-action=room-hero][data-hero=roger].selected:not(:disabled)")');
  advance(1000);
  await a.fill('#lobby-chat-input','Siap duel dua kemenangan!'); await a.click('#lobby-chat-form button');
  await b.wait('document.querySelector(".chat-message p")?.textContent === "Siap duel dua kemenangan!"');
  await a.click('[data-action="ready"]'); await b.click('[data-action="ready"]');
  for (const tab of [a,b]) await tab.wait('document.querySelector(".battle-table")');
  await b.noOverflow(); await b.screenshot('v06-arena-select-mobile');
  // Prove the touch button and skill text no longer overlap.
  assert.equal(await b.evaluate(`(() => {const detail=document.querySelector('.skill-detail');return detail.querySelector('p').getBoundingClientRect().bottom <= detail.querySelector('button').getBoundingClientRect().top;})()`),true);
  async function winMatch() {
    for (let i=0;i<50;i++) {
      const state = await snapshot(a);
      if (state.phase === 'finished') {assert.equal(state.result.winnerId,state.you); return state;}
      assert.equal(state.phase,'selecting');
      const [first,second] = state.players;
      const choices = p => HEROES[p.heroId].skills.filter(s => p.energy[s.id]>0);
      const pairs = choices(first).flatMap(x=>choices(second).map(y=>({x,y,score:(SKILL_TYPES[x.type].counters===y.type?1000:x.type===y.type?0:-1000)+(x.damage?.[0]||0)}))).sort((x,y)=>y.score-x.score);
      const pair = pairs[0];
      for (const [tab,player,skill] of [[a,first,pair.x],[b,second,pair.y]]) if (!player.skipped) {
        await tab.wait(`document.querySelector('[data-skill="${skill.id}"]:not(:disabled)')`);
        await tab.click(`[data-skill="${skill.id}"]`); await tab.click('[data-action="lock"]');
      }
      await a.wait('document.querySelector(".counting")'); advance(4000);
      await a.wait('document.querySelector(".result-screen") || document.querySelector(".face-up")');
      if ((await snapshot(a)).phase === 'finished') continue;
      advance(5500); await a.wait('document.querySelector(".battle-table") && !document.querySelector(".face-up")');
    }
    throw new Error('Match did not end');
  }
  const first = await winMatch(); assert.equal(first.series.finished,false); assert.equal(first.series.scores[first.you],1);
  assert.equal((await me(a)).points,0); assert.equal((await me(a)).played,0);
  await a.click('[data-action="rematch"]'); await a.wait('document.querySelector("[data-action=rematch]").disabled');
  assert.equal((await snapshot(b)).phase,'finished');
  await b.click('[data-action="rematch"]'); for(const tab of [a,b]) await tab.wait('document.querySelector(".room-code-big")');
  await a.click('[data-action="room-hero"][data-hero="kristina"]'); await a.wait('document.querySelector("[data-action=room-hero][data-hero=kristina].selected:not(:disabled)")');
  await b.click('[data-action="room-hero"][data-hero="warfet"]'); await b.wait('document.querySelector("[data-action=room-hero][data-hero=warfet].selected:not(:disabled)")');
  await b.click('[data-action="room-spell"][data-spell="armor"]'); await b.wait('document.querySelector("[data-action=room-spell][data-spell=armor].selected:not(:disabled)")');
  await send('Page.reload',{},b.sessionId); await b.wait('document.querySelector(".room-code-big")');
  assert.equal((await snapshot(b)).series.match,2); assert.equal((await snapshot(b)).players[1].battleSpellId,'armor');
  await a.click('[data-action="ready"]'); await b.click('[data-action="ready"]');
  for (const tab of [a,b]) await tab.wait('document.querySelector(".battle-table")');
  const second = await winMatch(); assert.equal(second.series.finished,true); assert.equal(second.series.match,2); assert.equal(second.series.scores[second.you],2);
  await app.flush(); await a.wait('document.querySelector(".result-sync")?.textContent.includes("tersimpan")');
  for(const tab of [a,b]) {await tab.noOverflow();await tab.wait('document.querySelector(".result-screen")');}
  await a.screenshot('v06-series-result'); await b.screenshot('v06-series-result-mobile');
  assert.equal((await me(a)).points,15); assert.equal((await me(a)).wins,1); assert.equal((await me(b)).losses,1); assert.equal((await me(b)).points,0);
  assert.equal(await soundCount(a,'victory'),2); assert.equal(await soundCount(b,'defeat'),2);
  await send('Page.reload',{},a.sessionId); await a.wait('document.querySelector(".result-screen")');
  assert.equal((await me(a)).points,15); assert.equal(await soundCount(a,'victory'),2);
  for (const tab of [a,b]) {await tab.click('[data-action="leave"]');await tab.click('[data-action="confirm-leave"]');await tab.wait('document.querySelector(".menu-layout")');}
  await a.click('[data-page="leaderboard"]'); await a.wait('document.querySelector(".leaderboard-entry")');
  assert.equal(await a.evaluate('document.querySelector(".leaderboard-entry strong").textContent'),'Astra');
  await a.screenshot('v06-leaderboard'); await a.noOverflow();
  await b.click('[data-page="rank"]'); await b.noOverflow(); await b.screenshot('v06-rank-mobile');
  await b.click('.page-back'); await b.click('[data-page="points"]'); await b.noOverflow();
  assert.equal(await b.evaluate('document.querySelectorAll(".shop-grid button:disabled").length'),8);
  for (const width of [320,768]) {
    const compact = await page(width,900);
    await compact.noOverflow();
    for (const destination of ['profile','rank','friends','leaderboard','points']) {
      await compact.click(`[data-page="${destination}"]`);
      await compact.wait(`document.body.dataset.screen === '${destination}'`);
      await compact.noOverflow();
      if (width === 320 && ['rank','friends'].includes(destination)) await compact.screenshot(`v06-${destination}-320`);
      await compact.click('.page-back');
    }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: real registration/login/logout, private cookies, UID friends and invitations, escaped global/lobby chat, ranked BO3 ending 2–0, intermission loadout changes, reconnect, rank once, per-match audio, leaderboard and disabled economy.');
} finally {await browser.close();app.dispose();await new Promise(resolve=>app.server.close(resolve));await app.closeStore();}
