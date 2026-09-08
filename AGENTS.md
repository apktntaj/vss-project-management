# Development Guidelines

## Default delivery workflow

Saat pengguna memberi daftar perubahan atau bug untuk proyek ini, perlakukan daftar tersebut sebagai pekerjaan implementasi lengkap:

1. Buat GitHub issue yang merangkum daftar tersebut beserta acceptance criteria.
2. Implementasikan seluruh item pada issue.
3. Jalankan validasi yang relevan.
4. Buat commit dengan pesan yang merujuk pada issue.
5. Tutup GitHub issue setelah implementasi dan validasi berhasil.
6. Laporkan URL issue, hasil validasi, dan hash commit.

Jangan meminta pengguna mengulang instruksi untuk membuat issue, mengimplementasikan, membuat commit, atau menutup issue, kecuali pengguna secara eksplisit meminta salah satu langkah tersebut dilewati.

## Data access

- Code in `app/` and `components/` must not import `@/lib/indexeddb` directly.
- Access persisted data only through the public façade `@/lib/data-client`.
- Domain entities must not contain `Blob`, `File`, IndexedDB types, or other storage-specific values. File content is accessed through the attachment API by ID.
- Only storage adapters may access IndexedDB APIs.
- A user action that writes an aggregate and its attached files must use one storage transaction.
- Preserve existing IndexedDB data with forward, idempotent migrations. Do not reset browser data as part of a schema change.
