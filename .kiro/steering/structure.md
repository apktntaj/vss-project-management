# Struktur Proyek

## Direktori Utama

```
/
├── app/                    # Next.js App Router – route entry points
│   ├── (auth)/             # Route group: halaman login
│   │   └── login/
│   ├── (dashboard)/        # Route group: semua halaman dashboard (dilindungi auth)
│   │   ├── events/         # Manajemen event
│   │   ├── cipls/          # CIPL dan versi dokumen
│   │   ├── jobs/           # Customs jobs
│   │   ├── shipments/      # Pengiriman barang
│   │   ├── kanban/         # Kanban board tiket
│   │   ├── tickets/        # Daftar tiket
│   │   ├── settings/       # Pengaturan
│   │   └── actions.ts      # Server Actions dashboard
│   └── api/                # API routes (data access endpoint)
│
├── components/             # Komponen UI yang dapat digunakan ulang
│   ├── ui/                 # Komponen UI primitif (button, dialog, input, dll.)
│   └── *.tsx               # Komponen fitur (form, editor, board, dll.)
│
├── domain/                 # Entity types dan validasi – storage-agnostic
│   ├── v2/                 # Domain utama (event, job, shipment, dll.)
│   ├── exhibition/         # Domain pameran
│   ├── ticket/             # Domain tiket
│   └── user/               # Domain user
│
├── lib/                    # Utilitas dan layer akses data
│   ├── data-client.ts      # Public façade – satu-satunya pintu masuk akses data dari UI
│   ├── file.ts             # Implementasi aktual data access (Supabase)
│   ├── supabase-admin.ts   # Supabase client server-only
│   ├── demo-users.ts       # Kredensial demo (server-only)
│   ├── mock-data.ts        # Data demo untuk development
│   ├── validations.ts      # Validasi tambahan
│   ├── tokens.ts           # Token utilities
│   └── utils.ts            # Fungsi utilitas umum
│
├── supabase/               # Migrasi database Supabase
├── types/                  # TypeScript global type definitions
├── scripts/                # Script utilitas (mis. build-discovery-dataset)
├── docs/ & documentation/  # Dokumentasi proyek
│
├── auth.ts                 # Konfigurasi NextAuth
├── next.config.mjs         # Konfigurasi Next.js
├── tailwind.config.ts      # Konfigurasi Tailwind CSS
└── tsconfig.json           # Konfigurasi TypeScript
```

## Konvensi Penting

### Data Boundary
- Kode di `app/` dan `components/` **harus** mengakses data **hanya** melalui `@/lib/data-client`.
- Jangan mengimpor `@/lib/file` atau adapter penyimpanan lainnya langsung dari `app/` atau `components/`.
- Domain entities di `domain/` harus bebas dari tipe penyimpanan (`Blob`, `File`, IndexedDB, dll.).

### Server Actions
- File `actions.ts` di dalam route `app/` menggunakan `'use server'` directive.
- Mutasi data (create, update, delete, upload) harus memberikan feedback melalui **toast notification**.
- Toast hanya muncul di **kanan bawah viewport**.
- Validasi field-level ditampilkan dekat inputnya, bukan digantikan oleh toast.

### Komponen UI
- Komponen primitif (button, input, dialog, dll.) ada di `components/ui/` dan menggunakan `@base-ui/react` sebagai primitif.
- Varian komponen dibuat dengan **CVA** (`class-variance-authority`).
- Penggabungan kelas menggunakan fungsi `cn` dari package `cn`.

### Penamaan File
- Komponen React: `kebab-case.tsx`
- Server Actions: `actions.ts` di dalam folder route yang relevan
- Halaman: `page.tsx`, Layout: `layout.tsx` (konvensi Next.js App Router)

### Path Alias
- Gunakan `@/` untuk semua import dari root repositori (bukan path relatif `../../`).
