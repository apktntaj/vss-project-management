'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { nanoid } from 'nanoid'
import { Plus, Search, Trash2, Upload, X } from 'lucide-react'

import {
  applyCiplAutofill,
  createInternationalJobInit,
  createLocalJobInit,
  listAgents,
  listEventExhibitors,
  saveAgent,
  saveJobCiplDocument,
  saveJobDocument,
  saveJobManifestExhibitors,
  saveJobTransportExtraction,
  type Agent,
  type InternationalJobJenis,
  type LocalEvent,
  type LocalExhibitor,
  type LocalJob,
} from '@/lib/data-client'
import {
  barisBarangSchema,
  buildCiplDocument,
  disposisiBarangs,
  disposisiBarangLabels,
  type BarisBarang,
  type CiplDocumentHeader,
  type DisposisiBarang,
} from '@/domain/exhibition/cipl-document'
import {
  autofillResolutionLabels,
  reconcileKoliTotal,
  resolveCiplAutofill,
  summarizeAutofill,
  type CiplScanEntry,
} from '@/domain/exhibition/cipl-autofill'
import { matchExhibitorByName } from '@/domain/event/exhibitor-matching'
import { exhibitorLogisticsSchema, type Koli } from '@/domain/job/manifest'
import { internationalJobJenisLabels } from '@/domain/job/types'
import type { JobTransportExtraction } from '@/domain/exhibition/source-documents'
import type { CiplScanResult } from '@/lib/server/manifest-extraction'
import { TransportEditor } from '@/components/job-document-editor-dialog'
import { isAcceptedJobDocument, jobDocumentAccept } from '@/components/job-document-file'
import { Skeleton } from '@/components/ui/skeleton'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

type JobTypeSelection = 'LOCAL' | InternationalJobJenis

const jobTypeOptions: Array<{ value: JobTypeSelection; description: string }> = [
  {
    value: 'TPPB_BC_23',
    description:
      'Fasilitas Tempat Penyelenggaraan Pameran Berikat; barang masuk venue berikat via BC 2.3.',
  },
  {
    value: 'ATA_CARNET',
    description: 'Impor sementara dengan paspor barang ATA Carnet.',
  },
  {
    value: 'TEMPORARY_IMPORT',
    description: 'Impor sementara biasa dengan jaminan; barang wajib keluar kembali.',
  },
  {
    value: 'PERMANENT_IMPORT',
    description: 'Impor tetap (Genco); barang tetap berada di Indonesia.',
  },
  {
    value: 'ROAD_SHIPMENT',
    description: 'Pengangkutan darat / pengalihan barang antar tempat (BC 2.7).',
  },
  {
    value: 'LOCAL',
    description: 'Barang pihak lokal tanpa dokumen kepabeanan.',
  },
]

function jobTypeLabel(value: JobTypeSelection) {
  return value === 'LOCAL' ? 'Local' : internationalJobJenisLabels[value]
}

const slideLabels = ['Job', 'CIPL', 'B/L atau AWB']

type CiplLineDraft = {
  label: string
  length: string
  width: string
  height: string
  cbm: string
  weight: string
  satuanKemasan: string
  uraian: string
  merekModel: string
  kodeHs: string
  jumlah: string
  satuan: string
  nilaiSatuan: string
  nilaiTotal: string
  disposisi: DisposisiBarang
}
type CiplRowDraft = {
  key: string
  jobNo: string
  name: string
  totalPackage: string
  bareCase: string
  hall: string
  booth: string
  lines: CiplLineDraft[]
}

/** Badge status penautan satu baris terhadap exhibitor event — diturunkan dari nama, bukan disimpan. */
function rowLinkStatus(name: string, pool: ReadonlyArray<LocalExhibitor>) {
  const trimmed = name.trim()
  if (!trimmed) return null
  const match = matchExhibitorByName(trimmed, pool)
  if (match.kind === 'MATCHED') return { kind: 'TERTAUT' as const, hint: match.exhibitor.name }
  if (match.kind === 'AMBIGUOUS')
    return { kind: 'AMBIGU' as const, hint: `${match.candidates.length} exhibitor bernama sama` }
  return { kind: 'BARU' as const, hint: 'akan didaftarkan ke event' }
}

const linkStatusClass: Record<'TERTAUT' | 'BARU' | 'AMBIGU', string> = {
  TERTAUT: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  BARU: 'bg-amber-50 text-amber-700 ring-amber-200',
  AMBIGU: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const emptyLine = (): CiplLineDraft => ({
  label: '',
  length: '',
  width: '',
  height: '',
  cbm: '',
  weight: '',
  satuanKemasan: '',
  uraian: '',
  merekModel: '',
  kodeHs: '',
  jumlah: '',
  satuan: '',
  nilaiSatuan: '',
  nilaiTotal: '',
  disposisi: 'TIDAK_DISEBUT',
})

const emptyRow = (key: string): CiplRowDraft => ({
  key,
  jobNo: '',
  name: '',
  totalPackage: '',
  bareCase: '',
  hall: '',
  booth: '',
  lines: [emptyLine()],
})

/** Satu baris gabungan (kemasan + barang) → BarisBarang; refKoli diwariskan dari kolom case (fill-down). */
function lineToBarang(line: CiplLineDraft, refKoli: string | null): BarisBarang | null {
  const parsed = barisBarangSchema.safeParse({
    uraian: line.uraian.trim(),
    merekModel: line.merekModel.trim() || null,
    kodeHs: line.kodeHs.trim() || null,
    jumlah: numberOrNull(line.jumlah),
    satuan: line.satuan.trim() || 'UNIT',
    nilaiSatuan: numberOrNull(line.nilaiSatuan),
    nilaiTotal: numberOrNull(line.nilaiTotal),
    disposisi: line.disposisi,
    refKoli,
  })
  return parsed.success ? parsed.data : null
}

/** Minimal satu field terisi — gerbang tombol "Tambah exhibitor". */
function isRowFilled(row: CiplRowDraft): boolean {
  if (
    row.name.trim() ||
    row.totalPackage.trim() ||
    row.bareCase.trim() ||
    row.hall.trim() ||
    row.booth.trim()
  ) {
    return true
  }
  return row.lines.some((line) =>
    Boolean(
      line.label.trim() ||
      line.length.trim() ||
      line.width.trim() ||
      line.height.trim() ||
      line.cbm.trim() ||
      line.weight.trim() ||
      line.satuanKemasan.trim() ||
      line.uraian.trim() ||
      line.merekModel.trim() ||
      line.kodeHs.trim() ||
      line.jumlah.trim() ||
      line.satuan.trim() ||
      line.nilaiSatuan.trim() ||
      line.nilaiTotal.trim() ||
      line.disposisi !== 'TIDAK_DISEBUT',
    ),
  )
}

const emptyTransport = (): JobTransportExtraction => ({
  documentNumber: null,
  documentDate: null,
  carrier: null,
  vesselOrFlight: null,
  voyageOrFlightNumber: null,
  bookingNumber: null,
  shipper: null,
  consignee: null,
  notifyParty: null,
  portOfLoading: null,
  portOfDischarge: null,
  placeOfReceipt: null,
  placeOfDelivery: null,
  etd: null,
  eta: null,
  packageCount: null,
  packageType: null,
  marksAndNumbers: null,
  grossWeightKg: null,
  netWeightKg: null,
  volumeM3: null,
  containers: [],
})

const numberOrNull = (value: string): number | null => {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scanFileAcceptable(file: File): boolean {
  if (isAcceptedJobDocument(file)) return true
  toast('File harus berupa PDF atau Excel.', 'error')
  return false
}

/**
 * Wizard pembuatan job tiga bagian: (1) job — event via pencarian, jenis, No Job,
 * agent, bill to; (2) informasi CIPL — daftar exhibitor + rincian koli dengan smart
 * scan LLM; (3) data B/L atau AWB dengan smart scan. Bagian dapat diisi dalam urutan
 * bebas lewat langkah di header; "Selesai" tersedia di semua bagian dan menyimpan
 * seluruh isian yang sudah terisi (syarat wajib hanya event pada bagian job), sehingga
 * membatalkan kapan pun tidak meninggalkan data.
 */
export function JobCreateWizard({
  events,
  presetEvent,
  onCreated,
  onCancel,
}: {
  events: LocalEvent[]
  presetEvent?: LocalEvent | null
  onCreated: (job: LocalJob) => void
  onCancel: () => void
}) {
  const [slide, setSlide] = useState(0)
  const [selection, setSelection] = useState<JobTypeSelection>('TPPB_BC_23')
  const [eventQuery, setEventQuery] = useState(presetEvent?.officialName ?? '')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(presetEvent?.id ?? null)
  const [jobNumberInput, setJobNumberInput] = useState('')
  const [billToInput, setBillToInput] = useState('')
  /** Benar setelah user mengetik bill to sendiri — bill to berhenti mengikuti agent. */
  const [billToTouched, setBillToTouched] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [tanpaAgent, setTanpaAgent] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [agentQuery, setAgentQuery] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentContactName, setNewAgentContactName] = useState('')
  const [newAgentEmail, setNewAgentEmail] = useState('')
  const [newAgentPhone, setNewAgentPhone] = useState('')
  const [error, setError] = useState('')
  const [ciplRows, setCiplRows] = useState<CiplRowDraft[]>(() => [emptyRow('cipl-row-0')])
  const [ciplFile, setCiplFile] = useState<File | null>(null)
  const [scanningCipl, setScanningCipl] = useState(false)
  const [ciplHeader, setCiplHeader] = useState<CiplDocumentHeader | null>(null)
  /** Exhibitor event terpilih — kolam pencocokan autofill CIPL. */
  const [eventExhibitors, setEventExhibitors] = useState<LocalExhibitor[]>([])
  const [ciplBelumTerpetakan, setCiplBelumTerpetakan] = useState<BarisBarang[]>([])
  const [docKind, setDocKind] = useState<'BL' | 'AWB'>('BL')
  const [transport, setTransport] = useState<JobTransportExtraction | null>(null)
  const [transportFile, setTransportFile] = useState<File | null>(null)
  const [scanningTransport, setScanningTransport] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const rowKeyRef = useRef(0)
  const nextRowKey = () => `cipl-row-${++rowKeyRef.current}`

  useEffect(() => {
    let active = true
    listAgents().then((loadedAgents) => {
      if (!active) return
      setAgents(loadedAgents)
      setLoadingAgents(false)
    })
    return () => {
      active = false
    }
  }, [])

  // Exhibitor event dimuat begitu event dipilih: tanpa kolam ini setiap entri CIPL akan
  // tampak "baru" dan autofill mendaftarkan ulang exhibitor yang sudah ada.
  useEffect(() => {
    if (!selectedEventId) {
      setEventExhibitors([])
      return
    }
    let active = true
    listEventExhibitors(selectedEventId)
      .then((loaded) => {
        if (active) setEventExhibitors(loaded)
      })
      .catch(() => {
        if (active) setEventExhibitors([])
      })
    return () => {
      active = false
    }
  }, [selectedEventId])

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? presetEvent ?? null,
    [events, selectedEventId, presetEvent],
  )

  const eventSuggestions = useMemo(() => {
    const search = eventQuery.trim().toLowerCase()
    if (!search || selectedEventId) return []
    return events
      .filter((event) =>
        [event.officialName, event.alias].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
      .slice(0, 6)
  }, [eventQuery, events, selectedEventId])

  const agentSuggestions = useMemo(() => {
    const query = agentQuery.trim().toLowerCase()
    if (!query) return []
    return agents.filter((agent) => agent.name.toLowerCase().includes(query)).slice(0, 6)
  }, [agentQuery, agents])

  function changeSelection(next: JobTypeSelection) {
    setSelection(next)
    // Local dan road shipment tidak membutuhkan agent — centang "Tanpa agent" dan bersihkan pilihan agent.
    const tanpaAgentDefault = next === 'LOCAL' || next === 'ROAD_SHIPMENT'
    setTanpaAgent(tanpaAgentDefault)
    if (tanpaAgentDefault) {
      setSelectedAgentId(null)
      setAgentQuery('')
    }
  }

  function changeTanpaAgent(checked: boolean) {
    setTanpaAgent(checked)
    if (checked) {
      setSelectedAgentId(null)
      setAgentQuery('')
    }
  }

  function selectAgent(agent: Agent) {
    setSelectedAgentId(agent.id)
    setAgentQuery(agent.name)
    if (!billToTouched) setBillToInput(agent.name)
  }

  async function resolveAgentId(): Promise<{ agentId: string | null; agentName: string }> {
    if (tanpaAgent) return { agentId: null, agentName: '' }
    if (creatingNew && newAgentName.trim()) {
      const created = await saveAgent({
        name: newAgentName,
        contact: {
          name: newAgentContactName || null,
          role: null,
          email: newAgentEmail || null,
          phone: newAgentPhone || null,
        },
        address: null,
        countryCode: null,
      })
      return { agentId: created.id, agentName: created.name }
    }
    if (selectedAgentId) {
      return {
        agentId: selectedAgentId,
        agentName: agents.find((agent) => agent.id === selectedAgentId)?.name ?? '',
      }
    }
    return { agentId: null, agentName: '' }
  }

  async function createJob(): Promise<LocalJob> {
    if (!selectedEvent) throw new Error('Pilih event untuk job ini terlebih dahulu.')
    const { agentId } = await resolveAgentId()
    return selection === 'LOCAL'
      ? await createLocalJobInit(selectedEvent.id, agentId, null, {
          jobNumber: jobNumberInput,
          billTo: billToInput,
        })
      : await createInternationalJobInit({
          eventId: selectedEvent.id,
          agentId,
          internationalJenis: selection,
          jobNumber: jobNumberInput,
          billTo: billToInput,
        })
  }

  function submitSlideJob(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    setError('')
    if (!selectedEvent) {
      const message = 'Pilih event untuk job ini terlebih dahulu.'
      setError(message)
      toast(message, 'error')
      return
    }
    if (selection === 'LOCAL') {
      void finish()
      return
    }
    setSlide(1)
  }

  async function scanCipl(file: File) {
    if (!scanFileAcceptable(file)) return
    setScanningCipl(true)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/scan-cipl', { method: 'POST', body })
      const data = (await response.json().catch(() => null)) as
        (Partial<CiplScanResult> & { warnings?: string[] }) | { error?: string } | null
      if (!response.ok || !data || !('exhibitors' in data) || !Array.isArray(data.exhibitors)) {
        throw new Error(
          data && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Dokumen tidak dapat dipindai.',
        )
      }
      const rows: CiplRowDraft[] = data.exhibitors.map((exhibitor) => {
        const lines: CiplLineDraft[] = exhibitor.logistics.koli.details.map((koli) => ({
          ...emptyLine(),
          label: koli.label ?? '',
          length: koli.dimension?.lengthCm == null ? '' : String(koli.dimension.lengthCm),
          width: koli.dimension?.widthCm == null ? '' : String(koli.dimension.widthCm),
          height: koli.dimension?.heightCm == null ? '' : String(koli.dimension.heightCm),
          cbm: koli.volumeCbm == null ? '' : String(koli.volumeCbm),
          weight: koli.weightKg == null ? '' : String(koli.weightKg),
          satuanKemasan: koli.satuanKemasan ?? '',
        }))
        for (const item of exhibitor.items ?? []) {
          const refLabel = item.refKoli?.trim() || ''
          const target = refLabel
            ? (lines.find((entry) => entry.label.trim() === refLabel && !entry.uraian.trim()) ??
              null)
            : null
          const line = target ?? { ...emptyLine(), label: item.refKoli ?? '' }
          line.uraian = item.uraian
          line.merekModel = item.merekModel ?? ''
          line.kodeHs = item.kodeHs ?? ''
          line.jumlah = String(item.jumlah)
          line.satuan = item.satuan
          line.nilaiSatuan = item.nilaiSatuan == null ? '' : String(item.nilaiSatuan)
          line.nilaiTotal = item.nilaiTotal == null ? '' : String(item.nilaiTotal)
          line.disposisi = item.disposisi
          if (!target) lines.push(line)
        }
        if (lines.length === 0) lines.push(emptyLine())
        return {
          key: nextRowKey(),
          jobNo: exhibitor.jobNo ?? '',
          name: exhibitor.name,
          totalPackage: String(exhibitor.logistics.koli.totalCount),
          bareCase:
            exhibitor.logistics.koli.bareCaseCount == null
              ? ''
              : String(exhibitor.logistics.koli.bareCaseCount),
          hall: exhibitor.logistics.hall ?? '',
          booth: exhibitor.logistics.booth ?? '',
          lines,
        }
      })
      setCiplRows(rows)
      setCiplHeader(data.header ?? null)
      setCiplBelumTerpetakan(data.itemsBelumTerpetakan ?? [])
      setCiplFile(file)
      if (rows.length) {
        toast(
          `${rows.length} exhibitor terbaca dari dokumen — periksa lalu lanjutkan.${data.warnings?.length ? ` (${data.warnings.length} baris dilewati)` : ''}`,
          'success',
        )
      } else {
        toast('Tidak ada baris exhibitor yang terbaca dari dokumen.', 'error')
      }
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat dipindai.', 'error')
    } finally {
      setScanningCipl(false)
    }
  }

  async function scanTransport(file: File) {
    if (!scanFileAcceptable(file)) return
    setScanningTransport(true)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/classify-job-document', { method: 'POST', body })
      const data = (await response.json().catch(() => null)) as {
        classification?: { documentType?: string }
        transport?: JobTransportExtraction | null
        detail?: { documentType?: string } | null
        error?: string
      } | null
      if (!response.ok || !data) {
        throw new Error(data?.error || 'Dokumen tidak dapat dipindai.')
      }
      if (!data.transport) {
        const detected =
          data.detail?.documentType ?? data.classification?.documentType ?? 'tidak dikenali'
        throw new Error(
          `Dokumen terdeteksi sebagai ${detected.replace(/_/g, ' ').toLowerCase()} — bukan B/L atau AWB.`,
        )
      }
      setTransport(data.transport)
      setTransportFile(file)
      if (
        data.detail?.documentType === 'AIR_WAYBILL' ||
        data.classification?.documentType === 'AIR_WAYBILL'
      ) {
        setDocKind('AWB')
      } else if (
        data.detail?.documentType === 'BILL_OF_LADING' ||
        data.classification?.documentType === 'BILL_OF_LADING'
      ) {
        setDocKind('BL')
      }
      toast('Data B/L atau AWB terisi dari dokumen — periksa lalu selesaikan.', 'success')
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat dipindai.', 'error')
    } finally {
      setScanningTransport(false)
    }
  }

  /**
   * Draft tabel → entri scan domain. "Total pkg" yang terlihat operator diteruskan sebagai
   * total yang DISEBUT dokumen, sehingga angka yang ia ketik sendiri menang; bila dikosongkan,
   * label koli ("7-11", "in package No. 22") yang menentukan jumlah paket.
   */
  function buildScanEntries(): CiplScanEntry[] {
    const entries: CiplScanEntry[] = []
    for (const row of ciplRows) {
      const name = row.name.trim()
      if (!name) continue
      const details: Koli[] = []
      const labelToId = new Map<string, string>()
      const items: BarisBarang[] = []
      let currentLabel: string | null = null
      let currentKoliId: string | null = null
      for (const line of row.lines) {
        const label = line.label.trim() || null
        if (label !== null) currentLabel = label
        const lengthCm = numberOrNull(line.length)
        const widthCm = numberOrNull(line.width)
        const heightCm = numberOrNull(line.height)
        const dimension =
          lengthCm !== null && widthCm !== null && heightCm !== null
            ? { lengthCm, widthCm, heightCm }
            : null
        const volumeCbm = numberOrNull(line.cbm)
        const weightKg = numberOrNull(line.weight)
        const hasPackage =
          label !== null || dimension !== null || volumeCbm !== null || weightKg !== null
        if (label !== null && labelToId.has(label)) {
          // case berulang: pakai id koli yang sudah ada (dims hanya di baris pertama)
          currentKoliId = labelToId.get(label)!
        } else if (hasPackage) {
          const id = nanoid()
          details.push({
            id,
            label,
            dimension,
            volumeCbm,
            weightKg,
            satuanKemasan: line.satuanKemasan.trim() || null,
          })
          if (label !== null) labelToId.set(label, id)
          currentKoliId = id
        }
        const barang = lineToBarang(line, currentLabel)
        if (barang) items.push({ ...barang, refKoliIds: currentKoliId ? [currentKoliId] : [] })
      }
      const stated = numberOrNull(row.totalPackage)
      const statedTotalCount = stated === null ? null : Math.round(stated)
      const parsed = exhibitorLogisticsSchema.safeParse({
        hall: row.hall.trim() || null,
        booth: row.booth.trim() || null,
        koli: {
          totalCount: reconcileKoliTotal(details, statedTotalCount),
          bareCaseCount:
            numberOrNull(row.bareCase) == null ? null : Math.round(numberOrNull(row.bareCase)!),
          details,
        },
        notes: [],
      })
      if (parsed.success) {
        entries.push({ name, statedTotalCount, logistics: parsed.data, items })
      }
    }
    return entries
  }

  async function finish() {
    setFinishing(true)
    let job: LocalJob
    try {
      job = await createJob()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Job tidak dapat dibuat.'
      toast(message, 'error')
      setError(message)
      setSlide(0)
      setFinishing(false)
      return
    }
    let failures = 0
    const scanEntries = buildScanEntries()
    const skippedNames = ciplRows.length - scanEntries.length
    // Satu entri CIPL = satu exhibitor event: yang sudah terdaftar ditautkan lewat nama
    // ternormalisasi, yang belum didaftarkan di sini, lalu hall/booth/koli-nya ikut tersimpan.
    const plan = resolveCiplAutofill(scanEntries, eventExhibitors)
    const manifestRows = plan.rows
    let autofill: Awaited<ReturnType<typeof applyCiplAutofill>> | null = null
    if (manifestRows.length) {
      try {
        autofill = job.eventId
          ? await applyCiplAutofill({
              jobId: job.id,
              eventId: job.eventId,
              agentId: job.agentId ?? null,
              rows: manifestRows,
            })
          : // Tanpa event tidak ada master exhibitor yang bisa dituju; baris tetap disimpan di
            // job apa adanya supaya hasil scan tidak hilang.
            await saveJobManifestExhibitors(
              job.id,
              manifestRows.map((row) => ({
                exhibitorId: null,
                name: row.name,
                logistics: row.logistics,
              })),
            ).then(() => null)
      } catch {
        failures += 1
        toast('Baris CIPL tidak dapat disimpan — bisa dilengkapi di detail job.', 'error')
      }
    }
    const ciplDocument = buildCiplDocument(ciplHeader, manifestRows, ciplBelumTerpetakan)
    if (ciplDocument) {
      try {
        await saveJobCiplDocument(job.id, ciplDocument)
      } catch {
        failures += 1
        toast('Baris barang CIPL tidak dapat disimpan — bisa dilengkapi di detail job.', 'error')
      }
    }
    if (ciplFile) {
      try {
        await saveJobDocument(job.id, ciplFile, 'CIPL')
      } catch {
        failures += 1
        toast('Dokumen CIPL tidak dapat diunggah.', 'error')
      }
    }
    if (transportFile && transport) {
      try {
        await saveJobDocument(
          job.id,
          transportFile,
          docKind === 'AWB' ? 'AIR_WAYBILL' : 'BILL_OF_LADING',
          null,
          transport,
        )
      } catch {
        failures += 1
        toast('Dokumen B/L atau AWB tidak dapat diunggah.', 'error')
      }
    } else if (transport) {
      try {
        await saveJobTransportExtraction(job.id, transport)
      } catch {
        failures += 1
        toast('Data B/L atau AWB tidak dapat disimpan.', 'error')
      }
    }
    const parts = [`Job (${jobTypeLabel(selection)}) dibuat`]
    if (manifestRows.length) {
      const ringkasan = summarizeAutofill(manifestRows)
      const rincian = [
        ringkasan.tertaut ? `${ringkasan.tertaut} tertaut` : null,
        autofill?.created.length ? `${autofill.created.length} exhibitor baru` : null,
      ].filter(Boolean)
      parts.push(
        `${manifestRows.length} exhibitor CIPL${rincian.length ? ` (${rincian.join(', ')})` : ''}`,
      )
    }
    const itemCount =
      manifestRows.reduce((sum, row) => sum + row.items.length, 0) + ciplBelumTerpetakan.length
    if (itemCount) parts.push(`${itemCount} baris barang`)
    if (transportFile) parts.push(docKind === 'AWB' ? 'AWB' : 'B/L')
    toast(
      `${parts.join(' · ')}.${failures ? ' Sebagian data gagal — periksa detail job.' : ''}`,
      failures ? 'error' : 'success',
    )
    if (skippedNames > 0)
      toast(`${skippedNames} baris CIPL dilewati karena belum ada nama exhibitor.`, 'error')
    for (const warning of plan.warnings) toast(warning, 'error')
    if (autofill?.unlinked.length)
      toast(
        `${autofill.unlinked.length} baris belum tertaut ke exhibitor event — tautkan dari detail job.`,
        'error',
      )
    onCreated(job)
  }

  const scanning = scanningCipl || scanningTransport
  const busy = scanning || finishing

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-create-title"
        className="card relative flex h-[min(720px,calc(100vh-2rem))] min-h-0 w-full max-w-3xl flex-col overflow-hidden"
      >
        <div className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b bg-white px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <h2 id="job-create-title" className="text-2xl font-bold">
              Job Baru
            </h2>
            <ol
              className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs"
              aria-label="Langkah pembuatan job"
            >
              {slideLabels.map((label, index) => (
                <li key={label} className="flex items-center gap-1.5">
                  {index > 0 ? <span className="text-slate-300">›</span> : null}
                  <button
                    type="button"
                    onClick={() => setSlide(index)}
                    disabled={busy}
                    aria-current={index === slide ? 'step' : undefined}
                    className={`rounded-full px-2 py-0.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      index === slide
                        ? 'bg-orange-100 text-orange-800'
                        : 'text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {index + 1}. {label}
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup form job baru"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>

        {scanning ? (
          <div
            className="absolute inset-0 z-10 flex flex-col justify-center gap-4 overflow-hidden bg-white p-6 sm:p-8"
            aria-busy="true"
            aria-live="polite"
          >
            <p className="text-sm font-medium text-orange-700">Memeriksa dokumen dengan AI...</p>
            <Skeleton className="h-6 w-56" />
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : null}

        {slide === 0 ? (
          <form onSubmit={submitSlideJob} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 sm:p-8">
              <div className="relative">
                <label className="label">
                  Event
                  <div className="relative mt-1">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      value={eventQuery}
                      onChange={(inputEvent) => {
                        setEventQuery(inputEvent.target.value)
                        setSelectedEventId(null)
                      }}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === 'Enter' && eventSuggestions.length > 0) {
                          keyboardEvent.preventDefault()
                          setSelectedEventId(eventSuggestions[0].id)
                          setEventQuery(eventSuggestions[0].officialName)
                        }
                      }}
                      className="input py-2 pl-9"
                      placeholder="Cari nama event, venue, atau EO…"
                      aria-label="Cari event"
                      autoComplete="off"
                      disabled={Boolean(presetEvent)}
                    />
                  </div>
                </label>
                {eventSuggestions.length > 0 && !selectedEventId ? (
                  <ul
                    className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-lg"
                    aria-label="Saran event"
                  >
                    {eventSuggestions.map((event) => (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEventId(event.id)
                            setEventQuery(event.officialName)
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                        >
                          {event.officialName}
                          <span className="ml-2 text-xs text-slate-400">
                            {[event.venue?.name, event.eventOrganizer?.legalName]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {selectedEventId && selectedEvent ? (
                  <p className="mt-1.5 text-xs font-medium text-emerald-700">
                    Event terpilih: {selectedEvent.officialName}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="label">
                  Jenis job
                  <select
                    value={selection}
                    onChange={(selectEvent) =>
                      changeSelection(selectEvent.target.value as JobTypeSelection)
                    }
                    className="input mt-1"
                  >
                    {jobTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {jobTypeLabel(option.value)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="label">
                  No Job <span className="font-normal text-slate-400">(opsional)</span>
                  <input
                    value={jobNumberInput}
                    onChange={(inputEvent) =>
                      setJobNumberInput(inputEvent.target.value.toLocaleUpperCase('id-ID'))
                    }
                    className="input mt-1"
                    placeholder="cth. S.01/ISFEX-VPN/2026"
                  />
                </label>
              </div>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={tanpaAgent}
                      onChange={(checkEvent) => changeTanpaAgent(checkEvent.target.checked)}
                      className="h-4 w-4 accent-orange-600"
                    />
                    Tanpa agent
                  </label>
                  {!creatingNew ? (
                    <button
                      type="button"
                      onClick={() => setCreatingNew(true)}
                      disabled={tanpaAgent}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={13} aria-hidden="true" />
                      Tambah agent
                    </button>
                  ) : null}
                </div>

                {!tanpaAgent && creatingNew ? (
                  <div className="mt-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="label sm:col-span-2">
                        Nama agent
                        <input
                          value={newAgentName}
                          onChange={(inputEvent) => {
                            const name = inputEvent.target.value.toLocaleUpperCase('id-ID')
                            setNewAgentName(name)
                            if (!billToTouched) setBillToInput(name)
                          }}
                          className="input mt-1"
                          placeholder="cth. JS LOGISTICS"
                        />
                      </label>
                      <label className="label">
                        Nama PIC
                        <input
                          value={newAgentContactName}
                          onChange={(inputEvent) => setNewAgentContactName(inputEvent.target.value)}
                          className="input mt-1"
                        />
                      </label>
                      <label className="label">
                        Telepon PIC
                        <input
                          value={newAgentPhone}
                          onChange={(inputEvent) => setNewAgentPhone(inputEvent.target.value)}
                          className="input mt-1"
                        />
                      </label>
                      <label className="label sm:col-span-2">
                        Email PIC
                        <input
                          type="email"
                          value={newAgentEmail}
                          onChange={(inputEvent) => setNewAgentEmail(inputEvent.target.value)}
                          className="input mt-1"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreatingNew(false)}
                      className="mt-3 text-xs font-semibold text-orange-700 hover:text-orange-800"
                    >
                      Pilih agent tersimpan
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="relative">
                      <input
                        value={agentQuery}
                        onChange={(inputEvent) => {
                          setAgentQuery(inputEvent.target.value)
                          setSelectedAgentId(null)
                        }}
                        className="input"
                        placeholder={loadingAgents ? 'Memuat agent...' : 'Ketik nama agent...'}
                        disabled={tanpaAgent}
                        aria-label="Cari agent"
                        autoComplete="off"
                      />
                      {agentSuggestions.length > 0 && !selectedAgentId ? (
                        <ul
                          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-lg"
                          aria-label="Saran agent"
                        >
                          {agentSuggestions.map((agent) => (
                            <li key={agent.id}>
                              <button
                                type="button"
                                onClick={() => selectAgent(agent)}
                                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                              >
                                {agent.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {selectedAgentId ? (
                      <p className="mt-1.5 text-xs font-medium text-emerald-700">
                        Agent terpilih: {agents.find((agent) => agent.id === selectedAgentId)?.name}
                      </p>
                    ) : null}
                  </div>
                )}
              </section>

              <label className="label">
                Bill to <span className="font-normal text-slate-400">(opsional)</span>
                <input
                  value={billToInput}
                  onChange={(inputEvent) => {
                    setBillToInput(inputEvent.target.value)
                    setBillToTouched(true)
                  }}
                  className="input mt-1"
                  placeholder="Pihak yang ditagih (mis. agent atau exhibitor)"
                />
              </label>
            </div>

            <div className="shrink-0 border-t px-6 py-4 sm:px-8">
              {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
                  Batal
                </button>
                <button
                  type={selection === 'LOCAL' ? 'submit' : 'button'}
                  onClick={selection === 'LOCAL' ? undefined : finish}
                  disabled={busy}
                  className="btn-primary"
                >
                  {finishing ? 'Menyimpan...' : 'Selesai'}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {slide === 1 ? (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 sm:p-8">
              <div>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-black/20 bg-white px-4 py-3 text-sm text-slate-500 hover:border-orange-300 hover:bg-orange-50">
                  <span className="min-w-0 truncate">
                    {ciplFile
                      ? `Terpindai: ${ciplFile.name}`
                      : 'Klik untuk isi otomatis dari dokumen CIPL'}
                  </span>
                  <Upload size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                  <input
                    type="file"
                    accept={jobDocumentAccept}
                    className="sr-only"
                    disabled={scanningCipl || finishing}
                    onChange={(inputEvent) => {
                      const file = inputEvent.target.files?.[0]
                      if (file) void scanCipl(file)
                      inputEvent.target.value = ''
                    }}
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">.</p>
              </div>

              <ul className="space-y-4">
                {ciplRows.map((row, rowIndex) => {
                  const sums = row.lines.reduce(
                    (total, line) => ({
                      cbm: total.cbm + (numberOrNull(line.cbm) ?? 0),
                      kg: total.kg + (numberOrNull(line.weight) ?? 0),
                    }),
                    { cbm: 0, kg: 0 },
                  )
                  const link = selectedEventId ? rowLinkStatus(row.name, eventExhibitors) : null
                  return (
                    <li key={row.key} className="rounded-xl border border-black/10 p-4">
                      <div className="space-y-3">
                        <div className="flex items-end gap-2">
                          <label className="label flex-1">
                            Exhibitor
                            {row.jobNo ? (
                              <span className="ml-1 text-xs font-normal text-slate-400">
                                {row.jobNo}
                              </span>
                            ) : null}
                            {link ? (
                              <span
                                className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${linkStatusClass[link.kind]}`}
                                title={link.hint}
                              >
                                {autofillResolutionLabels[link.kind]}
                              </span>
                            ) : null}
                            <input
                              value={row.name}
                              onChange={(inputEvent) =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex
                                      ? { ...item, name: inputEvent.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="input mt-1"
                              disabled={finishing}
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={`Hapus exhibitor ${row.name || rowIndex + 1}`}
                            onClick={() =>
                              setCiplRows((current) => current.filter((_, i) => i !== rowIndex))
                            }
                            className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                            disabled={finishing}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="label w-24">
                            Total pkg
                            <input
                              type="number"
                              min="0"
                              value={row.totalPackage}
                              onChange={(inputEvent) =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex
                                      ? { ...item, totalPackage: inputEvent.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="input mt-1"
                              disabled={finishing}
                            />
                          </label>
                          <label className="label w-28">
                            Booth no
                            <input
                              value={row.booth}
                              onChange={(inputEvent) =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex
                                      ? { ...item, booth: inputEvent.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="input mt-1"
                              disabled={finishing}
                            />
                          </label>
                          <label className="label w-28">
                            Hall
                            <input
                              value={row.hall}
                              onChange={(inputEvent) =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex
                                      ? { ...item, hall: inputEvent.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="input mt-1"
                              disabled={finishing}
                            />
                          </label>
                          <label className="label w-24">
                            Bare case
                            <input
                              type="number"
                              min="0"
                              value={row.bareCase}
                              onChange={(inputEvent) =>
                                setCiplRows((current) =>
                                  current.map((item, i) =>
                                    i === rowIndex
                                      ? { ...item, bareCase: inputEvent.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="input mt-1"
                              disabled={finishing}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="space-y-3">
                          {row.lines.map((line, lineIndex) => (
                            <div
                              key={lineIndex}
                              className="rounded-lg border border-black/5 bg-slate-50/60 p-3"
                            >
                              <div className="flex flex-wrap items-end gap-2">
                                {(
                                  [
                                    ['label', 'Case', 'text', 'cth. PKG 1', 'w-28 grow'],
                                    ['length', 'L (cm)', 'number', '', 'w-20'],
                                    ['width', 'W (cm)', 'number', '', 'w-20'],
                                    ['height', 'H (cm)', 'number', '', 'w-20'],
                                    ['cbm', 'CBM', 'number', '', 'w-20'],
                                    ['weight', 'Kg', 'number', '', 'w-20'],
                                    ['satuanKemasan', 'Satuan', 'text', 'cth. CARTON', 'w-24'],
                                    ['uraian', 'Uraian', 'text', 'Nama barang', 'w-40 grow'],
                                    ['merekModel', 'Merek/model', 'text', '', 'w-28'],
                                    ['kodeHs', 'HS code', 'text', '', 'w-24'],
                                    ['jumlah', 'Jumlah', 'number', '', 'w-20'],
                                    ['satuan', 'Satuan', 'text', '', 'w-20'],
                                    ['nilaiSatuan', 'Nilai satuan', 'number', '', 'w-24'],
                                    ['nilaiTotal', 'Nilai total', 'number', '', 'w-24'],
                                  ] as const
                                ).map(([field, fieldLabel, type, placeholder, width]) => (
                                  <label key={field} className={`label text-xs ${width}`}>
                                    {fieldLabel}
                                    <input
                                      type={type}
                                      {...(type === 'number' ? { min: '0', step: 'any' } : {})}
                                      value={line[field]}
                                      onChange={(inputEvent) =>
                                        setCiplRows((current) =>
                                          current.map((item, i) =>
                                            i === rowIndex
                                              ? {
                                                  ...item,
                                                  lines: item.lines.map((entry, j) =>
                                                    j === lineIndex
                                                      ? {
                                                          ...entry,
                                                          [field]: inputEvent.target.value,
                                                        }
                                                      : entry,
                                                  ),
                                                }
                                              : item,
                                          ),
                                        )
                                      }
                                      placeholder={placeholder || undefined}
                                      className="input mt-1 py-1.5 text-sm"
                                      disabled={finishing}
                                    />
                                  </label>
                                ))}
                                <label className="label w-36 text-xs">
                                  Disposisi
                                  <select
                                    value={line.disposisi}
                                    onChange={(inputEvent) =>
                                      setCiplRows((current) =>
                                        current.map((item, i) =>
                                          i === rowIndex
                                            ? {
                                                ...item,
                                                lines: item.lines.map((entry, j) =>
                                                  j === lineIndex
                                                    ? {
                                                        ...entry,
                                                        disposisi: inputEvent.target
                                                          .value as DisposisiBarang,
                                                      }
                                                    : entry,
                                                ),
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    className="input mt-1 py-1.5 text-sm"
                                    disabled={finishing}
                                  >
                                    {disposisiBarangs.map((disposisi) => (
                                      <option key={disposisi} value={disposisi}>
                                        {disposisiBarangLabels[disposisi]}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  aria-label={`Hapus baris ${lineIndex + 1}`}
                                  onClick={() =>
                                    setCiplRows((current) =>
                                      current.map((item, i) =>
                                        i === rowIndex
                                          ? {
                                              ...item,
                                              lines: item.lines.filter((_, j) => j !== lineIndex),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                                  disabled={finishing}
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setCiplRows((current) =>
                                current.map((item, i) =>
                                  i === rowIndex
                                    ? { ...item, lines: [...item.lines, emptyLine()] }
                                    : item,
                                ),
                              )
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
                            disabled={finishing}
                          >
                            <Plus size={13} aria-hidden="true" />
                            Tambah baris
                          </button>
                          <p className="text-xs text-slate-500">
                            Σ {sums.cbm.toLocaleString('id-ID')} CBM ·{' '}
                            {sums.kg.toLocaleString('id-ID')} kg
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <button
                type="button"
                onClick={() => setCiplRows((current) => [...current, emptyRow(nextRowKey())])}
                className="btn-secondary"
                disabled={finishing || (ciplRows.length > 0 && !ciplRows.some(isRowFilled))}
              >
                <Plus size={16} aria-hidden="true" />
                Tambah exhibitor
              </button>
            </div>

            <div className="shrink-0 border-t px-6 py-4 sm:px-8">
              <div className="flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
                  Batal
                </button>
                <button type="button" onClick={finish} disabled={busy} className="btn-primary">
                  {finishing ? 'Menyimpan...' : 'Selesai'}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {slide === 2 ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6 sm:p-8">
              <div className="grid shrink-0 gap-4 sm:grid-cols-[220px_1fr]">
                <label className="label">
                  Jenis dokumen
                  <select
                    value={docKind}
                    onChange={(selectEvent) => setDocKind(selectEvent.target.value as 'BL' | 'AWB')}
                    className="input mt-1"
                    disabled={finishing}
                  >
                    <option value="BL">B/L (laut)</option>
                    <option value="AWB">AWB (udara)</option>
                  </select>
                </label>
                <fieldset className="rounded-xl border border-dashed border-orange-300 bg-orange-50/50 p-4">
                  <legend className="px-1 text-sm font-semibold text-slate-800">Smart Scan</legend>
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-black/20 bg-white px-4 py-2.5 text-sm text-slate-500 hover:border-orange-300 hover:bg-orange-50">
                    <span className="min-w-0 truncate">
                      {transportFile
                        ? `Terpindai: ${transportFile.name}`
                        : 'Unggah B/L atau AWB untuk dipindai'}
                    </span>
                    <Upload size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                      type="file"
                      accept={jobDocumentAccept}
                      className="sr-only"
                      disabled={scanningTransport || finishing}
                      onChange={(inputEvent) => {
                        const file = inputEvent.target.files?.[0]
                        if (file) void scanTransport(file)
                        inputEvent.target.value = ''
                      }}
                    />
                  </label>
                </fieldset>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/10">
                <TransportEditor value={transport ?? emptyTransport()} onChange={setTransport} />
              </div>
              <p className="shrink-0 text-xs text-slate-500">
                Dokumen yang dipindai tersimpan sebagai lampiran job saat Anda menekan Selesai.
              </p>
            </div>

            <div className="shrink-0 border-t px-6 py-4 sm:px-8">
              <div className="flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
                  Batal
                </button>
                <button type="button" onClick={finish} disabled={busy} className="btn-primary">
                  {finishing ? 'Menyimpan...' : 'Selesai'}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
