## Jalankan rencana audit auth (docs-only, sesuai keputusan "laporan audit saja")

**1. Tulis `docs/auth-audit-2026-10-22.md`** — laporan lengkap hasil audit 2026-10-22, berisi:
- Status sehat: scrypt + timingSafeEqual, bucket privat + proxy ter-guard, middleware JWT sungguhan, 33/33 handler ter-autentikasi, hash tak pernah ke client.
- Temuan P1–P7 dengan rujukan `file:line`:
  - **P1** user buatan Settings tak bisa login (tanpa insert `workspace_members`; inner join di `features/auth/repository.ts:43`) + PIC picker cuma admin@vss.local.
  - **P2** cutover menggantung — daftar 14 file legacy `@/auth`, divergensi callback & secret fallback; rencana repoint + hapus `auth.ts`.
  - **P3** `/api/operational-records` penulis tabel generik 16 tabel yang mem-bypass guard PIC events; 4 tabel mati (`events`, `venues`, `event_organizers`, `operational_users`) bisa dikeluarkan aman.
  - **P4** `GET /api/jobs` bocorkan direktori user (email, access level); cukup `{id, name}`.
  - **P5** hapus job tanpa guard.
  - **P6** demo mode jongkok (login page mengiklankan, path baru tak punya fallback; `/api/settings` tanpa guard NODE_ENV).
  - **P7** minor: klaim beku/maxAge, dead use-cases, matcher longgar, timing enumeration, dedup ROLES, IDOR attachments (catat), RLS tanpa policy (catat), gap produk password.
- Keputusan tercatat: demo mode disinkronkan ke path baru; guard hapus job = assignedTo atau SUPERVISOR (null → hanya SUPERVISOR).
- Urutan implementasi disarankan + validasi per langkah.

**2. Commit** hanya file itu di branch `auth` — `git commit -m "docs: auth audit report"` (tanpa GitHub issue; workflow issue di AGENTS.md sedang dikomentari).

**3. Simpan memori sesi:** (a) ringkasan temuan audit + dua keputusan (type: project), (b) feedback gaya kerja baru — jangan terlalu banyak komentar di kode generate (type: feedback), plus update indeks `MEMORY.md`.

**4. Validasi:** tidak diperlukan (perubahan dokumentasi saja). Laporan akhir: path file + hash commit.