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
