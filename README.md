# VSS Project Management

Website operasional untuk mengelola event dan shipment dengan penyimpanan persisten di Supabase.

## Fitur utama

- Dashboard event dan timeline operasional.
- CRUD event, venue, organizer, exhibitor, dan shipment/job.
- Data operasional, ticket, dan metadata dokumen disimpan di PostgreSQL Supabase.
- File PDF/Excel disimpan di bucket Supabase Storage privat `attachments`.
- Browser mengakses data melalui `/api/data`; service-role key hanya digunakan di server dan setiap request memerlukan sesi NextAuth.
- User, venue, dan event organizer awal dibuat oleh migration Supabase.

## Menjalankan lokal

Prasyarat: Node.js dan project Supabase.

1. Install dependency dengan `npm install`.
2. Jalankan migration `supabase/migrations/20261004000000_initial_persistence.sql` pada project Supabase (Supabase CLI atau SQL Editor).
3. Salin `.env.example` ke `.env.local`, lalu isi `AUTH_SECRET`, `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY`.
4. Jalankan website dengan `npm run dev`.

`SUPABASE_SERVICE_ROLE_KEY` tidak boleh diberi prefix `NEXT_PUBLIC_` atau dikirim ke browser. Tabel memakai RLS tanpa policy publik; akses aplikasi dilakukan oleh route server yang memvalidasi sesi.

## Verifikasi

```bash
npx tsc --noEmit
npm run domain:test
npm run build
```
