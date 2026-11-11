// Perhitungan CBM untuk Kalkulator CBM di halaman Tools. Murni hitungan — tidak menyentuh
// penyimpanan.

export const CBM_UNITS = [
  { value: 'mm', label: 'mm', metersPerUnit: 0.001 },
  { value: 'cm', label: 'cm', metersPerUnit: 0.01 },
  { value: 'm', label: 'm', metersPerUnit: 1 },
  { value: 'in', label: 'inci', metersPerUnit: 0.0254 },
] as const

export type CbmUnit = (typeof CBM_UNITS)[number]['value']

export const DEFAULT_CBM_UNIT: CbmUnit = 'cm'

export type CbmInput = {
  length: string
  width: string
  height: string
}

/** Angka dengan koma atau titik desimal; kosong → null, tidak sah → NaN. */
export function parseDecimal(value: string): number | null {
  const text = value.trim().replace(/\s/g, '')
  if (!text) return null
  if (!/^\d+([.,]\d+)?$/.test(text)) return Number.NaN
  return Number(text.replace(',', '.'))
}

/** Volume dalam m³; null bila ada dimensi yang kosong, tidak sah, atau bukan positif. */
export function computeCbm(input: CbmInput, unit: CbmUnit): number | null {
  const metersPerUnit = CBM_UNITS.find((entry) => entry.value === unit)?.metersPerUnit
  if (!metersPerUnit) return null

  const sides = [input.length, input.width, input.height].map(parseDecimal)
  if (!sides.every((side): side is number => side !== null && Number.isFinite(side) && side > 0)) {
    return null
  }
  return sides.reduce((volume, side) => volume * side * metersPerUnit, 1)
}
