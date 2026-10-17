import { z } from 'zod'

import { fromIssues, issue, ok, type Validation } from '@/domain/shared/validation'

// Mengapa: parsing input pengguna di batas API (Zod) + validator invariant murni untuk Event.
// Dua gaya dipisah sesuai konvensi repo: Zod untuk bentuk/format input, validator tulis-tangan
// yang mengembalikan Validation<T> untuk invariant bisnis (kumpulkan SEMUA issue, tak throw).
// Teks pengguna bahasa Indonesia; identifier/kode bahasa Inggris. Event_Domain_Module —
// Requirement 10–13.

// Tanggal-saja YYYY-MM-DD. String leksikografis ISO ini juga comparable secara benar sebagai
// tanggal (startsOn <= endsOn bisa diuji dengan perbandingan string), jadi domain tak perlu Date.
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Gunakan tanggal YYYY-MM-DD.')

// Bentuk create/edit event. `.strict()` menolak field tak dikenal (Requirement — input ketat).
export const eventInputSchema = z
  .object({
    // Nama kosong ATAU >200 karakter sama-sama memberi pesan 'Nama event wajib diisi.'
    // (Requirement 10.4): batas atas memakai pesan yang sama dengan batas bawah secara sengaja.
    name: z
      .string()
      .trim()
      .min(1, 'Nama event wajib diisi.')
      .max(200, 'Nama event wajib diisi.'),
    // alias opsional (Requirement 10.2/10.3): menerima string, null, atau tak ada; di-trim,
    // kosong-setelah-trim → null, selain itu nilai ter-trim dipersist. Hasil akhir selalu
    // `string | null` sehingga pemanggil tak perlu menebak. Batas 200 karakter diterapkan SEBELUM
    // normalisasi agar string panjang tetap ditolak, bukan diam-diam diterima.
    alias: z
      .string()
      .trim()
      .max(200, 'Alias event maksimal 200 karakter.')
      .nullish()
      .transform((value) => (value && value.length > 0 ? value : null)),
    // Referensi dipegang sebagai id (Requirement 12.4) dan WAJIB UUID — build lama menerima string
    // bebas sehingga bisa menunjuk entitas yang tak ada.
    venueId: z.string().uuid('Venue wajib dipilih.'),
    eventOrganizerId: z.string().uuid('Event organizer wajib dipilih.'),
    picId: z.string().uuid('PIC wajib dipilih.'),
    startsOn: dateOnly,
    endsOn: dateOnly,
  })
  .strict()
  // Aturan antar-field: akhir tidak boleh sebelum mulai (Requirement 10.5 / 11.3). Issue dilekatkan
  // ke path ['endsOn'] agar error muncul di field yang tepat pada form.
  .superRefine((value, context) => {
    if (value.endsOn < value.startsOn) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsOn'],
        message: 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.',
      })
    }
  })

export type EventInputParsed = z.infer<typeof eventInputSchema>

// Pembatalan event butuh alasan 1–1000 karakter (Requirement 13.4). Alasan kosong ditolak di batas
// API sebelum status atau baris cancellation diubah (ditegakkan di use-case cancel-event).
export const cancelEventSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, 'Alasan pembatalan wajib diisi.')
      .max(1000, 'Alasan pembatalan maksimal 1000 karakter.'),
  })
  .strict()

// Konteks referensi: hasil pengecekan eksistensi yang DIPASOK repository (task 10). Validator ini
// murni — tidak menyentuh DB; ia hanya memutuskan dari boolean yang sudah di-resolve server.
export type EventReferenceContext = {
  venueExists: boolean
  eventOrganizerExists: boolean
  picExists: boolean
}

// Invariant referensi (Requirement 10.6 / 12.4): venue, event organizer, dan PIC harus benar-benar
// ada di workspace yang sama. Mengumpulkan SEMUA referensi tidak valid sekaligus (tidak berhenti di
// yang pertama) sehingga pengguna melihat seluruh masalah dalam satu kali. Murni: tak throw, tak
// akses storage — repository menyuntik boolean eksistensinya.
export function validateEventReferences(ctx: EventReferenceContext): Validation<true> {
  const issues = []
  if (!ctx.venueExists) issues.push(issue('venueId', 'Venue tidak ditemukan.'))
  if (!ctx.eventOrganizerExists)
    issues.push(issue('eventOrganizerId', 'Event organizer tidak ditemukan.'))
  if (!ctx.picExists) issues.push(issue('picId', 'PIC tidak ditemukan.'))
  return fromIssues(issues, true as const)
}

// ── Master data venue/EO (create-inline, Requirement 12) ──────────────────────────────────────
// Mengapa nama berakhiran `reference*`: ada skema legacy `venueInputSchema`/`eventOrganizerInputSchema`
// di bawah (bentuk build-lama dengan contacts/address/website) yang MASIH diimpor modul lama. Skema
// redesign ini terpisah dan sengaja dinamai berbeda agar tidak bentrok. `legalName` kosong/spasi →
// ditolak 400 di batas API (Requirement 12.4): `.trim().min(1, ...)` memberi pesan Indonesia.
// Batas atas 200 memakai pesan yang sama dengan batas bawah secara sengaja (mirror gaya nama event).

// `aliasName`/`city` opsional: menerima string, null, atau tak ada; di-trim, kosong-setelah-trim →
// null, selain itu nilai ter-trim. Batas 200 diterapkan SEBELUM normalisasi agar string panjang
// tetap ditolak, bukan diam-diam diterima — sama seperti pola `alias` pada eventInputSchema.
const optionalReferenceText = (overLimitMessage: string) =>
  z
    .string()
    .trim()
    .max(200, overLimitMessage)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null))

export const referenceVenueInputSchema = z
  .object({
    legalName: z
      .string()
      .trim()
      .min(1, 'Nama venue wajib diisi.')
      .max(200, 'Nama venue wajib diisi.'),
    aliasName: optionalReferenceText('Alias venue maksimal 200 karakter.'),
    city: optionalReferenceText('Kota venue maksimal 200 karakter.'),
  })
  .strict()

export type ReferenceVenueInputParsed = z.infer<typeof referenceVenueInputSchema>

export const referenceEventOrganizerInputSchema = z
  .object({
    legalName: z
      .string()
      .trim()
      .min(1, 'Nama event organizer wajib diisi.')
      .max(200, 'Nama event organizer wajib diisi.'),
  })
  .strict()

export type ReferenceEventOrganizerInputParsed = z.infer<typeof referenceEventOrganizerInputSchema>

// ── Legacy (build lama, akan dihapus) ─────────────────────────────────────────────────────────
// Mengapa dipertahankan: clean cutover (DD-A4) memindahkan file ini ke bentuk redesign, tetapi
// modul build-lama di luar scope task 8 MASIH mengimpor skema di bawah dari sini
// (`domain/agent/validation.ts` → contactSchema; `app/api/event-records` & `app/api/settings` →
// venueInputSchema/eventOrganizerInputSchema; `app/api/events/[eventId]/exhibitors` →
// exhibitorInputSchema). Menghapusnya sekarang memutus `npx tsc --noEmit` dengan menyentuh kode di
// luar scope. Diisolasi di sini dan dibuang saat konsumen lama diganti di slice berikutnya.

const legacyOptionalText = z.string().trim().min(1).nullable()

export const contactSchema = z.object({
  name: legacyOptionalText,
  role: legacyOptionalText,
  email: z.string().trim().email('Format email tidak valid.').nullable(),
  phone: legacyOptionalText,
  isPrimary: z.boolean(),
})

export const eventOrganizerInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama EO wajib diisi.'),
  npwp: legacyOptionalText,
  contacts: z.array(contactSchema),
  address: legacyOptionalText,
  website: z.string().trim().url('Website harus berupa URL.').nullable(),
})

export const venueInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama venue wajib diisi.'),
  contacts: z.array(contactSchema),
  address: legacyOptionalText,
  website: z.string().trim().url('Website harus berupa URL.').nullable(),
  loadingAccessNotes: legacyOptionalText,
})

const legacyExhibitorBaseSchema = z.object({
  name: z.string().trim().min(1, 'Nama exhibitor wajib diisi.'),
  contact: contactSchema.omit({ isPrimary: true }),
  agentId: z.string().uuid().nullable(),
})

export const exhibitorInputSchema = z.discriminatedUnion('kind', [
  legacyExhibitorBaseSchema.extend({ kind: z.literal('LOCAL'), npwp: legacyOptionalText }).strict(),
  legacyExhibitorBaseSchema.extend({ kind: z.literal('INTERNATIONAL') }).strict(),
])
