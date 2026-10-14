# Data Definitions: Job Pameran ala Inward Manifest

Model konseptual (information analysis ala *How to Design Programs*) untuk menampilkan job
sesuai dokumen klien **INWARD MANIFEST ALLPACK** (`/home/aa/Downloads/INWARD MANIFEST ALLPACK.pdf|xlsx`,
event JIEXPO Kemayoran 20–23 Okt 2026). Dokumen ini bukan schema database; mapping teknis ke
TypeScript/Supabase ada di bagian 7.

## 1. Tujuan dan batas model

**Keputusan/proses yang harus didukung program:**

- Menampilkan setiap job seperti blok manifest: agent + dokumen angkut + konfigurasi muatan +
  daftar exhibitor binaan (hall/booth/koli) + milestone operasional + catatan.
- Menjawab: berapa total koli/berat/CBM per job dan per event; job mana yang belum SPPB /
  belum masuk bonded; exhibitor mana yang barangnya anomali; job mana yang perlu BC 2.7.
- Merekam fase kepulangan (return list container & LCL): modus, tujuan, shipping line,
  booking, vessel, ETD/ETA.

**Sumber informasi:** inward manifest ALLPACK (ground truth), sistem eksisting
(Agent, Exhibitor per event, Job `kind: LOCAL | INTERNATIONAL`, `JobOperationalDetails`).

**In scope:** pengayaan job international dan exhibitor kepesertaan, inward + kepulangan.
**Out of scope (dulu):** General Cargo & Project, estimasi kontainer per negara (sheet terakhir),
penomoran S./A. vs `VSS-####` (lihat open questions).

**Istilah ambigu:** lihat open questions per definisi dan bagian 8.

## 2. Peta konsep dan dependency

```text
Atomic/Enumeration
  NomorDokumen · TanggalTanggal(HariDateOnly) · UkuranKontainer · JenisDokumenAngkut ·
  JenisMilestone · JenisCatatan
→ Structure dasar
  Kontainer · DimensiKoli · Koli · Milestone · CatatanOperasional
→ Itemization
  DokumenAngkut · KonfigurasiMuatan · KumpulanKoli · ModusKepulangan
→ Aggregate (menempel ke entitas eksisting)
  LogistikExhibitor (→ Exhibitor) · BagianInwardJob (→ Job international) · KepulanganJob (→ Job)
```

Tidak ada self-reference. `Job` eksisting tetap satu entitas dengan `kind: LOCAL | INTERNATIONAL`.

## 3. Data definition

### `UkuranKontainer`

**Definisi**

```text
UkuranKontainer adalah salah satu dari K20, K40, atau K40HQ.
```

**Interpretasi** — ukuran/tipe unit kontainer pada blok header manifest (`1X20'`, `1x40'`,
`1X40'HQ`). `K40HQ` dibedakan dari `K40` karena high-cube memengaruhi kapasitas volume.

**Contoh** — `K20`; `K40HQ`. Invalid: `"1x20' + 1x40'"` (itu kombinasi, bukan satu ukuran —
direpresentasikan sebagai dua `Kontainer` dalam satu `KonfigurasiMuatan` FCL).

### `Kontainer`

**Definisi**

```text
Kontainer terdiri dari nomor (Text atau kosong), ukuran (UkuranKontainer), dan seal (Text atau kosong).
```

**Interpretasi** — satu unit kontainer fisik yang membawa barang job. Nomor kontainer
(contoh `COAU6464738840` pada blok S.12) sering hanya muncul di return list; saat inward
belum diketahui, nomor boleh kosong. Seal adalah nomor segel; manifest tidak selalu mencatatnya.

**Invariant** — nomor kosong tidak boleh duplikat di dalam satu daftar kontainer yang sama.

### `JenisDokumenAngkut` dan `DokumenAngkut`

**Definisi**

```text
JenisDokumenAngkut adalah salah satu dari BL atau AWB.
DokumenAngkut adalah salah satu dari:
- BL(nomor: NomorDokumenAngkut)
- AWB(nomor: NomorDokumenAngkut)
```

**Interpretasi** — dokumen transport yang menaungi seluruh blok: B/L untuk laut
(contoh `SHFPSJKT26026454`, `EGLV147601474418`), AWB untuk udara (contoh `YMJAI237131110`,
`AMIGL260427704A`). Prefix `S.`/`A.` pada nomor baris manifest mengikuti jenis ini.
Itemization dipilih (bukan dua field nullable) karena tepat satu dokumen menaungi satu job —
pasangan `blNumber`/`awbNumber` lama menerima keadaan mustahil "dua-duanya terisi".

**Template** — dua branch: BL → proses sebagai dokumen laut; AWB → proses sebagai dokumen udara.

### `KonfigurasiMuatan`

**Definisi**

```text
KonfigurasiMuatan adalah salah satu dari:
- LCL
- FCL(daftar tidak kosong dari Kontainer)
```

**Interpretasi** — cara barang diangkut: `LCL` (konsolidasi, blok tidak memiliki kontainer
sendiri, contoh S.01/S.05/S.11) atau `FCL` dengan satu-atau-lebih kontainer penuh
(S.08 `1X40'`, S.09 `1x20' + 1x40'` = FCL dua kontainer berbeda ukuran).

**Invariant** — FCL minimal satu kontainer. Konfigurasi tidak menyimpan total koli/berat/CBM;
itu turunan koli.

### `DimensiKoli` dan `Koli`

**Definisi**

```text
DimensiKoli terdiri dari panjangCm, lebarCm, tinggiCm (Number ≥ 0).
Koli terdiri dari label (Text atau kosong), dimensi (DimensiKoli atau kosong),
volumeCbm (Number ≥ 0 atau kosong), dan beratKg (Number ≥ 0 atau kosong).
```

**Interpretasi** — satu koli/kepak-an barang (kolom `CASE`, `Dimension L/W/H`, `CBM`,
`Weight Kgs`). Label meniru sebutan manifest (`PKG 1`, `PK 2`). Ketiga nilai pengukuran
boleh kosong: blok S.12 mencatat `0.00` untuk semua dimensi, dan blok S.07 (36 PKG) tidak
merinci sama sekali. `0` dan kosong dibedakan: `0` berarti tercatat nol, kosong berarti
belum dirinci.

**Contoh** — `Koli("PKG 1", DimensiKoli(205,130,195), 5.20, 1100)` (S.08 PKG 1);
`Koli(null, null, null, null)` hanya sebagai anggota rincian yang datanya menyusul.

### `KumpulanKoli`

**Definisi**

```text
KumpulanKoli terdiri dari jumlahTotal (Integer ≥ 0) dan rincian (List<Koli>).
```

**Interpretasi** — seluruh koli milik satu exhibitor pada satu job. Manifest sering
hanya mencatat total (S.12: `40 PKG` tanpa rincian) atau merinci sebagian
(S.08 Wenzhou: `8 PKG`, rincian `PKG 1`, `PKG 2`, `PKG 3-8`).

**Invariant** — `|rincian| ≤ jumlahTotal`. Total berat/volume job = penjumlahan rincian yang ada.

### `JenisMilestone` dan `Milestone`

**Definisi**

```text
JenisMilestone adalah salah satu dari ETA, SKEP, SPPB, STRIPPING_SELESAI, MASUK_BONDED,
BAHANDLE_SELESAI, PERIKSA_SELESAI, atau DO_READY.
Milestone terdiri dari jenis (JenisMilestone), tanggal (TanggalOnly), dan nomorSurat
(Text atau kosong).
```

**Interpretasi** — satu_checkpoint operasional pada kolom Remark blok: kedatangan (`ETA:
28/09/2026`), surat keputusan fasilitas (`Skep: S-622/WBC.08/2026` — satu-satunya jenis yang
diamati membawa nomor surat), persetujuan pengeluaran barang (`SPPB`), progres fisik
(selesai stripping, masuk bonded, selesai bahandle/bahandel, selesai periksa), dan kesiapan
D/O (`DO ready senin tgl.05.10` pada S.15). `nomorSurat` hanya bermakna untuk SKEP/SPPB —
invariant dokumentatif, tidak dipaksakan tipe.

**Invariant** — satu jenis boleh muncul paling sekali per job (manifest mencatat satu nilai
per jenis); tidak ada aturan urutan penyimpanan — ejaan/kapan tercatat bervariasi.

### `JenisCatatan` dan `CatatanOperasional`

**Definisi**

```text
JenisCatatan adalah salah satu dari ANOMALI_BARANG, PENAHANAN, atau LAINNYA.
CatatanOperasional terdiri dari jenis (JenisCatatan) dan isi (Text).
```

**Interpretasi** — remark bebas yang bukan milestone: `ANOMALI_BARANG` untuk kondisi barang
menyimpang ("Ada barang anomali 1 carton", S.12 Wonclean), `PENAHANAN` untuk penahanan
proses ("Hold until Interfood" S.20, "DO ready …" sifatnya blokir keluar), `LAINNYA` untuk
sisanya termasuk rujukan dokumen pengalihan ("BC.27 TO NICE KRISTA INTERFOOD", S.03).

**Template** — tiga branch; PENAHANAN dan ANOMALI_BARANG memengaruhi penanda warning di UI.

### `LogistikExhibitor`

**Definisi**

```text
LogistikExhibitor terdiri dari hall (Text atau kosong), booth (Text atau kosong),
koli (KumpulanKoli), dan catatan (List<CatatanOperasional>).
```

**Interpretasi** — data fisik kepesertaan satu exhibitor dalam event/job inwardnya:
kolom `Hall` (`B1`, `C3`, `D2`), `Booth No` (`D035`, `D007-008` — rentang dibiarkan teks),
koli yang dibawa, dan catatan level exhibitor. Menempel ke `Exhibitor` (entitas per event)
karena satu exhibitor dengan satu agent hanya masuk satu job inward.

**Contoh invalid** — koli dengan `jumlahTotal = 2` tetapi rincian 3 baris (melanggar
invariant KumpulanKoli).

### `BagianInwardJob`

**Definisi**

```text
BagianInwardJob terdiri dari dokumenAngkut (DokumenAngkut), konfigurasiMuatan
(KonfigurasiMuatan), milestones (List<Milestone>), dan catatan (List<CatatanOperasional>).
```

**Interpretasi** — seluruh isi blok manifest level job. Menempel ke `Job` dengan
`kind: INTERNATIONAL`; fase inisiasi boleh menyimpan job tanpa BagianInwardJob (dokumen
menyusul), sehingga bagian ini opsional pada Job.

**Invariant** — hanya sah untuk job INTERNATIONAL (LOCAL tidak punya dokumen kepabeanan).
Total PKG/KGM/CBM pada header blok TIDAK disimpan — selalu turunan.

### `ModusKepulangan` dan `KepulanganJob`

**Definisi**

```text
ModusKepulangan adalah salah satu dari:
- KONTAINER_PENUH(daftar tidak kosong dari Kontainer)
- LCL(jumlahKoli: Integer ≥ 0)
KepulanganJob terdiri dari modus (ModusKepulangan), tujuan (Text atau kosong),
shippingLine (Text atau kosong), bookingNumber (Text atau kosong), vessel (Text atau kosong),
etd (TanggalOnly atau kosong), eta (TanggalOnly atau kosong), dan catatan (List<CatatanOperasional>).
```

**Interpretasi** — fase pengembalian setelah event, dari *Return List Container* (per job:
jumlah paket, jumlah kontainer per ukuran, tujuan, shipping line, booking, vessel, ETD/ETA,
note "Hold until Interfood") dan *Return List LCL* (per grup agent(exhibitor): jumlah paket,
tujuan). Tujuan adalah pelabuhan/negara asal tujuan (Shanghai, Shekou, Qingdao, Bangkok,
Kaohsiung, Nhavasheva).

**Open question** — return LCL pada manifest dikelompokkan per agent(exhibitor)
("Bobon (Wuhu Churui)"); model menempelkannya pada job (agent). Jika satu LCL job ternyata
perlu tujuan berbeda per exhibitor, naikkan `tujuan` ke level rincian — menunggu kebutuhan nyata.

## 4. Invariant lintas konsep

1. `BagianInwardJob` hanya boleh ada pada Job `INTERNATIONAL` dengan `agentId` terisi.
2. Exhibitor pembawa `LogistikExhibitor` pada job international adalah exhibitor event yang
   sama dengan `agentId = job.agentId` (kepesertaan diturunkan, tidak diduplikasi).
3. `KumpulanKoli.rincian` tidak melebihi `jumlahTotal`; koli job = gabungan koli pesertanya.
4. Kontainer pada `KonfigurasiMuatan` FCL dan `ModusKepulangan` KONTAINER_PENUH milik job yang
   sama boleh berbeda (kontainer balik tidak harus kontainer datang).
5. Milestone `DO_READY`/`PENAHANAN` adalah status blokir; UI memperlihatkan sebagai peringatan.

## 5. Fungsi atau pertanyaan turunan

```text
totalKoliJob(job, peserta) -> { jumlah, beratKg, volumeCbm }   // turunan utk header blok
milestone(job, jenis) -> Milestone | kosong                     // strip milestone & penanda belum SPPB
pesertaJob(job, exhibitors) -> List<(Exhibitor, LogistikExhibitor | kosong)>
butuhPerhatian(job) -> List<Penanda>                            // anomali, penahanan, BC 2.7
renderBlokManifest(job, peserta) -> struktur tampilan blok      // view assembler murni
```

## 6. Validasi contoh

| Skenario (manifest) | Definition terkait | Dapat direpresentasikan? | Branch/template | Gap |
|---|---|---|---|---|
| S.01 LCL, 1 exhibitor, 3 koli, Skep `S-622/WBC.08/2026` | LCL, KumpulanKoli penuh, Milestone SKEP bernomor | ✅ | itemization LCL; structure | — |
| S.08 FCL 1x40', 4 exhibitor, koli parsial (17 PKG, 7 dirinci) | FCL([K40]), KumpulanKoli parsial | ✅ | invariant \|rincian| ≤ total | — |
| S.12 koli tanpa dimensi + anomali per exhibitor | Koli nilai kosong, Catatan ANOMALI_BARANG | ✅ | structure nullable | — |
| S.20 "DO Ready senin tgl.05/10/2026" | Milestone DO_READY / Catatan PENAHANAN | ✅ (pilih Milestone bila bertanggal, catatan bila kalimat) | — | ejaan tak konsisten → aturan: ada tanggal = Milestone |
| S.03 "BC.27 TO NICE KRISTA INTERFOOD" | Catatan LAINNYA + dokumen BC_2_7 pada operational | ✅ | — | status/nomor BC 2.7 belum dicatat terstruktur |
| S.09 `1x20' + 1x40'` | FCL dua kontainer beda ukuran | ✅ | itemization | — |
| A.01 AWB + hall D2 | AWB(nomor), LogistikExhibitor | ✅ | itemization BL/AWB | — |
| Return list: S.16 balik `1x20' + 1x40'` ke 2 tujuan | KepulanganJob KONTAINER_PENUH | ✅ satu job satu tujuan | — | multi-tujuan per job: open question LCL |
| Return LCL "Big Logistic (Adam) 3 Pkg → Nhavasheva" | KepulanganJob LCL(3) | ✅ | — | — |

## 7. Mapping teknis (ringkas)

- Semua field baru masuk `payload` jsonb eksisting: `jobs.payload.inward`, `jobs.payload.kepulangan`,
  `exhibitors.payload.logistics` — **tanpa migration SQL baru**.
- TypeScript: `domain/job/manifest.ts` (types + Zod + label Indonesia); `LocalJob.inward/kepulangan`,
  `LocalExhibitor.logistics` pada data-client.
- View assembler murni `buildManifestView(job, exhibitors)` untuk UI; parser manifest
  (`/api/parse-manifest`) menghasilkan struktur yang sama via Gemini.

## 8. Open questions

1. **Bare Case** — kolom antara "Total Package" dan "CASE" (S.08: total 17 PKG, "Bare" 7 PKG).
   Arti pasti (koli tanpa kemasan kayu?) belum dikonfirmasi klien; belum dimodelkan.
2. **EMPTY STORAGE** — header kolom, semua contoh kosong. Kemungkinan kontainer kosong
   yang dititipkan; menunggu contoh terisi.
3. **RE-EXPORT** — kolom kosong di semua sampel; diduga tercakup oleh
   `internationalJenis: TEMPORARY_EXPORT` / ATA_CARNET. Tidak dimodelkan terpisah dulu.
4. **Penomoran `S.01`/`A.01`** — nomor baris manifest (S=laut, A=udara, sekuens per event).
   Belum diputuskan: disimpan sebagai field job atau hanya urutan tampil. `VSS-####` tetap
   nomor job internal.
5. **BC 2.7** — masuk set dokumen BC operasional (applicable default tidak); status/nopen-nya
   mengikuti `JobCustomsDocument` eksisting.
