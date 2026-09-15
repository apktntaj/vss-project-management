# VSS Project Management

Website operasional untuk mengelola event dan shipment secara lokal di browser.

## Fitur utama

- Dashboard event dan timeline operasional.
- CRUD event, venue, organizer, exhibitor, dan shipment/job.
- Data demo, perubahan CRUD, serta dokumen PDF disimpan hanya di memori selama runtime browser.
- Seed dan model penyimpanan runtime didefinisikan di `lib/mock-data.ts` dan `lib/file.ts`; reload atau koneksi ulang mengembalikan data ke kondisi awal.
- Ticket untuk koordinasi, administratif, dan operasional, dengan assignment, board, komentar, dan riwayat activity. Data Ticket sengaja hanya in-memory dan hilang saat halaman di-refresh.
- Data demo dibuat otomatis pada awal setiap runtime browser.

## Menjalankan lokal

Prasyarat hanya Node.js.

1. Install dependency dengan `npm install`.
2. Jalankan website dengan `npm run dev`.

Data browser tidak tersimpan di server dan tidak otomatis terbagi antar perangkat.
Untuk deployment Vercel, deploy project tanpa `DATABASE_URL`, Prisma, atau
konfigurasi PostgreSQL. `GEMINI_API_KEY` hanya diperlukan untuk fitur parsing PDF.

## Cek LARTAS INSW

Menu **Cek LARTAS** memeriksa maksimal 20 HS code 8 digit melalui route server-side `/api/lartas`. Isi `LARTAS_TOKEN` (atau `LARTAS_TOKEN_FILE_PATH`) di `.env` untuk hasil CMS dengan status LARTAS terverifikasi; contoh konfigurasi tersedia di `.env.example`. Tanpa token, aplikasi hanya mencoba sumber publik untuk tarif dan hasil `unverified` tidak boleh diartikan sebagai LARTAS tidak ada.

## Verifikasi

```bash
npx tsc --noEmit
npm run domain:test
npm run build
```
