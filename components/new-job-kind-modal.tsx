'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Globe2,
  MapPin,
  Repeat,
  ScrollText,
  Truck,
  Warehouse,
  X,
} from 'lucide-react'
import type { LocalEvent } from '@/lib/data-client'
import {
  internationalJobJenisLabels,
  type InternationalJobJenis,
  type JobKind,
} from '@/domain/job/types'

const jobKindOptions: Array<{
  value: JobKind
  label: string
  description: string
  icon: typeof Globe2
}> = [
  {
    value: 'LOCAL',
    label: 'Local',
    description:
      'Barang dibawa langsung oleh exhibitor lokal tanpa dokumen kepabeanan, seperti grup LOCAL pada inward manifest.',
    icon: Truck,
  },
  {
    value: 'INTERNATIONAL',
    label: 'International',
    description:
      'Job kepabeanan melalui agent: satu agent membawa beberapa exhibitor dengan satu CIPL dan B/L.',
    icon: Globe2,
  },
]

const internationalJenisOptions: Array<{
  value: InternationalJobJenis
  description: string
  icon: typeof Globe2
}> = [
  {
    value: 'VENUE',
    description: 'Pengiriman barang terkait kebutuhan venue event.',
    icon: MapPin,
  },
  {
    value: 'ROAD_SHIPMENT',
    description: 'Pengiriman darat antar wilayah, seperti grup ROAD SHIPMENT pada inward manifest.',
    icon: Truck,
  },
  {
    value: 'PERMANENT_IMPORT',
    description: 'Impor tetap; barang menjadi milik impor dan tidak wajib diekspor kembali.',
    icon: Warehouse,
  },
  {
    value: 'ATA_CARNET',
    description: 'Impor sementara dengan dokumen ATA Carnet.',
    icon: ScrollText,
  },
  {
    value: 'TEMPORARY_EXPORT',
    description: 'Ekspor sementara; barang wajib dipulangkan kembali.',
    icon: Repeat,
  },
]

function optionCardClasses(isSelected: boolean) {
  return `flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition ${
    isSelected
      ? 'border-orange-300 bg-orange-50 shadow-sm'
      : 'border-black/10 bg-slate-50 hover:border-orange-200 hover:bg-orange-50/50'
  }`
}

function optionIconClasses(isSelected: boolean) {
  return `flex size-10 items-center justify-center rounded-full ${
    isSelected ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'
  }`
}

export function NewJobKindModal({
  event,
  onSelect,
  onCancel,
}: {
  event: LocalEvent
  onSelect: (kind: JobKind, internationalJenis?: InternationalJobJenis) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<'kind' | 'international-jenis'>('kind')
  const isJenisStep = step === 'international-jenis'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-job-kind-title"
        className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-5 sm:px-8">
          <div>
            <h2 id="new-job-kind-title" className="text-2xl font-bold">
              Buat job baru
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {event.officialName} · {event.venue?.officialName || 'Venue belum diinput'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup pilihan jenis job"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          {isJenisStep ? (
            <div>
              <button
                type="button"
                onClick={() => setStep('kind')}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-orange-700"
              >
                <ArrowLeft size={14} /> Kembali
              </button>
              <h3 id="new-job-international-jenis-title" className="mt-3 text-lg font-semibold">
                Jenis job international
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Pilih kelompok pengiriman sesuai inward manifest.
              </p>
              <div
                role="radiogroup"
                aria-labelledby="new-job-international-jenis-title"
                className="mt-5 grid gap-4 sm:grid-cols-2"
              >
                {internationalJenisOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={false}
                      onClick={() => onSelect('INTERNATIONAL', option.value)}
                      className={optionCardClasses(false)}
                    >
                      <span className={optionIconClasses(false)}>
                        <Icon size={20} />
                      </span>
                      <span className="text-base font-semibold text-slate-900">
                        {internationalJobJenisLabels[option.value]}
                      </span>
                      <span className="text-sm leading-6 text-slate-600">{option.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-labelledby="new-job-kind-title"
              className="grid gap-4 sm:grid-cols-2"
            >
              {jobKindOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={false}
                    onClick={() => {
                      if (option.value === 'INTERNATIONAL') setStep('international-jenis')
                      else onSelect('LOCAL')
                    }}
                    className={optionCardClasses(false)}
                  >
                    <span className={optionIconClasses(false)}>
                      <Icon size={20} />
                    </span>
                    <span className="text-base font-semibold text-slate-900">{option.label}</span>
                    <span className="text-sm leading-6 text-slate-600">{option.description}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
