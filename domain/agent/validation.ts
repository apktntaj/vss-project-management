import { z } from 'zod'

import { contactSchema } from '@/domain/event/validation'

const optionalText = z.string().trim().min(1).nullable()

export const agentInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama agent wajib diisi.'),
  contact: contactSchema.omit({ isPrimary: true }),
  address: optionalText,
  countryCode: optionalText,
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

export type AgentInput = z.infer<typeof agentInputSchema>

/** Record agent utuh seperti yang disimpan `saveAgent` (data-client) lewat `/api/operational-records`. */
export const agentRecordSchema = agentInputSchema.extend({
  id: z.string().trim().min(1, 'ID agent wajib diisi.'),
  createdAt: z.string().datetime({ offset: true, message: 'createdAt harus berupa timestamp ISO.' }),
  updatedAt: z.string().datetime({ offset: true, message: 'updatedAt harus berupa timestamp ISO.' }),
})

export type AgentRecord = z.infer<typeof agentRecordSchema>
