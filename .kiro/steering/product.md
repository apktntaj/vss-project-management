# Produk: VSS Project Management

## Ringkasan

VSS Project Management adalah workspace operasional berbasis web untuk mengelola event pameran (exhibition), eksibitor, pengiriman barang (shipments), pekerjaan bea cukai (customs jobs), CIPL (Commercial Invoice Packing List), dan tiket koordinasi.

## Domain Utama

- **Events** – Manajemen event pameran beserta venue, organizer, dan timeline.
- **Exhibitors** – Data eksibitor yang terlibat dalam setiap event.
- **Shipments & Customs Jobs** – Pelacakan pengiriman dan pekerjaan bea cukai.
- **CIPL** – Pengelolaan versi dokumen Commercial Invoice Packing List.
- **Tickets (Kanban)** – Tiket koordinasi dengan board kanban dan manajemen prioritas.
- **Settings** – Konfigurasi user dan data referensi.

## Pengguna

Sistem menggunakan autentikasi berbasis sesi (NextAuth Credentials). Session membawa `user.isAdmin` untuk membedakan hak akses admin dan user biasa. Kredensial demo bersifat development-only.

## Penyimpanan Data

- Data operasional disimpan di **PostgreSQL via Supabase**.
- File PDF/Excel disimpan di **Supabase Storage** (bucket `attachments`, bersifat privat).
- Browser mengakses data melalui `/api/data`; `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di sisi server.
- Tabel menggunakan RLS tanpa policy publik — akses hanya lewat route server yang memvalidasi sesi.
