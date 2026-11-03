import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { GameError } from './game.mjs';
import { HEROES } from '../public/heroes.js';
import { rankFor } from '../public/ranks.js';

const derive = promisify(scrypt);
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const digest = token => createHash('sha256').update(token).digest('hex');
const cleanName = name => typeof name === 'string' ? name.trim().replace(/[\u0000-\u001f\u007f]/g, '') : '';
const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const find = (data, id) => { const account = data.accounts.find(a => a.id === id); if (!account) throw new GameError('Akun tidak ditemukan.', 404); return account; };
const publicProfile = account => ({ uid: account.uid, name: account.name, avatar: account.avatar, points: account.points, rank: rankFor(account.points) });
const ownProfile = account => ({ ...publicProfile(account), coins: account.coins, ownedHeroes: [...account.ownedHeroes], wins: account.wins, losses: account.losses, draws: account.draws, played: account.wins + account.losses + account.draws, winrate: account.wins + account.losses + account.draws ? Math.round(account.wins / (account.wins + account.losses + account.draws) * 100) : 0 });
const areFriends = (data, a, b) => data.friends.some(pair => pair.includes(a) && pair.includes(b));

export function createAccounts(store, now = Date.now) {
  async function issue(accountId, oldToken = null) {
    const token = randomBytes(32).toString('base64url');
    await store.transaction(data => {
      data.sessions = data.sessions.filter(s => s.expiresAt > now() && (!oldToken || s.hash !== digest(oldToken)));
      const existing = data.sessions.filter(s => s.accountId === accountId);
      if (existing.length >= 10) data.sessions = data.sessions.filter(s => !existing.slice(0, existing.length - 9).includes(s));
      data.sessions.push({ hash: digest(token), accountId, expiresAt: now() + SESSION_MS });
    });
    return token;
  }
  return {
    async authenticate(token) {
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new GameError('Silakan login untuk melanjutkan.', 401);
      return store.read(data => {
        const session = data.sessions.find(s => s.hash === digest(token) && s.expiresAt > now());
        if (!session) throw new GameError('Sesi akun berakhir. Silakan login lagi.', 401);
        const account = find(data, session.accountId);
        return { id: account.id, ...ownProfile(account) };
      });
    },
    async register(body, oldToken) {
      const name = cleanName(body.username), email = emailOf(body.email);
      if (name.length < 2 || name.length > 20) throw new GameError('Username harus 2–20 karakter.');
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GameError('Masukkan alamat email yang valid.');
      if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new GameError('Password harus 12–128 karakter.');
      const salt = randomBytes(16).toString('hex');
      const hash = (await derive(body.password, salt, 64, SCRYPT)).toString('hex');
      const account = await store.transaction(data => {
        if (data.accounts.some(a => a.email === email || a.name.toLowerCase() === name.toLowerCase())) throw new GameError('Email atau username sudah digunakan.', 409);
        let uid;
        do { uid = `EC-${randomBytes(5).toString('hex').toUpperCase()}`; } while (data.accounts.some(a => a.uid === uid));
        const value = { id: randomUUID(), uid, name, email, salt, passwordHash: hash, avatar: null, coins: 0, points: 0, ownedHeroes: Object.keys(HEROES), wins: 0, losses: 0, draws: 0, createdAt: now() };
        data.accounts.push(value);
        return value;
      });
      return { token: await issue(account.id, oldToken), profile: ownProfile(account) };
    },
    async login(body, oldToken) {
      if (typeof body.password !== 'string' || body.password.length > 128) throw new GameError('Email atau password salah.', 401);
      const account = await store.read(data => data.accounts.find(a => a.email === emailOf(body.email)));
      const hash = await derive(body.password, account?.salt || '00000000000000000000000000000000', 64, SCRYPT);
      if (!account || !timingSafeEqual(hash, Buffer.from(account.passwordHash, 'hex'))) throw new GameError('Email atau password salah.', 401);
      return { token: await issue(account.id, oldToken), profile: ownProfile(account) };
    },
    async logout(token) { if (token) await store.transaction(data => { data.sessions = data.sessions.filter(s => s.hash !== digest(token)); }); },
    async profile(id) { return store.read(data => ownProfile(find(data, id))); },
    async updateProfile(id, body) {
      return store.transaction(data => {
        const account = find(data, id);
        if (Object.hasOwn(body, 'name')) {
          const name = cleanName(body.name);
          if (name.length < 2 || name.length > 20) throw new GameError('Nama pemain harus 2–20 karakter.');
          if (data.accounts.some(a => a.id !== id && a.name.toLowerCase() === name.toLowerCase())) throw new GameError('Username sudah digunakan.', 409);
          account.name = name;
        }
        if (Object.hasOwn(body, 'avatar')) {
          if (body.avatar !== null && (typeof body.avatar !== 'string' || body.avatar.length > 150000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.avatar))) throw new GameError('Foto profil tidak valid atau terlalu besar.');
          account.avatar = body.avatar;
        }
        return ownProfile(account);
      });
    },
    async leaderboard() {
      return store.read(data => data.accounts.toSorted((a, b) => b.points - a.points || b.wins - a.wins || a.createdAt - b.createdAt).slice(0, 100).map((a, index) => ({ ...publicProfile(a), position: index + 1 })));
    },
    async social(id) {
      return store.read(data => ({
        friends: data.friends.filter(pair => pair.includes(id)).map(pair => publicProfile(find(data, pair.find(other => other !== id)))),
        incoming: data.requests.filter(r => r.to === id).map(r => ({ id: r.id, player: publicProfile(find(data, r.from)) })),
        outgoing: data.requests.filter(r => r.from === id).map(r => ({ id: r.id, player: publicProfile(find(data, r.to)) })),
      }));
    },
    async requestFriend(id, uid) {
      return store.transaction(data => {
        const target = data.accounts.find(a => a.uid === String(uid).trim().toUpperCase());
        if (!target) throw new GameError('UID tidak ditemukan.', 404);
        if (target.id === id) throw new GameError('Tidak bisa menambahkan diri sendiri.');
        if (areFriends(data, id, target.id)) throw new GameError('Pemain ini sudah menjadi teman.');
        if (data.requests.some(r => r.from === id && r.to === target.id || r.from === target.id && r.to === id)) throw new GameError('Permintaan pertemanan sudah ada.', 409);
        if (data.requests.filter(r => r.from === id).length >= 30) throw new GameError('Selesaikan permintaan pertemanan yang masih menunggu.', 429);
        data.requests.push({ id: randomUUID(), from: id, to: target.id });
      });
    },
    async respondFriend(id, requestId, accept) {
      return store.transaction(data => {
        const request = data.requests.find(r => r.id === requestId && r.to === id);
        if (!request) throw new GameError('Permintaan tidak ditemukan.', 404);
        if (accept && !areFriends(data, request.from, id)) data.friends.push([request.from, id]);
        data.requests = data.requests.filter(r => r.id !== requestId);
      });
    },
    async friendAccount(id, uid) {
      return store.read(data => { const target = data.accounts.find(a => a.uid === uid); if (!target || !areFriends(data, id, target.id)) throw new GameError('Pemain harus ada dalam daftar teman.', 403); return { id: target.id, ...publicProfile(target) }; });
    },
    async globalMessages() { return store.read(data => data.messages.slice(-50)); },
    async sendGlobal(id, message) {
      return store.transaction(data => {
        const account = find(data, id);
        const text = cleanName(message);
        if (!text || text.length > 240) throw new GameError('Chat harus berisi 1–240 karakter.');
        data.messages.push({ id: randomUUID(), uid: account.uid, name: account.name, text, time: now() });
        data.messages = data.messages.slice(-50);
      });
    },
    async settle(game) {
      if (!game.series.finished || game.mode === 'training' || game.players.length !== 2 || game.players.some(p => !p.accountId)) return;
      return store.transaction(data => {
        if (data.results.some(result => result.id === game.series.id)) return;
        const winner = game.series.winnerId;
        for (const player of game.players) {
          const account = find(data, player.accountId);
          if (winner === null) account.draws++;
          else if (winner === player.id) account.wins++;
          else account.losses++;
          if (game.mode === 'ranked' && winner !== null) account.points = Math.max(0, account.points + (winner === player.id ? 15 : -5));
        }
        data.results.push({ id: game.series.id, time: now(), players: game.players.map(p => p.accountId), winner: winner && game.players.find(p => p.id === winner)?.accountId, mode: game.mode });
      });
    },
  };
}
