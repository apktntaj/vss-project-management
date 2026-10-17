# Struktur Proyek

## Peta Direktori (aktual)

```
/
├── app/
│   ├── (auth)/login/             page.tsx, login-form.tsx, actions.ts   ← server action signIn
│   ├── (dashboard)/
│   │   ├── layout.tsx            gerbang auth: auth() + redirect('/login')
│   │   ├── actions.ts            HANYA logoutAction — bukan tempat mutasi data
│   │   ├── page.tsx              dashboard + timeline
│   │   ├── events/               page.tsx (710 baris), [id]/, [id]/edit/
│   │   ├── jobs/                 page.tsx (664 baris), [id]/, [id]/edit/, new/
│   │   ├── cipls/[id]/           detail, versions/new, shipments/new,
│   │   │                         shipments/[shipmentId]/, .../jobs/new, .../jobs/[jobId]
│   │   ├── kanban/               board ticket (live)
│   │   ├── tickets/              list + [ticketId]
│   │   ├── settings/             admin only
│   │   ├── lartas/, ceisa/       fitur sampingan
│   │   └── general-cargo/, projects/, ticket/   stub coming-soon
│   ├── api/                      28 route handler — lihat steering data-access
│   ├── layout.tsx, globals.css
│
├── components/
│   ├── ui/                       10 primitif @base-ui + CVA (kode gaya shadcn)
│   ├── ceisa/                    konsol & demo CEISA
│   ├── layout.tsx                AppShell: sidebar, nav, dan RENDERER TOAST
│   ├── loading-skeletons.tsx     PageSkeleton + finishLoadingAfterMinimum
│   ├── status-badge.tsx, coming-soon.tsx, providers.tsx
│   └── <fitur>.tsx               modal/editor/board per fitur, kebab-case
│
├── domain/                       types + validasi, storage-agnostic, TANPA barrel file
│   ├── exhibition/               CIPL, Shipment, CustomsJob + 5 validator invariant  ← LIVE
│   ├── event/                    Event, Venue, EO, Exhibitor + skema Zod             ← LIVE, acuan pola Zod
│   ├── ticket/                   Ticket + Zod + validator transisi + timeline        ← LIVE
│   ├── job/                      JobKind/BcDocumentKind + manifest Zod               ← LIVE
│   ├── agent/                    types LIVE; validation.ts TIDAK dipakai
│   ├── user/                     validation.ts LIVE; user.ts TIDAK dipakai
│   ├── ceisa/                    kontrak BC 2.3 + observasi
│   └── v2/                       META-MODEL eksplorasi — TIDAK dipakai runtime
│
├── lib/
│   ├── data-client.ts            1702 baris, 'use client' — batas akses data untuk UI
│   ├── utils.ts                  cn() + formatDate() locale id-ID
│   ├── supabase/                 admin, attachments, event-api, operational-records,
│   │                             ticket-api, users — semua server-only
│   ├── server/                   document-extraction, manifest-extraction (Gemini), ceisa/
│   ├── auth/password.ts          hash scrypt
│   ├── ceisa/bc23-draft.ts       builder draft murni
│   ├── demo-users.ts             fallback login non-production
│   ├── job-operational-phase.ts  derivasi fase Legacy Job
│   ├── event-job-view.ts, manifest-view.ts, document-comparison.ts, insw-lartas.ts,
│   ├── job-number.ts, tokens.ts
│   └── *.test.ts                 test untuk sebagian modul lib
│
├── supabase/migrations/          migrasi SQL, urut timestamp
├── scripts/                      utilitas tsx/node
├── docs/, documentation/          dokumen analisis & PRD
├── auth.ts                       konfigurasi NextAuth
└── .kiro/requirements.md         requirement + daftar gap bisnis
```

## Yang TIDAK ada (jangan dicari atau direferensikan)

`lib/file.ts`, `lib/mock-data.ts`, `lib/validations.ts`, `lib/indexeddb`, `app/api/data/`,
tabel `app_records`, `app/(dashboard)/shipments/`, `app/(dashboard)/cipls/page.tsx`,
`middleware.ts`, barrel `index.ts` di `domain/`.

## Di Mana Menaruh Kode Baru

| Jenis kode | Lokasi |
|---|---|
| Tipe entitas + aturan bisnis murni | `domain/<area>/types.ts`, `domain/<area>/validation.ts` |
| Skema Zod untuk input user | `domain/<area>/validation.ts` — bukan di route, bukan di komponen |
| Query/mutasi Supabase | `lib/supabase/<area>.ts` dengan `import 'server-only'` |
| Endpoint | `app/api/<area>/route.ts` — wajib guard auth sendiri |
| Fungsi akses data untuk UI | tambahkan export baru di `lib/data-client.ts` |
| Logic turunan/presentasi yang perlu test | `lib/<nama>-view.ts` atau `lib/<nama>.ts` + `.test.ts` |
| Komponen fitur | `components/<kebab-case>.tsx` |
| Primitif UI baru | `components/ui/` |
| Panggilan API pihak ketiga | `lib/server/<vendor>/` |

## Konvensi Penamaan

- Komponen React: `kebab-case.tsx`, export function `PascalCase`.
- Route: `page.tsx`, `layout.tsx`, `route.ts` (konvensi Next.js).
- Fungsi `domain/`: `validate<Subject>`, mengembalikan hasil, tidak throw.
- Fungsi `lib/data-client.ts`: verb-first — `list*`, `get*`, `create*`, `save*`, `update*`, `delete*`.
- Tabel Postgres: `snake_case` plural. Field di dalam `payload` jsonb: `camelCase` (sama dengan domain type).
- Enum/kode: `SCREAMING_SNAKE_CASE` bahasa Inggris. Pesan untuk user: bahasa Indonesia.
