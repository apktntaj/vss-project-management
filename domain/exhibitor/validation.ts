import { z } from 'zod'

import { exhibitorKinds } from '@/domain/exhibitor/types'

/** Teks opsional: di-trim, kosong → null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter.`)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null))

export const exhibitorContactSchema = z.object({
  name: optionalText(200),
  role: optionalText(200),
  email: z
    .string()
    .trim()
    .email('Format email tidak valid.')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null))
    .transform((value) => value ?? null),
  phone: optionalText(50),
})

const emptyContact = { name: null, role: null, email: null, phone: null }

/** Untuk patch: tidak dikirim tetap `undefined` (tidak ditulis); kosong → null (dikosongkan). */
const patchText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter.`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null))

const exhibitorFields = {
  name: z.string().trim().min(1, 'Nama exhibitor wajib diisi.').max(300, 'Nama exhibitor terlalu panjang.'),
  kind: z.enum(exhibitorKinds),
  npwp: optionalText(30),
  contact: exhibitorContactSchema.optional().transform((value) => value ?? emptyContact),
  hall: optionalText(100),
  booth: optionalText(100),
}

function npwpOnlyForLocal(
  input: { kind?: string; npwp?: string | null },
  context: z.RefinementCtx,
) {
  if (input.kind === 'INTERNATIONAL' && input.npwp) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['npwp'],
      message: 'NPWP hanya untuk exhibitor lokal.',
    })
  }
}

/** Daftarkan exhibitor baru pada sebuah event (bisa beberapa sekaligus, mis. dari scan CIPL). */
export const exhibitorCreateSchema = z.object(exhibitorFields).strict().superRefine(npwpOnlyForLocal)
export type ExhibitorCreateInput = z.output<typeof exhibitorCreateSchema>

export const exhibitorCreateBatchSchema = z
  .array(exhibitorCreateSchema)
  .min(1, 'Minimal satu exhibitor.')
  .max(200, 'Terlalu banyak exhibitor sekaligus.')

/** Ubah sebagian data exhibitor; hanya field yang dikirim yang ditulis. */
export const exhibitorUpdateSchema = z
  .object({
    name: exhibitorFields.name.optional(),
    kind: exhibitorFields.kind.optional(),
    npwp: patchText(30),
    contact: exhibitorContactSchema.optional(),
    hall: patchText(100),
    booth: patchText(100),
  })
  .strict()
export type ExhibitorUpdateInput = z.output<typeof exhibitorUpdateSchema>
