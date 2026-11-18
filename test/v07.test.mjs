import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEROES } from '../public/heroes.js';
import { createPlayer, createGame, joinGame, readyPlayer, lockCard, advanceGame, publicGame, requestRematch, selectHero, selectSpell, leaveGame } from '../lib/game.mjs';
import { createStore } from '../lib/store.mjs';
import { createAccounts } from '../lib/accounts.mjs';

function duel(first, second = 'spearos', spell = null, rivalSpell = null, bestOf = 1) {
  const g = createGame('V07NEW', createPlayer('a', 'A', first, false, spell), 0, bestOf);
  joinGame(g, createPlayer('b', 'B', second, false, rivalSpell), 0);
  readyPlayer(g, 'a', 0); readyPlayer(g, 'b', 0);
  return g;
}
function play(g, a, b, options = {}, rivalOptions = {}) {
  for (const [i, id, choice] of [[0,a,options],[1,b,rivalOptions]]) if (!g.players[i].skipped) lockCard(g, g.players[i].id, id, g.round, g.updatedAt, choice.type || 'sword', choice);
  assert.equal(g.phase, 'countdown');
  advanceGame(g, g.deadline, () => 0);
  return g.lastRound.entries;
}
function next(g) { assert.equal(g.phase, 'reveal'); advanceGame(g, g.deadline); }
const transfer = {targetEnergyType:'arrow', restoreEnergyType:'sword'};

test('Magic Shot uses its pre-spend energy: 30, 30, then 90, and the bonus requires a counter', () => {
  const g = duel('genggar');
  assert.equal(play(g, 'magic-shot', 'royal-whirlwind')[0].attack, 30);
  next(g); assert.equal(play(g, 'magic-shot', 'royal-whirlwind')[0].attack, 30);
  next(g); assert.equal(play(g, 'magic-shot', 'royal-whirlwind')[0].attack, 90);
  assert.equal(g.players[0].energy['magic-shot'], 0);
  const failed = duel('genggar'); failed.players[0].energy['magic-shot'] = 1;
  assert.equal(play(failed, 'magic-shot', 'knights-resolve')[0].attack, 0);
});

test('Energy Thief validates two independent choices and hides both from the opponent until reveal', () => {
  const g = duel('genggar');
  g.players[0].energy['magic-shot'] = 1;
  for (const options of [{}, {...transfer,targetEnergyType:'__proto__'}, {...transfer,restoreEnergyType:['sword']}]) assert.throws(() => lockCard(g, 'a', 'energy-thief', 1, 0, null, options), {status:400});
  lockCard(g, 'a', 'energy-thief', 1, 0, null, transfer);
  assert.equal(publicGame(g, 'a').players[0].choiceRestoreType, 'sword');
  const rival = publicGame(g, 'b').players[0];
  assert.equal(rival.choiceTargetType, null); assert.equal(rival.choiceRestoreType, null);
  assert.equal(rival.energy['energy-thief'], 3);
  lockCard(g, 'b', 'spear-strike', 1, 0); advanceGame(g, g.deadline);
  assert.equal(g.players[1].energy['spear-strike'], 1); // 3 - card - stolen.
  assert.equal(g.players[0].energy['magic-shot'], 2);
  assert.equal(g.players[0].energy['energy-thief'], 2);
  assert.equal(g.lastRound.entries[0].energyStolen, 1);
  assert.equal(publicGame(g, 'b').players[0].choiceRestoreType, 'sword');
});

test('Energy Thief respects capacity, empty source, failed counter, immunity and Dodge', () => {
  for (const reason of ['full','empty','failed','immune','dodge']) {
    const g = duel('genggar', 'spearos', null, reason === 'dodge' ? 'dodge' : null);
    g.players[0].energy['magic-shot'] = reason === 'full' ? 3 : 1;
    if (reason === 'empty') g.players[1].energy['spear-strike'] = 1; // Its card spends the final point first.
    if (reason === 'immune') g.players[1].immuneTurns = 1;
    if (reason === 'dodge') g.players[1].spellCountered = 2;
    const e = play(g, 'energy-thief', reason === 'failed' ? 'knights-resolve' : 'spear-strike', transfer);
    assert.equal(e[0].energyStolen, 0, reason);
    assert.equal(g.players[0].energy['magic-shot'], reason === 'full' ? 3 : 1);
  }
});

test('Energy Thief transfers after costs and before refill, including the final enemy energy point', () => {
  const g = duel('genggar');
  g.players[0].energy = {'magic-shot':0,hypno:0,'energy-thief':1};
  g.players[1].energy = {'knights-resolve':1,'spear-strike':1,'royal-whirlwind':0};
  const e = play(g, 'energy-thief', 'spear-strike', {targetEnergyType:'sword',restoreEnergyType:'arrow'});
  assert.deepEqual(Object.values(g.players[0].energy), [0,1,0]);
  assert.equal(g.players[0].ultimateReady, false);
  assert.deepEqual(Object.values(g.players[1].energy), [3,3,3]);
  assert.equal(e[1].energyRefilled, true);
  assert.equal(g.players[1].ultimateReady, true);
});

test('Hypno redirects successful counters for exactly two following rounds', () => {
  const g = duel('genggar', 'golar');
  play(g, 'hypno', 'deadly-slash');
  assert.equal(g.players[1].hypno, 2);
  for (let i=0;i<3;i++) {
    next(g); const e = play(g, 'energy-thief', 'deadly-slash', transfer);
    assert.equal(e[1].reflected, i < 2);
    assert.equal(e[1].reflectedDamage, i < 2 ? 20 : 0);
    assert.equal(g.players[1].hypno, Math.max(0,1-i));
    if (i === 1) g.players[1].energy['deadly-slash'] = 1;
  }
});

test('Magic Field restores and raises DEF to 100, ticks ten times, and halves skill damage', () => {
  const g = duel('genggar', 'golar');
  g.players[0].ultimateReady = true; g.players[0].defense = 5;
  play(g, 'magic-field', 'analysis-system');
  assert.equal(g.players[0].defense, 100); assert.equal(g.players[0].maxDefense, 100);
  assert.equal(g.players[1].hp, 190); assert.equal(g.players[1].fieldTurns, 10);
  assert.equal(publicGame(g, 'a').players[1].fieldDamage, 5);
  for (let i=0;i<11;i++) {
    next(g);
    // Isolate duration from energy availability and opponent damage by matching types.
    g.players[0].energy.hypno = 3; g.players[1].energy.mark = 3;
    const e = play(g, 'hypno', 'mark');
    assert.equal(e[1].dotDamage, i < 10 ? 5 : 0);
    assert.equal(g.players[1].damageDownTurns, Math.max(0,9-i));
  }
  assert.equal(g.players[1].hp, 140);
  const reduced = duel('genggar', 'golar');
  reduced.players[0].ultimateReady = true; play(reduced, 'magic-field', 'analysis-system');
  next(reduced);
  assert.equal(play(reduced, 'energy-thief', 'deadly-slash', transfer)[1].attack, 10);
});

test('Genggar charges on rounds 9 and 18 even with unspent energy, without stacking charges', () => {
  const g = duel('genggar');
  for (const round of [9,18]) {
    g.round = round; g.players[0].ultimateReady = false;
    const e = play(g, 'hypno', 'spear-strike');
    assert.equal(e[0].periodicUltimate, true); assert.equal(e[0].energyRefilled, false);
    assert.equal(g.players[0].ultimateReady, true); next(g);
  }
  play(g, 'magic-field', 'knights-resolve'); // Failed ultimate consumes the one charge.
  assert.equal(g.players[0].ultimateReady, false);
});

test('Spearos restores DEF up to 100; sword immunity lasts activation plus two rounds', () => {
  const restored = duel('spearos'); restored.players[0].defense = 75;
  assert.equal(play(restored, 'knights-resolve', 'royal-whirlwind')[0].defenseGained, 25);
  const g = duel('spearos', 'golar');
  play(g, 'royal-whirlwind', 'mark');
  assert.equal(g.players[0].swordImmuneTurns, 2);
  for (let i=0;i<3;i++) {
    next(g); g.players[0].energy['royal-whirlwind'] = 3;
    const e = play(g, 'royal-whirlwind', 'deadly-slash');
    assert.equal(e[0].received, i < 2 ? 0 : 18);
    assert.equal(g.players[0].woundTurns, 2); // Immunity only covers sword damage, not effects.
    if (i > 0) assert.equal(e[0].dotDamage, 10);
  }
});

test('Spearos Armor applies once per countering hit and combines with 20% spell Armor', () => {
  const g = duel('spearos', 'golar', 'armor');
  for (let i=0;i<2;i++) {
    if (i) next(g);
    assert.equal(play(g, 'royal-whirlwind', 'deadly-slash')[0].received, 15); // ceil(20 × .9 × .8).
  }
  g.players[0].stun = 1; next(g);
  assert.equal(play(g, null, 'deadly-slash')[0].received, 20);
});

test('Divine Spear cleanses existing debuffs before resolution, preserving helpful buffs', () => {
  const g = duel('spearos', 'golar');
  Object.assign(g.players[0], {ultimateReady:true,burn:3,burnDamage:10,hypno:2,woundTurns:2,soulDrainTurns:2,scarTurns:2,cursed:true,poisonDamage:30,fieldTurns:10,fieldDamage:5,damageDown:.5,damageDownTurns:10,damageDownStacks:2,damageBuff:10,damageBuffTurns:2});
  const e = play(g, 'divine-spear', 'analysis-system');
  assert.equal(e[0].attack, 60); assert.equal(e[0].cleansed, true);
  assert.equal(e[0].burnDamage + e[0].dotDamage, 0); assert.equal(e[0].reflected, false);
  assert.equal(g.players[0].cursed, false); assert.equal(g.players[0].poisonDamage, 0);
  assert.equal(g.players[0].damageDownStacks, 0); assert.equal(g.players[0].damageBuffTurns, 1);
  assert.equal(g.players[1].damageDownStacks, 1);
});

test('Divine Spear stacks 15 percentage points permanently, caps at 100%, and avoids float rounding errors', () => {
  const g = duel('spearos', 'rafel');
  g.players[1].hp = 1000; // Survive repeated ultimates to isolate stacking.
  for (let stacks=1;stacks<=8;stacks++) {
    g.players[0].ultimateReady = true; g.players[0].energy['knights-resolve'] = 3; g.players[1].energy['fighter-spirit'] = 3;
    play(g, 'divine-spear', 'fighter-spirit');
    assert.equal(g.players[1].damageDownStacks, Math.min(7,stacks)); next(g);
  }
  assert.equal(play(g, 'knights-resolve', 'chain-blade')[1].attack, 0);
  const precision = duel('spearos', 'strom'); precision.players[1].damageDownStacks = 3;
  assert.equal(play(precision, 'spear-strike', 'ultimate')[1].attack, 22); // 40 × 55%, exactly 22.
});

test('Karina stores odd rifts and detonates each pair for 40 passive damage', () => {
  const g = duel('karina');
  let e = play(g, 'dimensional-slash', 'royal-whirlwind');
  assert.equal(g.players[0].rifts, 1); assert.equal(e[0].explosions, 0);
  next(g); e = play(g, 'dimensional-movement', 'knights-resolve');
  assert.equal(g.players[0].rifts, 0); assert.equal(e[0].explosions, 1);
  assert.equal(e[1].received, 67); // 27 counter skill after Armor passive + 40 explosion.
});

test('Karina ultimate adds six rifts and stacks +1 on each successful use; failed uses do not add a bonus', () => {
  const g = duel('karina'); g.players[1].hp = 1000;
  for (let i=1;i<=2;i++) {
    g.players[0].ultimateReady = true;
    const e = play(g, 'king-of-dimensions', 'royal-whirlwind');
    assert.equal(e[0].explosions, 3); assert.equal(g.players[0].riftBonus, i); next(g);
  }
  const e = play(g, 'dimensional-movement', 'knights-resolve');
  assert.equal(e[0].riftsOpened, 3); assert.equal(g.players[0].rifts, 1);
  next(g); g.players[0].ultimateReady = true;
  play(g, 'king-of-dimensions', 'knights-resolve');
  assert.equal(g.players[0].riftBonus, 2); assert.equal(g.players[0].rifts, 1);
});

test('Karina passive explosions are blocked by general immunity, while Dodge blocks only the skill', () => {
  for (const protection of ['immune','dodge']) {
    const g = duel('karina', 'spearos', null, protection === 'dodge' ? 'dodge' : null);
    g.players[0].rifts = 1;
    if (protection === 'immune') g.players[1].immuneTurns = 1;
    else g.players[1].spellCountered = 2;
    const e = play(g, 'dimensional-slash', 'royal-whirlwind');
    assert.equal(e[0].explosions, 1); assert.equal(g.players[0].rifts, 0);
    assert.equal(e[1].received, protection === 'immune' ? 0 : 40);
  }
});

test('Newland pierces HP, retaliates on failed arrows including ties, but never while stunned', () => {
  const g = duel('newland', 'golar');
  play(g, 'sharpest-arrow', 'analysis-system');
  assert.deepEqual([g.players[1].hp,g.players[1].defense], [160,60]);
  const tie = duel('newland', 'newland');
  play(tie, 'arrows-all-directions', 'arrows-all-directions');
  assert.deepEqual(tie.players.map(p=>p.defense), [0,0]);
  tie.players[0].stun = 1; next(tie);
  assert.equal(play(tie, null, 'three-shoot')[0].passiveAttack, 0);
});

test('Newland poison starts next round, persists without stacking, is blocked by immunity and cleansable', () => {
  const g = duel('newland'); g.players[0].ultimateReady = true;
  play(g, 'poisoned-arrow', 'royal-whirlwind');
  assert.equal(g.players[1].hp, 150); assert.equal(g.players[1].poisonDamage, 30);
  next(g); play(g, 'three-shoot', 'royal-whirlwind');
  assert.equal(g.players[1].hp, 120);
  next(g); g.players[1].immuneTurns = 1;
  assert.equal(play(g, 'arrows-all-directions', 'spear-strike')[1].dotDamage, 0);
  assert.equal(g.players[1].poisonDamage, 30);
  next(g); g.players[1].ultimateReady = true;
  assert.equal(play(g, 'three-shoot', 'divine-spear')[1].dotDamage, 0);
  assert.equal(g.players[1].poisonDamage, 0);
});

test('Warfet protects HP from piercing, DOT and both Executes while DEF remains', () => {
  for (const source of ['newland','kristina']) {
    const g = duel(source, 'warfet', 'execute');
    g.players[1].hp = 10; g.players[1].poisonDamage = 30; g.players[1].cursed = true;
    if (source === 'kristina') g.players[0].ultimateReady = true;
    play(g, source === 'newland' ? 'sharpest-arrow' : 'execute', 'soul-user');
    assert.equal(g.players[1].hp, 10); assert.equal(g.lastRound.entries[0].executed, false);
    assert.equal(g.lastRound.entries[0].spellExecuted, false);
    assert.equal(g.players[1].defense, source === 'newland' ? 150 : 50);
  }
  const broken = duel('rafel','warfet'); broken.players[0].ultimateReady = true;
  play(broken, 'twin-chain-blades', 'soul-user');
  assert.equal(broken.players[1].hp, 0); assert.equal(broken.players[1].defense, 0);
  const overflow = duel('roger','warfet'); overflow.players[1].defense = 5;
  play(overflow, 'long-fire', 'soul-lock');
  assert.equal(overflow.players[1].hp, 25); // Ordinary damage reaches HP only after DEF breaks.
});

test('Technology Shield reflects half, rounds up once and never receives the reflected skill damage', () => {
  const g = duel('quexyana','kristina');
  g.players[1].ultimateReady = true;
  const e = play(g, 'technology-shield', 'execute');
  assert.equal(e[1].reflectedDamage, 43); // Half of 85, rounded up.
  assert.deepEqual([g.players[0].hp,g.players[0].defense], [100,70]);
  assert.deepEqual([g.players[1].hp,g.players[1].defense], [127,0]);
  const kill = duel('quexyana','kristina');
  kill.players[0].hp = 40; kill.players[1].ultimateReady = true;
  play(kill, 'technology-shield', 'execute');
  assert.equal(kill.players[0].hp, 40); assert.equal(kill.players[1].hp, 110); // Half of 40 HP lethal damage.
  assert.equal(kill.lastRound.entries[1].executed, false);
});

test('enemy loadouts and identifying stats remain private in initial and intermission lobbies, including forfeits', () => {
  const g = createGame('HIDDEN', createPlayer('a','A','genggar',false,'execute'), 0, 3);
  joinGame(g, createPlayer('b','B','karina',false,'armor'), 0);
  const hidden = () => {
    const p = publicGame(g,'a').players[1];
    assert.equal(p.loadoutHidden,true); assert.equal(p.heroId,null); assert.equal(p.battleSpellId,null);
    for (const key of ['hp','defense','energy','ultimate','rifts']) assert.equal(key in p,false);
  };
  hidden(); selectHero(g,'b','newland'); selectSpell(g,'b','healing'); hidden();
  readyPlayer(g,'a'); readyPlayer(g,'b');
  assert.equal(publicGame(g,'a').players[1].heroId,'newland');
  g.players[1].hp = 10; g.players[1].defense = 0;
  play(g,'magic-shot','three-shoot');
  requestRematch(g,'a'); requestRematch(g,'b'); hidden();
  assert.deepEqual(publicGame(g,'a').history, []);
  leaveGame(g,'b'); hidden();
});

test('new effects and expanded DEF reset on every new match', () => {
  const g = duel('genggar','karina');
  Object.assign(g.players[0], {maxDefense:100,defense:100,poisonDamage:30,damageDownStacks:3,riftBonus:2,fieldTurns:10});
  g.players[0].immuneTurns = 1; g.players[1].hp = 1; g.players[1].defense = 0;
  play(g,'magic-shot','chaser-dimensions');
  requestRematch(g,'a'); requestRematch(g,'b');
  assert.equal(g.players[0].maxDefense,70);
  for (const key of ['poisonDamage','damageDownStacks','riftBonus','fieldTurns']) assert.equal(g.players[0][key],0);
});

test('each ranked format settles its own reward and penalty once; existing accounts receive all testing heroes', async () => {
  const store = createStore(), accounts = createAccounts(store);
  const a = await accounts.register({username:'Tester A',email:'a@example.test',password:'test-password-123'});
  const b = await accounts.register({username:'Tester B',email:'b@example.test',password:'test-password-123'});
  const pa = await accounts.authenticate(a.token), pb = await accounts.authenticate(b.token);
  await store.transaction(data => { const user=data.accounts.find(x=>x.id===pa.id); user.ownedHeroes=['strom']; user.points=100; user.coins=17; data.accounts.find(x=>x.id===pb.id).points=100; });
  const before = await accounts.profile(pa.id);
  assert.deepEqual(before.ownedHeroes,Object.keys(HEROES)); assert.equal(before.coins,17); assert.equal(before.points,100);
  let expectedA=100, expectedB=100;
  for (const [bestOf,win,loss] of [[1,10,5],[3,30,10],[5,50,15]]) {
    const g = {mode:'ranked',series:{id:`format-${bestOf}`,bestOf,finished:true,winnerId:'a'},players:[{id:'a',accountId:pa.id},{id:'b',accountId:pb.id}]};
    await accounts.settle(g); await accounts.settle(g); expectedA+=win; expectedB-=loss;
    assert.equal((await accounts.profile(pa.id)).points,expectedA); assert.equal((await accounts.profile(pb.id)).points,expectedB);
  }
  assert.equal((await accounts.profile(pa.id)).coins,17);
});
