import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createApp } from '../server.mjs';
import { HEROES, SKILL_TYPES } from '../public/heroes.js';
import { createBrowserSession } from './browser-tools.mjs';

let time = Date.now();
const app = createApp({ now: () => time, random: () => 0 });
app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
const browser = await createBrowserSession(`http://127.0.0.1:${app.server.address().port}`);
const { page, send, pause, errors } = browser;
const advance = ms => { time += ms; app.tick(); };
const snapshot = tab => tab.evaluate("fetch('/api/state', {headers:{Authorization:'Bearer '+sessionStorage.getItem('empire.session')}}).then(r=>r.json())");
try {
  const a = await page(1440,1000), b = await page(390,844);
  for (const tab of [a,b]) await tab.wait('window.adsenseTestLoads === 1');
  for (const tab of [a,b]) {
    await tab.evaluate(`(() => {
      window.testPolls = 0; window.testStreams = []; window.dropStateEvents = false;
      const fetch = window.fetch.bind(window), Source = window.EventSource;
      window.fetch = (...args) => { if (String(args[0]) === '/api/state') window.testPolls++; return fetch(...args); };
      window.EventSource = class extends Source {
        constructor(...args) { super(...args); window.testStreams.push(this); }
        addEventListener(type, listener, options) {
          return super.addEventListener(type, type === 'state' ? event => { if (!window.dropStateEvents) listener(event); } : listener, options);
        }
      };
    })()`);
    await tab.click('.menu-play'); await tab.click('[data-action="choose-hero"][data-hero="golar"]');
    await tab.click('[data-action="choose-spell"][data-spell="armor"]');
  }
  await a.click('[data-action="choose-format"][data-count="3"]');
  await a.click('#create-form button[type="submit"]'); await a.wait('document.querySelector(".room-code-big")');
  const code = await a.evaluate('document.querySelector(".room-code-big").textContent.trim()');
  await b.fill('#room-code',code); await b.click('#join-form button[type="submit"]');
  await b.wait('document.querySelector(".room-code-big")');
  await a.wait('document.querySelector(".waiting-arena").textContent.includes("TERHUBUNG")');
  await a.click('[data-action="ready"]'); await b.click('[data-action="ready"]');
  for (const tab of [a,b]) {
    await tab.wait('document.querySelector(".battle-table") && window.testStreams[0]?.readyState === EventSource.OPEN');
    await tab.evaluate('window.testPolls=0');
  }

  async function lock(first,second) {
    for (const [tab,skill] of [[a,first],[b,second]]) {
      await tab.click(`[data-skill="${skill}"]`); await tab.click('[data-action="lock"]');
      if (tab === a) await b.wait('document.querySelector(".rival-side .battle-slot.locked")');
    }
    for (const tab of [a,b]) await tab.wait('document.querySelector(".counting") && document.querySelector("#app").getAttribute("aria-busy") === "false"');
  }
  async function revealed() {
    for (const tab of [a,b]) await tab.wait('document.querySelectorAll(".face-up").length === 2 || document.querySelector(".result-screen")');
  }
  async function next(round) {
    advance(5500);
    for (const tab of [a,b]) await tab.wait(`document.querySelector('.round-counter strong')?.textContent === '${String(round).padStart(2,'0')}' && !document.querySelector('.face-up')`);
  }
  async function captureArena(tab,name) {
    const rect = await tab.evaluate('(() => { const r=document.querySelector(".battle-table").getBoundingClientRect(); return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height,scale:1}; })()');
    const {data} = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:rect},tab.sessionId);
    const file = `/tmp/empire-card-${name}.png`; await writeFile(file,Buffer.from(data,'base64')); console.log(`Screenshot: ${file}`);
  }

  // The exact reported regression: a changed/missing status ornament cannot
  // prevent the other player from receiving lock, reveal and next-round events.
  await b.evaluate('window.statusNode=document.querySelector("#connection-status"); window.statusParent=statusNode.parentElement; statusNode.remove()');
  await lock('mark','deadly-slash');
  advance(3999);
  assert.equal(await a.evaluate('Boolean(document.querySelector(".counting"))'),true);
  advance(1); await revealed();
  assert.deepEqual(await Promise.all([a,b].map(tab=>tab.evaluate('window.testPolls'))),[0,0], 'Healthy match advances from SSE, without polling or refresh');

  await a.wait('!document.querySelector(".is-casting") && !document.querySelector(".cast-spark")');
  // Freeze the actual CSS keyframes after lifecycle cleanup so screenshot speed
  // cannot turn a mid-flip capture into a picture of an already-landed card.
  for (const tab of [a,b]) {
    const scene = await tab.evaluate(`(() => {
      const stage=document.querySelector('.your-side .placed-card'), card=stage.querySelector('.cast-card');
      window.originalCast=card;
      document.querySelectorAll('.battle-slot.revealed').forEach(slot=>slot.classList.add('is-casting'));
      document.querySelectorAll('.battle-slot').forEach(slot=>slot.getAnimations({subtree:true}).forEach(animation=>{ animation.pause(); animation.currentTime=animation.effect.getTiming().duration * .12; }));
      const css=getComputedStyle(card), m=new DOMMatrix(css.transform);
      return {perspective:getComputedStyle(stage).perspective,preserve:css.transformStyle,filter:css.filter,opacity:css.opacity,z:m.m43,depthRotation:m.m13,faces:card.querySelectorAll('.cast-face').length,edges:card.querySelectorAll('.cast-edge').length,backface:getComputedStyle(card.querySelector('.cast-back')).backfaceVisibility};
    })()`);
    assert.equal(scene.preserve,'preserve-3d'); assert.equal(scene.filter,'none'); assert.equal(scene.opacity,'1');
    assert.equal(scene.faces,2); assert.equal(scene.edges,4); assert.equal(scene.backface,'hidden');
    assert.notEqual(scene.perspective,'none'); assert.ok(scene.z > 0 && Math.abs(scene.depthRotation) > .5);
  }
  await captureArena(a,'cast-depth-desktop'); await captureArena(b,'cast-depth-mobile');
  for (const tab of [a,b]) await tab.evaluate("document.querySelectorAll('.battle-slot').forEach(slot=>slot.getAnimations({subtree:true}).forEach(animation=>animation.currentTime=animation.effect.getTiming().duration * .58))");
  await captureArena(a,'cast-lift-desktop'); await captureArena(b,'cast-lift-mobile');
  for (const tab of [a,b]) assert.equal(await tab.evaluate("(() => { const board=document.querySelector('.battle-table').getBoundingClientRect(); return [...document.querySelectorAll('.cast-card')].every(card=>{ const r=card.getBoundingClientRect(); return r.top >= board.top && r.bottom <= board.bottom && r.left >= board.left && r.right <= board.right; }); })()"),true,'Lifted cards stay within the arena');
  await b.evaluate('statusParent.prepend(statusNode)');
  // A duplicate broadcast must not recreate the card and restart its animation.
  await a.evaluate("window.extraStream=new EventSource('/api/events?session='+encodeURIComponent(sessionStorage.getItem('empire.session')))");
  await a.wait('window.extraStream.readyState === EventSource.OPEN');
  assert.equal(await a.evaluate('window.originalCast === document.querySelector(".your-side .cast-card")'),true);
  await a.evaluate('window.extraStream.close()');
  for (const tab of [a,b]) {
    await tab.evaluate("document.querySelectorAll('.is-casting').forEach(slot=>slot.classList.remove('is-casting'))");
    await tab.noOverflow();
  }
  await a.wait('!document.querySelector(".is-casting") && !document.querySelector(".cast-spark")');
  await next(2);

  // A closed stream recovers even if the health indicator was still online.
  await a.evaluate('window.testStreams[0].close()');
  await a.wait('window.testStreams.length >= 3 && window.testStreams.at(-1).readyState === EventSource.OPEN');
  assert.ok(await a.evaluate('window.testPolls > 0'));
  // Recovered SSE keeps the remaining match flowing without reloading the page.
  await lock('deadly-slash','analysis-system'); advance(4000); await revealed(); await next(3);

  // Simulate a stream that stays OPEN but loses the reveal event. The deadline
  // watchdog must recover the authoritative state, without relying on onerror.
  await lock('mark','deadly-slash');
  const before = await a.evaluate('window.testPolls');
  await a.evaluate('window.dropStateEvents=true');
  advance(4000);
  await a.wait('document.querySelectorAll(".face-up").length === 2',9000);
  assert.ok(await a.evaluate(`window.testPolls > ${before}`));
  await a.evaluate('window.dropStateEvents=false');
  await next(4);

  // Reduced motion retains the outcome and artwork without flip or particles.
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},b.sessionId);
  await lock('deadly-slash','analysis-system'); advance(4000); await revealed();
  assert.equal(await b.evaluate('document.querySelectorAll(".is-casting, .cast-spark").length'),0);
  assert.equal(await b.evaluate('document.querySelector(".cast-card").getAnimations().length'),0);
  await b.noOverflow();
  await next(5);

  // Finish through legal cards, then progress to the next match entirely by SSE.
  let state = await snapshot(a);
  for (let turns=0;state.phase !== 'finished' && turns<30;turns++) {
    const [first,second] = state.players;
    const pairs = HEROES.golar.skills.filter(s=>first.energy[s.id]>0).flatMap(s=>HEROES.golar.skills.filter(t=>second.energy[t.id]>0).map(t=>[s,t]));
    const pair = pairs.find(([s,t])=>SKILL_TYPES[s.type].counters===t.type) || pairs.find(([s,t])=>s.type===t.type) || pairs[0];
    await lock(pair[0].id,pair[1].id); advance(4000); await revealed(); state=await snapshot(a);
    if (state.phase === 'reveal') { await next(state.round+1); state=await snapshot(a); }
  }
  assert.equal(state.phase,'finished'); assert.equal(state.series.finished,false);
  for (const tab of [a,b]) await tab.click('[data-action="rematch"]');
  for (const tab of [a,b]) await tab.wait('document.querySelector(".room-code-big") && document.querySelector("#app").getAttribute("aria-busy") === "false"');
  assert.equal((await snapshot(a)).series.match,2);
  for (const tab of [a,b]) await tab.click('[data-action="ready"]');
  for (const tab of [a,b]) await tab.wait('document.querySelector(".round-counter strong")?.textContent === "01"');
  for (const tab of [a,b]) assert.equal(await tab.evaluate('window.adsenseTestLoads'),1,'Auto ads loads once across lobby, rounds and matches');
  assert.deepEqual(errors,[]);
  console.log('PASS: two-client SSE without refresh/polling, missing status UI, countdown/reveal/next round, stream recovery, missed-event watchdog, duplicate-state animation stability, two-sided 3D card volume on desktop/mobile, reduced motion, cleanup and next match.');
} catch (error) {
  console.error('Browser errors:',errors);
  throw error;
} finally {
  await browser.close(); app.dispose(); await new Promise(resolve=>app.server.close(resolve));
}
