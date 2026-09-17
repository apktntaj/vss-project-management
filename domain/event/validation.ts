import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Gunakan tanggal YYYY-MM-DD.')
const optionalText = z.string().trim().min(1).nullable()

export const contactSchema = z.object({
  name: optionalText,
  role: optionalText,
  email: z.string().trim().email('Format email tidak valid.').nullable(),
  phone: optionalText,
  isPrimary: z.boolean(),
})

export const eventOrganizerInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama EO wajib diisi.'),
  npwp: optionalText,
  contacts: z.array(contactSchema),
  address: optionalText,
  website: z.string().trim().url('Website harus berupa URL.').nullable(),
})

export const venueInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama venue wajib diisi.'),
  contacts: z.array(contactSchema),
  address: optionalText,
  website: z.string().trim().url('Website harus berupa URL.').nullable(),
  loadingAccessNotes: optionalText,
})

export const eventInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama event wajib diisi.'),
  venueId: z.string().uuid(),
  eventOrganizerId: z.string().uuid(),
  startsOn: dateOnly,
  endsOn: dateOnly,
}).superRefine((value, context) => {
  if (value.endsOn < value.startsOn) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsOn'],
      message: 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.',
    })
  }
})

const exhibitorBaseSchema = z.object({
  name: z.string().trim().min(1, 'Nama exhibitor wajib diisi.'),
  contact: contactSchema.omit({ isPrimary: true }),
  agentId: z.string().uuid().nullable(),
})

export const exhibitorInputSchema = z.discriminatedUnion('kind', [
  exhibitorBaseSchema.extend({ kind: z.literal('LOCAL'), npwp: optionalText }).strict(),
  exhibitorBaseSchema.extend({ kind: z.literal('INTERNATIONAL') }).strict(),
])
