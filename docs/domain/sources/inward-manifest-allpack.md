# Sumber: INWARD MANIFEST ALLPACK (transkripsi ingatan)

Dokumen ingatan agar file Excel klien tidak perlu dilampirkan berulang. Ini
**transkripsi setia + anotasi** dokumen nyata, bukan model (model ada di
[`../job-manifest-data-definitions.md`](../job-manifest-data-definitions.md)).

## Provenance

- Berkas: `/home/aa/Downloads/INWARD MANIFEST ALLPACK.xlsx` (juga versi `.pdf`).
- Pembuat: ALLPACK INDONESIA (PPJK/forwarder) — "Exhibits Details For Inward Movement".
- Event: **JIEXPO, KEMAYORAN (20–23 OCT 2026)** (pameran ALLPACK 2026).
- Ground truth untuk model manifest & CIPL; banyak keputusan domain merujuk ke sini.

## Inventaris sheet

1. **Sheet1** — inward movement: seluruh job + pengelompokan per rezim (lihat taksonomi).
2. **Sheet2 — RETURN LIST CONTAINER** — fase kepulangan FCL per dokumen (S.xx).
3. **Sheet2 (2) — RETURN LIST LCL** — fase kepulangan LCL per grup agent(exhibitor).

## Kolom Sheet1 (kiri→kanan)

`No` · `Job No` · `Exhibitor Name` · `Total Package` · **`Bare Case`** · **`CASE`** ·
`Dimension (L / W / H)` · `CBM` · `Weight Kgs` · `EMPTY STORAGE` · `RE-EXPORT` ·
`Remark` · `Hall` · `Booth No`.

### Kolom yang ambigu / overloaded (PENTING)

- **`Bare Case` vs `CASE`** — dipakai TIDAK konsisten di dokumen:
  - Blok **satu exhibitor**: label per-paket (`PKG 1`, `PK 2`, …) ditaruh di kolom
    **`Bare Case`**, kolom `CASE` kosong. (contoh S.01, S.09, S.17, S.19, S.21).
  - Blok **banyak exhibitor** (konsol/menumpang): kolom **`Bare Case`** berisi
    **jumlah paket per-exhibitor** (mis. `7 PKG`, `1 PKG`, `8 PKG`), sedangkan
    label per-paket (`PKG 1`..`PKG n`) pindah ke kolom **`CASE`**. `Total Package`
    (mis. `17 PKG`) adalah total seluruh job di baris pertama. (contoh S.08, S.13,
    S.14, S.15, S.16, S.25).
  - Hipotesis domain (belum dikonfirmasi klien): "Bare Case" = koli **tanpa kemasan
    kayu/crate** (bare/loose) vs "CASE" = ter-crate. Evidence spreadsheet TIDAK
    membuktikan ini — kolomnya justru dipakai sebagai hitungan/label. → open question #1.
- **`EMPTY STORAGE`** — header ada, SEMUA sel kosong di seluruh sampel. Dugaan:
  kontainer kosong yang dititipkan. Belum pernah terisi → belum bermakna.
- **`RE-EXPORT`** — kolom kosong di semua sampel. Disposisi re-export faktual ada di
  CIPL (kolom REMARKS A/B/C), bukan di manifest ini.

### Baris total per blok

Baris terakhir tiap blok menampilkan **Σ CBM** dan **Σ Weight** (turunan, bukan input).
Beberapa sel total salah ketik di dokumen (mis. S.19 kolom Weight memuat nilai CBM
`13.864531…`). Perlakukan total deklarasi sebagai pembanding rekonsiliasi, bukan sumber.

## Struktur blok inward (header line)

Tiap blok diawali satu baris judul berisi gabungan:
`AGENT / NOMOR DOKUMEN ANGKUT / KONFIGURASI / JUMLAH PKG / BERAT / CBM [/ ukuran kontainer]`.
Contoh: `SHANGHAI YIJIA / 802054115 / 1X40' / 17 PKG / 7910.00 KGM / 46.92 CBM`.
- Agent = pihak pengatur pengiriman (SHENZHEN BOBON, JS LOGISTICS, YIJIA, APT THAI…).
- Nomor dokumen angkut = B/L (laut) atau AWB (udara); prefix baris `S.` (sea) / `A.` (air).
- Konfigurasi: `LCL` atau FCL (`1X20'`, `1X40'`, `1X40'HQ`, atau kombinasi `1X20' + 1X40'`).

## Taksonomi section Sheet1 (urutan apa adanya)

1. **Inward utama** — blok ber-`Job No` `S.01…S.25` (laut) & `A.01…A.03` (udara), plus
   beberapa blok trailing tanpa nomor (ENGE PLAS, BTG/KRONES, FLOW FORCE, BECKHOFF,
   HANNINGFIELD). Rezim: impor sementara pameran (BC 2.3).
2. **ROAD SHIPMENT** — dikelompokkan per `AGENT :` (EASYGO, SINOEVER, UNITOP); tiap agent
   satu exhibitor; remark `Road Shipment : <no>`. (BC 2.7 / pengalihan darat.)
3. **PERMANENT IMPORT** — `Job No` `P1…P8`; remark `PIB AJU …`, `Masuk W/H`. Barang impor
   tetap (BC 3.0). Beberapa konsol multi-exhibitor (P7).
4. **ATA CARNET** — `Job No` `ATA 1…ATA 3`; tanpa kolom berat; identitas carnet.
5. **LOCAL** — `No` `1…7`; barang lokal (PT dalam negeri); remark `Masuk tgl.` +
   `PIC : <nama>` + `Confirmed by <staff>`; tanpa dokumen pabean.

## Konsolidasi / MENUMPANG (bukti kunci)

Satu blok (satu B/L/AWB, satu agent) menaungi banyak exhibitor yang menitipkan barang:
- **S.08** YIJIA 17 PKG: Qingdao Soonforward (7) + Shandong Kangbeite (1) + Shandong
  Xiaokang (1) + Wenzhou Huaqiao (8). → 7+1+1+8 = 17.
- **S.12** YIJIA 40 PKG: Wuhan Phezer (21) + Wuxi Berbica (2) + Foshan Tefude (2) +
  Shantou Penghui (4) + Wonclean (2) + Wiskind (9). Dimensi semua `0`/kosong (menyusul).
  Remark "Ada barang anomali 1 carton" (Wonclean). Ini dokumen yang sama dengan CIPL
  S.12/ALP-VPN/2026.
- **S.13, S.14, S.15, S.16, S.25** serupa (2–3 exhibitor per blok).
- **P7** YIJIA 36 PKG: 7 exhibitor permanen.
- Tiap exhibitor punya `Hall`/`Booth` sendiri (bukti kepemilikan per baris, bukan per blok).

## Kosakata Remark (→ milestone)

`Eta`, `Skep : S-622/WBC.08/2026`, `SPPB`, `Selesai stripping`, `Masuk Bonded`,
`Selesai Bahandle/bahandel`, `Selesai periksa`, `DO ready …`, `Masuk W/H` (permanen),
`Masuk JIEXPO` (road/permanen), `BC.27 TO NICE KRISTA INTERFOOD` (rujukan pengalihan),
`Road Shipment : <no>`, `PIB AJU <no>`. Ejaan/urutan tidak konsisten.

## Return lists (fase kepulangan)

- **Sheet2 (FCL):** `No · Doc(S.xx) · Agent/Exhibitor · Package · 20' · 40'HQ · Destination ·
  Shipping Line · Booking No · Vessel · ETD · ETA · Note`. Destinasi = pelabuhan asal
  (Shanghai, Shekou, Qingdao, Laem Chabang, Busan, Taipei…). Ada rekap "Estimasi container"
  per negara (china:15, Korsel:3, Thailand:3, Taiwan:1, Jepang:1).
- **Sheet2 (2) (LCL):** `No · Doc · Agent/Exhibitor · Package · Destination · Forwarder · …`.
  Note contoh "Hold until Interfood" (S.03).

## Kaitan ke model & open question

Model di `../job-manifest-data-definitions.md` sudah mewakili mayoritas struktur ini
(DokumenAngkut BL/AWB, KonfigurasiMuatan LCL/FCL, KumpulanKoli, Milestone, Catatan,
KepulanganJob). Yang BELUM terselesaikan dan relevan dengan dokumen ini:
1. **Bare Case** (open question #1) — arti pabean vs pemakaian kolom yang overloaded.
2. **EMPTY STORAGE** (OQ#2) — belum pernah terisi.
3. **Penomoran `S.`/`A.`/`P`/`ATA`** (OQ#4) — field job atau sekadar urut tampil.
4. Section ROAD SHIPMENT / PERMANENT IMPORT / ATA / LOCAL memetakan ke
   `JenisInternational` + Job LOCAL — konsistensikan dengan `job-data-definitions.md`.

## Resolusi klien Arsya (2026-11-03)

Jawaban klien atas 6 pertanyaan klarifikasi (di-relay engineer):

1. **Peruntukan: INTERNAL.** Pembaca = **Operations** (eksekusi pemindahan barang) dan
   **Finance** (dasar pembuatan invoice). Input data oleh **CS** (peran CUSTOMER_SERVICE).
   → Bebas memperbaiki layout; tidak terikat format DJBC. Memunculkan area baru:
   kebutuhan finance/invoice dan konsep **outward manifest** (lihat bawah).
2. **Granularitas: per EVENT** (semua job & section sekaligus), seperti Excel asli.
3. **Bare Case:** klien **tidak tahu** artinya. Tidak ada sumber domain yang mendukung;
   duplikatif dengan `Koli.satuanKemasan`. Keputusan: **tidak dimodelkan sebagai konsep**
   (cutover dari kode yang terlanjur ada). OQ#1 RESOLVED — bukan konsep domain.
4. **CASE vs Bare Case di blok menumpang:** klien tidak punya jawaban (sudah pernah
   ditanya). → Menguatkan #3.
5. **EMPTY STORAGE:** klien tidak tahu, **setuju dihilangkan dulu.** OQ#2 RESOLVED — dibuang.
6. **RE-EXPORT:** klien ingin ditampilkan; engineer memutuskan **tidak perlu di tampilan
   inward**. Data re-export **disimpan di DB** dan dipakai untuk **memproduksi inward/outward
   manifest internal**. Sumber disposisi yang benar = CIPL `DisposisiBarang` (per barang),
   bukan field bebas job-level `reExport`.

### Implikasi turunan
- Hapus `bareCaseCount` dan `emptyStorage` dari pipeline (model → wizard CS → export →
  render → extraction). Callsite di "Status kode" bawah.
- Export inward = per-event; total = **turunan** `KumpulanKoli`, bukan sel Excel.
- Perlu konsep **outward manifest** (barang keluar/re-export) sebagai pasangan inward,
  diproduksi dari disposisi CIPL + Return List.

### Area baru BELUM dimodelkan (putaran domain berikutnya)
- **Finance/invoice:** apa dasar penagihan (per CBM? per job? per kontainer? per layanan
  pabean?) dan field apa yang finance butuh dari manifest. Empiris → tanya Arsya.
- **Outward manifest:** bentuk & pemicunya (per event? per kontainer balik dari Return List?).

### Status kode saat ini (grep 2026-11-03 — berbeda dari ingatan engineer)
`bareCaseCount` / `emptyStorage` / `reExport` SUDAH hadir di: `domain/job/manifest.ts:103`,
`domain/job/types.ts:227-228`, `domain/job/validation.ts:297-298`,
`components/job-create-wizard.tsx` (input CS), `components/job-manifest-section.tsx` (tabel),
`lib/manifest-export.ts` (export Excel per-event), `lib/server/manifest-extraction.ts`
(ekstraksi AI). Jadi "drop" = cutover lintas berkas, bukan sekadar tidak menambah.
