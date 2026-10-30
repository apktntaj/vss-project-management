import 'server-only'

/** Satu halaman hasil rasterisasi dalam format PNM (P5/P6) yang dibaca leptonica (tesseract.js). */
export type PageImage = { width: number; height: number; ppm: Buffer }

// Konstanta internal pdfjs untuk jenis data gambar hasil dekode.
const GRAYSCALE_1BPP = 1
const RGB_24BPP = 2
const RGBA_32BPP = 3

function toPnm(width: number, height: number, kind: number, data: Uint8ClampedArray): Buffer | null {
  if (kind === RGB_24BPP) {
    return Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), Buffer.from(data.buffer, data.byteOffset, data.length)])
  }
  if (kind === RGBA_32BPP) {
    const rgb = Buffer.alloc(width * height * 3)
    for (let i = 0, j = 0; j < rgb.length; i += 4, j += 3) {
      rgb[j] = data[i]
      rgb[j + 1] = data[i + 1]
      rgb[j + 2] = data[i + 2]
    }
    return Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), rgb])
  }
  if (kind === GRAYSCALE_1BPP) {
    const rowBytes = Math.ceil(width / 8)
    const gray = Buffer.alloc(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte = data[y * rowBytes + (x >> 3)] ?? 0
        gray[y * width + x] = (byte >> (7 - (x & 7))) & 1 ? 255 : 0
      }
    }
    return Buffer.concat([Buffer.from(`P5\n${width} ${height}\n255\n`), gray])
  }
  return null
}

type InternalPage = {
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>
  objs: { get(name: string, callback: (value: unknown) => void): void }
  cleanup(): void
}

/**
 * Mengekstrak gambar tertanam per halaman PDF pindaian (biasanya satu JPEG per halaman)
 * tanpa rasterisasi native. pdfjs sudah mendekode gambar ke piksel mentah saat operator list
 * dibangun; data itu diubah ke PNM untuk tesseract.js yang tidak menerima PDF langsung.
 */
export async function extractPageImages(file: File, maxPages: number): Promise<PageImage[]> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false })
  const doc = await loadingTask.promise
  const images: PageImage[] = []
  try {
    for (let pageNumber = 1; pageNumber <= Math.min(doc.numPages, maxPages); pageNumber++) {
      const page = (await doc.getPage(pageNumber)) as unknown as InternalPage
      const opList = await page.getOperatorList()
      for (let i = 0; i < opList.fnArray.length; i++) {
        if (opList.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue
        const name = String(opList.argsArray[i][0])
        const image = await new Promise<{ width?: number; height?: number; kind?: number; data?: Uint8ClampedArray } | null>((resolve) => {
          try {
            page.objs.get(name, (value) => resolve(value as { width?: number; height?: number; kind?: number; data?: Uint8ClampedArray } | null))
          } catch {
            resolve(null)
          }
        })
        if (!image?.data || !image.width || !image.height) continue
        const pnm = toPnm(image.width, image.height, image.kind ?? 0, image.data)
        if (pnm) images.push({ width: image.width, height: image.height, ppm: pnm })
        break
      }
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }
  return images
}
