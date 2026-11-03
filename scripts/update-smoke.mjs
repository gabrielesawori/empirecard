import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { createBrowserSession } from './browser-tools.mjs';
import { BATTLE_SPELLS } from '../public/spells.js';

let time = 10000;
const app = createApp({ now: () => time, random: () => 0 });
app.server.listen(0, '127.0.0.1');
await once(app.server, 'listening');
const browser = await createBrowserSession(`http://127.0.0.1:${app.server.address().port}`);
const { page, send, errors } = browser;
const advance = ms => { time += ms; app.tick(); };
try {
  const a = await page(1440, 1050);
  const b = await page(390, 844);
  for (const tab of [a, b]) {
    await tab.click('[data-page="heroes"]');
    assert.equal(await tab.evaluate('document.querySelectorAll(".library-card").length'), 8);
    assert.equal(await tab.evaluate('document.querySelectorAll(".spell-library-card").length'), 6);
    for (const hero of ['golar', 'warfet', 'nextland', 'rafel', 'quexyana']) {
      await tab.click(`[data-action="hero-details"][data-hero="${hero}"]`);
      assert.equal(await tab.evaluate('document.querySelectorAll(".collection-skills > div").length'), 4);
      await tab.wait('[...document.querySelectorAll("#info-dialog img")].every(img => img.complete && img.naturalWidth > 0)');
      await tab.noOverflow();
      await tab.click('.dialog-close');
    }
    await tab.click('[data-action="spell-details"][data-spell="dodge"]');
    assert.match(await tab.evaluate('document.querySelector(".spell-dialog").textContent'), /ketiga/);
    await tab.click('.dialog-close');
    await tab.noOverflow();
  }
  await a.screenshot('v05-collection');
  await b.screenshot('v05-mobile-collection');
  for (const tab of [a, b]) { await tab.click('.page-back'); await tab.click('.menu-play'); }
  for (const spell of Object.keys(BATTLE_SPELLS)) {
    await a.click(`[data-action="choose-spell"][data-spell="${spell}"]`);
    assert.equal(await a.evaluate('localStorage.getItem("empire.spell")'), spell);
    assert.equal(await a.evaluate('document.querySelectorAll(".spell-option.selected").length'), 1);
  }
  await a.click('[data-action="choose-hero"][data-hero="golar"]');
  await a.click('[data-action="choose-spell"][data-spell="retribution"]');
  await b.click('[data-action="choose-hero"][data-hero="warfet"]');
  await b.click('[data-action="choose-spell"][data-spell="dodge"]');
  for (const tab of [a, b]) await tab.noOverflow();
  await a.screenshot('v05-matchmaking');
  await b.screenshot('v05-mobile-matchmaking');
  // Intermediate widths catch dense roster layouts between desktop and phone.
  for (const width of [1024, 768, 320]) {
    const tab = await page(width, 900);
    await tab.noOverflow();
    await tab.click('.menu-play');
    await tab.noOverflow();
  }
  await a.fill('#player-name', 'Golar Tester');
  await a.click('#create-form button[type="submit"]');
  await a.wait('document.querySelector(".room-code-big")');
  const code = await a.evaluate('document.querySelector(".room-code-big").textContent.trim()');
  await b.fill('#player-name', 'Warfet Tester'); await b.fill('#room-code', code);
  await b.click('#join-form button[type="submit"]');
  await b.wait('document.querySelector(".room-code-big")');
  await b.click('[data-action="room-spell"][data-spell="armor"]');
  await b.wait('document.querySelector("[data-action=room-spell][data-spell=armor]").matches(".selected:not(:disabled)")');
  await a.wait('document.querySelector(".rival-spell-preview").textContent.includes("Armor")');
  for (const tab of [a, b]) await tab.noOverflow();
  await b.screenshot('v05-mobile-lobby');
  await send('Page.reload', {}, b.sessionId);
  await b.wait('document.querySelector("[data-action=room-spell][data-spell=armor].selected")');
  await a.click('[data-action="ready"]'); await b.click('[data-action="ready"]');
  for (const tab of [a, b]) {
    await tab.wait('document.querySelector(".battle-table")');
    assert.equal(await tab.evaluate('document.querySelectorAll(".spell-card-art img").length'), 2);
  }
  async function play(first, second) {
    await a.click(`[data-skill="${first}"]`); await a.click('[data-action="lock"]');
    await b.wait('document.querySelector(".rival-side .battle-slot.locked")');
    assert.equal(await b.evaluate('document.querySelector(".rival-side .battle-slot img").alt'), 'Kartu skill tertutup');
    await b.click(`[data-skill="${second}"]`); await b.click('[data-action="lock"]');
    await a.wait('document.querySelector(".counting")');
    advance(4000);
    for (const tab of [a, b]) await tab.wait('document.querySelectorAll(".face-up").length === 2');
  }
  await play('mark', 'soul-lock');
  assert.equal(await a.evaluate('document.querySelector(".your-side .spell-slot small").textContent'), '+5 DAMAGE');
  assert.equal(await b.evaluate('Number(document.querySelector(".your-side .defense-row b").textContent)'), 150);
  assert.match(await a.evaluate('document.querySelector(".your-side .buff-status").textContent'), /\+20 DMG/);
  advance(5500);
  for (const tab of [a, b]) await tab.wait('document.querySelector(".round-counter strong").textContent === "02"');
  await play('deadly-slash', 'soul-user');
  assert.equal(await a.evaluate('document.querySelector(".your-side .spell-slot small").textContent'), '+10 DAMAGE');
  assert.equal(await b.evaluate('Number(document.querySelector(".your-side .defense-row b").textContent)'), 120);
  assert.match(await b.evaluate('document.querySelector(".your-side .status-effects").textContent'), /LUKA · 2/);
  for (const tab of [a, b]) await tab.noOverflow();
  await a.screenshot('v05-arena'); await b.screenshot('v05-mobile-arena');
  advance(5500);
  for (const tab of [a, b]) await tab.wait('document.querySelector(".round-counter strong").textContent === "03"');
  await play('analysis-system', 'soul-user'); // Equal shield: only the old wound ticks.
  assert.equal(await b.evaluate('Number(document.querySelector(".your-side .hp-row b").textContent)'), 40);
  assert.match(await b.evaluate('document.querySelector(".your-side .status-effects").textContent'), /LUKA · 1/);
  await a.click('.your-side [data-action="spell-details"]');
  assert.match(await a.evaluate('document.querySelector(".spell-dialog").textContent'), /menumpuk/);
  await a.click('.dialog-close');
  for (const tab of [a, b]) {
    await tab.click('[data-action="leave"]'); await tab.click('[data-action="confirm-leave"]');
    await tab.wait('document.querySelector(".menu-layout")');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 8 heroes, 6 spell cards, real assets, details, roster at 320/390/768/1024/1440px, loadout selection and persistence, lobby changes, private locks, Golar/Warfet duel, Retribution/Armor, HP wound ticks, and spell progress on both clients.');
} finally {
  await browser.close();
  app.dispose();
  await new Promise(resolve => app.server.close(resolve));
}
