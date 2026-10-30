import { NextResponse } from 'next/server'

import { markShipmentReadySchema } from '@/domain/exhibition/validation'
import type { Shipment } from '@/domain/exhibition/types'
import { getEventApiContext } from '@/lib/supabase/event-api'
import { saveRecord } from '@/lib/supabase/operational-records'
import { MANDATORY_INCOMPLETE_MESSAGE } from '@/lib/server/extraction/errors'
import { extractionRouteFailure } from '@/lib/server/extraction/route-failure'
import { loadShipmentDocuments } from '@/lib/server/extraction/shipment-documents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { client, workspaceId } = await getEventApiContext()
    const body = await request.json().catch(() => null)
    const input = markShipmentReadySchema.parse(body)

    const { data: shipmentRow, error: shipmentError } = await client
      .from('shipments')
      .select('payload')
      .eq('workspace_id', workspaceId)
      .eq('id', input.shipmentId)
      .maybeSingle<{ payload: Shipment }>()
    if (shipmentError) throw new Error(`Shipment tidak dapat dimuat: ${shipmentError.message}`)
    if (!shipmentRow?.payload) {
      return NextResponse.json({ error: 'Pemilik dokumen tidak ditemukan.', code: 'OWNER_NOT_FOUND' }, { status: 400 })
    }
    const shipment = shipmentRow.payload

    const { completeness } = await loadShipmentDocuments(client, workspaceId, shipment)
    if (completeness.status === 'INCOMPLETE') {
      return NextResponse.json(
        { error: MANDATORY_INCOMPLETE_MESSAGE, code: 'MANDATORY_DOCUMENTS_INCOMPLETE', completeness },
        { status: 400 },
      )
    }

    const updated: Shipment = { ...shipment, status: 'READY_FOR_CUSTOMS', updatedAt: new Date().toISOString() }
    await saveRecord('shipments', updated)
    return NextResponse.json({ shipment: updated })
  } catch (error) {
    return extractionRouteFailure(error)
  }
}
