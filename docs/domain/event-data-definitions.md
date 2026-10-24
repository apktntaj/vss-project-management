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
  SiklusHidupEvent (dipertikaikan — lihat open questions) · StatusTampilEvent (turunan)
→ Aggregate
  Event = structure(venue: Venue, eo: EventOrganizer, pic: Pengguna, rentang tanggal, …)
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

### `SiklusHidupEvent` — **dipertikaikan**

**Definisi (apa adanya di kode redesign):**

```text
SiklusHidupEvent adalah salah satu dari ACTIVE, CANCELLED, atau ARCHIVED.
```

**Konflik evidence (ditampilkan, tidak dipilih diam-diam):** tipe masih memuat `CANCELLED`, tetapi
fitur cancel **sudah dihapus dari produk** (keputusan 2026-10: tidak ada pembatalan; event
dihapus hard oleh PIC). `ARCHIVED` tidak punya produsen di kode manapun. Sementara itu filter
daftar event bermacam "Aktif" menyiratkan minimal satu keadaan non-aktif yang disimpan.

**Definisi (proposal target):**

```text
SiklusHidupEvent adalah salah satu dari AKTIF atau SELESAI.
```

dengan interpretasi: AKTIF event yang ditangani (masa datang, berjalan, atau baru lewat dan
masih diproses job-nya); SELESAI event yang tidak lagi ditangani namun tetap disimpan sebagai
riwayat. Penghapusan event bukan keadaan — ia menghilangkan entitas (hard delete oleh PIC).

**Contoh** — event JIE Okt 2026: AKTIF selama job re-export-nya masih jalan, SELESAI setelah
semua kepulangan tuntas. Invalid: CANCELLED (fitur sudah tidak ada).

**Open question (keputusan domain yang diminta):** (a) apakah SELESAI dibutuhkan sekarang, atau
event tetap "selamanya aktif" sampai dipindah arsip? (b) jika arsip dibutuhkan, apa pemicunya —
manual, atau otomatis ketika semua job-nya COMPLETED? (c) migrasi nilai CANCELLED lama: hard
delete atau dikonversi SELESAI?

### `StatusTampilEvent` (turunan — tidak disimpan)

**Definisi**

```text
StatusTampilEvent adalah salah satu dari SEGERA, BERLANGSUNG, atau LEWAT.
```

**Interpretasi** — posisi event terhadap hari ini, **dihitung** dari rentang tanggal, bukan
disimpan: SEGERA jika hari ini < tanggal mulai; BERLANGSUNG jika tanggal mulai ≤ hari ini ≤
tanggal selesai; LEWAT jika hari ini > tanggal selesai (inklusif di kedua batas — proposal).
Terpisah dari SiklusHidupEvent: event SEGERA dan LEWAT sama-sama bisa AKTIF.

**Contoh** — hari ini 21 Okt: event 23–26 Okt = SEGERA; 20–23 Okt = BERLANGSUNG; 15–18 Okt =
LEWAT. Boundary: tepat pada tanggal mulai = BERLANGSUNG; tepat pada tanggal selesai =
BERLANGSUNG.

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
```

## 6. Validasi contoh dan migrasi

| Skenario | Definisi terkait | Dapat direpresentasikan? | Branch/template | Catatan |
|---|---|---:|---|---|
| Venue baru minimal (tanpa alias/kota) | Venue | ya | structure | boundary masukan |
| Venue dengan alias populer | Venue | ya | structure | JIExpo |
| Event satu hari | Event | ya | structure, I-1 boundary | mulai = selesai |
| Event lewat tapi masih AKTIF | Event × SiklusHidup | ya | StatusTampil = LEWAT | pembedaan vs siklus hidup |
| Event tanpa PIC | — | **tidak** | — | mustahil by construction |
| Dua event sama venue, tanggal menyentuh di satu hari | konflikVenue | ya (terdeteksi) | interval boundary | open question batas |
| Akun nonaktif ditunjuk PIC | — | **tidak** (I-3) | — | validasi, bukan bentuk |
| Event CANCELLED (data lama) | SiklusHidupEvent | **tidak** pada model target | — | migrasi |

**Migrasi (di luar model):** (1) event legacy tanpa PIC perlu backfill PIC atau dibiarkan bebas
dihapus sesuai keputusan lama; (2) nilai `CANCELLED` lama harus diputuskan nasibnya; (3) user
demo (generasi 1) dan venue/EO legacy (generasi 2) dibuang saat konsumennya pindah; (4) user
tanpa baris workspace_members tidak bisa login — pemetaan data, bukan model.

## 7. Open questions (ringkasan untuk domain expert)

1. **SiklusHidupEvent:** butuh SELESAI/ARSIP sekarang atau nanti? Pemicu arsip apa? Nasib
   CANCELLED lama? *(konflik evidence terbesar slice ini)*
2. **Otorisasi satu model:** `Peran` saja, atau tetap ada `isAdmin` terpisah? Hubungan
   SUPERVISOR vs admin?
3. **Pemangkasan Venue/EO permanen?** Venue tanpa alamat lengkap/kontak/loadingAccessNotes dan EO
   hanya namaLegal — cukup untuk operasional, atau akan kembali? Jika kembali, struktur Kontak
   sebaiknya didefinisikan sekali dan dipakai bersama Exhibitor/Agent (slice berikutnya).
4. **Duplikasi master data:** aturan mengenali venue/EO yang sama saat "input baru" (E-3/E-4).
5. **Batas konflik venue:** dua event yang rentangnya menyentuh di satu hari yang sama — konflik
   atau normal (turnover build-up/teardown)?
6. **Inklusivitas StatusTampil** di kedua batas — proposal; konfirmasi.
7. **Multi-workspace:** tujuan produk atau sisa generik yang boleh dibuang?
