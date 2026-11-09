import 'server-only'

import { createWorker } from 'tesseract.js'
import { EXTRACTION_TIMEOUT_MS, OCR_PAGE_MAX_EDGE } from '../config'
import { DocumentExtractionError } from '../errors'
import { extractPageImages } from './pdf-images'
import type { ParsedDocument } from './parsed-document'

const MAX_OCR_PAGES = 5
const OCR_FAILED_MESSAGE = 'Pemindaian teks dokumen gagal. Coba dokumen dengan kualitas lebih baik.'
const OCR_TIMEOUT_MESSAGE = 'Pemindaian dokumen melewati batas waktu. Coba PDF dengan halaman lebih sedikit atau resolusi lebih rendah.'

class OcrDeadlineError extends Error {}

const raceDeadline = async <T>(deadline: number, work: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OcrDeadlineError()), Math.max(0, deadline - Date.now()))
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function runOcr(file: File): Promise<ParsedDocument> {
  const deadline = Date.now() + EXTRACTION_TIMEOUT_MS
  try {
    const { images } = await raceDeadline(deadline, extractPageImages(file, MAX_OCR_PAGES, OCR_PAGE_MAX_EDGE))
    if (!images.length) throw new DocumentExtractionError(OCR_FAILED_MESSAGE, 502, 'OCR_FAILED')
    const worker = await raceDeadline(deadline, createWorker('eng'))
    try {
      const texts: string[] = []
      for (const image of images) {
        try {
          const result = await raceDeadline(deadline, worker.recognize(image.ppm))
          texts.push(result.data.text ?? '')
        } catch (error) {
          // Batas waktu setelah ≥1 halaman selesai: kembalikan hasil parsial, buang sisanya.
          if (error instanceof OcrDeadlineError && texts.some((t) => t.trim())) break
          throw error
        }
      }
      const text = texts.join('\n\n').trim()
      if (!text) throw new DocumentExtractionError(OCR_FAILED_MESSAGE, 502, 'OCR_FAILED')
      return { text, pages: texts.length, hasTextLayer: true, source: 'OCR' }
    } finally {
      await worker.terminate()
    }
  } catch (error) {
    if (error instanceof OcrDeadlineError) throw new DocumentExtractionError(OCR_TIMEOUT_MESSAGE, 502, 'OCR_FAILED')
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError(OCR_FAILED_MESSAGE, 502, 'OCR_FAILED')
  }
}
