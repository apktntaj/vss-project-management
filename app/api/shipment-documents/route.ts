import { NextResponse } from 'next/server'

import type { Shipment } from '@/domain/exhibition/types'
import { getEventApiContext } from '@/lib/supabase/event-api'
import { extractionRouteFailure } from '@/lib/server/extraction/route-failure'
import { loadShipmentDocuments } from '@/lib/server/extraction/shipment-documents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { client, workspaceId } = await getEventApiContext()
    const shipmentId = new URL(request.url).searchParams.get('shipmentId')?.trim() ?? ''
    if (!shipmentId) {
      return NextResponse.json({ error: 'Shipment wajib dipilih.', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    const { data: shipmentRow, error: shipmentError } = await client
      .from('shipments')
      .select('payload')
      .eq('workspace_id', workspaceId)
      .eq('id', shipmentId)
      .maybeSingle<{ payload: Shipment }>()
    if (shipmentError) throw new Error(`Shipment tidak dapat dimuat: ${shipmentError.message}`)
    if (!shipmentRow?.payload) {
      return NextResponse.json({ error: 'Pemilik dokumen tidak ditemukan.', code: 'OWNER_NOT_FOUND' }, { status: 400 })
    }
    const { documents, completeness } = await loadShipmentDocuments(client, workspaceId, shipmentRow.payload)
    return NextResponse.json({ documents, completeness })
  } catch (error) {
    return extractionRouteFailure(error)
  }
}
