import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/admin'
import { decryptCeisaValue, encryptCeisaValue } from './crypto'

const credentialsSchema = z.object({ username: z.string().min(1), password: z.string().min(1), apiKey: z.string().min(1), companyId: z.string().min(1).optional(), idPlatform: z.string().min(1).optional() })
export type CeisaCredentials = z.infer<typeof credentialsSchema>
export type VerificationState = 'UNCONFIGURED' | 'UNVERIFIED' | 'VERIFIED' | 'FAILED'

type ConnectionRow = { credentials_ciphertext: string; credentials_iv: string; credentials_tag: string; verification_state: VerificationState; last_verified_at: string | null }

export async function ceisaWorkspaceId() {
  if (!isSupabaseConfigured()) throw new Error('CEISA integration is unavailable.')
  const { data, error } = await getSupabaseAdmin().from('workspaces').select('id').eq('slug', 'default').single<{ id: string }>()
  if (error || !data) throw new Error('CEISA integration is unavailable.')
  return data.id
}

export async function ceisaSettings() {
  if (!isSupabaseConfigured()) return { configured: false, verificationState: 'UNCONFIGURED' as const, hasCompanyId: false, hasIdPlatform: false, lastVerifiedAt: null }
  const workspaceId = await ceisaWorkspaceId()
  const { data, error } = await getSupabaseAdmin().from('ceisa_connections').select('credentials_ciphertext, credentials_iv, credentials_tag, verification_state, last_verified_at').eq('workspace_id', workspaceId).maybeSingle<ConnectionRow>()
  if (error) throw new Error('CEISA settings are unavailable.')
  if (!data) return { configured: false, verificationState: 'UNCONFIGURED' as const, hasCompanyId: false, hasIdPlatform: false, lastVerifiedAt: null }
  const credentials = credentialsSchema.safeParse(decryptCeisaValue({ ciphertext: data.credentials_ciphertext, iv: data.credentials_iv, tag: data.credentials_tag }))
  if (!credentials.success) throw new Error('CEISA credential encryption is unavailable.')
  return { configured: true, verificationState: data.verification_state, hasCompanyId: Boolean(credentials.data.companyId), hasIdPlatform: Boolean(credentials.data.idPlatform), lastVerifiedAt: data.last_verified_at }
}

export async function replaceCeisaCredentials(input: CeisaCredentials) {
  const credentials = credentialsSchema.parse(input)
  const workspaceId = await ceisaWorkspaceId()
  const encrypted = encryptCeisaValue(credentials)
  const { error } = await getSupabaseAdmin().from('ceisa_connections').upsert({ workspace_id: workspaceId, credentials_ciphertext: encrypted.ciphertext, credentials_iv: encrypted.iv, credentials_tag: encrypted.tag, key_version: 1, verification_state: 'UNVERIFIED', last_verified_at: null, updated_at: new Date().toISOString() })
  if (error) throw new Error('CEISA settings cannot be saved.')
}

export async function ceisaCredentials() {
  const workspaceId = await ceisaWorkspaceId()
  const { data, error } = await getSupabaseAdmin().from('ceisa_connections').select('credentials_ciphertext, credentials_iv, credentials_tag').eq('workspace_id', workspaceId).maybeSingle<Pick<ConnectionRow, 'credentials_ciphertext' | 'credentials_iv' | 'credentials_tag'>>()
  if (error || !data) throw new Error('CEISA credentials are unavailable.')
  const parsed = credentialsSchema.safeParse(decryptCeisaValue({ ciphertext: data.credentials_ciphertext, iv: data.credentials_iv, tag: data.credentials_tag }))
  if (!parsed.success) throw new Error('CEISA credentials are unavailable.')
  return { workspaceId, credentials: parsed.data }
}

export async function markCeisaVerification(state: Exclude<VerificationState, 'UNCONFIGURED'>) {
  const workspaceId = await ceisaWorkspaceId()
  const { error } = await getSupabaseAdmin().from('ceisa_connections').update({ verification_state: state, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('workspace_id', workspaceId)
  if (error) throw new Error('CEISA settings are unavailable.')
}

export async function recordCeisaObservation(input: { operation: string; correlationKey: string; documentType?: string; submissionNumber?: string; responseCode?: string; responseName?: string; payload: unknown }) {
  const workspaceId = await ceisaWorkspaceId()
  const serialized = JSON.stringify(input.payload)
  const payload = encryptCeisaValue(input.payload)
  const payloadSha256 = createHash('sha256').update(serialized).digest('hex')
  const { data, error } = await getSupabaseAdmin().from('ceisa_observations').upsert({ workspace_id: workspaceId, id: randomUUID(), operation: input.operation, correlation_key: input.correlationKey, document_type: input.documentType ?? null, submission_number: input.submissionNumber ?? null, response_code: input.responseCode ?? null, response_name: input.responseName ?? null, payload_ciphertext: payload.ciphertext, payload_iv: payload.iv, payload_tag: payload.tag, payload_sha256: payloadSha256 }, { onConflict: 'workspace_id,operation,correlation_key,payload_sha256', ignoreDuplicates: true }).select('id').maybeSingle<{ id: string }>()
  if (error) throw new Error('CEISA observation cannot be stored.')
  return data?.id ?? null
}
