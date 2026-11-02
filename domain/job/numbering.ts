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

/** Saran urutan berikutnya: satu di atas urutan terbesar yang sudah dipakai. */
export function suggestNextManifestSeq(usedSeqs: ReadonlyArray<number | null>): number {
  const used = usedSeqs.filter((seq): seq is number => typeof seq === 'number' && seq > 0)
  return used.length ? Math.max(...used) + 1 : 1
}
