# Konvensi Kode

## Bahasa

- **Semua teks yang dilihat user: bahasa Indonesia.** Kalimat lengkap, huruf kapital di awal,
  diakhiri titik. Contoh: `'Nama event wajib diisi.'`, `'Total alokasi melebihi quantity CIPL.'`,
  `'Autentikasi diperlukan.'`
- Identifier, enum, kode error, nama tabel/kolom: bahasa Inggris. Enum dan kode error
  `SCREAMING_SNAKE_CASE` (`REQUIRED_FIELD_MISSING`, `READY_FOR_CUSTOMS`).
- Komentar kode: campur Indonesia/Inggris, keduanya diterima. Tulis komentar hanya untuk
  menjelaskan *kenapa*, bukan *apa* — itu gaya yang berlaku di repo.
- Field CEISA memakai nama Indonesia asli dari spesifikasi Bea Cukai (`nomorAju`, `kodeKantor`,
  `bruto`, `netto`). Jangan diterjemahkan.
- `formatDate()` di `lib/utils.ts` memakai locale `id-ID`.

## Format

`.prettierrc.json`: single quote, tanpa semicolon, tab 2, trailing comma all, print width 100.

Pengecualian yang sudah ada: file di `components/ui/` adalah hasil generate shadcn/base-ui dan
memakai double quote serta `import { cn } from "cn"` (package npm `cn`), sedangkan seluruh kode lain
memakai `import { cn } from '@/lib/utils'`. Ada dua implementasi `cn` di proyek ini.
**Untuk kode baru pakai `@/lib/utils`.** Kalau menyentuh file di `components/ui/`, pertahankan gaya
file itu agar diff tetap kecil.

## Validasi

Dua gaya, dipakai untuk tujuan berbeda. Pertahankan pemisahan ini.

**1. Zod — parsing input user di batas API.** Acuan: `domain/event/validation.ts`.

```ts
export const eventInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama event wajib diisi.'),
  venueId: z.string().trim().min(1, 'Venue wajib dipilih.'),
  startsOn: dateOnly,
  endsOn: dateOnly,
}).superRefine((value, context) => {
  if (value.endsOn < value.startsOn) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endsOn'],
      message: 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.' })
  }
})
```

Konvensi: `.trim().min(1, '<pesan>')`, `.strict()` pada object input,
`z.discriminatedUnion('kind', [...])` untuk varian, `.superRefine` untuk aturan antar-field.
Skema hidup di `domain/<area>/validation.ts`, dipanggil dari route dengan `schema.parse(...)`
(throw, ditangkap `try/catch` → 400) atau `safeParse` kalau butuh respons eksplisit.

**2. Validator tulis-tangan — invariant bisnis.** Acuan: `domain/exhibition/validation.ts`.

```ts
export type ValidationIssue = { path: string; message: string }
export type Validation<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] }
```

Fungsi murni, tidak throw, mengembalikan semua issue sekaligus. Pakai bentuk ini untuk validator
invariant baru. Di repo ada tiga bentuk hasil lain (`string | null` di `domain/ticket/validation.ts`,
`ValidationResult<T>` di `domain/v2/`, `{ ok, user } | { ok, error }` di `lib/demo-users.ts`) —
jangan menambah bentuk keempat.

**Di mana divalidasi.** Input user: Zod di route handler. Invariant bisnis: idealnya juga di server.
Perhatikan bahwa lima validator `domain/exhibition/validation.ts`
(`validateCiplVersionReady`, `validateShipmentAllocation`, `validateJobAllocation`,
`validateJobTransition`, `validateDateRange`) saat ini **hanya dipanggil dari `lib/data-client.ts`,
di browser** — artinya bisa dilewati dengan memanggil `/api/operational-records` langsung.
Untuk invariant baru, panggil dari route handler, bukan dari data-client.

Komponen tidak melakukan validasi domain sendiri; mereka menampilkan error dari server.

## State machine

Satu-satunya transisi status yang benar-benar dijaga adalah `validateJobTransition` untuk
`CustomsJobStatus`:

```
DRAFT → PREPARING → SUBMITTED → REGISTERED → RELEASED → COMPLETED
```

Maju satu langkah bebas; `ON_HOLD`/`CANCELLED` bebas dari status apa pun; selain itu wajib
`reason` + minimal satu attachment sebagai evidence. Catatan: keluar dari `ON_HOLD` juga jatuh ke
cabang "wajib reason + evidence" karena `ON_HOLD` tidak ada di array progression.

`ShipmentStatus` dan `CiplStatus` punya enum tapi **tidak punya aturan transisi**. `Event` tidak
punya enum status sama sekali — lifecycle-nya diwakili objek `cancellation`, sementara status tampilan
`'soon' | 'ongoing' | 'done'` dihitung di `app/(dashboard)/events/page.tsx`. Kalau fitur baru butuh
transisi status, tulis validatornya di `domain/`, bukan di komponen.

## Komponen dan halaman

Pola halaman data yang berlaku:

```tsx
'use client'
export default function SomePage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingStartedAt = useRef(Date.now())

  useEffect(() => {
    loadingStartedAt.current = Date.now()
    setLoading(true)
    getThing(params.id).then((loaded) => {
      setData(loaded)
      finishLoadingAfterMinimum(loadingStartedAt.current, () => setLoading(false))
    })
  }, [params.id])

  if (loading || !data) return <PageSkeleton cards={2} rows={5} />
  ...
}
```

`finishLoadingAfterMinimum` dan `PageSkeleton` dari `components/loading-skeletons.tsx` menjaga
skeleton tampil minimal sesaat agar tidak berkedip. Pakai keduanya untuk halaman data baru.

## Toast

Tidak ada library toast dan tidak ada context. Mekanismenya custom event:

```ts
function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}
```

`AppShell` di `components/layout.tsx` mendengarkan `vss:toast`, merender toast, dan menutupnya
setelah 4 detik. Helper tiga baris di atas **disalin ulang di tiap komponen** yang butuh toast
(`event-form-modal`, `job-init-modal`, `job-manifest-editor-modal`, `exhibitor-logistics-modal`,
`ticket-board`). Sebagian komponen lain menerima prop `onToast` dari induknya.

Untuk kode baru: pakai mekanisme `vss:toast` yang sama supaya konsisten, tetapi **impor helper
bersama daripada menyalinnya lagi** — kalau belum ada, buat satu di `lib/utils.ts` atau
`components/toast.ts` dan pakai dari sana.

Aturan feedback: setiap mutasi memberi toast sukses atau gagal. Error validasi per-field tetap
ditampilkan di dekat input (`setError` + render inline), tidak diganti toast. Toast hanya muncul di
kanan bawah viewport.

## Styling

- Halaman fitur memakai kelas bersama dari `app/globals.css` (`.card`, `.btn-primary`,
  `.btn-secondary`, `.input`, `.label`) plus utility Tailwind literal (`text-slate-500`,
  `text-orange-600`).
- `components/ui/` memakai token semantik (`bg-primary`, `text-muted-foreground`) dan beberapa
  varian `dark:` meski belum ada tema gelap, serta `--radius-md` yang belum didefinisikan di
  `globals.css`. Verifikasi tampilan kalau memakai primitif ini di tempat baru.
- Aksesibilitas yang sudah dijaga: `aria-label` pada navigasi, `skip-link`, outline `focus-visible`
  global, dan penghormatan `prefers-reduced-motion`. Pertahankan di UI baru.

## Kepadatan kode

Banyak file sengaja ditulis sangat padat — beberapa elemen JSX dan seluruh blok `.map()` dalam satu
baris panjang (lihat `app/(dashboard)/cipls/[id]/page.tsx`). Ini menyulitkan review dan diff.
**Jangan tiru.** Untuk kode baru tulis JSX dengan baris normal mengikuti `printWidth: 100`.
Jangan pula memformat ulang file padat yang tidak sedang kamu ubah — itu menghasilkan diff besar
tanpa nilai.
