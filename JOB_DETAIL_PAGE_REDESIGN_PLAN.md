# Redesign Halaman `/jobs/:id` — Tab Area Kerja + Stepper Kesiapan + Kartu Lampiran

## Context

Halaman detail job saat ini adalah satu scroll vertikal ≥2.300px (draft kosong; dengan manifest nyata bisa 4.000–6.000px) tanpa navigasi/URL state. CIPL (jantung job) jatuh di kanan bawah, tagihan muncul sebelum dokumen angkut, dua sumber data barang (manifest vs invoice) terpisah, tidak ada tempat melihat lampiran yang sudah diunggah, dan banner "Kesiapan Job" hanya menghitung dokumen BC. Tujuan: reorganisasi halaman menjadi **3 tab area kerja** (`ringkasan` | `barang` | `dokumen`) dengan state di URL, **stepper kesiapan** di header yang menggantikan banner orange, **kartu Lampiran dokumen** (API list baru), dan pembersihan duplikasi (dialog hapus shared, fragment sisa). Seluruh kartu inline-edit yang ada (`components/job-detail-cards.tsx`) dipertahankan apa adanya — hanya dipindahkan. Catatan penyempurnaan dari laporan awal (4 tab → 3): kartu Pihak·Tagihan digabung ke tab Ringkasan karena tab "Tagihan" terpisah hanya akan berisi Remark + Logistik (terlalu tipis); tab default tetap memuat tagihan sehingga peran FINANCE justru lebih cepat mengaksesnya.

Konvensi wajib repo: UI hanya akses data via `@/lib/data-client`; route handler satu-satunya penyentuh Supabase (`lib/supabase/*`, `server-only`); toast untuk setiap mutasi (event `vss:toast`, bottom-right); validasi `npx tsc --noEmit`, `npm run domain:test`, `npm run build`, `npm run guard:arch`.

## Approach

### Langkah 1 — Fondasi murni: label dokumen + model kesiapan

1a. `domain/job/types.ts` — tambah setelah deklarasi `jobDocumentKinds`/`JobDocumentKind` (±baris 134):

```ts
export const jobDocumentKindLabels: Record<JobDocumentKind, string> = {
  SOURCE: 'Dokumen sumber',
  INBOUND_TRANSPORT: 'Angkut masuk',
  OUTBOUND_TRANSPORT: 'Angkut keluar',
  BILL_OF_LADING: 'Bill of Lading',
  AIR_WAYBILL: 'Air Waybill',
  COMMERCIAL_INVOICE: 'Commercial invoice',
  CIPL: 'CIPL',
  BC_2_3: 'BC 2.3',
  BC_2_5: 'BC 2.5',
  BC_3_0: 'BC 3.0',
  BC_2_7: 'BC 2.7',
  OTHER: 'Lainnya',
}
```

(BC 2.3/2.5/3.0/2.7 meniru nilai `bcDocumentLabels` yang sudah ada di file yang sama.)

1b. File baru `lib/job-readiness.ts` — derivasi murni tanpa I/O. Impor hanya dari `@/domain/job/operational` (`normalizeOperationalDetails`) dan `@/domain/job/types` + `@/domain/job/numbering` (`jobLabel`) — JANGAN dari `@/lib/data-client` (module itu `'use client'`; domain-only menjaga bisa dites bun seperti `lib/manifest-view.ts`). Signature:

```ts
export type JobDetailTab = 'ringkasan' | 'barang' | 'dokumen'
export type JobReadinessStepState = 'todo' | 'doing' | 'done'
export type JobReadinessStep = {
  key: 'number' | 'transport' | 'cipl' | 'customs' | 'invoice'
  label: string
  detail: string
  state: JobReadinessStepState
  tab: JobDetailTab
}
export type JobReadiness = { steps: JobReadinessStep[]; doneCount: number }
export function buildJobReadiness(job: Job): JobReadiness
```

Semantik tepat (satu langkah per baris):

| key | label | state | detail | tab |
|---|---|---|---|---|
| `number` | No Job | `job.jobNumber` truthy → done, else todo | `jobLabel(job)` (mis. `S.-`) | ringkasan |
| `transport` | B/L · AWB | `job.transportDocumentNumber` truthy → done, else todo | `${job.transportDocumentType ?? ''} ${job.transportDocumentNumber}` atau `Belum ada` | dokumen |
| `cipl` | CIPL | dari `normalizeOperationalDetails(job.operational).cipl.status`: MISSING→todo, REQUESTED/RECEIVED→doing, VERIFIED→done | MISSING `Belum ada` / REQUESTED `Diminta` / RECEIVED `Diterima` / VERIFIED `Terverifikasi` | barang |
| `customs` | Dokumen BC | `job.kind === 'LOCAL'` → done (detail `Tidak diperlukan`). Else hitung dari `operational.customs`: `required` = jumlah `applicable`, `completed` = `applicable && status === 'COMPLETED'`; `required === 0` → done (`Tidak diperlukan`); else done iff `completed === required`, doing iff `completed > 0`, else todo | `${completed}/${required} selesai` | dokumen |
| `invoice` | Tagihan | `job.invoice.status`: PAID→done, SENT/READY→doing, NOT_READY→todo | `invoiceStatusLabels[job.invoice.status]` (impor dari types) | ringkasan |

`doneCount` = jumlah step `done`. Default customs sudah benar via `normalizeOperationalDetails` (BC 2.3 & 3.0 applicable, 2.5 & 2.7 tidak).

1c. Test baru `lib/job-readiness.test.ts` bergaya `lib/manifest-view.test.ts` (bun:test): job minimal `Job` factory — verifikasi: (1) job kosong → number/transport todo, cipl todo, customs 0/2 doing-todo untuk INTERNATIONAL, invoice todo; (2) `kind: 'LOCAL'` → customs done `Tidak diperlukan`; (3) job lengkap (jobNumber + BL + cipl VERIFIED + kedua BC applicable COMPLETED + invoice PAID) → semua done, `doneCount === 5`; (4) setiap step menunjuk tab yang benar. **Wajib** tambahkan ` lib/job-readiness.test.ts` ke daftar file di script `domain:test` `package.json` (sisipkan setelah `lib/job-number.test.ts `) — tanpa ini test tidak pernah jalan.

### Langkah 2 — API daftar lampiran (list by owner)

2a. `lib/supabase/attachments.ts` — tambah (penamaan kolom ikut tabel `attachments`; lihat pola `removeAttachmentsOfOwner` di file yang sama untuk workspace+owner filter):

```ts
export type AttachmentMeta = {
  id: string
  kind: string | null
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
}
export async function listAttachmentsByOwner(
  ownerType: AttachmentOwner,
  ownerId: string,
): Promise<AttachmentMeta[]>
```

Select `id, kind, file_name, mime_type, file_size, created_at` where `workspace_id` (via helper `workspaceId()` yang sudah ada) + `owner_type` + `owner_id`, order `created_at desc`. Error → `throw new Error(\`Lampiran tidak dapat dimuat: ${error.message}\`)`.

2b. `app/api/attachments/route.ts` — ubah `GET`: urutan cabang — (1) `id` ada → perilaku lama (download blob, jangan diubah); (2) `id` kosong tapi `ownerType` + `ownerId` ada → validasi `owners.has(ownerType)` (400 `Owner lampiran tidak valid.` bila tidak) lalu `NextResponse.json(await listAttachmentsByOwner(...))` dengan `Cache-Control: no-store`; (3) keduanya kosong → 400 `ID lampiran atau owner wajib diisi.` Tetap pakai guard `auth()` yang sudah ada di handler.

2c. `lib/data-client.ts` — tambah:

```ts
export type JobAttachmentMeta = {
  id: string
  kind: string | null
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
}
export async function listJobAttachments(jobId: string): Promise<JobAttachmentMeta[]>
```

GET `/api/attachments?ownerType=JOB&ownerId=${encodeURIComponent(jobId)}`, `cache: 'no-store'`; `!response.ok` → `throw new Error('Lampiran tidak dapat dimuat.')`; else map field snake_case JSON → camel. Bentuk respons 2a harus sama dengan camel-case mapping ini — kembalikan sudah camel dari route (map di route atau kembalikan AttachmentMeta camel dari adapter; pilih: adapter mengembalikan camel langsung).

### Langkah 3 — Dialog hapus job shared

3a. File baru `components/delete-job-dialog.tsx` (`'use client'`). Salin markup alertdialog dari `app/(dashboard)/jobs/[id]/page.tsx` baris 395–444 APA ADANYA (overlay `onMouseDown` click-away, `role="alertdialog"`, tombol Batal/Hapus permanen). Props:

```ts
export function DeleteJobDialog({
  job,
  open,
  onClose,
  onDeleted,
}: {
  job: Job
  open: boolean
  onClose: () => void
  onDeleted: (job: Job) => void
})
```

State `deleting` internal; `handleDelete` memanggil `deleteJob(job.id)` (impor dari `@/lib/data-client`); sukses → `onDeleted(job)`; gagal → toast `vss:toast` tone error (`caught.message` fallback `Job tidak dapat dihapus.`) dan `setDeleting(false)`. Teks body pakai versi terbaru (jobs page): "beserta lampiran dokumen, baris CIPL, dan tiket yang terikat padanya akan dihapus permanen." dengan `<span className="font-semibold">{jobLabel(job)}</span>`.

3b. `app/(dashboard)/jobs/[id]/page.tsx` — ganti dialog inline + `handleDelete`/`deleting` dengan `<DeleteJobDialog job={job} open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={() => { toast(\`Job ${jobLabel(job)} dihapus.\`); router.push('/jobs') }} />`; hapus impor `deleteJob`, `AlertTriangle` bila tak terpakai lagi.

3c. `app/(dashboard)/events/[id]/page.tsx` — ganti blok dialog inline (baris 283–332) dengan `<DeleteJobDialog job={deletingJob} open={!!deletingJob} onClose={() => setDeletingJob(null)} onDeleted={(deleted) => { showToast(\`${jobLabel(deleted)} dihapus.\`); setDeletingJob(null); loadData() }} />`; state `deleting` dihapus; hapus impor `deleteJob`, `AlertTriangle` bila tak terpakai; tambah impor `jobLabel` dari `@/domain/job/numbering`.

### Langkah 4 — Komponen baru: stepper, kartu lampiran, menu aksi header

4a. File baru `components/job-readiness-bar.tsx` (`'use client'`). Props `{ job: Job; activeTab: JobDetailTab; onNavigate: (tab: JobDetailTab) => void }`. Re-impor `JobDetailTab` dari `@/lib/job-readiness` (didefinisikan di sana, langkah 1b). Render `<section className="card p-5">` berisi judul kecil "Kesiapan Job" + deretan step horizontal `flex flex-wrap gap-x-6 gap-y-3`; tiap step = `<button type="button">` dengan: dot (`todo`: lingkaran ring slate-300; `doing`: solid amber-500; `done`: solid emerald-600 + ikon Check lucide putih kecil), label semibold, detail text-xs slate-500. `onClick={() => step.tab !== activeTab && onNavigate(step.tab)}`. Step adalah progres, bukan form — tidak perlu toast.

4b. File baru `components/job-attachments-card.tsx` (`'use client'`). Props `{ job: Job }`. State: `items: JobAttachmentMeta[]`, `loading`, `error`. `useEffect` pada `[job.id, job.version]` → `listJobAttachments(job.id)` (catch → set error). Render `<section className="card p-5">` "Lampiran dokumen": loading → teks abu "Memuat lampiran…"; error → teks rose + tombol "Coba lagi" (`btn-secondary`) yang memanggil ulang fetch; kosong → "Belum ada lampiran. Unggah lewat editor dokumen (scan B/L, scan CIPL, form BC)."; ada item → tabel/himpitan baris: kolom Jenis (`jobDocumentKindLabels[kind as JobDocumentKind] ?? kind ?? 'Tan jenis'` — impor keduanya dari `@/domain/job/types`), Nama file (truncate + title), Ukuran (`${(fileSize / 1024 / 1024).toFixed(1)} MB` bila ≥1MB else `${Math.max(1, Math.round(fileSize / 1024))} KB`), Tanggal (reuse `date` yang di-export `@/components/job-row`), aksi "Lihat" → `getAttachmentContent(id)` (sudah ada di data-client) → `URL.createObjectURL(blob)` + `window.open(url)` + `revokeObjectURL` setelah `setTimeout` singkat. Tanpa hapus per-item (API hapus per-lampiran tidak ada; pembersihan ikut penghapusan job).

4c. Menu aksi header — implement **inline di page** (bukan komponen baru; hanya satu pemakai). Ikuti pola menu job-row (`components/job-row.tsx` baris 160–216): state `menuAnchor: { top: number; left: number } | null`, tombol `<MoreVertical size={18} />` `aria-label="Menu aksi job"`, overlay fixed inset-0 z-40 penutup, menu fixed z-50 `w-52` berisi: bila `job.kind === 'INTERNATIONAL'` → 4 item "Export workbook BC 2.3/2.5/3.0/2.7" (ikon FileSpreadsheet) masing-masing → `downloadCustomsWorkbook(job, kind)` (impor dari `@/components/job-row`) + toast sukses `${label(kind)} berhasil diunduh.` / gagal tone error; garis pemisah; item "Hapus job" (ikon Trash2, teks rose) → `setMenuAnchor(null); setDeleteOpen(true)`. Tombol "Hapus" lama di header dihapus.

### Langkah 5 — Restrukturisasi `app/(dashboard)/jobs/[id]/page.tsx`

5a. Tab state + URL (tanpa `useSearchParams` — mengikuti preseden `events/[id]` baris 72–74 yang baca `window.location.search` di effect; menghindari kebutuhan Suspense Next 14):

```ts
const [tab, setTab] = useState<JobDetailTab>('ringkasan')
useEffect(() => {
  const fromUrl = new URLSearchParams(window.location.search).get('tab')
  if (fromUrl === 'barang' || fromUrl === 'dokumen') setTab(fromUrl)
}, [])
function selectTab(next: JobDetailTab) {
  setTab(next)
  window.history.replaceState(
    null,
    '',
    next === 'ringkasan' ? `/jobs/${job.id}` : `/jobs/${job.id}?tab=${next}`,
  )
}
```

(`replaceState` dipilih agar tidak memicu re-render/rerender server; back button tetap ke halaman sebelumnya.)

5b. Struktur render baru (semua di dalam `return` setelah guard loading/error yang sudah ada):

```
<div className="space-y-6">
  header: [tidak berubah: back-link, H1, JobContextSummary, baris party·B/L·chip jenis] + tombol menu ⋯ (4c) menggantikan tombol Hapus
  <JobReadinessBar job={job} activeTab={tab} onNavigate={selectTab} />     ← menggantikan section orange "Kesiapan Job" (baris 266–281 dihapus; helper `label` baris 38 dihapus bila tak terpakai lagi)
  <Tabs value={tab} onValueChange={(value) => selectTab(value as JobDetailTab)}>
    <div className="sticky top-0 z-30 -mx-1 border-b bg-white/95 px-1 py-2 backdrop-blur">
      <TabsList> 3 × TabsTrigger </TabsList>        ← label: "Ringkasan" / "Barang & Manifest" / "Dokumen & Kepabeanan"; value: ringkasan/barang/dokumen
    </div>
    <TabsContent value="ringkasan" className="pt-6">
      grid gap-6 xl:grid-cols-2: JobIdentityCard · JobPartyInvoiceCard · JobJourneyCard · JobLogisticsCard · JobRemarkCard (semua props sama seperti sekarang; JobPartyInvoiceCard tetap terima `exhibitors={isEvent ? exhibitors : null}`)
    </TabsContent>
    <TabsContent value="barang" className="space-y-6 pt-6">
      JobCiplStatusCard (onSaved={setJob} onScan={() => setCiplEntryOpen(true)})
      {isEvent && <JobManifestSection ... tidak berubah ...>}
      section "Details Barang" (JSX inline baris 313–349 dipindah apa adanya)
    </TabsContent>
    <TabsContent value="dokumen" className="space-y-6 pt-6">
      section "Pihak pada dokumen angkut" (JSX inline baris 287–302 dipindah apa adanya, tombol scan tetap setTransportOpen)
      {documentComparison && <DocumentComparisonSummary comparison={documentComparison} />}
      <JobCustomsCard job={job} onSaved={setJob} />
      <JobAttachmentsCard job={job} />
    </TabsContent>
  </Tabs>
  modal-modal tidak berubah (manifest, line, cipl entry, transport editor) + <DeleteJobDialog .../> (langkah 3b)
</div>
```

Hapus: section orange Kesiapan Job, wrapper fragment `<>…</>` baris 284/353, grid lama 2/3-1/3, dialog hapus inline, state `deleting`/`handleDelete`. Pertahankan: seluruh state & effect yang ada (`job`, `exhibitors` + efek `jobVersion`, `loadError`, skeleton, error state). Konteks non-EVENT di masa depan dijaga tetap lewat `isEvent` — section manifest hanya render bila EVENT (kontrak `lib/job-context.ts`).

Tabs sticky: aman karena header AppShell (`components/layout.tsx` baris 203) berada di flow normal (bukan fixed) dan sidebar `md:fixed z-20`; z-30 di bawah modal (z-50/z-60).

### Langkah 6 — Verifikasi (lihat bagian Verification)

## Critical files & anchors

- `app/(dashboard)/jobs/[id]/page.tsx` — seluruh reorganisasi (header menu, stepper, tabs, relokasi section, hapus banner + fragment + dialog inline).
- `lib/job-readiness.ts` (baru) + `lib/job-readiness.test.ts` (baru) — derivasi stepper; model referensi gaya: `lib/manifest-view.ts` + test-nya.
- `app/api/attachments/route.ts` — GET bercabang `id` vs `ownerType/ownerId`; jangan ubah POST dan cabang download.
- `lib/supabase/attachments.ts` — `listAttachmentsByOwner` (pola `removeAttachmentsOfOwner` baris 64–87).
- `components/job-detail-cards.tsx` — TIDAK diubah; hanya jadi acuan props kartu yang direlokasi.

## Verification

Prasyarat: dev server jalan (`npm run dev`, sudah aktif di :3000 dengan sesi login tersimpan di browser managed); job uji `97b675d9-963b-4e60-af28-8d72ff582d5f` (TPPB BC 2.3, event Allpack, draft kosong).

1. `npx tsc --noEmit` — bersih.
2. `npm run domain:test` — semua lulus termasuk `lib/job-readiness.test.ts` baru (bun hanya menjalankan file yang terdaftar di script — pastikan terdaftar).
3. `npm run guard:arch` — exit 0 (komponen baru hanya impor domain + data-client, tidak menyentuh server-only).
4. `npm run build` — lulus.
5. Smoke browser di `http://localhost:3000/jobs/97b675d9-963b-4e60-af28-8d72ff582d5f`:
   - Tab default Ringkasan aktif; 5 kartu tampil; URL tanpa `?tab`.
   - Stepper menampilkan 5 step; job draft → No Job todo (`S.-`), B/L todo, CIPL todo, Dokumen BC `0/2 selesai` doing-todo (BC 2.3+3.0 applicable default), Tagihan todo.
   - Klik step "CIPL" → pindah ke tab "Barang & Manifest", URL jadi `…?tab=barang`; refresh → tab barang tetap aktif.
   - Klik step "Dokumen BC" → tab "Dokumen & Kepabeanan": ada section Pihak dokumen angkut, kartu 4 BC, kartu Lampiran (empty state).
   - Menu ⋯ di header: 4 item export workbook (job INTERNATIONAL) + "Hapus job"; klik Hapus → dialog shared muncul; Batal menutup.
   - Unggah lampiran nyata: tekan "Ubah" di kartu Dokumen kepabeanan → isi "Lampiran PDF" salah satu BC dengan PDF kecil (buat `/tmp/vss-test.pdf` berisi PDF 1-halaman minimal) → Simpan → kartu Lampiran kini menampilkan baris BC dengan nama file + "Lihat" membuka PDF di tab baru.
   - Halaman `/events/c6e7051b-…` (Allpack): menu/aksi hapus job (buka grup jenis → menu baris) tetap memunculkan dialog shared dan menghapus dengan benar (toast + daftar job refresh).
6. Regresi visual cepat `/jobs` (tabel, export workbook dari baris) tidak berubah.

## Assumptions & contingencies

- **3 tab, bukan 4** dari laporan awal — keputusan sudah dibakar di Context; bila user meminta tab "Tagihan" terpisah, pindahkan `JobPartyInvoiceCard` ke tab keempat `tagihan` dan tambahkan ke union `JobDetailTab` + TabsTrigger (satu titik ubah).
- Toggle manifest Ringkas/Tabel tetap state lokal (URL state hanya untuk tab — unit yang di-share); bila user ingin deep-link ke tabel manifest, tambah `?view=tabel` dengan pola `replaceState` yang sama.
- Tidak ada hapus lampiran per-item (tidak ada API-nya; tidak diminta).
- Item export workbook hanya untuk `kind === 'INTERNATIONAL'` (LOCAL tanpa dokumen BC).
- Jika base-ui `TabsContent` ternyata mempertahankan panel tak aktif tetap mounted (hidden), fetch kartu lampiran tetap benar karena efek `[job.id, job.version]` berjalan ulang setelah unggahan (PATCH menaikkan versi).
- Jika `window.history.replaceState` menyebabkan ketidaksinkronan dengan navigasi Next (belum pernah terjadi di repo), fallback: `router.replace(`/jobs/${job.id}?tab=${next}`, { scroll: false })` — perilaku identik untuk kasus ini.
- dev DB hanya punya draft kosong; verifikasi stepper "done" penuh dilakukan lewat unit test (langkah 1c), bukan UI.
