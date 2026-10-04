# Tech Stack

## Framework & Runtime

- **Next.js 14** – App Router (bukan Pages Router)
- **React 18** – Server Components dan Client Components
- **TypeScript 5.7** – Strict typing di seluruh codebase
- **Node.js** – Runtime server

## UI & Styling

- **Tailwind CSS 3.4** – Utility-first styling
- **@base-ui/react** – Komponen UI primitif (menggantikan Radix UI)
- **class-variance-authority (CVA)** – Varian komponen berbasis kelas
- **clsx + tailwind-merge (cn)** – Penggabungan kelas kondisional
- **lucide-react** – Ikon
- **@dnd-kit** – Drag-and-drop (digunakan di kanban board)

## Backend & Data

- **Supabase** (`@supabase/supabase-js`) – Database PostgreSQL dan file storage
- **NextAuth v5 (beta)** – Autentikasi dengan Credentials provider
- **Zod 3.24** – Validasi skema data
- **xlsx** – Ekspor/impor file Excel

## Developer Tools

- **tsx** – Eksekusi TypeScript langsung (untuk script dan domain tests)
- **ESLint** + **Prettier** – Linting dan formatting
- **Path alias** `@/` – Resolves dari root repositori

## Perintah Umum

```bash
# Development
npm run dev           # Jalankan dev server

# Validasi (jalankan sebelum commit)
npx tsc --noEmit      # Type checking
npm run domain:test   # Uji validasi domain entities
npm run build         # Production build

# Utilitas
npm run lint          # ESLint
npm run data:build    # Build discovery dataset
```

## Environment Variables

Salin `.env.example` ke `.env.local` dan isi:

| Variable | Keterangan |
|---|---|
| `AUTH_SECRET` | Secret untuk NextAuth |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, jangan prefix `NEXT_PUBLIC_`) |

## Aturan Penting

- `SUPABASE_SERVICE_ROLE_KEY` **tidak boleh** dikirim ke browser.
- Gunakan `npx tsc --noEmit` dan `npm run domain:test` untuk perubahan domain/logic; gunakan `npm run build` untuk perubahan yang lebih luas.
