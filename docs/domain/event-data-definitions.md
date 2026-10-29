# Data Definitions: Fondasi — Pengguna, Venue, Event Organizer, Event

Model konseptual (information analysis ala *How to Design Programs*) untuk rantai fondasi sistem
VSS, mengikuti urutan dependency: Pengguna → Venue / Event Organizer → Event. Dokumen ini
melengkapi [`job-data-definitions.md`](./job-data-definitions.md) (aggregate Job, disusun lebih
awal sebagai *kontrak konsumen*) dan [`job-manifest-data-definitions.md`](./job-manifest-data-definitions.md).
Bukan schema database; mapping teknis dibuat terpisah.

## 1. Tujuan dan batas model

**Keputusan/proses yang harus didukung program:**

- Login dan identitas: siapa yang masuk, perannya apa, dan apakah akunnya aktif.
- Master data tempat dan penyelenggara: memilih venue/EO yang sudah ada atau mendaftarkan yang
  baru dalam satu form (E-3/E-4).
- Membuat dan mengelola event: nama resmi, alias, rentang tanggal, venue, EO, dan **PIC wajib**
  (keputusan 2026-10); dashboard menampilkan timeline event aktif kronologis (E-10).
- Mendeteksi perhatian: dua event yang jadwalnya beririsan, dan dua event bertabrakan di venue
  yang sama (Attention_Panel, Requirement 16.6).
- Menjawab kontrak dari dokumen Job: job hanya dibuat pada event aktif, dan PIC adalah pemilik
  kewenangan hapus.

**Sumber informasi:** `domain/event/types.ts` (generasi redesign + blok legacy "akan dihapus"),
`domain/auth/types.ts` (slice auth baru, Requirement 17), `domain/user/types.ts` (generasi demo),
`.kiro/requirements.md` §5.1–5.2, keputusan produk 2026-10 (PIC wajib, cancel dihapus, hard
delete oleh PIC).

**Tiga generasi tipe di kode (dicatat agar tidak tertukar):**

1. **Demo** — `domain/user/types.ts`: `User { nama, email, password, isAdmin }` (password
   plaintext); hanya fallback saat Supabase tak terkonfigurasi.
2. **Legacy** — blok "akan dihapus" di `domain/event/types.ts`: `Venue`/`EventOrganizer` kaya
   (npwp, contacts, website, address), `Event` dengan `picId` nullable dan `cancellation`.
3. **Redesign (target)** — `VenueRecord { legalName, aliasName, city }`,
   `EventOrganizerRecord { legalName }`, `EventInput` dengan `picId` wajib, dan slice auth
   `User` dengan `passwordHash` + `Role` yang ditegakkan server.

Dokumen ini mendefinisikan **target** (generasi 3 + keputusan produk); generasi 1–2 adalah
persoalan migrasi (bagian 6).

**In scope:** identitas pengguna dan peran, Venue, Event Organizer, Event, dan turunan
dashboard/perhatian. **Out of scope:** kontrak hashing password (sudah proper di
`domain/auth/types.ts` — diwariskan apa adanya), Exhibitor/Agent dan struktur Kontak (slice
berikutnya), Job (dokumen sendiri), mekanisme session/JWT (teknis).

## 2. Peta konsep dan dependency

```text
Atomic / Enumeration
  TanggalHari (doc manifest) · Email · UserId · WorkspaceId · NamaLegal
  Peran · StatusAkun
→ Structure dasar
  Pengguna → Venue → EventOrganizer
→ Itemization
  SiklusHidupEvent (resolusi 2026-10-29) · StatusTampilEvent (turunan) · StatusTuntasEvent (turunan)
→ Aggregate
  Event = structure(venue: Venue, eo: EventOrganizer, pic: Pengguna, rentang tanggal,
                    masukVenue/keluarVenue opsional, …)
```

Venue dan Event Organizer adalah saudara: keduanya bergantung hanya pada atomic, urutan di
antaranya bebas. Tidak ada self-reference. Event adalah konsumen ketiganya.

## 3. Data definition

### `Email`

**Definisi**

```text
Email adalah Text berformat alamat surel, disimpan ternormalisasi huruf kecil.
```

**Interpretasi** — identifier login pengguna. Normalisasi lower-case adalah bagian keanggotaan
(login `Admin@VSS.local` dan `admin@vss.local` adalah kredensial yang sama), sudah ditegakkan
oleh `ValidatedCredential` di slice auth.

**Contoh** — `admin@vss.local`. Invalid: `Admin@VSS.local` sebagai data tersimpan (belum
dinormalisasi).

### `UserId` dan `WorkspaceId`

**Definisi**

```text
UserId adalah Text identitas internal sistem untuk satu pengguna.
WorkspaceId adalah Text identitas internal sistem untuk satu workspace.
```

**Interpretasi** — identitas yang bertahan sepanjang hidup entitas, bukan referensi komunikasi.
Workspace adalah partisi data penyewa; realitas saat ini **satu workspace**, tetapi setiap
Pengguna membawa `workspaceId` dan seluruh query terikat padanya.

**Contoh** — UserId milik admin@vss.local; WorkspaceId tunggal milik VSS.

**Open question:** apakah multi-workspace pernah menjadi tujuan produk? (Faktanya latent bug
terkenal: hanya admin@vss.local yang punya baris workspace_members sehingga user lain gagal
login — ini pemetaan data, bukan desain model.)

### `Peran`

**Definisi**

```text
Peran adalah salah satu dari STAFF, SUPERVISOR, CUSTOMER_SERVICE, atau DOCUMENT_ASSISTANT.
```

**Interpretasi** — peran fungsional pengguna yang ditegakkan server (slice auth: "bukan sekadar
flag is_admin"). STAFF operasional penuh; SUPERVISOR ditambah manajemen user; CUSTOMER_SERVICE
lihat dan input terbatas; DOCUMENT_ASSISTANT fokus dokumen.

**Contoh** — keempat nilai.

**Open questions:** (a) makna operasional DOCUMENT_ASSISTANT belum memiliki UI pembatasan
(G-8); (b) tumpang tindih `isAdmin` dengan SUPERVISOR — dua sistem otorisasi hidup berdampingan
(`Role` dan flag `isAdmin`); model target sebaiknya memilih satu.

### `StatusAkun`

**Definisi**

```text
StatusAkun adalah salah satu dari AKTIF atau NONAKTIF.
```

**Interpretasi** — NONAKTIF berarti tidak dapat login dan tidak dapat ditunjuk sebagai PIC,
tetapi datanya tetap ada (bukan penghapusan). Kode memakai boolean `isActive`; enumerasi dipilih
agar keadaan tidak bisa disalahartikan dan siap bila nanti muncul keadaan ketiga
(mis. menunggu-aktivasi). **Proposal** — evidence kode hanya boolean.

**Contoh** — `AKTIF` (admin); `NONAKTIF` (kolega yang sudah keluar — data event buatannya tetap).

### `Pengguna`

**Definisi**

```text
Pengguna terdiri dari:
  id          : UserId
  email       : Email
  nama        : Text
  peran       : Peran
  status      : StatusAkun
  workspace   : WorkspaceId
```

**Interpretasi** — satu akun operasional. `passwordHash` sengaja **tidak** menjadi komponen:
hash adalah milik subsistem autentikasi (kontrak scrypt self-describing sudah didefinisikan dan
teruji di `domain/auth/types.ts`), sedangkan model ini adalah pengguna sebagai *data domain*
yang dirujuk event, job, dan ticket. `isAdmin` tidak dimodelkan — lihat open question Peran.

**Contoh** — admin VSS (SUPERVISOR, AKTIF); CS baru (CUSTOMER_SERVICE, AKTIF).
Invalid: Pengguna tanpa peran; Pengguna dengan dua workspace.

**Template pemrosesan**

```text
prosesPengguna(u):
  gunakan u.peran untuk cabang otorisasi
  u.status NONAKTIF → tolak login & tolak penunjukan PIC
```

### `NamaLegal`

**Definisi**

```text
NamaLegal adalah Text tidak kosong: nama resmi badan/tempat sesuai dokumen.
```

**Interpretasi** — identitas tertulis yang dipakai di dokumen; dibedakan dari nama populer
(alias). Dipakai Venue dan Event Organizer.

### `Venue`

**Definisi**

```text
Venue terdiri dari:
  id       : VenueId (identitas internal)
  namaLegal: NamaLegal
  alias    : Text, atau kosong
  kota     : Text, atau kosong
```

**Interpretasi** — tempat fisik penyelenggaraan pameran, master data yang dipakai ulang lintas
event. Alias menampung nama populer (contoh: namaLegal "PT Jakarta International Expo" alias
"JIExpo"). Kota dicatat karena operasional antar-kota (pengiriman), bukan untuk alamat surat.
Alamat lengkap, kontak, dan `loadingAccessNotes` sengaja **tidak** dimodelkan lagi pada
redesign — lihat open question.

**Contoh** — JIExpo Kemayoran (kota Jakarta); ICE BSD (kota Tangerang). Boundary: venue tanpa
alias dan tanpa kota (masukan minimal).

**Open question:** duplikasi master data — venue fisik sama dapat didaftarkan dua kali dengan
ejaan berbeda karena form mengizinkan "input baru" kapan saja. Butuh aturan pengenalan duplikat
atau sekadar konvensi. (Idem untuk EO.)

### `EventOrganizer`

**Definisi**

```text
EventOrganizer terdiri dari:
  id       : EventOrganizerId (identitas internal)
  namaLegal: NamaLegal
```

**Interpretasi** — penyelenggara pameran, master data lintas event. Redesign memangkas segala
pelengkap (npwp, kontak, alamat, website dari legacy): untuk operasional cargo, EO hanya perlu
diketahui namanya di dokumen dan dashboard.

**Contoh** — "Krista Exhibitions". Open question: apakah EO butuh alias/kota seperti Venue,
atau pemangkasan ini disengaja permanen? (Evidence redesign: hanya namaLegal.)

### `TanggalHari`

Sudah didefinisikan di [dokumen manifest](./job-manifest-data-definitions.md): tanggal kalender
`YYYY-MM-DD` tanpa komponen waktu dan tanpa zona — event pameran dijadwalkan per hari. Dirujuk,
tidak didefinisikan ulang.

### `SiklusHidupEvent` — **diresolusi 2026-10-29**

**Keputusan (diskusi domain expert 2026-10-29):** siklus hidup tersimpan murni **administratif**;
"tuntas" BUKAN keadaan tersimpan — ia turunan rollup dari job (lihat `StatusTuntasEvent`).
Dengan itu, kebingungan "arsip vs selesai" berhenti: **tuntas itu fakta (dihitung), arsip itu
keputusan (diambil)**.

**Definisi**

```text
SiklusHidupEvent adalah salah satu dari AKTIF atau DIARSIPKAN.
```

**Interpretasi** — AKTIF event yang masih hidup secara operasional (termasuk yang pamerannya
sudah lewat tapi pekerjaannya belum tuntas). DIARSIPKAN keputusan manual menutup buku: keluar
dari seluruh angka operasional (panel perlu tindakan, statistik, insight), tetap tampil di
daftar dengan badge, data/job/dokumen utuh. Idealnya arsip diambil SETELAH tuntas — ditegakkan
lunak lewat konfirmasi "masih ada N job belum tuntas", tidak diblokir keras. Penghapusan bukan
keadaan — ia menghilangkan entitas (hard delete oleh PIC). `CANCELLED` tetap ada di basis data
hanya sebagai data historis baca-saja (produsen UI-nya sudah dihapus, keputusan 2026-10); tidak
diproduksi lagi.

**Contoh** — event JIE Okt 2026: AKTIF selama job re-export-nya masih jalan; setelah semua job
tuntas, pengguna mengarsipkan → DIARSIPKAN. Boundary: mengarsipkan saat masih ada job belum
tuntas — diizinkan, dengan peringatan. Invalid: CANCELLED sebagai nilai baru (tidak ada
produsen).

**Jawaban open question lama:** (a) SELESAI tidak jadi keadaan tersimpan — digantikan
`StatusTuntasEvent` turunan; (b) pemicu arsip = manual, bukan otomatis dari status job; (c) nilai
`CANCELLED` lama dibiarkan sebagai historis baca-saja, tidak dikonversi.

### `StatusTampilEvent` (turunan — tidak disimpan)

**Definisi**

```text
StatusTampilEvent adalah salah satu dari SEGERA, BERLANGSUNG, atau LEWAT.
```

**Interpretasi** — posisi event terhadap hari ini, **dihitung** dari rentang tanggal, bukan
disimpan: SEGERA jika hari ini < tanggal mulai; BERLANGSUNG jika tanggal mulai ≤ hari ini ≤
tanggal selesai; LEWAT jika hari ini > tanggal selesai (inklusif di kedua batas — proposal).
Terpisah dari SiklusHidupEvent: event SEGERA dan LEWAT sama-sama bisa AKTIF. **Penegasan
2026-10-29:** LEWAT berarti *pamerannya* sudah lewat — bukan *pekerjaannya* selesai. Kelengkapan
pekerjaan adalah `StatusTuntasEvent`; kedua sumbu ini tidak boleh menyatu kembali.

**Contoh** — hari ini 21 Okt: event 23–26 Okt = SEGERA; 20–23 Okt = BERLANGSUNG; 15–18 Okt =
LEWAT. Boundary: tepat pada tanggal mulai = BERLANGSUNG; tepat pada tanggal selesai =
BERLANGSUNG.

### `masukVenue` dan `keluarVenue` (penanda logistik — proposal 2026-10-29)

**Definisi**

```text
masukVenue   : TanggalHari, atau kosong
keluarVenue  : TanggalHari, atau kosong
```

**Interpretasi** — tanggal **fakta fisik** pergerakan barang di venue (move in / move out):
barang dating ke venue untuk pemasangan, dan barang meninggalkan venue setelah pembongkaran.
Keduanya *tanggal*, bukan keadaan — sejajar `mulai`/`selesai`, terjadi di luarnya: move-in
tipikal sebelum/saat `mulai`, move-out tipikal setelah/saat `selesai` (tipikal, bukan
invariant). Dua pagar istilah: (1) ini pergerakan **di venue**, bukan pergerakan kepabeanan —
masuk/keluar BC (2.3 masuk, 2.5/3.0 keluar) tetap milik `DokumenBC` per job, dan barang bisa
keluar venue sambil masih menunggu re-export; (2) ini **jadwal agregat di level event** —
eksekusi per pengiriman (truk, gudang) tetap milik level job (ETA inward dan `KepulanganJob`).
Tanpa salah satu tanggal, field kosong — banyak event belum punya jadwal ini.

**Contoh** — event 20–23 Okt di JIExpo: masukVenue 18 Okt (borongan masuk dua hari sebelum
buka), keluarVenue 24 Okt. Boundary: event satu hari dengan masukVenue = keluarVenue = hari
yang sama. Invalid: keluarVenue < masukVenue (I-7).

### `StatusTuntasEvent` (turunan — tidak disimpan)

**Definisi**

```text
StatusTuntasEvent adalah salah satu dari TUNTAS, BELUM_TUNTAS, atau TANPA_JOB.
```

**Interpretasi** — kelengkapan **pekerjaan** (bukan pameran), dihitung dari seluruh job event
itu: TANPA_JOB bila tidak ada satu pun job — *dimulai saja belum*, bukan pekerjaan menggantung,
dan kebutuhan "event dekat belum digarap" sudah dilayani sinyal pipeline terpisah (≤30 hari
tanpa job); BELUM_TUNTAS bila ada job yang belum `jobTuntas`; TUNTAS bila semua job `jobTuntas`.
Menggantikan makna "selesai" yang keliru dilekatkan ke `ends_on`, dan menjadi prasyarat lunak
bagi arsip (perbedaan tuntas/arsip lihat `SiklusHidupEvent`).

**Contoh** — event dengan 3 job, satu masih menunggu BC 2.5 terdaftar = BELUM_TUNTAS; Coaltrans
Asia tanpa job = TANPA_JOB (bukan tuduhan menggantung); event 2 job semuanya tuntas = TUNTAS.

### `Event`

**Definisi**

```text
Event terdiri dari:
  id          : EventId (identitas internal)
  namaResmi   : Text tidak kosong
  alias       : Text, atau kosong
  venue       : VenueId   — tepat satu
  organizer   : EventOrganizerId — tepat satu
  pic         : UserId    — tepat satu (WAJIB)
  mulai       : TanggalHari
  selesai     : TanggalHari
  masukVenue  : TanggalHari, atau kosong   (proposal 2026-10-29)
  keluarVenue : TanggalHari, atau kosong   (proposal 2026-10-29)
  siklusHidup : SiklusHidupEvent
  dibuatOleh  : UserId
```

**Interpretasi** — satu pameran yang ditangani VSS, konteks wajib pertama bagi seluruh pekerjaan
(exhibitor, agent, job, ticket menggantung padanya). Venue dan EO tepat satu karena setiap
pameran berlangsung di satu tempat dan diselenggarakan satu pihak; PIC tepat satu sejak
pembuatan (keputusan 2026-10, menggantikan legacy `picId` nullable) karena event tanpa
penanggung jawab tidak punya pemilik kewenangan hapus. Alias menampung nama panggilan dashboard.
`dibuatOleh` adalah jejak audit pembuatan, berbeda peran dari PIC.

**Contoh**

1. Lengkap — "JIExpo Kemayoran" (alias "JIE"), venue JIExpo, EO Krista Exhibitions, PIC admin,
   20–23 Okt 2026, AKTIF.
2. Boundary — event satu hari (mulai = selesai), tanpa alias.
3. LEWAT namun AKTIF — event 15–18 Okt dengan job re-export masih jalan.

Invalid (tidak dapat dibentuk):

- Event tanpa PIC → tidak ada field kosong untuk pic.
- Event selesai < mulai → dilanggar oleh invariant I-1, bukan oleh bentuk.
- Event dengan dua venue → venue tepat satu.
- Event yang dibatalkan dengan alasan → fitur tidak ada; keadaan itu kini hanya bisa
  "dihapus".

**Template pemrosesan**

```text
prosesEvent(e, hariIni):
  gunakan e.venue / e.organizer → delegasi ke template masing-masing
  gunakan e.pic → cek StatusAkun untuk kewenangan
  statusTampil(e, hariIni) → cabang SEGERA / BERLANGSUNG / LEWAT
  gunakan e.siklusHidup untuk penyaringan daftar dan gerbang pembuatan job
```

## 4. Invariant lintas konsep

- **I-1:** `mulai ≤ selesai` (E-2).
- **I-2:** venue, organizer, dan pic yang dirujuk harus ada dan berkumpul dalam satu workspace
  yang sama dengan event.
- **I-3:** pic harus berstatus AKTIF saat ditunjuk (**proposal**).
- **I-4:** penghapusan event hanya oleh PIC-nya sendiri (atau admin) — dari kontrak dokumen Job
  (I-5) dan keputusan hard delete; event dengan data turunan (exhibitor, job) tidak dapat
  dihapus (B-1).
- **I-5:** hanya event AKTIF yang dapat menerima job dan ticket baru (dari dokumen Job I-1 dan
  B-3).
- **I-6:** seluruh definisi di atas terikat satu WorkspaceId; lintas workspace tidak
  direpresentasikan.
- **I-7 (proposal 2026-10-29):** bila `masukVenue` dan `keluarVenue` keduanya terisi,
  `masukVenue ≤ keluarVenue`. Urutannya terhadap `mulai`/`selesai` hanya tipikal (move-in
  umumnya ≤ `mulai`, move-out umumnya ≥ `selesai`), bukan invariant — ada pemasangan saat
  pameran berjalan dan pembongkaran bertahap.

## 5. Fungsi turunan (signature, tanpa implementasi)

```text
statusTampil : Event × TanggalHari -> StatusTampilEvent
  // purpose: posisi kalender untuk label dan urutan timeline (inklusif; lihat contoh boundary).

beririsan : Event × Event -> Bool
  // purpose: jadwal dua event beririsan. Interval tertutup: a.mulai ≤ b.selesai ∧ b.mulai ≤ a.selesai.

konflikVenue : Event × Event -> Bool
  // purpose: beririsan DAN venue sama — tabrakan fisik di gedung.

deteksiPerhatian : Daftar Event × TanggalHari -> Perhatian
  // purpose: pasangan beririsan + pasangan konflikVenue untuk Attention_Panel (Req 16.6);
  // pasangan unik, tanpa self-pair.

ringkasDashboard : Daftar Event × TanggalHari -> Ringkasan
  // purpose: total event, event berlangsung, total exhibitor, total item CIPL (Req 16.1);
  // dua komponen terakhir didelegasikan ke slice Exhibitor/CIPL.

bolehHapus : Pengguna × Event × jumlahTurunan -> Bool
  // purpose: menegakkan I-4 + B-1 sebelum hard delete.

jobTuntas : Job -> Bool
  // purpose (keputusan 2026-10-29): job dikatakan tuntas bila (1) setiap DokumenBC yang
  // berlaku bagi jenis job itu sudah terdaftar — punya nomorRegistrasi (bukan hanya nomorAju),
  // dan (2) kepulangan (KepulanganJob, doc manifest) sudah terisi ATAU jenis job tidak
  // mengharuskan barang kembali (JobLocal, PERMANENT_IMPORT). Pemetaan per jenis job mana yang
  // wajib kepulangan (TEMPORARY, ATA_CARNET, ROAD_SHIPMENT) dirinci di dokumen Job.

eventTuntas : Event × Daftar Job -> StatusTuntasEvent
  // purpose: TANPA_JOB bila daftar job kosong; BELUM_TUNTAS bila ada job dengan jobTuntas
  // false; TUNTAS bila semua jobTuntas true. Sumbu kelengkapan pekerjaan — terpisah dari
  // StatusTampilEvent (kalender pameran).

peringatanArsip : Event × Daftar Job -> Text, atau kosong
  // purpose: soft-guard arsip (lihat SiklusHidupEvent) — bila siklusHidup AKTIF dan
  // eventTuntas ≠ TUNTAS, kembalikan peringatan "masih ada N job belum tuntas"; kosong bila
  // aman diarsipkan tanpa catatan. Tidak memblokir.
```

## 6. Validasi contoh dan migrasi

| Skenario | Definisi terkait | Dapat direpresentasikan? | Branch/template | Catatan |
|---|---|---:|---|---|
| Venue baru minimal (tanpa alias/kota) | Venue | ya | structure | boundary masukan |
| Venue dengan alias populer | Venue | ya | structure | JIExpo |
| Event satu hari | Event | ya | structure, I-1 boundary | mulai = selesai |
| Event lewat tapi masih AKTIF | Event × SiklusHidup | ya | StatusTampil = LEWAT | pembedaan vs siklus hidup |
| Event tanpa move-in/out | Event | ya | kedua field kosong | mayoritas event saat ini |
| Move-out sebelum move-in | — | **tidak** (I-7) | — | validasi, bukan bentuk |
| Event pameran lewat, semua job tuntas | StatusTuntasEvent | ya | TUNTAS + LEWAT | dua sumbu bebas berpadu |
| Event tanpa job dipandang "belum tuntas" | StatusTuntasEvent | **tidak** | TANPA_JOB | keputusan 2026-10-29 |
| Event tanpa PIC | — | **tidak** | — | mustahil by construction |
| Dua event sama venue, tanggal menyentuh di satu hari | konflikVenue | ya (terdeteksi) | interval boundary | open question batas |
| Akun nonaktif ditunjuk PIC | — | **tidak** (I-3) | — | validasi, bukan bentuk |
| Event CANCELLED (data lama) | SiklusHidupEvent | **tidak** pada model target | — | migrasi |

**Migrasi (di luar model):** (1) event legacy tanpa PIC perlu backfill PIC atau dibiarkan bebas
dihapus sesuai keputusan lama; (2) nilai `CANCELLED` lama harus diputuskan nasibnya; (3) user
demo (generasi 1) dan venue/EO legacy (generasi 2) dibuang saat konsumennya pindah; (4) user
tanpa baris workspace_members tidak bisa login — pemetaan data, bukan model.

## 7. Open questions (ringkasan untuk domain expert)

1. **SiklusHidupEvent** — **RESOLVED 2026-10-29**: siklus tersimpan = AKTIF | DIARSIPKAN
   (administratif, manual); "tuntas" menjadi `StatusTuntasEvent` turunan dari job, bukan keadaan
   tersimpan; `CANCELLED` lama dibiarkan historis baca-saja. Detail di §3.
2. **Otorisasi satu model:** `Peran` saja, atau tetap ada `isAdmin` terpisah? Hubungan
   SUPERVISOR vs admin?
3. **Pemangkasan Venue/EO permanen?** Venue tanpa alamat lengkap/kontak/loadingAccessNotes dan EO
   hanya namaLegal — cukup untuk operasional, atau akan kembali? Jika kembali, struktur Kontak
   sebaiknya didefinisikan sekali dan dipakai bersama Exhibitor/Agent (slice berikutnya).
4. **Duplikasi master data:** aturan mengenali venue/EO yang sama saat "input baru" (E-3/E-4).
5. **Batas konflik venue:** dua event yang rentangnya menyentuh di satu hari yang sama — konflik
   atau normal (turnover build-up/teardown)? *Diperkaya 2026-10-29: kini ada kandidat jawaban
   yang lebih jujur — deteksi konflik bisa memakai jendela okupansi `masukVenue..keluarVenue`
   (bila terisi) alih-alih `mulai..selesai`, karena turnover-lah yang bentrok fisik. Belum
   diputuskan.*
6. **Inklusivitas StatusTampil** di kedua batas — proposal; konfirmasi.
7. **Multi-workspace:** tujuan produk atau sisa generik yang boleh dibuang?
8. **Sumber & pengisi move-in/out (baru 2026-10-29):** tanggal ini datang dari jadwal resmi
   venue/EO atau rencana VSS sendiri? Siapa berwenang mengisinya (PIC event?), dan seberapa
   sering direvisi? Menentukan bentuk UI (field edit event vs catatan terpisah).
9. **Rincian wajib-kepulangan per jenis job (baru 2026-10-29):** konsep `jobTuntas` dirinci di
   sini, tetapi tabel jenis mana yang mewajibkan kepulangan dimiliki dokumen Job — konfirmasi
   di sana.
