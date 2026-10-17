import 'server-only'

// TODO(task 3.1): ganti dengan shared service-role client dari `@/lib/server/db`
// (mis. `import { db } from '@/lib/server/db'`) begitu modul itu tersedia. Sementara task 3.1
// berjalan paralel, kita buat client service-role lokal mengikuti pola `lib/supabase/admin.ts`.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function db(): SupabaseClient {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib dikonfigurasi.')
  }
  client ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return client
}

/**
 * Memformat angka sequence ke `VSS-XXXXX`. Zero-pad ke 5 digit saat < 5 digit; saat > 5 digit
 * (nilai > 99999) seluruh digit dipancarkan tanpa dipotong dan tanpa leading zero tambahan.
 */
export function formatCustomsJobNumber(n: number): string {
  return `VSS-${String(n).padStart(5, '0')}`
}

/**
 * Menerbitkan nomor customs job berikutnya dalam format `VSS-XXXXX`.
 *
 * Nilai diambil HANYA dari sequence Postgres `customs_job_number_seq` lewat rpc
 * `nextval_customs_job` — satu round-trip atomik, tanpa baca-ubah-tulis di klien — sehingga
 * aman terhadap concurrency (unik + monoton naik ketat).
 *
 * Bila rpc gagal, nomor TIDAK diterbitkan: error dipropagasikan ke pemanggil dan sequence tidak
 * ikut dimajukan (nextval tidak pernah berjalan saat rpc gagal).
 */
export async function nextCustomsJobNumber(): Promise<string> {
  const { data, error } = await db().rpc('nextval_customs_job')
  if (error) {
    throw new Error(`Gagal menerbitkan nomor customs job: ${error.message}`)
  }
  if (data == null) {
    throw new Error('Gagal menerbitkan nomor customs job: respons sequence kosong.')
  }
  return formatCustomsJobNumber(Number(data))
}
