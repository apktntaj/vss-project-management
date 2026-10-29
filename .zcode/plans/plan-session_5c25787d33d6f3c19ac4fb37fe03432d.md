# Rencana: Insight & Aksi Staff di Halaman Events

Keempat fitur dibangun di atas data yang sudah ada (55 event aktif + tabel jobs). Semua agregat dihitung **server-side** di repository (pola `computeAttention` yang sudah ada), dirender sebagai Server Component — konsisten dengan arsitektur slice event.

## 1. Data layer — agregat insight baru

**`domain/event/types.ts`** — tipe baru:
```ts
type EventInsightItem = { id, name, startsOn, endsOn, venueName }
type EventInsights = {
  dueSoon: EventInsightItem[]          // starts_on hari ini..H+14, urut terdekat
  soonWithoutJob: EventInsightItem[]   // starts_on hari ini..H+30 TANPA job apa pun
  venueConflicts: { venueName, events: EventInsightItem[] }[]  // overlap tanggal + venue sama
  scheduleOverlapCount: number
  archivable: EventInsightItem[]       // sudah selesai (ends_on < hari ini) tapi masih ACTIVE
  picLoad: { picName, count }[]        // event ACTIVE per PIC, urut terbanyak
  eoRanking: { name, count }[]         // top 5
  perMonth: { month, count }[]         // '2026-06' dst, ACTIVE saja
  venueRanking: { name, count }[]      // top 5, ACTIVE saja
}
```

**`features/events/repository.ts`**:
- `queryEventInsights(workspaceId, today)` — 2 query: (a) event ACTIVE dengan join venue/EO/PIC (kolom minimal), (b) `jobs.select('id,payload->>eventId')` lalu dikelompokkan di JS jadi himpunan eventId yang punya job (pola jsonb `payload->>jobId` yang sudah dipakai api/jobs/[jobId]).
- `computeInsights(rows, jobEventIds, today)` — fungsi murni (reuse `rangesOverlap`), mudah dites nanti.
- `queryEventList`: dukung `query.picId` → `.eq('pic_id', ...)`.

**`features/events/use-cases/list-event-insights.ts`** (baru) — `authorize('event:read')` → delegasi; export lewat barrel `features/events/index.ts`.

## 2. Panel "Perlu tindakan" (menggantikan kartu Attention)

**`features/events/components/event-insights-panel.tsx`** (server component, baru) — kartu dengan ikon + judul per seksi, tiap item = `Link` ke `/events/[id]` + tanggal (`formatDateRange`):
- **Segera (≤14 hari)** — daftar maks 5 + "dan N lainnya".
- **Belum ada job (≤30 hari)** — sinyal follow-up.
- **Konflik venue** — pasangan event di venue sama yang tanggalnya beririsan; **Konflik jadwal** — angka pasangan beririsan (drill-down pasangan penuh menyusul bila dirasa ramai).
- **Bisa diarsipkan** — event selesai yang masih ACTIVE (penghubung ke fitur #4).
- Kosong semua → pesan "Tidak ada yang perlu ditindak lanjuti."

**`app/(dashboard)/events/page.tsx`**: panggil `listEventInsights` paralel dengan `listEventsForDashboard`; urutan halaman jadi: **ringkasan (Total, Berlangsung, Beban PIC ringkas) → control panel → panel Perlu tindakan → tabel → statistik**. Kartu Attention lama dihapus (digantikan panel).

## 3. Filter + beban PIC

- **`event-filters.tsx`**: tambah `<select>` PIC (opsi `pics` yang sudah dimuat page; "Semua PIC" default) → `applyParams({ pic })`; tombol Reset juga menghapus `pic`.
- **Page `toQuery()`** baca `searchParams?.pic` → `query.picId`; **`EventListQuery`** (domain) dapat field `picId?`.
- Beban PIC ringkas = kartu ketiga ringkasan: top PIC + jumlah (memancing penugasan ulang karena kini semua masih "Administrator").

## 4. Menu "Arsipkan" (use-case server sudah jadi, tinggal UI)

**`event-card-actions.tsx`**:
- Item menu "Arsipkan" (ikon `Archive`, lucide) — disembunyikan bila event sudah ARCHIVED (prop `status` baru dari `event-list.tsx`).
- Dialog konfirmasi netral (bukan merah — arsip bukan tindakan destruktif) → `POST /api/events/[eventId]/archive` → toast "Event diarsipkan." → `router.refresh()`.
- Badge "Diarsipkan" + opacity baris sudah ada dari render lifecycle.

## 5. Statistik EO / bulan / venue

**`features/events/components/event-statistics.tsx`** (server component, baru) — section di bawah tabel, 3 kartu kompak tanpa drill-down: EO terbanyak (top 5), event per bulan (teks "Jun 2026 · 8" berurutan; helper `formatMonth` ditambahkan di `event-presentation.ts` yang sudah punya daftar MONTHS), venue terpadat (top 5).

## Validasi

1. `npx tsc --noEmit` bersih.
2. Verifikasi visual via browser (cookie sesi admin): panel memuat daftar nyata, filter PIC mengubah URL dan menyaring tabel, statistik terisi, menu Arsipkan tampil dengan dialog.
3. Endpoint arsip TIDAK dieksekusi pada data asli saat verifikasi (cukup wiring UI; endpoint sudah dipakai use-case yang ada).

## Catatan batasan
- `dueSoon`/`soonWithoutJob` hanya menghitung event yang **belum dimulai** (starts_on ≥ hari ini); yang sedang berjalan sudah terwakili kartu "Berlangsung".
- Semua insight hanya dari event ACTIVE (konsisten dengan `computeAttention`).
- Tidak ada migrasi DB; tidak menambah dependensi.