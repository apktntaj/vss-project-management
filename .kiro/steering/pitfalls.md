# Jebakan yang Diketahui

Proyek ini tumbuh cepat tanpa standar yang ketat. Daftar ini adalah kondisi nyata hasil
pemeriksaan kode, bukan dugaan. Tujuannya dua: jangan kaget saat menemukannya, dan jangan
memperbanyaknya.

## Dokumentasi lama yang menyesatkan

`AGENTS.md`, `README.md`, dan dokumen di `docs/` masih memuat klaim dari arsitektur sebelumnya:
IndexedDB sebagai storage, `@/lib/indexeddb`, `lib/file.ts`, `lib/mock-data.ts`, endpoint `/api/data`,
tabel EAV `app_records`, mutasi lewat Server Action. **Semuanya tidak berlaku.** Kalau ada konflik,
steering ini dan kode yang menang. Jangan mengutip dokumen lama sebagai dasar desain.

## Jangan diperbanyak

| Kondisi | Lokasi | Yang harus dilakukan |
|---|---|---|
| `lib/data-client.ts` 1702 baris berisi ±70 fungsi untuk semua domain | `lib/data-client.ts` | Tetap tambahkan fungsi baru di sini supaya batas data tunggal terjaga, tapi pertimbangkan memecah per domain kalau fitur besar |
| Halaman monolit 400–710 baris | `app/(dashboard)/events/page.tsx`, `jobs/page.tsx`, `jobs/[id]/page.tsx`, `events/[id]/page.tsx` | Pisahkan komponen ke `components/` untuk fitur baru |
| Helper `toast()` disalin ke 5+ komponen | lihat steering conventions | Impor helper bersama |
| `getEventApiContext` disalin manual sebagai `context()` lokal | `app/api/event-records/route.ts` | Impor dari `lib/supabase/event-api.ts` |
| Model Gemini `'gemini-3.5-flash-lite'` di-hardcode di 3 tempat | `lib/server/document-extraction.ts`, `lib/server/manifest-extraction.ts`, `app/api/parse-shipment/route.ts` | Jadikan satu konstanta bersama kalau menyentuh salah satunya |
| Batas 10 MB dokumen diduplikasi | sama seperti di atas | idem |
| Filter di browser setelah membaca seluruh tabel | banyak fungsi `list*` di `data-client` | Buat endpoint dengan filter server-side |

## Celah korektual

- **Invariant exhibition hanya dijaga di browser.** Lima validator di
  `domain/exhibition/validation.ts` dipanggil dari `lib/data-client.ts`. Request langsung ke
  `PUT /api/operational-records?table=customs_jobs` melewati seluruhnya. Fitur baru yang menyentuh
  alokasi item atau transisi status harus memvalidasi di server.
- **Penomoran `VSS-XXXXX` rawan race.** `createCustomsJob` membaca counter, menambah 1, lalu menulis
  counter dan job secara paralel dengan `Promise.all` dari browser. Tidak ada transaksi dan tidak ada
  unique constraint. Dua user bersamaan menghasilkan nomor duplikat.
- **Otorisasi per role tidak ada.** Hanya `isAdmin` yang dijaga. Lihat gap `G-1` di
  `.kiro/requirements.md`.
- **`DELETE /api/events/[eventId]`** membatasi hapus ke PIC, tetapi event lama tanpa PIC bebas dihapus
  siapa pun — lubang yang disengaja untuk data legacy.
- **`remove()` di `data-client` fire-and-forget**: `void records<void>(...)` — kegagalan DELETE
  tidak pernah terlihat oleh pemanggil.
- **Alasan reopen ticket tidak tersimpan** menurut `docs/PRD_BASELINE_IMPLEMENTASI.md`: parameter
  `p_reopen_reason` diteruskan tapi tidak dipakai oleh fungsi SQL-nya. Verifikasi dulu sebelum
  membangun di atas data itu.

## Duplikasi dan ketidakkonsistenan tipe

- **`CiplStatus` didefinisikan dua kali dengan anggota berbeda**:
  `domain/exhibition/types.ts` (`AWAITING_DOCUMENT | RECEIVED | UNDER_REVIEW | READY | ON_HOLD | CANCELLED`)
  versus tipe privat di `lib/job-operational-phase.ts` (`MISSING | REQUESTED | RECEIVED | VERIFIED`).
  Hanya `RECEIVED` yang sama. Pastikan kamu memakai yang sesuai pipeline.
- **`BcDocumentKind`** punya 4 nilai termasuk `BC_2_7`, tetapi `CustomsJob.documentType` di
  `domain/exhibition/types.ts` hanya menuliskan 3 secara inline. `BC_2_7` tidak ada di model CustomsJob.
- **`LegacyJobStatus`** dideklarasikan non-export di `lib/job-operational-phase.ts`, di luar `domain/`.
- **Status event** dihitung di komponen halaman, bukan di domain.
- Dua format nomor job: Legacy `VSS-XXXX` (4 digit) vs Customs `VSS-XXXXX` (5 digit) — gap `G-6`.

## Kode mati

- **Seluruh `domain/v2/`** tidak dipakai runtime. Ini meta-model eksplorasi (`Information<T>`
  known/unknown/not-applicable/conflicting, `Project`/`Task`) yang diturunkan dari analisis chat
  operasional. **Jangan dihapus** — `npm run domain:test`, `domain:demo`, dan
  `domain:validate-samples` mereferensikannya. Jangan pula memakainya sebagai dasar fitur baru
  tanpa keputusan eksplisit.
- `domain/user/user.ts` — tidak ada importer selain testnya.
- `domain/agent/validation.ts` (`agentInputSchema`) — tidak dipakai; route agent memakai
  `addAgentSchema` lokal.
- Dependency `cn` dan `nanoid`: `cn` hanya dipakai `components/ui/`, `nanoid` hanya `lib/tokens.ts`.
- Entri `tickets` di `collectionTable` pada `data-client` sudah tidak relevan — `tickets` tidak ada di
  `operationalTables`, jadi lewat jalur itu akan 400. Ticket memakai `/api/tickets`.

## Keamanan yang harus dijaga

- Jangan pernah mengekspos `SUPABASE_SERVICE_ROLE_KEY`, `CEISA_CREDENTIAL_ENCRYPTION_KEY`, atau
  `LARTAS_TOKEN` ke client bundle. Jangan hapus `import 'server-only'` dari modul mana pun.
- Kredensial CEISA terenkripsi AES-256-GCM di `ceisa_connections`; `ceisaSettings()` hanya
  mengembalikan boolean `hasCompanyId`/`hasIdPlatform`, bukan plaintext. Pertahankan sifat itu.
- **Soal password, gap `G-2` di `.kiro/requirements.md` sudah usang.** Jalur produksi sudah benar:
  `lib/auth/password.ts` memakai scrypt dengan salt acak, nilai hash self-describing berversi, dan
  perbandingan `timingSafeEqual`; hash disimpan di `app_users.password_hash`.
  `lib/demo-users.ts` dengan password plaintext hanya aktif saat Supabase belum dikonfigurasi **dan**
  `NODE_ENV !== 'production'`. Jangan memperluas jalur demo itu.
- Tidak ada `middleware.ts`. Route handler baru **tidak** terlindungi otomatis — tulis guard-nya.

## Catatan untuk fitur baru

Sebelum mulai, putuskan dan tulis eksplisit:

1. Pipeline mana yang disentuh — Legacy Job atau CIPL→Shipment→CustomsJob (atau keduanya).
2. Invariant apa yang berlaku, dan validasinya ditempatkan di route handler mana.
3. Apakah butuh tabel baru (tambah migrasi + daftarkan di `operationalTables`) atau cukup tabel yang ada.
4. Apakah ada aturan otorisasi — kalau ya, implementasikan, jangan asumsikan sudah ada.
5. File test baru harus didaftarkan ke script `domain:test`.
