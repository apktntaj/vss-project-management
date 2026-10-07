# Kontrak Integrasi CEISA 4.0

Dokumen ini adalah kontrak integrasi internal VSS untuk CEISA 4.0. Dokumen ini menormalkan sumber resmi yang tidak selalu konsisten, menentukan keputusan implementasi, dan mencatat hal yang masih harus dibuktikan melalui lingkungan Host-to-Host (H2H).

- Status: `provisional`
- Terakhir diverifikasi: 2026-10-06 12:41:37 WIB
- Cakupan awal: BC 2.3, BC 2.5, BC 3.0, pengiriman dokumen, status/respons, dan referensi pelabuhan/TPS
- Bukan keputusan resmi DJBC dan bukan pengganti konfirmasi kepada PPJK penanggung jawab, kantor pabean, atau DJBC

Status berubah menjadi `ready for operational review` setelah kontrak autentikasi, bentuk respons endpoint utama, dan perilaku submit/status dibuktikan di sandbox atau lingkungan uji H2H.

## Tujuan

Kontrak ini digunakan untuk:

- mencegah aplikasi bergantung langsung pada dokumentasi vendor yang tidak konsisten;
- memisahkan model domain VSS dari bentuk payload dan autentikasi CEISA;
- menjaga keterlacakan sumber, versi schema, respons, dan keputusan normalisasi;
- menjadi dasar adapter CEISA, validasi payload, sinkronisasi referensi, serta pemetaan lifecycle `CustomsJob`;
- mencatat ketidakpastian yang tidak boleh diisi dengan asumsi implementasi.

Kontrak ini tidak menyimpan API key, token, password, client secret, NITKU, NPWP, atau payload produksi.

## Sumber dan aturan prioritas

### Sumber aktif

| Kegunaan                 | Sumber                                                                                                            | Catatan                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Portal utama             | [CEISA OpenAPI Portal](https://openapi.beacukai.go.id/portal/)                                                    | Katalog dokumentasi publik saat ini                                     |
| Base URL dan security    | [OpenAPI 3 layanan H2H](https://openapi.beacukai.go.id/portal/rest/v1/files/88c8fd81-1f65-4f33-8a7c-313983abfb11) | Menetapkan server produksi `https://apis-gw.beacukai.go.id/v2/openapi`  |
| Katalog endpoint         | [Swagger layanan H2H](https://openapi.beacukai.go.id/portal/rest/v1/files/b5a4314c-02dd-489f-ab32-d4834cf63270)   | Identik dengan `docs/openapi_swagger.json` pada tanggal verifikasi      |
| Autentikasi              | [Panduan autentikasi CEISA](https://openapi.beacukai.go.id/portal/pages/authentication)                           | Menyatakan OAuth 2.0 dan API Key untuk H2H                              |
| Referensi kode           | [Reference CEISA](https://openapi.beacukai.go.id/portal/pages/reference)                                          | Tabel kode publik, termasuk kantor, negara, valuta, status, dan respons |
| Schema BC 2.3            | [Schema BC 2.3](https://openapi.beacukai.go.id/portal/pages/schema%20bc%202.3)                                    | Portal menyatakan v0.8                                                  |
| Schema BC 2.5            | [Schema BC 2.5](https://openapi.beacukai.go.id/portal/pages/schema%20bc%202.5)                                    | Portal menyatakan v0.15                                                 |
| Schema BC 3.0            | [Schema BC 3.0](https://openapi.beacukai.go.id/portal/pages/schema%20bc%203.0)                                    | Portal menyatakan v0.5.29                                               |
| Arsip historis           | `CEISA40_ARCHIVE.md`                                                                                              | Snapshot 249 halaman; batas snapshot `20260124114542`                   |
| Export autentikasi lokal | `docs/Export_openapi-auth_prod.json`                                                                              | OpenAPI 3 untuk layanan autentikasi produksi                            |

Checksum artefak lokal saat verifikasi:

```text
aa2d35c7ea1eb293148b8519af20ba647c4c6fb1ab2aa37aff6478306a7f5fc4  docs/openapi_swagger.json
6383212870afaf0722a61120b8a62dadc07a171c17ab3884f1f824b8256827f9  docs/Export_openapi-auth_prod.json
```

Swagger publik dan `docs/openapi_swagger.json` identik byte-for-byte pada tanggal verifikasi.

### Prioritas menurut jenis kontrak

Tidak ada satu urutan sumber yang benar untuk seluruh kebutuhan. Gunakan prioritas berikut:

| Jenis kontrak                | Sumber utama                    | Fallback/pembanding                              |
| ---------------------------- | ------------------------------- | ------------------------------------------------ |
| Request dokumen              | JSON Schema portal aktif        | Arsip untuk histori dan diff                     |
| Base URL dan header keamanan | OpenAPI 3 aktif                 | Panduan autentikasi dan export autentikasi lokal |
| Daftar endpoint              | Swagger/OpenAPI aktif           | Arsip historis                                   |
| Bentuk response aktual       | Capture sandbox yang disanitasi | Dokumentasi endpoint                             |
| Kode referensi dan respons   | Reference portal                | Capture API referensi                            |
| Makna operasional            | Keputusan domain VSS            | Respons mentah CEISA sebagai evidence            |

Aturan:

1. Nomor versi tidak mengalahkan isi schema. Selalu lakukan diff struktural.
2. Contoh payload tidak menjadi kontrak jika bertentangan dengan schema.
3. Respons sandbox tidak boleh langsung merembes ke domain; adapter harus menormalkannya.
4. Arsip digunakan untuk histori, bukan sebagai bukti bahwa kontrak lama masih aktif.
5. Kontradiksi yang dapat mengubah hasil customs harus ditandai `requires authority confirmation`.

## Topologi layanan

### API operasional

```text
https://apis-gw.beacukai.go.id/v2/openapi
```

Hostname internal yang tercantum pada Swagger berikut tidak boleh digunakan oleh aplikasi:

```text
new-apigpub03:5555
```

### API autentikasi

Export autentikasi lokal menetapkan:

```text
https://apis-gw.beacukai.go.id/v1/openapi-auth
```

Path yang tersedia dalam export tersebut:

```http
POST /user/login
POST /user/update-token
```

Arsip historis menggunakan path lama:

```http
POST /nle-oauth/v1/user/login
POST /nle-oauth/v1/user/update-token
```

Keputusan: implementasi baru tidak boleh memakai path `/nle-oauth/...` tanpa bukti lingkungan aktif. Perbedaan antara API `openapi-auth` dan OAuth gateway generik harus dibuktikan di sandbox; jangan menganggap keduanya interchangeable.

## Autentikasi dan rahasia

Panduan portal dan OpenAPI aktif mewajibkan OAuth 2.0 serta API key untuk integrasi H2H. Header kanonis:

```http
Authorization: Bearer <access-token>
beacukai-api-key: <api-key>
Content-Type: application/json
```

Nama header tidak case-sensitive menurut HTTP. Aplikasi tetap menggunakan ejaan `beacukai-api-key` agar konsisten dengan OpenAPI aktif.

Konfigurasi aplikasi yang direncanakan:

```text
CEISA_BASE_URL
CEISA_AUTH_BASE_URL
CEISA_API_KEY
CEISA_CLIENT_ID atau CEISA_USERNAME
CEISA_CLIENT_SECRET atau CEISA_PASSWORD
CEISA_ID_PLATFORM (hanya bila diwajibkan hasil onboarding)
```

Ketentuan:

- seluruh nilai rahasia berada di secret store atau environment runtime;
- rahasia tidak boleh disimpan dalam repository, log, screenshot, fixture, atau dokumen ini;
- log hanya boleh menyimpan fingerprint non-reversible bila perlu untuk diagnosis;
- `id_platform` dan `Origin` muncul pada arsip H2H, tetapi kewajibannya untuk integrasi ini masih `requires authority confirmation`;
- arsip menyatakan access token berlaku 5 menit dan refresh token dapat digunakan dalam 24 jam sejak access token terbit; angka ini belum menjadi kontrak aplikasi sampai dibuktikan di lingkungan aktif;
- satu kegagalan autentikasi tidak boleh otomatis mengubah status customs job.

## Endpoint dalam cakupan awal

Semua path berikut relatif terhadap base URL API operasional.

| Kemampuan              | Operasi                                                       | Keputusan penggunaan                                                                 |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Validasi payload       | `POST /document/check`                                        | Jalankan sebelum submit jika endpoint tersedia di lingkungan target                  |
| Simpan/kirim dokumen   | `POST /document`                                              | Gunakan `isFinal`; `false` berarti draft dan merupakan default menurut OpenAPI       |
| Kirim perbaikan        | `POST /document?isRevision=true`                              | Hanya untuk dokumen yang didukung, termasuk BC 3.0 dan TPB menurut deskripsi OpenAPI |
| Status per nomor aju   | `GET /status/{nomorAju}`                                      | Jalur utama rekonsiliasi satu dokumen                                                |
| Status per perusahaan  | `GET /status?idPerusahaan={NITKU}`                            | Ambil daftar status belum diambil; semantik acknowledgement perlu diuji              |
| Detail dokumen         | `GET /document/detail/{jenisDokumen}/{nomorAju}/{kodeKantor}` | Jangan anggap tersedia untuk semua jenis dokumen                                     |
| PDF respons            | `GET /respon/pdf`                                             | Simpan sebagai attachment melalui boundary data aplikasi                             |
| Formulir draft         | `GET /respon/cetak-formulir/draft`                            | Output dan parameter harus dibuktikan                                                |
| Formulir final         | `GET /respon/cetak-formulir/final`                            | Output dan parameter harus dibuktikan                                                |
| Billing                | `GET /respon/billing`                                         | Billing adalah milestone/evidence, bukan status akhir job                            |
| Pelabuhan luar negeri  | `GET /referensi/pelabuhan-luar-negeri/{kata}`                 | Pencarian berdasarkan uraian nama pelabuhan                                          |
| Pelabuhan dalam negeri | `GET /referensi/pelabuhan-dalam-negeri/{kodeKantor}`          | Bergantung pada kode kantor pabean                                                   |
| Gudang TPS             | `GET /referensi/tps-gudang/{kodeKantor}`                      | Bergantung pada kode kantor pabean                                                   |
| Kurs                   | `GET /kurs/{kodeValuta}`                                      | Simpan tanggal efektif dan waktu pengambilan                                         |
| Tarif                  | `GET /tarif-hs`                                               | Hasil harus dikaitkan dengan tanggal verifikasi; bukan penetapan tarif resmi         |
| Manifes BC 1.1         | `GET /manifes-bc11`                                           | Gunakan hanya jika diperlukan oleh workflow dokumen terkait                          |

Response schema beberapa operasi kosong atau tidak lengkap. TypeScript type untuk respons tidak boleh dihasilkan secara spekulatif dari file OpenAPI ini.

## Kontrak pengiriman dokumen

### Mode draft dan final

OpenAPI mendeskripsikan query berikut pada `POST /document`:

```text
isFinal=false  data menjadi draft; nilai default
isFinal=true   data langsung dikirim
isRevision=true data adalah perbaikan untuk jenis dokumen yang didukung
```

Keputusan:

- aplikasi harus membedakan penyimpanan draft CEISA dari submit final;
- tombol atau command submit final tidak boleh hanya mengubah state lokal;
- transisi ke `SUBMITTED` memerlukan evidence respons transport dari CEISA;
- retry submit final tidak boleh diterapkan sampai idempotency berdasarkan `nomorAju` dibuktikan;
- timeout setelah request terkirim adalah keadaan tidak pasti dan harus direkonsiliasi melalui endpoint status, bukan langsung dikirim ulang.

### Nomor pengajuan

Schema BC 2.3, BC 2.5, dan BC 3.0 mendeskripsikan `nomorAju` sebagai 26 karakter dengan susunan:

```text
4 karakter kode kantor
2 karakter kode dokumen
6 karakter identitas unik perusahaan
8 karakter tanggal YYYYMMDD
6 karakter sequence
```

Implementasi tidak boleh menghasilkan nomor baru setelah submit tanpa prosedur koreksi yang terverifikasi. `nomorAju` adalah correlation key utama antara payload, respons, PDF, status, dan audit trail.

## Matriks schema dokumen

| Dokumen | Portal aktif                                | Arsip lokal                                 | Keputusan provisional                                                                       |
| ------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| BC 2.3  | v0.8; 44 properti top-level; 41 required    | v0.9; 44 properti top-level; 42 required    | Gunakan schema portal sebagai baseline aktif, tetapi diff setiap field sebelum implementasi |
| BC 2.5  | v0.15; 35 properti top-level; 30 required   | v0.15; 35 properti top-level; 30 required   | Gunakan isi portal aktif; nomor versi yang sama tidak menjamin isi identik                  |
| BC 3.0  | v0.5.29; 55 properti top-level; 35 required | v0.5.28; 55 properti top-level; 35 required | Gunakan struktur portal v0.5.29 sebagai baseline aktif                                      |

### Perbedaan yang sudah ditemukan

#### BC 2.3

- Portal aktif menetapkan `asalData` dengan enum `S`.
- Arsip v0.9 menambahkan `nik` sebagai properti top-level dan required.
- Referensi identitas pada portal aktif memuat kode identitas yang telah bergerak ke NPWP 16 digit/kode `6`, sedangkan arsip masih memuat kombinasi kode lama.
- Label versi portal lebih rendah daripada arsip, tetapi sebagian isi portal tampak lebih baru. Karena itu pemilihan tidak boleh hanya berdasarkan v0.8 versus v0.9.

#### BC 2.5

- Versi tertulis sama-sama v0.15.
- Portal aktif menggunakan nilai `kodeDokumen` konstan `25`.
- Referensi jenis identitas pada portal aktif berbeda dari arsip dan mengakomodasi NPWP 16 digit/kode `6`.

#### BC 3.0

- Portal aktif menaikkan versi dari v0.5.28 menjadi v0.5.29.
- Beberapa array seperti `barang`, `kemasan`, `kontainer`, `pengangkut`, `bankDevisa`, dan `kesiapanBarang` menggunakan object schema sebagai `items` pada portal aktif, memperbaiki bentuk tuple-style dalam arsip.
- Array yang mewakili varian entitas atau dokumen masih harus diperiksa per struktur; jangan melakukan normalisasi massal tanpa diff.

### Deviasi dari JSON Schema standar

Schema portal menggunakan keyword seperti `maxlength` pada properti numeric. Validator JSON Schema Draft 7 standar akan mengabaikan keyword tersebut karena `maxLength` hanya berlaku pada string.

Keputusan:

- pertahankan schema vendor sebagai evidence tanpa diam-diam mengubahnya;
- normalisasi constraint vendor pada layer validasi aplikasi bila maknanya jelas;
- `/document/check` tetap diperlukan untuk membuktikan validasi server;
- perbedaan hasil validator lokal dan server harus dicatat sebagai contract finding.

## Data referensi

Halaman Reference publik memuat 62 tabel pada tanggal verifikasi, termasuk kantor, negara, valuta, satuan barang, kemasan, kontainer, incoterm, dokumen, jenis identitas, status, dan respons. Halaman tersebut tidak menyediakan tabel statis pelabuhan.

### Klasifikasi penyimpanan

| Kelas                     | Contoh                                | Strategi                                                                          |
| ------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| Snapshot relatif stabil   | negara, valuta, satuan, jenis kemasan | Simpan snapshot berversi dan provenance                                           |
| Bergantung konteks        | pelabuhan dalam negeri, TPS/gudang    | Ambil berdasarkan `kodeKantor`, lalu cache dengan provenance                      |
| Pencarian dinamis         | pelabuhan luar negeri                 | Cari berdasarkan kata; simpan item terpilih, bukan seluruh hasil pencarian        |
| Efektif berdasarkan waktu | kurs, tarif, LARTAS                   | Simpan tanggal efektif, waktu pengambilan, dan sumber; jangan perlakukan permanen |
| Operasional               | status dan respons                    | Simpan sebagai immutable observation/audit evidence                               |

Bentuk normalisasi minimal untuk referensi lokasi:

```ts
type CeisaLocationReference = {
  kind: 'FOREIGN_PORT' | 'DOMESTIC_PORT' | 'TPS_WAREHOUSE'
  code: string
  name: string
  customsOfficeCode?: string
  source: 'CEISA'
  fetchedAt: string
}
```

`code` adalah identitas eksternal. `name` adalah label tampilan dan dapat berubah. Nilai historis yang sudah dipakai dokumen tidak boleh berubah hanya karena cache referensi diperbarui.

Kebijakan TTL belum ditentukan. Tetapkan setelah mengamati response headers, ukuran data, frekuensi perubahan, dan batas request di sandbox.

## Respons CEISA dan lifecycle CustomsJob

### Simpan observasi mentah

Adapter harus menyimpan observasi CEISA tanpa memasukkan bentuk vendor ke entity domain:

```ts
type CeisaResponseObservation = {
  documentType: string
  submissionNumber: string
  responseCode: string
  responseName: string
  observedAt: string
  registrationNumber?: string
  registrationDate?: string
  attachmentId?: string
  rawPayloadRef: string
}
```

`rawPayloadRef` menunjuk evidence tersimpan di boundary attachment/audit; domain entity tidak menyimpan `Blob`, `File`, atau tipe storage.

### Pemetaan provisional

Pemetaan selalu menggunakan kombinasi `documentType + responseCode + evidence`, bukan `responseCode` saja.

| Observasi CEISA                              | Efek pada `CustomsJob`                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Draft hanya tersimpan lokal                  | Tetap `DRAFT` atau `PREPARING`                                                                             |
| `POST /document` berhasil untuk submit final | `SUBMITTED`, dengan evidence respons                                                                       |
| Respons `*00` penerimaan                     | Tetap `SUBMITTED`; catat acknowledgment                                                                    |
| Nomor dan tanggal pendaftaran tersedia       | `REGISTERED`                                                                                               |
| Respons `*01` reject                         | Masuk `ON_HOLD` dengan alasan `CEISA_REJECTED`; jangan membuat state baru tanpa perubahan domain eksplisit |
| Respons `*20` konfirmasi bayar/billing       | Catat milestone dan attachment; bukan release                                                              |
| BC 2.3 atau BC 2.5 mendapat `*03` SPPB       | `RELEASED` setelah evidence SPPB tersedia                                                                  |
| BC 3.0 mendapat `*15` NPE                    | `RELEASED` setelah evidence NPE tersedia                                                                   |
| Respons `*99` error autentikasi              | Tidak mengubah lifecycle; catat integration failure                                                        |
| Operasi fisik dan administrasi selesai       | `COMPLETED` melalui command domain, bukan otomatis dari respons CEISA                                      |

Pemetaan ini mempertahankan lifecycle kanonis di `docs/jobs-lifecycle.md`:

```text
DRAFT → PREPARING → SUBMITTED → REGISTERED → RELEASED → COMPLETED
```

`ON_HOLD` tetap menyimpan target status untuk resume. Reject CEISA tidak menghapus audit submission sebelumnya.

### Kode referensi yang sudah diamati

| Kode  | Jenis dokumen                                           | Nama respons                                |
| ----- | ------------------------------------------------------- | ------------------------------------------- |
| `*00` | 16, 20, 23, 25, 261, 262, 27, 28, 33, 331               | Respons Penerimaan                          |
| `*01` | 16, 20, 23, 25, 261, 262, 27, 28, 30, 33, 331, 511, 513 | Nota Pemberitahuan Penolakan (Reject)       |
| `*03` | 16, 20, 23, 25, 27, 28, 511, 513                        | Surat Persetujuan Pengeluaran Barang (SPPB) |
| `*15` | 30                                                      | Respons Nota Pelayanan Ekspor               |
| `*20` | 20, 25, 28, 511, 513                                    | Konfirmasi Bayar (Billing)                  |
| `*99` | 16, 20, 23, 25, 28, 511, 513                            | Respons Error Autentikasi                   |

Kode berawalan `*` ditulis sesuai tabel Reference portal. Bentuk kode aktual pada response wire harus dibuktikan: literal dengan tanda bintang atau pola/suffix.

## Cacat dan ketidakpastian dokumentasi vendor

Temuan berikut harus dianggap sebagai input desain, bukan diperbaiki diam-diam:

1. Swagger aktif masih mencantumkan hostname internal `new-apigpub03:5555`.
2. OpenAPI 3 aktif menyediakan base URL produksi yang dapat digunakan, tetapi merupakan hasil konversi yang tidak lengkap.
3. Beberapa path bertemplat, termasuk endpoint pelabuhan/TPS, tidak mendeklarasikan path parameter pada operation.
4. Beberapa operasi `GET` hasil konversi memiliki `requestBody`.
5. Sejumlah operasi tidak mendeklarasikan response schema atau bahkan response code.
6. Payload contoh BC 2.5 yang dipublikasikan tidak valid JSON karena koma hilang dan memakai `kodeDokumen: "20"`, bertentangan dengan konstanta schema `25`.
7. Payload contoh BC 3.0 mengandung karakter kontrol sehingga tidak dapat dipakai sebagai fixture JSON tanpa koreksi.
8. Schema numeric menggunakan keyword nonstandar `maxlength`.
9. Label versi BC 2.3 portal dan arsip tidak bergerak secara monoton terhadap isi.
10. Route Change Log portal menampilkan `Page not found` pada tanggal verifikasi.

Implikasi: spesifikasi publik dapat dipakai untuk discovery dan baseline, tetapi belum aman untuk code generation otomatis atau asumsi response type.

## Boundary adapter yang direncanakan

Domain dan UI tidak boleh melakukan HTTP CEISA secara langsung. Adapter publik yang disarankan:

```ts
interface CeisaClient {
  validateDocument(document: unknown): Promise<CeisaValidationResult>
  submitDocument(document: unknown, options: SubmitOptions): Promise<CeisaSubmissionResult>
  getStatusBySubmissionNumber(submissionNumber: string): Promise<CeisaResponseObservation[]>
  getPendingStatuses(companyId: string): Promise<CeisaResponseObservation[]>
  searchForeignPorts(query: string): Promise<CeisaLocationReference[]>
  listDomesticPorts(customsOfficeCode: string): Promise<CeisaLocationReference[]>
  listTpsWarehouses(customsOfficeCode: string): Promise<CeisaLocationReference[]>
}
```

Interface ini masih provisional. Nama field response final ditentukan setelah capture sandbox, bukan dari tebakan terhadap OpenAPI yang kosong.

Invariants:

- satu submit dan seluruh evidence yang menyertainya harus dapat ditelusuri dengan `nomorAju`;
- response mentah disimpan immutable;
- normalisasi ulang tidak mengubah evidence mentah;
- API key/token tidak pernah masuk domain atau data persisten pengguna;
- retry hanya diterapkan pada operasi yang telah terbukti aman;
- error transport, error autentikasi, reject dokumen, dan status bisnis adalah kategori berbeda.

## Rencana verifikasi sandbox

Status kontrak tetap `provisional` sampai pemeriksaan berikut selesai.

### Autentikasi

- [ ] Pastikan endpoint login aktif: `openapi-auth` atau OAuth gateway generik.
- [ ] Ukur masa berlaku access token dari response aktual.
- [ ] Uji refresh token dan jendela refresh.
- [ ] Konfirmasi kewajiban `id_platform` dan `Origin`.
- [ ] Rekam kontrak error 400/401/403 tanpa menyimpan rahasia.

### Referensi

- [ ] Rekam response pelabuhan luar negeri untuk query valid, ambigu, dan tidak ditemukan.
- [ ] Rekam response pelabuhan dalam negeri untuk satu `kodeKantor` valid.
- [ ] Rekam response TPS untuk kantor yang memiliki dan tidak memiliki TPS.
- [ ] Periksa pagination, batas hasil, casing pencarian, deduplikasi, dan response headers cache.
- [ ] Pastikan bentuk kode pelabuhan yang harus dikirim pada BC 2.3, BC 2.5, dan BC 3.0.

### Dokumen

- [ ] Jalankan `/document/check` untuk satu fixture valid dan satu pelanggaran schema yang bermakna.
- [ ] Simpan draft dengan `isFinal=false`.
- [ ] Submit final dengan `isFinal=true` menggunakan nomor aju uji.
- [ ] Simulasikan timeout dan rekonsiliasi dengan `/status/{nomorAju}` tanpa submit ulang.
- [ ] Tarik status sampai nomor pendaftaran tersedia.
- [ ] Verifikasi response reject, billing, SPPB, atau NPE sesuai jenis dokumen uji.
- [ ] Verifikasi response PDF dan metadata attachment.

### Evidence pengujian

Setiap hasil uji menyimpan:

```text
environment
verifiedAt
operation
sanitized request metadata
HTTP status
sanitized response sample
observed schema
correlation/nomorAju uji
finding atau keputusan kontrak
```

Payload harus disanitasi dari identitas, rahasia, dokumen komersial, dan data pribadi sebelum masuk repository.

## Change control

Ketika portal atau response sandbox berubah:

1. ambil snapshot baru dan checksum;
2. lakukan structural diff, bukan perbandingan versi saja;
3. klasifikasikan perubahan sebagai additive, tightening, breaking, atau documentation-only;
4. perbarui adapter dan validator yang terdampak;
5. uji ulang hanya alur yang terkena perubahan;
6. catat tanggal, sumber, keputusan, dan evidence;
7. ubah status dokumen ini menjadi `ready for operational review` hanya setelah checklist sandbox minimum selesai.

Perubahan HS, LARTAS, tarif, fasilitas, dan prosedur tetap memerlukan verifikasi terhadap tanggal serta kasus terkait. Integrasi teknis tidak mengubah kewenangan penetapan DJBC atau instansi teknis.

## Demo draft BC 2.3 lokal

Route internal `POST /api/ceisa/bc-23/draft` menerima multipart `invoice` dan `transport` setelah autentikasi aplikasi. Route ini memakai ekstraksi dokumen yang sama dengan klasifikasi unggahan job, lalu memetakan nilai yang terbaca ke `domain/ceisa/bc23.ts` melalui mapper murni `lib/ceisa/bc23-draft.ts`.

Kontrak respons memuat `draft`, `draftStatus`, `issues`, `provenance`, dan nilai ekstraksi pada `sources`. `DRAFT_INCOMPLETE` berarti field wajib yang belum memiliki sumber tetap `null` atau array kosong dan dilaporkan sebagai `REQUIRED_FIELD_MISSING`. Perbedaan Invoice dengan B/L/AWB menjadi peringatan `SOURCE_CONFLICT`; total item yang berbeda dari total invoice menjadi `ITEM_TOTAL_MISMATCH`.

Halaman demo memberi form untuk setiap field wajib tingkat atas yang masih kosong. Operator mengisi nilai dan kode referensi yang telah diverifikasi, lalu mapper murni menghitung ulang `issues` dan `draftStatus`; nilai tersebut dicatat dalam `provenance` sebagai `MANUAL`. Input, draft hasil lengkap, dan provenance hanya berada di state browser hingga halaman ditutup atau draft baru dibuat.

Demo hanya dapat dibuka langsung pada `/ceisa/bc-23-demo`. Tidak ada menu aplikasi yang ditambahkan. Demo tidak mengirim atau menyimpan dokumen CEISA, tetapi dapat memanggil lookup GET referensi dan kurs melalui route aplikasi yang terautentikasi ketika koneksi CEISA tersedia. Kode referensi yang dipilih disimpan sebagai kode, bukan nama tampilan; saat integrasi tidak tersedia operator tetap dapat memakai input manual.

## Implementasi server

Implementasi aplikasi menggunakan adapter server-only `lib/server/ceisa/` dan hanya
mengizinkan method yang tercantum dalam cakupan. Endpoint bisnis memakai `GET`;
`POST /user/login` adalah satu-satunya POST yang digunakan oleh adapter. Credential
workspace dienkripsi AES-256-GCM, token hanya berada di memori server, dan route
pengaturan tidak pernah mengembalikan nilai rahasia.

Kontrak login sudah diverifikasi melalui capture tersanitasi. Respons status, referensi,
kurs, tarif, manifes, detail, dan PDF tetap **UNVERIFIED** sampai capture H2H yang
disanitasi membuktikan nama field dan route draft/form aktif. Parser menolak bentuk
yang tidak dikenali dengan `CEISA_CONTRACT_MISMATCH`; aplikasi tidak memutasi
lifecycle CustomsJob pada kegagalan kontrak atau transport.

### Capture H2H tersanitasi — 2026-10-06

Login `POST /user/login` menerima body JSON `username` dan `password`, dan respons
HTTP 200 yang diamati memiliki envelope `status`, `message`, dan `item`. `item`
memuat `access_token` (string), `expires_in` (number), serta field token tambahan.
Adapter membaca token hanya dari `item.access_token` dan tidak merekam nilainya.

Probe `GET /kurs/USD` dengan bearer token dan `beacukai-api-key` juga menghasilkan
HTTP 200 dengan envelope `status`, `message`, dan `data` array. Item yang diamati
hanya memiliki `nilaiKurs` (string); karena tidak ada tanggal efektif, normalizer
kurs tetap menolak respons tersebut sebagai observasi kurs yang belum lengkap. Probe
koneksi hanya membuktikan gateway dan header operasional, bukan kontrak kurs lengkap.
