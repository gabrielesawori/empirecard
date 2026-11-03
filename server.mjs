import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { GameError, createPlayer, createGame, joinGame, selectHero, selectSpell, readyPlayer, lockCard, advanceGame, requestRematch, leaveGame, publicGame, availableSkills } from './lib/game.mjs';

import { createStore } from './lib/store.mjs';
import { createAccounts } from './lib/accounts.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

export function createApp({ now = Date.now, random = Math.random, store = createStore(), requireAccounts = true, publicOrigin = null } = {}) {
  const accounts = createAccounts(store, now);
  const invites = new Map();
  const settling = new Map();
  const authLimits = new Map();
  const chatLimits = new Map();
  const rooms = new Map();
  const sessions = new Map();
  const streams = new Map();
  const limits = new Map();
  const botDelays = new Map();

  function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  async function bodyOf(req) {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > (req.url === '/api/profile' ? 160000 : 4096)) throw new GameError('Permintaan terlalu besar.', 413);
    }
    try { return JSON.parse(raw || '{}'); }
    catch { throw new GameError('Format permintaan tidak valid.'); }
  }

  function snapshot(game, playerId) {
    const state = publicGame(game, playerId, now());
    state.players.forEach(p => { p.connected = p.bot || Boolean(streams.get(p.id)?.size); });
    return state;
  }

  function broadcast(game) {
    for (const player of game.players) {
      for (const res of streams.get(player.id) || []) {
        if (!res.destroyed) res.write(`event: state\ndata: ${JSON.stringify(snapshot(game, player.id))}\n\n`);
      }
    }
  }

  function authenticate(req, url) {
    const token = req.headers.authorization?.replace(/^Bearer /, '') || url.searchParams.get('session');
    const session = sessions.get(token);
    const game = session && rooms.get(session.code);
    if (!session || !game) throw new GameError('Room sudah berakhir atau sesi tidak ditemukan. Buat room baru.', 401);
    const player = game.players.find(p => p.id === session.playerId);
    if (requireAccounts && player?.accountId !== req.account?.id) throw new GameError('Sesi room bukan milik akun ini.', 403);
    return { ...session, token, game };
  }

  function issueSession(game, player) {
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, { code: game.code, playerId: player.id });
    return { token, state: snapshot(game, player.id) };
  }

  function newCode() {
    let code;
    do { code = [...randomBytes(6)].map(n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join(''); }
    while (rooms.has(code));
    return code;
  }

  function newPlayer(body, account) {
    if (account) {
      if (!account.ownedHeroes.includes(body.heroId)) throw new GameError('Hero belum dimiliki.', 403);
      for (const game of rooms.values()) {
        if (game.players.some(p => p.accountId === account.id && [...sessions.values()].some(s => s.playerId === p.id))) throw new GameError('Akun masih berada di room lain. Keluar dari room itu terlebih dahulu.', 409);
      }
      return { ...createPlayer(randomUUID(), account.name, body.heroId, false, body.battleSpellId ?? null), accountId: account.id, uid: account.uid };
    }
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 20) throw new GameError('Nama pemain harus berisi 1–20 karakter.');
    return createPlayer(randomUUID(), body.name.trim(), body.heroId, false, body.battleSpellId ?? null);
  }

  const accountToken = req => {
    const value = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('empire_account='));
    return value?.slice('empire_account='.length) || null;
  };
  function cookie(req, res, token) {
    const secure = publicOrigin?.startsWith('https://') || req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `empire_account=${token || ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 604800 : 0}${secure ? '; Secure' : ''}`);
  }
  function checkOrigin(req) {
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new GameError('Origin tidak diizinkan.', 403);
    if (!req.headers.origin) return;
    let origin;
    try { origin = new URL(req.headers.origin); } catch { throw new GameError('Origin tidak valid.', 403); }
    if (publicOrigin ? origin.origin !== new URL(publicOrigin).origin : origin.host !== req.headers.host) throw new GameError('Origin tidak diizinkan.', 403);
  }
  function settle(game) {
    if (!game.series.finished) return Promise.resolve();
    const id = game.series.id;
    if (settling.has(id)) return settling.get(id);
    game.series.settlement = 'saving';
    const operation = accounts.settle(structuredClone(game)).then(() => {
      if (game.series.id === id) { game.series.settlement = 'saved'; game.version++; broadcast(game); }
    }).catch(error => {
      settling.delete(id);
      if (game.series.id === id) { game.series.settlement = 'error'; game.version++; broadcast(game); }
      throw error;
    });
    settling.set(id, operation);
    return operation;
  }
  function closeAccountRooms(id) {
    for (const [token, session] of sessions) {
      const game = rooms.get(session.code);
      const player = game?.players.find(p => p.id === session.playerId && p.accountId === id);
      if (!player) continue;
      leaveGame(game, player.id, now());
      settle(game).catch(() => {});
      sessions.delete(token);
      for (const response of streams.get(player.id) || []) response.end();
      streams.delete(player.id);
      broadcast(game);
    }
  }

  async function api(req, res, url) {
    await store.ready;
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true });
    if (req.method === 'POST') checkOrigin(req);
    if (req.method === 'POST' && ['/api/register', '/api/login'].includes(url.pathname)) {
      const key = req.socket.remoteAddress;
      const previous = authLimits.get(key);
      const limit = previous?.until > now() ? previous : { count: 0, until: now() + 300000 };
      if (++limit.count > 20) throw new GameError('Terlalu banyak percobaan login. Coba lagi dalam 5 menit.', 429);
      authLimits.set(key, limit);
      const body = await bodyOf(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GameError('Format permintaan tidak valid.');
      const result = await accounts[url.pathname === '/api/register' ? 'register' : 'login'](body, accountToken(req));
      cookie(req, res, result.token);
      return json(res, 200, { profile: result.profile });
    }
    if (req.method === 'GET' && url.pathname === '/api/me') {
      try { const account = await accounts.authenticate(accountToken(req)); return json(res, 200, { profile: await accounts.profile(account.id) }); }
      catch (error) { if (error.status !== 401) throw error; return json(res, 200, { profile: null }); }
    }
    if (requireAccounts || accountToken(req)) req.account = await accounts.authenticate(accountToken(req));
    if (req.method === 'GET' && url.pathname === '/api/current-room') {
      const existing = [...sessions].find(([, session]) => rooms.get(session.code)?.players.some(p => p.id === session.playerId && p.accountId === req.account?.id && p.accountId));
      return json(res, 200, existing ? { token: existing[0], state: snapshot(rooms.get(existing[1].code), existing[1].playerId) } : { state: null });
    }
    if (req.method === 'GET' && url.pathname === '/api/leaderboard') return json(res, 200, { players: await accounts.leaderboard() });
    if (req.method === 'GET' && url.pathname === '/api/social') {
      const social = await accounts.social(req.account.id);
      social.invites = [...invites.values()].filter(i => i.to === req.account.id && i.expiresAt > now() && rooms.get(i.code)?.phase === 'lobby' && rooms.get(i.code)?.players.length === 1).map(({ id, code, fromName, expiresAt }) => ({ id, code, fromName, expiresAt }));
      return json(res, 200, social);
    }
    if (req.method === 'GET' && url.pathname === '/api/global-chat') return json(res, 200, { messages: await accounts.globalMessages() });
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const { game, playerId } = authenticate(req, url);
      return json(res, 200, snapshot(game, playerId));
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      const { game, playerId } = authenticate(req, url);
      if ((streams.get(playerId)?.size || 0) >= 5) throw new GameError('Terlalu banyak koneksi untuk pemain ini.', 429);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 1500\n\n');
      if (!streams.has(playerId)) streams.set(playerId, new Set());
      streams.get(playerId).add(res);
      broadcast(game);
      res.on('close', () => {
        streams.get(playerId)?.delete(res);
        if (!streams.get(playerId)?.size) streams.delete(playerId);
        broadcast(game);
      });
      return;
    }
    if (req.method !== 'POST') throw new GameError('Rute tidak ditemukan.', 404);
    const ip = req.socket.remoteAddress;
    const current = limits.get(ip);
    const limit = current && current.reset > now() ? current : { count: 0, reset: now() + 60000 };
    limit.count++;
    limits.set(ip, limit);
    if (limit.count > 240) throw new GameError('Terlalu banyak permintaan. Coba lagi sebentar.', 429);
    const body = await bodyOf(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GameError('Format permintaan tidak valid.');


    if (url.pathname === '/api/logout') {
      closeAccountRooms(req.account.id);
      await accounts.logout(accountToken(req)); cookie(req, res, null);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/profile') return json(res, 200, { profile: await accounts.updateProfile(req.account.id, body) });
    if (url.pathname === '/api/friends/request') { await accounts.requestFriend(req.account.id, body.uid); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/friends/respond') { await accounts.respondFriend(req.account.id, body.id, body.accept === true); return json(res, 200, { ok: true }); }
    if (['/api/global-chat', '/api/chat'].includes(url.pathname)) {
      const key = req.account?.id || authenticate(req, url).playerId;
      if (chatLimits.has(key) && now() - chatLimits.get(key) < 1000) throw new GameError('Tunggu sebentar sebelum mengirim chat lagi.', 429);
      if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 240) throw new GameError('Chat harus 1–240 karakter.');
      chatLimits.set(key, now());
      if (url.pathname === '/api/global-chat') { await accounts.sendGlobal(req.account.id, body.message); return json(res, 200, { ok: true }); }
      const { game, playerId } = authenticate(req, url);
      if (!['lobby', 'finished'].includes(game.phase)) throw new GameError('Chat lobby tersedia sebelum atau setelah pertandingan.');
      game.chat.push({ id: randomUUID(), name: game.players.find(p => p.id === playerId).name, text: body.message.trim(), time: now() });
      game.chat = game.chat.slice(-50); game.version++; broadcast(game);
      return json(res, 200, snapshot(game, playerId));
    }
    if (url.pathname === '/api/invite') {
      const { game } = authenticate(req, url);
      if (game.phase !== 'lobby' || game.players.length !== 1) throw new GameError('Undangan hanya untuk room yang masih menunggu lawan.', 409);
      const target = await accounts.friendAccount(req.account.id, body.uid);
      for (const [id, invite] of invites) if (invite.to === target.id && invite.code === game.code) invites.delete(id);
      const id = randomUUID();
      invites.set(id, { id, code: game.code, to: target.id, fromName: req.account.name, expiresAt: now() + 600000 });
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/rooms') {
      if (rooms.size >= 300) throw new GameError('Server penuh. Coba lagi nanti.', 503);
      const player = newPlayer(body, req.account);
      const game = createGame(newCode(), player, now(), body.bestOf ?? 1, body.mode === 'duel' || body.mode === undefined ? 'casual' : body.mode);
      if (body.mode === 'training') {
        const bot = createPlayer(randomUUID(), 'Penjaga arena', body.heroId === 'strom' ? 'roger' : 'strom', true, body.battleSpellId ?? null);
        bot.ready = true;
        joinGame(game, bot, now());
      }
      rooms.set(game.code, game);
      return json(res, 201, issueSession(game, player));
    }
    if (url.pathname === '/api/join') {
      const invited = body.inviteId && invites.get(body.inviteId);
      if (body.inviteId && (!invited || invited.to !== req.account?.id || invited.expiresAt <= now())) throw new GameError('Undangan sudah berakhir.', 404);
      const code = String(invited?.code || body.code || '').toUpperCase().trim();
      const game = rooms.get(code);
      if (!game) throw new GameError('Kode room tidak ditemukan. Periksa kembali kodenya.', 404);
      const player = newPlayer(body, req.account);
      joinGame(game, player, now());
      if (body.inviteId) invites.delete(body.inviteId);
      broadcast(game);
      return json(res, 200, issueSession(game, player));
    }

    const { game, playerId, token } = authenticate(req, url);
    if (url.pathname === '/api/hero') {
      if (req.account && !req.account.ownedHeroes.includes(body.heroId)) throw new GameError('Hero belum dimiliki.', 403);
      selectHero(game, playerId, body.heroId, now());
    }
    else if (url.pathname === '/api/spell') selectSpell(game, playerId, body.battleSpellId, now());
    else if (url.pathname === '/api/ready') readyPlayer(game, playerId, now());
    else if (url.pathname === '/api/lock') lockCard(game, playerId, body.skillId, body.round, now(), body.ultimateType);
    else if (url.pathname === '/api/rematch') {
      if (game.players.some(p => !p.bot && ![...sessions.values()].some(s => s.playerId === p.id))) throw new GameError('Lawan sudah keluar. Buat room baru.', 409);
      await settle(game);
      const previousSeries = game.series.id;
      requestRematch(game, playerId, now());
      if (game.series.id !== previousSeries) settling.delete(previousSeries);
    } else if (url.pathname === '/api/leave') {
      leaveGame(game, playerId, now());
      await settle(game);
      sessions.delete(token);
      for (const stream of streams.get(playerId) || []) stream.end();
      streams.delete(playerId);
      broadcast(game);
      if (!game.players.some(p => !p.bot && [...sessions.values()].some(s => s.playerId === p.id))) { rooms.delete(game.code); settling.delete(game.series.id); }
      return json(res, 200, { ok: true, result: game.result, series: game.series });
    } else throw new GameError('Rute tidak ditemukan.', 404);
    broadcast(game);
    json(res, 200, snapshot(game, playerId));
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (!['GET', 'HEAD'].includes(req.method)) throw new GameError('Metode tidak diizinkan.', 405);
      const pathname = decodeURIComponent(url.pathname);
      let file;
      if (pathname.startsWith('/assets/')) {
        file = path.resolve(ROOT, `.${pathname}`);
        if (!file.startsWith(path.join(ROOT, 'assets') + path.sep)) throw new GameError('File tidak ditemukan.', 404);
      } else {
        const allowed = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css', '/hub.css': 'hub.css', '/interface.js': 'interface.js', '/bgm.js': 'bgm.js', '/audio.js': 'audio.js', '/heroes.js': 'heroes.js', '/spells.js': 'spells.js', '/ranks.js': 'ranks.js', '/account-ui.js': 'account-ui.js', '/app-shell.css': 'app-shell.css', '/favicon.svg': 'favicon.svg' };
        if (!Object.hasOwn(allowed, pathname)) throw new GameError('File tidak ditemukan.', 404);
        file = path.join(ROOT, 'public', allowed[pathname]);
      }
      const metadata = await stat(file);
      if (!metadata.isFile()) throw new GameError('File tidak ditemukan.', 404);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': metadata.size, 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      const status = error instanceof GameError ? error.status : error.code === 'ENOENT' ? 404 : error instanceof URIError ? 400 : 500;
      if (status === 500) console.error(error);
      json(res, status, { error: status === 500 ? 'Terjadi kesalahan server. Silakan coba lagi.' : status === 404 && !(error instanceof GameError) ? 'File tidak ditemukan.' : error.message });
    }
  });

  function tick() {
    for (const game of rooms.values()) {
      if (advanceGame(game, now(), random)) { broadcast(game); if (game.series.finished) settle(game).catch(() => {}); }
      if (game.phase === 'selecting') {
        const bot = game.players.find(p => p.bot && !p.choice && !p.skipped);
        const human = game.players.find(p => !p.bot);
        if (bot && (human?.choice || human?.skipped)) {
          if (!botDelays.has(game.code)) botDelays.set(game.code, now() + 700);
          if (now() >= botDelays.get(game.code)) {
            const skills = availableSkills(bot);
            const skill = skills[Math.floor(random() * skills.length)];
            lockCard(game, bot.id, skill.id, game.round, now(), skill.type);
            botDelays.delete(game.code);
            broadcast(game);
          }
        }
      } else botDelays.delete(game.code);
    }
  }
  const ticker = setInterval(tick, 100);
  const housekeeping = setInterval(() => {
    for (const connections of streams.values()) for (const res of connections) res.write(': keepalive\n\n');
    for (const [id, invite] of invites) if (invite.expiresAt < now()) invites.delete(id);
    for (const [id, limit] of authLimits) if (limit.until < now()) authLimits.delete(id);
    for (const [id, time] of chatLimits) if (now() - time > 60000) chatLimits.delete(id);
    for (const [ip, limit] of limits) if (limit.reset < now()) limits.delete(ip);
    for (const [code, game] of rooms) {
      if (now() - game.updatedAt < 3 * 60 * 60 * 1000) continue;
      for (const player of game.players) {
        for (const res of streams.get(player.id) || []) res.end();
        streams.delete(player.id);
      }
      for (const [token, session] of sessions) if (session.code === code) sessions.delete(token);
      settling.delete(game.series.id);
      rooms.delete(code);
      botDelays.delete(code);
    }
  }, 15000);
  ticker.unref();
  housekeeping.unref();
  function dispose() {
    clearInterval(ticker);
    clearInterval(housekeeping);
    for (const connections of streams.values()) for (const res of connections) res.end();
    server.closeAllConnections();
  }
  server.on('close', dispose);
  return { server, tick, dispose, accounts, store, async flush() { await Promise.allSettled([...settling.values()]); }, async closeStore() { await Promise.allSettled([...settling.values()]); await store.close(); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL && !process.env.ACCOUNT_DATA_FILE) throw new Error('Atur DATABASE_URL atau ACCOUNT_DATA_FILE pada disk persisten untuk akun produksi.');
  const store = createStore({ databaseUrl: process.env.DATABASE_URL || null, file: process.env.ACCOUNT_DATA_FILE || path.join(ROOT, 'data/accounts.json') });
  await store.ready;
  const app = createApp({ store, publicOrigin: process.env.PUBLIC_ORIGIN || null });
  const { server, dispose } = app;
  server.listen(port, host, () => {
    console.log(`\n  EMPIRE CARD · Arena siap\n  Lokal: http://localhost:${port}`);
    if (host === '0.0.0.0') {
      for (const addresses of Object.values(networkInterfaces())) for (const address of addresses || []) {
        if (address.family === 'IPv4' && !address.internal) console.log(`  Jaringan: http://${address.address}:${port}`);
      }
    }
    console.log(`  Dua perangkat via ngrok: ngrok http ${port}\n`);
  });
  server.on('error', error => { console.error(`Server gagal dimulai: ${error.message}`); process.exitCode = 1; dispose(); });
  const stop = () => { dispose(); server.close(() => app.closeStore().catch(() => {})); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
