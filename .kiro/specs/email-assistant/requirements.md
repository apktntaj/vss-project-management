# Requirements Document

## Introduction

Fitur **Email Assistant** menambahkan dua kemampuan AI berbasis email ke dalam VSS Project
Management, workspace operasional internal freight-forwarding MICE di Indonesia:

1. **Email Suggestion** — saran teks inline ala GitHub Copilot saat pengguna menyusun atau membalas
   email. Sistem menyarankan lanjutan kalimat atau draft balasan yang dapat diterima, diabaikan,
   atau disunting oleh pengguna sebelum dikirim. Saran tidak pernah dikirim otomatis.

2. **Email Correspondence Chat** — antarmuka tanya-jawab bahasa natural. Pengguna mengajukan
   pertanyaan dan jawabannya ditarik serta dirangkum dari riwayat korespondensi email (retrieval /
   RAG atas isi email), disertai rujukan ke email sumber agar jawaban dapat diverifikasi.

Saat ini repo **belum memiliki integrasi email sama sekali** — tidak ada sumber email, tidak ada
penyimpanan korespondensi, dan belum ada klien email. Requirement ini mendefinisikan perilaku yang
diharapkan dari kedua kemampuan AI dan **secara eksplisit menandai keputusan terbuka** (ditandai
`OPEN-DECISION`) yang harus diputuskan sebelum atau saat fase desain, terutama menyangkut sumber
email, penyimpanan korespondensi, pilihan penyedia LLM, dan privasi data.

Fitur ini mengikuti arsitektur data satu arah yang berlaku di repo: komponen client hanya mengakses
data melalui `lib/data-client.ts` yang memanggil Route_Handler `app/api/**`, dan hanya Route_Handler
yang menyentuh Supabase serta penyedia LLM melalui modul `server-only`. Tidak ada `middleware.ts`,
sehingga setiap Route_Handler baru wajib menjaga otentikasi sendiri. Mutasi berjalan lewat Route
Handler, bukan Server Action. Aplikasi bersifat single-tenant; seluruh query menyaring `workspace_id`
dengan slug `default`.

Teks yang dilihat pengguna dan pesan error memakai bahasa Indonesia; identifier, enum, kode error,
nama tabel/kolom memakai bahasa Inggris `SCREAMING_SNAKE_CASE`.

## Glossary

- **System**: Fitur Email Assistant secara keseluruhan (suggestion + chat korespondensi).
- **Email_Suggestion**: Kemampuan auto-complete / saran teks inline saat pengguna menyusun atau
  membalas email.
- **Correspondence_Chat**: Kemampuan tanya-jawab bahasa natural atas riwayat korespondensi email.
- **CurrentUser**: Pemohon terautentikasi `{ id, workspaceId, isAdmin }` yang diturunkan dari sesi
  NextAuth melalui helper konteks (`getEventApiContext()` atau sejenis).
- **Route_Handler**: Endpoint `app/api/**/route.ts` yang menjaga otentikasi sendiri dan memvalidasi
  input dengan Zod sebelum memanggil modul `server-only`.
- **Data_Client**: Modul `'use client'` `lib/data-client.ts`, satu-satunya pintu masuk data dari UI
  ke Route_Handler.
- **Email_Source**: Asal data korespondensi email yang diserap System. Mekanisme konkret belum
  diputuskan (lihat `OPEN-DECISION-1`).
- **Email_Message**: Satu pesan email tunggal berisi metadata (pengirim, penerima, subjek, waktu,
  thread) dan isi badan teks, tersimpan di dalam workspace.
- **Email_Thread**: Rangkaian Email_Message yang saling berbalas dengan subjek atau referensi
  threading yang sama.
- **Correspondence_Store**: Penyimpanan Email_Message dan turunannya di Postgres Supabase, difilter
  per `workspace_id`. Bentuk skema belum diputuskan (lihat `OPEN-DECISION-2`).
- **Retrieval_Index**: Representasi terindeks (mis. embedding vektor dan/atau indeks teks) dari
  Email_Message yang dipakai Correspondence_Chat untuk menemukan email relevan. Mekanisme konkret
  belum diputuskan (lihat `OPEN-DECISION-4`).
- **LLM_Provider**: Penyedia model bahasa yang dikonfigurasi untuk menghasilkan Email_Suggestion dan
  jawaban Correspondence_Chat. Dapat berupa Gemini yang sudah dipakai repo atau penyedia lain; belum
  diputuskan (lihat `OPEN-DECISION-3`).
- **Suggestion_Context**: Masukan yang dikirim ke LLM_Provider untuk menghasilkan Email_Suggestion —
  draft yang sedang disusun, email yang dibalas, dan metadata relevan.
- **Answer_Citation**: Rujukan dari jawaban Correspondence_Chat ke satu atau lebih Email_Message
  sumber (id dan ringkasan identifikasi) sehingga jawaban dapat diverifikasi.
- **Suggestion_Latency**: Selisih waktu antara permintaan Email_Suggestion dan penyajian saran
  kepada CurrentUser.

## Requirements

### Requirement 1: Menyusun dan Membalas Email di Dalam Aplikasi

**User Story:** Sebagai staf operasional, saya ingin menyusun dan membalas email dari dalam aplikasi, agar saya dapat memanfaatkan bantuan AI tanpa berpindah ke aplikasi email terpisah.

#### Acceptance Criteria

1. WHEN CurrentUser membuka penyusun email untuk sebuah Email_Thread, THE System SHALL menampilkan area penyusunan teks yang dapat disunting beserta konteks email yang dibalas (pengirim, penerima, subjek, dan isi pesan terakhir).
2. IF konteks email yang dibalas tidak dapat dimuat karena kesalahan server, THEN THE System SHALL menampilkan area penyusunan teks kosong yang dapat disunting dan menampilkan indikasi kegagalan pemuatan konteks dalam bahasa Indonesia, tanpa memblokir penyusunan draft.
3. THE System SHALL mengizinkan CurrentUser menyunting, menghapus, dan menulis ulang seluruh isi draft sepanjang 0 sampai 50.000 karakter sebelum draft dikirim atau disimpan.
4. WHILE CurrentUser menyusun draft, THE System SHALL TIDAK mengirim email apa pun tanpa tindakan kirim eksplisit dari CurrentUser.
5. IF permintaan membuka penyusun email tiba tanpa sesi terautentikasi, THEN THE Route_Handler SHALL menolak permintaan dengan status 401, kode error `AUTHENTICATION_REQUIRED`, dan pesan `Autentikasi diperlukan.`, tanpa mengembalikan isi email apa pun.
6. WHEN CurrentUser membuka penyusun untuk sebuah Email_Thread di luar `workspace_id` miliknya, THE Route_Handler SHALL menolak permintaan dengan status 404, kode error `THREAD_NOT_FOUND`, dan pesan `Thread email tidak ditemukan.`, tanpa mengembalikan isi email apa pun.
7. IF isi draft melebihi 50.000 karakter saat CurrentUser meminta penyimpanan, THEN THE System SHALL menolak penyimpanan draft, mempertahankan isi draft tanpa perubahan, dan menampilkan pesan kesalahan inline dekat area penyusunan dalam bahasa Indonesia yang menyebutkan batas 50.000 karakter.
8. IF penyimpanan draft gagal karena kesalahan server, THEN THE System SHALL mempertahankan isi draft tanpa perubahan dan menampilkan indikasi kegagalan dalam bahasa Indonesia dekat area penyusunan.

### Requirement 2: Saran Teks Inline (Email Suggestion)

**User Story:** Sebagai staf operasional, saya ingin menerima saran lanjutan kalimat atau draft balasan saat mengetik, agar saya menulis email lebih cepat dengan kualitas yang konsisten.

#### Acceptance Criteria

1. WHEN CurrentUser berhenti mengetik pada area penyusunan selama 500 milidetik atau lebih dan Suggestion_Context berisi minimal 1 karakter teks, THE System SHALL meminta Email_Suggestion dari LLM_Provider berdasarkan Suggestion_Context saat itu.
2. IF CurrentUser berhenti mengetik selama 500 milidetik atau lebih sementara area penyusunan kosong, THEN THE System SHALL TIDAK meminta Email_Suggestion dari LLM_Provider.
3. WHEN LLM_Provider mengembalikan Email_Suggestion dalam Suggestion_Latency maksimum 3 detik, THE System SHALL menampilkan saran sebagai teks inline yang dibedakan secara visual dari teks yang sudah diketik CurrentUser.
4. WHILE sebuah permintaan Email_Suggestion masih menunggu respons, WHEN CurrentUser memicu permintaan baru dengan berhenti mengetik kembali, THE System SHALL membatalkan permintaan sebelumnya dan hanya menyajikan hasil dari permintaan terbaru.
5. WHEN CurrentUser menerima Email_Suggestion melalui tindakan terima eksplisit, THE System SHALL menyisipkan teks saran ke dalam draft pada posisi kursor dan membiarkan hasilnya tetap dapat disunting.
6. WHEN CurrentUser mengabaikan Email_Suggestion melalui tindakan abai eksplisit atau dengan terus mengetik, THE System SHALL membuang saran tersebut tanpa mengubah teks draft yang sudah ada.
7. THE System SHALL membatasi panjang Email_Suggestion yang ditampilkan maksimum 1000 karakter, dan memotong teks saran yang melebihi batas tersebut sebelum ditampilkan.
8. THE System SHALL TIDAK pernah mengirim email maupun mempersist draft hanya karena sebuah Email_Suggestion dihasilkan atau diterima.
9. IF Suggestion_Latency melampaui 3 detik atau permintaan dibatalkan karena CurrentUser melanjutkan mengetik, THEN THE System SHALL membatalkan penyajian saran tersebut, membiarkan draft tidak berubah, dan TIDAK menampilkan pesan error modal maupun notifikasi yang memerlukan tindakan penutupan oleh CurrentUser.
10. IF LLM_Provider mengembalikan galat, THEN THE System SHALL membiarkan draft tidak berubah dan menampilkan indikator berupa teks non-modal yang hilang otomatis dalam waktu maksimum 5 detik dengan pesan `Saran email tidak tersedia saat ini.`
11. WHERE tidak ada LLM_Provider yang dikonfigurasi, THE System SHALL menonaktifkan Email_Suggestion dan menampilkan pesan `Saran email tidak tersedia karena belum ada penyedia LLM yang dikonfigurasi.`
12. IF permintaan Email_Suggestion tiba di Route_Handler tanpa sesi terautentikasi, THEN THE Route_Handler SHALL menolak permintaan dengan status 401, kode error `AUTHENTICATION_REQUIRED`, dan pesan `Autentikasi diperlukan.`, tanpa memanggil LLM_Provider.
13. THE Route_Handler SHALL memanggil LLM_Provider hanya dari modul bertanda `import 'server-only'` dan TIDAK menyertakan kunci API LLM_Provider dalam bundel browser mana pun.

### Requirement 3: Pembatasan Konteks dan Lingkup Saran

**User Story:** Sebagai pemilik sistem, saya ingin saran email hanya memakai konteks dalam workspace pengguna, agar tidak terjadi kebocoran data antar konteks.

#### Acceptance Criteria

1. THE System SHALL menyusun Suggestion_Context hanya dari draft yang sedang disunting CurrentUser, Email_Thread yang sedang dibalas, dan Email_Message milik `workspace_id` CurrentUser.
2. WHEN Route_Handler menerima permintaan Email_Suggestion, THE Route_Handler SHALL memvalidasi di sisi server bahwa setiap Email_Message yang masuk ke Suggestion_Context memiliki `workspace_id` yang sama dengan `workspace_id` CurrentUser sebelum memanggil LLM_Provider.
3. IF satu atau lebih Email_Message pada Suggestion_Context memiliki `workspace_id` yang berbeda dari `workspace_id` CurrentUser, THEN THE Route_Handler SHALL membatalkan permintaan tanpa memanggil LLM_Provider, mempertahankan draft CurrentUser tanpa perubahan, dan mengembalikan pesan kesalahan dalam bahasa Indonesia yang menyatakan konteks tidak berada dalam workspace pengguna.
4. IF Suggestion_Context yang dibangun melebihi batas token yang dikonfigurasi (bernilai maksimum 8000 token jika tidak dikonfigurasi), THEN THE System SHALL memangkas konteks dengan mempertahankan draft saat ini dan Email_Message yang dibalas lebih dulu, lalu memangkas Email_Message lain dari yang paling lama hingga konteks berada pada atau di bawah batas token.
5. IF gabungan draft saat ini dan Email_Message yang dibalas sudah melebihi batas token yang dikonfigurasi, THEN THE System SHALL tetap menyertakan draft saat ini dan Email_Message yang dibalas sebagai konteks minimum tanpa memangkas keduanya.
6. WHEN Route_Handler menerima muatan permintaan Email_Suggestion, THE Route_Handler SHALL memvalidasi muatan tersebut dengan Zod dan, jika muatan tidak valid, menolak permintaan tanpa memanggil LLM_Provider serta mengembalikan pesan kesalahan dalam bahasa Indonesia yang spesifik per field yang gagal divalidasi.
7. IF LLM_Provider tidak tersedia atau gagal merespons dalam batas waktu yang dikonfigurasi (bernilai maksimum 30 detik jika tidak dikonfigurasi), THEN THE Route_Handler SHALL membatalkan pembuatan saran, mempertahankan draft CurrentUser tanpa perubahan, dan mengembalikan pesan kesalahan dalam bahasa Indonesia yang menyatakan layanan saran sedang tidak tersedia.

### Requirement 4: Tanya-Jawab atas Korespondensi Email (Correspondence Chat)

**User Story:** Sebagai staf operasional, saya ingin bertanya dalam bahasa natural tentang riwayat korespondensi email, agar saya cepat menemukan dan merangkum informasi tanpa membaca manual tiap email.

#### Acceptance Criteria

1. WHEN CurrentUser mengirim pertanyaan bahasa natural ke Correspondence_Chat, THE System SHALL mengambil maksimal 20 Email_Message paling relevan dari Retrieval_Index yang terbatas pada `workspace_id` CurrentUser, lalu menghasilkan jawaban dari LLM_Provider berdasarkan email yang terambil.
2. WHEN System menghasilkan jawaban Correspondence_Chat, THE System SHALL menyertakan satu Answer_Citation untuk setiap Email_Message yang menjadi dasar jawaban, di mana setiap Answer_Citation memuat pengenal Email_Message yang dapat dibuka oleh CurrentUser ke email sumbernya.
3. IF Retrieval_Index tidak menemukan Email_Message dengan skor relevansi di atas ambang yang dikonfigurasi untuk pertanyaan, THEN THE System SHALL menampilkan pesan `Tidak ditemukan korespondensi email yang relevan dengan pertanyaan Anda.` dan TIDAK menghasilkan jawaban dari LLM_Provider.
4. WHEN LLM_Provider mengembalikan jawaban dalam batas waktu 30 detik, THE System SHALL menampilkan jawaban beserta seluruh Answer_Citation terkait kepada CurrentUser.
5. IF pembuatan jawaban melampaui batas waktu 30 detik, THEN THE Route_Handler SHALL menghentikan pemanggilan LLM_Provider, mengembalikan status 503 dengan kode error `CHAT_ANSWER_FAILED` dan pesan `Gagal menghasilkan jawaban. Silakan coba lagi.`, serta TIDAK menyimpan jawaban parsial.
6. IF LLM_Provider mengembalikan galat atau respons kosong, THEN THE Route_Handler SHALL mengembalikan status 503 dengan kode error `CHAT_ANSWER_FAILED` dan pesan `Gagal menghasilkan jawaban. Silakan coba lagi.`, serta TIDAK menyimpan jawaban parsial.
7. THE Route_Handler SHALL membatasi pengambilan Email_Message pada `workspace_id` CurrentUser di sisi server dan TIDAK mengembalikan Email_Message milik workspace lain.
8. IF permintaan Correspondence_Chat tiba tanpa sesi terautentikasi, THEN THE Route_Handler SHALL menolak permintaan dengan status 401, kode error `AUTHENTICATION_REQUIRED`, dan pesan `Autentikasi diperlukan.`, tanpa memanggil Retrieval_Index maupun LLM_Provider.
9. WHERE tidak ada LLM_Provider yang dikonfigurasi, THE System SHALL menonaktifkan Correspondence_Chat dan menampilkan pesan `Chat korespondensi tidak tersedia karena belum ada penyedia LLM yang dikonfigurasi.`
10. IF muatan pertanyaan yang divalidasi Zod kosong setelah trim, THEN THE Route_Handler SHALL menolak permintaan dengan status 400 dan pesan `Pertanyaan wajib diisi.`
11. IF muatan pertanyaan yang divalidasi Zod melampaui 2.000 karakter, THEN THE Route_Handler SHALL menolak permintaan dengan status 400 dan pesan `Pertanyaan tidak boleh melebihi 2.000 karakter.`

### Requirement 5: Penyerapan dan Penyimpanan Korespondensi Email

**User Story:** Sebagai pemilik sistem, saya ingin korespondensi email tersimpan dan terindeks di dalam workspace, agar kedua kemampuan AI memiliki sumber data yang konsisten.

#### Acceptance Criteria

1. WHEN sebuah Email_Message yang valid diserap dari Email_Source, THE System SHALL mempersist metadata (pengirim, penerima, subjek, waktu, identitas thread) dan isi badan hingga maksimum 10 MB per pesan ke Correspondence_Store pada `workspace_id` yang bersesuaian.
2. WHEN sebuah Email_Message berhasil dipersist ke Correspondence_Store, THE System SHALL membangun atau memperbarui representasi Retrieval_Index untuk email tersebut sehingga dapat ditemukan oleh Correspondence_Chat.
3. IF sebuah Email_Message yang diserap memiliki pengidentifikasi pesan (message-id) yang identik dengan Email_Message yang sudah tersimpan pada `workspace_id` yang sama, THEN THE System SHALL memperbarui entri yang ada tanpa membuat baris baru pada Correspondence_Store dan TIDAK menghasilkan duplikat.
4. THE System SHALL menyimpan dan mengindeks Email_Message melalui modul bertanda `import 'server-only'` dan TIDAK mengekspos kredensial Email_Source maupun LLM_Provider ke bundel browser.
5. IF penyerapan sebuah Email_Message gagal dipersist, THEN THE System SHALL TIDAK membuat entri Retrieval_Index parsial untuk email tersebut.
6. IF pembangunan atau pembaruan Retrieval_Index gagal setelah Email_Message dipersist, THEN THE System SHALL menandai email tersebut sebagai belum terindeks dan menjaga Correspondence_Store tetap konsisten tanpa entri Retrieval_Index parsial.
7. IF Email_Source tidak dapat dijangkau atau sebuah Email_Message yang diserap tidak dapat diurai menjadi metadata dan badan yang valid, THEN THE System SHALL membatalkan penyerapan pesan tersebut, TIDAK menulis apa pun ke Correspondence_Store, dan mengembalikan indikasi kegagalan dalam bahasa Indonesia kepada pemanggil.
8. WHEN THE Route_Handler membaca Correspondence_Store, THE Route_Handler SHALL memfilter seluruh pembacaan berdasarkan `workspace_id` CurrentUser di sisi server.
9. IF sebuah pembacaan Correspondence_Store menargetkan Email_Message di luar `workspace_id` CurrentUser, THEN THE Route_Handler SHALL menolak permintaan tersebut dan TIDAK mengembalikan data email dari workspace lain.

### Requirement 6: Kontrol Privasi Data dan Audit

**User Story:** Sebagai pemilik sistem, saya ingin kontrol dan transparansi atas data email yang dikirim ke LLM_Provider, agar penggunaan data korespondensi dapat dipertanggungjawabkan.

#### Acceptance Criteria

1. WHEN System menyusun payload Email_Suggestion atau Correspondence_Chat untuk LLM_Provider, THE System SHALL menyertakan hanya Email_Message yang `workspace_id`-nya sama persis dengan `workspace_id` CurrentUser.
2. IF payload yang akan dikirim ke LLM_Provider memuat Email_Message dengan `workspace_id` berbeda dari `workspace_id` CurrentUser, THEN THE System SHALL membatalkan pemanggilan LLM_Provider, tidak mengirim isi email apa pun, dan menampilkan pesan error bahasa Indonesia yang menyatakan akses data lintas workspace ditolak.
3. WHEN System memanggil LLM_Provider dengan payload yang memuat isi email, THE System SHALL mencatat satu entri audit berisi `userId`, `workspace_id`, waktu pemanggilan dalam format timestamp UTC presisi milidetik, dan jenis operasi bernilai `EMAIL_SUGGESTION` atau `CORRESPONDENCE_CHAT`, tanpa menyertakan nilai kunci API LLM_Provider pada entri tersebut.
4. WHILE LLM_Provider dikonfigurasi sebagai layanan pihak ketiga eksternal, THE System SHALL menampilkan penanda visual permanen pada antarmuka Email_Suggestion dan Correspondence_Chat yang menyatakan isi email dikirim ke layanan eksternal untuk diproses.
5. THE System SHALL menyimpan kunci API LLM_Provider, kredensial Email_Source, dan `SUPABASE_SERVICE_ROLE_KEY` hanya pada variabel environment server tanpa prefix `NEXT_PUBLIC_`, sehingga nilai-nilai tersebut tidak pernah dimuat ke dalam bundel yang dikirim ke browser.

### Requirement 7: Navigasi, Umpan Balik, dan Aksesibilitas

**User Story:** Sebagai staf operasional, saya ingin umpan balik yang jelas dan antarmuka yang dapat diakses untuk fitur email, agar nyaman dan konsisten dengan bagian aplikasi lain.

#### Acceptance Criteria

1. WHEN sebuah tindakan Email_Assistant (menyimpan draft atau mengirim pertanyaan Correspondence_Chat) berhasil, THE System SHALL menampilkan notifikasi (toast) bernada sukses di sudut kanan bawah viewport dalam 500 milidetik setelah tindakan selesai.
2. WHEN sebuah notifikasi (toast) sukses telah tampil selama 4 detik, THE System SHALL menutup notifikasi tersebut secara otomatis.
3. IF sebuah tindakan Email_Assistant gagal, THEN THE System SHALL menampilkan notifikasi (toast) bernada gagal di sudut kanan bawah viewport yang berisi pesan dalam bahasa Indonesia yang mengindikasikan penyebab kegagalan, mempertahankan input pengguna tanpa perubahan, dan menutup notifikasi tersebut secara otomatis setelah 4 detik.
4. WHILE System memuat jawaban Correspondence_Chat atau data korespondensi, THE System SHALL menampilkan indikator pemuatan memakai pola `PageSkeleton`/`finishLoadingAfterMinimum` repo dengan durasi tampil minimum 300 milidetik dan maksimum 30 detik sebelum menampilkan status gagal muat.
5. IF pemuatan jawaban Correspondence_Chat atau data korespondensi melebihi 30 detik atau mengembalikan kegagalan, THEN THE System SHALL menghentikan indikator pemuatan dan menampilkan notifikasi (toast) bernada gagal dalam bahasa Indonesia yang mengindikasikan kegagalan pemuatan.
6. THE System SHALL merender setiap kontrol interaktif fitur email dengan `aria-label` dalam bahasa Indonesia yang tidak kosong, menyediakan outline `focus-visible` yang terlihat pada setiap elemen yang menerima fokus keyboard, dan menonaktifkan animasi non-esensial ketika `prefers-reduced-motion: reduce` aktif.
7. WHEN System menampilkan Email_Suggestion inline, THE System SHALL menyertakan penanda teks dalam bahasa Indonesia yang dapat dibaca pembaca layar yang menyatakan bahwa teks tersebut adalah saran dan belum menjadi bagian draft.
## Keputusan Terbuka (Open Decisions)

Keputusan berikut belum ditetapkan dan harus diputuskan sebelum atau selama fase desain. Masing-masing
memengaruhi requirement di atas; pilihan final dapat menambah atau mengubah acceptance criteria.

- **OPEN-DECISION-1 — Sumber email (Email_Source).** Dari mana korespondensi email diserap?
  Kandidat: IMAP generik, Gmail API, Microsoft Graph (Outlook/Exchange), atau unggah manual (mis.
  file `.eml`/`.mbox`). Pilihan ini menentukan model otentikasi (OAuth vs kredensial), mekanisme
  sinkronisasi (polling vs webhook/push), dan kebutuhan variabel environment baru.

- **OPEN-DECISION-2 — Skema penyimpanan korespondensi (Correspondence_Store).** Apakah mengikuti pola
  hibrida repo (`workspace_id` + `id` + `payload` jsonb dengan kolom dipromosikan) dan didaftarkan di
  `operationalTables`, atau memakai tabel kolom penuh khusus email? Perlu diputuskan juga apakah
  butuh migrasi tabel baru untuk thread, message, dan lampiran email.

- **OPEN-DECISION-3 — Penyedia LLM (LLM_Provider).** Memakai Gemini yang sudah terpasang di
  `lib/server/` (mis. `gemini-3.5-flash-lite`) ataukah penyedia lain? Suggestion membutuhkan latensi
  rendah sementara chat/RAG membutuhkan konteks lebih panjang; kemungkinan dua model berbeda untuk
  dua kemampuan. Perlu keputusan soal variabel kredensial dan abstraksi provider.

- **OPEN-DECISION-4 — Mekanisme retrieval (Retrieval_Index).** Pencarian embedding vektor (mis.
  ekstensi `pgvector` di Supabase), pencarian teks penuh Postgres, atau kombinasi keduanya (hybrid)?
  Pilihan ini menentukan kebutuhan ekstensi database, proses embedding saat penyerapan, dan biaya.

- **OPEN-DECISION-5 — Privasi dan pengiriman data ke layanan eksternal.** Apakah diizinkan mengirim
  isi email ke LLM pihak ketiga, dan apakah perlu opsi redaksi/anonimisasi, retensi, atau mode
  on-premise/self-hosted? Perlu persetujuan kebijakan data perusahaan.

- **OPEN-DECISION-6 — Otorisasi per peran.** Repo saat ini hanya menegakkan flag `isAdmin`
  (gap `G-1`). Perlu diputuskan apakah akses Email_Assistant dibatasi peran tertentu atau terbuka
  untuk semua pengguna terautentikasi, dan apakah pengguna hanya boleh melihat korespondensi tertentu.

- **OPEN-DECISION-7 — Pengiriman email keluar (outbound).** Apakah draft yang disusun benar-benar
  dikirim keluar oleh aplikasi (SMTP/API penyedia) atau hanya disalin pengguna ke klien email mereka?
  Requirement 1–2 saat ini mengasumsikan penyusunan draft; pengiriman keluar belum termasuk lingkup
  dan perlu keputusan terpisah.

- **OPEN-DECISION-8 — Penempatan rute dan navigasi.** Rute dashboard baru (`/email` atau sejenisnya),
  flag `available` di `components/layout.tsx`, serta apakah chat dan penyusun email adalah satu
  halaman atau terpisah.
