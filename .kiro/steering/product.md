# Produk: VSS Project Management

Workspace operasional internal untuk perusahaan freight-forwarding yang menangani pengiriman barang
pameran (MICE) di Indonesia. Single-tenant, dipakai tim internal, bukan produk multi-customer.

Requirement lengkap hasil reverse-engineering ada di `.kiro/requirements.md` — termasuk daftar gap
bisnis `G-1`..`G-10`. Baca dokumen itu sebelum mendesain fitur yang menyentuh aturan bisnis.

## Hierarki Entitas

```
Event (pameran)
├── Venue, Event Organizer (data referensi, dikelola di /settings)
├── Agent / EventAgent (agen yang membawa beberapa exhibitor)
└── Exhibitor (peserta)
      ├── Legacy Job            ← jalur LAMA, satu job per exhibitor, masih dipakai
      └── CIPL                  ← jalur BARU
            └── CIPL Version (immutable)
                  └── Shipment (tepat satu B/L atau satu AWB)
                        └── Customs Job (satu dokumen BC)
User
└── Ticket (work item, konteks GENERAL | EVENT | JOB)
```

**Dua pipeline berjalan paralel tanpa sinkronisasi.** Legacy Job (`/jobs`, `lib/job-operational-phase.ts`)
dan pipeline CIPL→Shipment→CustomsJob (`/cipls/...`) adalah dua model yang hidup bersamaan untuk
exhibitor yang sama. Belum ada aturan kapan memakai yang mana (gap `G-4`). Saat menambah fitur,
tentukan secara eksplisit pipeline mana yang disentuh dan tulis itu di requirement.

## Status Fitur per Rute

Navigasi di `components/layout.tsx` punya flag `available`. Rute dengan `available: false`
merender `components/coming-soon.tsx` — **jangan dianggap fitur jadi.**

| Rute | Status |
|---|---|
| `/` | Live — dashboard + timeline event |
| `/events`, `/events/[id]` | Live — pusat operasional yang paling aktif dikembangkan |
| `/cipls/[id]` dan turunannya | Live — tidak punya halaman index, hanya reachable via link |
| `/kanban` | Live — board ticket |
| `/tickets`, `/tickets/[ticketId]` | Live |
| `/settings` | Live — admin only (`session.user.isAdmin`) |
| `/lartas` | Live — cek LARTAS via INSW |
| `/jobs` | `available: false` di nav, tetapi halamannya berfungsi penuh |
| `/ceisa`, `/ceisa/bc-23-demo` | Demo, nav dimatikan, tidak terhubung ke pipeline utama |
| `/general-cargo`, `/projects`, `/ticket` | Coming soon / stub |

## Peran dan Otorisasi

`app_users.role` menyimpan `STAFF | SUPERVISOR | CUSTOMER_SERVICE | DOCUMENT_ASSISTANT`, tetapi
**satu-satunya pembatasan yang benar-benar dijalankan adalah flag `isAdmin`** untuk `/settings` dan
untuk endpoint CEISA yang menyentuh kredensial. Role lain tidak dijaga di business logic
(gap `G-1`): siapa pun yang login dapat melakukan hampir semua operasi data.

Jika fitur baru membawa aturan otorisasi, implementasikan penjagaannya di route handler — jangan
asumsikan ada layer otorisasi yang sudah berjalan. Satu-satunya contoh otorisasi per objek yang ada:
`DELETE /api/events/[eventId]` membatasi hapus ke PIC event, tapi membebaskan event lama tanpa PIC.

## Penyimpanan dan Integrasi

- **PostgreSQL via Supabase** — satu-satunya penyimpanan data. Tidak ada IndexedDB, tidak ada
  mock/seed runtime di browser. Dokumen lama yang menyebut IndexedDB atau `lib/mock-data.ts` sudah tidak berlaku.
- **Supabase Storage** bucket privat `attachments` untuk PDF/Excel.
- **Google Gemini** (`gemini-3.5-flash-lite`) untuk ekstraksi data dari B/L, AWB, Commercial Invoice, dan manifest.
- **INSW** untuk pengecekan LARTAS.
- **CEISA 4.0** (Bea Cukai) — read-only observasi + generator draft BC 2.3 lokal. Belum ada submit ke CEISA.
- **NextAuth v5** Credentials + JWT session.
