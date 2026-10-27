# VSS Project Management

Website operasional untuk mengelola event dan shipment kargo pameran (MICE) serta kepabeanan (BC). Single-tenant, dipakai tim internal.

## Fitur utama

- Dashboard event dan timeline operasional.
- CRUD event, venue, organizer, exhibitor, dan shipment/job.
- Ticket untuk koordinasi, administratif, dan operasional, dengan assignment, board, komentar, dan riwayat activity.
- Cek LARTAS INSW, draft BC 2.3 (CEISA), dan ekspor workbook kepabeanan.
- Penyimpanan tunggal lewat Supabase (Postgres + Storage privat). Di luar production, bila Supabase belum dikonfigurasi, login dan sebagian pengaturan jatuh ke data demo in-memory agar UI dapat dievaluasi tanpa layanan eksternal. Di production, fallback demo dinonaktifkan: Supabase yang tak terkonfigurasi menghasilkan error eksplisit, bukan kegagalan senyap.

## Menjalankan lokal (development)

Prasyarat: Node.js, dan `bun` tersedia global untuk menjalankan test (`npm run domain:test` memakai `bun test`).

1. Install dependency dengan `npm install`.
2. Salin `.env.example` ke `.env.local` dan isi nilainya.
3. Jalankan website dengan `npm run dev` (hot reload, di `localhost:3000`).

Development sehari-hari memakai `npm run dev` langsung di host — **bukan** lewat Docker. Container disediakan untuk produksi/deploy, lihat bagian di bawah.

## Supabase dan autentikasi

NextAuth mengelola sesi aplikasi; Supabase menyediakan database dan Storage privat. Terapkan migrasi dalam `supabase/migrations/`, lalu isi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `AUTH_SECRET` berdasarkan `.env.example`. Service-role key hanya dipakai dari server dan tidak boleh memakai awalan `NEXT_PUBLIC_`.

State operasional terstruktur dipersistenkan ke workspace Supabase, dan byte lampiran disimpan di bucket privat `attachments` (dirujuk lewat id).

Buat akun pertama setelah migrasi dengan:

```bash
VSS_USER_PASSWORD='password-panjang-unik' npm run supabase:create-user -- admin@contoh.co.id 'Administrator' SUPERVISOR true
```

Di production, login demo dinonaktifkan otomatis jika kredensial Supabase belum tersedia. `GEMINI_API_KEY` hanya diperlukan untuk fitur parsing PDF.

## Cek LARTAS INSW

Menu **Cek LARTAS** memeriksa maksimal 20 HS code 8 digit melalui route server-side `/api/lartas`. Isi `LARTAS_TOKEN` (atau `LARTAS_TOKEN_FILE_PATH`) di `.env` untuk hasil CMS dengan status LARTAS terverifikasi; contoh konfigurasi tersedia di `.env.example`. Tanpa token, aplikasi hanya mencoba sumber publik untuk tarif dan hasil `unverified` tidak boleh diartikan sebagai LARTAS tidak ada.

## Deploy (Docker + VPS)

Aplikasi dibungkus sebagai image Next.js `standalone` (`output: 'standalone'` di `next.config.mjs`) dan dijalankan di belakang Caddy sebagai reverse proxy dengan TLS otomatis. Database tetap eksternal di Supabase — tidak ada Postgres di dalam compose.

Berkas terkait:

- `Dockerfile` — build multi-stage (deps → build → runner), berjalan sebagai user non-root, dengan `HEALTHCHECK`.
- `docker-compose.yml` — dua service: `web` (image aplikasi) dan `caddy` (reverse proxy + TLS).
- `Caddyfile` — reverse proxy ke `web:3000`, sertifikat Let's Encrypt otomatis untuk `DOMAIN`.
- `.dockerignore` — menjaga build context ramping dan mencegah rahasia (`.env.local`) masuk image.

Langkah deploy di VPS:

1. Salin `.env.example` ke `.env` di VPS dan isi nilai produksi. Bawa `AUTH_SECRET` yang sama persis agar sesi JWT tidak gugur, plus kredensial Supabase dan env fitur (`GEMINI_API_KEY`, `LARTAS_*`, `CEISA_*`). Set juga `DOMAIN` dan `ACME_EMAIL` untuk Caddy.
2. Jalankan `docker compose up -d --build`.
3. Caddy otomatis menerbitkan dan memperpanjang sertifikat TLS untuk `DOMAIN`. Hanya port 80/443 yang terekspos; service `web` hanya dijangkau lewat jaringan internal compose.

Memeriksa status:

```bash
docker compose ps          # status service web + caddy
docker compose logs -f web # log aplikasi, real-time
```

Untuk sekadar menguji image produksi secara lokal (opsional, bukan alur development):

```bash
docker build -t vss-web:local .
docker run --rm -p 3001:3000 --env-file .env.local vss-web:local  # buka localhost:3001
```

## Verifikasi

```bash
npx tsc --noEmit
npm run domain:test
npm run build
```
