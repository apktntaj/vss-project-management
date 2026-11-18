// Legenda kolom REMARKS sebuah CIPL: huruf/tanda per baris barang hanya bermakna lewat legenda yang
// dicetak di dokumen itu sendiri. Huruf TIDAK tetap antar template — template VSS: "A: RE-EXPORT
// AFTER EXHIBITION, B: DISPOSED OR CONSUMED"; CIPL Shanghai Hi-EXPO: "A. 不回运 Not Return,
// B. 回运 Return" (A = disposal, B = re-ekspor). Memetakan huruf langsung ke disposisi menukar
// barang re-ekspor dengan barang disposal, jadi pemetaan selalu lewat arti legenda. Murni tanpa I/O.

import type { DisposisiBarang } from '@/domain/exhibition/cipl-document'

export type RemarkLegendEntry = { mark: string; meaning: string }

/** Legenda terpetakan: tanda baris (dinormalkan) → disposisi arti tanda itu. */
export type RemarkLegend = ReadonlyMap<string, DisposisiBarang>

// Urutan penting: pola yang lebih spesifik dilucuti dari teks sebelum pola berikutnya diuji, supaya
// "Not Return" / "不回运" tidak ikut terhitung sebagai "Return" / "回运".
const meaningRules: ReadonlyArray<{ disposisi: Exclude<DisposisiBarang, 'TIDAK_DISEBUT'>; pattern: string }> = [
  {
    disposisi: 'GIVE_AWAY',
    pattern: 'give[\\s-]*away|\\bsold\\b|\\bsale\\b|\\bgifts?\\b|donat|sumbang|dijual|diberikan|赠送|出售|销售',
  },
  {
    disposisi: 'DISPOSED',
    pattern:
      'not\\s+(?:be\\s+)?return|non[\\s-]*return|no\\s+return|dispos|consum|abandon|discard|destroy|scrap|不回运|不返回|不复运|不运回|处置|销毁|消耗|dibuang|terpakai|tidak\\s+(?:kembali|diekspor|re-?ekspor)',
  },
  {
    disposisi: 'RE_EXPORT',
    pattern: 're[\\s-]*export|return|回运|复运|运回|kembali|re-?ekspor',
  },
]

/** Disposisi dari teks arti legenda; TIDAK_DISEBUT bila tak dikenali atau artinya bertabrakan. */
export function disposisiOfMeaning(meaning: string): DisposisiBarang {
  let rest = meaning
  const matched = new Set<DisposisiBarang>()
  for (const rule of meaningRules) {
    if (new RegExp(rule.pattern, 'i').test(rest)) {
      matched.add(rule.disposisi)
      rest = rest.replace(new RegExp(rule.pattern, 'gi'), ' ')
    }
  }
  const [only] = matched
  return matched.size === 1 && only ? only : 'TIDAK_DISEBUT'
}

/** Kunci tanda: tanpa spasi tepi, huruf besar, tanpa tanda baca penutup ("A." / "A:" / "A)" = "A"). */
export const normalizeRemarkMark = (mark: string): string =>
  mark.trim().toUpperCase().replace(/[.:)\]]+$/, '')

/** Legenda dari pasangan tanda → arti hasil baca dokumen; tanda ganda dengan arti berbeda gugur. */
export function remarkLegendFromEntries(entries: ReadonlyArray<RemarkLegendEntry>): RemarkLegend {
  const legend = new Map<string, DisposisiBarang>()
  const conflicting = new Set<string>()
  for (const entry of entries) {
    const key = normalizeRemarkMark(entry.mark)
    if (!key) continue
    const disposisi = disposisiOfMeaning(entry.meaning)
    const known = legend.get(key)
    if (known !== undefined && known !== disposisi) conflicting.add(key)
    legend.set(key, disposisi)
  }
  for (const key of conflicting) legend.set(key, 'TIDAK_DISEBUT')
  return legend
}

/**
 * Disposisi satu baris dari tandanya. Tanda kosong atau tak ada di legenda = TIDAK_DISEBUT: tidak
 * pernah menebak arti huruf. `known` false bila tanda ada tetapi legenda tak menjelaskannya.
 */
export function disposisiFromMark(
  mark: string | null,
  legend: RemarkLegend,
): { disposisi: DisposisiBarang; known: boolean } {
  const key = mark ? normalizeRemarkMark(mark) : ''
  if (!key) return { disposisi: 'TIDAK_DISEBUT', known: true }
  const disposisi = legend.get(key)
  return disposisi === undefined
    ? { disposisi: 'TIDAK_DISEBUT', known: false }
    : { disposisi, known: disposisi !== 'TIDAK_DISEBUT' }
}
