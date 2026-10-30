import 'server-only'

import { deflateSync } from 'node:zlib'

// Tabel CRC-32 (polinomial 0xEDB88320) untuk penulisan chunk PNG.
const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Rata-rata area sederhana: tiap piksel tujuan meratakan blok sumber — cukup untuk mengecilkan hasil pindai. */
function downscale(pixels: Buffer, width: number, height: number, channels: number, targetWidth: number, targetHeight: number): Buffer {
  const out = Buffer.alloc(targetWidth * targetHeight * channels)
  for (let y = 0; y < targetHeight; y++) {
    const y0 = Math.floor((y * height) / targetHeight)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / targetHeight))
    for (let x = 0; x < targetWidth; x++) {
      const x0 = Math.floor((x * width) / targetWidth)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / targetWidth))
      const offset = (y * targetWidth + x) * channels
      for (let c = 0; c < channels; c++) {
        let sum = 0
        for (let sy = y0; sy < y1; sy++) {
          for (let sx = x0; sx < x1; sx++) sum += pixels[(sy * width + sx) * channels + c]!
        }
        out[offset + c] = Math.round(sum / ((y1 - y0) * (x1 - x0)))
      }
    }
  }
  return out
}

/** Mengubah PNM (P5 grayscale / P6 RGB) dari extractPageImages menjadi PNG; sisi terpanjang dibatasi maxEdge. */
export function pnmToPng(ppm: Buffer, maxEdge = 1600): Buffer {
  const header = ppm.toString('ascii', 0, 64).match(/^P([56])\n(\d+) (\d+)\n255\n/)
  if (!header) throw new Error('Bukan PNM P5/P6 yang valid.')
  const channels = header[1] === '5' ? 1 : 3
  const width = Number(header[2])
  const height = Number(header[3])
  // String match regex sudah mencakup baris baru terakhir header, jadi offset = panjang match.
  const dataOffset = Buffer.byteLength(header[0])
  let pixels = ppm.subarray(dataOffset)
  if (pixels.length < width * height * channels) throw new Error('Data piksel PNM tidak lengkap.')

  let outWidth = width
  let outHeight = height
  const longEdge = Math.max(width, height)
  if (longEdge > maxEdge) {
    const scale = maxEdge / longEdge
    outWidth = Math.max(1, Math.round(width * scale))
    outHeight = Math.max(1, Math.round(height * scale))
    pixels = downscale(pixels, width, height, channels, outWidth, outHeight)
  }

  const scanlines = Buffer.alloc((outWidth * channels + 1) * outHeight)
  for (let y = 0; y < outHeight; y++) {
    scanlines[y * (outWidth * channels + 1)] = 0
    pixels.copy(scanlines, y * (outWidth * channels + 1) + 1, y * outWidth * channels, (y + 1) * outWidth * channels)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(outWidth, 0)
  ihdr.writeUInt32BE(outHeight, 4)
  ihdr[8] = 8
  ihdr[9] = channels === 1 ? 0 : 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
