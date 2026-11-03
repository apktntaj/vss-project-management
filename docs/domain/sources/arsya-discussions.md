# Catatan diskusi klien (Arsya) — ingatan mentah

Log input empiris dari klien **Arsya** (pemilik domain / pemesan fitur), di-relay engineer.
Ground truth *niat & workflow kantor*; BUKAN model (pemodelan = tugas Pak Kur + data-definition
docs). Kutipan dalam tanda petik = **verbatim** pesan Arsya.

## 2026-11-03 — Invoice (finance) & Outward manifest

### Finance / invoice
- **Dasar tarif pokok:** LCL → per **CBM**; FCL → per **kontainer**.
- Ditambah **biaya handling dokumen**, **port handling**, dll.
- **Fix rate** ditetapkan saat **pengajuan shipping** (manual).
- Ditambah **running cost** selama proses berlangsung: **sewa gudang (storage)**, dll.
- Invoice bersifat **situasional**, ada beberapa titik terbit:
  - **Inward invoice** — bisa dibuat **setelah barang tiba di bonded**.
  - **Outward invoice** — bisa **release setelah barang sudah di pelabuhan muat ekspor**.
  - **Final invoice** — terbit **setelah semua data real-time & cost terkumpul**.
- Verbatim Arsya:
  > "invoice di buat situasional, tp setelah barang tiba di bonded bisa di buat inward
  > invoicenya. lalu outward invoice bisa release setelah barang udh di pelabuhan muat ekspor"
  > "tp final invice itu bisa terbit setelah semua data real time dan cost terkumpul."

### Outward manifest (asumsi engineer, tervalidasi sebagian oleh Arsya)
- Konteks **pameran**: barang yang **harus keluar dari pameran** → jadi dokumen **outward**.
- **Sebagian barang tidak kembali** (tidak semua re-export; ada yang disposed/sold/giveaway
  — lih. `DisposisiBarang` di CIPL).
- **Tujuan outward tidak selalu ke negara asal.**
- **Waktu diketahuinya negara tujuan tidak pasti** — bisa di awal atau akhir pameran.
- Asumsi engineer (divalidasi Arsya): **outward = data barang yang keluar dari bonded**,
  **termasuk BC 2.5 dan re-export**.

### Fakta operasional lain
- **Kolom jobs perlu ditambah `SPPB` dan `tanggal masuk bonded`.** (Catatan: keduanya sudah
  ada sebagai `JenisMilestone` SPPB / MASUK_BONDED di model manifest — kemungkinan gap
  UI/first-class-field, bukan gap model. Perlu dikonfirmasi saat pematangan.)
- **Operations butuh input Job LOCAL** — sepertinya untuk **layanan forklift**. (Job LOCAL
  sudah representable di model; ini kebutuhan alur input/UI.)

### Status
Belum dimodelkan. Diteruskan ke Pak Kur untuk pematangan konsep (invoice lifecycle +
outward), lalu validasi balik ke Arsya atas open question yang tersisa.

## Hasil pematangan Pak Kur (2026-11-03)

Memo lengkap: `history://PakKurInvoiceOutward`. Intisari:

### Temuan kritikal
- **"Invoice" overloaded.** Commercial Invoice (dokumen sumber CIPL, nilai barang untuk BC)
  BERBEDA dari tagihan jasa VSS→klien. Konsep baru dinamai **`Tagihan`**, jangan `Invoice`.
- **Model lama berbenturan.** Sudah ada `JobInvoice` (`domain/job/types.ts:147-155`,
  `InvoiceStatus NOT_READY→READY→SENT→PAID`, komentar `:60` "satu job = satu tagihan ke satu
  pihak"). Satu `amount` + status linear **tak bisa** merepresentasikan 3 titik terbit +
  nilai berevolusi (running cost). Mendamaikan ini = keputusan domain, bukan refactor.

### Tagihan (A)
- Dua bentuk kandidat: (1) 3 dokumen terpisah `JenisTagihan INWARD|OUTWARD|FINAL` (job→0..3
  Tagihan), atau (2) 1 Tagihan dengan beberapa terbitan/termin, FINAL = penutup. → A-Q2.
- Tarif pokok bergantung `KonfigurasiMuatan`: LCL→CBM (turunan `KumpulanKoli`); FCL→jumlah
  kontainer. + biaya tetap (handling dok, port handling) + running cost (storage, fungsi durasi).
- **Pisahkan `nilaiFix` (disepakati saat pengajuan) vs `nilaiActual` (terkumpul kemudian)** —
  inilah sebab FINAL belakangan; jangan satukan jadi satu `amount`.
- Precondition: INWARD = Milestone `MASUK_BONDED` (ADA); OUTWARD = milestone "muat ekspor"
  (BELUM ADA); FINAL = running cost ditutup (turunan, A-Q4).

### Outward (B)
- Outward = barang keluar bonded = **generalisasi**, bukan pengganti `KepulanganJob`.
- Partisi dari `DisposisiBarang` (CIPL, per barang): `RE_EXPORT`→butuh tujuan ekspor, ≈
  `KepulanganJob` + `DokumenBC BC_2_5` (ADA); `DISPOSED`/`GIVE_AWAY`→keluar bonded TANPA
  tujuan/vessel (penyelesaian lokal; rezim pasti = requires authority confirmation).
  Impossible-state yang dihindari: barang DISPOSED punya tujuan/vessel ekspor.
- Tujuan tidak-selalu-negara-asal & terisi-belakangan: `KepulanganJob.tujuan/etd/eta` sudah
  opsional → konsisten; jangan jadikan invariant awal.
- Pemicu OUTWARD invoice == penanda "muat ekspor" == milestone outward baru → **satu gap,
  putuskan bersama A & B**.

### Fakta kecil (C)
- `SPPB` & `MASUK_BONDED` sudah `JenisMilestone` → "tambah kolom jobs" = **gap UI**, bukan model.
- Job LOCAL (forklift) sudah representable (`JobLocal`); kebutuhan = alur input Operations.

### Open question untuk Arsya (pemblokir pemodelan)
- **A-Q1** pihak tertagih saat menumpang: 1 pihak (agent/pengatur) lalu dia bagi, atau VSS
  tagih tiap exhibitor? Jika per exhibitor: basis alokasi biaya pokok apa (porsi CBM/koli)?
- **A-Q2** 3 faktur terpisah atau 1 tagihan banyak terbitan?
- **A-Q3** satuan FCL multi-kontainer (`1x20'+1x40'`): per unit atau per ukuran? LCL+FCL campur?
- **A-Q4** kapan running cost "ditutup" & siapa menyatakan FINAL boleh terbit?
- **B-Q1** penanda pasti "barang di pelabuhan muat ekspor" (tanggal/dokumen? per job/kontainer?).
- **B-Q2** barang DISPOSED/GIVE_AWAY: VSS urus penyelesaian pabeannya? memengaruhi tagihan?
- **B-Q3** pernah satu LCL balik punya tujuan berbeda per exhibitor? (→ tujuan pindah ke rincian)

### Status
Model BELUM difinalkan; menunggu jawaban A-Q1/A-Q2 (pemblokir terbesar) + B-Q1.

## Jawaban Arsya putaran 2 (2026-11-03) — resolusi

- **A1 → tagih ke SATU pihak.** Asumsi pihak model lama (`JobInvoice` "satu job satu pihak")
  BENAR; tak perlu alokasi biaya per-exhibitor. RESOLVED.
- **A2 → biasanya TERPISAH, bisa DIGABUNG atas permintaan.** Satu job punya beberapa terbitan
  tagihan (inward, outward); boleh dirakit jadi satu dokumen. Arsya balik bertanya "Final
  maksudnya apa?" → lihat klarifikasi bawah.
- **A3 → FCL per UKURAN** (rate beda 20'/40'/40'HQ); LCL+FCL boleh **campur** selama satu
  pihak/satu job. Tarif pokok = Σ(kontainer per ukuran) + (CBM untuk porsi LCL). RESOLVED.
- **A4 → FINAL dinyatakan MANUAL oleh CS/Operations saat barang sudah di kapal** (tidak ada
  lagi sewa gudang/trailer). Jadi "final" = penutupan saat running cost berhenti, bukan
  milestone otomatis.
- **B1 → pemicu outward = per JOB, ditandai TANGGAL DOKUMEN.** Milestone outward baru:
  per-job, bertanggal (bukan per kontainer/exhibitor). RESOLVED granularitas.
- **B2 → VSS TIDAK mengurus penyelesaian pabean DISPOSED/GIVE_AWAY.** Partisi itu
  **informasional** saja (barang tak kembali), tidak diproses/ditagih VSS. Menyederhanakan
  outward: fokus VSS = porsi RE_EXPORT. RESOLVED.
- **B3 → tujuan LCL balik TIDAK pernah beda per-exhibitor.** `KepulanganJob.tujuan` tetap
  **per-job**; OQ manifest (multi-tujuan per exhibitor) RESOLVED — tak perlu ke level rincian.

### TIDAK ada konsep "Final" (dikoreksi 2026-11-03)
"Final" adalah pertanyaan ENGINEER, bukan dari Arsya. **Tidak ada konsep final.** Terbitan
tagihan hanya **INWARD** dan **OUTWARD**. Tagihan OUTWARD terbit saat barang sudah di kapal
(running cost — sewa gudang/trailer — berhenti), sehingga ia otomatis memuat total yang sudah
lengkap. Tidak perlu flag/dokumen "penutup" terpisah.

### Model mengerucut (pasca putaran 2 — final)
- **Tagihan**: 1 pihak per job; terbitan **INWARD** dan/atau **OUTWARD** (situasional; boleh
  digabung jadi satu dokumen atas permintaan). Tidak ada terbitan "final".
- **Tarif pokok**: FCL per-ukuran-kontainer + LCL per-CBM; campur diizinkan dalam satu job.
- **Biaya**: `nilaiFix` (saat pengajuan) + biaya tetap (handling dok, port) + running cost
  (storage/trailer, berhenti saat muat kapal → OUTWARD memuat angka lengkap).
- **Milestone outward baru** (per job, tanggal dokumen) → pemicu terbitan OUTWARD + outward manifest.
- **Outward manifest**: partisi `DisposisiBarang`; RE_EXPORT = diproses VSS → `BC 2.5` +
  `KepulanganJob`; DISPOSED/GIVE_AWAY = informasional (VSS tak proses, B2). `tujuan` per-job (B3).

### Perubahan model lama yang diperlukan (bukan refactor, keputusan domain)
`JobInvoice` (satu `amount` + status linear NOT_READY→PAID) harus berevolusi jadi
**multi-terbitan** (inward/outward) dengan komponen fix vs actual. Pihak-nya tetap tunggal (A1).

## Koreksi atas draft (2026-11-03, lanjutan)

- **Mata uang: USD, bukan IDR.** Tagihan dalam dollar. Atomic `Dolar` (USD) di
  `tagihan-data-definitions.md`; OQ-A5 RESOLVED. Biaya lokal (IDR, mis. sewa gudang) dikonversi
  ke USD saat dicatat (kurs = detail operasional).
- **KonfigurasiMuatan EKSKLUSIF.** Koreksi A3: engineer salah paham pertanyaan — satu job adalah
  **LCL atau FCL, tidak dicampur**. (FCL boleh banyak UKURAN kontainer; itu beda dengan "campur
  LCL+FCL".) `DasarTarif` dibuat itemization `TarifLcl | TarifFcl` sejajar `KonfigurasiMuatan`.
  OQ-A1 RESOLVED — tak ada konflik model.

## Jawaban open question Tagihan + koreksi SCOPE (2026-11-03)

- **A3 (RESOLVED):** rate **per-job**, ditetapkan saat user kirim shipping manual, dan **FIX**.
  Bukan price-list master. `DasarTarif` per-job sudah benar.
- **A4 (RESOLVED):** penanda penutupan (muat ekspor / running cost berhenti) = **input manual CS
  atau Operations**. Milestone `MUAT_EKSPOR` diisi manual; tak perlu flag terpisah.
- **A6 (RESOLVED):** status ditandai **di KEDUA** terbitan (inward & outward) — `StatusTerbitan`
  per-terbitan sudah menampung; pembayaran gabungan menandai dua-duanya LUNAS. (Jawab pertanyaan
  balik Arsya: ya, di keduanya.)
- **A7 — KOREKSI SCOPE (penting):** pajak ditunda. Lebih besar: **klien saat ini HANYA meminta
  penanda status invoice: dibuat / dikirim / lunas.** Rate & komponen biaya BELUM diminta (baru
  wacana "kalau nantinya ada"). **Fokus sekarang: job bisa diisi untuk pameran terdekat.**

### Reprioritisasi
Near-term BUKAN Tagihan/Outward penuh, melainkan **input job untuk event terdekat**. Model biaya
Tagihan = desain backlog (ditandai scope di dokumennya); slice implementasi sekarang = status
saja (≈ `JobInvoice.status` lama: dibuat/kirim/lunas). Outward juga backlog.
