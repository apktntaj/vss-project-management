# VSS Project Management

Website operasional untuk mengelola event dan shipment secara lokal di browser.

## Fitur utama

- Dashboard event dan timeline operasional.
- CRUD event, venue, organizer, exhibitor, dan shipment/job.
- Stage shipment serta dokumen PDF disimpan di IndexedDB.
- Data demo dibuat otomatis pada browser pertama kali digunakan.

## Menjalankan lokal

Prasyarat hanya Node.js.

1. Install dependency dengan `npm install`.
2. Jalankan website dengan `npm run dev`.

Data browser tidak tersimpan di server dan tidak otomatis terbagi antar perangkat.
Untuk deployment Vercel, deploy project tanpa `DATABASE_URL`, Prisma, atau
konfigurasi PostgreSQL. `GEMINI_API_KEY` hanya diperlukan untuk fitur parsing PDF.

## Verifikasi

```bash
npx tsc --noEmit
npm run domain:test
npm run build
```
