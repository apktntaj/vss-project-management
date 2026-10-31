# Klasifikasi dokumen /jobs jadi provider-aware (SumoPod mengikuti LLM_PROVIDER)

## Masalah
Dialog tiga zona & modal job baru di /jobs memanggil `/api/classify-job-document` → `lib/server/document-extraction.ts:204-209` yang hardcoded `GEMINI_API_KEY` + endpoint Gemini. `LLM_PROVIDER=SUMOPOD` di env tidak pernah dibaca jalur ini (env & restart user sudah benar — terverifikasi: proses dimulai setelah env diedit).

## Pendekatan
Ganti mesin di balik route klasifikasi job dengan resolusi provider yang sama seperti pipeline baru; **kontrak respons route tidak berubah** (`{classification, invoice, transport}`) sehingga dialog tidak perlu diubah.

### 1. Helper baru `lib/server/extraction/job-classify.ts`
`classifyJobDocument(file)` → bentuk legacy (documentType 5 nilai lama):
- Provider terkonfigurasi (`resolveLlmProvider()` — SumoPod/Claude/DeepSeek/Gemini) → `provider.extract(file)`, lalu petakan jenis baru → lama: `CIPL_COMBINED → COMMERCIAL_INVOICE`, `PACKING_LIST → OTHER`, `SUPPORTING_DOCUMENT → OTHER`, sisanya identitas; `confidence`+`rationale` dari klasifikasi baru.
- Provider gagal (timeout, PDF scan tanpa lapisan teks — SumoPod text-only) **atau** tidak terkonfigurasi → fallback lapisan deterministik `runDeterministicExtraction` (regex + OCR) → petakan sama. Unggahan tidak pernah gagal total hanya karena LLM mati.
- Keduanya gagal → lempar error seperti sekarang (dialog sudah punya fallback simpan sebagai OTHER).

### 2. Sesuaikan `classifier.ts` (kecil)
`intendedKind` jadi opsional — tanpa bonus marker saat tidak diberikan (upload /jobs netral, bukan CIPL/transport spesifik).

### 3. Route & pembersihan
- `app/api/classify-job-document/route.ts` pakai helper baru; bentuk respons tetap.
- Hapus fungsi Gemini legacy `extractDocument` + prompt-nya di `lib/server/document-extraction.ts` (jadi tak terpakai); **pertahankan** `normalizeInvoice`/`normalizeTransport` (dipakai `llm/shared`) dan JANGAN sentuh `manifest-extraction.ts`/`parse-manifest` (jalur lain, di luar scope).

### 4. Teks UI
Ganti sisa kata "Gemini" di pesan dialog unggah job menjadi "AI" (cek grep; label sudah umum "diperiksa AI").

## Validasi
- `npx tsc --noEmit`, `npm run domain:test`.
- Smoke live: POST file ke `/api/classify-job-document` (cookie sesi tempaan) — respons klasifikasi harus datang dari jalur provider (SumoPod aktif via env); POST PDF rusak → tetap respons 502/UNREADABLE yang dipetakan, membuktikan fallback.
- Grep memastikan tidak ada lagi `generativelanguage.googleapis.com` di jalur job; log dev server saat uji tidak lagi menyebut Gemini.

## Catatan
- PDF scan di /jobs: SumoPod (text-only) akan gagal → fallback deterministik+OCR otomatis; perilaku paling buruk setara kondisi hari ini.
- Penyatuan penuh /jobs ke pipeline `/api/extract-document` (persist-first, review form) tetap tertunda sebagai slice besar berikutnya.