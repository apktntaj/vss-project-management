## Context

Klien: "job di event bisa disortir berdasarkan hall". Klarifikasi user: hall milik exhibitor/manifest, bukan job; maksudnya tampilan yang dikelompokkan per hall dalam satu event, supaya pekerjaan lapangan satu event bisa dilihat per hall. Untuk sekarang hanya TAMPILAN (belum Excel). Kolom yang diminta: Package, CBM, Berat, Catatan, Agent (plus Exhibitor, Booth, Job No sebagai identitas baris). Kolom PIC dibatalkan: PIC event sama untuk semua baris dan kontak exhibitor tidak pernah terisi.

Hall ada di exhibitor (`JobCiplLine.exhibitor.hall`, `domain/job/types.ts` L187); koli/catatan ada di baris CIPL (`JobCiplLine.koli`, `.notes`); agent = `Job.party` bila `kind === 'AGENT'`. Tidak ada perubahan skema/API dan tidak ada request baru: hanya `listEventJobs` yang sudah dimuat halaman.

End state: halaman `/events/[id]` punya dua tab di atas daftar: **Per Jenis Job** (tampilan sekarang, tidak berubah, default) dan **Per Hall** (kartu per hall berisi tabel baris exhibitor lintas job).

## Approach

### 1. Logika murni `lib/hall-view.ts` (file baru; tidak ada pengelompokan per hall yang setara — `lib/manifest-view.ts` hanya per job)

```ts
import type { Job } from '@/domain/job/types'
import type { Exhibitor } from '@/domain/exhibitor/types'
import { jobLabel } from '@/domain/job/numbering'
import { summarizeKoli, summarizeKoliCollections, type KoliSummary, type OperationalNote } from '@/domain/job/manifest'

export type HallRow = {
  /** id baris CIPL */
  key: string
  exhibitorName: string          // line.exhibitor?.name ?? line.nameOnDocument
  linked: boolean                // Boolean(line.exhibitorId)
  booth: string | null           // line.exhibitor?.booth ?? null (trim; '' → null)
  agent: string | null
  jobId: string
  jobNo: string                  // job.jobNumber?.trim() || jobLabel(job) — sama dengan `nomor || jobLabel(job)` di JobRow
  summary: KoliSummary           // summarizeKoli(line.koli)
  notes: OperationalNote[]       // line.notes
}

export type HallGroup = {
  /** key pengelompokan: hall trim + uppercase; '' untuk "Tanpa hall" */
  key: string
  /** label tampil = hall trim pertama yang ditemui; null = "Tanpa hall" */
  label: string | null
  rows: HallRow[]
  /** jumlah distinct `exhibitorId ?? nameOnDocument` */
  exhibitorCount: number
  totals: KoliSummary            // summarizeKoliCollections(koli semua baris grup)
}

export function buildHallGroups(
  jobs: ReadonlyArray<Job>,
): HallGroup[]
```

Aturan:
- Satu `HallRow` per `job.ciplLines` elemen, lintas semua job. Job `status === 'CANCELLED'` dilewati (pekerjaan lapangan tidak mencakup kiriman batal).
- Hall baris = `line.exhibitor?.hall?.trim()`; kosong/null/baris belum tertaut (`exhibitor === null`) → grup "Tanpa hall" (`key: ''`, `label: null`).
- `agent` = `job.party?.kind === 'AGENT' ? job.party.name : null`.
- Urutan grup: hall dengan `Intl.Collator('id', { numeric: true, sensitivity: 'base' })` (instance modul-level; `B2` < `B10`), "Tanpa hall" terakhir. Grup tanpa baris tidak dibuat (hall yang tidak punya baris tidak muncul).
- Urutan baris dalam grup: booth (collator, booth null terakhir) → `exhibitorName` (collator) → `jobNo` (collator). Exhibitor dengan beberapa job jadi baris berurutan.
- `jobNo` dihitung di sini (`job.jobNumber?.trim() || jobLabel(job)`); `buildJobNomor` hanya trim `jobNumber`, jadi hasilnya identik dengan kolom No Job di tab jenis tanpa perlu callback dari pemanggil. `jobLabel` sudah dipakai `lib/manifest-view.ts` dengan cara yang sama.

### 2. Komponen `components/event-hall-view.tsx` (file baru, `'use client'`)

```tsx
export function EventHallView({ groups }: { groups: HallGroup[] })
```
- Kosong (`groups.length === 0`): `<p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-slate-500">Belum ada exhibitor dengan kiriman pada event ini.</p>` (kelas sama dengan pesan "Belum ada job" di `page.tsx`).
- Tiap grup = `<section className="overflow-hidden rounded-xl border border-black/10">` dengan header tombol toggle meniru header grup jenis di `page.tsx` (L205-220: chevron, judul, badge). Judul: `Hall ${label}` atau `Hall belum terisi/diketahui` (grup `label === null`: hall kosong atau baris belum tertaut ke exhibitor). Badge kanan: `${exhibitorCount} exhibitor · ${numberID(totals.totalCount)} pkg · ${numberID(totals.volumeCbm)} CBM · ${numberID(totals.weightKg)} Kg`. Default TERBUKA (state `Record<string, boolean>` yang menyimpan hanya grup yang ditutup; `closed[group.key]` true = tutup). Pakai `numberID` dari `@/components/job-exhibitor-summary` (sudah dipakai `job-barang-card.tsx`).
- Tabel di dalam: `overflow-x-auto`, `<table className="min-w-[1090px] w-full table-fixed text-left text-sm">` dengan lebar kolom lewat `<colgroup><col className="w-[…]" />` (pola tabel jenis di `page.tsx` L223-232), header gaya sama dengan tabel job (`whitespace-nowrap border-b bg-white text-slate-900 font-semibold uppercase tracking-wider`, `th px-3 py-3`), kolom berurutan: Exhibitor (`w-[220px]`), Booth (`w-[90px]`), Agent (`w-[180px]`), Job No (`w-[120px]`), Package (`w-[90px]`), CBM (`w-[90px]`), Berat (Kg) (`w-[100px]`), Catatan (`w-[200px]`) — total 1090px. Baris gaya sama dengan `JobRow` (`border-b border-slate-100 odd:bg-slate-50/70 last:border-0 hover:bg-orange-50/40`, sel `px-3 py-2.5 align-middle`).
- Isi sel: Exhibitor = nama (truncate + `title`); bila `!linked` tambah teks kecil `text-xs text-amber-600` "belum tertaut" di bawahnya. Booth/Agent: nilai (truncate + `title`) atau `—`. Job No = `<Link href={`/jobs/${jobId}`}>` gaya sama dengan sel No Job di `JobRow` (`font-semibold text-slate-900 hover:text-orange-700`). Package/CBM/Berat = `numberID(...)` bila > 0 else `—` (kelas `tabular-nums text-slate-700`). Catatan = tiap note satu baris `${operationalNoteKindLabels[note.kind]}: ${note.text}` (import dari `@/domain/job/manifest`, label yang sama dipakai `job-manifest-section.tsx`); `—` bila kosong; sel boleh wrap (`whitespace-normal`).

### 3. Tab & data di `app/(dashboard)/events/[id]/page.tsx`

- Impor: `buildHallGroups` dari `@/lib/hall-view`, `EventHallView` dari `@/components/event-hall-view`.
- State: `const [view, setView] = useState<'jenis' | 'hall'>('jenis')`. `loadData` tidak berubah (tidak ada request baru).
- `const hallGroups = useMemo(() => buildHallGroups(jobs), [jobs])`.
- Di `<section className="space-y-4">` "Detail Jobs" (L181-269): di bawah baris judul/tombol "New Job" (L182-195) tambahkan penanda tab. Salin pola segmented tab yang sudah ada di `components/it-inventory/ledger-views.tsx` L146-159 (kelas dan atribut ARIA sama; jangan membuat varian kelas kedua):
  ```tsx
  <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium" role="tablist" aria-label="Tampilan job">
    {([['jenis', 'Per Jenis Job'], ['hall', 'Per Hall']] as const).map(([value, text]) => (
      <button key={value} type="button" role="tab" aria-selected={view === value}
        onClick={() => setView(value)}
        className={`rounded-md px-3 py-1.5 ${view === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
        {text}
      </button>
    ))}
  </div>
  ```
- Ganti kondisi render daftar: `view === 'hall' ? <EventHallView groups={hallGroups} /> : jobs.length ? (…tampilan jenis yang ada, tidak diubah…) : (…pesan kosong yang ada…)`. Heading "Detail Jobs" dan tombol New Job tidak diubah.
- Jangan mengubah `JobRow`, `groupJobsByJenis`, atau halaman lain.

### 4. Tes `lib/hall-view.test.ts` (baru) + daftar skrip

Gaya mengikuti `lib/job-list.test.ts` (`node:assert/strict`, helper `job(overrides)` dengan cast `as Job`, top-level asserts, `console.log('hall-view passed')`). Tambahkan `lib/hall-view.test.ts` ke skrip `domain:test` di `package.json` tepat setelah `lib/job-list.test.ts` (file di luar daftar tidak pernah berjalan). Kasus (helper `line(exhibitorId|null, name, hall, booth, totalCount, notes?)` membuat `JobCiplLine` minimal dengan `koli: { totalCount, details: [] }`):
- Dua job, exhibitor di hall `B10`, `B2`, `b2` (baris `B2` diletakkan sebelum `b2` dalam input, karena label = hall pertama yang ditemui), dan satu baris belum tertaut + satu exhibitor `hall: null` → grup urut `B2` (gabungan `B2`+`b2`, label `B2`), `B10`, lalu "Tanpa hall" (`label === null`) berisi dua baris tersebut.
- Exhibitor yang sama di dua job → dua baris berurutan dalam hallnya, `exhibitorCount === 1`, `totals.totalCount` = jumlah kedua baris.
- Job `CANCELLED` tidak menghasilkan baris; hall yang hanya berisi job batal tidak muncul.
- `agent` terisi untuk `party.kind === 'AGENT'`, `null` untuk `'EXHIBITOR'`/`null`.
- Urutan baris dalam hall: booth `A10` setelah `A2`, booth null terakhir.
- `jobNo`: `jobNumber: ' S.01/X '` → `'S.01/X'`; `jobNumber: null, manifestPrefix: 'S'` → `'S.-'` (fallback `jobLabel`).

## Critical files & anchors

- `app/(dashboard)/events/[id]/page.tsx` — `loadData` (L57-66), section "Detail Jobs" (L181-269); tempat tab dan percabangan tampilan.
- `components/job-row.tsx` — referensi gaya baris/Link No Job (L100-111); tidak diubah.
- `domain/job/types.ts` — `JobCiplLine` (L182-192), `Job.party` (L177-179); sumber field.
- `package.json` — skrip `domain:test`.

## Verification

1. `npx tsc --noEmit` bersih.
2. `bun test lib/hall-view.test.ts` lulus, lalu `npm run domain:test`.
3. Manual (`npm run dev`, login): buka `/events/<id>` yang punya ≥2 job dengan exhibitor berhall berbeda dan ≥1 baris tanpa hall. Tab "Per Jenis Job" tampil identik dengan sebelum perubahan. Klik "Per Hall": kartu per hall urut natural (B2 sebelum B10), "Tanpa hall" terakhir; tiap baris memuat Exhibitor, Booth, Agent, Job No (tautan ke `/jobs/<id>`), Package, CBM, Berat, Catatan; badge header grup menjumlahkan pkg/CBM/Kg barisnya; klik header grup menutup/membuka. Job yang dibatalkan tidak muncul di tab Per Hall. Event tanpa job: tab Per Hall menampilkan pesan kosong.

## Assumptions & contingencies

- Tab di halaman event dipilih (bukan halaman terpisah) karena data sudah dimuat di halaman itu; override bila ingin route `/events/[id]/halls`.
- Tab Per Hall mengecualikan job `CANCELLED`, sedangkan tab Per Jenis Job dan Export Manifest tetap menampilkannya; total pkg/CBM per hall karena itu bisa lebih kecil dari jumlah total di tab jenis. Disengaja (tampilan lapangan).
- Catatan = hanya `line.notes` (catatan per exhibitor di kiriman); catatan level job (`job.notes`, `inward.notes`) tidak ditampilkan.
- Agent hanya diisi bila pihak job berjenis AGENT; job yang dipegang exhibitor langsung menampilkan `—` (agent tidak disimpan di exhibitor, lihat komentar `domain/exhibitor/types.ts`).
- Satu baris per baris CIPL (exhibitor dengan beberapa job muncul beberapa baris), bukan digabung per exhibitor.
- Excel "Export Manifest" belum diubah; bila klien ingin urutan per hall juga di Excel, itu pekerjaan terpisah dengan `lib/manifest-export.ts` `inwardSheet`.
- Bila `Intl.Collator('id', { numeric: true })` memberi urutan tak terduga di bun, ganti locale ke `'en'`.
