import 'server-only'

// Perender model surat Kanwil (`lib/kanwil-letter.ts`) menjadi PDF A4 polos. pdf-lib dipilih karena
// murni JS dengan font standar tertanam (tanpa baca berkas), jadi aman dibundel webpack/standalone.

import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'

import type { KanwilLetterModel } from '@/lib/kanwil-letter'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 72
const SIZE = 11
const LEADING = 14
const RIGHT = PAGE_WIDTH - MARGIN
const CONTENT_WIDTH = RIGHT - MARGIN
const COLON_X = 108
const VALUE_X = 116
const BULLET_TEXT_X = 82
const SIGNATURE_GAP = 56
const SIGNATORY_COLUMN = 225.64

export async function renderKanwilLetterPdf(model: KanwilLetterModel): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.setTitle(model.title)
  doc.setCreator('VSS')
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  // drawText melempar error pada karakter di luar WinAnsi, jadi semua teks disanitasi lebih dulu.
  const supported = new Set(regular.getCharacterSet())
  const clean = (text: string) =>
    Array.from(text.replace(/[\t\r\n]/g, ' '))
      .map((char) => (supported.has(char.codePointAt(0) ?? 0) ? char : '?'))
      .join('')

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const ensureSpace = (height: number) => {
    if (y - height + LEADING >= MARGIN) return
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }
  const blankLine = () => {
    y -= LEADING
  }
  const draw = (text: string, x: number, font: PDFFont = regular) => {
    if (text) page.drawText(text, { x, y, size: SIZE, font })
  }

  const wrap = (text: string, width: number, font: PDFFont): string[] => {
    const lines: string[] = []
    let current = ''
    for (const word of clean(text).split(' ').filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word
      if (!current || font.widthOfTextAtSize(candidate, SIZE) <= width) current = candidate
      else {
        lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
    return lines.length ? lines : ['']
  }

  // Paragraf di-wrap per kata; mode justify merentangkan semua baris kecuali baris terakhir.
  const paragraph = (text: string, x: number, width: number, justify: boolean) => {
    const lines = wrap(text, width, regular)
    lines.forEach((line, index) => {
      ensureSpace(LEADING)
      const words = line.split(' ')
      if (justify && index < lines.length - 1 && words.length > 1) {
        const wordsWidth = words.reduce((sum, word) => sum + regular.widthOfTextAtSize(word, SIZE), 0)
        const gap = (width - wordsWidth) / (words.length - 1)
        let cursor = x
        for (const word of words) {
          draw(word, cursor)
          cursor += regular.widthOfTextAtSize(word, SIZE) + gap
        }
      } else {
        draw(line, x)
      }
      y -= LEADING
    })
  }

  const line = (text: string, x = MARGIN, font: PDFFont = regular) => {
    ensureSpace(LEADING)
    draw(clean(text), x, font)
    y -= LEADING
  }

  // Nomor + tempat/tanggal rata kanan.
  ensureSpace(LEADING)
  draw('No.', MARGIN)
  draw(':', COLON_X)
  draw(clean(model.letterNumber), VALUE_X)
  const placeDate = clean(model.placeDate)
  draw(placeDate, RIGHT - regular.widthOfTextAtSize(placeDate, SIZE))
  y -= LEADING

  // Perihal dengan hanging indent.
  ensureSpace(LEADING)
  draw('Hal', MARGIN)
  draw(':', COLON_X)
  paragraph(model.subject, VALUE_X, RIGHT - VALUE_X, false)

  blankLine()
  for (const recipientLine of model.recipient) line(recipientLine)
  blankLine()
  line('Di tempat')
  blankLine()
  line('Dengan hormat,')
  blankLine()

  for (const text of model.paragraphs) {
    paragraph(text, MARGIN, CONTENT_WIDTH, true)
    blankLine()
  }

  paragraph(model.attachmentsIntro, MARGIN, CONTENT_WIDTH, true)
  for (const attachment of model.attachments) {
    ensureSpace(LEADING)
    draw('-', MARGIN)
    paragraph(attachment, BULLET_TEXT_X, RIGHT - BULLET_TEXT_X, false)
  }
  blankLine()

  paragraph(model.closing, MARGIN, CONTENT_WIDTH, true)
  blankLine()

  // Nama perusahaan, ruang tanda tangan/stempel, dan penandatangan harus satu halaman.
  ensureSpace(LEADING + SIGNATURE_GAP + 2 * LEADING)
  line(model.companyName)
  y -= SIGNATURE_GAP
  const signatoryTop = y
  model.signatories.forEach((signatory, index) => {
    const x = MARGIN + index * SIGNATORY_COLUMN
    y = signatoryTop
    draw(clean(signatory.name), x, bold)
    if (signatory.title) {
      y -= LEADING
      draw(clean(signatory.title), x)
    }
  })

  return Buffer.from(await doc.save())
}
