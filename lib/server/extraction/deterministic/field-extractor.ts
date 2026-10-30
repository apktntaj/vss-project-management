import 'server-only'

import type {
  JobDocumentParty,
  JobInvoiceExtraction,
  JobInvoiceItem,
  JobTransportContainer,
  JobTransportExtraction,
} from '@/domain/exhibition/source-documents'
import type { ParsedDocument } from './parsed-document'

const CURRENCIES = ['USD', 'EUR', 'JPY', 'SGD', 'IDR', 'AUD', 'GBP', 'CNY', 'MYR', 'THB', 'HKD', 'KRW', 'INR', 'AED', 'CHF', 'NZD', 'PHP', 'VND']
const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}
const PACKAGE_TYPES = /\b(CTNS?|CARTONS?|PKGS?|PACKAGES?|BOXES|PALLETS?|PLS|DRUMS?|ROLLS?|SETS?|PCS|PIECES)\b/i

const textLines = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

const firstLabelValue = (rows: string[], patterns: RegExp[]): string | null => {
  for (const row of rows) {
    for (const pattern of patterns) {
      const match = row.match(pattern)
      if (match) {
        const value = row.slice(match[0].length).replace(/^[\s:;\-#=.]+\s*/, '').trim()
        if (value) return value.slice(0, 160)
      }
    }
  }
  return null
}

const firstRegexGroup = (text: string, pattern: RegExp): string | null => {
  const match = text.match(pattern)
  return match?.[1]?.trim() ? match[1].trim().slice(0, 160) : null
}

export function parseNumber(raw: string | null): number | null {
  if (!raw) return null
  const match = raw.match(/-?\d[\d.,\s]*/)
  if (!match) return null
  let candidate = match[0].replace(/\s/g, '')
  const lastComma = candidate.lastIndexOf(',')
  const lastDot = candidate.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    candidate = lastComma > lastDot ? candidate.replace(/\./g, '').replace(',', '.') : candidate.replace(/,/g, '')
  } else if (lastComma >= 0) {
    candidate = /,\d{1,2}$/.test(candidate) && !/,\d{3}/.test(candidate) ? candidate.replace(',', '.') : candidate.replace(/,/g, '')
  } else if (lastDot >= 0 && !/\.\d{1,2}$/.test(candidate) && /\.\d{3}/.test(candidate)) {
    candidate = candidate.replace(/\./g, '')
  }
  const value = Number(candidate)
  return Number.isFinite(value) ? value : null
}

export function parseDate(raw: string | null): string | null {
  if (!raw) return null
  const iso = raw.match(/(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const dayMonthYear = raw.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/)
  if (dayMonthYear) {
    const day = Number(dayMonthYear[1])
    const month = Number(dayMonthYear[2])
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${dayMonthYear[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  const dayMonthNameYear = raw.match(/(\d{1,2})\s*[/.\-\s]\s*([A-Za-z]{3,})\s*[/.\-\s]\s*(\d{4})/)
  if (dayMonthNameYear) {
    const month = MONTHS[dayMonthNameYear[2].slice(0, 3).toLowerCase()]
    if (month) return `${dayMonthNameYear[3]}-${month}-${String(Number(dayMonthNameYear[1])).padStart(2, '0')}`
  }
  return null
}

const party = (name: string | null): JobDocumentParty | null =>
  name ? { name: name.split(/\n/)[0].slice(0, 120).trim() || null, address: null, countryCode: null, taxId: null } : null

function detectCurrency(text: string): string | null {
  const upper = text.toUpperCase()
  for (const code of CURRENCIES) {
    if (new RegExp(`\\b${code}\\b`).test(upper)) return code
  }
  if (/\bRP\b|RUPIAH/.test(upper)) return 'IDR'
  return null
}

function detectIncoterm(text: string): { incoterm: string; location: string | null } | null {
  for (const term of INCOTERMS) {
    const match = text.match(new RegExp(`\\b${term}\\b[\\s.:\\-]*([^\\n]{0,48})`, 'i'))
    if (!match) continue
    const location = match[1].replace(/^[^\p{L}\d]+/u, '').trim()
    return { incoterm: term, location: /\p{L}{3}/u.test(location) ? location.slice(0, 48) : null }
  }
  return null
}

function detectPackages(text: string): { count: number; type: string | null } | null {
  const rows = textLines(text)
  const labeled = rows.find((row) => /total\s*(packages|pkgs|ctns|cartons)|packages?\s*[:\-]|nos?\s*of\s*(pkgs|packages|ctns)/i.test(row))
  const row = labeled ?? rows.find((row) => PACKAGE_TYPES.test(row))
  if (!row) return null
  const withUnit = row.match(new RegExp(`(\\d[\\d.,]*)\\s*(${PACKAGE_TYPES.source})`, 'i'))
  if (withUnit) {
    const count = parseNumber(withUnit[1])
    if (count !== null) return { count, type: withUnit[2].replace(/[.,]$/, '').toUpperCase().slice(0, 24) }
  }
  const count = parseNumber(row)
  const type = row.match(PACKAGE_TYPES)?.[1]?.toUpperCase() ?? null
  return count !== null || type ? { count: count ?? 0, type } : null
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (char === '"') quoted = false
      else current += char
    } else if (char === '"') quoted = true
    else if (char === ',') { cells.push(current.trim()); current = '' }
    else current += char
  }
  cells.push(current.trim())
  return cells
}

const HEADER_SUMMARY = /^(total|grand\s*total|subtotal|amount\s*in|continued)/i

function extractItems(parsed: ParsedDocument): JobInvoiceItem[] {
  if (parsed.source !== 'XLSX') return []
  const rows = parsed.text.split(/\r?\n/).map((line) => parseCsvLine(line))
  const headerIndex = rows.findIndex(
    (cells) => cells.some((cell) => /qty|quantity/i.test(cell)) && cells.some((cell) => /description|goods|commodity|item|nama/i.test(cell)),
  )
  if (headerIndex < 0) return []
  const header = rows[headerIndex].map((cell) => cell.toLowerCase())
  const column = (pattern: RegExp) => header.findIndex((cell) => pattern.test(cell))
  const descriptionColumn =
    column(/description|goods|commodity|nama barang/) >= 0
      ? column(/description|goods|commodity|nama barang/)
      : column(/\bitem\b|nama/)
  const quantityColumn = column(/qty|quantity/)
  if (descriptionColumn < 0 || quantityColumn < 0) return []
  const unitColumn = column(/unit|uom|satuan/)
  const unitPriceColumn = column(/price|unit value|harga/)
  const lineTotalColumn = column(/total|amount/)
  const itemCodeColumn = column(/code|sku|artikel|model|part/)
  const hsCodeColumn = column(/\bhs\b|hs code|tariff/)
  const grossColumn = column(/gross/)
  const netColumn = column(/net/)
  const countryColumn = column(/origin|country/)
  const pick = (cells: string[], index: number) => (index >= 0 ? cells[index]?.trim() : '') || null
  const items: JobInvoiceItem[] = []
  for (const cells of rows.slice(headerIndex + 1)) {
    const description = (descriptionColumn >= 0 ? cells[descriptionColumn] : '')?.replace(/^["']|["']+$/g, '').trim() ?? ''
    if (!description) continue
    if (HEADER_SUMMARY.test(description)) break
    const quantity = parseNumber(pick(cells, quantityColumn))
    if (quantity === null) continue
    const country = pick(cells, countryColumn)
    items.push({
      lineNumber: items.length + 1,
      itemCode: pick(cells, itemCodeColumn),
      description,
      hsCode: pick(cells, hsCodeColumn),
      quantity,
      unit: pick(cells, unitColumn)?.toUpperCase().slice(0, 12) ?? null,
      unitPrice: parseNumber(pick(cells, unitPriceColumn)),
      lineTotal: parseNumber(pick(cells, lineTotalColumn)),
      currency: null,
      grossWeightKg: parseNumber(pick(cells, grossColumn)),
      netWeightKg: parseNumber(pick(cells, netColumn)),
      countryOfOrigin: country ? country.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || null : null,
      packageCount: null,
      packageType: null,
    })
  }
  return items
}

const hasValue = (value: unknown): boolean =>
  value === null || value === undefined
    ? false
    : Array.isArray(value)
      ? value.length > 0
      : typeof value === 'object'
        ? Object.values(value as Record<string, unknown>).some(hasValue)
        : value !== ''

function extractInvoice(parsed: ParsedDocument): JobInvoiceExtraction | null {
  const rows = textLines(parsed.text)
  const text = parsed.text
  const packages = detectPackages(text)
  const incoterm = detectIncoterm(text)
  const invoice: JobInvoiceExtraction = {
    invoiceNumber:
      firstLabelValue(rows, [/invoice\s*(?:no|number|#)\s*[:#]?/i]) ??
      firstRegexGroup(text, /\b(?:INV|CI|INVOICE)[\s.\-#]*(\d[\w./-]{2,})/i),
    invoiceDate: parseDate(firstLabelValue(rows, [/invoice\s*date\s*[:#]?/i, /\bdate\s*[:#]/i])),
    seller: party(firstLabelValue(rows, [/^\s*(?:seller|exporter|supplier|penjual)\s*[:\-]/i, /^(?:from)\s*[:\-]/i])),
    buyer: party(firstLabelValue(rows, [/^\s*(?:buyer|importer|purchaser|sold\s*(?:to|messrs)|to)\s*[:\-]/i])),
    currency: detectCurrency(text),
    incoterm: incoterm?.incoterm ?? null,
    incotermLocation: incoterm?.location ?? null,
    totalAmount: parseNumber(firstLabelValue(rows, [/(?:grand\s*total|total\s*amount|amount\s*(?:payable|due)|total\s*(?:price|value))\s*[:#]?/i, /\btotal\b\s*[:#]?/i])),
    freightAmount: parseNumber(firstLabelValue(rows, [/freight\s*(?:charge)?\s*[:#]?/i])),
    insuranceAmount: parseNumber(firstLabelValue(rows, [/insurance\s*[:#]?/i])),
    totalGrossWeightKg: parseNumber(firstLabelValue(rows, [/(?:total\s*)?gross\s*weight\s*(?:\(kg\))?\s*[:#]?/i])),
    totalNetWeightKg: parseNumber(firstLabelValue(rows, [/(?:total\s*)?net\s*weight\s*(?:\(kg\))?\s*[:#]?/i])),
    totalPackageCount: packages?.count ?? null,
    packageType: packages?.type ?? null,
    items: extractItems(parsed),
  }
  return hasValue(invoice) ? invoice : null
}

function extractTransport(parsed: ParsedDocument): JobTransportExtraction | null {
  const rows = textLines(parsed.text)
  const text = parsed.text
  const containers: JobTransportContainer[] = [...text.matchAll(/\b([A-Z]{4})[\s-]?(\d{7})\b/g)].flatMap((match) => {
    const container: JobTransportContainer = {
      containerNumber: `${match[1]}${match[2]}`,
      size: null,
      type: null,
      sealNumber: null,
    }
    return [container]
  })
  const packages = detectPackages(text)
  const transport: JobTransportExtraction = {
    documentNumber:
      firstLabelValue(rows, [/(?:bill\s*of\s*lading|b\/l|bl|awb|air\s*waybill|ma?wb)\s*(?:no|number|#)?\s*[:#]/i]) ??
      firstRegexGroup(text, /\b(?:B\/L|BL|AWB|MAWB|HAWB)[\s.\-#:]*([A-Z0-9][\w./-]{4,})/i),
    documentDate: parseDate(firstLabelValue(rows, [/\bdate\s*(?:of\s*(?:issue|b\/l|awb))?\s*[:#]/i])),
    carrier: firstLabelValue(rows, [/(?:carrier|shipping\s*line|airline|air\s*lines?)\s*[:\-]/i]),
    vesselOrFlight: firstLabelValue(rows, [/(?:vessel|ship\s*name|flight|voyage\s*no)\.?\s*[:\-]/i, /(?:vessel\/voyage)\s*[:\-]/i]),
    voyageOrFlightNumber: firstLabelValue(rows, [/voy(?:age)?\.?\s*(?:no|number|#)?\s*[:\-]/i]),
    bookingNumber: firstLabelValue(rows, [/booking\s*(?:no|number)?\s*[:#]?/i]),
    shipper: party(firstLabelValue(rows, [/^\s*(?:shipper|exporter|consignor)\s*[:\-]/i])),
    consignee: party(firstLabelValue(rows, [/^\s*(?:consignee|to\s*order|importer)\s*[:\-]/i])),
    notifyParty: party(firstLabelValue(rows, [/^\s*(?:notify(?:\s*party)?|notifie[dé]?)\s*[:\-]/i])),
    portOfLoading: firstLabelValue(rows, [/(?:port\s*of\s*loading|pol)\s*[:\-]/i]),
    portOfDischarge: firstLabelValue(rows, [/(?:port\s*of\s*discharge|pod)\s*[:\-]/i]),
    placeOfReceipt: firstLabelValue(rows, [/(?:place\s*of\s*receipt)\s*[:\-]/i]),
    placeOfDelivery: firstLabelValue(rows, [/(?:place\s*of\s*delivery|final\s*destination)\s*[:\-]/i]),
    etd: parseDate(firstLabelValue(rows, [/\betd\b[^:\n]*[:\-]/i])),
    eta: parseDate(firstLabelValue(rows, [/\beta\b[^:\n]*[:\-]/i])),
    packageCount: packages?.count ?? null,
    packageType: packages?.type ?? null,
    marksAndNumbers: firstLabelValue(rows, [/(?:marks\s*(&|and)\s*numbers?|mks?\s*&?\s*nos?)\s*[:\-]?/i]),
    grossWeightKg: parseNumber(firstLabelValue(rows, [/(?:total\s*)?gross\s*weight\s*(?:\(kg\))?\s*[:#]?/i])),
    netWeightKg: parseNumber(firstLabelValue(rows, [/(?:total\s*)?net\s*weight\s*(?:\(kg\))?\s*[:#]?/i])),
    volumeM3: parseNumber(firstLabelValue(rows, [/(?:volume|measurement|cbm|m3)\s*[:#]?/i])),
    containers,
  }
  return hasValue(transport) ? transport : null
}

export function extractFields(parsed: ParsedDocument): {
  invoice: JobInvoiceExtraction | null
  transport: JobTransportExtraction | null
} {
  return { invoice: extractInvoice(parsed), transport: extractTransport(parsed) }
}

/** Dot-path flattening utk peta confidence (mis. invoice.items.0.quantity). */
export function flattenExtractionFields(
  invoice: JobInvoiceExtraction | null,
  transport: JobTransportExtraction | null,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  const push = (prefix: string, value: unknown): void => {
    if (value === null || value === undefined || typeof value !== 'object') {
      fields[prefix] = value
      return
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => push(`${prefix}.${index}`, entry))
      return
    }
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) push(`${prefix}.${key}`, entry)
  }
  if (invoice) push('invoice', invoice)
  if (transport) push('transport', transport)
  return fields
}
