# Data Definitions: Inti Job (Local vs International)

Model konseptual (information analysis ala *How to Design Programs*) untuk **aggregate Job**
sebagai pusat sistem VSS. Dokumen ini melengkapi
[`job-manifest-data-definitions.md`](./job-manifest-data-definitions.md) yang mendefinisikan
pengayaan manifest: di sini Job itu sendiri yang didefinisikan, termasuk perbedaan bentuk antara
jalur Local dan International. Ini bukan schema database; mapping teknis dibuat terpisah setelah
model konseptual stabil.

## 1. Tujuan dan batas model

**Keputusan/proses yang harus didukung program:**

- Memilih jalur saat pembuatan job: setelah event (dan venue) dipilih, user memilih Local atau
  International; spesifikasi jenis menyusul (keputusan alur 2026-10-15: hanya event + venue yang
  mendahului pilihan kind).
- Menentukan apa yang boleh dimiliki sebuah job: dokumen BC, manifest, kepulangan, agent —
  berbeda per jalur, dan jalur yang tidak relevan harus **tidak dapat direpresentasikan**.
- Mengelompokkan job pada halaman jobs/events (grup per jenis, urut jumlah terbanyak).
- Membedakan identitas internal sistem dari nomor referensi yang dipakai user sehari-hari.

**Sumber informasi:** `domain/job/types.ts`, `domain/agent/types.ts`,
`docs/domain/job-manifest-data-definitions.md`, `.kiro/requirements.md` §5.5–5.6
(catatan: model split Legacy/Customs Job di requirements sudah usang — diganti job unified),
keputusan refactor agent foundation 2026-10-15.

**In scope:** aggregate Job, DokumenBC, dan kardinalitas relasi ke Event / Agent / Exhibitor.
**Out of scope:** isi manifest dan kepulangan (→ dokumen manifest), CIPL/Shipment dan aturan
alokasi barang (dokumen tersendiri), ticket, algoritma penomoran teknis (`lib/job-number.ts`).

**Istilah ambigu:** "job" pada data lama (legacy, satu per exhibitor, tanpa `kind`) vs job unified
yang didefinisikan di sini. Dokumen ini mendefinisikan **target**; baris lama tanpa `kind` adalah
persoalan migrasi (bagian 6), bukan bagian dari model.

## 2. Peta konsep dan dependency

```text
Atomic / Enumeration
  JobId · NomorJob · StatusJob · JenisInternational · JenisDokumenBC
→ Structure dasar
  DokumenBC
→ Itemization
  Job = JobLocal | JobInternational
→ Aggregate (relasi ke entitas di luar dokumen ini)
  Job —(tepat satu)→ Event
  Job —(tepat satu)→ Exhibitor (klien)
  Job —(0..1, hanya International)→ Agent
  BagianInwardJob · KepulanganJob (doc manifest) — menempel hanya pada JobInternational
```

Tidak ada self-reference. Satu cross-reference dua arah dengan dokumen manifest: JobInternational
memuat BagianInwardJob/KepulanganJob; pemrosesan muatan didelegasikan ke template dokumen tersebut.

## 3. Data definition

### `JobId`

**Definisi**

```text
JobId adalah Text bertformat internal sistem (VSS-XXXX/X).
```

**Interpretasi** — identitas internal job; bertahan sepanjang hidup entitas meski semua atribut
berubah; tidak dipakai sebagai referensi komunikasi dengan user. Format teknis dan penomoran
urut dijamin oleh sistem, di luar model ini.

**Contoh** — `VSS-0123`. Invalid: `S.01/234YFN` (itu `NomorJob`, bukan identitas internal).

### `NomorJob`

**Definisi**

```text
NomorJob adalah Text, atau kosong.
```

**Interpretasi** — nomor referensi yang dipakai user dan dokumen klien untuk menyebut job
(politik penomoran S.01/A.02/234YFN pada inward manifest). **Bukan identitas**: boleh kosong saat
job dibuat, diisi/diubah kemudian, dan berasal dari dunia luar sehingga tidak dijamin unik oleh
sistem.

**Contoh** — `S.01`; `234YFN`; kosong (job baru dibuat dari UI). Invalid: dipakai sebagai primary
key penyimpanan.

### `StatusJob`

**Definisi**

```text
StatusJob adalah salah satu dari DRAFT, IN_PROGRESS, COMPLETED, ON_HOLD.
```

**Interpretasi** — keadaan pekerjaan: DRAFT belum dioperasikan; IN_PROGRESS sedang dikerjakan;
COMPLETED selesai secara operasional; ON_HOLD sementara berhenti dan bisa kembali ke IN_PROGRESS.
Status mati (cancel) dihapus dari produk 2026-10; penghapusan job bersifat hard delete oleh PIC.

**Contoh** — `DRAFT`; `ON_HOLD`. Open question: apakah diperlukan keadaan mati lain
(mis. dibatalkan klien) yang berbeda dari hard delete.

### `JenisInternational`

**Definisi**

```text
JenisInternational adalah salah satu dari TEMPORARY, ATA_CARNET, ROAD_SHIPMENT,
PERMANENT_IMPORT.
```

**Interpretasi** — sub-jenis job international pada event, menurut rezim kepabeanan
pengirimannya: TEMPORARY impor sementara untuk event (BC 2.3, barang wajib keluar kembali);
ATA_CARNET impor sementara dengan paspor barang ATA; ROAD_SHIPMENT pengangkutan
darat/pengalihan antar tempat (BC 2.7); PERMANENT_IMPORT barang dijual/dipakai tetap di
Indonesia (BC 3.0).

Keputusan domain expert 2026-10-24: nilai `VENUE` (lama) diganti nama menjadi `TEMPORARY`
(data lama dimigrasi), `TEMPORARY_EXPORT` (ekspor sementara barang Indonesia ke luar) dihapus
dari taksonomi. Job Local tidak butuh agent; SEMUA jenis boleh dengan atau tanpa agent
(biasanya dengan agent).

**Contoh** — `TEMPORARY`; `ATA_CARNET`.

**Open question:** ada indikasi beberapa jenis membawa data berbeda — ATA_CARNET
memiliki nomor carnet, TEMPORARY memiliki tenggat kepulangan. Jika terbukti, bentuk yang
benar adalah **itemization dengan structure per alternatif**, bukan enumeration (aturan: jangan
pakai enumeration jika tiap alternatif membawa data berbeda). Tentukan sebelum implementasi.

### `JenisDokumenBC`

**Definisi**

```text
JenisDokumenBC adalah salah satu dari BC_2_3, BC_2_5, BC_3_0, BC_2_7.
```

**Interpretasi** — jenis dokumen kepabeanan Indonesia yang dilayani: BC 2.3 impor sementara
(barang pameran); BC 2.5 re-ekspor; BC 3.0 impor permanen; BC 2.7 pengalihan barang antar
pengusaha TPB / antar dokumen manifest.

**Contoh** — `BC_2_3`; `BC_2_7`.

### `DokumenBC`

**Definisi**

```text
DokumenBC terdiri dari:
  jenis            : JenisDokumenBC
  nomorAju         : Text, atau kosong
  nomorRegistrasi  : Text, atau kosong
  tanggalRegistrasi: HariDateOnly, atau kosong
  lampiran         : daftar AttachmentId (boleh kosong)
```

**Interpretasi** — satu pengurusan dokumen BC milik sebuah job. Nomor AJU dibuat saat pengajuan;
nomor dan tanggal registrasi terbit saat DJBC menerima. Ketiga nomor/tanggal boleh kosong karena
dokumen sering dibuat (draft) jauh sebelum diajukan. Lampiran diakses by-ID sesuai arsitektur
attachment; file fisik bukan bagian model.

**Contoh** — BC 2.3 dengan nomorAju `001234`, registrasi kosong (belum diajukan); BC 2.7 lengkap
dengan registrasi dan 1 lampiran. Boundary: semua field kosong kecuali jenis (draft murni).

**Template pemrosesan**

```text
prosesDokumenBC(d):
  gunakan d.jenis untuk memilih alur kepabeanan
  jika d.nomorRegistrasi ada → dokumen sudah terdaftar (cabang terbit)
  untuk tiap lampiran → akses via AttachmentId
```

**Invariant** — dalam satu job, tidak ada dua DokumenBC dengan jenis sama yang keduanya sudah
memiliki nomor registrasi (lihat open question revisi).

**Open question (besar):** di requirements lama, status (SUBMITTED → REGISTERED → RELEASED …)
melekat pada "Customs Job". Model unified belum memutuskan: status proses kepabeanan milik
*DokumenBC* atau milik *JobInternational*? Keputusan ini menentukan lifecycle dan UI fase
dokumen. Ditandai **belum diselesaikan**.

### `Job` (itemization inti)

**Definisi**

```text
Job adalah salah satu dari:

JobLocal
  event : EventId
  agent : AgentId, atau kosong
  pic   : UserId, atau kosong
  status: StatusJob

JobInternational
  event     : EventId
  agent     : AgentId, atau kosong
  jenis     : JenisInternational
  dokumenBc : daftar DokumenBC (boleh kosong)
  manifest  : BagianInwardJob, atau kosong
  kepulangan: KepulanganJob, atau kosong
  pic       : UserId, atau kosong
  status    : StatusJob
```

**Interpretasi** — JobLocal adalah pekerjaan logistik **tanpa** dokumen kepabeanan (angkutan
lokal, venue-ke-venue) sehingga **tidak memiliki dan tidak dapat memiliki** dokumen BC;
JobInternational adalah pekerjaan lintas negara melalui jalur kepabeanan. Agent opsional pada
kedua varian (keputusan domain expert 2026-10-24): JobLocal tidak membutuhkannya, JobInternational
biasanya memakainya; jika ada, agent adalah pemilik dokumen sumber (CIPL, B/L,
AWB) sementara job adalah pemilik dokumen proses (BC).

Agent menurut domain expert (2026-10-24) adalah **pihak yang mengatur pengiriman barang dari
luar negeri ke Indonesia**. Bila exhibitor mengatur sendiri pengirimannya, job dibuat TANPA
agent — exhibitor itu sekaligus pengatur pengiriman dan pemilik barang, dan peserta job
adalah dirinya sendiri (satu).

Job adalah dokumen LEGAL pengangkutan: nama pada B/L atau AWB tepat satu (biasanya agent).
Exhibitor yang dilayani sebuah job bisa LEBIH DARI SATU — konsep **MENUMPANG** (keputusan domain
expert 2026-10-24): beberapa exhibitor menitipkan barangnya dalam satu pengiriman yang sama,
TERMASUK pada job tanpa agent. Relasi ini PENGETAHUAN INTERNAL, bukan bagian dokumen legal:
rincian barang tiap exhibitor terjabar di CIPL masing-masing — bukan di job.

Arah model (disepakati 2026-10-24, belum diimplementasi penuh):
`pengaturPengiriman` = AGENT (agentId) | EXHIBITOR (exhibitorId yang mengatur sendiri, opsi a)
| kosong; `peserta` = daftar ExhibitorId yang dilekatkan eksplisit. Untuk job dengan agent,
peserta terisi DEFAULT dari exhibitor binaan agent pada event yang sama (derivasi agent —
saat ini satu-satunya mekanisme, via `buildManifestView`); untuk job tanpa agent, peserta
diisi manual dan pengaturnya disarankan dari kecocokan nama shipper B/L (nama adalah BUKTI
yang menyarankan, ID hasil konfirmasi adalah TAUTAN — nama bebas dokumen legal tidak
dipakai sebagai relasi data). Manifest dan kepulangan hanya menempel pada jalur
international (definisi di dokumen manifest). PIC opsional sampai ditetapkan;
pemilik event adalah PIC default koordinasi.

**Contoh (semua varian dan boundary):**

1. JobLocal — event JIE-2026, agent kosong, pic kosong, status DRAFT.
2. JobInternational dengan agent — event JIE-2026, agent ALLPACK (nama legal di B/L),
   jenis TEMPORARY, dokumenBc `[BC_2_3 terdaftar]`, manifest terisi, kepulangan kosong;
   pesertanya (menumpang): 3 exhibitor binaan ALLPACK pada event itu.
3. JobInternational tanpa agent (exhibitor bertindak sendiri) — jenis PERMANENT_IMPORT,
   dokumenBc kosong (boundary: baru dibuat, belum diajukan).
4. JobInternational ROAD_SHIPMENT dengan dokumen BC 2.7 dan kepulangan terisi.

Invalid (tidak dapat dibentuk dari definisi — inilah tujuannya):

- JobLocal dengan dokumen BC → tidak ada field untuk itu pada varian Local.
- Tautan peserta berbasis KESAMAAN NAMA shipper B/L → nama hanya saran; tautan
  harus ID hasil konfirmasi pengguna.
- Job tanpa kind ("Job lama" pada data sekarang) → definisi memaksa tepat satu varian.
- JobInternational tanpa klien → kedua varian mewajibkan klien.

**Template pemrosesan**

```text
prosesJob(job):
  JobLocal        → layanan lokal: tanyakan status, pic; tidak ada cabang BC/agent/manifest
  JobInternational→ cabang menurut jenis;
                    proses tiap dokumenBc dengan template DokumenBC;
                    jika manifest ada → delegasi ke template BagianInwardJob (doc manifest);
                    jika kepulangan ada → delegasi ke template KepulanganJob
```

Jika nanti implementasi penuh `if (kind === 'LOCAL' && job.agent)` atau pengecekan
"job tanpa jenis", itu tanda model penyimpanan bocor mengizinkan keadaan yang definisi ini
tolak — perbaiki mapping, bukan tambahi flag.

## 4. Invariant lintas konsep

- **I-1:** Job hanya dibuat pada Event berstatus aktif; event adalah konteks wajib pertama.
- **I-2:** Jika `agent` ada, agent tersebut terdaftar sebagai peserta event yang sama
  (relasi EventAgent ada).
- **I-3:** Barang yang dirujuk manifest JobInternational bersumber dari CIPL milik agent — atau
  milik klien bila agent kosong; total alokasi tidak melebihi quantity sumber (melanjutkan aturan
  B-2 requirements).
- **I-4:** JobId unik di seluruh sistem; NomorJob tidak dijamin unik (referensi eksternal).
- **I-5 (proposal):** penghapusan job (hard delete) hanya oleh PIC event atau admin; job tidak
  punya status mati — penghapusan adalah satu-satunya keluar.

## 5. Fungsi turunan (signature, tanpa implementasi)

```text
dokumenBcUmum : JenisInternational -> Daftar JenisDokumenBC
  // PROPOSAL (evidence: pola inward manifest): PERMANENT_IMPORT → [BC_3_0];
  // TEMPORARY → [BC_2_3, BC_2_5]; ROAD_SHIPMENT → [BC_2_7].
  // Bukan aturan mutlak — user tetap dapat menambah/mengurangi per job.

bisaDihapus : Job -> Bool
  // purpose: mengecek I-5 (pelaku) sebelum hard delete.

ringkasanMuatan : JobInternational -> RingkasanMuatan
  // purpose: total koli/berat/CBM; delegasi penuh ke template dokumen manifest.

grupTampilan : Job -> GrupJob
  // purpose: pengelompokan halaman jobs — JobLocal satu grup; JobInternational per jenis.
```

## 6. Validasi contoh dan migrasi

| Skenario | Definisi terkait | Dapat direpresentasikan? | Branch/template | Catatan |
|---|---|---:|---|---|
| Job lokal murni | JobLocal | ya | cabang Local | tanpa agent/BC sejak lahir |
| Job international + agent | JobInternational | ya | cabang International + agent | kasus ALLPACK |
| Exhibitor jadi agent sendiri | JobInternational (agent kosong) | ya | cabang International tanpa agent | tidak perlu "agent palsu" |
| Draft tanpa dokumen BC | JobInternational (daftar kosong) | ya | daftar kosong | boundary kardinalitas |
| Local + dokumen BC | — | **tidak** | — | mustahil by construction |
| Job tanpa kind (data lama) | — | **tidak** | — | persoalan migrasi, lihat bawah |
| Dokumen BC revisi nomor | DokumenBC | ? | — | open question revisi |

**Migrasi (di luar model, dicatat agar tidak hilang):** baris job lama tanpa `kind` harus
diputuskan: (a) backfill menjadi JobLocal/JobInternational berdasarkan bukti, atau
(b) diberi label grup "Job lama" di UI sambil menunggu backfill manual. Model target tidak
mengizinkan keadaan ketiga ini.

## 7. Open questions (ringkasan untuk domain expert)

1. **Status kepabeanan** menempel pada DokumenBC atau JobInternational? (konflik requirements
   lama vs model unified — keputusan terbesar yang tersisa.)
2. **JenisInternational → itemization?** ATA_CARNET (nomor carnet) dan TEMPORARY
   (tenggat kepulangan) berindikasi membawa data sendiri.
3. **Titik taut peserta (TERJAWAB 2026-10-24)** — tautan peserta adalah pilihan EKSPLISIT
   (ID): `pengaturPengiriman` (agent / exhibitor yang mengatur sendiri) + daftar `peserta`
   yang dilekatkan manual. Job tanpa agent boleh berpeserta lebih dari satu. Nama shipper
   pada B/L hanya SARAN pengisi awal (bukti), bukan relasi data — nama bebas dokumen legal
   terlalu rapuh untuk jadi tautan. Implementasi bertahap: derivasi agent tetap dipakai
   sebagai pengisian default sampai relasi eksplisit mendarat.
4. **Billing** (requirements J-11: NOT_READY … PAID dengan nominal/invoice) — masuk model job
   yang baru atau menjadi konsep terpisah?
5. **Revisi DokumenBC**: nomor registrasi salah terbit — dokumen baru atau mutasi field?
6. **NomorJob**: siapa yang menetapkan (manifes klien vs sistem) dan apakah perlu keunikan
   per event?
