# Requirements Document

## Introduction

Dokumen ini berisi requirement **to-be** untuk membangun ulang (ground-up redesign) workspace
operasional VSS — sistem internal freight-forwarding untuk kargo pameran MICE di Indonesia.
Requirement diturunkan dari dokumen desain `design.md` dan menggambarkan **perilaku yang
diinginkan** dari sistem hasil redesign, bukan dokumentasi perilaku build lama.

Cakupan dibagi dua lapisan:

- **Lapisan fondasi (lintas-domain):** arsitektur akses data satu arah (baca via Server Component,
  tulis via route handler), tata letak vertical-slice hibrida (`domain/` murni + `features/` +
  route tipis), gaya fungsional ringan (use-case memanggil repository langsung, port selektif untuk
  integrasi berat), penyimpanan relasional ternormalisasi (kolom nyata + FK + CHECK, tanpa dua
  sumber kebenaran `payload` jsonb), penomoran aman-race berbasis sequence Postgres, `middleware.ts`
  sebagai gerbang otentikasi global, otorisasi peran + per-objek yang ditegakkan di lapisan
  use-case, lampiran Supabase Storage privat yang dirujuk lewat id, penegakan `server-only` untuk
  kode yang menyentuh rahasia, kontrak error seragam, serta konvensi bahasa.
- **Lapisan domain Event (slice pertama):** pembuatan/penyuntingan event dengan alias yang
  dipersist dan validasi sisi server, master data venue/EO yang dirujuk atau dibuat inline,
  lifecycle eksplisit dengan aksi pembatalan yang berfungsi, penghapusan yang diblokir saat ada data
  turunan dengan arsip sebagai alternatif, otorisasi peran + PIC, dan dashboard/daftar event yang
  di-query sisi server.

Requirement memakai format EARS. Teks untuk pengguna dan pesan error memakai bahasa Indonesia;
identifier, enum, peran, dan kode memakai bahasa Inggris `SCREAMING_SNAKE_CASE`.

## Glossary

- **System**: Aplikasi VSS secara keseluruhan (Next.js 14 App Router tunggal).
- **Middleware**: `middleware.ts` yang menjadi gerbang otentikasi (AuthN) global di edge runtime.
- **Server_Component**: Halaman React Server Component (RSC) atau sub-komponen server (mis.
  `EventCard`) tanpa penanda `'use client'` yang `await` Use_Case/Repository di server untuk baca;
  tidak memuat SQL atau pemanggilan Supabase langsung.
- **Client_Leaf**: Komponen interaktif bertanda `'use client'` (form, modal, drag-drop, filter).
- **Route_Handler**: Endpoint mutasi tipis `app/api/<area>/route.ts` untuk tulis.
- **Use_Case**: Modul `server-only` di `features/<area>/use-cases/*` yang memegang orkestrasi,
  otorisasi, dan invariant bisnis.
- **Repository**: Modul `server-only` `features/<area>/repository.ts`, satu-satunya pemilik query
  entitas dan satu-satunya akses ke Postgres via service-role client; murni I/O tanpa aturan bisnis.
  Komponen dan use-case tidak menanam SQL sendiri.
- **Domain_Module**: Kode murni di `domain/<area>/{types.ts, validation.ts}`; tanpa storage, `Blob`,
  `File`, HTTP, React, atau Supabase.
- **Port**: Kontrak murni untuk integrasi berat/dapat-ditukar (mis. ekstraksi dokumen LLM) yang
  disuntik ke use-case secara selektif.
- **Server_Only_Module**: Modul yang menyentuh service-role Supabase, kunci LLM, atau generasi
  xlsx; wajib bertanda `import 'server-only'`.
- **CurrentUser**: Representasi pemohon terautentikasi `{ id, role, workspaceId }` yang diturunkan dari
  token sesi.
- **Role**: Peran pengguna — `STAFF`, `SUPERVISOR`, `CUSTOMER_SERVICE`, atau `DOCUMENT_ASSISTANT`.
- **Capability**: Kapabilitas aksi terdeklarasi (mis. `event:create`, `event:delete`) yang dipetakan
  dari peran.
- **Authorizer**: Modul `features/auth/authorize.ts` (`can`/`authorize`/`requireCurrentUser`) yang
  menegakkan otorisasi di lapisan use-case; secara konseptual bagian dari slice `auth`.
- **Session**: Sesi terotentikasi berbasis JWT (NextAuth v5) yang membawa bentuk CurrentUser
  (`{ id, role, workspaceId }`) tanpa mempersist tabel sesi.
- **Credential**: Pasangan email dan password yang dikirim saat sign-in untuk diverifikasi terhadap
  hash yang tersimpan di `app_users.password_hash`.
- **Auth_Domain_Module**: Kode murni `domain/auth/{types.ts, validation.ts}` berisi tipe User,
  Session, Role, validator kredensial murni, dan kontrak logika hashing password; tanpa storage,
  HTTP, React, atau Supabase.
- **Numbering_Service**: `lib/server/numbering.ts` yang menghasilkan nomor `VSS-XXXXX` berbasis
  sequence Postgres.
- **Attachment_Service**: `lib/server/attachments.ts` untuk upload/baca Supabase Storage privat,
  dirujuk lewat id.
- **Workspace**: Batas tenant; aplikasi single-tenant memakai `slug = 'default'`.
- **Event**: Entitas pameran dengan `name`, `alias`, `venue_id`, `event_organizer_id`, `pic_id`,
  `starts_on`, `ends_on`, dan `status`.
- **Event_Lifecycle**: Status lifecycle event — `ACTIVE`, `CANCELLED`, atau `ARCHIVED`.
- **Event_Display_Status**: Status tampilan turunan dari tanggal — `soon`, `ongoing`, atau `done`.
- **PIC**: Person-in-charge event; `events.pic_id` yang bernilai NOT NULL.
- **Venue**: Data referensi lokasi pameran (`venues`).
- **Event_Organizer**: Data referensi penyelenggara event (`event_organizers`, disingkat EO).
- **Event_Cancellation**: Baris `event_cancellations` berisi alasan, pelaku, dan waktu pembatalan.
- **Derived_Data**: Data turunan event (mis. exhibitor, CIPL, dokumen terkait).
- **Attention_Panel**: Panel perhatian di dashboard yang menampilkan overlap jadwal dan konflik
  venue.
- **Error_Contract**: Bentuk respons error seragam `{ error: '<pesan Indonesia>' }` dengan kode
  status HTTP.
- **Validation_Result**: Hasil validator invariant murni bertipe `Validation<T>` yang tidak throw
  dan mengumpulkan semua issue.

## Requirements

### Requirement 1: Gerbang otentikasi global via middleware

**User Story:** Sebagai operator sistem, saya ingin setiap permintaan dijaga oleh satu gerbang
otentikasi global, sehingga tidak ada route handler yang dapat terlupa memasang guard sesi.

Catatan ketertelusuran: DD-A7.

#### Acceptance Criteria

1. WHEN sebuah permintaan halaman diterima tanpa sesi terotentikasi, THE Middleware SHALL mengalihkan permintaan ke `/login`.
2. WHEN sebuah permintaan API diterima tanpa sesi terotentikasi, THE Middleware SHALL menolak permintaan dengan status 401 dan Error_Contract berisi pesan `Autentikasi diperlukan.`
3. WHEN sebuah permintaan diterima dengan sesi terotentikasi yang valid, THE Middleware SHALL meneruskan permintaan ke Server_Component atau Route_Handler tujuan.
4. THE System SHALL menegakkan otentikasi melalui Middleware sebagai gerbang default untuk semua rute terlindungi.

### Requirement 2: Arsitektur akses data satu arah

**User Story:** Sebagai developer, saya ingin baca mengalir di server dan tulis mengalir lewat route
handler, sehingga browser tidak pernah menyentuh database dan alur data tetap satu arah.

Catatan ketertelusuran: DD-A6, DD-A8, DD-A11.

#### Acceptance Criteria

1. WHEN sebuah halaman data atau sub-komponen server dirender untuk baca, THE Server_Component SHALL menginisiasi pembacaan dengan `await` ke Use_Case atau Repository di server tanpa lapisan fetch klien, baik dari halaman top-level maupun dari sub-komponen Server Component (mis. `EventCard`) yang mengkolokasi datanya di tempat pemakaian.
2. THE Server_Component yang menginisiasi pembacaan data SHALL berupa Server Component tanpa penanda `'use client'` dan tidak memuat SQL atau pemanggilan Supabase langsung, karena seluruh query entitas tetap berada di Repository.
3. WHEN pengguna memicu mutasi data, THE Client_Leaf SHALL mengirim permintaan ke Route_Handler melalui `fetch` dengan `cache: 'no-store'`.
4. WHEN sebuah mutasi data berhasil, THE Client_Leaf SHALL memanggil `router.refresh()` agar Server_Component memuat ulang data segar dari server.
5. THE System SHALL membatasi Server Action hanya untuk operasi `signIn` dan `signOut`, dan menjalankan seluruh mutasi data melalui Route_Handler.
6. THE Route_Handler SHALL hanya memasang runtime, mem-parse input dengan Zod, mendelegasikan ke Use_Case, dan memetakan hasil ke Error_Contract, tanpa memuat SQL atau aturan bisnis.

### Requirement 3: Batas import server/klien ditegakkan

**User Story:** Sebagai developer, saya ingin batas server/klien ditegakkan secara statis, sehingga
rahasia server tidak pernah masuk ke bundle klien meskipun kode dikolokasi dalam satu folder fitur.

Catatan ketertelusuran: DD-A9, P1, Security considerations.

#### Acceptance Criteria

1. THE System SHALL memastikan tidak ada file `'use client'` (di `app/**` non-`api`, `components/**`, atau `features/**/components/*`) yang mengimpor Server_Only_Module (`features/**/use-cases/*`, `features/**/repository.ts`, `lib/server/*`) atau `@supabase/supabase-js`, baik langsung maupun transitif.
2. THE System SHALL menandai setiap modul yang menyentuh service-role Supabase, kunci LLM, atau generasi xlsx dengan `import 'server-only'` sebagai import efektif pertama.
3. WHERE sebuah slice fitur mengolokasi kode server dan klien dalam satu folder, THE System SHALL tetap memisahkan Use_Case dan Repository (bertanda `import 'server-only'`) dari Client_Leaf (bertanda `'use client'`), tanpa impor dari klien ke modul server-only tersebut.
4. WHEN pemeriksaan guard arsitektur dijalankan, THE System SHALL melaporkan setiap pelanggaran dengan path file dan baris impor yang melanggar.
5. IF sebuah file `'use client'` mengimpor Server_Only_Module, THEN THE System SHALL menggagalkan pemeriksaan guard arsitektur dengan exit non-nol tanpa memodifikasi file sumber.

### Requirement 4: Tata letak vertical-slice hibrida dengan domain murni

**User Story:** Sebagai developer, saya ingin kode tersusun sebagai vertical slice dengan inti domain
murni, sehingga logika mudah ditemukan, diuji, dan efek didorong ke tepi.

Catatan ketertelusuran: DD-A9, DD-A10, P5.

#### Acceptance Criteria

1. THE Domain_Module SHALL hanya berisi tipe entitas dan validator murni tanpa storage, `Blob`, `File`, HTTP, React, atau Supabase.
2. THE Use_Case SHALL memegang seluruh orkestrasi, otorisasi, dan invariant bisnis di sisi server.
3. THE Repository SHALL menjadi satu-satunya titik akses ke Postgres melalui service-role client dan tidak memuat aturan bisnis.
4. THE Repository SHALL menjadi satu-satunya pemilik query entitas sehingga Server_Component, Use_Case, maupun Client_Leaf tidak memuat SQL atau pemanggilan Supabase langsung, dan setiap pembacaan maupun penulisan entitas mengalir melalui fungsi Repository.
5. THE Use_Case SHALL memanggil Repository secara langsung tanpa dependency injection, kecuali untuk integrasi berat yang disuntik melalui Port.
6. WHERE sebuah integrasi berat atau dapat-ditukar diperlukan, THE Use_Case SHALL menerima Port sebagai parameter agar dapat di-stub saat pengujian.

### Requirement 5: Penyimpanan relasional ternormalisasi

**User Story:** Sebagai developer, saya ingin data disimpan dalam kolom relasional ternormalisasi,
sehingga tidak ada dua sumber kebenaran per baris dan invariant dapat ditegakkan oleh database.

Catatan ketertelusuran: DD-A2, P5.

#### Acceptance Criteria

1. THE System SHALL menyimpan nilai field entitas hanya pada kolom relasional nyata dengan foreign key dan CHECK constraint yang sesuai.
2. THE System SHALL membatasi penggunaan `jsonb` hanya untuk data yang benar-benar tidak terstruktur.
3. THE System SHALL memastikan tidak ada kolom `payload` jsonb yang menduplikasi nilai field yang sudah ada pada kolom relasional.
4. THE System SHALL menyertakan kolom `workspace_id` dengan `on delete cascade`, `created_at`, dan `updated_at` pada setiap tabel operasional.
5. THE System SHALL mengaktifkan row level security dan mencabut seluruh grant dari peran `anon` dan `authenticated` pada setiap tabel operasional.

### Requirement 6: Penomoran aman terhadap race

**User Story:** Sebagai operator sistem, saya ingin nomor entitas dihasilkan secara aman terhadap
konkurensi, sehingga dua permintaan bersamaan tidak pernah menghasilkan nomor duplikat.

Catatan ketertelusuran: DD-A2, P4.

#### Acceptance Criteria

1. WHEN sebuah nomor diminta, THE Numbering_Service SHALL menghasilkan nomor berformat `VSS-XXXXX` dengan bagian numerik minimal lima digit dan diisi nol di depan (zero-padded) ketika nilainya kurang dari lima digit, menggunakan sequence Postgres sebagai sumber nilai.
2. WHEN bagian numerik dari sequence Postgres melebihi lima digit (nilai lebih besar dari 99999), THE Numbering_Service SHALL menghasilkan nomor dengan seluruh digit numerik tanpa pemotongan dan tanpa nol tambahan di depan.
3. WHILE dua atau lebih permintaan nomor diproses secara konkuren, THE Numbering_Service SHALL menetapkan setiap permintaan satu nilai sequence Postgres yang unik sehingga setiap nomor yang dihasilkan berbeda dan monoton naik secara ketat (setiap nomor berikutnya lebih besar dari nomor sebelumnya).
4. THE Numbering_Service SHALL memperoleh nilai nomor hanya dari sequence Postgres di sisi server tanpa operasi baca-ubah-tulis counter dari klien.
5. IF pengambilan nilai sequence Postgres gagal, THEN THE Numbering_Service SHALL membatalkan penerbitan nomor, tidak mengembalikan nomor apa pun, dan mengembalikan indikasi kesalahan yang menyatakan penomoran gagal, tanpa mengubah nilai sequence yang tersimpan.

### Requirement 7: Otorisasi peran dan per-objek di lapisan use-case

**User Story:** Sebagai operator sistem, saya ingin otorisasi ditegakkan di lapisan use-case pada
setiap mutasi, sehingga aturan peran dan kepemilikan objek tidak dapat dilewati melalui pemanggilan
API langsung.

Catatan ketertelusuran: DD-A3, DD-A7, P2, P3.

#### Acceptance Criteria

1. WHEN sebuah Use_Case mutasi dijalankan, THE Use_Case SHALL memanggil Authorizer sebelum melakukan operasi tulis apa pun ke Repository.
2. WHEN Authorizer mengevaluasi sebuah permintaan mutasi, THE Authorizer SHALL mengevaluasi pemeriksaan peran terlebih dahulu dan hanya mengevaluasi guard per-objek jika pemeriksaan peran lolos.
3. WHEN CurrentUser meminta sebuah Capability, THE Authorizer SHALL mengizinkan aksi hanya jika Role CurrentUser dipetakan ke Capability tersebut dalam pemetaan peran-ke-Capability yang terdefinisi.
4. IF Role CurrentUser tidak memiliki Capability yang diminta, THEN THE Authorizer SHALL menolak mutasi tanpa melakukan operasi tulis ke Repository dan mengembalikan respons dengan status 403 sesuai Error_Contract yang menunjukkan penolakan otorisasi peran.
5. WHERE sebuah guard per-objek disediakan untuk Capability, THE Authorizer SHALL mengevaluasi aturan kepemilikan objek setelah pemeriksaan peran lolos.
6. IF pemeriksaan peran lolos tetapi guard per-objek menolak CurrentUser, THEN THE Authorizer SHALL menolak mutasi tanpa melakukan operasi tulis ke Repository dan mengembalikan respons dengan status 403 sesuai Error_Contract yang menunjukkan penolakan kepemilikan objek.
7. IF sebuah mutasi diajukan langsung ke Route_Handler dengan melewati antarmuka pengguna, THEN THE Route_Handler SHALL tetap menjalankan Use_Case sehingga seluruh pemeriksaan otorisasi peran, guard per-objek, dan invariant bisnis tetap ditegakkan sebelum operasi tulis ke Repository.

### Requirement 8: Kontrak error seragam

**User Story:** Sebagai developer, saya ingin semua error mengikuti satu kontrak, sehingga klien
dapat menampilkan pesan Indonesia yang konsisten dengan kode status yang tepat.

Catatan ketertelusuran: Error Handling, konvensi bahasa.

#### Acceptance Criteria

1. WHEN sebuah error dikembalikan dari Route_Handler, THE System SHALL memakai bentuk `{ error: '<pesan Indonesia>' }`.
2. IF sebuah permintaan tidak memiliki sesi, THEN THE System SHALL merespons dengan status 401 dan pesan `Autentikasi diperlukan.`
3. IF CurrentUser tidak berwenang atas peran atau objek, THEN THE System SHALL merespons dengan status 403.
4. IF sebuah entitas yang diminta tidak ditemukan, THEN THE System SHALL merespons dengan status 404.
5. IF input gagal validasi Zod, THEN THE System SHALL merespons dengan status 400 dan pesan validasi yang relevan.
6. IF sebuah mutasi berkonflik dengan state saat ini, THEN THE System SHALL merespons dengan status 409.
7. IF terjadi kegagalan Supabase atau vendor, THEN THE System SHALL merespons dengan status 503 dan pesan `Layanan sedang tidak tersedia. Coba lagi.`
8. THE System SHALL menuliskan teks untuk pengguna dalam bahasa Indonesia dan identifier, enum, serta kode dalam bahasa Inggris `SCREAMING_SNAKE_CASE`.

### Requirement 9: Lampiran Supabase Storage privat dirujuk lewat id

**User Story:** Sebagai developer, saya ingin lampiran disimpan di Storage privat dan dirujuk lewat
id, sehingga entitas domain tetap bebas dari tipe storage dan byte file tidak bocor ke bundle klien.

Catatan ketertelusuran: DD-A9, prinsip domain murni.

#### Acceptance Criteria

1. THE Attachment_Service SHALL menyimpan lampiran pada bucket Supabase Storage privat.
2. THE Domain_Module SHALL merujuk lampiran hanya lewat id dan tidak pernah memegang `Blob` atau `File`.
3. WHEN sebuah lampiran dibaca, THE Attachment_Service SHALL mengembalikan byte file hanya melalui kode server.

### Requirement 10: Pembuatan event dengan alias dipersist dan validasi server

**User Story:** Sebagai staf, saya ingin membuat event dengan data lengkap termasuk alias, sehingga
event tercatat dengan benar dan alias dapat dipakai untuk pencarian.

Catatan ketertelusuran: DD-E1, DD-A3, P3.

#### Acceptance Criteria

1. WHEN pengguna mengirim data pembuatan event yang lolos validasi input dan invariant, THE System SHALL menyimpan Event baru dengan status awal `ACTIVE` dan mengembalikan status 201.
2. WHEN sebuah Event disimpan dengan `alias` terisi (1 sampai 200 karakter setelah trim), THE System SHALL mempersist nilai `alias` pada kolom `events.alias` sehingga nilai yang tersimpan identik dengan nilai yang dikirim setelah trim.
3. WHEN sebuah Event disimpan tanpa `alias` atau dengan `alias` kosong setelah trim, THE System SHALL mempersist nilai `alias` sebagai null dan tetap menyimpan Event dengan status 201.
4. IF `name` kosong atau hanya berisi spasi setelah trim, atau melebihi 200 karakter setelah trim, THEN THE System SHALL menolak penyimpanan dengan status 400, tidak membuat Event apa pun, dan mengembalikan pesan `Nama event wajib diisi.`
5. IF `ends_on` lebih awal dari `starts_on`, THEN THE System SHALL menolak penyimpanan dengan status 400, tidak membuat Event apa pun, dan mengembalikan pesan `Tanggal akhir harus sama dengan atau setelah tanggal mulai.`
6. IF `venue_id`, `event_organizer_id`, atau `pic_id` tidak merujuk pada entitas yang ada dalam Workspace yang sama dengan Event, THEN THE System SHALL menolak penyimpanan dengan status 400, tidak membuat Event apa pun, dan mengembalikan Validation_Result yang mencantumkan setiap referensi yang tidak valid beserta pesan error dalam bahasa Indonesia.
7. THE System SHALL menegakkan seluruh validasi input dan invariant event di Use_Case server sebelum persist, sehingga pemanggilan API langsung yang melewati lapisan klien tetap tunduk pada validasi dan invariant yang sama.

### Requirement 11: Penyuntingan event

**User Story:** Sebagai staf yang berwenang, saya ingin menyunting event yang ada, sehingga detail
event dapat diperbarui dengan validasi dan otorisasi yang sama seperti pembuatan.

Catatan ketertelusuran: DD-E1, DD-E4, DD-A3.

#### Acceptance Criteria

1. WHEN pengguna berwenang mengirim perubahan event yang valid, THE System SHALL memperbarui Event dan memperbarui `updated_at`.
2. IF Event yang disunting tidak ditemukan, THEN THE System SHALL merespons dengan status 404 dan pesan `Event tidak ditemukan.`
3. IF perubahan melanggar aturan `ends_on` harus sama dengan atau setelah `starts_on`, THEN THE System SHALL menolak perubahan dengan status 400 dan pesan `Tanggal akhir harus sama dengan atau setelah tanggal mulai.`
4. THE System SHALL mempersist nilai `alias` yang diperbarui pada kolom `events.alias`.

### Requirement 12: Master data venue dan event organizer

**User Story:** Sebagai staf, saya ingin memilih venue dan event organizer yang sudah ada atau
membuatnya inline, sehingga event selalu merujuk master data yang konsisten.

Catatan ketertelusuran: DD-A2, Data Models.

#### Acceptance Criteria

1. WHEN pengguna membuat event, THE System SHALL mengizinkan pemilihan Venue dan Event_Organizer yang sudah ada dalam Workspace.
2. WHERE pengguna memilih untuk membuat Venue atau Event_Organizer baru secara inline, THE System SHALL membuat record master data tersebut lalu merujuknya dari Event lewat id.
3. THE System SHALL merujuk Venue dan Event_Organizer dari Event melalui foreign key, bukan nilai yang digandakan.
4. IF pembuatan master data inline menerima `legal_name` kosong atau hanya spasi, THEN THE System SHALL menolak pembuatan dengan status 400.

### Requirement 13: Lifecycle eksplisit dan aksi pembatalan event

**User Story:** Sebagai staf yang berwenang, saya ingin membatalkan event dengan alasan tercatat,
sehingga status event eksplisit dan tersedia jejak audit siapa membatalkan dan kapan.

Catatan ketertelusuran: DD-E2, P6.

#### Acceptance Criteria

1. THE System SHALL memakai kolom `events.status` sebagai satu-satunya sumber Event_Lifecycle dengan nilai yang hanya boleh salah satu dari `ACTIVE`, `CANCELLED`, atau `ARCHIVED`.
2. WHEN pengguna berwenang membatalkan Event yang berstatus `ACTIVE` dengan alasan yang memiliki minimal 1 karakter non-spasi setelah pemangkasan spasi di awal dan akhir, THE System SHALL mengubah `events.status` menjadi `CANCELLED`.
3. WHEN pengguna berwenang membatalkan Event yang berstatus `ACTIVE` dengan alasan yang memiliki minimal 1 karakter non-spasi setelah pemangkasan spasi di awal dan akhir, THE System SHALL membuat tepat satu Event_Cancellation berisi alasan pembatalan, identitas pelaku pembatalan, dan waktu pembatalan.
4. IF alasan pembatalan kosong atau hanya berisi spasi setelah pemangkasan, THEN THE System SHALL menolak pembatalan dengan status 400, menolak perubahan `events.status`, tidak membuat Event_Cancellation, dan menampilkan pesan yang menunjukkan `Alasan pembatalan wajib diisi.`
5. THE System SHALL menjaga bijection antara status `CANCELLED` dan Event_Cancellation sehingga setiap Event berstatus `CANCELLED` memiliki tepat satu Event_Cancellation dan setiap Event_Cancellation merujuk tepat satu Event berstatus `CANCELLED`.

### Requirement 14: Penghapusan event diblokir saat ada data turunan, dengan arsip sebagai alternatif

**User Story:** Sebagai staf yang berwenang, saya ingin penghapusan event dicegah ketika ada data
turunan, sehingga data klien tidak hilang secara diam-diam dan event berisi riwayat dapat diarsipkan.

Catatan ketertelusuran: DD-E3, P7.

#### Acceptance Criteria

1. WHEN pengguna berwenang meminta penghapusan Event yang tidak memiliki Derived_Data (exhibitor atau dokumen terkait), THE System SHALL menghapus Event tersebut dan merespons dengan status 204 tanpa isi.
2. IF sebuah Event masih memiliki Derived_Data (minimal satu exhibitor atau satu dokumen terkait), THEN THE System SHALL menolak penghapusan dengan status 409, mempertahankan Event beserta seluruh data turunannya tanpa perubahan, dan mengembalikan pesan yang mengarahkan pengguna untuk membatalkan atau mengarsipkan event.
3. IF pengguna yang meminta penghapusan bukan PIC Event tersebut dan tidak memiliki peran SUPERVISOR, THEN THE System SHALL menolak penghapusan dengan status 403 dan tidak mengubah state Event.
4. IF Event yang diminta untuk dihapus tidak ditemukan dalam workspace pemohon, THEN THE System SHALL merespons dengan status 404.
5. WHEN pengguna berwenang mengubah status Event berisi Derived_Data menjadi `ARCHIVED`, THE System SHALL menyetel status Event ke `ARCHIVED` dan mempertahankan seluruh data turunannya.

### Requirement 15: Otorisasi peran dan PIC untuk aksi event

**User Story:** Sebagai PIC event atau supervisor, saya ingin hanya pihak berwenang yang dapat
menindak event, sehingga tidak ada bypass otorisasi untuk event mana pun.

Catatan ketertelusuran: DD-E4, P2.

#### Acceptance Criteria

1. THE System SHALL mewajibkan `events.pic_id` bernilai NOT NULL sehingga tidak ada event tanpa PIC.
2. WHEN sebuah aksi pembatalan atau penghapusan Event diajukan, THE Authorizer SHALL mengizinkannya hanya jika CurrentUser adalah PIC event tersebut atau memiliki Role `SUPERVISOR`.
3. IF CurrentUser bukan PIC event dan bukan `SUPERVISOR`, THEN THE System SHALL menolak aksi dengan status 403 dan pesan `Hanya PIC event atau supervisor yang dapat melakukan tindakan ini.`
4. THE System SHALL menegakkan pemeriksaan peran terlebih dahulu, lalu pemeriksaan kepemilikan per-objek.

### Requirement 16: Dashboard dan daftar event di-query sisi server

**User Story:** Sebagai staf, saya ingin dashboard event yang menampilkan ringkasan, panel perhatian,
pencarian, dan filter yang dihitung di server, sehingga performa tetap baik tanpa membaca seluruh
tabel ke browser.

Catatan ketertelusuran: DD-A8, DD-E1, DD-E2, DD-E3.

#### Acceptance Criteria

1. WHEN Server_Component dashboard event dirender, THE System SHALL menghitung ringkasan jumlah (total event, jumlah event dengan Event_Display_Status `ongoing`, total exhibitor, total item CIPL) melalui query agregat sisi server tanpa memuat seluruh baris tabel ke memori aplikasi.
2. WHEN daftar event di-query dengan kata kunci pencarian, THE System SHALL menerapkan pencocokan substring case-insensitive terhadap nama event, alias, nama venue, nama organizer, dan nama PIC di sisi server, dan mengembalikan event yang cocok pada minimal satu dari kelima field tersebut.
3. WHEN kata kunci pencarian kosong atau hanya berisi spasi, THE System SHALL mengembalikan daftar event tanpa penyaringan pencarian.
4. WHEN daftar event di-query dengan filter Event_Lifecycle, THE System SHALL mengembalikan hanya event yang Event_Display_Status-nya sama persis dengan nilai filter yang dipilih.
5. WHEN daftar event dirender, THE System SHALL menghitung Event_Display_Status setiap event di server dari tanggal mulai dan tanggal selesai dengan aturan: `soon` jika tanggal hari ini sebelum tanggal mulai, `ongoing` jika tanggal hari ini berada di antara tanggal mulai dan tanggal selesai inklusif, dan `done` jika tanggal hari ini setelah tanggal selesai.
6. WHEN Server_Component dashboard event dirender, THE System SHALL menampilkan Attention_Panel berisi daftar overlap jadwal event dan daftar konflik venue yang dihitung sisi server, di mana overlap jadwal adalah dua event dengan rentang tanggal yang beririsan dan konflik venue adalah dua event dengan rentang tanggal beririsan pada venue yang sama.
7. THE System SHALL mengambil data daftar event melalui query terfilter sisi server yang hanya mengembalikan baris yang sudah cocok dengan kriteria pencarian dan filter, bukan dengan membaca seluruh tabel lalu memfilter di browser.
8. IF query agregat ringkasan, query daftar event, atau perhitungan Attention_Panel gagal dieksekusi di server, THEN THE System SHALL merender dashboard dengan indikator error yang menyatakan data gagal dimuat dan tidak menampilkan data ringkasan atau daftar yang tidak lengkap sebagai data valid.

### Requirement 17: Kemurnian domain auth

**User Story:** Sebagai developer, saya ingin domain auth berisi tipe dan aturan murni tanpa efek,
sehingga logika kredensial dan hashing dapat diuji dan digunakan ulang tanpa bergantung pada
storage, jaringan, atau framework UI.

Catatan ketertelusuran: DD-A12, DD-A9.

#### Acceptance Criteria

1. THE Auth_Domain_Module SHALL hanya berisi tipe entitas `User`, `Session`, dan `Role`, validator kredensial murni, serta kontrak logika hashing password, tanpa storage, HTTP, React, atau Supabase.
2. THE Auth_Domain_Module SHALL mendefinisikan kontrak hashing password yang menetapkan penggunaan scrypt dengan salt acak, nilai hash self-describing yang berversi, dan perbandingan hash dengan waktu konstan (`timingSafeEqual`).
3. THE Auth_Domain_Module SHALL mengembalikan hasil validasi kredensial sebagai Validation_Result murni yang tidak throw dan mengumpulkan seluruh issue.

### Requirement 18: Sign-in dan sign-out sebagai satu-satunya Server Action

**User Story:** Sebagai pengguna, saya ingin masuk dengan kredensial yang valid dan keluar dengan
aman, sehingga sesi saya terbentuk hanya ketika kredensial benar dan dapat diakhiri kapan saja.

Catatan ketertelusuran: DD-A12, DD-A6, DD-A7.

#### Acceptance Criteria

1. WHEN kredensial valid dikirim pada sign-in, THE System SHALL membentuk Session terotentikasi berbasis JWT yang membawa Role CurrentUser.
2. WHEN System memverifikasi password pada sign-in, THE System SHALL membandingkan password terhadap hash self-describing yang tersimpan menggunakan perbandingan dengan waktu konstan.
3. IF kredensial tidak valid dikirim pada sign-in, THEN THE System SHALL menolak upaya masuk, tidak membentuk Session, dan mengembalikan pesan `Email atau kata sandi salah.`
4. THE System SHALL memastikan password plaintext tidak pernah dicatat ke log maupun dikembalikan dalam respons apa pun.
5. WHEN pengguna melakukan sign-out, THE System SHALL mengakhiri Session sehingga permintaan berikutnya tanpa sesi valid diperlakukan sebagai tidak terotentikasi.
6. THE System SHALL mengimplementasikan `signIn` dan `signOut` sebagai satu-satunya Server Action di sistem, dan menjalankan seluruh mutasi data entitas lain melalui Route_Handler sesuai arsitektur akses data satu arah.

### Requirement 19: Authorizer sebagai bagian slice auth

**User Story:** Sebagai operator sistem, saya ingin Authorizer tinggal di slice auth dan menurunkan
CurrentUser dari sesi terverifikasi, sehingga otorisasi peran dan per-objek punya satu rumah yang
jelas dan konsisten dengan penegakan di lapisan use-case.

Catatan ketertelusuran: DD-A12, DD-A7.

#### Acceptance Criteria

1. THE Authorizer SHALL menjadi bagian dari slice `auth` dan menyediakan `can`, `authorize`, serta `requireCurrentUser` yang dipanggil dari lapisan Use_Case.
2. WHEN `requireCurrentUser` dipanggil pada konteks permintaan, THE Authorizer SHALL menurunkan CurrentUser (`{ id, role, workspaceId }`) dari Session yang telah diverifikasi.
3. IF tidak ada Session terverifikasi saat `requireCurrentUser` dipanggil, THEN THE Authorizer SHALL menolak dengan status 401 dan pesan `Autentikasi diperlukan.`
4. THE Authorizer SHALL menegakkan otorisasi peran dan per-objek untuk Use_Case sesuai aturan pada Requirement 7, tanpa menduplikasi mekanisme otorisasi di tempat lain.

### Requirement 20: Kerahasiaan hash password dan kunci service-role

**User Story:** Sebagai operator sistem, saya ingin hash password dan kunci service-role tidak pernah
sampai ke browser, sehingga rahasia otentikasi dan akses database tidak bocor ke bundle klien.

Catatan ketertelusuran: DD-A12, DD-A9, Security considerations.

#### Acceptance Criteria

1. THE System SHALL memastikan hash password `app_users.password_hash` tidak pernah disertakan dalam respons ke klien maupun dalam bundle klien.
2. THE System SHALL memastikan `SUPABASE_SERVICE_ROLE_KEY` dan kunci rahasia lain tidak pernah masuk ke bundle klien, dengan menandai setiap modul yang menyentuhnya sebagai Server_Only_Module (`import 'server-only'`).
3. WHEN repository user membaca `app_users` untuk menurunkan CurrentUser, THE System SHALL mengembalikan hanya `{ id, role, workspaceId }` ke lapisan sesi tanpa menyertakan `password_hash`.

## Traceability Note

Pemetaan ringkas requirement ke keputusan desain (DD-A*/DD-E*) dan correctness property (P1–P7):

| Requirement | Keputusan desain | Correctness property |
|---|---|---|
| Req 1 — Middleware AuthN | DD-A7 | — |
| Req 2 — Akses data satu arah | DD-A6, DD-A8, DD-A11 | — |
| Req 3 — Batas server/klien | DD-A9 | P1 |
| Req 4 — Vertical slice + domain murni | DD-A9, DD-A10 | P5 |
| Req 5 — Penyimpanan relasional | DD-A2 | P5 |
| Req 6 — Penomoran aman-race | DD-A2 | P4 |
| Req 7 — Otorisasi di use-case | DD-A3, DD-A7 | P2, P3 |
| Req 8 — Kontrak error | Error Handling | — |
| Req 9 — Lampiran privat lewat id | DD-A9 | — |
| Req 10 — Buat event + alias + validasi | DD-E1, DD-A3 | P3 |
| Req 11 — Sunting event | DD-E1, DD-E4, DD-A3 | P3 |
| Req 12 — Master data venue/EO | DD-A2 | P5 |
| Req 13 — Lifecycle + cancel | DD-E2 | P6 |
| Req 14 — Hapus diblokir + arsip | DD-E3 | P7 |
| Req 15 — Otorisasi peran + PIC | DD-E4 | P2 |
| Req 16 — Dashboard/daftar sisi server | DD-A8, DD-E1/E2/E3 | — |
| Req 17 — Kemurnian domain auth | DD-A12, DD-A9 | P5 |
| Req 18 — Sign-in/sign-out Server Action | DD-A12, DD-A6, DD-A7 | — |
| Req 19 — Authorizer bagian slice auth | DD-A12, DD-A7 | P2, P3 |
| Req 20 — Kerahasiaan hash & service-role key | DD-A12, DD-A9 | P1 |
