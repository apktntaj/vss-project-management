'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { AlertCircle, FileUp, PackagePlus, X } from 'lucide-react'
import { saveJobWithDocument, type LocalEvent, type LocalJob } from '@/lib/indexeddb'

const MAX_PDF_SIZE = 10 * 1024 * 1024
const MAX_PDF_PAGES = 10

async function countPdfPages(file: File) {
  const contents = new TextDecoder('latin1').decode(await file.arrayBuffer())
  const pageTreeCount = contents.match(/\/Type\s*\/Pages\b[\s\S]{0,500}?\/Count\s+(\d+)/)
  if (pageTreeCount) return Number(pageTreeCount[1])

  const pageObjects = contents.match(/\/Type\s*\/Page(?:\s|\/|>)/g)
  return pageObjects?.length ?? 0
}

export function EventJobModal({
  event,
  onSaved,
  onCancel,
}: {
  event: LocalEvent
  onSaved: (job: LocalJob) => void
  onCancel: () => void
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formValues, setFormValues] = useState({
    type: 'IMPORT' as LocalJob['type'],
    shipmentMode: '' as '' | 'FCL' | 'LCL',
    clientName: '',
    awbNumber: '',
    blNumber: '',
    shipper: '',
    consignee: '',
    notifyParty: '',
    agent: '',
    shippingLine: '',
    cargoDescription: '',
    cargoDetails: '',
    journeyDetails: '',
    clientInfo: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')

  async function parseShipment(file: File) {
    setParsing(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch('/api/parse-shipment', { method: 'POST', body })
      const payload = (await response.json()) as {
        fields?: Partial<typeof formValues>
        error?: string
      }
      if (!response.ok || !payload.fields) throw new Error(payload.error || 'Parsing gagal.')
      const parsedFields = payload.fields

      setFormValues((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(parsedFields).filter(
            ([, value]) => typeof value === 'string' && value.trim(),
          ),
        ),
        clientName: current.clientName || parsedFields.shipper || '',
      }))
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Parsing gagal.')
    } finally {
      setParsing(false)
    }
  }

  useEffect(() => {
    if (!error) return
    const timeout = window.setTimeout(() => setError(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [error])

  async function selectFile(file: File | undefined) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setSelectedFile(null)
      setError('Format file tidak didukung. Upload dokumen PDF B/L atau AWB.')
      return
    }
    if (file.size > MAX_PDF_SIZE) {
      setSelectedFile(null)
      setError('Ukuran PDF melebihi batas 10 MB.')
      return
    }
    try {
      const pageCount = await countPdfPages(file)
      if (!pageCount || pageCount > MAX_PDF_PAGES) {
        setSelectedFile(null)
        setError(
          pageCount
            ? `PDF memiliki ${pageCount} halaman. Maksimal ${MAX_PDF_PAGES} halaman per shipment.`
            : 'Jumlah halaman PDF tidak dapat dibaca. Gunakan PDF B/L atau AWB yang valid.',
        )
        return
      }
    } catch {
      setSelectedFile(null)
      setError('PDF tidak dapat dibaca. Pastikan file tidak rusak.')
      return
    }
    setError('')
    setSelectedFile(file)
    void parseShipment(file)
  }

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!selectedFile) {
      setError('Pilih file PDF B/L atau AWB terlebih dahulu.')
      return
    }
    if (!formValues.clientName.trim()) {
      setError('Nama klien wajib diisi.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const job = await saveJobWithDocument({
        awbNumber: formValues.awbNumber.trim() || null,
        blNumber: formValues.blNumber.trim() || null,
        shipper: formValues.shipper.trim() || null,
        consignee: formValues.consignee.trim() || null,
        notifyParty: formValues.notifyParty.trim() || null,
        agent: formValues.agent.trim() || null,
        shippingLine: formValues.shippingLine.trim() || null,
        cargoDescription: formValues.cargoDescription.trim() || null,
        shipmentMode: formValues.shipmentMode || null,
        cargoDetails: formValues.cargoDetails.trim() || null,
        journeyDetails: formValues.journeyDetails.trim() || null,
        type: formValues.type,
        clientName: formValues.clientName.trim(),
        clientInfo: formValues.clientInfo.trim() || null,
        status: 'DRAFT',
        notes: formValues.notes.trim() || null,
        assignedToId: null,
        eventId: event.id,
        exhibitorId: null,
        sourceDocumentName: selectedFile.name,
      }, selectedFile)
      onSaved(job)
    } catch {
      setError('Tidak dapat menyimpan dokumen PDF di IndexedDB.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-8"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onCancel()
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-event-job-title"
        className="card flex h-[min(820px,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between border-b px-6 py-5 sm:px-8">
          <div>
            <h2 id="add-event-job-title" className="mt-1 text-xl font-bold">
              New job
            </h2>
            <p className="mt-1 text-sm text-slate-500">{event.officialName}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup modal tambah job"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="grid min-h-full gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <section className="flex min-h-[460px] min-w-0 flex-col">
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-orange-900">
                Upload B/L atau AWB untuk mengisi field otomatis dengan Gemini. Maksimal 10 MB dan
                10 halaman.
              </div>
              {selectedFile ? (
                <div className="mt-4 flex min-h-[460px] flex-1 flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 p-6">
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-white p-4 text-sm">
                    <p className="min-w-0 truncate font-semibold text-slate-800">
                      {selectedFile.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="shrink-0 text-xs font-semibold text-orange-700 hover:text-orange-900"
                    >
                      Ganti file
                    </button>
                  </div>
                  {parsing && (
                    <p className="mt-3 rounded-lg bg-blue-50 px-4 py-2 text-xs font-medium text-blue-800">
                      Gemini sedang membaca dokumen dan mengisi field...
                    </p>
                  )}
                </div>
              ) : (
                <label className="mt-4 flex min-h-[460px] cursor-pointer flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-orange-400 hover:bg-orange-50">
                  <FileUp className="text-orange-600" size={30} />
                  <span className="mt-3 font-semibold text-slate-800">
                    Pilih dokumen B/L atau AWB
                  </span>
                  <span className="mt-1 text-sm text-slate-500">
                    Hanya PDF, maksimal 10 MB dan 10 halaman
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(input) => void selectFile(input.target.files?.[0])}
                    className="sr-only"
                  />
                </label>
              )}
            </section>
            <section className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900">Informasi job</h3>
              <div className="mt-4 space-y-4">
                <label className="label block">
                  Jenis muatan
                  <select
                    value={formValues.shipmentMode}
                    onChange={(input) =>
                      setFormValues({
                        ...formValues,
                        shipmentMode: input.target.value as '' | 'FCL' | 'LCL',
                      })
                    }
                    className="input"
                  >
                    <option value="">Belum dipilih</option>
                    <option value="FCL">FCL</option>
                    <option value="LCL">LCL</option>
                  </select>
                </label>
                <label className="label block">
                  Shipper / exhibitor
                  <input
                    value={formValues.shipper}
                    onChange={(input) =>
                      setFormValues({ ...formValues, shipper: input.target.value })
                    }
                    className="input"
                  />
                </label>
                <label className="label block">
                  Consignee
                  <input
                    value={formValues.consignee}
                    onChange={(input) =>
                      setFormValues({ ...formValues, consignee: input.target.value })
                    }
                    className="input"
                  />
                </label>
                <label className="label block">
                  Notify party
                  <input
                    value={formValues.notifyParty}
                    onChange={(input) =>
                      setFormValues({ ...formValues, notifyParty: input.target.value })
                    }
                    className="input"
                  />
                </label>
                <label className="label block">
                  Agent
                  <input
                    value={formValues.agent}
                    onChange={(input) =>
                      setFormValues({ ...formValues, agent: input.target.value })
                    }
                    className="input"
                  />
                </label>
                <label className="label block">
                  Shipping line
                  <input
                    value={formValues.shippingLine}
                    onChange={(input) =>
                      setFormValues({ ...formValues, shippingLine: input.target.value })
                    }
                    className="input"
                  />
                </label>
                <label className="label block">
                  Tipe shipment
                  <select
                    value={formValues.type}
                    onChange={(input) =>
                      setFormValues({ ...formValues, type: input.target.value as LocalJob['type'] })
                    }
                    className="input"
                  >
                    <option value="IMPORT">Impor</option>
                    <option value="EXPORT">Ekspor</option>
                  </select>
                </label>
                <label className="label block">
                  Nama klien
                  <input
                    required
                    value={formValues.clientName}
                    onChange={(input) =>
                      setFormValues({ ...formValues, clientName: input.target.value })
                    }
                    className="input"
                  />
                </label>
                <label className="label block">
                  Nomor AWB
                  <input
                    value={formValues.awbNumber}
                    onChange={(input) =>
                      setFormValues({ ...formValues, awbNumber: input.target.value })
                    }
                    className="input"
                  />
                </label>
                <label className="label block">
                  Nomor BL
                  <input
                    value={formValues.blNumber}
                    onChange={(input) =>
                      setFormValues({ ...formValues, blNumber: input.target.value })
                    }
                    className="input"
                  />
                </label>
                <label className="label block">
                  Deskripsi barang
                  <textarea
                    value={formValues.cargoDescription}
                    onChange={(input) =>
                      setFormValues({ ...formValues, cargoDescription: input.target.value })
                    }
                    className="input min-h-20"
                  />
                </label>
                <label className="label block">
                  Detail barang
                  <textarea
                    value={formValues.cargoDetails}
                    onChange={(input) =>
                      setFormValues({ ...formValues, cargoDetails: input.target.value })
                    }
                    className="input min-h-20"
                  />
                </label>
                <label className="label block">
                  Detail perjalanan
                  <textarea
                    value={formValues.journeyDetails}
                    onChange={(input) =>
                      setFormValues({ ...formValues, journeyDetails: input.target.value })
                    }
                    className="input min-h-20"
                  />
                </label>
                <label className="label block">
                  Keterangan klien
                  <input
                    value={formValues.clientInfo}
                    onChange={(input) =>
                      setFormValues({ ...formValues, clientInfo: input.target.value })
                    }
                    className="input"
                  />
                </label>
                <label className="label block">
                  Catatan
                  <textarea
                    value={formValues.notes}
                    onChange={(input) =>
                      setFormValues({ ...formValues, notes: input.target.value })
                    }
                    className="input min-h-28"
                  />
                </label>
              </div>
            </section>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4 sm:px-8">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Batal
          </button>
          <button type="submit" disabled={saving || !selectedFile} className="btn-primary">
            <PackagePlus size={16} /> {saving ? 'Mengunggah...' : 'Buat job dari dokumen'}
          </button>
        </div>
      </form>
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-5 right-5 z-[70] flex max-w-sm items-start gap-3 rounded-xl border border-rose-200 bg-white p-4 text-rose-900 shadow-xl"
        >
          <AlertCircle className="mt-0.5 shrink-0 text-rose-600" size={20} />
          <span className="flex-1 text-sm font-medium leading-5">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Tutup notifikasi"
            className="-mr-1 -mt-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
