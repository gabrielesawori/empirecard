import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { createBrowserSession } from './browser-tools.mjs';

let time = 10000;
const app = createApp({now:()=>time,random:()=>0});
app.server.listen(0,'127.0.0.1'); await once(app.server,'listening');
const browser = await createBrowserSession(`http://127.0.0.1:${app.server.address().port}`);
const {page,send,errors} = browser;
const advance = ms => {time+=ms;app.tick();};
const snapshot = tab => tab.evaluate("fetch('/api/state',{headers:{Authorization:'Bearer '+sessionStorage.getItem('empire.session')}}).then(r=>r.json())");
try {
  const a = await page(390,844), b = await page(1440,1000);
  async function room(first,second) {
    for (const [tab,hero] of [[a,first],[b,second]]) {
      await tab.click('.menu-play');
      await tab.click(`[data-action="choose-hero"][data-hero="${hero}"]`);
      await tab.click('[data-action="choose-spell"][data-spell="armor"]');
    }
    await a.click('#create-form button[type="submit"]'); await a.wait('document.querySelector(".room-code-big")');
    const code = await a.evaluate('document.querySelector(".room-code-big").textContent.trim()');
    await b.fill('#room-code',code); await b.click('#join-form button[type="submit"]');
    await b.wait('document.querySelector(".room-code-big")');
    for (const tab of [a,b]) {
      const state = await snapshot(tab), rival=state.players.find(p=>p.id!==state.you);
      assert.equal(rival.heroId,null); assert.equal(rival.battleSpellId,null);
      assert.equal(await tab.evaluate('document.querySelectorAll(".rival-spell-preview").length'),0);
      await tab.noOverflow();
    }
    await a.screenshot('v07-secret-lobby-mobile');
    await a.click('[data-action="ready"]'); await b.click('[data-action="ready"]');
    for (const tab of [a,b]) await tab.wait('document.querySelector(".battle-table")');
  }
  async function select(tab,id,type=null) {
    if (!id) return;
    if (type) { await tab.click('.your-side [data-action="select-ultimate"]'); await tab.click(`[data-action="ultimate-type"][data-type="${type}"]`); }
    else await tab.click(`[data-skill="${id}"]`);
    if (id === 'energy-thief') {
      assert.equal(await tab.evaluate('document.querySelector("[data-action=lock]").disabled'),true);
      await tab.click('[data-action="target-energy"][data-type="arrow"]');
      await tab.click('[data-action="restore-energy"][data-type="sword"]');
      assert.equal(await tab.evaluate('document.querySelector("[data-action=lock]").disabled'),false);
      await tab.noOverflow(); await tab.screenshot('v07-energy-choice-mobile');
    }
    await tab.click('[data-action="lock"]'); await tab.wait('document.querySelector(".your-side .battle-slot.locked")');
  }
  async function play(first,second,type=null,rivalType=null) {
    await select(a,first,type);
    if (first === 'energy-thief') {
      const rival = (await snapshot(b)).players[0];
      assert.equal(rival.choice,null); assert.equal(rival.choiceRestoreType,null);
    }
    await select(b,second,rivalType);
    await a.wait('document.querySelector(".counting")');
    advance(4000);
    for (const tab of [a,b]) await tab.wait('document.querySelector(".face-up") && !document.querySelector(".counting")');
    const sa=await snapshot(a), sb=await snapshot(b); assert.deepEqual(sa.players,sb.players);
    return sa;
  }
  async function next(round) {
    advance(5500);
    for (const tab of [a,b]) await tab.wait(`document.querySelector('.round-counter strong')?.textContent === '${String(round).padStart(2,'0')}' && !document.querySelector('.face-up')`);
  }
  async function leave() {
    for (const tab of [a,b]) {
      await tab.click('[data-action="leave"]'); await tab.click('[data-action="confirm-leave"]');
      await tab.wait('document.querySelector(".menu-play")');
    }
  }
  await room('genggar','spearos');
  await play('magic-shot','knights-resolve'); await next(2);
  await play('magic-shot','knights-resolve'); await next(3);
  assert.equal(await a.evaluate('document.querySelector("[data-skill=magic-shot]").classList.contains("is-empowered")'),true);
  assert.match(await a.evaluate('document.querySelector("[data-skill=magic-shot] .live-skill-copy b").textContent'),/90/);
  await a.screenshot('v07-magic-shot-glow-mobile');
  const stolen=await play('energy-thief','spear-strike');
  assert.equal(stolen.players[0].energy['magic-shot'],2); assert.equal(stolen.players[1].energy['spear-strike'],1);
  assert.match(await a.evaluate('document.querySelector(".battle-history").textContent'),/Curi 1 energi Panah → Pedang/);
  await send('Page.reload',{},a.sessionId); await a.wait('document.querySelector(".battle-history")');
  assert.equal((await snapshot(a)).players[0].energy['magic-shot'],2);
  await next(4); await play('hypno','knights-resolve');
  assert.match(await b.evaluate('document.querySelector(".your-side .status-effects").textContent'),/HYPNO · 2/);
  await next(5); await play('hypno','royal-whirlwind');
  await next(6); await play('hypno','spear-strike');
  await next(7); await play('energy-thief','royal-whirlwind');
  await next(8); await play('energy-thief','royal-whirlwind');
  await next(9);
  assert.match(await a.evaluate('document.querySelector(".your-side .ultimate-slot small").textContent'), /BABAK 9$/);
  await play('magic-shot','knights-resolve');
  assert.match(await a.evaluate('document.querySelector(".battle-history").textContent'),/SIKLUS 9 BABAK/);
  await next(10); const field=await play('magic-field','royal-whirlwind','sword');
  assert.equal(field.players[0].maxDefense,100); assert.equal(field.players[0].defense,100);
  assert.match(await a.evaluate('document.querySelector(".your-side .defense-row").textContent'),/100 \/ 100/);
  assert.match(await b.evaluate('document.querySelector(".your-side .status-effects").textContent'),/MEDAN SIHIR −5 HP · 10/);
  await a.noOverflow(); await a.screenshot('v07-magic-field-mobile');
  await next(11); const cleaned=await play('magic-shot','divine-spear',null,'arrow');
  assert.equal(cleaned.players[1].fieldTurns,0); assert.equal(cleaned.players[0].damageDownStacks,1);
  assert.match(await a.evaluate('document.querySelector(".your-side .status-effects").textContent'),/DIVINE SPEAR −15%/);
  for (const tab of [a,b]) await tab.noOverflow();
  await leave();
  await room('karina','newland');
  await play('chaser-dimensions','arrows-all-directions'); await next(2);
  await play('dimensional-slash',null);
  assert.match(await a.evaluate('document.querySelector(".your-side .status-effects").textContent'),/RIFT 1 \/ 2/);
  await next(3); const blast=await play('dimensional-movement','sharpest-arrow');
  assert.equal(blast.lastRound.entries[0].explosions,1);
  assert.match(await a.evaluate('document.querySelector(".battle-history").textContent'),/1 ledakan \(40 DMG\)/);
  await a.screenshot('v07-karina-rift-mobile'); await b.screenshot('v07-newland-desktop');
  for (const tab of [a,b]) await tab.noOverflow();
  await leave();
  assert.deepEqual(errors,[]);
  console.log('PASS: secret lobby, Genggar cross-type energy picker and privacy, 90 damage glow, Hypno, periodic ultimate, DEF 100, field status, Spearos cleanse, Karina rifts, Newland, reconnect and two-sided desktop/mobile state.');
} finally {
  await browser.close(); app.dispose(); await new Promise(resolve=>app.server.close(resolve));
}
