/**
 * Mengapa: jumlah koli per exhibitor pada CIPL TIDAK boleh dipercayakan ke pembacaan AI.
 * Kolom "NO." sebuah CIPL memakai tiga bentuk yang berbeda arti, dan dua di antaranya
 * membuat "satu baris = satu koli" salah:
 *
 *   "22"                 → satu koli
 *   "7-11"               → LIMA koli dalam satu baris (rentang nomor paket)
 *   "in package No. 22"  → NOL koli — barang (katalog, brosur) yang dititipkan di koli
 *                          milik baris lain, jadi menghitungnya akan menggandakan total
 *   "8 PKG"              → delapan koli (kolom jumlah pada inward manifest, bukan nomor)
 *
 * Bukti dari dokumen nyata: pada CIPL S.12/ALP-VPN/2026 WUXI BERBICA memegang paket 22 dan 23
 * plus satu baris "in package No. 22"; laporan akhir klien menulis 2 PKG — bukan 3. WUHAN PHEZER
 * memegang 1..21 lewat baris tunggal dan rentang (7-11, 12-13, 18-21) dan tertulis 21 PKG.
 *
 * Semua fungsi di sini murni dan bebas teknologi: parser/UI/laporan memakai yang sama.
 */

export const packageRefKinds = ['SINGLE', 'RANGE', 'QUANTITY', 'CONTAINED', 'UNKNOWN'] as const
export type PackageRefKind = (typeof packageRefKinds)[number]

export type PackageRef = {
  /** Berapa koli fisik yang diwakili teks ini. */
  count: number
  kind: PackageRefKind
  /** Nomor paket yang tercakup, menaik; kosong untuk QUANTITY/CONTAINED/UNKNOWN. */
  numbers: number[]
}

/** Teks penanda barang yang dititipkan di koli baris lain ("in package No. 22", "in pkg 30"). */
const CONTAINED = /\bin\s*(package|pkg|pk|case)\b/i
/** "8 PKG", "2 PACKAGES", "4 CASE" — jumlah, bukan nomor paket. */
const QUANTITY = /^(\d+)\s*(pkgs?|packages?|pcs?|pieces?|cases?|colly|koli)\.?$/i
/** "7-11", "PKG 3 - 8", "PK 18 – 21" (termasuk en dash). */
const RANGE = /(\d+)\s*[-–—]\s*(\d+)/
/** Angka apa pun yang tersisa setelah label dibuang: "PKG 1", "PK 2", "NO. 22", "22". */
const DIGITS = /\d+/g

function expand(from: number, to: number): number[] {
  const low = Math.min(from, to)
  const high = Math.max(from, to)
  // Rentang tak masuk akal (mis. salah baca OCR "7-1100") tidak diperluas membabi buta.
  if (high - low > 999) return [low]
  return Array.from({ length: high - low + 1 }, (_, index) => low + index)
}

/**
 * Baca satu teks nomor/label paket menjadi jumlah koli yang diwakilinya.
 *
 * Label kosong atau tak terbaca → UNKNOWN dengan count 1: barisnya tetap satu baris koli
 * fisik pada dokumen, jadi mengabaikannya akan mengecilkan total. Hanya "in package No. N"
 * yang sengaja bernilai 0.
 */
export function parsePackageRef(ref: string | null | undefined): PackageRef {
  const raw = typeof ref === 'string' ? ref.trim() : ''
  if (!raw) return { count: 1, kind: 'UNKNOWN', numbers: [] }
  if (CONTAINED.test(raw)) return { count: 0, kind: 'CONTAINED', numbers: [] }

  const quantity = QUANTITY.exec(raw)
  if (quantity) {
    const count = Number(quantity[1])
    return { count: Number.isFinite(count) ? count : 1, kind: 'QUANTITY', numbers: [] }
  }

  const range = RANGE.exec(raw)
  if (range) {
    const numbers = expand(Number(range[1]), Number(range[2]))
    return { count: numbers.length, kind: 'RANGE', numbers }
  }

  const digits = raw.match(DIGITS)
  if (!digits) return { count: 1, kind: 'UNKNOWN', numbers: [] }
  // "12,13" / "26 27" pada satu sel: tiap angka adalah satu nomor paket tersendiri.
  const numbers = [...new Set(digits.map(Number))].filter(Number.isFinite).sort((a, b) => a - b)
  return { count: numbers.length, kind: 'SINGLE', numbers }
}

/**
 * Total koli dari sekumpulan label baris. Nomor paket yang muncul dua kali hanya dihitung
 * sekali (CIPL konsolidasi kadang mengulang nomor di halaman lanjutan), sedangkan baris
 * QUANTITY/UNKNOWN dijumlahkan apa adanya karena tidak membawa nomor yang bisa dibandingkan.
 */
export function countPackageRefs(refs: ReadonlyArray<string | null | undefined>): number {
  const numbered = new Set<number>()
  let unnumbered = 0
  for (const ref of refs) {
    const parsed = parsePackageRef(ref)
    if (parsed.numbers.length) {
      for (const number of parsed.numbers) numbered.add(number)
      continue
    }
    unnumbered += parsed.count
  }
  return numbered.size + unnumbered
}
