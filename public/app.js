import { HEROES, CARD_BACK, MAX_ENERGY, SKILL_TYPES, damageLabel, findSkill } from './heroes.js';
import { BATTLE_SPELLS } from './spells.js';
import { createInterface, UPCOMING_HEROES } from './interface.js';
import { createAccountUI } from './account-ui.js';
import { createBgm } from './bgm.js';
import { createSoundEffects, createMatchAudio } from './audio.js';

const $ = selector => document.querySelector(selector);
const app = $('#app');
const storage = {
  get(key, session = false) { try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; } },
  set(key, value, session = false) { try { (session ? sessionStorage : localStorage).setItem(key, value); return true; } catch { return false; } },
  remove(key, session = false) { try { (session ? sessionStorage : localStorage).removeItem(key); } catch {} },
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = (name, cls = '') => {
  const paths = {
    sword: '<path d="m14 4 6-1-1 6-10 10-4-4L14 4ZM4 14l6 6M3 21l4-4"/>',
    bow: '<path d="M5 3c11 1 15 5 16 16L5 3Zm0 0 1 15 15 1M3 21 17 7m-5 0h5v5"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    link: '<path d="m10 13 4-4m-6 5-2 2a3 3 0 0 0 4 4l4-4m-4-8 4-4a3 3 0 0 1 4 4l-2 2"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    flame: '<path d="M13 2c2 8-5 8-3 13-3-1-3-4-3-4-5 6-1 11 5 11 8 0 10-10 1-20Z"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    crown: '<path d="m3 6 5 4 4-7 4 7 5-4-3 13H6L3 6Zm4 16h10"/>',
    cards: '<rect x="8" y="4" width="12" height="17" rx="1"/><path d="M5 19H3V2h12m-1 6 3 4-3 4-3-4 3-4Z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="m12 8 3 4-3 4-3-4 3-4Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-14 5h3m4 0h3"/>',
    trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v5m-4 1h8"/>',
    settings: '<path d="m10 3 4 0 1 3 3 1 3 3-2 2 0 3-3 3-3-1-2 2-3-2v-3l-3-2v-4l3-1 2-4Z"/><circle cx="12" cy="12" r="3"/>',
    music: '<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
    camera: '<path d="m8 5 2-2h4l2 2h5v16H3V5h5Z"/><circle cx="12" cy="12" r="4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  };
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sword}</svg>`;
};

let heroId = storage.get('empire.hero') || 'strom';
if (!Object.hasOwn(HEROES, heroId)) heroId = 'strom';
let battleSpellId = storage.get('empire.spell') || 'healing';
if (!Object.hasOwn(BATTLE_SPELLS, battleSpellId)) battleSpellId = 'healing';
let playerName = '';
let joinCode = new URL(location.href).searchParams.get('room')?.slice(0, 6).toUpperCase() || '';
const SCREENS = new Set(['friends', 'rank', 'home', 'matchmaking', 'heroes', 'profile', 'points', 'events', 'leaderboard', 'settings', 'login', 'register']);
let screen = joinCode ? 'matchmaking' : SCREENS.has(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
let localId = '';
let profileAvatar = null;
let bgmEnabled = storage.get('empire.bgm') === 'on';
const bgm = createBgm();
const ui = createInterface({ icon, escape, heroPills });
const accountUI = createAccountUI({ icon, escape, avatar: ui.avatar });
let profile = null;
let accountLoaded = false;
let social = null;
let leaders = null;
let globalMessages = [];
let friendDraft = '', globalDraft = '', lobbyDraft = '';
let pendingInviteUid = null;
let bestOf = 1;
let duelMode = 'casual';
let token = storage.get('empire.session', true);
const effects = createSoundEffects();
const matchAudio = createMatchAudio({ play: effects.play, storage });
let openingPending = !token;
function activateAudio() {
  effects.activate();
  if (openingPending) { openingPending = false; effects.play('welcome'); }
}
document.addEventListener('pointerup', activateAudio);
document.addEventListener('click', activateAudio);
document.addEventListener('keydown', event => { if (!event.repeat) activateAudio(); });
let state = null;
let stream = null;
let selectedSkill = null;
let selectedUltimateType = null;
let busy = false;
let connected = false;
let clockOffset = 0;
let lastAnnouncement = '';
let toastTimeout;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 4200);
}

function connection(value, text) {
  connected = value;
  $('.server-status').classList.toggle('offline', !value);
  $('#connection-label').textContent = text || (value ? 'Arena online' : 'Menghubungkan ulang');
  const banner = $('#network-banner');
  if (banner) banner.hidden = value;
}

async function api(route, body) {
  const res = await fetch(`/api/${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || 'Permintaan gagal. Coba lagi.');
    error.status = res.status;
    throw error;
  }
  return data;
}

function acceptState(next) {
  if (state && state.code === next.code && next.version < state.version) return;
  if (!state || state.round !== next.round || state.code !== next.code) { selectedSkill = null; selectedUltimateType = null; }
  if (next.phase === 'finished' && state?.phase !== 'finished') refreshProfile();
  const newReveal = ['reveal', 'finished'].includes(next.phase) && state?.phase === 'countdown';
  clockOffset = next.serverTime - Date.now();
  state = next;
  if (next.series?.settlement === 'saved') refreshProfile();
  matchAudio.observe(next);
  render();
  if (newReveal) {
    app.classList.add('just-revealed');
    setTimeout(() => app.classList.remove('just-revealed'), 850);
  }
}

function subscribe() {
  stream?.close();
  stream = new EventSource(`/api/events?session=${encodeURIComponent(token)}`);
  stream.addEventListener('state', event => {
    connection(true);
    acceptState(JSON.parse(event.data));
  });
  stream.onerror = () => connection(false);
}

function resetSession() {
  matchAudio.reset();
  stream?.close();
  stream = null;
  token = null;
  state = null;
  selectedSkill = null;
  selectedUltimateType = null;
  screen = 'home';
  storage.remove('empire.session', true);
  history.replaceState(null, '', `${location.pathname}#home`);
  render();
}

function heroPills(selected, action = 'choose-hero') {
  return `<div class="hero-pills">${Object.values(HEROES).map(h => `<button type="button" class="hero-pill ${selected === h.id ? 'selected' : ''}" data-action="${action}" data-hero="${h.id}" aria-pressed="${selected === h.id}" ${busy ? 'disabled' : ''}><img src="${h.image}" alt=""><span>${h.name}</span>${selected === h.id ? icon('check') : ''}</button>`).join('')}</div>`;
}

function spellPicker(selected, action = 'choose-spell') {
  return `<div class="spell-picker" role="group" aria-label="Pilih battle spell">${Object.values(BATTLE_SPELLS).map(spell => `<button type="button" class="spell-option ${selected === spell.id ? 'selected' : ''}" data-action="${action}" data-spell="${spell.id}" aria-pressed="${selected === spell.id}" ${busy ? 'disabled' : ''}><img src="${spell.image}" alt=""><span>${spell.name}</span>${selected === spell.id ? icon('check') : ''}</button>`).join('')}</div><p class="selected-spell-description">${selected ? BATTLE_SPELLS[selected].description : 'Pilih satu kartu bantuan untuk duel ini.'}</p>`;
}

function showSpell(id) {
  const spell = BATTLE_SPELLS[id];
  if (!spell) return;
  showDialog(`<span class="eyebrow">BATTLE SPELL · AKTIF OTOMATIS</span><h2>${spell.name}</h2><div class="spell-dialog"><img src="${spell.image}" alt="Kartu ${spell.name}"><div><strong>${spell.summary}</strong><p>${spell.description}</p><p>Pilih sebelum duel. Efeknya tetap aktif sepanjang pertandingan tanpa memakai energi skill.</p></div></div>`);
}

function renderMatchmaking() {
  const hero = HEROES[heroId];
  app.innerHTML = `
    <button class="page-back" data-page="home">${icon('arrow')} Menu utama</button>
    <section class="home-heading"><div><p class="eyebrow"><span class="gold-line"></span> MATCHMAKING</p><h1>Temui rivalmu.</h1><p class="subtitle">Buat room, bagikan kode, dan bawa hero pilihanmu ke arena.</p></div><div class="chapter"><span>01</span><div>MASUK KE<br>ARENA</div></div></section>
    <div class="home-grid">
      <section class="hero-showcase" aria-label="Pilih hero"><div class="showcase-top"><span class="eyebrow">PILIH LEGENDAMU</span><span class="small-muted">${String(Object.keys(HEROES).length).padStart(2, '0')} HERO TERSEDIA</span></div>
        <div class="showcase-orbit"></div><div class="showcase-watermark" aria-hidden="true">EMPIRE</div>
        <div class="hero-pair">${Object.values(HEROES).map((h, index) => `<button class="hero-display hero-${h.id} ${heroId === h.id ? 'is-selected' : ''}" data-action="choose-hero" data-hero="${h.id}" aria-label="Pilih ${h.name}" aria-pressed="${heroId === h.id}"><span class="hero-number">0${index + 1} <span>/ ${h.role}</span></span><div class="hero-art"><img src="${h.image}" alt="Kartu hero ${h.name}" fetchpriority="high"><span class="hero-selected">${icon('check')} HERO PILIHANMU</span></div><span class="hero-caption"><strong>${h.name}</strong><span>${h.element} <i>✦</i></span></span></button>`).join('')}</div>
        <div class="selected-profile"><div><span class="profile-symbol">${hero.id === 'strom' ? 'ϟ' : '✧'}</span><div><span class="eyebrow">${hero.role}</span><h2>${hero.title}</h2></div></div><div class="profile-stats"><span>${icon('heart')} <b>${hero.hp}</b> HP</span><span>${icon('shield')} <b>${hero.defense}</b> DEF</span><button class="icon-button" data-action="hero-details" data-hero="${heroId}" aria-label="Lihat skill ${hero.name}">${icon('arrow')}</button></div></div>
      </section>
      <aside class="lobby-panel"><div class="panel-heading"><span class="diamond">◇</span><span class="eyebrow">RUANG PERTARUNGAN</span></div><h2>Tulis kisahmu.</h2><p>Panggil seorang rival.<br>Buktikan pilihanmu di arena.</p>
        <form id="create-form"><label for="player-name">01 <span>NAMA PEMAIN</span></label><input id="player-name" name="name" autocomplete="nickname" maxlength="20" placeholder="Nama panggilanmu" value="${escape(playerName)}" readonly required>
          <label>02 <span>HERO PILIHANMU</span></label>${heroPills(heroId)}
          <label>03 <span>BATTLE SPELL</span></label>${spellPicker(battleSpellId)}
          <label>04 <span>FORMAT DUEL</span></label><div class="format-picker" role="group" aria-label="Jumlah pertandingan">${[1,3,5].map(count => `<button type="button" data-action="choose-format" data-count="${count}" aria-pressed="${bestOf === count}">${count} pertandingan<small>Menang ${Math.floor(count / 2) + 1} kali</small></button>`).join('')}</div><label>05 <span>MODE</span></label><div class="mode-picker"><button type="button" data-action="choose-mode" data-mode="casual" aria-pressed="${duelMode === 'casual'}">Casual</button><button type="button" data-action="choose-mode" data-mode="ranked" aria-pressed="${duelMode === 'ranked'}">Ranked · +15 / −5 WP</button></div>
          <button type="submit" class="button primary full" ${busy ? 'disabled' : ''}>${icon('sword')} ${busy ? 'Menyiapkan…' : 'Buat room duel'} ${icon('arrow')}</button>
        </form>
        <div class="divider"><span>SUDAH PUNYA KODE?</span></div>
        <form id="join-form" class="join-form"><label class="sr-only" for="room-code">Kode room</label><input id="room-code" name="code" maxlength="6" minlength="6" pattern="[A-Za-z2-9]{6}" autocomplete="off" placeholder="KODE ROOM" value="${escape(joinCode)}" required><button type="submit" class="button secondary" ${busy ? 'disabled' : ''}>Gabung ${icon('arrow')}</button></form>
        <button class="training-button" data-action="training" ${busy ? 'disabled' : ''}>Ingin pemanasan? <span>Latihan vs bot ↗</span></button>
        <p class="room-note"><i></i> 2 pemain · Langsung dari browser</p>
      </aside>
    </div>
    <section class="how-strip" aria-label="Alur duel"><div><span class="step-number">I</span><div><h3>Pilih hero</h3><p>Kenali kekuatan tiga skill-mu.</p></div></div><span class="step-arrow">⟶</span><div><span class="step-number">II</span><div><h3>Letakkan kartu tertutup</h3><p>Satu pilihan. Simpan strategimu.</p></div></div><span class="step-arrow">⟶</span><div><span class="step-number">III</span><div><h3>4 detik menuju takdir</h3><p>Terbuka bersama. Bertarung bersama.</p></div></div></section>`;
}

function roomHeader(title, subtitle) {
  return `<div id="network-banner" class="network-banner" ${connected ? 'hidden' : ''}>Koneksi terputus. Menghubungkan ulang; kartu yang sudah dikunci tetap tersimpan.</div><section class="room-heading"><div><p class="eyebrow">${state.players.some(p => p.bot) ? 'ARENA LATIHAN' : 'DUEL DUA PEMAIN'} <span class="heading-dot">•</span> ${escape(state.code)}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="room-tools"><button class="button secondary compact" data-action="copy-link">${icon('link')} Undang rival</button><button class="text-button" data-action="leave">Keluar ${icon('arrow')}</button></div></section>`;
}

function renderLobby() {
  const me = state.players.find(p => p.id === state.you);
  const rival = state.players.find(p => p.id !== state.you);
  app.innerHTML = `${roomHeader('Legenda akan bertemu.', 'Pilih hero dan battle spell, lalu bersiap memasuki arena.')}
    ${seriesScore()}<div class="waiting-layout"><section class="waiting-arena"><div class="waiting-player"><span class="eyebrow">KAMU ${me.ready ? '· SIAP' : ''}</span><img class="waiting-hero" src="${HEROES[me.heroId].image}" alt="${HEROES[me.heroId].name}"><h2>${escape(me.name)}</h2><p>${HEROES[me.heroId].name}</p>${heroPills(me.heroId, 'room-hero')}<span class="eyebrow lobby-spell-label">BATTLE SPELL</span>${spellPicker(me.battleSpellId, 'room-spell')}</div><div class="versus"><span>VS</span><i>✦</i></div><div class="waiting-player ${rival ? '' : 'empty-player'}"><span class="eyebrow">${rival ? rival.ready ? 'RIVAL · SIAP' : 'RIVAL · BELUM SIAP' : 'MENUNGGU RIVAL'}</span><img class="waiting-hero" src="${rival ? HEROES[rival.heroId].image : CARD_BACK}" alt="${rival ? HEROES[rival.heroId].name : 'Slot pemain kedua'}"><h2>${rival ? escape(rival.name) : 'Kursi kosong'}</h2><p>${rival ? HEROES[rival.heroId].name : 'Undang teman untuk bergabung'}</p>${rival?.battleSpellId ? `<button class="rival-spell-preview" data-action="spell-details" data-spell="${rival.battleSpellId}"><img src="${BATTLE_SPELLS[rival.battleSpellId].image}" alt=""><span>${BATTLE_SPELLS[rival.battleSpellId].name}</span></button>` : ''}<span class="presence ${rival?.connected ? 'online' : ''}">${rival ? rival.bot ? 'BOT LATIHAN' : rival.connected ? 'TERHUBUNG' : 'MENGHUBUNGKAN…' : 'SIAP MENJADI RIVALMU?'}</span></div></section>
    <aside class="lobby-panel waiting-controls"><span class="eyebrow">KODE ROOM</span><button class="room-code-big" data-action="copy-code" aria-label="Salin kode room ${state.code}">${state.code} ${icon('copy')}</button><p>Bagikan kode atau tautan room ke perangkat kedua.</p><button class="button secondary full" data-action="copy-link">${icon('link')} Salin tautan undangan</button><div class="thin-divider"></div><h3>Satu kartu, satu keputusan.</h3><p>Pilih satu skill secara rahasia. Setelah kedua kartu terkunci, hitungan 4 detik dimulai.</p><div class="ready-summary"><i class="${me.ready ? 'is-ready' : ''}"></i> ${me.ready ? 'Kamu sudah siap' : 'Hero pilihanmu sudah di arena'}<br><i class="${rival?.ready ? 'is-ready' : ''}"></i> ${rival ? rival.ready ? 'Rival sudah siap' : 'Menunggu rival bersiap' : 'Menunggu pemain kedua'}</div><button class="button primary full" data-action="ready" ${busy ? 'disabled' : ''}>${icon(me.ready ? 'check' : 'sword')} ${me.ready ? 'Batalkan siap' : 'Aku siap bertarung'}</button><p class="room-note">Pertandingan dimulai saat kedua pemain siap.</p>${!rival ? '<button class="button secondary full" data-action="invite-friend">Undang dari daftar teman</button>' : ''}</aside></div>${lobbyChat()}`;
}

function seriesScore() {
  if (!state?.series) return '';
  const series = state.series;
  return `<section class="series-score" aria-label="Skor seri"><span>${state.mode === 'ranked' ? 'RANKED' : state.mode === 'training' ? 'LATIHAN' : 'CASUAL'} · BO${series.bestOf}</span><div>${state.players.map(p => `<span>${escape(p.name)} <b>${series.scores[p.id] || 0}</b></span>`).join('<i>:</i>')}</div><small>Pertandingan ${series.match} · Target ${series.targetWins} kemenangan</small></section>`;
}
function lobbyChat() {
  return `<section class="lobby-chat"><h2>Chat lobby</h2><div class="chat-messages" aria-live="polite">${accountUI.messages(state.chat || [])}</div><form id="lobby-chat-form" class="inline-form"><label class="sr-only" for="lobby-chat-input">Pesan lobby</label><input id="lobby-chat-input" name="message" maxlength="240" value="${escape(lobbyDraft)}" placeholder="Kirim pesan ke rival…" required><button class="button primary" ${busy ? 'disabled' : ''}>Kirim</button></form></section>`;
}
function renderResult() {
  const me = state.players.find(p => p.id === state.you);
  const winner = state.result.winnerId;
  const won = winner === state.you, draw = winner === null;
  const complete = state.series.finished;
  const label = draw ? 'IMBANG' : won ? 'VICTORY' : 'DEFEAT';
  app.innerHTML = `<section class="result-screen ${won ? 'is-victory' : ''}"><span class="result-emblem">${icon(draw ? 'shield' : 'trophy')}</span><span class="eyebrow">${complete ? 'SERI DUEL SELESAI' : `PERTANDINGAN ${state.series.match} SELESAI`}</span><h1>${draw ? 'Pertarungan seimbang.' : won ? 'Kemenangan milikmu.' : 'Kesempatan baru menanti.'}</h1><p>${state.result.reason === 'forfeit' ? 'Duel berakhir karena salah satu pemain keluar.' : complete ? `${won ? 'Kamu' : 'Rival'} memenangkan seri duel ini.` : `Seri belum berakhir. Raih ${state.series.targetWins} kemenangan untuk menjadi pemenang duel.`}</p>${seriesScore()}<div class="result-portraits">${state.players.map(p => `<div class="${winner === p.id ? 'match-winner' : ''}"><img src="${HEROES[p.heroId].image}" alt="${HEROES[p.heroId].name}"><strong>${escape(p.name)}</strong><span>${winner === p.id ? 'MENANG' : draw ? 'IMBANG' : 'KALAH'}</span></div>`).join('')}</div><section class="result-panel"><div><span class="eyebrow">${label}</span><h2>${complete ? 'Siap untuk duel berikutnya?' : 'Lanjutkan perebutan kemenangan.'}</h2><p>Hero dan battle spell dapat diganti di lobby berikutnya.</p></div><div class="result-actions"><button class="button primary" data-action="rematch" ${busy || me.rematch || state.result.reason === 'forfeit' ? 'disabled' : ''}>${icon('sword')}${state.result.reason === 'forfeit' ? 'Lawan sudah keluar' : me.rematch ? 'Menunggu rival melanjutkan…' : complete ? 'Main seri lagi' : 'Lanjut ke lobby berikutnya'}</button><button class="button secondary" data-action="leave">Keluar ke menu ${icon('arrow')}</button></div></section>${state.series.settlement === 'error' ? '<p class="result-sync">Poin belum tersimpan. Coba tombol main lagi untuk menyinkronkan ulang.</p>' : complete && state.mode === 'ranked' ? `<p class="result-sync">${state.series.settlement === 'saved' ? `Poin tersimpan · ${won ? '+15 WP' : '−5 WP (minimum 0)'}` : 'Menyimpan hasil ranked…'}</p>` : ''}</section>${lobbyChat()}<details class="result-history"><summary>Lihat jejak pertandingan</summary>${renderHistory()}</details>`;
}

function skillType(skill) {
  const type = SKILL_TYPES[skill.type];
  return type ? `${icon(type.icon)} ${type.name}` : `${icon('crown')} Pilih tipe`;
}

function skillVisual(skill) {
  return `<span class="live-skill-face"><img src="${skill.image}" alt="Ilustrasi ${skill.name}"><span class="live-skill-copy"><span class="live-skill-type">${skillType(skill)}</span><strong>${skill.name}</strong><b>${damageLabel(skill)} <small>DMG</small></b><span class="live-skill-effect">${skill.summary}</span></span></span>`;
}

function energyPips(value) {
  return `<span class="energy-pips" aria-label="Energi ${value} dari ${MAX_ENERGY}">${Array.from({ length: MAX_ENERGY }, (_, i) => `<i class="${i < value ? 'filled' : ''}"></i>`).join('')}</span>`;
}

function heroFormation(player, mine) {
  const hero = HEROES[player.heroId];
  const spell = BATTLE_SPELLS[player.battleSpellId];
  const progress = player.battleSpellId === 'inspire' ? `${player.spellCounters % 3} / 3 COUNTER` : player.battleSpellId === 'dodge' ? `${player.spellCountered % 3} / 3 DICOUNTER` : player.battleSpellId === 'retribution' ? `+${player.spellBonus} DAMAGE` : player.battleSpellId === 'healing' ? `HEAL · BABAK ${Math.ceil(state.round / 3) * 3}` : 'AKTIF OTOMATIS';
  const ready = Boolean(player.ultimate?.ready);
  const canUse = mine && ready && state.phase === 'selecting' && !player.locked && !player.skipped && !busy;
  const ultimate = hero.ultimate ? `<button class="formation-aux ultimate-slot ${ready ? 'is-ready' : 'is-inactive'}" data-action="select-ultimate" ${canUse ? '' : 'disabled'} aria-label="${hero.ultimate.name}: ${ready ? 'siap, pilih tipe untuk menggunakan' : 'habiskan seluruh energi untuk mengaktifkan'}"><span class="aux-label">ULTIMATE KHUSUS</span><span class="aux-frame ultimate-card-art"><img src="${hero.ultimate.image}" alt="${hero.ultimate.name}"><strong>${hero.ultimate.name}</strong></span><small>${player.choice === hero.ultimate.id ? 'TERKUNCI' : ready ? 'SIAP · 1 KALI' : 'HABISKAN SEMUA ENERGI'}</small></button>` : `<button class="formation-aux ultimate-slot is-inactive" disabled aria-label="Ultimate khusus belum aktif"><span class="aux-label">ULTIMATE KHUSUS</span><span class="aux-frame">${icon('crown')}<span>Belum aktif</span></span><small>SEGERA HADIR</small></button>`;
  return `<div class="hero-formation"><div class="formation-name"><span class="eyebrow">${mine ? 'KAMU' : 'RIVAL'} · ${hero.role}</span><h2>${escape(player.name)}</h2></div><div class="formation-cards">
    ${spell ? `<button class="formation-aux spell-slot" data-action="spell-details" data-spell="${spell.id}" aria-label="Battle spell ${spell.name}: ${spell.description}"><span class="aux-label">BATTLE SPELL</span><span class="aux-frame spell-card-art"><img src="${spell.image}" alt="${spell.name}"><strong>${spell.name}</strong></span><small>${progress}</small></button>` : `<div class="formation-aux spell-slot"><span class="aux-label">BATTLE SPELL</span><div class="aux-frame">${icon('cards')}<span>Tanpa spell</span></div></div>`}
    <div class="formation-hero"><img src="${hero.image}" alt="Kartu hero ${hero.name}"><strong>${hero.name}</strong></div>
    ${ultimate}
  </div></div>`;
}

function playerHud(player, mine) {
  const hero = HEROES[player.heroId];
  const statuses = [
    player.burn ? `<span class="burn-status">${icon('flame')} BURN · ${player.burn}</span>` : '',
    player.stun ? `<span class="stun-status">ϟ STUN · ${player.stun}</span>` : '',
    player.hypno ? `<span class="hypno-status">◉ HYPNO · ${player.hypno}</span>` : '',
    player.reductionTurns ? `<span class="guard-status">${icon('shield')} −${Math.round(player.reduction * 100)}% DMG · ${player.reductionTurns}</span>` : '',
    player.damageBuffTurns ? `<span class="buff-status">${icon('sword')} +${player.damageBuff} DMG · ${player.damageBuffTurns}</span>` : '',
    player.immuneTurns ? `<span class="immune-status">${icon('shield')} IMUN · ${player.immuneTurns}</span>` : '',
    player.woundTurns ? `<span class="burn-status">LUKA · ${player.woundTurns}</span>` : '',
    player.soulDrainTurns ? `<span class="burn-status">SOUL THIEF · ${player.soulDrainTurns}</span>` : '',
    player.scarTurns ? `<span class="burn-status">SCAR · ${player.scarTurns}</span>` : '',
    player.cursed ? '<span class="hypno-status">CURSE · PERMANEN</span>' : '',
    player.flatReductionTurns ? `<span class="guard-status">−${player.flatReduction} DMG · ${player.flatReductionTurns}</span>` : '',
    player.basicBuff ? `<span class="buff-status">+${player.basicBuff} DMG SKILL 1–3</span>` : '',
    player.multiplierTurns ? `<span class="buff-status">${player.damageMultiplier}× SKILL 1–3 · ${player.multiplierTurns}</span>` : '',
    player.soulStacks ? `<span class="buff-status">JIWA · ${player.soulStacks} (+${player.soulStacks * 10} HEAL)</span>` : '',
    player.hitBonus ? `<span class="buff-status">BLOOD THIRST · +${player.hitBonus}</span>` : '',
    player.spellBonus ? `<span class="buff-status">RETRIBUTION · +${player.spellBonus}</span>` : '',
  ].filter(Boolean);
  return `<div class="player-hud ${mine ? 'your-hud' : 'rival-hud'}"><div class="hud-info">
    <div class="stat-row hp-row">${icon('heart')}<div class="bar"><span style="width:${player.hp / hero.hp * 100}%"></span></div><span><b>${player.hp}</b> / ${hero.hp}</span></div>
    <div class="stat-row defense-row">${icon('shield')}<div class="bar"><span style="width:${player.defense / hero.defense * 100}%"></span></div><span><b>${player.defense}</b> / ${hero.defense}</span></div>
    <div class="hud-energy" aria-label="Energi skill ${escape(player.name)}">${hero.skills.map(skill => `<div class="energy-meter ${player.energy[skill.id] === 0 ? 'depleted' : ''}" title="${skill.name}: ${player.energy[skill.id]} / ${MAX_ENERGY}"><span>${skillType(skill)}</span>${energyPips(player.energy[skill.id])}</div>`).join('')}</div>
    <div class="status-effects">${statuses.length ? statuses.join('') : '<span>Tanpa efek status</span>'}${!mine && !player.connected ? '<span class="disconnected-status">Menghubungkan ulang…</span>' : ''}</div>
  </div></div>`;
}

const OUTCOME_LABELS = { counter: 'COUNTER BERHASIL', countered: 'TERCOUNTER', unopposed: 'TANPA PERLAWANAN', stunned: 'TERKENA STUN' };

function battleSlot(player, mine) {
  const reveal = ['reveal', 'finished'].includes(state.phase) && state.result?.reason !== 'forfeit';
  const skill = reveal && findSkill(player.heroId, player.choice, player.choiceType);
  const entry = reveal && state.lastRound?.entries.find(e => e.playerId === player.id);
  const skipped = player.skipped;
  const caption = entry ? OUTCOME_LABELS[entry.outcome] : skipped ? 'STUN · LEWATI BABAK' : player.locked ? 'TERKUNCI' : 'MEMILIH';
  let card = `<span class="empty-card-icon">◇</span><span>Letakkan<br>satu kartu skill</span>`;
  if (skipped) card = '<span class="empty-card-icon stun-symbol">ϟ</span><strong>STUN</strong><span>Tidak bisa<br>melakukan sweep</span>';
  else if (skill) card = skillVisual(skill);
  else if (player.locked) card = `<img src="${CARD_BACK}" alt="Kartu skill tertutup"><span class="card-lock">${icon('lock')}</span>`;
  return `<div class="battle-slot ${player.locked && !skipped ? 'locked' : ''} ${skill ? 'revealed' : ''} ${entry?.outcome === 'countered' ? 'countered-card' : ''}">
    <div class="slot-label">${mine ? 'KARTUMU' : 'KARTU RIVAL'}<span>${skipped ? 'STUN' : skill ? SKILL_TYPES[skill.type].name.toUpperCase() : player.locked ? 'TERKUNCI' : 'MEMILIH'}</span></div>
    <div class="placed-card ${skill ? 'face-up' : ''} ${skipped ? 'stunned-slot' : ''}">${card}</div>
    <div class="slot-caption"><strong>${caption}</strong><span>${entry ? `${entry.attack} DAMAGE${entry.passiveAttack ? ` · PASIF ${entry.passiveAttack}` : ''}${entry.reflected ? ' · KE DIRI SENDIRI' : ''}` : skipped ? 'Menunggu langkah rival' : player.locked ? 'Pilihanmu tetap rahasia' : mine ? 'Pilih tipe untuk counter' : 'Menyusun strategi…'}</span></div>
  </div>`;
}

function phaseText() {
  const me = state.players.find(p => p.id === state.you);
  if (state.phase === 'countdown') return ['Takdir segera terbuka.', 'Pilihan terkunci. Hasil counter ditentukan saat hitungan selesai.'];
  if (state.phase === 'reveal') return ['Dua pilihan. Satu counter.', 'Hanya skill yang berhasil counter yang aktif. Tipe sama menggagalkan kedua skill.'];
  if (state.phase === 'finished') return state.result.winnerId === null ? ['Duel berakhir imbang.', 'Kedua hero jatuh pada saat yang sama.'] : state.result.winnerId === state.you ? ['Arena ini milikmu.', state.result.reason === 'forfeit' ? 'Rival telah meninggalkan duel.' : 'Pilihanmu mengantarkan kemenangan.'] : ['Legenda belum berakhir.', 'Pelajari rivalmu. Kembali lebih kuat.'];
  if (me.skipped) return ['Hero-mu terkena stun.', 'Babak ini dilewati tanpa memakai energi. Rival bisa menyerang tanpa perlawanan.'];
  return me.choice ? ['Strategimu telah terkunci.', 'Menunggu rival meletakkan kartu skill.'] : ['Apa langkahmu kali ini?', 'Pilih tipe yang mengcounter rival. Setiap skill memiliki 3 energi.'];
}

function renderBattle() {
  const me = state.players.find(p => p.id === state.you);
  const rival = state.players.find(p => p.id !== state.you);
  const hero = HEROES[me.heroId];
  const [title, subtitle] = phaseText();
  const canChoose = state.phase === 'selecting' && !me.locked && !me.skipped && !busy;
  const chosen = findSkill(me.heroId, selectedSkill, selectedUltimateType);
  const energyId = chosen?.isUltimate ? hero.skills.find(skill => skill.type === selectedUltimateType)?.id : chosen?.id;
  const canLock = canChoose && chosen && me.energy[energyId] > 0 && (!chosen.isUltimate || me.ultimate?.ready);
  const ultimatePicker = chosen?.isUltimate ? `<div class="ultimate-selection">${skillVisual(chosen)}<p>Pilih tipe counter · memakai 1 energi tipe yang dipilih.</p><div class="ultimate-types" aria-label="Tipe ultimate">${hero.skills.map(skill => `<button data-action="ultimate-type" data-type="${skill.type}" aria-pressed="${selectedUltimateType === skill.type}" ${!canChoose || me.energy[skill.id] <= 0 ? 'disabled' : ''}>${skillType(skill)}<small>${me.energy[skill.id]} / 3</small></button>`).join('')}</div></div>` : '';
  const center = `<div class="battle-center"><div class="round-counter"><span>BABAK</span><strong>${String(state.round).padStart(2, '0')}</strong></div><span class="eyebrow">${state.phase === 'countdown' ? 'TERBUKA DALAM' : state.phase === 'reveal' ? 'BABAK BERIKUTNYA' : state.phase === 'finished' ? 'DUEL SELESAI' : 'COUNTER ARENA'}</span><div class="countdown-ring ${state.phase === 'countdown' ? 'counting' : ''}" role="timer" aria-live="polite"><span id="countdown-value">${state.phase === 'finished' ? '✦' : state.deadline ? '4' : 'VS'}</span></div><p id="center-caption">${state.phase === 'selecting' ? `${state.players.filter(p => p.locked).length} / 2 siap` : state.phase === 'finished' ? state.result.winnerId === null ? 'IMBANG' : state.result.winnerId === state.you ? 'KEMENANGAN' : 'KEKALAHAN' : 'detik'}</p></div>`;
  app.innerHTML = `${roomHeader(title, subtitle)}
    ${seriesScore()}<div class="counter-guide"><span>${icon('sword')} Pedang <b>›</b> ${icon('shield')} Perisai <b>›</b> ${icon('bow')} Panah <b>›</b> ${icon('sword')} Pedang</span><span>Tipe sama: kedua skill gagal</span></div>
    <section class="battle-board battle-table" aria-label="Papan duel dua sisi"><div class="board-ornament" aria-hidden="true">✦</div><section class="battle-side your-side" aria-label="Sisi pemainmu">${heroFormation(me, true)}${battleSlot(me, true)}${playerHud(me, true)}</section>${center}<section class="battle-side rival-side" aria-label="Sisi rival">${heroFormation(rival, false)}${battleSlot(rival, false)}${playerHud(rival, false)}</section></section>
    ${state.phase === 'finished' ? `<section class="result-panel"><div><span class="eyebrow">${state.result.winnerId === state.you ? 'VICTORY' : state.result.winnerId === null ? 'DRAW' : 'DEFEAT'}</span><h2>${state.result.winnerId === state.you ? 'Kemenangan yang pantas dirayakan.' : 'Masih ada duel berikutnya.'}</h2></div><button class="button primary" data-action="rematch" ${busy || me.rematch || state.result.reason === 'forfeit' ? 'disabled' : ''}>${icon('sword')} ${state.result.reason === 'forfeit' ? 'Rival sudah keluar' : me.rematch ? 'Menunggu rival…' : 'Duel lagi'}</button></section>` : `<section class="skill-tray"><div class="tray-heading"><div><span class="eyebrow">TANGANMU</span><h2>Tiga tipe. Satu pilihan.</h2></div><span class="small-muted">${me.skipped ? 'STUN · TIDAK BISA MEMILIH' : me.locked ? 'KARTU SUDAH TERKUNCI' : 'PEDANG · PANAH · PERISAI'}</span></div><div class="hand-layout"><div class="skill-hand">${hero.skills.map((skill, index) => {
      const banned = me.energy[skill.id] === 0;
      return `<button class="skill-card ${selectedSkill === skill.id ? 'chosen' : ''} ${me.choice === skill.id ? 'used' : ''} ${banned ? 'banned' : ''}" data-action="select-skill" data-skill="${skill.id}" aria-pressed="${selectedSkill === skill.id}" aria-label="${skill.name}, tipe ${SKILL_TYPES[skill.type].name}, ${damageLabel(skill)} damage, energi ${me.energy[skill.id]} dari 3. ${skill.effect}" ${!canChoose || banned ? 'disabled' : ''}><span class="skill-index">0${index + 1}</span>${skillVisual(skill)}<span class="skill-card-label">${skillType(skill)}<span class="hand-energy">${energyPips(me.energy[skill.id])}<small>${banned ? 'BAN' : `${me.energy[skill.id]} / 3`}</small></span></span></button>`;
    }).join('')}</div><div class="skill-detail">${ultimatePicker}<span class="eyebrow">${chosen ? chosen.isUltimate ? 'ULTIMATE KHUSUS' : SKILL_TYPES[chosen.type].name.toUpperCase() : me.skipped ? 'CROWD CONTROL' : 'TENTUKAN STRATEGIMU'}</span><h3>${me.skipped ? 'Tahan serangan rival.' : chosen ? chosen.name : me.locked ? 'Percayai pilihanmu.' : 'Baca langkah lawan.'}</h3><p>${me.skipped ? 'Stun melewati babak ini tanpa memakai energi atau memicu pasif counter.' : chosen ? chosen.effect : 'Skill yang dicounter kehilangan serangan dan efeknya. Gunakan tiga tipe dengan bijak sebelum energi diisi ulang.'}</p><button class="button primary full" data-action="lock" ${!canLock ? 'disabled' : ''}>${icon(me.locked ? 'check' : 'lock')} ${me.skipped ? 'Terkena stun' : me.locked ? 'Kartu terkunci' : chosen?.isUltimate && !selectedUltimateType ? 'Pilih tipe ultimate' : chosen && me.energy[energyId] === 0 ? 'Energi habis' : 'Letakkan kartu tertutup'}</button><span class="skill-hint">Energi penuh kembali setelah ketiga skill habis.</span></div></div></section>`}
    ${renderHistory()}`;
  updateClock();
}

function renderHistory() {
  if (!state.history.length) return '<p class="history-empty">Jejak pertarungan akan tertulis setelah kartu pertama terbuka.</p>';
  return `<section class="battle-history"><div class="history-heading"><span class="eyebrow">JEJAK PERTARUNGAN</span><span>${state.history.length} BABAK TERCATAT</span></div>${[...state.history].reverse().slice(0, 5).map(round => `<div class="history-row"><span class="history-round">${String(round.round).padStart(2, '0')}</span>${round.entries.map(entry => {
    const player = state.players.find(p => p.id === entry.playerId);
    const skill = findSkill(player.heroId, entry.skillId, entry.type);
    return `<div><strong>${escape(player.name)} <span>· ${skill?.name || 'Stun'}</span></strong><p class="history-outcome ${entry.outcome}">${OUTCOME_LABELS[entry.outcome]}</p><p>${entry.attack} damage${entry.passiveAttack ? ` · Pasif ${entry.passiveAttack}` : ''}${entry.defenseGained ? ` · +${entry.defenseGained} DEF` : ''}${entry.prevented ? ` · ${entry.prevented} ditahan` : ''}${entry.reflected ? ' · Hypno: menyerang diri sendiri' : ''}${entry.executed ? ' · EXECUTE: eliminasi' : ''}${entry.spellExecuted ? ' · SPELL EXECUTE: eliminasi' : ''}${entry.dodged ? ' · DODGE AKTIF' : ''}${entry.inspired ? ' · INSPIRE 3×' : ''}${entry.shieldReflected ? ' · DAMAGE DIPANTULKAN' : ''}${entry.hpCost ? ` · Biaya ${entry.hpCost} HP` : ''}${entry.healed || entry.spellHealed ? ` · Pulih ${entry.healed + entry.spellHealed} HP` : ''}${entry.defenseDrained ? ` · ${entry.defenseDrained} DEF dikuras` : ''}<span class="received">Terima ${entry.received}${entry.burnDamage ? ` + ${entry.burnDamage} burn` : ''}${entry.dotDamage ? ` + ${entry.dotDamage} efek berkala` : ''} damage</span></p>${entry.energyRefilled ? `<p class="energy-refilled">Semua energi terisi penuh${entry.ultimateActivated ? ' · ULTIMATE AKTIF' : ''}</p>` : ''}</div>`;
  }).join('')}</div>`).join('')}</section>`;
}

function localProfile() {
  return profile ? { ...profile, id: profile.uid } : { name: 'Petarung', id: '', avatar: null };
}

function render() {
  const activeId = document.activeElement?.id;
  const selection = document.activeElement?.selectionStart;
  const currentProfile = localProfile();
  document.body.dataset.screen = !profile ? 'auth' : state ? state.phase === 'lobby' ? 'lobby' : state.phase === 'finished' ? 'results' : 'arena' : screen;
  $('#header-profile').innerHTML = ui.avatar(currentProfile);
  $('#header-coin').innerHTML = `${icon('coin')} <b>${profile?.coins || 0}</b>`;
  document.querySelectorAll('[data-page]').forEach(button => { if (button.closest('nav')) button.classList.toggle('active', !state && button.dataset.page === screen); });
  if (!accountLoaded) { app.innerHTML = '<div class="loading">Menyiapkan arena…</div>'; return; }
  if (!profile) app.innerHTML = accountUI.auth({ register: screen === 'register', busy });
  else if (state) {
    if (state.phase === 'lobby') renderLobby();
    else if (state.phase === 'finished') renderResult();
    else renderBattle();
  } else if (screen === 'matchmaking') renderMatchmaking();
  else if (screen === 'heroes') app.innerHTML = ui.collection();
  else if (['home','profile','rank','points','leaderboard','friends'].includes(screen)) app.innerHTML = accountUI[screen]({ profile, heroId, social, leaders, globalMessages, friendDraft, globalDraft, busy });
  else if (screen === 'login' || screen === 'register') { screen = 'home'; app.innerHTML = accountUI.home({ profile, heroId, social }); }
  else app.innerHTML = ui[screen]({ profile: currentProfile, heroId, bgmEnabled });
  if (activeId && ['lobby-chat-input','global-chat-input','friend-uid'].includes(activeId)) {
    const field = document.getElementById(activeId);
    field?.focus({ preventScroll: true });
    if (typeof selection === 'number') field?.setSelectionRange(selection, selection);
  }
}

async function refreshProfile() {
  let changed = false;
  try {
    const data = await api('me');
    changed = JSON.stringify(profile) !== JSON.stringify(data.profile);
    profile = data.profile;
    if (profile) { playerName = profile.name; profileAvatar = profile.avatar; localId = profile.uid; }
  }
  catch { return; }
  if (accountLoaded && changed && !busy) render();
}
async function refreshSocial() {
  if (!profile) return;
  try {
    const next = await api('social');
    const changed = JSON.stringify(social) !== JSON.stringify(next);
    social = next;
    if (changed && !busy && !state && ['home', 'friends'].includes(screen)) render();
  } catch {}
}
async function loadPageData(page) {
  if (!profile) return;
  try {
    if (page === 'leaderboard') { leaders = (await api('leaderboard')).players; render(); }
    if (page === 'friends') { await refreshSocial(); globalMessages = (await api('global-chat')).messages; render(); }
    if (['home','profile','rank','points'].includes(page)) refreshProfile();
  } catch (error) { toast(error.message); }
}

function confirmLeave() {
  showDialog(`<span class="eyebrow">TINGGALKAN ARENA</span><h2>Keluar dari room?</h2><p>${state.phase === 'lobby' && !state.series.matches.length || state.series.finished ? 'Kamu bisa membuat atau bergabung ke room baru setelah keluar.' : 'Seri duel belum selesai. Keluar sekarang memberikan kemenangan duel kepada rival.'}</p><div class="dialog-actions"><button class="button secondary" data-action="stay">Tetap di arena</button><button class="button primary" data-action="confirm-leave">Keluar dari room</button></div>`);
}

function navigate(page, push = true) {
  if (!SCREENS.has(page) || busy) return;
  if (state) { confirmLeave(); return; }
  $('#info-dialog').close();
  screen = !profile && !['login', 'register'].includes(page) ? 'login' : page;
  if (push) {
    const url = new URL(location.href);
    url.hash = page;
    history.pushState(null, '', url);
  }
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  app.focus({ preventScroll: true });
  loadPageData(screen);
}

window.addEventListener('popstate', () => {
  if (state) return;
  navigate(SCREENS.has(location.hash.slice(1)) ? location.hash.slice(1) : 'home', false);
});

async function saveAvatar(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast('Pilih gambar JPG, PNG, atau WebP.'); return; }
  if (file.size > 2 * 1024 * 1024) { toast('Ukuran foto maksimal 2 MB.'); return; }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    const size = Math.min(bitmap.width, bitmap.height);
    context.fillStyle = '#111720';
    context.fillRect(0, 0, 256, 256);
    context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
    const data = canvas.toDataURL('image/jpeg', 0.85);
    profile = (await api('profile', { avatar: data })).profile;
    profileAvatar = profile.avatar;
    render();
    toast('Foto profil akun disimpan.');
  } catch { toast('Gambar tidak bisa dibaca. Pilih foto lain.'); }
  finally { bitmap?.close(); }
}

async function resumeBgm() {
  if (!bgmEnabled) return;
  try { await bgm.setEnabled(true); } catch { /* Settings can retry on supported browsers. */ }
}

document.addEventListener('pointerdown', resumeBgm, { once: true });
document.addEventListener('keydown', resumeBgm, { once: true });

function updateClock() {
  const number = $('#countdown-value');
  if (!number || !state?.deadline) return;
  const remaining = Math.max(0, Math.ceil((state.deadline - Date.now() - clockOffset) / 1000));
  const value = remaining === 0 ? '✦' : String(remaining);
  if (number.textContent !== value) number.textContent = value;
  if (state.phase === 'countdown' && lastAnnouncement !== `${state.round}:${remaining}`) {
    lastAnnouncement = `${state.round}:${remaining}`;
    number.parentElement.setAttribute('aria-label', `Kartu terbuka dalam ${remaining} detik`);
  }
}

async function action(work) {
  if (busy) return;
  busy = true;
  render();
  try { await work(); }
  catch (error) {
    if (error.status === 401) { profile = null; resetSession(); }
    toast(error.name === 'TypeError' || error.name === 'TimeoutError' ? 'Server belum terhubung. Periksa koneksi dan coba lagi.' : error.message);
  } finally { busy = false; render(); }
}

function saveIdentity() {
  playerName = playerName.trim();
  if (!playerName) { toast('Isi nama panggilanmu terlebih dahulu.'); $('#player-name')?.focus(); return false; }
  storage.set('empire.hero', heroId);
  return true;
}

async function enterRoom(mode, joining = false, inviteId = null) {
  if (!saveIdentity()) return;
  await action(async () => {
    const result = await api(joining ? 'join' : 'rooms', { heroId, battleSpellId, bestOf, mode: mode === 'training' ? 'training' : duelMode, ...(joining ? { code: joinCode, ...(inviteId ? { inviteId } : {}) } : {}) });
    token = result.token;
    storage.set('empire.session', token, true);
    acceptState(result.state);
    history.replaceState(null, '', `?room=${state.code}`);
    subscribe();
    if (pendingInviteUid && !joining) { await api('invite', { uid: pendingInviteUid }); pendingInviteUid = null; toast('Undangan dikirim ke teman.'); }
  });
}

function showDialog(html) {
  $('#dialog-content').innerHTML = html;
  $('#info-dialog').showModal();
}

function showHero(id) {
  const hero = HEROES[id];
  showDialog(`<span class="eyebrow">${hero.role} · ${hero.element}</span><h2>${hero.name}</h2><p>${hero.description}</p><div class="dialog-stats">${icon('heart')} ${hero.hp} HP ${icon('shield')} ${hero.defense} DEF</div>${hero.passive ? `<div class="passive-description"><b>PASIF · ${hero.passive.name || 'BALASAN COUNTER'}</b><p>${hero.passive.description}</p></div>` : ''}<div class="collection-skills">${[...hero.skills, ...(hero.ultimate ? [hero.ultimate] : [])].map(s => `<div>${skillVisual(s)}<h3>${s.name}</h3><strong>${s.isUltimate ? 'ULTIMATE · PILIH TIPE' : SKILL_TYPES[s.type].name.toUpperCase()} · ${damageLabel(s)} DAMAGE</strong><p>${s.effect}</p></div>`).join('')}</div>`);
}

function showRules() {
  showDialog(`<span class="eyebrow">PANDUAN ARENA</span><h2>Baca pilihan.<br>Menangkan counter.</h2><ol class="rules-list"><li><b>Pilih format seri: 1, 3, atau 5 pertandingan.</b><p>Menangkan 1, 2, atau 3 pertandingan untuk menang seri. Imbang tidak menambah skor. Kedua pemain memilih lanjut untuk kembali ke lobby dan mengganti hero atau spell. Keluar dari seri yang belum selesai berarti menyerah.</p></li><li><b>Pilih satu hero dan satu battle spell.</b><p>Delapan hero dan enam kartu bantuan tersedia. Battle spell bekerja otomatis sepanjang pertandingan; pilihan dapat diganti di lobby sebelum bersiap.</p></li><li><b>Letakkan satu kartu skill tertutup.</b><p>Setelah kedua kartu terkunci, timer 4 detik dimulai dan kartu dibuka bersama. Stun melewati pilihan kartu tanpa memakai energi.</p></li><li><b>Pedang → Perisai → Panah → Pedang.</b><p>Hanya skill pemenang yang aktif. Tipe sama menggagalkan keduanya. Pengecualian: pasif Roger, biaya HP Time Boom, dan pantulan Technology Shield tetap mengikuti deskripsi masing-masing.</p></li><li><b>Tiga energi per tipe; ultimate setelah semua habis.</b><p>Setiap penggunaan menghabiskan satu energi, termasuk saat gagal. Ketika semua habis, energi terisi penuh dan ultimate aktif. Klik ultimate di kanan hero, pilih tipe counter, lalu kunci. Ultimate memakai satu energi tipe itu dan satu kesempatan.</p></li><li><b>Defense melindungi HP.</b><p>Damage biasa mengurangi DEF dahulu. Fly Over, Luka, Soul Thief, dan Curse langsung mengenai HP. Detail efek dan angka terbaru tersedia pada koleksi hero. Kedua hero gugur bersamaan berarti imbang.</p></li></ol><div class="rules-note"><b>Efek berkelanjutan</b><p>Buff damage mulai babak berikutnya. Imun dan reduksi damage mulai babak aktivasi. Burn, Scar, Luka, Soul Thief, dan Curse mulai babak berikutnya. Durasi tetap berkurang saat skill gagal atau terkena stun.</p><p>Counter untuk Retribution, Inspire, Dodge, dan Armor harus benar-benar menang/kalah melawan kartu lawan; tipe sama dan stun tidak dihitung. Klik kartu spell untuk detail dan lihat progres di bawah kartunya.</p><p>Efek sementara diperbarui tanpa menumpuk, kecuali Blood Thirst, jiwa Soul Thief, dan Retribution. Hypno membalikkan serangan counter ke diri sendiri; belum ada skill pemberi Hypno.</p><p>Hasil babak ditampilkan 5,5 detik. Efek, energi, dan tumpukan kembali awal setiap pertandingan. Ranked memberi +15 WP untuk pemenang seri dan −5 WP untuk yang kalah (minimum 0). Latihan tidak menambah statistik atau poin. Semua hero terbuka; transaksi koin belum aktif.</p></div>`);
}

async function copy(value, message) {
  try { await navigator.clipboard.writeText(value); toast(message); }
  catch { showDialog(`<span class="eyebrow">SALIN TEKS</span><h2>Salin secara manual.</h2><p>Pilih dan salin teks di bawah.</p><input class="copy-value" aria-label="Teks untuk disalin" readonly value="${escape(value)}">`); $('.copy-value').select(); }
}

document.addEventListener('input', event => {
  if (event.target.id === 'friend-uid') friendDraft = event.target.value;
  if (event.target.id === 'global-chat-input') globalDraft = event.target.value;
  if (event.target.id === 'lobby-chat-input') lobbyDraft = event.target.value;
  if (event.target.id === 'player-name') playerName = event.target.value;
  if (event.target.id === 'room-code') { joinCode = event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6); event.target.value = joinCode; }
});

document.addEventListener('change', event => {
  if (event.target.id === 'avatar-file') saveAvatar(event.target.files?.[0]);
});

document.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'create-form') enterRoom('duel');
  if (event.target.id === 'join-form') enterRoom('duel', true);
  if (event.target.id === 'account-form') {
    const mode = event.target.dataset.mode;
    const body = Object.fromEntries(new FormData(event.target));
    action(async () => {
      const data = await api(mode, body);
      profile = data.profile; playerName = profile.name; profileAvatar = profile.avatar; localId = profile.uid;
      state = null; token = null; storage.remove('empire.session', true);
      screen = joinCode ? 'matchmaking' : 'home';
      history.replaceState(null, '', `${location.pathname}${joinCode ? `?room=${joinCode}` : ''}#${screen}`);
      const room = await api('current-room');
      if (room.state) { token = room.token; storage.set('empire.session', token, true); acceptState(room.state); subscribe(); }
      refreshSocial();
    });
  }
  if (event.target.id === 'profile-form') {
    const name = new FormData(event.target).get('name').trim();
    action(async () => { profile = (await api('profile', { name })).profile; playerName = profile.name; toast('Nama akun disimpan.'); });
  }
  if (event.target.id === 'friend-form') action(async () => { await api('friends/request', { uid: friendDraft }); friendDraft = ''; social = await api('social'); toast('Permintaan pertemanan dikirim.'); });
  if (event.target.id === 'global-chat-form') action(async () => { await api('global-chat', { message: globalDraft }); globalDraft = ''; globalMessages = (await api('global-chat')).messages; });
  if (event.target.id === 'lobby-chat-form') action(async () => { const result = await api('chat', { message: lobbyDraft }); lobbyDraft = ''; acceptState(result); });
});

document.addEventListener('click', async event => {
  const page = event.target.closest('[data-page]');
  if (page) { event.preventDefault(); navigate(page.dataset.page); return; }
  const nav = event.target.closest('[data-nav]');
  if (nav?.dataset.nav === 'rules') showRules();
  if (event.target.closest('.dialog-close')) $('#info-dialog').close();
  if (event.target === $('#info-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const type = button.dataset.action;
  if (type === 'choose-format') { bestOf = Number(button.dataset.count); render(); }
  if (type === 'choose-mode') { duelMode = button.dataset.mode; render(); }
  if (type === 'play-ranked') { duelMode = 'ranked'; navigate('matchmaking'); }
  if (type === 'logout') await action(async () => { await api('logout', {}); profile = null; social = null; resetSession(); screen = 'login'; });
  if (type === 'friend-accept' || type === 'friend-decline') await action(async () => { await api('friends/respond', { id: button.dataset.id, accept: type === 'friend-accept' }); social = await api('social'); });
  if (type === 'prepare-invite') { pendingInviteUid = button.dataset.uid; navigate('matchmaking'); toast('Pilih format lalu buat room; undangan akan dikirim otomatis.'); }
  if (type === 'accept-invite') await enterRoom('duel', true, button.dataset.invite);
  if (type === 'invite-friend') await action(async () => {
    social = await api('social');
    showDialog(`<span class="eyebrow">UNDANG TEMAN</span><h2>Pilih rivalmu.</h2>${social.friends.map(friend => `<div class="social-row"><span>${escape(friend.name)}<small>${friend.uid}</small></span><button class="button primary compact" data-action="send-invite" data-uid="${friend.uid}">Undang</button></div>`).join('') || '<p>Belum ada teman. Tambahkan lewat UID di menu Teman.</p>'}`);
  });
  if (type === 'send-invite') await action(async () => { await api('invite', { uid: button.dataset.uid }); $('#info-dialog').close(); toast('Undangan duel dikirim.'); });
  if (type === 'choose-hero') { heroId = button.dataset.hero; storage.set('empire.hero', heroId); render(); }
  if (type === 'choose-spell') { battleSpellId = button.dataset.spell; storage.set('empire.spell', battleSpellId); render(); }
  if (type === 'spell-details') showSpell(button.dataset.spell);
  if (type === 'room-spell') await action(async () => { acceptState(await api('spell', { battleSpellId: button.dataset.spell })); battleSpellId = button.dataset.spell; storage.set('empire.spell', battleSpellId); });
  if (type === 'hero-details') showHero(button.dataset.hero);
  if (type === 'upcoming-hero') {
    const hero = UPCOMING_HEROES[button.dataset.hero];
    showDialog(`<span class="eyebrow">${hero.role} · BELUM DIMILIKI</span><h2>${hero.name}</h2><p>Hero baru yang akan hadir pada update hero berikutnya.</p><div class="dialog-stats">${icon('heart')} ${hero.hp} HP ${icon('shield')} ${hero.defense} DEF</div><div class="rules-note"><b>COMING SOON</b><p>Kartu dan skill ${hero.name} hadir pada tahap update hero. Hero ini belum bisa dipilih untuk duel.</p></div>`);
  }
  if (type === 'copy-profile-id') copy(localId, 'ID profil lokal disalin.');
  if (type === 'toggle-bgm') {
    bgmEnabled = !bgmEnabled;
    storage.set('empire.bgm', bgmEnabled ? 'on' : 'off');
    render();
    try { await bgm.setEnabled(bgmEnabled); }
    catch (error) { bgmEnabled = false; storage.set('empire.bgm', 'off'); render(); toast(error.message); }
  }
  if (type === 'training') enterRoom('training');
  if (type === 'room-hero') await action(async () => acceptState(await api('hero', { heroId: button.dataset.hero })));
  if (type === 'ready') await action(async () => acceptState(await api('ready', {})));
  if (type === 'copy-code') copy(state.code, 'Kode room disalin.');
  if (type === 'copy-link') copy(`${location.origin}/?room=${state.code}`, 'Tautan undangan disalin.');
  if (type === 'select-skill') { selectedSkill = button.dataset.skill; selectedUltimateType = null; render(); }
  if (type === 'select-ultimate') {
    const me = state.players.find(player => player.id === state.you);
    selectedSkill = HEROES[me.heroId].ultimate.id;
    selectedUltimateType = null;
    render();
    $('.ultimate-selection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (type === 'ultimate-type') { selectedUltimateType = button.dataset.type; render(); }
  if (type === 'lock' && selectedSkill) await action(async () => acceptState(await api('lock', { skillId: selectedSkill, ultimateType: selectedUltimateType, round: state.round })));
  if (type === 'rematch') await action(async () => acceptState(await api('rematch', {})));
  if (type === 'leave') confirmLeave();
  if (type === 'stay') $('#info-dialog').close();
  if (type === 'confirm-leave') {
    $('#info-dialog').close();
    await action(async () => {
      const leaving = state;
      const { result, series } = await api('leave', {});
      if (result) matchAudio.observe({ ...leaving, phase: 'finished', result, series });
      resetSession();
      await refreshProfile();
    });
  }
});

setInterval(updateClock, 100);
setInterval(async () => {
  if (!token || connected) return;
  try {
    acceptState(await api('state'));
    // Initial loading can fail before EventSource exists. Restore the stream too.
    if (!stream) subscribe();
  }
  catch (error) { if (error.status === 401) { profile = null; resetSession(); toast(error.message); } }
}, 3000);
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !token) return;
  try { acceptState(await api('state')); } catch {}
});

setInterval(async () => {
  if (!profile || document.hidden || busy) return;
  await refreshSocial();
  if (!state && screen === 'friends') { try { globalMessages = (await api('global-chat')).messages; render(); } catch {} }
}, 8000);

async function init() {
  render();
  try {
    await api('health').then(() => connection(true)).catch(() => connection(false, 'Menyambungkan arena…'));
    const data = await api('me'); profile = data.profile; accountLoaded = true;
    connection(true);
    if (!profile) { token = null; storage.remove('empire.session', true); render(); return; }
    playerName = profile.name; profileAvatar = profile.avatar; localId = profile.uid;
    const room = await api('current-room');
    if (room.state) { token = room.token; storage.set('empire.session', token, true); acceptState(room.state); subscribe(); }
    else { token = null; storage.remove('empire.session', true); render(); loadPageData(screen); }
    refreshSocial();
  } catch (error) { accountLoaded = true; connection(false, 'Server tidak terhubung'); render(); toast(error.message); }
}
init();
