# Data Definitions: Tagihan — Penagihan Jasa PPJK ke Pihak Job

Model konseptual (information analysis ala *How to Design Programs*) untuk aggregate **Tagihan**:
dokumen penagihan jasa VSS (PPJK/freight forwarder) kepada **satu pihak** per job. Dokumen ini
melengkapi [`job-data-definitions.md`](./job-data-definitions.md) (mendefinisikan `Job`,
`DokumenBC`) dan [`job-manifest-data-definitions.md`](./job-manifest-data-definitions.md)
(mendefinisikan `Milestone`, `KonfigurasiMuatan`, `KumpulanKoli`, `KepulanganJob`). Berdasar
pematangan dengan klien **Arsya** (2026-11-03, `docs/domain/sources/arsya-discussions.md`). Ini
bukan schema database; mapping teknis — termasuk **evolusi `JobInvoice` lama** — ada di bagian 7.

> **Penamaan.** Konsep ini bernama **`Tagihan`**, BUKAN `Invoice`. "Invoice" sudah terpakai untuk
> *Commercial Invoice* (sisi CI dari CIPL, dokumen **sumber** nilai barang — lihat
> [`cipl-data-definitions.md`](./cipl-data-definitions.md)). Tagihan adalah dokumen **jasa**
> VSS→klien, bukan dokumen nilai barang.

> **⚠️ Scope saat ini (2026-11-03).** Klien untuk sekarang **HANYA** meminta **penanda status
> tagihan**: apakah invoice sudah **dibuat / dikirim / lunas**. Komponen biaya, tarif, dan nilai
> (`DasarTarif`, `KomponenBiaya`, `nilaiFix`/`nilaiActual`) di dokumen ini adalah **DESAIN KE DEPAN
> — BELUM DIMINTA**; jangan diimplementasikan dulu. Slice sekarang = `Terbitan.status` saja (peta
> ke `JobInvoice.status` lama). Prioritas nyata saat ini: **job bisa diisi untuk pameran terdekat.**

## 1. Tujuan dan batas model

**Keputusan/proses yang harus didukung program:**

- Menagih jasa pengurusan satu job kepada **tepat satu pihak** (agent / exhibitor pengatur) —
  TIDAK ada alokasi biaya per-exhibitor (keputusan Arsya A1, terkunci).
- Menerbitkan tagihan secara **situasional** di dua titik: **INWARD** (setelah barang masuk
  bonded) dan **OUTWARD** (setelah barang di kapal/muat ekspor); keduanya boleh **digabung**
  menjadi satu dokumen atas permintaan (A2, terkunci).
- Menghitung **tarif pokok** dari konfigurasi muatan yang **eksklusif** per job: FCL ditarif per
  **ukuran kontainer** (rate beda 20'/40'/40'HQ; satu job FCL boleh banyak ukuran) ATAU LCL per
  **CBM** — satu job adalah LCL atau FCL, **tidak dicampur** (A3, dikoreksi Arsya 2026-11-03).
- Memisahkan nilai yang **disepakati di awal** (`nilaiFix`, saat pengajuan shipping) dari nilai
  yang **terkumpul kemudian** (`nilaiActual`, terutama running cost) — inilah sebab tagihan
  OUTWARD memuat total lengkap tanpa perlu dokumen "penutup".

**Sumber informasi:** `docs/domain/sources/arsya-discussions.md` (keputusan A1–A4, putaran 2),
`domain/job/types.ts` (`JobInvoice`/`InvoiceStatus`/`JobParty` lama yang berevolusi),
`domain/job/manifest.ts` (`Milestone`, `KonfigurasiMuatan`, `KumpulanKoli`, `summarizeKoli`),
dokumen inward manifest ALLPACK sebagai sumber contoh.

**In scope:** aggregate Tagihan, terbitan INWARD/OUTWARD, komponen biaya fix vs actual, tarif
pokok atas konfigurasi muatan, precondition milestone.
**Out of scope (dulu):** price list master (daftar rate per ukuran/CBM — lihat open questions),
akuntansi/jurnal, pajak (PPN), kurs konversi IDR→USD, penagihan antar-pihak bila menumpang
(sudah DITUTUP oleh A1: satu pihak, pihak itu yang membagi ke titipan secara internal/di luar VSS).

**Istilah ambigu:** "final" — **TIDAK ADA konsep final** (dikoreksi Arsya 2026-11-03). "Final"
adalah pertanyaan engineer, bukan permintaan klien; model ini TIDAK memodelkannya. Selebihnya
lihat open questions.

## 2. Peta konsep dan dependency

```text
Atomic / Enumeration
  Dolar · JenisTerbitan · JenisKomponenBiaya · StatusTerbitan · UkuranKontainer (dirujuk)
→ Structure dasar
  KomponenBiaya · BarisTarifFcl · BarisTarifLcl
→ Itemization
  DasarTarif = TarifLcl | TarifFcl · Terbitan = TerbitanInward | TerbitanOutward
→ Aggregate akar
  Tagihan —(tepat satu)→ Job
          —(tepat satu)→ Pihak (JobParty: AGENT | EXHIBITOR)
          —(0..2)→ Terbitan (≤1 INWARD, ≤1 OUTWARD)

Dirujuk (TIDAK didefinisikan ulang):
  Milestone / JenisMilestone (MASUK_BONDED, MUAT_EKSPOR)   — doc manifest / doc outward
  KonfigurasiMuatan (LCL | FCL[Kontainer])                 — doc manifest
  KumpulanKoli (→ summarizeKoli → CBM)                     — doc manifest
```

Tidak ada self-reference. Precondition tiap terbitan merujuk `Milestone` pada Job; tarif pokok
merujuk `KonfigurasiMuatan` + `KumpulanKoli` milik Job yang sama.

## 3. Data definition

### `Dolar`

**Definisi**

```text
Dolar adalah Number ≥ 0 dalam satuan USD.
```

**Interpretasi** — seluruh nilai pada tagihan dinyatakan dalam **USD** (keputusan Arsya
2026-11-03: tagihan dalam dollar, bukan rupiah). `JobInvoice.currency` lama dipertahankan sebagai
field tampilan dengan default `USD`. Biaya yang timbul lokal dalam IDR (mis. sewa gudang) dikonversi
ke USD saat dicatat sebagai komponen — kurs konversi adalah detail operasional (OQ-A5).

**Contoh** — `1250` (USD 1.250). Invalid: nilai negatif; teks `"$1,250.00"` (format tampilan,
bukan nilai).

### `JenisTerbitan`

**Definisi**

```text
JenisTerbitan adalah salah satu dari INWARD atau OUTWARD.
```

**Interpretasi** — dua titik terbit tagihan. `INWARD` boleh dibuat setelah barang tiba di bonded;
`OUTWARD` dirilis setelah barang di pelabuhan muat ekspor (running cost berhenti). **Tidak ada
nilai `FINAL`** — OUTWARD, karena terbit setelah running cost berhenti, dengan sendirinya memuat
total lengkap (A2/A4, terkunci). Enumeration dipilih (bukan structure per alternatif) karena
pembeda jenisnya hanya precondition + peran, bukan data yang dibawa — data biaya identik
bentuknya di kedua jenis (lihat `Terbitan`).

**Contoh** — `INWARD`; `OUTWARD`. Invalid: `FINAL` (bukan konsep domain).

### `JenisKomponenBiaya`

**Definisi**

```text
JenisKomponenBiaya adalah salah satu dari TARIF_POKOK, HANDLING_DOKUMEN, PORT_HANDLING,
STORAGE, atau LAINNYA.
```

**Interpretasi** — kategori baris biaya pada tagihan: `TARIF_POKOK` (ongkos pokok angkut,
diturunkan dari `DasarTarif` atas `KonfigurasiMuatan`); `HANDLING_DOKUMEN` dan `PORT_HANDLING`
(biaya tetap jasa, disepakati di awal); `STORAGE` (**running cost** — sewa gudang/trailer, fungsi
durasi, berhenti saat muat kapal); `LAINNYA` (sisa biaya situasional). Running cost adalah sebab
utama `nilaiActual` berbeda dari `nilaiFix`.

**Contoh** — `TARIF_POKOK`; `STORAGE`. Invalid: memodelkan "final cost" sebagai jenis tersendiri.

### `StatusTerbitan`

**Definisi**

```text
StatusTerbitan adalah salah satu dari DRAFT, TERKIRIM, atau LUNAS.
```

**Interpretasi** — siklus hidup **satu terbitan** (bukan satu job). `DRAFT` dirakit tetapi belum
dikirim ke pihak; `TERKIRIM` sudah dikirim; `LUNAS` sudah dibayar.

**Evolusi dari `InvoiceStatus` lama** (`NOT_READY → READY → SENT → PAID`, linear, satu per job):
`NOT_READY` **dihapus** — maknanya "belum bisa ditagih" kini diwakili oleh *ketiadaan terbitan*
(precondition milestone belum terpenuhi → terbitan belum lahir), sehingga tak ada referennya pada
terbitan yang sudah ada. Pemetaan: `READY → DRAFT`, `SENT → TERKIRIM`, `PAID → LUNAS`. Status
sekarang per-terbitan, bukan per-job: INWARD bisa `LUNAS` sementara OUTWARD masih `DRAFT`.

**Contoh** — INWARD `TERKIRIM`, OUTWARD belum ada (precondition `MUAT_EKSPOR` belum). Invalid:
status `NOT_READY` pada terbitan (kontradiksi — terbitan yang ada pasti sudah melewati precondition).

### `BarisTarifFcl`, `BarisTarifLcl`, dan `DasarTarif`

**Definisi**

```text
BarisTarifFcl terdiri dari ukuran (UkuranKontainer), jumlahUnit (Integer ≥ 1),
  dan ratePerUnit (Dolar).
BarisTarifLcl terdiri dari cbm (Number ≥ 0) dan ratePerCbm (Dolar).
DasarTarif adalah salah satu dari:
- TarifFcl(daftar tidak kosong dari BarisTarifFcl)   // satu baris per ukuran kontainer
- TarifLcl(BarisTarifLcl)
```

**Interpretasi** — dasar perhitungan `TARIF_POKOK`, **itemization sejajar `KonfigurasiMuatan`**
(LCL XOR FCL, eksklusif — dikonfirmasi Arsya 2026-11-03: satu job tidak mencampur LCL dan FCL).
Cabang `TarifFcl` menarif **per ukuran** kontainer (rate 20'/40'/40'HQ berbeda — A3), satu baris
per ukuran dengan jumlah unitnya; satu job FCL boleh membawa beberapa ukuran. Cabang `TarifLcl`
menarif per **CBM** (volume diturunkan dari `summarizeKoli(KumpulanKoli)`).

> **Rekonsiliasi dengan model yang ada.** `DasarTarif` dibuat itemization `TarifLcl | TarifFcl`
> **persis sejajar** `KonfigurasiMuatan` (`loadConfigurationSchema`, `domain/job/manifest.ts`,
> `LCL | FCL` eksklusif). Tidak ada konflik: satu job satu cabang. (OQ-A1 RESOLVED — lihat §8.)

**Contoh** — S.09 (`1x20' + 1x40'`, FCL dua ukuran): `DasarTarif = TarifFcl([BarisTarifFcl(K20,1,r20),
BarisTarifFcl(K40,1,r40)])`. S.01 (LCL, 3 koli): `DasarTarif = TarifLcl(BarisTarifLcl(cbm_turunan,
rCbm))`. Invalid: dua `BarisTarifFcl` berukuran sama (gabung jadi satu baris berjumlah unit); job
dengan FCL dan LCL sekaligus (eksklusif).

**Invariant** — `TarifFcl` berisi daftar tidak kosong dengan tiap `ukuran` muncul paling banyak
satu baris; `TarifLcl` tepat satu `BarisTarifLcl`. Itemization menjamin satu job satu cabang.

### `KomponenBiaya`

**Definisi**

```text
KomponenBiaya terdiri dari:
  jenis       : JenisKomponenBiaya
  deskripsi   : Text, atau kosong
  dasarTarif  : DasarTarif, atau kosong      // hanya untuk jenis TARIF_POKOK
  nilaiFix    : Dolar, atau kosong
  nilaiActual : Dolar, atau kosong
```

**Interpretasi** — satu baris biaya. `nilaiFix` = nilai **disepakati saat pengajuan shipping**
(manual); `nilaiActual` = nilai **terkumpul kemudian**. Keduanya opsional dan **sengaja
dipisah** — jangan disatukan jadi satu `amount` (itulah cacat `JobInvoice` lama). Pola per jenis:
`TARIF_POKOK` membawa `dasarTarif`, `nilaiFix` = hasil `hitungTarifPokok` saat pengajuan, biasanya
`nilaiActual = nilaiFix`; `HANDLING_DOKUMEN`/`PORT_HANDLING` biaya tetap (fix di awal); `STORAGE`
sering `nilaiFix` kosong/estimasi dan `nilaiActual` baru terisi saat muat kapal (durasi final) —
sebab terbitan OUTWARD memuat angka lengkap.

**Contoh** — `KomponenBiaya(TARIF_POKOK, "Ongkos pokok", DasarTarif(...), nilaiFix=2_000,
nilaiActual=2_000)`; `KomponenBiaya(STORAGE, "Sewa gudang 12 hari", kosong, nilaiFix=kosong,
nilaiActual=360)`.

**Invariant** — `dasarTarif` hanya boleh terisi bila `jenis = TARIF_POKOK`. Selisih `nilaiFix` vs
`nilaiActual` adalah **peringatan rekonsiliasi**, BUKAN error/blokir simpan (konsisten dengan
prinsip rekonsiliasi CIPL).

### `Terbitan` (itemization)

**Definisi**

```text
Terbitan adalah salah satu dari:

TerbitanInward
  tanggal  : HariDateOnly          // tanggal dokumen terbit
  nomor    : Text, atau kosong
  status   : StatusTerbitan
  komponen : List<KomponenBiaya>   // biaya yang ditagih pada terbitan ini

TerbitanOutward
  tanggal  : HariDateOnly          // = tanggal milestone MUAT_EKSPOR / tanggal dokumen
  nomor    : Text, atau kosong
  status   : StatusTerbitan
  komponen : List<KomponenBiaya>
```

**Interpretasi** — satu terbitan tagihan pada satu titik waktu. `TerbitanInward` menagih biaya
yang sudah pasti saat barang masuk bonded (umumnya `TARIF_POKOK` + biaya tetap — bertumpu pada
`nilaiFix`). `TerbitanOutward` menagih sisa biaya termasuk running cost yang sudah final karena
barang di kapal (bertumpu pada `nilaiActual`); karena running cost sudah berhenti, totalnya
lengkap-dalam-fakta — **tanpa** flag/dokumen "final". Dua varian ini **bukan** structure berbeda
isi melainkan itemization berdasar titik terbit; bentuk `komponen` identik, pembedanya precondition
(lihat §4) dan peran.

**Contoh** — `TerbitanInward("2026-10-05", "INW-0012", TERKIRIM, [tarif pokok, handling dok, port
handling])`; `TerbitanOutward("2026-11-10", kosong, DRAFT, [storage final, trailer])`.

**Template pemrosesan**

```text
prosesTerbitan(t):
  TerbitanInward  → syarat: ada Milestone MASUK_BONDED pada job;  jumlahkan komponen
  TerbitanOutward → syarat: ada Milestone MUAT_EKSPOR pada job;   jumlahkan komponen
```

### `Tagihan` (aggregate akar)

**Definisi**

```text
Tagihan terdiri dari:
  job      : JobId                 // tepat satu
  pihak    : Pihak                 // JobParty: AGENT(id) | EXHIBITOR(id); tepat satu
  mataUang : Text (default USD)
  terbitan : List<Terbitan>        // 0..2: paling banyak satu INWARD dan satu OUTWARD
```

**Interpretasi** — seluruh penagihan satu job kepada **satu** pihak. `pihak` = `Job.party`
(`JobParty`, AGENT atau EXHIBITOR pengatur) — satu job satu tagihan satu pihak (A1, melanjutkan
komentar `domain/job/types.ts` "satu job = satu tagihan ke satu pihak"). `terbitan` berisi 0, 1,
atau 2 terbitan; penggabungan menjadi "satu dokumen atas permintaan" (A2) adalah **penyajian**
(fungsi `rakitDokumenGabungan`), bukan entitas tersimpan ketiga.

**Contoh (varian & boundary):**

1. Job dengan agent ALLPACK, baru masuk bonded: `terbitan = [TerbitanInward(...)]`; OUTWARD belum
   ada (precondition `MUAT_EKSPOR` belum).
2. Job tuntas: `terbitan = [TerbitanInward(LUNAS), TerbitanOutward(TERKIRIM)]`.
3. Boundary: job baru, belum masuk bonded: `terbitan = []` (tak ada yang sah diterbitkan).
4. Atas permintaan klien: INWARD + OUTWARD dirakit jadi satu dokumen gabungan (penyajian).

Invalid (tidak dapat dibentuk — inilah tujuannya):

- Dua pihak tertagih / alokasi per-exhibitor → `pihak` tunggal; tak ada field alokasi.
- Terbitan `FINAL` → `JenisTerbitan` hanya INWARD/OUTWARD.
- Dua `TerbitanInward` atau dua `TerbitanOutward` pada satu tagihan → langgar §4 I-2.
- `TerbitanInward` pada job yang belum punya Milestone `MASUK_BONDED` → langgar precondition.

## 4. Invariant lintas konsep

- **I-1 (satu pihak):** satu Job punya paling banyak satu Tagihan, dengan tepat satu `pihak`;
  tidak ada alokasi biaya per-exhibitor (A1). `pihak` konsisten dengan `Job.party`.
- **I-2 (≤1 per jenis, tak ada final):** `terbitan` memuat paling banyak satu `TerbitanInward`
  dan satu `TerbitanOutward`; tidak ada jenis terbitan lain ("final" tidak dimodelkan).
- **I-3 (precondition INWARD):** `TerbitanInward` hanya sah bila Job punya `Milestone`
  berjenis `MASUK_BONDED` (sudah ada di `JenisMilestone`).
- **I-4 (precondition OUTWARD):** `TerbitanOutward` hanya sah bila Job punya `Milestone`
  berjenis `MUAT_EKSPOR` (milestone baru — lihat [`outward-data-definitions.md`](./outward-data-definitions.md)).
  Pemicu yang sama ini juga melahirkan pandangan outward manifest.
- **I-5 (tanpa dobel-tagih):** satu biaya ditagih pada **paling banyak satu** terbitan; dokumen
  gabungan = union komponen kedua terbitan, tanpa tumpang tindih.
- **I-6 (fix vs actual = peringatan):** selisih `nilaiFix` vs `nilaiActual` adalah peringatan
  rekonsiliasi, bukan blokir simpan — jangan memaksakan presisi yang belum tersedia.
- **I-7 (tarif atas muatan):** `DasarTarif` sebuah job diturunkan dari `KonfigurasiMuatan`
  (unit FCL per ukuran) + `KumpulanKoli` (CBM via `summarizeKoli`) job yang sama.

## 5. Fungsi turunan (signature, tanpa implementasi)

```text
hitungTarifPokok : (KonfigurasiMuatan, KumpulanKoli, DasarTarif) -> Dolar
  // purpose: cabang DasarTarif — TarifFcl → Σ(jumlahUnit × ratePerUnit per ukuran);
  // TarifLcl → cbm × ratePerCbm (cbm dari summarizeKoli). Rate disepakati di awal.

totalTerbitan : Terbitan -> { totalFix: Dolar, totalActual: Dolar }
  // purpose: Σ nilaiFix dan Σ nilaiActual komponen terbitan (kosong dihitung 0).

bolehTerbitInward : Job -> Bool
  // purpose: I-3 — ada Milestone MASUK_BONDED.

bolehTerbitOutward : Job -> Bool
  // purpose: I-4 — ada Milestone MUAT_EKSPOR.

rakitDokumenGabungan : (TerbitanInward, TerbitanOutward) -> DokumenTagihan
  // purpose: penyajian "digabung atas permintaan" (A2); murni, tidak menyimpan entitas baru.

peringatanRekonsiliasi : Tagihan -> List<Peringatan>
  // purpose: selisih nilaiFix vs nilaiActual per komponen (I-6).
```

## 6. Validasi contoh

| Skenario (ALLPACK) | Definition terkait | Dapat direpresentasikan? | Branch/template | Catatan |
|---|---|---|---|---|
| S.09 `1x20' + 1x40'` → FCL dua ukuran | `DasarTarif = TarifFcl([K20×1, K40×1])` | ✅ | itemization FCL | rate 20' ≠ 40' (A3) |
| S.01 LCL 3 koli → tarif per CBM | `DasarTarif = TarifLcl(BarisTarifLcl(cbm, rate))` | ✅ | itemization LCL | cbm via `summarizeKoli` |
| S.08 FCL `1x40'` | `DasarTarif = TarifFcl([K40×1])` | ✅ | itemization FCL | — |
| Job campur FCL + LCL dalam satu job | — | ❌ (eksklusif) | `KonfigurasiMuatan`/`DasarTarif` LCL XOR FCL | A3 dikoreksi: tak dicampur |
| INWARD setelah `MASUK_BONDED`; OUTWARD belum | `terbitan = [TerbitanInward]` | ✅ | I-3 | OUTWARD lahir saat `MUAT_EKSPOR` |
| Running cost storage final saat muat kapal | `KomponenBiaya(STORAGE).nilaiActual` di OUTWARD | ✅ | — | OUTWARD = total lengkap tanpa "final" |
| Minta satu dokumen gabungan INWARD+OUTWARD | `rakitDokumenGabungan` | ✅ | penyajian | bukan entitas tersimpan |
| INWARD sebelum masuk bonded | — | ❌ (ditolak) | I-3 | precondition tak terpenuhi |
| Alokasi biaya per-exhibitor saat menumpang | — | ❌ (tak ada field) | I-1 | A1: satu pihak, bagi di luar VSS |
| Terbitan "final" | — | ❌ (tak ada nilai) | `JenisTerbitan` | bukan konsep domain |

## 7. Mapping teknis (ringkas) — evolusi `JobInvoice`

**Titik awal (evidence, `domain/job/types.ts`):**

- `JobInvoice = { number, amount, currency, status, sentAt, paidAt }` — **satu `amount`** +
  **status linear** `InvoiceStatus (NOT_READY→READY→SENT→PAID)`, komentar "satu job = satu
  tagihan ke satu pihak". `Job.party: JobParty | null` (AGENT | EXHIBITOR) sudah ada.

**Gap model vs kode:** satu `amount` tak bisa memuat 2 titik terbit + nilai berevolusi (running
cost); status linear tunggal tak bisa melacak INWARD `LUNAS` sementara OUTWARD `DRAFT`; tak ada
pemisahan `nilaiFix`/`nilaiActual`, tak ada `DasarTarif`.

**Usulan evolusi (proposal — belum dieksekusi di dokumen ini):**

1. `JobInvoice` → `Tagihan` dengan `terbitan: Terbitan[]` (≤1 INWARD, ≤1 OUTWARD), tiap terbitan
   `komponen: KomponenBiaya[]` dengan `nilaiFix`/`nilaiActual` terpisah. `party` tetap **tunggal**
   (A1) — tak berubah bentuknya.
2. `InvoiceStatus` → `StatusTerbitan` (`DRAFT|TERKIRIM|LUNAS`); `NOT_READY` dihapus (digantikan
   oleh ketiadaan terbitan); `READY→DRAFT, SENT→TERKIRIM, PAID→LUNAS`. Data lama (satu `amount` +
   status) dimigrasi jadi satu `TerbitanInward` berisi satu `KomponenBiaya(LAINNYA, nilaiFix=amount)`
   dengan status terpetakan — persoalan migrasi, bukan bagian model.
3. Hidup berdampingan di `jobs.payload` (seperti `inward`/`kepulangan`), **tanpa migration SQL**;
   Zod schema baru di modul domain job (sejajar `manifest.ts`). `number/sentAt/paidAt` lama pindah
   ke level `Terbitan`.
4. `DasarTarif` dirakit dari `KonfigurasiMuatan` + `summarizeKoli`; daftar rate (per ukuran / per
   CBM) sumbernya lihat OQ-A3.

## 8. Open questions

1. **OQ-A1 (RESOLVED 2026-11-03):** `KonfigurasiMuatan` `LCL | FCL` **eksklusif** sudah BENAR —
   satu job LCL atau FCL, tidak dicampur (Arsya mengoreksi A3; engineer salah paham pertanyaan).
   `DasarTarif` dibuat itemization `TarifLcl | TarifFcl` sejajar `KonfigurasiMuatan`; tak ada konflik.
2. **OQ-A3 (sumber rate):** `ratePerUnit` per ukuran & `ratePerCbm` disimpan **per job** (diisi
   saat pengajuan, A "fix rate ditetapkan saat pengajuan shipping, manual") atau dari **price list
   master** per event/agent? Model sekarang mengasumsikan per-job (`DasarTarif` menyimpan rate).
3. **OQ-A4 (penutupan running cost):** Arsya A4 menyebut CS/Operations menyatakan "sudah di kapal"
   secara manual. Dalam model ini penutupan = **lahirnya `TerbitanOutward`** (gated `MUAT_EKSPOR`).
   Perlu dikonfirmasi: cukupkah milestone `MUAT_EKSPOR` sebagai penanda penutupan, atau perlu flag
   eksplisit "running cost ditutup" terpisah dari tanggal muat?
4. **OQ-A5 (RESOLVED 2026-11-03):** tagihan dalam **USD** (bukan IDR). Sisa pertanyaan minor:
   kurs konversi biaya lokal (IDR) → USD saat dicatat sebagai `nilaiActual` — detail operasional,
   bukan bentuk model.
5. **OQ-A6 (pembayaran gabungan):** bila INWARD+OUTWARD dirakit jadi satu dokumen lalu dibayar
   sekaligus, apakah `LUNAS` ditandai per-terbitan (dua) atau butuh entitas pembayaran lintas
   terbitan? Saat ini status per-terbitan (I-2) — cukup bila pembayaran dipetakan balik ke keduanya.
6. **OQ-A7 (PPN/pajak):** komponen pajak belum dimodelkan (`LAINNYA` sementara menampungnya).
   Perlu keputusan apakah pajak jadi `JenisKomponenBiaya` tersendiri.
