// No Job manifest: `<awalan>.<urut>/<no. commercial invoice>`, mis. `S.01/234YFN`, `ATA.03/INV-9`.
// Awalan diturunkan database dari jalur + jenis (kolom `jobs.manifest_prefix`, satu-satunya tabel
// awalan); urutan ditetapkan operator per event per awalan; akhiran = commercial invoice pengirim.

/** Urutan minimal dua digit (01, 02, ...), tidak pernah dipotong (100 tetap 100). */
export function formatManifestSequence(seq: number): string {
  return String(seq).padStart(2, '0')
}

/** No Job tampilan; null bila awalan atau urutan belum ada. */
export function formatJobNumber(
  prefix: string | null,
  seq: number | null,
  commercialInvoiceNumber: string | null,
): string | null {
  if (!prefix || !seq) return null
  const base = `${prefix}.${formatManifestSequence(seq)}`
  const suffix = commercialInvoiceNumber?.trim()
  return suffix ? `${base}/${suffix}` : base
}

/** Hasil membaca No Job yang diketik pengguna; semua bagian bisa kosong (nomor dikosongkan). */
export type ParsedJobNumber = { prefix: string | null; seq: number | null; invoice: string | null }

/**
 * Membaca `<awalan>.<urut>/<no. commercial invoice>` (mis. `S.01/234YFN`). Teks kosong atau
 * `S.-` berarti urutan dikosongkan. null bila bentuknya tidak dikenali. Penomoran sepenuhnya
 * ditentukan pengguna (mengikuti barang datang), jadi tidak ada saran/otomatisasi urutan.
 */
export function parseJobNumber(input: string): ParsedJobNumber | null {
  const text = input.trim()
  if (!text) return { prefix: null, seq: null, invoice: null }
  const match = /^([A-Za-z]+)\.(-|\d{1,4})(?:\s*\/\s*(.*\S))?$/.exec(text)
  if (!match) return null
  const [, prefix, rawSeq, invoice] = match
  const seq = rawSeq === '-' ? null : Number(rawSeq)
  if (seq === 0) return null
  return { prefix: prefix.toUpperCase(), seq, invoice: invoice?.trim() || null }
}

/**
 * Label job di UI: No Job bila sudah ada; bila urutan belum diisi, awalan dari jenis job + jalur
 * (mis. `S.-`); bila awalan pun belum ada (TPPB tanpa jalur), "Belum bernomor".
 */
export function jobLabel(job: { jobNumber: string | null; manifestPrefix: string | null }): string {
  return job.jobNumber ?? (job.manifestPrefix ? `${job.manifestPrefix}.-` : 'Belum bernomor')
}

/**
 * Nama file ekspor job: label job tanpa karakter terlarang di nama file (`S.01/234YFN` → `S.01-234YFN`).
 * Job tanpa urutan ditambah nama pihak agar tidak semua file bernama `S.-`.
 */
export function jobFileName(
  job: { jobNumber: string | null; manifestPrefix: string | null; party: { name: string } | null },
  prefix: string,
  extension: string,
): string {
  const stem = [jobLabel(job), job.jobNumber ? null : job.party?.name].filter(Boolean).join(' ')
  const safe = stem.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
  return `${prefix}-${safe}.${extension}`
}
