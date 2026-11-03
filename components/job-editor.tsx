'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Sparkles } from 'lucide-react'
import {
  getJob,
  getNextManifestSeq,
  type TransportMode,
  getOperationalDetails,
  saveJobOperationalDetails,
  type BcDocumentKind,
  type JobCustomsDocument,
  type JobDocumentKind,
  type Job,
} from '@/lib/data-client'
import { FormSkeleton } from '@/components/loading-skeletons'
import { formatJobNumber, formatManifestSequence, jobLabel } from '@/domain/job/numbering'
import { transportModeLabels, transportModes } from '@/domain/job/types'

const text = (form: FormData, key: string) => String(form.get(key) || '').trim() || null
function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}
const statuses = [
  'NOT_STARTED',
  'PREPARING',
  'SUBMITTED',
  'REGISTERED',
  'RELEASED',
  'COMPLETED',
  'ON_HOLD',
] as const
const labels: Record<string, string> = {
  NOT_STARTED: 'Belum mulai',
  PREPARING: 'Disiapkan',
  SUBMITTED: 'Diajukan',
  REGISTERED: 'Terdaftar',
  RELEASED: 'Release',
  COMPLETED: 'Selesai',
  ON_HOLD: 'Ditunda',
}

function TransportFields({
  prefix,
  title,
  detail,
  document,
}: {
  prefix: 'inbound' | 'outbound'
  title: string
  detail: ReturnType<typeof getOperationalDetails>['inbound']
  /** Dokumen angkut job (hanya leg masuk) — identitas kiriman, disimpan di job, bukan di leg. */
  document?: { type: Job['transportDocumentType']; number: string | null }
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="label">
          Moda
          <select name={`${prefix}.mode`} defaultValue={detail.mode || ''} className="input">
            <option value="">Belum ditentukan</option>
            <option value="SEA">Laut</option>
            <option value="AIR">Udara</option>
            <option value="LOCAL">Lokal</option>
          </select>
        </label>
        {document && (
          <>
            <label className="label">
              Dokumen transport
              <select name="transportDocument.type" defaultValue={document.type || ''} className="input">
                <option value="">Belum ada</option>
                <option value="BL">B/L</option>
                <option value="AWB">AWB</option>
              </select>
            </label>
            <label className="label">
              Nomor B/L atau AWB
              <input name="transportDocument.number" defaultValue={document.number || ''} className="input" />
            </label>
          </>
        )}
        <label className="label">
          Carrier
          <input name={`${prefix}.carrier`} defaultValue={detail.carrier || ''} className="input" />
        </label>
        <label className="label">
          Jadwal (ETA / ETD)
          <input
            type="date"
            name={`${prefix}.scheduleAt`}
            defaultValue={detail.scheduleAt?.slice(0, 10) || ''}
            className="input"
          />
        </label>
        <label className="label">
          Tanggal aktual
          <input
            type="date"
            name={`${prefix}.actualAt`}
            defaultValue={detail.actualAt?.slice(0, 10) || ''}
            className="input"
          />
        </label>
      </div>
    </section>
  )
}

function CustomsCard({ kind, detail }: { kind: BcDocumentKind; detail: JobCustomsDocument }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{kind.replaceAll('_', ' ')}</h3>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            name={`${kind}.applicable`}
            defaultChecked={detail.applicable}
            className="h-4 w-4 accent-orange-600"
          />{' '}
          Diperlukan
        </label>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="label">
          Status
          <select name={`${kind}.status`} defaultValue={detail.status} className="input">
            {statuses.map((status) => (
              <option key={status} value={status}>
                {labels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Nomor aju
          <input
            name={`${kind}.ajuNumber`}
            defaultValue={detail.ajuNumber || ''}
            className="input"
          />
        </label>
        <label className="label">
          Nopen
          <input
            name={`${kind}.registrationNumber`}
            defaultValue={detail.registrationNumber || ''}
            className="input"
          />
        </label>
        <label className="label">
          Tanggal Nopen
          <input
            name={`${kind}.registrationDate`}
            type="date"
            defaultValue={detail.registrationDate || ''}
            className="input"
          />
        </label>
        <label className="label">
          Gudang
          <input
            name={`${kind}.warehouseName`}
            defaultValue={detail.warehouseName || ''}
            className="input"
          />
        </label>
        <label className="label">
          Lampiran PDF
          <input
            name={`attachment:${kind}`}
            type="file"
            accept="application/pdf"
            className="mt-2 block w-full text-sm text-slate-600"
          />
        </label>
      </div>
    </section>
  )
}

/** No Job: jalur (penentu awalan), urutan (dengan saran), nomor commercial invoice. Dibaca lewat FormData saat simpan. */
function JobNumberFields({ job }: { job: Job }) {
  const [transportMode, setTransportMode] = useState<TransportMode | ''>(job.transportMode ?? '')
  const [seq, setSeq] = useState(job.manifestSeq ? String(job.manifestSeq) : '')
  const [invoiceNumber, setInvoiceNumber] = useState(job.commercialInvoiceNumber ?? '')
  const [suggestion, setSuggestion] = useState<number | null>(null)
  const modeChanged = (transportMode || null) !== job.transportMode

  useEffect(() => {
    // Saran dihitung dari awalan yang tersimpan; bila jalur baru diubah, simpan dulu lalu minta saran.
    if (modeChanged) {
      setSuggestion(null)
      return
    }
    getNextManifestSeq(job.id)
      .then((result) => setSuggestion(result.suggestedSeq))
      .catch(() => setSuggestion(null))
  }, [job.id, job.version, modeChanged])

  const preview = formatJobNumber(
    modeChanged ? null : job.manifestPrefix,
    seq.trim() ? Number(seq.trim()) : null,
    invoiceNumber.trim() || null,
  )
  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-sm font-medium text-slate-700">No Job</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="label">
          Jalur
          <select
            name="transportMode"
            className="input mt-1"
            value={transportMode}
            disabled={job.internationalJenis === 'ROAD_SHIPMENT'}
            onChange={(event) => setTransportMode(event.target.value as TransportMode | '')}
          >
            <option value="">Belum diisi</option>
            {transportModes.map((mode) => (
              <option key={mode} value={mode}>
                {transportModeLabels[mode]}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Urutan
          <div className="mt-1 flex gap-2">
            <input
              name="manifestSeq"
              type="number"
              min="1"
              className="input"
              value={seq}
              disabled={modeChanged || !job.manifestPrefix}
              onChange={(event) => setSeq(event.target.value)}
            />
            {suggestion !== null && !modeChanged && (
              <button
                type="button"
                className="btn-secondary shrink-0"
                title="Urutan berikutnya untuk awalan ini di event ini"
                onClick={() => setSeq(String(suggestion))}
              >
                <Sparkles size={14} /> {job.manifestPrefix}.{formatManifestSequence(suggestion)}
              </button>
            )}
          </div>
        </label>
        <label className="label">
          No. commercial invoice
          <input
            name="commercialInvoiceNumber"
            className="input mt-1"
            value={invoiceNumber}
            placeholder="234YFN"
            onChange={(event) => setInvoiceNumber(event.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">
        {modeChanged
          ? 'Simpan jalur dulu — awalan No Job ditentukan jalur + jenis job. Urutan bisa diisi setelah itu.'
          : !job.manifestPrefix
            ? 'Isi jalur dulu untuk mendapatkan awalan No Job.'
            : `Pratinjau: ${preview ?? `${job.manifestPrefix}.-`}. Urutan mengikuti barang yang datang lebih dulu.`}
      </p>
    </div>
  )
}

export function JobEditor({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    getJob(jobId)
      .then((loadedJob) => {
        if (!active) return
        setJob(loadedJob)
        setLoadError(loadedJob ? '' : 'Job tidak ditemukan.')
        setLoading(false)
      })
      .catch((caught) => {
        if (!active) return
        setLoadError(caught instanceof Error ? caught.message : 'Job tidak dapat dimuat.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [jobId])
  if (loading) return <FormSkeleton fields={8} />
  if (!job)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
        {loadError || 'Job tidak ditemukan.'}
      </div>
    )
  const loadedJob = job
  const operational = getOperationalDetails(loadedJob)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const modeValue = form.get('transportMode')
    const nextMode = modeValue === null ? undefined : ((modeValue || null) as Job['transportMode'])
    const seqRaw = form.get('manifestSeq')
    const seqText = seqRaw === null ? undefined : String(seqRaw).trim()
    const manifestSeq = seqText === undefined ? undefined : seqText ? Number(seqText) : null
    if (typeof manifestSeq === 'number' && (!Number.isInteger(manifestSeq) || manifestSeq < 1)) {
      const message = 'Urutan No Job harus bilangan bulat ≥ 1.'
      setError(message)
      notify(message, 'error')
      return
    }
    const numberPatch = {
      ...(nextMode !== undefined && nextMode !== loadedJob.transportMode ? { transportMode: nextMode } : {}),
      ...(manifestSeq !== undefined ? { manifestSeq } : {}),
      commercialInvoiceNumber: text(form, 'commercialInvoiceNumber'),
    }
    setSaving(true)
    setError('')
    const transport = (prefix: 'inbound' | 'outbound') => ({
      mode: (form.get(`${prefix}.mode`) || null) as ReturnType<
        typeof getOperationalDetails
      >['inbound']['mode'],
      carrier: text(form, `${prefix}.carrier`),
      scheduleAt: text(form, `${prefix}.scheduleAt`),
      actualAt: text(form, `${prefix}.actualAt`),
    })
    const document = (kind: BcDocumentKind): JobCustomsDocument => ({
      applicable: form.get(`${kind}.applicable`) === 'on',
      status: String(form.get(`${kind}.status`)) as JobCustomsDocument['status'],
      ajuNumber: text(form, `${kind}.ajuNumber`),
      registrationNumber: text(form, `${kind}.registrationNumber`),
      registrationDate: text(form, `${kind}.registrationDate`),
      warehouseName: text(form, `${kind}.warehouseName`),
    })
    const attachments: Array<{ kind: JobDocumentKind; file: File }> = [
      'CIPL',
      'BC_2_3',
      'BC_2_5',
      'BC_3_0',
      'BC_2_7',
    ].flatMap((kind) => {
      const file = form.get(`attachment:${kind}`)
      return file instanceof File && file.size ? [{ kind: kind as JobDocumentKind, file }] : []
    })
    try {
      await saveJobOperationalDetails(
        loadedJob,
        {
          status: String(form.get('status')) as Job['status'],
          ...numberPatch,
          transportDocumentType: (form.get('transportDocument.type') || null) as Job['transportDocumentType'],
          transportDocumentNumber: text(form, 'transportDocument.number'),
          notes: text(form, 'notes'),
          emptyStorage: text(form, 'emptyStorage'),
          reExport: text(form, 'reExport'),
          operational: {
            ...operational,
            inbound: transport('inbound'),
            outbound: transport('outbound'),
            invoiceNumber: text(form, 'invoiceNumber'),
            cipl: {
              status: String(form.get('cipl.status')) as typeof operational.cipl.status,
              referenceNumber: text(form, 'cipl.referenceNumber'),
              receivedAt: text(form, 'cipl.receivedAt'),
            },
            customs: {
              BC_2_3: document('BC_2_3'),
              BC_2_5: document('BC_2_5'),
              BC_3_0: document('BC_3_0'),
              BC_2_7: document('BC_2_7'),
            },
          },
        },
        attachments,
      )
      notify('Job diperbarui.', 'success')
      router.push(`/jobs/${loadedJob.id}`)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Job tidak dapat disimpan.'
      setError(message)
      notify(message, 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Edit Job</p>
          <h1 className="mt-1 text-2xl font-bold">{jobLabel(job)}</h1>
        </div>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          <ArrowLeft size={16} /> Kembali
        </button>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      <section className="card p-5">
        <h2 className="font-semibold">Identitas dan pihak terkait</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <JobNumberFields job={job} />
          <label className="label">
            Pihak yang ditagih
            <input
              readOnly
              value={job.party?.name || 'Belum ditetapkan'}
              className="input bg-slate-50 text-slate-500"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Diubah di kartu “Pihak” pada detail job. Shipper, consignee, dan notify party dibaca
              dari B/L/AWB.
            </span>
          </label>
          <label className="label">
            Status Job
            <select name="status" defaultValue={job.status} className="input">
              <option value="DRAFT">Draf</option>
              <option value="IN_PROGRESS">Sedang diproses</option>
              <option value="ON_HOLD">Ditunda</option>
              <option value="COMPLETED">Selesai</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </label>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Perjalanan Job</h2>
        <p className="mt-1 text-sm text-slate-500">
          Satu Job dapat mencatat perjalanan masuk dan keluar dengan moda berbeda.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TransportFields
            prefix="inbound"
            title="Perjalanan masuk"
            detail={operational.inbound}
            document={{ type: job.transportDocumentType, number: job.transportDocumentNumber }}
          />
          <TransportFields
            prefix="outbound"
            title="Perjalanan keluar"
            detail={operational.outbound}
          />
        </div>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">CIPL</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="label">
            Status CIPL
            <select name="cipl.status" defaultValue={operational.cipl.status} className="input">
              <option value="MISSING">Menunggu CIPL</option>
              <option value="REQUESTED">Diminta</option>
              <option value="RECEIVED">Diterima</option>
              <option value="VERIFIED">Terverifikasi</option>
            </select>
          </label>
          <label className="label">
            Referensi CIPL
            <input
              name="cipl.referenceNumber"
              defaultValue={operational.cipl.referenceNumber || ''}
              className="input"
            />
          </label>
          <label className="label">
            No. Invoice
            <input
              name="invoiceNumber"
              defaultValue={operational.invoiceNumber || ''}
              className="input"
            />
          </label>
          <label className="label">
            Tanggal diterima
            <input
              name="cipl.receivedAt"
              type="date"
              defaultValue={operational.cipl.receivedAt?.slice(0, 10) || ''}
              className="input"
            />
          </label>
          <label className="label">
            Lampiran CIPL
            <input
              name="attachment:CIPL"
              type="file"
              accept="application/pdf"
              className="mt-2 block w-full text-sm text-slate-600"
            />
          </label>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Dokumen kepabeanan</h2>
        <p className="mt-1 text-sm text-slate-500">
          BC 2.5 dapat ditandai tidak diperlukan bila tidak ada barang yang dipakai atau tinggal di
          Indonesia. BC 2.7 dipakai saat barang pameran dialihkan ke pihak lain.
        </p>
        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          <CustomsCard kind="BC_2_3" detail={operational.customs.BC_2_3} />
          <CustomsCard kind="BC_2_5" detail={operational.customs.BC_2_5} />
          <CustomsCard kind="BC_3_0" detail={operational.customs.BC_3_0} />
          <CustomsCard kind="BC_2_7" detail={operational.customs.BC_2_7} />
        </div>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Logistik</h2>
        <p className="mt-1 text-sm text-slate-500">Tagihan job diatur di kartu “Tagihan” pada detail job.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="label">
            Empty storage
            <input
              name="emptyStorage"
              defaultValue={job.emptyStorage || ''}
              className="input"
              placeholder="Penyimpanan kemasan kosong"
            />
          </label>
          <label className="label">
            Re-export
            <input
              name="reExport"
              defaultValue={job.reExport || ''}
              className="input"
              placeholder="Rencana / status re-ekspor"
            />
          </label>
        </div>
      </section>
      <section className="card p-5">
        <label className="label">
          Catatan operasional
          <textarea name="notes" defaultValue={job.notes || ''} className="input min-h-28" />
        </label>
      </section>
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-white/95 px-5 py-3 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-[1440px] justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Batal
          </button>
          <button disabled={saving} className="btn-primary">
            <Save size={16} />
            {saving ? 'Menyimpan…' : 'Simpan perubahan'}
          </button>
        </div>
      </div>
    </form>
  )
}
