'use client'

// Mengapa: leaf KLIEN pemicu unduhan Excel daftar event. Filter diambil dari URL saat ini
// (`useSearchParams`), jadi file yang diunduh selalu sama dengan daftar yang sedang terlihat.

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download } from 'lucide-react'

import { toast } from '@/components/toast'
import { downloadEventsExport } from '@/lib/data-client'

export function EventExportButton() {
  const searchParams = useSearchParams()
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const { blob, filename } = await downloadEventsExport(searchParams.toString())
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
      toast('Daftar event diekspor.', 'success')
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Daftar event tidak dapat diekspor.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleExport()}
      disabled={exporting}
      className="btn-secondary shrink-0"
    >
      <Download size={16} aria-hidden="true" />
      <span className="ml-2">{exporting ? 'Mengekspor…' : 'Export'}</span>
    </button>
  )
}
