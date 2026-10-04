# VSS Project Management

Website operasional untuk mengelola event dan shipment.

## Fitur utama

- Dashboard event dan timeline operasional.
- CRUD event, venue, organizer, exhibitor, dan shipment/job.
- Tanpa konfigurasi Supabase pada development, aplikasi menjalankan data demo di memori agar UI dapat dievaluasi tanpa layanan eksternal.
- Dengan Supabase terkonfigurasi, state operasional bersama dipersistenkan per workspace; tanpa itu, seed dan model runtime dalam `lib/mock-data.ts` dan `lib/file.ts` tetap menjadi fallback development.
- Ticket untuk koordinasi, administratif, dan operasional, dengan assignment, board, komentar, dan riwayat activity.
- Data demo dibuat otomatis pada awal setiap runtime browser.

## Menjalankan lokal

Prasyarat hanya Node.js.

1. Install dependency dengan `npm install`.
2. Jalankan website dengan `npm run dev`.

## Supabase dan autentikasi

NextAuth mengelola sesi aplikasi; Supabase menyediakan database dan Storage privat. Terapkan migrasi dalam `supabase/migrations/`, lalu isi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `AUTH_SECRET` berdasarkan `.env.example`. Service-role key hanya dipakai dari server dan tidak boleh memakai awalan `NEXT_PUBLIC_`.

State operasional terstruktur dipersistenkan ke workspace Supabase. Bucket `attachments` juga sudah diproteksi dan siap dipakai; pemindahan byte PDF dari adapter runtime ke bucket dilakukan sebagai tahap migrasi attachment tersendiri agar unggahan dan perubahan agregat dapat dibuat atomik.

Buat akun pertama setelah migrasi dengan:

```bash
VSS_USER_PASSWORD='password-panjang-unik' npm run supabase:create-user -- admin@contoh.co.id 'Administrator' SUPERVISOR true
```

Di production, login demo dinonaktifkan otomatis jika kredensial Supabase belum tersedia. `GEMINI_API_KEY` hanya diperlukan untuk fitur parsing PDF.

## Cek LARTAS INSW

Menu **Cek LARTAS** memeriksa maksimal 20 HS code 8 digit melalui route server-side `/api/lartas`. Isi `LARTAS_TOKEN` (atau `LARTAS_TOKEN_FILE_PATH`) di `.env` untuk hasil CMS dengan status LARTAS terverifikasi; contoh konfigurasi tersedia di `.env.example`. Tanpa token, aplikasi hanya mencoba sumber publik untuk tarif dan hasil `unverified` tidak boleh diartikan sebagai LARTAS tidak ada.

## Verifikasi

```bash
npx tsc --noEmit
npm run domain:test
npm run build
```
