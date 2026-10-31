# Implementation Plan — Email Assistant

## Overview

Rencana implementasi increment pertama fitur Email Assistant: composer email dengan saran inline
(`Email_Suggestion`) dan tanya-jawab korespondensi berbasis RAG (`Correspondence_Chat`). Urutan tugas
mengikuti arah aliran data satu arah repo — dari dalam (migrasi + domain) ke luar (route handler →
data-client → komponen → wiring). Setiap tugas membangun di atas keluaran tugas sebelumnya sehingga
tidak ada kode menggantung yang tidak terintegrasi.

Batas lingkup increment ini (lihat design "Pemetaan Open Decisions"):
- Email_Source: unggah manual `.eml`/`.mbox` (OD-1). IMAP/outbound SMTP = tugas opsional/future.
- Store: migrasi dedikasi `email_*` + `llm_audit_log` (OD-2/OD-4).
- LLM: pakai ulang abstraksi provider repo `resolveLlmProvider()` (OD-3), bukan hardcode model.
- Otorisasi: setiap pengguna terautentikasi dalam workspace (OD-6); guard di tiap route handler.

Konvensi yang dipegang: deskripsi tugas bahasa Indonesia; identifier/path/enum bahasa Inggris. Semua
modul `lib/server/email/*` dan `lib/supabase/email/*` diawali `import 'server-only'`. Isolasi
workspace ditegakkan di route handler. Toast via `lib/toast.ts` bersama, bukan salinan.

## Tasks

- [ ] 1. Migrasi database untuk Correspondence_Store + audit LLM
  - Buat `supabase/migrations/<ts>_email_assistant.sql` (timestamp urut mengikuti konvensi folder):
    `create extension if not exists vector`; tabel `email_threads`, `email_messages`
    (kolom `message_id`, `embedding vector(1536)`, `body_tsv tsvector`, `indexed boolean`,
    `unique (workspace_id, message_id)`), `email_drafts`, dan `llm_audit_log`
    (`operation` CHECK in `EMAIL_SUGGESTION`/`CORRESPONDENCE_CHAT`, `invoked_at` UTC).
  - Index `(workspace_id, thread_id, sent_at desc)`, ivfflat pada `embedding`, gin pada `body_tsv`,
    `(workspace_id, invoked_at desc)` untuk audit.
  - FK `workspace_id ... on delete cascade`, `enable row level security`, dan
    `revoke all ... from anon, authenticated` untuk keempat tabel. Komentar *kenapa* di awal file,
    idempoten (`if not exists`).
  - _Requirements: 5.1, 5.3, 5.8, 6.3, 6.5_

- [ ] 2. Tipe domain, skema Zod, dan validator invariant
  - [ ] 2.1 Definisikan tipe entitas di `domain/email/types.ts`
    - `EmailAddress`, `EmailMessage` (termasuk `messageId`, `indexed`), `EmailThread`,
      `EmailDraft`, `Citation`, `CorrespondenceAnswer` (union `NO_RELEVANT`), `LlmOperation`.
    - Storage-agnostic: tanpa `Blob`/`File`/tipe Supabase. Field `camelCase` sesuai `payload` jsonb.
    - _Requirements: 1.3, 4.2, 5.1_
  - [ ] 2.2 Buat skema Zod + validator invariant di `domain/email/validation.ts`
    - `emailDraftSchema` (body `max(50_000)`), `emailSuggestionSchema` (draft `min(1).max(50_000)`,
      `cursor` int ≥ 0), `chatQuestionSchema` (`trim().min(1).max(2_000)`), semua `.strict()`,
      pesan error bahasa Indonesia per field.
    - `assertMessagesInWorkspace(workspaceId, messages): Validation<true>` memakai helper
      `@/domain/shared/validation` (`fromIssues`/`issue`/`ok`) — murni, tidak throw, kumpulkan semua
      issue; dipakai dari route handler.
    - Util murni `truncateSuggestion(text): string` yang memotong ke ≤ 1000 karakter (untuk Property 5).
    - _Requirements: 1.7, 2.1, 2.7, 3.2, 3.3, 4.10, 4.11, 6.1, 6.2_
  - [ ]* 2.3 Tulis property test `domain/email/validation.test.ts`
    - **Property 1: Isolasi workspace pada konteks saran** (`assertMessagesInWorkspace` ok iff tak ada
      workspace berbeda). **Validates: Requirements 3.2, 3.3, 6.1, 6.2**
    - **Property 5: Potong panjang saran** (`truncateSuggestion` selalu ≤ 1000 char).
      **Validates: Requirements 2.7**
    - Pakai `fast-check` + `bun:test`, ≥ 100 iterasi, tag `// Feature: email-assistant, Property N`.

- [ ] 3. Config, error, dan route-failure bersama untuk modul email (server-only)
  - [ ] 3.1 Buat `lib/server/email/config.ts`
    - `EMAIL_SUGGESTION_TIMEOUT_MS = 3_000`, `EMAIL_CHAT_TIMEOUT_MS = 30_000`,
      `SUGGESTION_MAX_CHARS = 1000`, `CONTEXT_MAX_TOKENS` (env `EMAIL_CONTEXT_MAX_TOKENS` || 8000),
      `CHAT_MAX_MESSAGES = 20`, `RETRIEVAL_THRESHOLD` (env `EMAIL_RETRIEVAL_THRESHOLD` || 0.75),
      `MAX_MESSAGE_BODY_SIZE = 10 * 1024 * 1024`. Awali `import 'server-only'`.
    - _Requirements: 2.7, 3.4, 4.1, 5.1_
  - [ ] 3.2 Buat `lib/server/email/errors.ts` dan `lib/server/email/route-failure.ts`
    - `EmailAssistantError` dengan `status` + `code` (meniru `DocumentExtractionError`) dan konstanta
      pesan bahasa Indonesia untuk tiap kode pada tabel Error Handling design.
    - `emailRouteFailure(error)` memetakan: `ZodError` → 400 pesan per-field; `EmailAssistantError`
      → status+code; `'Autentikasi diperlukan.'` → 401 `AUTHENTICATION_REQUIRED`; sisanya delegasi ke
      `eventApiFailure`. Bentuk respons `{ error, code }`.
    - _Requirements: 1.5, 1.7, 2.11, 2.12, 3.3, 3.6, 3.7, 4.5, 4.6, 4.8, 4.9, 4.10, 4.11, 5.7, 6.2_

- [ ] 4. Provider LLM email lewat abstraksi yang sudah ada
  - Buat `lib/server/email/provider.ts` (`import 'server-only'`): `resolveEmailProvider()` membungkus
    `resolveLlmProvider()` dari `lib/server/extraction/llm/provider.ts` dan mengekspos dua operasi —
    `suggest(context): Promise<string>` dan `answer(question, messages): Promise<{ answer, citations }>`.
    Tidak mengimplementasikan LLM dari nol, tidak menghardcode nama model; model terpusat di config
    extraction yang ada (`LLM_PROVIDER`/`LLM_MODEL`). Kembalikan `null` bila provider belum dikonfigurasi.
  - _Requirements: 2.11, 2.13, 4.9, 6.5_

- [ ] 5. Storage server-only untuk thread, message, draft, retrieval
  - [ ] 5.1 Buat `lib/supabase/email/threads.ts` dan `lib/supabase/email/messages.ts`
    - `getThread`/`listThreads`, `getThreadMessages`, `upsertMessage` — semua terima `workspaceId`
      dan **selalu** memfilter `WHERE workspace_id = $1`. `upsertMessage` upsert by
      `(workspace_id, message_id)` agar idempoten. Awali `import 'server-only'`, pakai service-role
      client + pola `getEventApiContext()`/`workspaceId()` yang ada.
    - _Requirements: 5.1, 5.3, 5.8, 5.9, 1.6_
  - [ ] 5.2 Buat `lib/supabase/email/drafts.ts`
    - `saveDraft(workspaceId, draft)` upsert by id; tulis `payload` + kolom promosi konsisten.
    - _Requirements: 1.3, 1.8_
  - [ ] 5.3 Buat `lib/supabase/email/retrieval.ts`
    - `similarMessages(workspaceId, queryVector, k, threshold)`: query pgvector
      `WHERE workspace_id = $1 ORDER BY embedding <=> $2 LIMIT k`, saring skor di bawah ambang di
      server. Tidak pernah mengembalikan pesan workspace lain.
    - _Requirements: 4.1, 4.7, 5.8, 5.9_
  - [ ]* 5.4 Tulis property test `lib/server/email/retrieval.test.ts`
    - **Property 2: Konteks tidak pernah memuat pesan workspace lain** dengan store in-memory mock.
      **Validates: Requirements 4.1, 4.7, 5.8, 5.9**
    - `fast-check` + `bun:test`, ≥ 100 iterasi, tag `// Feature: email-assistant, Property 2`.

- [ ] 6. Service logic email (server-only)
  - [ ] 6.1 Buat `lib/server/email/context-builder.ts`
    - `buildSuggestionContext(draft, repliedMessage, otherMessages, workspaceId)`: panggil
      `assertMessagesInWorkspace` (batalkan bila gagal), selalu pertahankan draft + email yang
      dibalas, pangkas email lain dari yang paling lama sampai ≤ `CONTEXT_MAX_TOKENS`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2_
  - [ ]* 6.2 Tulis property test `lib/server/email/context-builder.test.ts`
    - **Property 3: Pemangkasan konteks mempertahankan minimum dan menghormati batas.**
      **Validates: Requirements 3.4, 3.5**
    - `fast-check` + `bun:test`, ≥ 100 iterasi, tag `// Feature: email-assistant, Property 3`.
  - [ ] 6.3 Buat `lib/server/email/embeddings.ts` dan `lib/server/email/audit.ts`
    - `embedMessage(body)` / `embedQuery(question)` mengikuti provider; fallback full-text `body_tsv`
      bila embedding tak didukung. `writeAuditEntry({ userId, workspaceId, operation })` menulis
      `llm_audit_log` tanpa kunci API maupun isi email, `invoked_at` UTC presisi milidetik.
    - _Requirements: 4.1, 6.3_
  - [ ] 6.4 Buat `lib/server/email/suggestion-service.ts`
    - `generateSuggestion(workspaceId, input)`: ambil pesan thread (server-side, workspace sendiri),
      bangun konteks, panggil `resolveEmailProvider().suggest()` dengan timeout
      `EMAIL_SUGGESTION_TIMEOUT_MS`, potong hasil via `truncateSuggestion`, catat audit
      `EMAIL_SUGGESTION`. Lempar `EmailAssistantError` untuk LLM tak dikonfigurasi/timeout/galat.
    - _Requirements: 2.3, 2.7, 2.11, 3.3, 3.7, 6.1, 6.2, 6.3_
  - [ ] 6.5 Buat `lib/server/email/chat-service.ts`
    - `answerCorrespondence(workspaceId, userId, question)`: `embedQuery` → `similarMessages`; bila
      kosong di atas ambang kembalikan `{ answer: null, reason: 'NO_RELEVANT' }` **tanpa** memanggil
      LLM; bila ada panggil `provider.answer()` dengan timeout `EMAIL_CHAT_TIMEOUT_MS`, pastikan tiap
      `citation.messageId` ⊆ pesan terambil, catat audit `CORRESPONDENCE_CHAT`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.3_
  - [ ]* 6.6 Tulis property test `lib/server/email/chat-service.test.ts`
    - **Property 6: Tanpa sitasi tidak ada jawaban; dan setiap jawaban bersitasi** dengan provider
      mock. **Validates: Requirements 4.1, 4.2, 4.3**
    - `fast-check` + `bun:test`, ≥ 100 iterasi, tag `// Feature: email-assistant, Property 6`.
  - [ ] 6.7 Buat `lib/server/email/ingestion-service.ts`
    - Parse `.eml`/`.mbox` → `EmailMessage`, persist-first via `upsertMessage` (idempoten by
      `message_id`), lalu index; bila index gagal tandai `indexed = false` tanpa entri index parsial;
      bila parse/persist gagal tidak menulis apa pun dan lempar `INGEST_FAILED`.
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7_
  - [ ]* 6.8 Tulis property test `lib/server/email/ingestion-service.test.ts`
    - **Property 4: Penyerapan idempoten terhadap message-id** dan **Property 8: Konsistensi store saat
      index gagal** dengan store mock. **Validates: Requirements 5.3, 5.5, 5.6**
    - `fast-check` + `bun:test`, ≥ 100 iterasi, tag `// Feature: email-assistant, Property N`.

- [ ] 7. Checkpoint — pastikan semua test lulus
  - Pastikan seluruh property test yang ditulis lulus; tanyakan ke pengguna bila ada pertanyaan.

- [ ] 8. Route handlers dengan guard auth + isolasi workspace server-side
  - Semua route set `export const runtime = 'nodejs'` + `export const dynamic = 'force-dynamic'`,
    pakai `getEventApiContext()` dalam `try`, `return emailRouteFailure(error)` dalam `catch`.
  - [ ] 8.1 `app/api/email/capabilities/route.ts` (GET)
    - Kembalikan `{ llmAvailable: boolean }` dari `resolveEmailProvider()`; guard 401 tanpa sesi.
    - _Requirements: 2.11, 4.9_
  - [ ] 8.2 `app/api/email/threads/[threadId]/route.ts` (GET)
    - Konteks thread untuk composer; 404 `THREAD_NOT_FOUND` bila thread di luar workspace; 401 tanpa
      sesi; tidak mengembalikan isi email lintas-workspace.
    - _Requirements: 1.1, 1.5, 1.6, 5.8, 5.9_
  - [ ] 8.3 `app/api/email/drafts/route.ts` (POST)
    - `emailDraftSchema.parse` → 400/`DRAFT_TOO_LARGE` bila > 50.000 char; `saveDraft`; guard 401.
      Tidak ada outbound send.
    - _Requirements: 1.3, 1.4, 1.7, 1.8_
  - [ ] 8.4 `app/api/email/suggest/route.ts` (POST)
    - `emailSuggestionSchema.parse` → 400 per-field; 503 `LLM_NOT_CONFIGURED` bila provider null;
      panggil `generateSuggestion` (yang enforce isolasi + trim + timeout); guard 401 tanpa memanggil
      LLM. Dukung pembatalan via `request.signal`.
    - _Requirements: 2.1, 2.4, 2.7, 2.11, 2.12, 2.13, 3.2, 3.3, 3.6, 3.7, 6.2, 6.3_
  - [ ] 8.5 `app/api/email/chat/route.ts` (POST)
    - `chatQuestionSchema.parse` → 400 kosong/>2000; 503 `LLM_NOT_CONFIGURED` bila provider null;
      panggil `answerCorrespondence`; `NO_RELEVANT` → 200 tanpa jawaban; timeout/galat → 503
      `CHAT_ANSWER_FAILED` tanpa simpan parsial; guard 401 tanpa memanggil retrieval/LLM.
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 6.3_
  - [ ] 8.6 `app/api/email/ingest/route.ts` (POST)
    - Terima unggahan `.eml`/`.mbox` (multipart), panggil `ingestion-service`; 503 `INGEST_FAILED`
      bila tak terurai; guard 401; filter workspace server-side.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 5.8_

- [ ] 9. Fungsi data-client (satu-satunya pintu masuk data UI)
  - Tambah di `lib/data-client.ts` (pola `fetch(..., { cache: 'no-store' })`):
    `getEmailAssistantCapabilities()`, `getEmailThread(threadId)` (404-aware),
    `saveEmailDraft(draft)`, `requestEmailSuggestion(input, signal?)` (teruskan `AbortSignal`),
    `askCorrespondence(question)`, dan `ingestEmailFile(file)`. Baca field `error` dari respons dan
    lempar `Error` berpesan Indonesia. Opsional: daftarkan `email_threads`/`email_drafts` di
    `collectionTable` bila perlu pembacaan generik.
  - _Requirements: 1.1, 1.3, 2.1, 2.4, 4.1, 5.1_

- [ ] 10. Helper toast bersama
  - Buat `lib/toast.ts` berisi `toast(message, tone)` yang `dispatchEvent('vss:toast')` dengan guard
    `typeof window === 'undefined'`. Komponen email meng-`import { toast } from '@/lib/toast'` —
    tidak menyalin helper. (Tidak memformat ulang komponen lama yang masih menyalin helper.)
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 11. Komponen React fitur email
  - [ ] 11.1 `components/email-inline-suggestion.tsx` dan `components/llm-external-badge.tsx`
    - Render saran inline dibedakan visual + penanda screen reader bahasa Indonesia (R7.7); badge
      permanen "isi email dikirim ke layanan eksternal" (R6.4). `aria-label` non-kosong,
      `focus-visible`, hormati `prefers-reduced-motion`.
    - _Requirements: 2.3, 6.4, 7.6, 7.7_
  - [ ] 11.2 `components/email-thread-context.tsx` dan `components/email-composer.tsx`
    - Composer: area teks editable (0–50.000 char), debounce 500ms memicu `requestEmailSuggestion`,
      batalkan request sebelumnya via `AbortController` (R2.4), sisipkan saran di posisi kursor saat
      diterima (R2.5), buang saat diabaikan/mengetik (R2.6), tidak pernah auto-kirim/persist (R2.8).
      Saran kosong/draft kosong → tidak meminta (R2.2). Galat LLM → teks non-modal hilang ≤ 5 detik
      (R2.10); timeout/batal → tanpa modal (R2.9). Simpan draft → toast; error per-field inline.
      Konteks gagal dimuat → area tetap editable + indikasi (R1.2). Pakai `toast` dari `lib/toast.ts`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.4, 2.5, 2.6, 2.8, 2.9, 2.10, 7.1, 7.3_
  - [ ] 11.3 `components/email-citation-list.tsx` dan `components/email-chat.tsx`
    - Chat: input pertanyaan + daftar jawaban, `PageSkeleton` + `finishLoadingAfterMinimum` saat
      memuat (R7.4/R7.5), render sitasi (R4.2), pesan `NO_RELEVANT` (R4.3), toast sukses/gagal.
      Nonaktifkan fitur bila `llmAvailable` false dengan pesan yang sesuai (R2.11/R4.9).
    - _Requirements: 4.2, 4.3, 4.9, 7.3, 7.4, 7.5_

- [ ] 12. Halaman, navigasi, dan wiring akhir
  - Buat `app/(dashboard)/email/page.tsx` (`'use client'`, dua tab Composer + Chat, satu badge LLM +
    kapabilitas dibagikan). Tambah entri nav `{ href: '/email', label: 'Email', icon: Mail }` di
    `links` pada `components/layout.tsx`. Hubungkan komponen ke fungsi `data-client`; muat kapabilitas
    saat mount untuk menonaktifkan fitur bila LLM belum dikonfigurasi.
  - _Requirements: 1.1, 2.11, 4.9, 6.4, 7.1_

- [ ] 13. Daftarkan test baru ke script `domain:test`
  - Tambahkan path tiap `*.test.ts` baru ke script `domain:test` di `package.json`:
    `domain/email/validation.test.ts`, `lib/server/email/context-builder.test.ts`,
    `lib/server/email/retrieval.test.ts`, `lib/server/email/chat-service.test.ts`,
    `lib/server/email/ingestion-service.test.ts`. Tanpa ini test diam-diam tak pernah dijalankan.
  - _Requirements: 3.2, 3.4, 4.1, 5.3, 2.7_

- [ ] 14. Checkpoint verifikasi akhir
  - Jalankan `npx tsc --noEmit` (harus bersih), `npm run domain:test` (semua property test lulus),
    dan `npm run build` (karena menyentuh route + komponen). Perbaiki error sebelum selesai; tanyakan
    ke pengguna bila ada pertanyaan.

## Tugas Opsional / Increment Berikutnya

Dipisah dari increment pertama; jangan diimplementasikan sebagai bagian plan inti.

- [ ]* 15. IMAP ingestion worker (OD-1 future)
  - Modul `lib/server/email/imap-worker.ts` (server-only) untuk polling/sinkronisasi IMAP menjadi
    `ingestion-service`, plus env baru. Alternatif dari unggah manual `.eml`/`.mbox`.
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 16. Outbound SMTP/API send (OD-7 future)
  - Endpoint + service pengiriman draft keluar. Di luar lingkup increment ini (compose + simpan draft
    saja). Pastikan tetap tidak ada auto-send dari alur saran.
  - _Requirements: 1.4, 2.8_

## Notes

- Tugas berpostfix `*` bersifat opsional (test + increment berikutnya) dan dapat dilewati untuk MVP;
  tugas inti tanpa `*` wajib diimplementasikan.
- Setiap tugas merujuk requirement spesifik untuk ketertelusuran.
- Property test memakai `fast-check` + `bun:test`, ≥ 100 iterasi, dan ditag
  `// Feature: email-assistant, Property N`.
- Checkpoint memastikan validasi inkremental sebelum lanjut.
- Validasi akhir: `npx tsc --noEmit`, `npm run domain:test`, `npm run build`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "3.2", "4"] },
    { "id": 2, "tasks": ["2.3", "5.1", "5.2", "5.3", "6.1", "6.3"] },
    { "id": 3, "tasks": ["5.4", "6.2", "6.4", "6.5", "6.7"] },
    { "id": 4, "tasks": ["6.6", "6.8", "8.1", "8.2", "8.3", "8.4", "8.5", "8.6"] },
    { "id": 5, "tasks": ["9", "10"] },
    { "id": 6, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 7, "tasks": ["12", "13"] },
    { "id": 8, "tasks": ["15", "16"] }
  ]
}
```
