# VSS Project Management

Website operasional untuk mengelola project, empat jenis task, participant dan role,
assignment, cargo item, evidence, blocker, milestone, audit perubahan, serta customs
close-out per item.

## Fitur utama

- Dashboard portofolio dan indikator operasional.
- Project intake dengan sumber fakta wajib.
- Planning gate: readiness task terpisah dari execution.
- Role project terstruktur untuk customer, CS, field operations, customs, supervisor,
  dan pihak lain.
- Evidence minimum diperiksa sebelum task dapat diselesaikan.
- Intended disposal, treatment, dan close-out customs disimpan per cargo item.
- Project tidak dianggap siap ditutup jika task wajib, milestone, atau customs
  close-out masih terbuka.
- Change history append-only mempertahankan informasi sebelumnya.

## Menjalankan lokal

Prasyarat: Node.js dan PostgreSQL. Jika menggunakan Docker, database development
dapat dijalankan dengan:

```bash
docker compose up -d db
```

Gunakan database kosong atau database lama VSS yang sudah menggunakan migration di
folder `prisma/migrations`.

1. Salin `.env.example` menjadi `.env`, lalu sesuaikan `DATABASE_URL` dan
   `NEXTAUTH_SECRET`.
2. Install dependency dengan `npm install`.
3. Generate Prisma Client dengan `npm run db:generate`.
4. Terapkan migration dengan `npm run db:migrate`.
5. Masukkan akun dan project demo dengan `npm run db:seed`.
6. Jalankan website dengan `npm run dev`.

Akun seed default adalah `admin@vss.local` dengan password `ChangeMe123!`.
Override melalui `SEED_SUPERVISOR_EMAIL` dan `SEED_SUPERVISOR_PASSWORD`, lalu
ganti password sebelum pemakaian nyata.

## Verifikasi

```bash
npx prisma validate
npx tsc --noEmit
npm run domain:test
npm run build
```

Model database menambah tabel project-management tanpa menghapus tabel shipment
legacy. Keputusan customs dalam aplikasi adalah kontrol operasional; aplikasi tidak
menetapkan HS, LARTAS, tarif, ataupun keputusan hukum.
