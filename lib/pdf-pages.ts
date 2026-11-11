// Parser rentang halaman untuk tool PDF (tab Tools → PDF). Murni, tanpa pdf-lib, supaya bisa diuji.
//
// Format masukan mengikuti kebiasaan dialog cetak: "1-3, 5, 8-" → tiga kelompok halaman.
// - "a-b"  halaman a sampai b
// - "a"    satu halaman
// - "a-"   halaman a sampai halaman terakhir
// - "-b"   halaman 1 sampai b
// Nomor halaman 1-based; hasil `groups` juga 1-based, satu array per segmen yang dipisah koma.

export type PageGroup = { label: string; pages: number[] }

export type PageRangeResult = { ok: true; groups: PageGroup[] } | { ok: false; error: string }

const SEGMENT = /^(\d*)\s*-\s*(\d*)$|^(\d+)$/

export function parsePageRanges(input: string, pageCount: number): PageRangeResult {
  const segments = input
    .split(/[,;]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (segments.length === 0) return { ok: false, error: 'Isi halaman yang ingin diambil, mis. 1-3, 5.' }

  const groups: PageGroup[] = []
  for (const segment of segments) {
    const match = SEGMENT.exec(segment)
    if (!match) return { ok: false, error: `"${segment}" bukan format halaman yang dikenali.` }

    let start: number
    let end: number
    if (match[3] !== undefined) {
      start = end = Number(match[3])
    } else {
      if (match[1] === '' && match[2] === '') {
        return { ok: false, error: `"${segment}" tidak menyebut nomor halaman.` }
      }
      start = match[1] === '' ? 1 : Number(match[1])
      end = match[2] === '' ? pageCount : Number(match[2])
    }

    if (start < 1 || end < 1) return { ok: false, error: 'Nomor halaman dimulai dari 1.' }
    if (start > pageCount || end > pageCount) {
      return { ok: false, error: `"${segment}" melebihi jumlah halaman (${pageCount}).` }
    }
    if (start > end) return { ok: false, error: `"${segment}": halaman awal lebih besar dari akhir.` }

    const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index)
    groups.push({ label: start === end ? String(start) : `${start}-${end}`, pages })
  }
  return { ok: true, groups }
}

// Satu kelompok per halaman: dipakai mode "pisah tiap halaman".
export function everyPage(pageCount: number): PageGroup[] {
  return Array.from({ length: pageCount }, (_, index) => ({ label: String(index + 1), pages: [index + 1] }))
}

// Nama berkas hasil potong: "invoice.pdf" + "1-3" → "invoice_hal-1-3.pdf".
export function splitFileName(sourceName: string, label: string): string {
  const base = sourceName.replace(/\.pdf$/i, '') || 'dokumen'
  return `${base}_hal-${label}.pdf`
}
