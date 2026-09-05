import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/session'

export const runtime = 'nodejs'

const MAX_PDF_SIZE = 10 * 1024 * 1024
const MODEL = 'gemini-3.5-flash-lite'

const shipmentFields = [
  'shipper',
  'consignee',
  'notifyParty',
  'awbNumber',
  'blNumber',
  'agent',
  'shippingLine',
  'cargoDescription',
  'shipmentMode',
  'cargoDetails',
  'journeyDetails',
] as const

type ParsedShipment = Record<(typeof shipmentFields)[number], string | null>

function emptyShipment(): ParsedShipment {
  return Object.fromEntries(shipmentFields.map((field) => [field, null])) as ParsedShipment
}

function normalizeShipment(value: unknown): ParsedShipment {
  const result = emptyShipment()
  if (!value || typeof value !== 'object') return result

  for (const field of shipmentFields) {
    const fieldValue = (value as Record<string, unknown>)[field]
    if (typeof fieldValue === 'string' && fieldValue.trim()) result[field] = fieldValue.trim()
  }
  if (result.shipmentMode !== 'FCL' && result.shipmentMode !== 'LCL') result.shipmentMode = null
  return result
}

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return unauthorized()

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY belum dikonfigurasi.' }, { status: 503 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (
    !(file instanceof File) ||
    (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
  ) {
    return NextResponse.json({ error: 'File PDF wajib diunggah.' }, { status: 400 })
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: 'Ukuran PDF melebihi batas 10 MB.' }, { status: 413 })
  }

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString('base64')
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract shipment data from this bill of lading or air waybill. Return only JSON. Use null when a field is not clearly present. Preserve names, references, quantities, dimensions, weights, ports, vessels, dates, and other values as written. For shipmentMode, return only FCL or LCL when explicitly stated; otherwise null. Fields: ${shipmentFields.join(', ')}.`,
                },
                { inlineData: { mimeType: 'application/pdf', data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
          },
        }),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Gemini shipment parsing failed:', response.status, errorBody)
      return NextResponse.json(
        { error: 'Dokumen tidak dapat diproses oleh Gemini.' },
        { status: 502 },
      )
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text
    if (!text) throw new Error('Gemini response tidak berisi JSON.')

    return NextResponse.json({ fields: normalizeShipment(JSON.parse(text)) })
  } catch (error) {
    console.error('Shipment parsing error:', error)
    return NextResponse.json(
      { error: 'Dokumen tidak dapat dibaca. Gunakan viewer sebagai fallback.' },
      { status: 502 },
    )
  }
}
