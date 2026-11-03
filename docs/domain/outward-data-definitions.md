# Data Definitions: Outward Manifest — Barang Keluar Bonded

Model konseptual (information analysis ala *How to Design Programs*) untuk **pandangan outward**:
barang yang **keluar dari bonded** setelah pameran, dipartisi menurut `DisposisiBarang` tiap item
CIPL. Dokumen ini **melanjutkan dan menggeneralisasi** — BUKAN menggantikan — konsep yang sudah
ada: `KepulanganJob`/`ModusKepulangan` ([`job-manifest-data-definitions.md`](./job-manifest-data-definitions.md)),
`DisposisiBarang`/`BarisBarang` ([`cipl-data-definitions.md`](./cipl-data-definitions.md)), dan
`DokumenBC` ([`job-data-definitions.md`](./job-data-definitions.md)). Berdasar pematangan dengan
klien **Arsya** (2026-11-03, `docs/domain/sources/arsya-discussions.md`, B1–B3). Bukan schema
database; mapping teknis ada di bagian 7.

## 1. Tujuan dan batas model

**Keputusan/proses yang harus didukung program:**

- Menampilkan **barang keluar bonded** sebagai satu pandangan per job, dipartisi menurut
  `DisposisiBarang` masing-masing baris barang CIPL (B2).
- Membedakan **porsi yang diproses VSS** (RE_EXPORT → `DokumenBC BC_2_5` + `KepulanganJob`) dari
  porsi yang **hanya informasional** (DISPOSED & GIVE_AWAY → VSS **tidak** mengurus penyelesaian
  pabean, tidak menagih — B2, terkunci).
- Menandai titik waktu "barang di pelabuhan muat ekspor" dengan **milestone baru** `MUAT_EKSPOR`,
  **per job, bertanggal** (dari tanggal dokumen) — B1, terkunci; milestone ini juga pemicu terbitan
  tagihan **OUTWARD** ([`tagihan-data-definitions.md`](./tagihan-data-definitions.md)).

**Sumber informasi:** `docs/domain/sources/arsya-discussions.md` (B1–B3, putaran 2),
`domain/job/manifest.ts` (`milestoneKinds`, `JobReturn`/`ReturnMode`, `destination`/`vessel`/`etd`),
`domain/exhibition/*`/`cipl-data-definitions.md` (`DisposisiBarang`, `BarisBarang`),
`domain/job/types.ts` (`DokumenBC`/`BC_2_5`). Contoh: **CIPL S.12/ALP-VPN/2026** (item 1–31,33
bertanda A = RE-EXPORT; CATALOG item 32 dan CATALOGUE "in package No. 22" bertanda B = DISPOSED).

**In scope:** milestone `MUAT_EKSPOR`, pandangan outward sebagai partisi `DisposisiBarang`, tautan
porsi RE_EXPORT ke `KepulanganJob` + `BC_2_5`.
**Out of scope (dulu):** penyelesaian pabean DISPOSED/GIVE_AWAY (B2: VSS tak proses — rezim pasti
**requires authority confirmation**), tujuan per-exhibitor (B3: DITUTUP — tujuan tetap per-job),
penagihan (→ doc tagihan), penomoran BC 2.5 (mengikuti `DokumenBC`).

**Istilah ambigu:** "outward" bukan entitas penyimpanan baru yang menggandakan `KepulanganJob`;
ia **generalisasi/pandangan** di atas data yang sudah ada (lihat §3 `PandanganOutward`).

## 2. Peta konsep dan dependency

```text
Atomic / Enumeration
  JenisMilestone (+ MUAT_EKSPOR, nilai BARU) · DisposisiBarang (dirujuk) · CaraKeluarLokal
→ Itemization
  OutwardItem = ItemReEkspor | ItemKeluarTanpaEkspor
→ Structure / view
  PorsiReEkspor · PandanganOutward (pandangan turunan per job)

Dirujuk (TIDAK didefinisikan ulang):
  Milestone                         — doc manifest
  DisposisiBarang / BarisBarang     — doc CIPL
  KepulanganJob / ModusKepulangan   — doc manifest (tujuan, mode, vessel, etd/eta)
  DokumenBC (BC_2_5)                — doc job
```

Tidak ada self-reference. `PandanganOutward` adalah **turunan** dari `CiplDocument` +
`KepulanganJob` + `DokumenBC` + `Milestone` job yang sama — bukan tempat penyimpanan paralel.

## 3. Data definition

### `JenisMilestone` — tambahan `MUAT_EKSPOR`

**Definisi**

```text
JenisMilestone diperluas: ETA, SKEP, SPPB, STRIPPING_SELESAI, MASUK_BONDED, BAHANDLE_SELESAI,
PERIKSA_SELESAI, DO_READY, dan (BARU) MUAT_EKSPOR.
Milestone (tidak berubah) terdiri dari jenis (JenisMilestone), tanggal (TanggalOnly),
dan nomorSurat (Text atau kosong).
```

**Interpretasi** — `MUAT_EKSPOR` menandai "barang sudah di pelabuhan muat ekspor". Sesuai B1
(terkunci): penanda ini **per job** dan ditandai **tanggal dokumen** (bukan per kontainer, bukan
per exhibitor). Sebagai `Milestone` biasa, ia mewarisi invariant milestone yang ada: satu jenis
muncul **paling banyak sekali** per job. `MUAT_EKSPOR` adalah **satu-satunya tambahan** pada
`milestoneKinds`; tidak ada milestone tambahan lain di dokumen ini. Inilah penanda yang sekaligus:
(a) membuka terbitan tagihan OUTWARD (running cost berhenti), dan (b) mengaktifkan pandangan
outward. Satu gap, satu keputusan — sengaja dipakai bersama doc tagihan.

**Contoh** — `Milestone(MUAT_EKSPOR, "2026-11-10", kosong)`. Invalid: dua `MUAT_EKSPOR` pada satu
job (langgar invariant milestone); `MUAT_EKSPOR` per-kontainer (B1 menolak granularitas itu).

### `CaraKeluarLokal`

**Definisi**

```text
CaraKeluarLokal adalah salah satu dari DISPOSED atau GIVE_AWAY.
```

**Interpretasi** — sub-himpunan `DisposisiBarang` untuk barang yang **keluar bonded tanpa
ekspor**: `DISPOSED` (dibuang/dikonsumsi — legenda CIPL "B: DISPOSED OR CONSUMED") dan `GIVE_AWAY`
(dibagikan/terjual — "C: GIVE AWAY/SOLD"). Dipakai sebagai payload cabang
`ItemKeluarTanpaEkspor`. `RE_EXPORT` dan `TIDAK_DISEBUT` **tidak** termasuk — RE_EXPORT punya
cabangnya sendiri; `TIDAK_DISEBUT` belum terklasifikasi (lihat §4 I-5).

**Contoh** — `DISPOSED` (CATALOG item 32 S.12); `GIVE_AWAY` (tercantum di legenda, tak teramati
bertanda pada S.12). Invalid: `RE_EXPORT` sebagai `CaraKeluarLokal`.

### `OutwardItem` (itemization)

**Definisi**

```text
OutwardItem adalah salah satu dari:

ItemReEkspor
  barang : ref BarisBarang          // disposisi = RE_EXPORT; diproses VSS

ItemKeluarTanpaEkspor
  barang : ref BarisBarang          // disposisi = DISPOSED atau GIVE_AWAY; informasional
  cara   : CaraKeluarLokal
```

**Interpretasi** — satu baris barang CIPL dipandang dari sisi keluar-bonded. `ItemReEkspor`
(disposisi `RE_EXPORT`): barang kembali ke luar negeri, **diproses VSS** → menempel pada
`PorsiReEkspor` (tujuan/vessel/BC). `ItemKeluarTanpaEkspor` (disposisi `DISPOSED`/`GIVE_AWAY`):
barang keluar bonded **tanpa tujuan ekspor**; **informasional saja** — VSS tidak mengurus
penyelesaian pabeannya dan tidak menagih (B2). Itemization dipilih (bukan satu structure dengan
field tujuan nullable) tepat agar **keadaan mustahil tak dapat dibentuk**: cabang
`ItemKeluarTanpaEkspor` **tidak punya** field tujuan/vessel/BC — jadi "barang DISPOSED dengan
tujuan ekspor Shanghai" mustahil ditulis.

**Contoh** — `ItemReEkspor(ref item 1 "FIBER LASER MARKING MACHINE", RE_EXPORT)`;
`ItemKeluarTanpaEkspor(ref item 32 "CATALOG", DISPOSED)`.

**Template pemrosesan**

```text
prosesOutwardItem(oi):
  ItemReEkspor          → ikut PorsiReEkspor job (KepulanganJob + BC_2_5); diproses & relevan tagihan
  ItemKeluarTanpaEkspor → catat informasional; JANGAN proses pabean, JANGAN tagih (B2)
```

### `PorsiReEkspor`

**Definisi**

```text
PorsiReEkspor terdiri dari:
  items      : List<ItemReEkspor>           // semua baris barang berdisposisi RE_EXPORT
  kepulangan : KepulanganJob, atau kosong   // tujuan/mode/vessel/etd/eta — PER JOB
  dokumenBc  : ref DokumenBC (BC_2_5), atau kosong
```

**Interpretasi** — porsi yang **diproses VSS**. `kepulangan` adalah `KepulanganJob` yang **sudah
ada** (di-reuse, bukan disalin): `ModusKepulangan` (FCL kontainer | LCL jumlah koli), `tujuan`,
`shippingLine`, `bookingNumber`, `vessel`, `etd`, `eta`. Sesuai B3 (terkunci), `tujuan`
tetap **per-job** — tidak turun ke level item/exhibitor. `dokumenBc` menunjuk `DokumenBC` berjenis
`BC_2_5` (re-ekspor) milik job; boleh kosong (draft sebelum diajukan — `DokumenBC` mengizinkan
nomor AJU/registrasi kosong). `kepulangan`/`dokumenBc` boleh kosong karena tujuan & dokumen bisa
diketahui belakangan (B: "waktu diketahuinya negara tujuan tidak pasti" — `KepulanganJob.tujuan`
memang sudah opsional; jangan jadikan invariant awal).

**Contoh** — S.12: `items` = baris 1–31,33; `kepulangan = KepulanganJob(mode FCL[OOCU8067803...],
tujuan Shanghai, vessel ..., etd/eta)`; `dokumenBc = BC_2_5 (nomor AJU terisi)`.

### `PandanganOutward` (pandangan turunan per job)

**Definisi**

```text
PandanganOutward (TURUNAN, bukan storage baru) terdiri dari:
  milestoneMuatEkspor : Milestone (MUAT_EKSPOR), atau kosong   // precondition
  reEkspor            : PorsiReEkspor
  keluarTanpaEkspor   : List<ItemKeluarTanpaEkspor>            // informasional (B2)
  belumTerklasifikasi : List<BarisBarang>                      // disposisi TIDAK_DISEBUT
```

**Interpretasi** — rakitan pandangan outward satu job, **diturunkan** dari `CiplDocument` (membaca
`DisposisiBarang` tiap `BarisBarang`), `KepulanganJob`, `DokumenBC`, dan `Milestone` job yang sama.
Ini **generalisasi di atas** `DisposisiBarang` + `KepulanganJob`, **bukan pengganti**: data nyata
tetap tinggal di CIPL/manifest/BC; pandangan ini hanya mempartisi dan menautkan. `belumTerklasifikasi`
menampung baris `TIDAK_DISEBUT` yang belum bisa dimasukkan ke cabang mana pun — bahan peringatan
close-out, bukan error.

**Contoh (boundary):** job belum muat ekspor → `milestoneMuatEkspor = kosong`, `reEkspor.items`
sudah bisa dihitung dari CIPL tetapi `kepulangan` mungkin kosong. S.12 terisi penuh →
`reEkspor` = 32 baris RE_EXPORT, `keluarTanpaEkspor` = item 32 + CATALOGUE (DISPOSED),
`belumTerklasifikasi` = baris apa pun tanpa tanda A/B/C.

Invalid (tidak dapat dibentuk — tujuannya):

- `ItemKeluarTanpaEkspor` dengan `tujuan`/`vessel`/`BC_2_5` → cabang itu tak punya field tersebut.
- Barang `DISPOSED` masuk `reEkspor.items` → `items : List<ItemReEkspor>`, hanya RE_EXPORT.
- `tujuan` berbeda per exhibitor dalam satu job → `tujuan` milik `KepulanganJob` per-job (B3).

## 4. Invariant lintas konsep

- **I-1 (partisi disposisi):** tiap `BarisBarang` CIPL job dipetakan ke **tepat satu** tempat:
  `reEkspor.items` (RE_EXPORT), `keluarTanpaEkspor` (DISPOSED|GIVE_AWAY), atau
  `belumTerklasifikasi` (TIDAK_DISEBUT). Tidak dobel, tidak mewarisi dari baris sekitar
  (konsisten dengan invariant disposisi CIPL).
- **I-2 (impossible state):** `ItemKeluarTanpaEkspor` tidak membawa tujuan/vessel/ETD/ETA/BC —
  barang keluar-tanpa-ekspor tak bisa punya rute ekspor.
- **I-3 (reuse, bukan ganti):** `reEkspor.kepulangan` **adalah** `KepulanganJob` job (di-reuse);
  outward tidak membuat tujuan/mode kedua. `tujuan` per-job (B3).
- **I-4 (VSS proses hanya RE_EXPORT):** hanya `reEkspor` yang memicu `DokumenBC BC_2_5` dan masuk
  lingkup proses VSS; `keluarTanpaEkspor` informasional — VSS tidak proses pabean, tidak tagih (B2).
- **I-5 (TIDAK_DISEBUT = peringatan):** `belumTerklasifikasi` tidak kosong = peringatan close-out
  (barang perlu ditetapkan disposisinya sebelum tuntas), BUKAN blokir simpan.
- **I-6 (precondition = pemicu tagihan):** `milestoneMuatEkspor` adalah `Milestone(MUAT_EKSPOR)`
  yang sama yang membuka `TerbitanOutward` pada tagihan — satu penanda, dua akibat.
- **I-7 (per job, bertanggal):** `MUAT_EKSPOR` per-job dan ber-`tanggal` (B1); bukan per
  kontainer/exhibitor.

## 5. Fungsi turunan (signature, tanpa implementasi)

```text
partisiOutward : CiplDocument -> {
  reEkspor            : List<ItemReEkspor>,
  keluarTanpaEkspor   : List<ItemKeluarTanpaEkspor>,
  belumTerklasifikasi : List<BarisBarang>
}
  // purpose: kelompokkan BarisBarang menurut DisposisiBarang (I-1).

pandanganOutward : (Job, CiplDocument) -> PandanganOutward
  // purpose: rakit pandangan — partisi + tautkan KepulanganJob/BC_2_5 + ambil Milestone MUAT_EKSPOR.

sudahMuatEkspor : Job -> Bool
  // purpose: ada Milestone MUAT_EKSPOR (precondition; = bolehTerbitOutward di doc tagihan).

peringatanCloseOut : PandanganOutward -> List<Peringatan>
  // purpose: I-5 — barang TIDAK_DISEBUT belum berdisposisi; kepulangan kosong saat sudah muat.
```

## 6. Validasi contoh

| Skenario (S.12 / manifest) | Definition terkait | Dapat direpresentasikan? | Branch/template | Catatan |
|---|---|---|---|---|
| Item 1–31,33 bertanda A (RE-EXPORT) | `ItemReEkspor` + `PorsiReEkspor` | ✅ | cabang RE_EXPORT | tautan `KepulanganJob` + `BC_2_5` |
| CATALOG item 32 bertanda B (DISPOSED) | `ItemKeluarTanpaEkspor(DISPOSED)` | ✅ | cabang keluar-tanpa-ekspor | informasional, tak ditagih (B2) |
| CATALOGUE "in package No. 22" bertanda B | `ItemKeluarTanpaEkspor(DISPOSED)` | ✅ | — | VSS tak proses pabean |
| GIVE_AWAY (legenda C, tak teramati) | `CaraKeluarLokal = GIVE_AWAY` | ✅ | cabang keluar-tanpa-ekspor | nilai tetap disediakan |
| DISPOSED dengan tujuan ekspor Shanghai | — | ❌ (ditolak) | I-2 | cabang tak punya field tujuan |
| Baris tanpa tanda A/B/C | `belumTerklasifikasi` | ✅ (peringatan) | I-5 | perlu disposisi sebelum tuntas |
| `MUAT_EKSPOR` per job, tanggal dokumen | `Milestone(MUAT_EKSPOR)` | ✅ | I-6/I-7 | pemicu terbitan OUTWARD juga |
| Dua `MUAT_EKSPOR` pada satu job | — | ❌ (ditolak) | invariant milestone | satu jenis sekali per job |
| RE_EXPORT, tujuan belum diketahui | `reEkspor.kepulangan = kosong` | ✅ | — | tujuan opsional (B, konsisten) |
| Return LCL per-exhibitor beda tujuan | — | ❌ (tak dimodelkan) | I-3 | B3: tujuan per-job (DITUTUP) |

## 7. Mapping teknis (ringkas)

- **`MUAT_EKSPOR`**: tambah satu nilai pada `milestoneKinds` (`domain/job/manifest.ts`) + label
  Indonesia; `milestoneSchema` tak berubah bentuknya. Data lama tetap sah (tanpa `MUAT_EKSPOR`).
- **Pandangan outward**: **view assembler murni** (sejajar `buildManifestView`), mis.
  `buildOutwardView(job, ciplDocument)` → `PandanganOutward`. **Tidak ada tabel/kolom baru**;
  sumbernya `job.ciplDocument`/`ciplLines` (disposisi per `BarisBarang`), `job.kepulangan`
  (`JobReturn`: `mode`/`destination`/`vessel`/`etd`/`eta`), `job.operational.customs.BC_2_5`
  (`JobCustomsDocument`), dan `job.inward` milestones.
- **Reuse, bukan duplikasi**: `PorsiReEkspor.kepulangan` menunjuk `JobReturn` yang ada;
  `dokumenBc` menunjuk entri `BC_2_5` pada `operational.customs`. `CaraKeluarLokal` =
  sub-enumeration `DisposisiBarang` (`DISPOSED`/`GIVE_AWAY`) — tak bikin enum baru yang berdiri
  sendiri bila bisa diturunkan.
- **Hubungan ke tagihan**: `sudahMuatEkspor(job)` = `bolehTerbitOutward(job)` di
  [`tagihan-data-definitions.md`](./tagihan-data-definitions.md) — satu fungsi, dua pemakai.

## 8. Open questions

1. **OQ-B1 (TIDAK_DISEBUT saat close-out):** haruskah seluruh baris berdisposisi (tak ada
   `belumTerklasifikasi`) sebelum `MUAT_EKSPOR` boleh ditandai, atau `MUAT_EKSPOR` tetap boleh
   dengan peringatan tersisa? Perlu Arsya.
2. **OQ-B2 (dokumen penutup DISPOSED/GIVE_AWAY):** VSS tak memproses pabeannya (B2), tetapi secara
   hukum barang impor-sementara (BC 2.3) yang tidak di-re-ekspor tetap butuh penyelesaian bea
   (mis. pelunasan/pemusnahan berita acara). Siapa & dokumen apa yang menutup bonded untuk porsi
   ini? **Requires authority confirmation** — jangan mengarang rezimnya.
3. **OQ-B3 (re-ekspor sebagian):** satu job bisa punya sebagian kontainer re-ekspor dan sebagian
   barang DISPOSED. `KepulanganJob` (mode/tujuan tunggal per-job) menanggung porsi RE_EXPORT saja;
   perlu konfirmasi bahwa satu `ModusKepulangan` cukup untuk porsi re-ekspor yang tercampur.
4. **OQ-B4 (BC 2.5 wajib?):** apakah setiap job dengan porsi RE_EXPORT wajib punya `DokumenBC
   BC_2_5`, atau ada jalur re-ekspor lain (mis. ATA Carnet yang tak pakai BC 2.5)?
   `internationalJenis` ATA_CARNET bisa mengubah dokumen penutupnya.
5. **OQ-B5 (verifikasi fisik vs tanggal dokumen):** B1 menetapkan penanda = tanggal dokumen
   per-job. Perlu konfirmasi apakah ada kebutuhan membedakan "dokumen muat terbit" dari "fisik
   sudah di kapal" (relevan bila running cost dihitung sampai fisik naik kapal, bukan sampai
   dokumen).
