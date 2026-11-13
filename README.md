# Empire Card

Duel kartu simultan untuk dua pemain di browser. Menggunakan aset asli `assets/` dan konsep `concept/`. **Versi 0.7** menambahkan Genggar, Spearos, Karina, dan Newland; menyesuaikan buff/nerf hero serta spell; merahasiakan hero/spell di lobby; dan memperbarui poin serta tingkat rank. Akun, teman, chat, dan seri duel tetap tersedia. **Dua belas hero terbuka untuk pengujian, termasuk akun lama; koin dan toko belum melakukan transaksi atau memberi hadiah koin.**

## Jalankan

Butuh **Node.js 22 atau lebih baru**. Satu dependency runtime: `pg` untuk opsi penyimpanan PostgreSQL.

```bash
npm ci
npm start
```

Buka **http://localhost:3000**. Mode pengembangan: `npm run dev`. Port khusus: `PORT=3100 npm start`. Membatasi akses ke komputer sendiri: `HOST=127.0.0.1 npm start`.

1. **Registrasi** memakai email, username 2–20 karakter, dan password 12–128 karakter. Akun diperlukan sebelum masuk menu; login kembali memakai email/password yang sama.
2. Pilih **Main sekarang**, hero, battle spell, mode **Casual/Ranked**, dan seri **1/3/5 pertandingan**. Untuk bermain sendiri pilih **Latihan vs bot**.
3. Buat room. Bagikan kode/tautan, atau tambahkan UID pemain dari halaman **Teman**, tunggu diterima, lalu **Ajak duel**. Penerima cukup menekan **Gabung** pada undangan.
4. Hero dan spell dapat diganti di lobby; pilihan rival dirahasiakan sampai pertandingan dimulai, termasuk pada lobby antarpertandingan. Duel dimulai setelah keduanya menekan **Aku siap bertarung**. Chat lobby tersedia sebelum/sesudah pertandingan; chat global tersedia di halaman Teman.
5. Pilih satu skill lalu **Letakkan kartu tertutup**. Setelah kedua kartu terkunci, hitungan **4 → 3 → 2 → 1** dimulai. Kartu dibuka bersamaan; hasil babak ditampilkan 5,5 detik.
6. Setelah pertandingan, kedua pemain memilih **Lanjut ke lobby berikutnya** untuk mengganti loadout dan bersiap lagi. Sesudah seri selesai, pilih **Main seri lagi** atau **Keluar ke menu**.

Pilihan hero/spell awal disimpan di browser. Identitas dan kepemilikan hero diperiksa server. Pilihan di room bertahan setelah refresh, sedangkan efek, HP/DEF, tumpukan, charge dan energi direset pada **setiap pertandingan**, termasuk Super Buff STROM FIST yang tidak menumpuk.

## Seri duel dan ranked

| Format | Syarat kemenangan seri |
| --- | --- |
| Best of 1 | 1 kemenangan |
| Best of 3 | 2 kemenangan; langsung selesai saat 2–0 |
| Best of 5 | 3 kemenangan; langsung selesai saat 3–0 / 3–1 |

Imbang tidak memberikan kemenangan dan diulang; jumlah pertandingan dapat melebihi format jika ada imbang. Skor seri bertahan saat kembali ke lobby. **Keluar dari seri yang sudah dimulai tetapi belum selesai berarti menyerah**, termasuk saat layar hasil pertandingan atau lobby berikutnya. Keluar dari lobby awal tidak memberi kemenangan/poin. Seri baru memerlukan persetujuan kedua pemain; tidak bisa dimulai kembali jika lawan sudah keluar.

Ranked memberi **BO1: +10/−5 WP; BO3: +30/−10 WP; BO5: +50/−15 WP** untuk menang/kalah seri, minimum 0. Poin yang sudah dimiliki tetap utuh; rank dihitung memakai ambang baru tanpa menghitung ulang hadiah seri lama. Penyimpanan hasil memakai ID seri agar refresh, reconnect, dan klik ulang tidak memberi poin dua kali. Casual mencatat kemenangan/kekalahan tanpa WP; latihan tidak memengaruhi statistik atau WP. Tidak ada perubahan koin.

| Rank | Poin awal rank | Kebutuhan tiap tingkat |
| --- | ---: | ---: |
| Bronze I–V | 0 | 10 WP |
| Elite I–V | 50 | 30 WP |
| Master I–V | 200 | 90 WP |
| Grandmaster I–V | 650 | 270 WP |
| Legendary I–V | 2.000 | 700 WP |
| God | 5.500 | Poin tetap bertambah, tanpa tingkat berikutnya |

Urutan tingkat mengikuti MD: **I → II → III → IV → V**. Leaderboard mengurutkan total WP, lalu jumlah kemenangan dan waktu pendaftaran untuk nilai yang sama. Winrate memakai hasil seri yang sudah tercatat, bukan tiap pertandingan di dalamnya.

## Hero dan buff versi 0.7

Angka berikut mengikuti `concept/hero.md`. Angka dan tipe pada UI/mesin menjadi acuan; teks lama yang tercetak pada gambar aset tidak diubah.

| Hero | HP / DEF | Skill 1 · pedang | Skill 2 · panah | Skill 3 · perisai | Ultimate khusus · pilih tipe |
| --- | --- | --- | --- | --- | --- |
| STROM FIST | 160 / 60 | Lightning: 10, +20 DEF, stun 1 | Silent: 10, reduksi 10% × 3 babak | The Ultimate: 40–45 | Super Buff: 25, +30 damage skill utama sampai duel selesai |
| Roger | 120 / 20 | Free Fire: 20 | Long Fire: 30 | Bom: 60, burn 10 × 3 babak | Time Boom: 150, biaya 40 HP sendiri meski dicounter |
| Kristina | 130 / 40 | Shadow Burst: 40, buff +10 × 3 babak | Dust: 35, imun × 2 babak | Fly Over: 40 langsung HP tanpa menguras DEF | Execute: 50% dari HP maksimum + DEF maksimum target, eliminasi jika HP target sebelum serangan <60% |
| Golar | 190 / 60 | Deadly Slash: 20, luka 10 HP × 2 babak | Mark: 5, buff +20 × 3 babak termasuk ultimate | Analysis System: 0, reduksi 20% × 3 babak | Laser: 40, burn 10 × 7 babak |
| Warfet | 50 / 150 | Soul Lock: 20, stun 1 | Soul Thief: 30, kurangi 20 HP pada babak berikutnya | Soul User: pulih 10 DEF +10 per jiwa terkumpul | Curser Of Souls: 5, curse 10 HP tiap babak sampai duel selesai |
| Nextland | 170 / 30 | Wind Slasher: 40 | Critical Hit: 30, scar 10 × 2 babak | Shadow: 5, kurangi damage masuk sebesar 30 × 3 babak | Shadow of a Killer: 70 |
| Rafel | 100 / 100 | Chain Whip: 20 | Chain Blade: 30 | The Spirit of a Fighter: 2, damage skill utama 2× selama 3 babak | Twin Chain Blades: hancurkan seluruh DEF, lalu 60 damage |
| Quexyana | 100 / 70 | Burning Laser: 30, burn 5 × 3 babak | A Hail of Bullets: 30 | Technology Shield: terima 0 damage skill; pantulkan 50% ketika dicounter | Crushing Technology: 90 |
| Genggar | 70 / 70 | Magic Shot: 30; menjadi 90 saat energi sebelum dipakai tersisa 1 | Hypno: balikkan damage counter selama 2 babak berikutnya | Energy Thief: curi 1 energi; pilih tipe asal dan tujuan secara terpisah | Medan Sihir: 30, damage skill lawan −50% dan −5 HP × 10 babak; maksimum DEF menjadi 100 dan terisi penuh |
| Spearos | 150 / 100 | Knight’s Resolve: 5, +40 DEF | Spear Strike: 20 | Royal Whirlwind: 20, imun damage pedang × 3 babak | Divine Spear: bersihkan semua debuff diri, 50 damage, kurangi damage skill lawan 15% permanen dan menumpuk |
| Karina | 100 / 20 | Dimensional Slash: 30, +1 rift | Dimensional Movement: 30, +1 rift | Chaser Dimensions: 10, stun 1 | King of Dimensions: +6 rift, tambah lagi +1 rift pada skill 1–2 setiap pemakaian berhasil |
| Newland | 170 / 10 | The Sharpest Arrow: 30 langsung HP | Arrows In All Directions: 30; balas 10 jika dicounter | Three Shoot: 30 | Poisoned Arrow: 30, racun 30 HP tiap babak berikutnya sampai akhir |

- **Roger / pasif:** 5 damage saat kartunya dicounter, termasuk tipe sama. Tidak aktif ketika Roger melewati babak karena stun.
- **Nextland / Blood Thirst:** +5 damage permanen untuk semua skill berikutnya setiap serangan skill benar-benar mengenai HP/DEF lawan. Tidak bertambah dari DoT, serangan gagal, imun, Dodge, atau serangan yang dipantulkan.
- **Warfet / jiwa:** setiap Soul Thief yang mengenai lawan menambah satu jiwa. Tiap jiwa menambah pemulihan Soul User sebesar 10 DEF, tidak dikonsumsi. Pemulihan maksimal 150 DEF. **Absolute Protector of the Soul** menahan damage langsung HP, efek berkala langsung HP, dan eliminasi Execute selama DEF masih ada. Serangan biasa tetap menguras DEF; sisanya mengenai HP setelah DEF habis.
- **Super Buff:** durasi sampai duel selesai dan tidak menumpuk, sesuai konfirmasi pengguna. Bonus hanya skill 1–3, bukan ultimate khusus.
- **Genggar / Energy Thief:** opsi asal dan tujuan boleh berbeda. Transfer sesudah kedua biaya kartu, sebelum isi ulang otomatis; dibatasi energi lawan yang tersisa dan kapasitas tujuan. Tujuan penuh/asal kosong tidak memindahkan energi. Pilihan energi juga tetap rahasia sampai reveal. Ultimate aktif setelah selesai babak 9, 18, 27, dst., selain pemicu energi habis; charge tidak menumpuk. Nama sementara ultimate **Medan Sihir** mengikuti efek pada MD yang belum memberikan nama.
- **Spearos / Armor:** reduksi 10% hanya serangan yang mengcounter saat itu. Jika memakai spell Armor, pengurangan dikalikan: 20 damage × 90% × 80% = 14,4, dibulatkan menjadi 15. Imun pedang menahan damage skill pedang, bukan efek negatif atau damage berkala. Divine Spear menghapus debuff sebelum perhitungan damage/tick babak itu; pengurangan damage menumpuk 15 poin persentase sampai maksimal 100%.
- **Karina / Dimensional Explosion:** tiap 2 rift memicu satu ledakan 40 DEF/HP; rift dikonsumsi, sisa ganjil disimpan. Ultimate membuka 6 rift (3 ledakan) dan setiap aktivasi berhasil menambah +1 lagi pada pembukaan rift skill 1–2 sepanjang pertandingan. Pembukaan rift adalah efek diri; ledakan terpisah dari damage skill. Imun/reduksi umum menahan ledakan; Dodge hanya menghindari skill. Reduksi tetap diterapkan pada setiap ledakan.
- **Newland:** hero baru, berbeda dengan Nextland. Balasan skill 2 juga aktif pada tipe sama, tetapi tidak saat stun. Racun tidak menumpuk dan dapat dibersihkan oleh Divine Spear.
- Nama **Nextland** mengikuti MD; file gambar tetap memakai folder asli `assets/Heroes/Nexland/`.

## Battle spell

Satu kartu bantuan dipilih sebelum duel, berada di kiri hero, dan aktif otomatis tanpa energi. Kartu dapat diklik untuk melihat efek; progres tampil di bawah kartu. Kedua klien memakai hasil server yang sama.

| Spell | Efek |
| --- | --- |
| Execute | Setelah damage babak selesai, eliminasi lawan dengan HP **≤25%** maksimum, termasuk jika skill pemilik gagal. |
| Retribution | Setiap counter berhasil menambah **+5 damage** untuk semua skill berikutnya; menumpuk selama pertandingan. |
| Inspire | Setiap counter berhasil **ke-3, ke-6, dst.**, serangan skill tersebut mendapat **3× damage**. |
| Dodge | Setiap kali skill dikalahkan counter **ke-3, ke-6, dst.**, serangan dan efek baru skill lawan itu tidak berlaku. Efek lama tetap berjalan. |
| Healing | Setiap **dua kali dicounter**, pulihkan sampai **30 HP** di akhir babak, maksimal HP awal. Tidak menghidupkan hero yang sudah gugur. |
| Armor | Kurangi **20% damage** dari serangan skill lawan yang mengcounter kartumu, minimum nol. |

Hitungan counter untuk spell harus benar-benar menang/kalah terhadap kartu lawan: **tipe sama dan serangan tanpa perlawanan karena stun tidak dihitung**. Hitungan tidak harus berurutan. Armor hanya mengurangi serangan skill tersebut, bukan pasif, burn/efek lama, atau serangan ketika pemilik stun. Execute spell diblokir imun dan pasif Warfet selama masih ada DEF; pemeriksaannya sebelum Healing, dan kedua spell Execute diperiksa serentak sehingga bisa menghasilkan imbang.

## Resolusi dan durasi efek

- Pedang mengcounter perisai, perisai mengcounter panah, panah mengcounter pedang. Tipe sama menggagalkan kedua kartu. Hanya skill yang berhasil counter/menyerang lawan stun mengaktifkan attack dan efek, kecuali pengecualian eksplisit: pasif Roger, balasan Newland, biaya Time Boom, pantulan Technology Shield, dan battle spell.
- Setiap tipe mempunyai **3 energi**. Memakai kartu menghabiskan satu energi walaupun gagal. Energi nol memban tipe tersebut sampai ketiganya habis; setelah itu semuanya kembali tiga dan ultimate khusus aktif.
- Ultimate memakai **satu kesempatan dan satu energi dari tipe yang dipilih**, mengikuti counter biasa. Kesempatan berikutnya terbuka setelah semua energi kembali habis; kesempatan tidak ditumpuk. The Ultimate STROM FIST tetap merupakan skill utama ketiga, terpisah dari Super Buff.
- Hero/spell di lobby, pilihan kartu, dua tipe Energy Thief, tipe ultimate, dan perubahan energi/charge tetap tersembunyi dari rival sampai reveal. Server menentukan HP, DEF, status, waktu, dan hasil.
- Defense menerima damage lebih dahulu. **Fly Over, The Sharpest Arrow, luka, Soul Thief, curse, medan sihir, dan racun** melewati defense, tetapi ditahan pasif Warfet ketika DEF masih ada. Twin Chain Blades menghapus DEF **sebelum** damage.
- Buff damage Shadow Burst/Mark dan pengganda Rafel berlaku pada **tiga babak berikutnya**; refresh memperbarui durasi tanpa menumpuk. Durasi tetap berjalan pada babak gagal/stun. Super Buff mulai serangan berikutnya dan permanen.
- Imun, imun pedang, Silent, Analysis System, dan Shadow berlaku **sejak babak aktivasi**, lalu sisa durasinya. Persentase pengurangan umum, Armor spell, dan pasif Spearos dikalikan lebih dulu (hasil dibulatkan ke atas), lalu pengurangan tetap, minimum nol. Pengurangan umum juga berlaku pada damage efek berkala; damage langsung HP hanya melewati DEF.
- Imun menahan damage, eliminasi Execute, pengurasan DEF, dan efek negatif baru. Efek lama tetap menghitung durasi. Imun tidak menahan biaya HP Time Boom.
- Burn, luka, scar, Soul Thief, curse, poison, medan sihir, Hypno, dan stun mulai **babak berikutnya**. Status sejenis diperbarui tanpa menumpuk; burn baru mengganti damage/durasinya. Status berbeda bisa berlangsung bersama. Curse dan poison berlangsung sampai dibersihkan atau pertandingan selesai.
- Stun melewati pilihan skill tanpa energi; lawan menyerang tanpa perlawanan. Dua pemain stun tetap melanjutkan babak otomatis.
- Technology Shield adalah pengecualian counter: Quexyana tidak menerima damage skill yang mengalahkannya; penyerang menerima 50% damage tersebut, dibulatkan ke atas. Pantulan Execute yang seharusnya mengeliminasi Quexyana mengembalikan separuh HP Quexyana sebelum serangan sebagai damage langsung HP, bukan eliminasi penuh. Efek tambahan lawan masih mengikuti target semula; burn lama tidak dipantulkan. Pantulan tidak memantul ulang. Imun/Dodge didahulukan sebelum pantulan.
- Hypno mengarahkan attack skill yang berhasil counter ke diri sendiri, termasuk karakteristik serangan seperti tembus DEF dan pemeriksaan Execute. Efek tambahan tetap mengikuti target semula. Tidak memantulkan skill gagal/serangan tanpa perlawanan. Hypno diberikan skill kedua Genggar selama dua babak berikutnya.
- Bonus damage ditambahkan ke damage dasar, lalu pengganda skill utama Rafel, lalu Inspire dan pengurangan damage skill (medan sihir × pengurangan Divine Spear). Pengganda hanya memengaruhi serangan skill, bukan burn, pasif, atau biaya HP.
- Execute Kristina memakai **50% × (HP maksimum + DEF maksimum target)**, dibulatkan ke atas, lalu bonus/pengurangan biasa. Contoh melawan STROM FIST: 50% × (160 + 60) = **110 damage**, walaupun DEF tersisa sudah berkurang. Efek eliminasi memeriksa HP **sebelum serangan**, dengan batas ketat **<60%**. Pada tepat 60% memberi damage persentase biasa. Eliminasi melewati DEF/reduksi, tetapi tidak imun/Dodge atau pasif Warfet dengan DEF tersisa.
- Semua damage kedua pemain diselesaikan sebelum hasil, termasuk pasif, DoT, pantulan, dan biaya HP. Spell Execute kemudian diperiksa, lalu Healing untuk hero yang masih hidup. Dua HP nol berarti imbang.

## Menu, profil, dan audio

Menu utama memuat tombol hero, teman, rank, leaderboard, event, setting, dan matchmaking. Saldo Battle Coin berada pada header dan membuka toko. Arena menampilkan hero, spell kiri, ultimate kanan (abu-abu sebelum aktif), HP/DEF, tiga bar energi, status dan jejak pertarungan. Desktop dan ponsel didukung.

Profil akun mendukung username, UID `EC-XXXXXXXXXX`, rank, WP, winrate, hasil seri, log out, dan foto JPG/PNG/WebP maksimal 2 MB. Foto dipotong persegi, diperkecil 256 × 256, dan disimpan bersama akun. Teman ditambahkan dengan UID, bukan email. Username/foto/UID/rank bersifat publik; email, hash password, sesi akun, dan ID internal tidak dikirim ke rival atau leaderboard.

Event dan pengaturan tambahan tetap **COMING SOON**. Toko menampilkan semua hero terbuka dan saldo 0; harga, pembelian, serta hadiah koin belum aktif. Belum ada pengiriman email verifikasi, pemulihan password, atau matchmaking otomatis.

Audio memakai file asli `assets/Audios/`:

| Kejadian | File | Pemutaran |
| --- | --- | --- |
| Pembuka | `Welcome to the empire card.wav` | Sekali pada interaksi pertama, tidak diulang saat memulihkan duel. |
| Kartu terkunci | `Card Locked.wav` | Setelah server menerima kartu pemain sendiri. |
| Menang | `ENEMI ELIMINATED.wav` | Pada perangkat pemenang. |
| Kalah | `YOU HAVE BEEN SLAIN.wav` | Pada perangkat yang kalah. |
| Musik | `BGM.mp3` | On/off di Setting, pilihan tersimpan di browser. |

Suara hasil mengikuti server (knockout/menyerah), tanpa pengulangan pada reconnect/refresh. Imbang tidak memakai suara menang/kalah. Setiap pertandingan dalam seri memiliki notifikasi hasil sendiri. Menyerah pada sela pertandingan dapat mengubah hasil seri dan memutar notifikasi baru yang sesuai. Notifikasi tetap aktif ketika BGM off. Audio menunggu interaksi sesuai kebijakan browser, dan ditunda jika tab tersembunyi.

## Dua perangkat

Server default mendengarkan `0.0.0.0:3000`. Pada Wi-Fi sama, gunakan alamat **Jaringan** dari terminal, misalnya `http://192.168.1.5:3000`. `localhost` pada ponsel menunjuk ponsel sendiri.

Jika diperlukan di Fedora, buka sementara port dengan `sudo firewall-cmd --add-port=3000/tcp`, dan tutup setelah selesai dengan `sudo firewall-cmd --remove-port=3000/tcp`.

Untuk akses internet, pasang/configure ngrok mengikuti [panduan resmi](https://ngrok.com/docs/start), biarkan server berjalan, lalu:

```bash
ngrok http 3000
```

Kedua pemain memakai URL **HTTPS Forwarding** yang sama. Buat tautan undangan dari alamat itu. Ngrok/authtoken tidak disertakan proyek dan tidak boleh diletakkan di source code.

## Pemeriksaan

```bash
npm run check
npm test
```

Tes mencakup akun/sesi, penyimpanan setelah restart, transaksi gagal, duplikasi settlement, rank/teman/undangan/chat, seri 1/3/5 dan intermission, counter, angka hero terbaru, efek/stack/durasi, seluruh ultimate, enam spell, kasus batas eliminasi, imun/pantulan, energi/ban/refill, stun/Hypno, hasil simultan, reset rematch, privacy, dua klien HTTP/SSE, dan seluruh aset termasuk JPEG. Tes integrasi memerlukan port localhost.

Pengujian browser menggunakan Chrome terpasang, tanpa dependency npm:

```bash
# Setiap skrip membuat server sementara dan akun uji terisolasi
node scripts/browser-smoke.mjs
# Jam dipercepat untuk skenario pertandingan panjang
node scripts/kristina-smoke.mjs
node scripts/update-smoke.mjs
node scripts/series-smoke.mjs
node scripts/v07-smoke.mjs
```

`CHROME_BIN` mengganti lokasi Chrome. Opsional `TEST_URL` mengarahkan tes browser umum ke server pengujian yang sudah berjalan; skrip akan membuat akun dan statistik pengujian di server tersebut. Gunakan server sementara/default untuk menghindari data uji pada akun nyata. Tes update memeriksa dua belas hero/enam spell, pilihan/loadout/reconnect, detail aset, counter/efek melalui UI dua klien, serta lebar 320/390/768/1024/1440 px. Tes seri menjalankan registrasi/login/logout, pertemanan dan undangan via UID, chat, ranked 2–0, penggantian hero/spell, audio per pertandingan, leaderboard, dan toko tanpa transaksi. Tes v0.7 memeriksa pilihan energi terpisah dan rahasia, cahaya Magic Shot 90 damage, Hypno, ultimate babak 9, maksimum DEF 100, medan sihir, cleanse Spearos, rift Karina dan Newland pada dua sisi. Screenshot disimpan di direktori sementara sistem.

## Struktur dan batas versi

```text
assets/             Aset hero, skill, battle spell, belakang kartu, audio
public/heroes.js    Katalog hero/skill/ultimate
public/spells.js    Katalog battle spell dan deskripsi aturan
public/app.js       Navigasi, pemilihan loadout, room, arena
public/interface.js Koleksi hero/spell, event dan setting
public/account-ui.js Menu aplikasi, akun, rank, teman, chat dan toko
public/ranks.js      Tingkatan rank dan progres WP
public/app-shell.css Menu aplikasi dan arena ponsel
public/hub.css      Tampilan menu/arena responsif
public/bgm.js       Musik
public/audio.js     Notifikasi audio per pemain
lib/game.mjs        Mesin duel dan snapshot privat per pemain
lib/accounts.mjs    Autentikasi, sosial, statistik dan settlement
lib/store.mjs       Penyimpanan atomik file / transaksi PostgreSQL
server.mjs          HTTP, akun, room, sesi, SSE, bot
concept/            Dokumen konsep pengguna (tidak diubah implementasi)
test/               Tes unit/integrasi
scripts/            Pengujian browser
```

Server Node menyimpan room di memori, mengirim state melalui SSE, dan menerima aksi melalui HTTP. Restart menghapus room aktif, **bukan akun/teman/rank yang sudah tersimpan**. Akun dapat memulihkan room dari cookie login setelah refresh selama proses server dan room masih ada. Room token di `sessionStorage` terikat ke akun, sehingga token room saja tidak cukup untuk mengakses state. Putus koneksi tidak otomatis menyerah; timer berjalan di server. Room tanpa aksi tiga jam dibersihkan.

## Penyimpanan akun dan konfigurasi server

Default lokal: `data/accounts.json` (diabaikan Git), dengan antrean transaksi dan penggantian file atomik. Akun, hash sesi, pertemanan, hasil seri, dan 50 pesan global terakhir bertahan setelah restart. Cadangkan file ini; jangan menyimpan file JSON pada disk sementara platform cloud. Jangan jalankan dua proses yang menulis file akun yang sama.

Untuk cloud tersedia adapter PostgreSQL melalui `DATABASE_URL`. Server membuat tabel `empire_state` saat start dan memproses perubahan dengan transaksi/row lock. Ini penyimpanan JSON terpusat untuk tahap alpha; room masih memerlukan **satu proses Node yang berjalan terus**, sehingga belum cocok langsung sebagai fungsi serverless/statik Vercel. Proyek ini belum dideploy. Adapter PostgreSQL sudah tersedia, tetapi belum diuji dengan database cloud nyata pada pekerjaan ini.

Salin `.env.example` ke `.env`, isi nilai sendiri, lalu gunakan Node untuk memuatnya:

```bash
node --env-file=.env server.mjs
```

| Variabel | Kegunaan |
| --- | --- |
| `PORT` | Port HTTP, default `3000`; platform hosting dapat memasoknya otomatis. |
| `HOST` | Default `0.0.0.0`; gunakan `127.0.0.1` untuk komputer sendiri. |
| `PUBLIC_ORIGIN` | Origin HTTPS publik persis, misalnya `https://game.example.com`, untuk pemeriksaan request dan cookie Secure. |
| `DATABASE_URL` | URL PostgreSQL penyedia database, termasuk opsi TLS yang disyaratkan penyedia. Prioritas di atas file lokal. |
| `ACCOUNT_DATA_FILE` | Alternatif database: lokasi file JSON di disk/volume **persisten**. |
| `NODE_ENV` | `production` mewajibkan `DATABASE_URL` atau `ACCOUNT_DATA_FILE` eksplisit agar tidak diam-diam memakai penyimpanan sementara. |

Autentikasi memakai scrypt dengan salt unik dan token acak 32 byte. Password tidak disimpan sebagai teks asli; token akun juga disimpan sebagai hash. Cookie akun `HttpOnly`, `SameSite=Lax`, berlaku 7 hari, dan `Secure` pada origin HTTPS. Login mengganti token sesi browser tersebut; logout menghapus sesi dan keluar dari duel aktif. Request perubahan diperiksa originnya, endpoint autentikasi dibatasi, dan state publik tidak memuat kredensial. Pembatas percobaan login saat ini berdasarkan alamat koneksi server; bila semua request datang dari satu reverse proxy, batas tersebut dibagi oleh pengguna proxy itu.

Referensi implementasi: [Node crypto/scrypt](https://nodejs.org/api/crypto.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [transaksi node-postgres](https://node-postgres.com/features/transactions).
