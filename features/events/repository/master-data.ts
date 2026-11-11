import 'server-only'

// Master data venue/EO (create-inline + select existing). Mengapa di sini: repository tetap
// SATU-SATUNYA pemilik query Postgres untuk slice event, termasuk master data yang dirujuk event
// (Req 12.2/12.3). Event menyimpan FK id ke baris ini, bukan nilai yang digandakan. Daftar kolom
// eksplisit + pemetaan snake→camel + filter `workspace_id` mengikuti gaya fungsi event.

import { withWorkspace } from '@/lib/server/db'
import type {
  EventOrganizerInput,
  EventOrganizerRecord,
  VenueInput,
  VenueRecord,
  VenueTppbProfile,
} from '@/domain/event/types'

const VENUE_COLUMNS = 'id, legal_name, alias_name, city'
const EVENT_ORGANIZER_COLUMNS = 'id, legal_name'

// Bentuk baris mentah (snake_case) untuk master data.
type VenueDbRow = { id: string; legal_name: string; alias_name: string | null; city: string | null }
type EventOrganizerDbRow = { id: string; legal_name: string }

function toVenueRecord(row: VenueDbRow): VenueRecord {
  return { id: row.id, legalName: row.legal_name, aliasName: row.alias_name, city: row.city }
}

function toEventOrganizerRecord(row: EventOrganizerDbRow): EventOrganizerRecord {
  return { id: row.id, legalName: row.legal_name }
}

/**
 * Sisipkan venue baru (create-inline) dan kembalikan baris tersimpan dengan id dari DB — id inilah
 * yang kemudian dirujuk event lewat FK (Req 12.2/12.3). Nilai sudah ter-trim/null oleh skema Zod di
 * batas API. Kegagalan tulis = kegagalan Supabase nyata → lempar agar dipetakan ke 503.
 */
export async function insertVenue(input: VenueInput): Promise<VenueRecord> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('venues')
    .insert({
      workspace_id: workspaceId,
      legal_name: input.legalName,
      alias_name: input.aliasName,
      city: input.city,
    })
    .select(VENUE_COLUMNS)
    .single<VenueDbRow>()

  if (error || !data) {
    throw new Error(`Gagal menyimpan venue: ${error?.message ?? 'tidak ada data'}`)
  }
  return toVenueRecord(data)
}

/**
 * Sisipkan event organizer baru (create-inline) dan kembalikan baris tersimpan dengan id dari DB.
 * Event merujuk id ini lewat FK, bukan menggandakan nama (Req 12.2/12.3).
 */
export async function insertEventOrganizer(
  input: EventOrganizerInput,
): Promise<EventOrganizerRecord> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('event_organizers')
    .insert({ workspace_id: workspaceId, legal_name: input.legalName })
    .select(EVENT_ORGANIZER_COLUMNS)
    .single<EventOrganizerDbRow>()

  if (error || !data) {
    throw new Error(`Gagal menyimpan event organizer: ${error?.message ?? 'tidak ada data'}`)
  }
  return toEventOrganizerRecord(data)
}

/**
 * Daftar venue dalam workspace untuk memilih yang SUDAH ADA (Req 12.1), diurut berdasarkan nama
 * agar pemilihan di UI stabil. Hanya baris workspace aktif (filter `workspace_id`).
 */
export async function listVenues(): Promise<VenueRecord[]> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('venues')
    .select(VENUE_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('legal_name', { ascending: true })
    .returns<VenueDbRow[]>()

  if (error) {
    throw new Error(`Gagal memuat daftar venue: ${error.message}`)
  }
  return (data ?? []).map(toVenueRecord)
}

const VENUE_TPPB_COLUMNS =
  'legal_name, city, tppb_operator_name, tppb_operator_npwp, tppb_operator_address, customs_regional_office, signatory_1_name, signatory_1_title, signatory_2_name, signatory_2_title'

type VenueTppbDbRow = {
  legal_name: string
  city: string | null
  tppb_operator_name: string | null
  tppb_operator_npwp: string | null
  tppb_operator_address: string | null
  customs_regional_office: string | null
  signatory_1_name: string | null
  signatory_1_title: string | null
  signatory_2_name: string | null
  signatory_2_title: string | null
}

/**
 * Data pengusaha TPPB satu venue (pemohon surat Kanwil & form rincian barang). Null bila venue
 * tidak ada di workspace. Penandatangan hanya yang namanya terisi, urut 1 lalu 2.
 */
export async function findVenueTppbProfile(venueId: string): Promise<VenueTppbProfile | null> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('venues')
    .select(VENUE_TPPB_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('id', venueId)
    .maybeSingle<VenueTppbDbRow>()

  if (error) {
    throw new Error(`Gagal memuat venue: ${error.message}`)
  }
  if (!data) return null

  const signatories = [
    { name: data.signatory_1_name, title: data.signatory_1_title },
    { name: data.signatory_2_name, title: data.signatory_2_title },
  ].flatMap(({ name, title }) =>
    name?.trim() ? [{ name: name.trim(), title: title?.trim() || null }] : [],
  )

  return {
    venueName: data.legal_name,
    city: data.city,
    operatorName: data.tppb_operator_name,
    operatorNpwp: data.tppb_operator_npwp,
    operatorAddress: data.tppb_operator_address,
    customsRegionalOffice: data.customs_regional_office,
    signatories,
  }
}

/**
 * Daftar event organizer dalam workspace untuk memilih yang SUDAH ADA (Req 12.1), diurut nama.
 */
export async function listEventOrganizers(): Promise<EventOrganizerRecord[]> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('event_organizers')
    .select(EVENT_ORGANIZER_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('legal_name', { ascending: true })
    .returns<EventOrganizerDbRow[]>()

  if (error) {
    throw new Error(`Gagal memuat daftar event organizer: ${error.message}`)
  }
  return (data ?? []).map(toEventOrganizerRecord)
}
