/**
 * Mengapa: satu perusahaan exhibitor ditulis berbeda di tiap dokumen, sehingga mencocokkan
 * nama dengan `trim().toLowerCase()` memecah satu peserta menjadi dua dan menggandakan total
 * koli pada blok manifest. Bukti dari dokumen nyata (CIPL S.12 vs laporan inward ALLPACK):
 *
 *   "WUHAN PHEZER TECHNOLOGY., LTD."   vs  "WUHAN PHEZER TECHNOLOGY CO., LTD"
 *   "SHANTOU PENGHUI MACHINERY CO., LTD" vs "SHANTOU PENGHUI MACHINERY CO.,LTD"
 *   "WONCLEAN TECHNOLOGY COMPANY LIMITED" vs "WONCLEAN TECHNOLOGY CO., LTD"
 *
 * Normalisasi di sini membuang HANYA tanda baca dan token bentuk badan hukum (CO, LTD,
 * LIMITED, PT, GMBH, ...) — kata yang membawa identitas (TECHNOLOGY, MACHINERY, EQUIPMENT)
 * dipertahankan supaya dua perusahaan berbeda tidak ikut melebur.
 *
 * Fungsi murni, tanpa I/O: dipakai parser di server, wizard di klien, dan assembler laporan.
 */

/**
 * Token bentuk badan hukum / imbuhan korporat yang dibuang dari UJUNG nama (berulang, karena
 * nama nyata berakhiran berantai seperti "... CO., LTD." atau "... COMPANY LIMITED").
 * Sengaja TIDAK memuat kata industri (TECHNOLOGY, MACHINERY, LOGISTICS, ...).
 */
const LEGAL_SUFFIXES = new Set([
  'CO', 'COMPANY', 'CORP', 'CORPORATION', 'INC', 'INCORPORATED', 'LTD', 'LTDA', 'LIMITED',
  'LLC', 'LLP', 'PLC', 'GMBH', 'MBH', 'AG', 'BV', 'NV', 'SA', 'SAS', 'SRL', 'SPA', 'OY', 'AB',
  'AS', 'APS', 'KG', 'KFT', 'ZOO', 'OOO', 'JSC', 'PJSC', 'PTE', 'PTY', 'SDN', 'BHD', 'TBK',
  'GROUP', 'HOLDINGS', 'HOLDING', 'INTL', 'INTERNATIONALE',
])

/** Bentuk badan hukum yang berada di DEPAN nama (Indonesia: "PT. ...", "CV. ..."). */
const LEGAL_PREFIXES = new Set(['PT', 'CV', 'UD', 'PD', 'TB', 'THE'])

/**
 * Bentuk pembanding sebuah nama exhibitor: huruf besar, tanpa tanda baca, tanpa token
 * bentuk badan hukum di awal/akhir. Mengembalikan string kosong bila nama tidak punya
 * bagian yang membawa identitas sama sekali.
 */
export function normalizeExhibitorName(name: string): string {
  const cleaned = name
    .toUpperCase()
    .replace(/&/g, ' AND ')
    // Tanda baca apa pun (titik, koma, tanda kutip, tanda hubung, kurung) menjadi pemisah.
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
  if (!cleaned) return ''

  const tokens = cleaned.split(' ')
  while (tokens.length > 1 && LEGAL_PREFIXES.has(tokens[0])) tokens.shift()
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()
  // Nama yang hanya terdiri dari token badan hukum ("CO., LTD.") tetap dikembalikan apa adanya
  // supaya tidak menjadi kunci kosong yang menyamakannya dengan nama kosong lain.
  return tokens.join(' ')
}

/** Dua nama menunjuk perusahaan yang sama setelah dinormalisasi. */
export function isSameExhibitorName(left: string, right: string): boolean {
  const a = normalizeExhibitorName(left)
  const b = normalizeExhibitorName(right)
  return a !== '' && a === b
}

export type ExhibitorNameMatch<T> =
  /** Nama identik setelah normalisasi — satu kandidat. */
  | { kind: 'MATCHED'; exhibitor: T }
  /** Lebih dari satu exhibitor event bernormalisasi sama; pemanggil harus memilih. */
  | { kind: 'AMBIGUOUS'; candidates: T[] }
  /** Tidak ada yang cocok. */
  | { kind: 'NONE' }

/**
 * Cocokkan satu nama hasil scan ke daftar exhibitor event. Pencocokan HANYA pada kesamaan
 * nama ternormalisasi — tanpa skor kemiripan kabur, karena menautkan barang ke exhibitor
 * yang salah lebih mahal daripada membuat satu baris baru yang bisa dikoreksi operator.
 */
export function matchExhibitorByName<T extends { id: string; name: string }>(
  name: string,
  pool: ReadonlyArray<T>,
): ExhibitorNameMatch<T> {
  const key = normalizeExhibitorName(name)
  if (!key) return { kind: 'NONE' }
  const candidates = pool.filter((exhibitor) => normalizeExhibitorName(exhibitor.name) === key)
  if (candidates.length === 0) return { kind: 'NONE' }
  if (candidates.length === 1) return { kind: 'MATCHED', exhibitor: candidates[0] }
  return { kind: 'AMBIGUOUS', candidates }
}
