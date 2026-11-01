# Data Definitions: CIPL — Dokumen Sumber Barang Pameran

Model konseptual (information analysis ala *How to Design Programs*) untuk dokumen **CIPL
(Commercial Invoice & Packing List)** pameran, berdasar dokumen nyata **CIPL S.12/ALP-VPN/2026 —
Shanghai Yijia untuk ALLPACK 2026** (`/home/aa/Downloads/CIPL S.12 ALP  - Yijia 2nd.pdf`,
1 dokumen menaungi 6 exhibitor, 40 packages) dan **inward manifest ALLPACK**
([`job-manifest-data-definitions.md`](./job-manifest-data-definitions.md)) sebagai pembanding
pandangan operasional. Diskusi dengan domain expert 2026-11-01. Dokumen ini mengisi celah yang
dideklarasikan [`job-data-definitions.md`](./job-data-definitions.md) §1 ("CIPL/Shipment —
dokumen tersendiri") dan bukan schema database; mapping teknis ada di bagian 7.

## 1. Tujuan dan batas model

**Keputusan/proses yang harus didukung program:**

- Mewadahi SATU dokumen CIPL konsol yang menaungi BANYAK exhibitor (S.12: 1 dokumen, 6 exhibitor,
  40 packages) — tanpa memaksakan multi: CIPL per-exhibitor tetap sah sebagai entri tunggal.
- Menyimpan dua partisi muatan sekaligus plus satu lapisan deklarasi: **kepemilikan** per
  exhibitor (siapa punya apa, hall/booth), **fisik** per koli (dimensi, berat), dan
  **deklarasi barang** (uraian, HS, qty, nilai).
- Merekam **disposisi barang per item** (kolom REMARKS A/B/C dokumen: re-export / disposed or
  consumed / give away-sold) sebagai bahan rekap re-export dan kepulangan.
- Menjembatani dokumen (bukti) dan master data: nama exhibitor disimpan **persis seperti
  tertulis**, link ke master bersifat opsional dan diresolusikan belakangan.
- Membandingkan **total yang dideklarasikan dokumen** dengan total turunan rincian — selisih
  adalah peringatan rekonsiliasi, bukan kegagalan representasi.

**Sumber informasi:** dua dokumen nyata di atas (ground truth), diskusi domain expert
2026-11-01, dan kode eksisting sebagai evidence (`Cipl/CiplVersion/CiplItem`,
`CiplScanResult` dari `/api/scan-cipl`, `job.manifestExhibitors`).

**In scope:** agregat dokumen CIPL: entri exhibitor, koli, baris barang, disposisi, versi.
**Out of scope (dulu):** rantai alokasi Shipment/CustomsJob (kontrak di job doc I-3), fase
kepulangan (doc manifest), dokumen BC proses (job doc), penagihan.

**Istilah ambigu:** *koli / package / case / pkg* — kerancuan ini DIKECUALIKAN oleh keputusan
domain expert 2026-11-01: **satu konsep domain, label dokumen yang berbeda-beda** (CIPL S.12
menyebut baris fisiknya "NO. 1–40" dengan footer "TTL: 40 PACKAGES"; manifest klien menyebut
"CASE"/"PKG 1"). Sisanya lihat open questions per definisi dan bagian 8.

## 2. Peta konsep dan dependency

```text
Atomic/Enumeration
  NomorDokumenCipl · TanggalOnly (dirujuk) · DisposisiBarang · RefKoli
→ Structure dasar
  PihakDokumen · BarisBarang · Koli + KumpulanKoli (dirujuk dari doc manifest)
→ Aggregate
  EntriExhibitor (→ Exhibitor master, opsional)
→ Aggregate akar
  CiplDocument · VersiCipl (snapshot immutable)
```

Tidak ada self-reference. `EntriExhibitor` hanya menautkan master `Exhibitor` (entitas per
event, lihat doc event) secara OPSIONAL — dokumen datang lebih dulu daripada master.

## 3. Data definition

### `NomorDokumenCipl`

**Definisi**

```text
NomorDokumenCipl adalah Text nomor dokumen sebagaimana tercantum di kepala CIPL.
```

**Interpretasi** — referensi komunikasi user ("INV & PL NO.: S.12/ALP-VPN/2026"); bukan
identitas internal sistem. Satu nomor menaungi seluruh entri exhibitor pada dokumen konsol.

**Contoh** — `S.12/ALP-VPN/2026`. Invalid: `VSS-0123` (identitas internal), `OOCU8067803`
(nomor kontainer, bukan nomor dokumen).

### `DisposisiBarang`

**Definisi**

```text
DisposisiBarang adalah salah satu dari RE_EXPORT, DISPOSED, GIVE_AWAY, atau TIDAK_DISEBUT.
```

**Interpretasi** — legenda kolom REMARKS dokumen: "A: RE-EXPORT AFTER EXHIBITION,
B: DISPOSED OR CONSUMED, C: GIVE AWAY/SOLD". Penanda per baris barang; bahan rekap re-export
(pada manifest klien menjadi kolom RE-EXPORT; pada job saat ini hanya teks bebas `reExport`).
Baris tanpa tanda = `TIDAK_DISEBUT`, tidak mewarisi dari entri/dokumen.

**Contoh** — `RE_EXPORT` (item 1–31 dan 33 bertanda A pada S.12); `DISPOSED` (CATALOG item 32
bertanda B; CATALOGUE "in package No. 22" juga B); `TIDAK_DISEBUT`. `GIVE_AWAY` tidak diamati
bertanda pada S.12 — nilai tetap disediakan karena tercantum di legenda dokumen.

### `RefKoli`

**Definisi**

```text
RefKoli adalah Text bebas, persis sebagaimana tertulis di dokumen, yang menghubungkan
satu BarisBarang ke koli.
```

**Interpretasi** — bukti pemetaan item↔koli yang LONGGAR (many-to-many): rentang `"7-11"`
berarti satu item (inkjet printer 13 SET) tersebar di lima koli tanpa rincian per koli;
rujukan `"in package No. 22"` berarti banyak item dalam satu koli. Dokumen TIDAK pernah
memecah kuantitas per koli — karena itu `RefKoli` disimpan sebagai teks apa adanya, bukan
join presisi; mengarang split kuantitas berarti memfabrikasi data yang tidak ada.

**Contoh** — `"22"`; `"7-11"`; `"in package No. 30"`. Invalid: struktur
`{ koli: 3, jumlahDiKoli: 5 }` (presisi yang tidak diberikan dokumen mana pun).

### `PihakDokumen`

**Definisi**

```text
PihakDokumen terdiri dari nama (Text), alamat (Text atau kosong), kodeNegara (Text atau
kosong), dan taxId (Text atau kosong).
```

**Interpretasi** — pihak pada kepala dokumen: pengirim (shipper) = agent logistik
(SHANGHAI YIJIA INTERNATIONAL LOGISTICS CO., LTD, alamat Shanghai, USCI `91310109572732274D`)
dan penerima (consignee) = penyelenggara/attn PPJK (PT. JAKARTA INTERNATIONAL EXPO,
ID TAX NO. `0021 9216 3007 3000`). Pihak ini pemilik kontrak angkut — BERBEDA dari exhibitor
yang hanya pemilik barang per baris dan tidak muncul di kepala dokumen.

**Contoh invalid** — memodelkan exhibitor sebagai consignee dokumen: exhibitor tidak
terdaftar sebagai pihak kontrak angkut pada dokumen nyata.

### `BarisBarang`

**Definisi**

```text
BarisBarang terdiri dari uraian (Text), merekModel (Text atau kosong), kodeHs (Text atau
kosong), jumlah (Number > 0), satuan (Text), nilaiSatuan (Number ≥ 0 atau kosong),
nilaiTotal (Number ≥ 0 atau kosong), disposisi (DisposisiBarang), dan refKoli
(RefKoli atau kosong).
```

**Interpretasi** — deklarasi barang, sisi Commercial Invoice dari CIPL: kolom DESCRIPTION
OF GOODS (IN ENGLISH), MODEL (`BRAND:PHEZER; MODEL:PL1-A` — teks gabungan merek+model
dipertahankan apa adanya), HS Code, QUANTITY beserta satuan (`SET`, `PCE`), dan CIF VALUE.
Dimensi dan berat TIDAK menjadi bagian `BarisBarang` — keduanya milik `Koli` (unit fisik);
lihat OQ-2 untuk kebutuhan salinan hasil ekstraksi invoice.

**Contoh** — `BarisBarang("FIBER LASER MARKING MACHINE", "BRAND:PHEZER; MODEL:PL1-A",
"84561190", 1, "SET", 500.00, 500.00, RE_EXPORT, kosong)`; `BarisBarang("CATALOGUE", kosong,
"49111090", 50, "PCE", 0.07, 3.50, DISPOSED, "in package No. 22")`.

**Contoh invalid** — jumlah `0` (barang yang tak dijumlah tak tertulis di dokumen);
`kodeHs` berupa angka tanpa nol depan (`84561190` valid sebagai teks, `8.456119e5` tidak).

### `EntriExhibitor`

**Definisi**

```text
EntriExhibitor terdiri dari namaTertera (Text), exhibitorId (ID atau kosong),
hall (Text atau kosong), booth (Text atau kosong), koli (KumpulanKoli), dan
items (List<BarisBarang>).
```

**Interpretasi** — partisi kepemilikan di dalam satu dokumen: baris kolom EXHIBITOR dan
BOOTH NO. pada tabel CIPL. `namaTertera` disimpan **persis tertulis** termasuk ejaan/singkatan
dokumen (`WUHAN PHEZER TECHNOLOGY., LTD.`, `WUXI BERBICA TECHNOLOGY CO., Ltd`) — dokumen
mendahului master, sehingga `exhibitorId` adalah link opsional yang diresolusikan belakangan
(fuzzy match, konfirmasi manusia). Booth gabungan `"C3/M302"` dipilah menjadi hall `C3` +
booth `M302` saat ekstraksi; rentang `"D007-008"` dibiarkan teks (konsisten doc manifest).
Kepala dokumen punya kolom HALL NO./STAND NO. yang kosong pada S.12: hall/booth memang data
per entri, bukan per dokumen. `koli` memakai `KumpulanKoli` dari
[dokumen manifest](./job-manifest-data-definitions.md) — **dirujuk, tidak didefinisikan
ulang**: pada CIPL berbentuk baris NO. 1–40 dengan L/W/H, volume, berat GROSS/NET; pada
manifest klien berbentuk kolom CASE/Dim/CBM/Weight untuk muatan yang sama. CIPL tidak
membawa kolom Bare Case; `bareCaseCount` tetap datang dari manifest.

**Invariant** — `namaTertera` wajib non-kosong; `items` dan rincian koli boleh kosong
(entri yang datanya menyusul — manifest S.12 mencatat 21 PKG tanpa satu pun dimensi).

### `CiplDocument`

**Definisi**

```text
CiplDocument terdiri dari nomor (NomorDokumenCipl atau kosong), tanggal (TanggalOnly atau
kosong), pengirim (PihakDokumen atau kosong), penerima (PihakDokumen atau kosong),
namaPameran (Text atau kosong), incoterm (Text atau kosong), mataUang (Text atau kosong),
infoKontainer (Text atau kosong), nilaiTotalDeklarasi (Number ≥ 0 atau kosong),
entri (List<EntriExhibitor>), dan itemsBelumTerpetakan (List<BarisBarang>).
```

**Interpretasi** — satu dokumen CIPL utuh. S.12: pengirim Yijia, penerima JI Expo,
`namaPameran` "ALLPACK 2026/ OCT 20-23 2026/ JAKARTA,INDONESIA", nilai barang CIF
(incoterm + mataUang USD), `infoKontainer` `"1*40HC (OOCU8067803)"` (footer CONTAINER —
teks gabungan ukuran+nomor; OQ-4), `nilaiTotalDeklarasi` `34466.29` (TOTAL CIF AMOUNT —
deklarasi di kertas, dipertahankan sebagai pembanding rekonsiliasi, bukan turunan).
`entri` terurut sesuai kemunculan di dokumen. `itemsBelumTerpetakan` menampung baris barang
yang tidak terpilah per exhibitor — jawaban domain expert 2026-11-01: "tidak selalu
tercantum" (S.12 kebetulan terpilah lewat sel gabungan). Keputusan implementasi 2026-11-01:
nomor/pengirim/penerima boleh kosong karena dokumen sumber yang berupa inward manifest tidak
memiliki kepala, dan kepala CIPL bisa gagal terbaca — dokumen tetap sah sebagai wadah barang.

**Invariant** — footer "TTL: 40 PACKAGES" TIDAK disimpan di level dokumen: ia turunan
Σ `koli.jumlahTotal` seluruh entri (S.12: 21+2+2+4+2+9 = 40).

### `VersiCipl`

**Definisi**

```text
VersiCipl terdiri dari nomorVersi (Integer ≥ 1), diterimaPada (TanggalOnly atau kosong),
berkasSumber (referensi lampiran atau kosong), isi (CiplDocument), dan catatanRevisi
(Text atau kosong).
```

**Interpretasi** — dokumen CIPL sering direvisi (amandemen nilai, tambah koli, koreksi HS).
Setiap revisi adalah snapshot utuh yang tidak pernah ditimpa; dokumen aktif dipilih lewat
pointer ke satu versi. Menyelaraskan pola eksisting (`CiplVersion` items snapshot +
`activeVersionId`).

**Invariant** — versi immutable: koreksi = versi baru dengan `nomorVersi` bertambah; tepat
satu versi aktif per dokumen pada satu waktu.

## 4. Invariant lintas konsep

1. `namaTertera` wajib; `exhibitorId` opsional. Entri tanpa link master tetap sah —
   resolusi master adalah proses berjalan, bukan syarat validitas.
2. Warisan `KumpulanKoli`: `|rincian| ≤ jumlahTotal` per entri; `0` dan kosong dibedakan.
3. Selisih angka deklarasi vs turunan (Σ rincian vs `jumlahTotal`; `nilaiTotalDeklarasi`
   vs Σ `nilaiTotal` item) adalah **peringatan rekonsiliasi**, bukan kegagalan representasi
   maupun blokir simpan.
4. Satu `BarisBarang` milik tepat satu `EntriExhibitor` atau berada di
   `itemsBelumTerpetakan` — tidak dobel. `refKoli` boleh menunjuk koli entri mana pun
   dalam dokumen yang sama (dokumen konsol).
5. Versi `CiplDocument` immutable; revisi menghasilkan `VersiCipl` baru; tepat satu versi
   aktif.
6. `DisposisiBarang` dibaca per baris barang dari tanda dokumen; baris tanpa tanda adalah
   `TIDAK_DISEBUT`, tidak mewarisi dari entri di sekitarnya.

## 5. Fungsi turunan

```text
totalKoliEntri(entri) -> { jumlah, beratKg, volumeCbm }        // dari KumpulanKoli (doc manifest)
totalDokumen(doc) -> { entri, koli, beratKg, nilaiTotal }      // header blok manifest
rekonsiliasiTotals(doc) -> List<Peringatan>                    // deklarasi vs turunan; koli tak dirinci
usulanResolusiMaster(entri, masterExhibitors) -> exhibitorId | kosong   // fuzzy match namaTertera
sisaAlokasi(item, alokasiTercatat) -> { jumlah, satuan }       // kontrak rantai job doc I-3
```

## 6. Validasi contoh

| Skenario (S.12 / manifest) | Definition terkait | Dapat direpresentasikan? | Branch/template | Gap |
|---|---|---|---|---|
| 1 dokumen, 6 entri exhibitor, TTL 40 PACKAGES = Σ jumlahTotal | CiplDocument + EntriExhibitor | ✅ | aggregate | — |
| Item "INKJET PRINTER 13 SET" dengan dimensi koli "7-11" | BarisBarang + RefKoli rentang | ✅ | structure | — |
| "in package No. 22/24/30" (banyak item, satu koli) | RefKoli teks persis | ✅ | — | — |
| Booth gabungan `C3/M302`, rentang `D007-008` | EntriExhibitor hall+booth terpilah | ✅ | — | pemilahan jadi tugas ekstraksi |
| REMARKS A/B/C campur per baris | DisposisiBarang | ✅ | enumeration | — |
| TOTAL CIF AMOUNT `USD 34.466,29` vs Σ nilai item | nilaiTotalDeklarasi + rekonsiliasiTotals | ✅ | — | selisih = peringatan, bukan error |
| Berat GROSS dan NET per baris koli | Koli (doc manifest) — berat ganda | ⚠️ | — | Koli kini satu `beratKg`; butuh berat net → OQ-3 |
| Manifest S.12: koli 21/2/2/4/2/9 PKG tanpa dimensi; CIPL: rincian dimensi penuh | Dua dokumen, dua pandangan atas KumpulanKoli yang sama | ✅ | evidence saling melengkapi | konvergensi sumber → bagian 7 |
| Dokumen dengan barang campur tak terpilah per exhibitor | itemsBelumTerpetakan | ✅ | bucket | alokasi manual/LLM menyusul |
| CIPL per-exhibitor (praktik lama) | CiplDocument dengan satu entri | ✅ | aggregate | tidak ada asumsi multi di logic |
| Revisi dokumen (tambah koli, koreksi nilai) | VersiCipl immutable + pointer aktif | ✅ | snapshot | — |

## 7. Mapping teknis (ringkas) dan usulan slice berikutnya

**Rumah data CIPL eksisting** (evidence, bentuknya belum menyatu):

1. `domain/exhibition/types.ts` — `Cipl` (per-exhibitor: `eventExhibitorId` tunggal),
   `CiplVersion` (snapshot items), `CiplItem` (uraian/qty/nilai + `intendedDisposal` teks
   bebas + `grossWeightKg`/`netWeightKg` di level item); tabel jsonb `cipls`/`cipl_versions`.
2. `ExtractionResult` (`domain/exhibition/source-documents.ts`) — hasil ekstraksi invoice
   flat `JobInvoiceItem[]`, tidak berkelompok per exhibitor.
3. `CiplScanResult` (`/api/scan-cipl`) — entri exhibitor + koli, TANPA item.
4. `job.manifestExhibitors` — snapshot tampilan nama+logistik hasil wizard.
5. `job.operational.cipl` — mini-status (MISSING/REQUESTED/RECEIVED/VERIFIED).
6. Lampiran `JobDocumentKind 'CIPL'` pada job.

**Gap model vs kode:** dokumen multi-entri tidak terwakili (`Cipl` per-exhibitor); item tidak
menempel ke entri; `RefKoli` tidak ada; koli tidak punya berat net; disposisi masih teks bebas;
`CiplScanResult` dan `ExtractionResult` adalah dua setengah dari satu `CiplDocument`.

**Usulan slice (proposal — belum disetujui, tidak dieksekusi dalam dokumen ini):**

1. ✅ `domain/exhibition/cipl-document.ts` — tipe + Zod `CiplDocument`/`EntriExhibitor`/
   `BarisBarang`/`DisposisiBarang`/`RefKoli` + test terdaftar di script `domain:test`
   (`f1fa8d9`, ditambah `buildCiplDocument` assembler di `dd88b8e`).
2. ⬜ `koliSchema` + `beratNetKg` (gross/net berdampingan) di `domain/job/manifest.ts`.
3. ✅ `/api/scan-cipl` menghasilkan kepala dokumen + baris barang + `itemsBelumTerpetakan`
   selain baris exhibitor/koli (`dd88b8e`); wizard merakit `CiplDocument` saat Selesai dan
   menyimpannya sebagai `job.manifestCiplDocument` (berdampingan dengan
   `manifestExhibitors`, OQ-1 belum diputuskan). Kualitas ekstraksi multi-exhibitor
   (sel gabungan) masih terbatas pada provider default — iterasi prompt/model menyusul.
4. ⬜ `job.manifestExhibitors` menjadi view dari `CiplDocument`; snapshot job lama tetap tampil.
5. ⬜ Rantai alokasi (`ShipmentAllocation`/`JobAllocation` → `ciplItemId`) tetap merujuk ID
   baris barang — tidak berubah bentuknya.

## 8. Open questions

1. **`Cipl` per-exhibitor vs dokumen multi-entri** — tipe eksisting menautkan satu
   `eventExhibitorId`; dokumen nyata menaungi 6 exhibitor. Agregat baru menggantikan atau
   berdampingan? Bagaimana migrasi data lama?
2. **Berat di item vs di koli** — `CiplItem` eksisting membawa `grossWeightKg`/`netWeightKg`;
   dokumen nyata meletakkan berat pada baris koli. Bolehkah `BarisBarang` membawa salinan
   berat (kasus ekstraksi 1 item = 1 koli) atau dipisah mutlak?
3. **Berat net di Koli** — S.12 mencatat GROSS dan NET per koli (manifest klien hanya satu
   kolom Weight). Tambahan `beratNetKg` pada `Koli` (doc manifest) menunggu konfirmasi
   ketersediaan nilainya di dokumen lain.
4. **Info kontainer header** — `"1*40HC (OOCU8067803)"` tertulis gabungan di footer CIPL.
   Teks bebas, atau reuse `Kontainer`/`KonfigurasiMuatan` (doc manifest) yang kini menempel
   ke job, bukan ke dokumen?
5. **`DisposisiBarang` vs `intendedDisposal`** — field teks bebas eksisting pada `CiplItem`;
   enum baru perlu aturan migrasi nilai lama.
6. **Entri tanpa master selamanya** — bolehkah permanen (exhibitor one-off), atau wajib
   terlink sebelum barangnya dipakai dokumen BC?
7. **`manifestExhibitors` wizard** — penggantian bertahap oleh `CiplDocument`; job lama
   dengan snapshot lama tetap tampil lewat view (dedup nama sudah berjalan di
   `buildManifestView`).
8. **Bare case per koli** — kolom Bare Case ada di manifest klien, tiada di CIPL;
   `bareCaseCount` kini level `KumpulanKoli`. Perlu penanda bare per koli individual,
   atau cukup total? (menunggu contoh terisi.)
