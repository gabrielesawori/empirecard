// Real browsers and HTTP/SSE; a private server clock advances long charge cycles.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { createBrowserSession } from './browser-tools.mjs';

let time = 10000;
const server = createApp({ now: () => time, random: () => 0 });
server.server.listen(0, '127.0.0.1');
await once(server.server, 'listening');
const browser = await createBrowserSession(`http://127.0.0.1:${server.server.address().port}`);
const { page, errors } = browser;
function advance(ms) { time += ms; server.tick(); }
try {
  const a = await page(1440, 1050);
  const b = await page(390, 844);
  await a.click('[data-page="heroes"]');
  assert.equal(await a.evaluate('document.querySelectorAll(".locked-library-card").length'), 0);
  await a.click('[data-action="hero-details"][data-hero="kristina"]');
  assert.equal(await a.evaluate('document.querySelectorAll(".collection-skills > div").length'), 4);
  await a.wait('[...document.querySelectorAll("#info-dialog img")].every(img => img.complete && img.naturalWidth > 0)');
  await a.screenshot('kristina-details');
  await a.click('.dialog-close');
  await a.click('.page-back');
  for (const tab of [a, b]) {
    await tab.click('.menu-play');
    await tab.click('[data-action="choose-hero"][data-hero="kristina"]');
    await tab.click('[data-action="choose-spell"][data-spell="execute"]');
    await tab.noOverflow();
  }
  await a.screenshot('kristina-matchmaking');
  await b.screenshot('kristina-mobile-matchmaking');
  await a.fill('#player-name', 'Kristina A');
  await a.click('#create-form button[type="submit"]');
  await a.wait('document.querySelector(".room-code-big")');
  const code = await a.evaluate('document.querySelector(".room-code-big").textContent.trim()');
  await b.fill('#player-name', 'Kristina B');
  await b.fill('#room-code', code);
  await b.click('#join-form button[type="submit"]');
  await b.wait('document.querySelector(".room-code-big")');
  await a.click('[data-action="ready"]');
  await b.click('[data-action="ready"]');
  const selecting = async round => {
    for (const tab of [a, b]) await tab.wait(`document.querySelector('.round-counter strong')?.textContent === '${String(round).padStart(2, '0')}' && document.querySelectorAll('.skill-card:not(:disabled)').length > 0`);
  };
  const reveal = async () => {
    await a.wait('document.querySelector(".counting")');
    await b.wait('document.querySelector(".counting")');
    advance(4000);
    for (const tab of [a, b]) await tab.wait('document.querySelectorAll(".face-up").length === 2');
  };
  const play = async (first, second) => {
    await a.click(`[data-skill="${first}"]`);
    await a.click('[data-action="lock"]');
    await b.click(`[data-skill="${second}"]`);
    await b.click('[data-action="lock"]');
    await reveal();
  };
  await selecting(1);
  assert.equal(await a.evaluate('document.querySelector(".your-side .ultimate-slot").disabled'), true);
  await a.wait('[...document.images].every(img => img.complete && img.naturalWidth > 0)');
  await a.screenshot('kristina-arena');
  let round = 1;
  for (const skill of ['shadow-burst', 'dust', 'fly-over']) for (let i = 0; i < 3; i++) {
    await play(skill, skill);
    advance(5500);
    await selecting(++round);
  }
  assert.equal(round, 10);
  assert.equal(await a.evaluate('document.querySelector(".your-side .ultimate-slot.is-ready").disabled'), false);
  await a.click('.your-side [data-action="select-ultimate"]');
  assert.equal(await a.evaluate('document.querySelector("[data-action=lock]").disabled'), true);
  await a.click('[data-action="ultimate-type"][data-type="arrow"]');
  assert.equal(await a.evaluate('document.querySelector("[data-action=lock]").disabled'), false);
  await a.noOverflow();
  await a.screenshot('kristina-execute-ready');
  await b.click('.your-side [data-action="select-ultimate"]');
  await b.noOverflow();
  await b.screenshot('kristina-mobile-execute');
  await a.click('[data-action="lock"]');
  await b.wait('document.querySelector(".rival-side .battle-slot.locked")');
  assert.equal(await b.evaluate('document.querySelector(".rival-side .battle-slot img").alt'), 'Kartu skill tertutup');
  assert.equal(await b.evaluate('Boolean(document.querySelector(".rival-side .ultimate-slot.is-ready"))'), true);
  assert.equal(await b.evaluate('document.querySelectorAll(".rival-side .energy-meter:nth-child(2) .filled").length'), 3);
  await b.click('[data-skill="shadow-burst"]');
  await b.click('[data-action="lock"]');
  await reveal();
  assert.equal(await a.evaluate('document.querySelector(".your-side .face-up img").alt'), 'Ilustrasi Execute');
  assert.equal(await b.evaluate('document.querySelector(".rival-side .face-up img").alt'), 'Ilustrasi Execute');
  assert.equal(await b.evaluate('Number(document.querySelector(".your-side .hp-row b").textContent)'), 68);
  assert.equal(await a.evaluate('Boolean(document.querySelector(".your-side .ultimate-slot.is-inactive"))'), true);
  advance(5500);
  await selecting(11);
  await a.click('[data-skill="dust"]'); await a.click('[data-action="lock"]');
  await b.click('[data-skill="shadow-burst"]'); await b.click('[data-action="lock"]');
  await a.wait('document.querySelector(".counting")');
  advance(4000);
  for (const tab of [a,b]) await tab.wait('document.querySelector(".result-screen")');
  assert.match(await a.evaluate('document.querySelector(".result-screen h1").textContent'), /menang/i);
  for (const tab of [a, b]) {
    await tab.noOverflow();
    await tab.click('[data-action="leave"]');
    await tab.click('[data-action="confirm-leave"]');
    await tab.wait('document.querySelector(".menu-layout")');
  }
  await a.click('.menu-play');
  await a.click('[data-action="training"]');
  await a.wait('document.querySelector(".room-code-big")');
  await a.click('[data-action="ready"]');
  await a.wait('document.querySelector("[data-skill=dust]")');
  await a.click('[data-skill="dust"]');
  await a.click('[data-action="lock"]');
  await a.wait('document.querySelector(".your-side .battle-slot.locked")');
  advance(0);
  advance(700);
  await a.wait('document.querySelector(".counting")');
  advance(4000);
  await a.wait('document.querySelector(".your-side .immune-status")');
  await a.click('[data-action="leave"]');
  await a.click('[data-action="confirm-leave"]');
  assert.deepEqual(errors, []);
  console.log('PASS: Kristina assets, collection/unlock, desktop/mobile selection, 9-use charge, Execute type picker and private choice, 60% maximum HP+DEF damage, 35 damage Dust, 30% Execute spell threshold, immunity, and bot training.');
} finally {
  await browser.close();
  server.dispose();
  await new Promise(resolve => server.server.close(resolve));
}
