export const CARD_BACK = '/assets/bagian belakang kartu.png';
export const MAX_ENERGY = 3;
export const SKILL_TYPES = {
  sword: { name: 'Pedang', icon: 'sword', counters: 'shield' },
  arrow: { name: 'Panah', icon: 'bow', counters: 'sword' },
  shield: { name: 'Perisai', icon: 'shield', counters: 'arrow' },
};

export const HEROES = {
  strom: {
    id: 'strom', name: 'STROM FIST', title: 'Sang pengendali petir', role: 'FIGHTER',
    element: 'PETIR', color: '#75baff', hp: 160, defense: 60,
    description: 'Kekuatan badai di genggamanmu. Serang, bertahan, lalu lepaskan amarah petir.',
    image: '/assets/Heroes/STROM FIST/STROM FIST.png',
    skills: [
      { id: 'lightning', name: 'Lightning', type: 'sword', damage: [10, 10], effect: '+20 defense (maksimum 60) dan stun lawan selama 1 babak berikutnya jika berhasil counter.', summary: '+20 DEF · STUN 1', tag: 'SERANGAN', image: '/assets/Heroes/STROM FIST/PEDANG.png', defense: 20, stun: 1 },
      { id: 'silent', name: 'Silent', type: 'arrow', damage: [10, 10], effect: 'Kurangi damage masuk 10% selama 3 babak, termasuk babak aktivasi, jika berhasil counter.', summary: 'REDUKSI 10% · 3 BABAK', tag: 'PERTAHANAN', image: '/assets/Heroes/STROM FIST/PERISAI.png', reduction: 0.1, reductionDuration: 3 },
      { id: 'ultimate', name: 'The Ultimate', type: 'shield', damage: [40, 45], effect: 'Lepaskan petir dengan 40–45 damage jika berhasil counter.', summary: 'SERANGAN PETIR', tag: 'ULTIMATE', image: '/assets/Heroes/STROM FIST/PANAH.png' },
    ],
    ultimate: { id: 'super-buff', name: 'Super Buff', damage: [25, 25], effect: '25 damage. Skill 1–3 mendapat +30 damage sampai duel selesai, tanpa menumpuk. Ultimate tidak mendapat bonus ini.', summary: '+30 DMG SKILL 1–3 · PERMANEN', image: '/assets/Heroes/STROM FIST/Skill Ultimate.png', basicBuff: 30, isUltimate: true },
  },
  roger: {
    id: 'roger', name: 'ROGER', title: 'Satu tembakan. Satu legenda.', role: 'MARKSMAN',
    element: 'API', color: '#efbd72', hp: 120, defense: 20,
    description: 'Sheriff dari perbatasan. Bidik tanpa ragu dan tinggalkan bara di medan pertarungan.',
    image: '/assets/Heroes/Roger/Roger Hero card.png',
    passive: { damage: 5, description: 'Saat skill Roger dicounter, berikan 5 damage kepada lawan, termasuk ketika kedua tipe sama.' },
    skills: [
      { id: 'free-fire', name: 'Free Fire', type: 'sword', damage: [20, 20], effect: 'Tembakan cepat dengan 20 damage jika berhasil counter.', summary: 'TEMBAKAN CEPAT', tag: 'SERANGAN', image: '/assets/Heroes/Roger/PEDANG.png' },
      { id: 'long-fire', name: 'Long Fire', type: 'arrow', damage: [30, 30], effect: 'Tembakan jarak jauh dengan 30 damage jika berhasil counter.', summary: 'TEMBAKAN JARAK JAUH', tag: 'JARAK JAUH', image: '/assets/Heroes/Roger/PANAH.png' },
      { id: 'bom', name: 'Bom', type: 'shield', damage: [60, 60], effect: 'Jika berhasil counter, burn memberi 10 damage per babak selama 3 babak berikutnya.', summary: 'BURN 10 · 3 BABAK', tag: 'ULTIMATE', image: '/assets/Heroes/Roger/PERISAI.png', burn: 3, burnDamage: 10 },
    ],
    ultimate: { id: 'time-boom', name: 'Time Boom', damage: [150, 150], effect: '150 damage jika berhasil counter. Memakai kartu ini mengorbankan 40 HP sendiri, termasuk saat dicounter. Biaya HP tidak dapat ditahan imun.', summary: '150 DMG · BIAYA 40 HP', image: '/assets/Heroes/Roger/Skill Ultimate.png', hpCost: 40, isUltimate: true },
  },
  kristina: {
    id: 'kristina', name: 'KRISTINA', title: 'Bayangan yang mematikan', role: 'ASSASSIN',
    element: 'BAYANGAN', color: '#cf8df5', hp: 130, defense: 40,
    description: 'Bergerak dalam bayangan, hindari serangan, lalu akhiri duel pada saat yang tepat.',
    image: '/assets/Heroes/KRISTINA/kartu_hero_kristina.png',
    skills: [
      { id: 'shadow-burst', name: 'Shadow Burst', type: 'sword', damage: [40, 40], effect: '40 damage. Jika berhasil counter, tambah 10 damage serangan selama 3 babak berikutnya, termasuk Execute. Buff diperbarui tanpa menumpuk.', summary: '+10 DMG · 3 BABAK BERIKUTNYA', tag: 'BUFF', image: '/assets/Heroes/KRISTINA/Skill 1.png', damageBuff: 10, damageBuffDuration: 3 },
      { id: 'dust', name: 'Dust', type: 'arrow', damage: [35, 35], effect: '35 damage. Jika berhasil counter, imun terhadap damage dan efek negatif baru selama babak aktivasi dan 1 babak berikutnya. Efek lama tetap menghitung durasi.', summary: 'IMUN · 2 BABAK', tag: 'IMUN', image: '/assets/Heroes/KRISTINA/Skill 2.png', immunity: 2 },
      { id: 'fly-over', name: 'Fly Over', type: 'shield', damage: [40, 40], effect: '40 damage langsung ke HP, melewati defense tanpa mengurangi DEF lawan.', summary: '40 DAMAGE LANGSUNG HP', tag: 'SERANGAN', image: '/assets/Heroes/KRISTINA/Skill 3.png', pierce: true },
    ],
    ultimate: { id: 'execute', name: 'Execute', damage: [0, 0], damagePercent: 0.5, effect: 'Damage sebesar 50% dari jumlah HP + DEF maksimum target (dibulatkan ke atas). Jika HP target sebelum serangan di bawah 60% HP maksimum, langsung eliminasi. Imun, Dodge, dan pelindung HP Warfet tetap berlaku.', summary: '50% TOTAL MAKS · EKSEKUSI <60%', tag: 'ULTIMATE KHUSUS', image: '/assets/Heroes/KRISTINA/Ultimate.png', executeBelow: 0.6, isUltimate: true },
  },
  golar: {
    id: 'golar', name: 'GOLAR', title: 'Benteng yang tak gentar', role: 'TANK',
    element: 'BAJA', color: '#9eb9cf', hp: 190, defense: 60,
    description: 'Beri luka, tandai kekuatanmu, lalu lepaskan laser yang terus membakar.',
    image: '/assets/Heroes/GOLAR/Golar hero card.jpeg',
    skills: [
      { id: 'deadly-slash', name: 'Deadly Slash', type: 'sword', damage: [20, 20], effect: '20 damage. Luka mengurangi 10 HP langsung selama 2 babak berikutnya.', summary: 'LUKA · 10 HP × 2', image: '/assets/Heroes/GOLAR/Skill 1.png', wound: 2 },
      { id: 'mark', name: 'Mark', type: 'arrow', damage: [5, 5], effect: '5 damage. Semua skill, termasuk ultimate, mendapat +20 damage selama 3 babak berikutnya. Tidak menumpuk.', summary: '+20 DMG · 3 BABAK BERIKUTNYA', image: '/assets/Heroes/GOLAR/Skill 2.png', damageBuff: 20, damageBuffDuration: 3 },
      { id: 'analysis-system', name: 'Analysis System', type: 'shield', damage: [0, 0], effect: 'Kurangi damage masuk 20% selama babak aktivasi dan 2 babak berikutnya.', summary: 'REDUKSI 20% · 3 BABAK', image: '/assets/Heroes/GOLAR/Skill 3.png', reduction: 0.2, reductionDuration: 3 },
    ],
    ultimate: { id: 'laser', name: 'Laser', damage: [40, 40], effect: '40 damage. Burn mengurangi 10 DEF/HP selama 7 babak berikutnya.', summary: 'BURN 10 · 7 BABAK', image: '/assets/Heroes/GOLAR/Skill Ulti.png', burn: 7, burnDamage: 10, isUltimate: true },
  },
  warfet: {
    id: 'warfet', name: 'WARFET', title: 'Mimpi buruk Empire', role: 'MAGE',
    element: 'JIWA', color: '#ba9ee7', hp: 50, defense: 150,
    description: 'Kunci jiwa lawan, curi kekuatannya, dan tinggalkan kutukan sepanjang duel.',
    image: '/assets/Heroes/Warfet/Warfet Hero Card.jpeg',
    passive: { name: 'Absolute Protector of the Soul', protectHpWithDefense: true, description: 'HP tidak dapat dikurangi selama DEF masih ada, termasuk damage langsung HP dan eliminasi. Serangan biasa tetap mengurangi DEF; sisa damage dapat mengenai HP setelah DEF habis.' },
    skills: [
      { id: 'soul-lock', name: 'Soul Lock', type: 'sword', damage: [20, 20], effect: '20 damage dan stun lawan selama 1 babak berikutnya.', summary: 'STUN · 1 BABAK', image: '/assets/Heroes/Warfet/Skill 1.png', stun: 1 },
      { id: 'soul-thief', name: 'Soul Thief', type: 'arrow', damage: [30, 30], effect: '30 damage. Pada babak berikutnya, kurangi 20 HP lawan tanpa mengurangi defense. Setiap serangan yang mengenai lawan menambah pemulihan DEF Soul User sebesar 10.', summary: 'CURI 20 HP · BABAK BERIKUTNYA', image: '/assets/Heroes/Warfet/Skill 2.png', soulDrain: 1, soulStack: true },
      { id: 'soul-user', name: 'Soul User', type: 'shield', damage: [0, 0], effect: 'Pulihkan 10 DEF, ditambah 10 DEF per Soul Thief yang sebelumnya mengenai lawan. Maksimum 150 DEF; tumpukan tidak dikonsumsi.', summary: '+10 DEF + JIWA TERKUMPUL', image: '/assets/Heroes/Warfet/Skill 3.png', defense: 10, defensePerSoul: 10 },
    ],
    ultimate: { id: 'curser-of-souls', name: 'Curser Of Souls', damage: [5, 5], effect: '5 damage. Curse mengurangi 10 HP langsung pada setiap babak berikutnya sampai duel selesai. Tidak menumpuk.', summary: 'CURSE · 10 HP SETIAP BABAK', image: '/assets/Heroes/Warfet/Ultimate.png', curse: true, isUltimate: true },
  },
  nextland: {
    id: 'nextland', name: 'NEXTLAND', title: 'Pemimpin tim khusus klan Ninja', role: 'ASSASSIN',
    element: 'ANGIN', color: '#a6dbce', hp: 170, defense: 30,
    description: 'Setiap serangan yang mengenai lawan membuat seluruh skill semakin mematikan.',
    image: '/assets/Heroes/Nexland/Nexland Hero Card.jpeg',
    passive: { name: 'Blood Thirst', hitBonus: 5, description: 'Setiap serangan skill yang mengenai lawan menambah +5 damage untuk semua skill berikutnya, termasuk ultimate, sampai duel selesai.' },
    skills: [
      { id: 'wind-slasher', name: 'Wind Slasher', type: 'sword', damage: [40, 40], effect: '40 damage jika berhasil counter.', summary: 'TEBASAN ANGIN', image: '/assets/Heroes/Nexland/Skill 1.png' },
      { id: 'critical-hit', name: 'Critical Hit', type: 'arrow', damage: [30, 30], effect: '30 damage. Scar mengurangi 10 DEF/HP pada 2 babak berikutnya.', summary: 'SCAR 10 · 2 BABAK', image: '/assets/Heroes/Nexland/Skill 2.png', scar: 2 },
      { id: 'shadow', name: 'Shadow', type: 'shield', damage: [5, 5], effect: '5 damage. Kurangi setiap sumber damage masuk sebesar 30 selama babak aktivasi dan 2 babak berikutnya. Minimum damage nol.', summary: 'REDUKSI 30 DMG · 3 BABAK', image: '/assets/Heroes/Nexland/Skill 3.png', flatReduction: 30, flatReductionDuration: 3 },
    ],
    ultimate: { id: 'shadow-of-a-killer', name: 'Shadow of a Killer', damage: [70, 70], effect: '70 damage jika berhasil counter, ditambah bonus Blood Thirst.', summary: 'SERANGAN PEMBUNUH', image: '/assets/Heroes/Nexland/Ultimate.png', isUltimate: true },
  },
  rafel: {
    id: 'rafel', name: 'RAFEL', title: 'Putri sulung Raja Empire', role: 'FIGHTER',
    element: 'RANTAI', color: '#e7ac9a', hp: 100, defense: 100,
    description: 'Bangkitkan semangat petarung dan hancurkan pertahanan lawan dengan rantai kembar.',
    image: '/assets/Heroes/Rafel/Rafel Hero Card.jpeg',
    skills: [
      { id: 'chain-whip', name: 'Chain Whip', type: 'sword', damage: [20, 20], effect: '20 damage jika berhasil counter.', summary: 'CAMBUK RANTAI', image: '/assets/Heroes/Rafel/Skill 1.png' },
      { id: 'chain-blade', name: 'Chain Blade', type: 'arrow', damage: [30, 30], effect: '30 damage jika berhasil counter.', summary: 'BILAH RANTAI', image: '/assets/Heroes/Rafel/Skill 2.png' },
      { id: 'fighter-spirit', name: 'The Spirit of a Fighter', type: 'shield', damage: [2, 2], effect: '2 damage. Damage skill utama menjadi 2× selama 3 babak berikutnya. Tidak berlaku pada ultimate dan tidak menumpuk.', summary: '2× DMG SKILL 1–3 · 3 BABAK', image: '/assets/Heroes/Rafel/Skill 3.png', damageMultiplier: 2, multiplierDuration: 3 },
    ],
    ultimate: { id: 'twin-chain-blades', name: 'Twin Chain Blades', damage: [60, 60], effect: 'Hancurkan seluruh defense lawan sebelum memberikan 60 damage jika berhasil counter.', summary: 'HANCURKAN SELURUH DEF', image: '/assets/Heroes/Rafel/Ultimate.png', destroyDefense: true, isUltimate: true },
  },
  quexyana: {
    id: 'quexyana', name: 'QUEXYANA', title: 'Pemimpin para robot', role: 'MARKSMAN',
    element: 'TEKNOLOGI', color: '#8dd7e7', hp: 100, defense: 70,
    description: 'Kuasai arena dengan laser pembakar dan perisai pemantul serangan.',
    image: '/assets/Heroes/QUEXYANA/QUEXYANA Hero card.jpeg',
    skills: [
      { id: 'burning-laser', name: 'Burning Laser', type: 'sword', damage: [30, 30], effect: '30 damage. Burn mengurangi 5 DEF/HP pada 3 babak berikutnya.', summary: 'BURN 5 · 3 BABAK', image: '/assets/Heroes/QUEXYANA/Skill 1.png', burn: 3, burnDamage: 5 },
      { id: 'hail-of-bullets', name: 'A Hail of Bullets', type: 'arrow', damage: [30, 30], effect: '30 damage jika berhasil counter.', summary: 'HUJAN PELURU', image: '/assets/Heroes/QUEXYANA/Skill 2.png' },
      { id: 'technology-shield', name: 'Technology Shield', type: 'shield', damage: [0, 0], effect: 'Jika dicounter, Quexyana tidak menerima damage serangan skill tersebut. Pantulkan 50% damagenya ke penyerang, dibulatkan ke atas. Efek tambahan lawan tetap berlaku; efek berkala lama tidak dipantulkan.', summary: 'TAHAN SKILL · PANTULKAN 50%', image: '/assets/Heroes/QUEXYANA/Skill 3.png', reflectOnCounter: 0.5 },
    ],
    ultimate: { id: 'crushing-technology', name: 'Crushing Technology', damage: [90, 90], effect: '90 damage jika berhasil counter.', summary: 'SERANGAN TEKNOLOGI', image: '/assets/Heroes/QUEXYANA/Skill Ultimate.png', isUltimate: true },
  },
  genggar: {
    id: 'genggar', name: 'GENGGAR', title: 'Penyihir agung Empire', role: 'MAGE',
    element: 'SIHIR', color: '#c38bff', hp: 70, defense: 70,
    description: 'Kendalikan pilihan lawan dengan Hypno, curi energi, dan kuasai arena lewat medan sihir.',
    image: '/assets/Heroes/Genggar/Genggar Hero Card.jpeg',
    skills: [
      { id: 'magic-shot', name: 'Magic Shot', type: 'sword', damage: [30, 30], effect: '30 damage. Jika energi Magic Shot tersisa 1 sebelum digunakan, kartu bercahaya dan damage menjadi 90 (30 + 60). Bonus tetap membutuhkan counter berhasil.', summary: 'ENERGI TERAKHIR · +60 DMG', image: '/assets/Heroes/Genggar/Skill 1.png', lastEnergyBonus: 60 },
      { id: 'hypno', name: 'Hypno', type: 'arrow', damage: [0, 0], effect: 'Lawan menerima damage skillnya sendiri ketika berhasil counter selama 2 babak berikutnya.', summary: 'HYPNO · 2 BABAK', image: '/assets/Heroes/Genggar/Skill 2.png', hypno: 2 },
      { id: 'energy-thief', name: 'Energy Thief', type: 'shield', damage: [0, 0], effect: 'Pilih tipe energi lawan dan tipe energi sendiri secara terpisah. Jika berhasil counter, pindahkan 1 energi yang masih tersedia ke tipe pilihanmu, maksimum 3. Pemindahan diproses setelah biaya energi babak ini.', summary: 'CURI 1 ENERGI · PILIH TUJUAN', image: '/assets/Heroes/Genggar/Skill 3.png', stealEnergy: 1 },
    ],
    ultimate: { id: 'magic-field', name: 'Medan Sihir', damage: [30, 30], effect: '30 damage. Selama 10 babak berikutnya, damage skill lawan berkurang 50% dan lawan kehilangan 5 HP per babak. Maksimum DEF sendiri menjadi 100 dan terisi penuh. Ultimate juga aktif setelah babak 9, 18, 27, dan seterusnya.', summary: 'MEDAN 10 BABAK · DEF 100', image: '/assets/Heroes/Genggar/Skill Ultimate.png', damageDown: 0.5, damageDownDuration: 10, magicField: 10, magicFieldDamage: 5, newMaxDefense: 100, refillDefense: true, unlockEvery: 9, isUltimate: true },
  },
  spearos: {
    id: 'spearos', name: 'SPEAROS', title: 'Panglima perang Empire', role: 'TANK',
    element: 'TOMBAK', color: '#edd393', hp: 150, defense: 100,
    description: 'Pulihkan pertahanan, tahan pedang lawan, lalu bersihkan debuff dengan tombak ilahi.',
    image: '/assets/Heroes/Spearos/Spearos Hero Card.jpeg',
    passive: { name: 'Armor', counterReduction: 0.1, description: 'Kurangi 10% damage serangan skill yang mengcounter kartu Spearos. Hanya serangan tersebut; tidak menumpuk. Dapat bekerja bersama battle spell Armor.' },
    skills: [
      { id: 'knights-resolve', name: "Knight’s Resolve", type: 'sword', damage: [5, 5], effect: '5 damage dan pulihkan 40 DEF, maksimum 100 DEF.', summary: '+40 DEF', image: '/assets/Heroes/Spearos/Skill 1.png', defense: 40 },
      { id: 'spear-strike', name: 'Spear Strike', type: 'arrow', damage: [20, 20], effect: '20 damage jika berhasil counter.', summary: 'TUSUKAN TOMBAK', image: '/assets/Heroes/Spearos/Skill 2.png' },
      { id: 'royal-whirlwind', name: 'Royal Whirlwind', type: 'shield', damage: [20, 20], effect: '20 damage. Imun terhadap damage skill bertipe pedang selama babak aktivasi dan 2 babak berikutnya. Efek negatif dan damage non-pedang tetap berlaku.', summary: 'IMUN PEDANG · 3 BABAK', image: '/assets/Heroes/Spearos/Skill 3.png', swordImmunity: 3 },
    ],
    ultimate: { id: 'divine-spear', name: 'Divine Spear', damage: [50, 50], effect: 'Bersihkan semua debuff sendiri sebelum memberi 50 damage. Lawan kehilangan 15% damage semua skillnya sampai pertandingan selesai. Debuff bertambah 15 poin persentase setiap aplikasi, maksimum 100%.', summary: 'BERSIHKAN DEBUFF · −15% DMG', image: '/assets/Heroes/Spearos/Skill Ultimate.png', cleanse: true, permanentDamageDown: 0.15, isUltimate: true },
  },
  karina: {
    id: 'karina', name: 'KARINA', title: 'Pemilik Sword Dimensions', role: 'ASSASSIN',
    element: 'DIMENSI', color: '#e3a0e9', hp: 100, defense: 20,
    description: 'Pasangan Nextland yang membuka celah dimensi untuk meledakkan pertahanan lawan.',
    image: '/assets/Heroes/Karina/Karina Hero Card.jpeg',
    passive: { name: 'Dimensional Explosion', riftThreshold: 2, riftDamage: 40, description: 'Setiap 2 rift yang diaktifkan memicu ledakan 40 DEF/HP pada lawan. Rift yang belum berpasangan tersimpan; rift yang meledak dikonsumsi.' },
    skills: [
      { id: 'dimensional-slash', name: 'Dimensional Slash', type: 'sword', damage: [30, 30], effect: '30 damage dan aktifkan 1 dimensional rift jika berhasil counter.', summary: '+1 DIMENSIONAL RIFT', image: '/assets/Heroes/Karina/Skill 1.png', rifts: 1 },
      { id: 'dimensional-movement', name: 'Dimensional Movement', type: 'arrow', damage: [30, 30], effect: '30 damage dan aktifkan 1 dimensional rift jika berhasil counter.', summary: '+1 DIMENSIONAL RIFT', image: '/assets/Heroes/Karina/Skill 2.png', rifts: 1 },
      { id: 'chaser-dimensions', name: 'Chaser Dimensions', type: 'shield', damage: [10, 10], effect: '10 damage dan stun lawan selama 1 babak berikutnya.', summary: 'STUN · 1 BABAK', image: '/assets/Heroes/Karina/Skill 3.png', stun: 1 },
    ],
    ultimate: { id: 'king-of-dimensions', name: 'King of Dimensions', damage: [0, 0], effect: 'Aktifkan 6 rift sekaligus, memicu 3 ledakan. Setiap pemakaian yang berhasil menambah lagi 1 rift pada skill 1 dan 2 sampai pertandingan selesai; bonus menumpuk.', summary: '+6 RIFT · BONUS +1 MENUMPUK', image: '/assets/Heroes/Karina/Skill Ultimate.png', rifts: 6, riftBonus: 1, isUltimate: true },
  },
  newland: {
    id: 'newland', name: 'NEWLAND', title: 'Pemanah terbaik klan Ninja', role: 'MARKSMAN',
    element: 'RACUN', color: '#a9d785', hp: 170, defense: 10,
    description: 'Adik Nextland dengan panah penembus defense dan racun yang bertahan sepanjang pertandingan.',
    image: '/assets/Heroes/Newland/Newland Hero Card.jpeg',
    skills: [
      { id: 'sharpest-arrow', name: 'The Sharpest Arrow', type: 'sword', damage: [30, 30], effect: '30 damage langsung ke HP lawan, melewati defense.', summary: '30 DAMAGE LANGSUNG HP', image: '/assets/Heroes/Newland/ Skill 1.png', pierce: true },
      { id: 'arrows-all-directions', name: 'Arrows In All Directions', type: 'arrow', damage: [30, 30], effect: '30 damage jika berhasil counter. Jika kartu ini dicounter, termasuk tipe sama, balas dengan 10 DEF/HP pada lawan.', summary: 'BALAS 10 SAAT DICOUNTER', image: '/assets/Heroes/Newland/Skill 2.png', counteredDamage: 10 },
      { id: 'three-shoot', name: 'Three Shoot', type: 'shield', damage: [30, 30], effect: '30 damage jika berhasil counter.', summary: 'TIGA TEMBAKAN', image: '/assets/Heroes/Newland/Skill 3.png' },
    ],
    ultimate: { id: 'poisoned-arrow', name: 'Poisoned Arrow', damage: [30, 30], effect: '30 damage. Poison mengurangi 30 HP langsung pada setiap babak berikutnya sampai pertandingan selesai. Tidak menumpuk; dapat dibersihkan.', summary: 'POISON · 30 HP PER BABAK', image: '/assets/Heroes/Newland/Skill Ultimate.png', poison: 30, isUltimate: true },
  },
};

export function findSkill(heroId, skillId, type = null) {
  const hero = Object.hasOwn(HEROES, heroId) ? HEROES[heroId] : null;
  return hero?.skills.find(skill => skill.id === skillId) ||
    (hero?.ultimate?.id === skillId ? { ...hero.ultimate, type: typeof type === 'string' && Object.hasOwn(SKILL_TYPES, type) ? type : null } : null);
}

export function damageLabel(skill) {
  if (skill.damagePercent) return `${Math.round(skill.damagePercent * 100)}%`;
  return skill.damage[0] === skill.damage[1] ? String(skill.damage[0]) : skill.damage.join('–');
}
