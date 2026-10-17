# Tech Stack

## Runtime & Framework

- **Next.js 14.2** App Router. Tidak ada `middleware.ts` — autentikasi dijaga di
  `app/(dashboard)/layout.tsx` (server component, `redirect('/login')`) dan **secara terpisah di
  setiap route handler**.
- **React 18.3**. Halaman dashboard yang berisi data hampir semuanya `'use client'`.
- **TypeScript 5.7** strict. Path alias `@/` dari root repo; selalu pakai itu, bukan `../../`.

## UI

- **Tailwind CSS 3.4**. Token warna di `app/globals.css` (`--primary` oranye `#c94c16`, dst.),
  dipetakan ke nama Tailwind di `tailwind.config.ts`.
- Kelas komponen bersama di `@layer components` pada `app/globals.css`:
  `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.input`, `.label`, `.eyebrow`,
  `.dashboard-metric`, `.workspace-nav*`, `.skip-link`. Halaman fitur memakai kelas-kelas ini.
- **@base-ui/react** + **CVA** untuk 10 primitif di `components/ui/`:
  button, dialog, field, input, label, separator, skeleton, table, tabs, textarea.
- **lucide-react** ikon, **@dnd-kit** drag-and-drop di kanban.

## Data & Backend

- **Supabase** (`@supabase/supabase-js`) — service-role client server-only di `lib/supabase/admin.ts`.
- **NextAuth v5 beta** Credentials provider, strategi JWT, token membawa `isAdmin`.
- **Zod 3.24** untuk parsing input di batas API.
- **xlsx** untuk ekspor workbook BC.
- **nanoid** hanya dipakai di `lib/tokens.ts`; ID entitas memakai `crypto.randomUUID()`.

## Perintah

```bash
npm run dev            # dev server
npx tsc --noEmit       # type check — baseline saat ini BERSIH, jaga tetap bersih
npm run domain:test    # domain + lib tests (lihat catatan di bawah)
npm run build          # production build
npm run lint           # eslint via next lint
```

Jalankan minimal `npx tsc --noEmit` + `npm run domain:test` untuk perubahan domain/logic.
Tambahkan `npm run build` untuk perubahan yang menyentuh route atau komponen.

### Catatan penting soal test

- `domain:test` memakai **`bun test`** dengan **daftar file eksplisit** di `package.json`.
  Bun **bukan** dependency yang dideklarasikan (hanya `bun-types`; lockfile adalah `package-lock.json`);
  bun harus tersedia global. Di mesin dev saat ini bun tersedia dan suite lulus.
- **File test baru tidak otomatis berjalan.** Kalau menambah `*.test.ts`, tambahkan path-nya ke
  script `domain:test`, kalau tidak test itu diam-diam tidak pernah dieksekusi.
- Dua file saat ini tidak terdaftar dan tidak berjalan:
  `lib/event-job-view.test.ts`, `lib/job-operational-phase.test.ts`.
- Gaya test tidak seragam: sebagian besar file memakai `node:assert/strict` dengan assertion
  top-level tanpa `test()`, sebagian memakai `bun:test`. Untuk file baru pilih `bun:test`
  (`import { expect, test } from 'bun:test'`) agar hasilnya terlaporkan per-test.
- Tidak ada script `test`, tidak ada coverage, tidak ada test untuk route handler maupun komponen.

## Environment Variables

Salin `.env.example` ke `.env.local`. Daftar lengkap ada di file itu; ringkasannya:

| Variable | Keperluan |
|---|---|
| `AUTH_SECRET` | Wajib — secret NextAuth |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Wajib — tanpa ini `isSupabaseConfigured()` false dan login jatuh ke demo user (hanya non-production) |
| `GEMINI_API_KEY` | Ekstraksi dokumen (`/api/parse-*`, `/api/classify-job-document`) |
| `LARTAS_BASE_URL`, `LARTAS_TOKEN` atau `LARTAS_TOKEN_FILE_PATH`, `LARTAS_REQUEST_TIMEOUT_MS`, `INSW_CLIENT_ID`, `INSW_CLIENT_BEARER` | Fitur LARTAS |
| `CEISA_CREDENTIAL_ENCRYPTION_KEY`, `CEISA_BASE_URL`, `CEISA_AUTH_BASE_URL`, `CEISA_ORIGIN`, `CEISA_REQUEST_TIMEOUT_MS` | Integrasi CEISA |
| `VSS_USER_PASSWORD` | Hanya untuk `npm run supabase:create-user` |

**`SUPABASE_SERVICE_ROLE_KEY` tidak boleh sampai ke browser.** Jangan beri prefix `NEXT_PUBLIC_`,
jangan impor `lib/supabase/*` dari `app/**/page.tsx` atau `components/**`. Modul server-only
ditandai dengan `import 'server-only'` — pertahankan penanda itu di modul server baru.

## Script Utilitas

```bash
npm run supabase:create-user      # buat user + password hash (scrypt, lib/auth/password.ts)
npm run supabase:seed-reference   # seed venue/EO referensi
npm run data:build                # build discovery dataset
npm run domain:demo               # demo domain/v2 (eksplorasi, bukan runtime app)
npm run domain:validate-samples   # validasi sample domain/v2
```
