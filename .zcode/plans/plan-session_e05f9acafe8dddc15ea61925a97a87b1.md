# Implementasi Customs Document Extraction (inti, tanpa tugas test `*`)

Spec `.kiro/specs/customs-document-extraction` **layak dikerjakan** — semua asumsi fondasi terverifikasi ada di kode. Eksekusi mengikuti `tasks.md` sesuai urutan dependency-nya, mencentang checkbox sambil jalan, dan mencatat gap-fill di `tasks.md` (preseden: spec `events-page-auth-401`). Tugas bertanda `*` (PBT + unit test route) DILEWATI sesuai keputusan — test menyusul di sesi berikut.

## Keputusan gap-fill (dicatat di tasks.md saat implementasi)

1. **R9.6 loading**: tanpa delay buatan — konsisten commit 65025c7; `finishLoadingAfterMinimum` TIDAK dibangkitkan kembali. Panel unggah tetap menampilkan status loading selama ekstraksi berjalan.
2. **Persist-first + `attachmentId`**: menyelesaikan inkonsistensi design.md (sequence diagram vs signature data-client) mengikuti R1.1 + keputusan 2026-10-28: `POST /api/extract-document` menyimpan attachment lebih dulu (`uploadAttachment`), lalu mengekstrak, dan mengembalikan `{ attachmentId, result }`. `reExtractWithLlm(attachmentId)` mengambil file dari Attachment_Store via `downloadAttachment` yang sudah ada — file dikirim klien sekali saja.
3. **Jalur legacy tidak berubah**: `/api/classify-job-document`, `/api/ceisa/bc-23/draft`, `/api/parse-manifest` tetap memakai `lib/server/document-extraction.ts` apa adanya. Konstanta `MODEL`/`MAX_DOCUMENT_SIZE` direlokasi ke `lib/server/extraction/config.ts` dan diimpor balik (menghapus duplikasi hardcoded sesuai steering pitfalls, tanpa perilaku berubah). Gemini adapter baru memakai ulang `geminiDocumentInput` + normalizer yang diekspor dari modul lama.
4. **Status > 400**: `eventApiFailure` hanya memetakan 401/400, jadi status 413/502/503 dipetakan langsung dari `DocumentExtractionError` di route handler.
5. **`attachments` tidak dimasukkan `operationalTables`** — file tetap lewat `lib/supabase/attachments.ts` + `/api/attachments` (pola yang sudah ada); `operational-records` hanya untuk baris `cipl_versions`/`shipments`.

## Urutan kerja (tugas inti tasks.md)

1. **Tugas 1–2 — fondasi**: `lib/server/extraction/config.ts` (konstanta terpusat, `LLM_MODELS`, `configuredLlmProvider()` baca `LLM_PROVIDER`+`LLM_API_KEY`) dan `errors.ts` (kode error terstruktur). `npm install` `pdfjs-dist` + `tesseract.js` pin eksak; `xlsx`/`zod` sudah ada. Tambah `LLM_PROVIDER`/`LLM_API_KEY` ke `.env.example` (tanpa `NEXT_PUBLIC_`).
2. **Tugas 3–4 — domain + guard**: tipe `Extraction_Result` dkk. di `domain/exhibition/source-documents.ts` (tanpa memutasi tipe lama, tanpa `Blob`/`File`); perlebar `Attachment.mimeType` jadi union+`string` (tanpa migrasi DB — `mime_type` sudah teks bebas). `ParsedDocument` + `file-guard.ts` (pindah dari modul lama).
3. **Tugas 5–8 — logika murni** (tanpa PBT dulu): `confidence-scorer.ts`, `classifier.ts` (total, 7 nilai enum), `cipl-merge.ts` (normalisasi whitespace + case-insensitive, padankan by deskripsi+kuantitas), `domain/exhibition/mandatory-documents.ts` (COMPLETE iff 1 CIPL + 1 transport; supporting tidak memengaruhi).
4. **Tugas 10–12 — parser + LLM + orkestrator**: `xlsx-parser` (pakai `xlsx`), `pdf-text-parser` (pdfjs-dist), `ocr.ts` (tesseract.js, timeout 30 s); `llm/provider.ts` + adapter gemini/claude/deepseek; `extraction-service.ts` (deterministik dulu, LLM hanya opt-in, tidak simpan hasil parsial).
5. **Tugas 13–17 — Zod + 4 route handler**: skema Zod `.strict()` pesan Indonesia; `POST /api/extract-document` (multipart, guard+Zod+file-guard+owner check server-side, persist-first); `POST /api/cipl-versions` (merge PL+CI, `validateCiplVersionReady`/`validateShipmentAllocation` server-side, persist immutable); `GET /api/shipment-documents?shipmentId=` (filter server-side workspace+shipment); `POST /api/shipment-documents/mark-ready` (kelengkapan server-side → `READY_FOR_CUSTOMS`). Semua `runtime='nodejs'`, `dynamic='force-dynamic'`, error shape `{ error }`.
6. **Tugas 18–20 — checkpoint**: `npx tsc --noEmit` bersih + `domain:test` yang ada tetap hijau (tidak ada file test baru sesi ini, jadi tak ada yang perlu didaftarkan — tugas 20 ditunda bersama test).
7. **Tugas 19 + 21–22 — data-client + UI**: verbs baru di `lib/data-client.ts` (`extractDocument`, `reExtractWithLlm(attachmentId)`, `uploadSupportingDocument`, `createCiplVersionFromExtraction`, `listShipmentDocuments`, `markShipmentReadyForCustoms`); komponen `confidence-badge`, `document-upload-panel`, `extraction-review-form` (pre-fill + semua field editable + tombol "Ekstrak ulang dengan LLM" dinonaktifkan bila provider null), `supporting-document-uploader`, `shipment-document-checklist` (toast via helper `@/components/toast`, field-level error pakai pola `Field`/`FieldError`, `aria-label`); dipasang di `app/(dashboard)/cipls/[id]/` + subrutenya.
8. **Tugas 23 — verifikasi akhir**: `npx tsc --noEmit`, `npm run domain:test`, `npm run build`.

## Validasi & follow-up

- Gate: `npx tsc --noEmit` bersih, `domain:test` hijau, `npm run build` sukses.
- Checkbox tasks.md dicentang seiring progres; gap-fill (poin 1–2 di atas) dicatat di bagian Notes tasks.md.
- Sesi berikutnya (bukan sekarang): tulis PBT fast-check (10 properti di design.md) + unit test route + daftarkan ke `domain:test`.
- Commit di branch `document-upload` setelah gate lulus.