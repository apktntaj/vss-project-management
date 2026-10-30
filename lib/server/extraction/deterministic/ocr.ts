import 'server-only'

import { createWorker } from 'tesseract.js'
import { EXTRACTION_TIMEOUT_MS } from '../config'
import { DocumentExtractionError } from '../errors'
import { extractPageImages } from './pdf-images'
import type { ParsedDocument } from './parsed-document'

const MAX_OCR_PAGES = 5
const OCR_FAILED_MESSAGE = 'Pemindaian teks dokumen gagal. Coba dokumen dengan kualitas lebih baik.'

const raceDeadline = async <T>(deadline: number, work: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DocumentExtractionError(OCR_FAILED_MESSAGE, 502, 'OCR_FAILED')), Math.max(0, deadline - Date.now()))
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
    const images = await raceDeadline(deadline, extractPageImages(file, MAX_OCR_PAGES))
    if (!images.length) throw new DocumentExtractionError(OCR_FAILED_MESSAGE, 502, 'OCR_FAILED')
    const worker = await raceDeadline(deadline, createWorker('eng'))
    try {
      const texts: string[] = []
      for (const image of images) {
        const result = await raceDeadline(deadline, worker.recognize(image.ppm))
        texts.push(result.data.text ?? '')
      }
      const text = texts.join('\n\n').trim()
      if (!text) throw new DocumentExtractionError(OCR_FAILED_MESSAGE, 502, 'OCR_FAILED')
      return { text, pages: images.length, hasTextLayer: true, source: 'OCR' }
    } finally {
      await worker.terminate()
    }
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError(OCR_FAILED_MESSAGE, 502, 'OCR_FAILED')
  }
}
