'use client'

import { useState, type ReactNode } from 'react'
import { BarChart3, BookOpenText, Calculator, FileStack, Scissors, ShieldCheck } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ItInventoryView } from '@/components/it-inventory/it-inventory-view'
import { ToolsLartasChecker } from '@/components/tools-lartas-checker'

// Alat bantu operasional PPJK. Cek LARTAS dan IT Inventory sudah berjalan; sisanya kerangka
// pilihan supaya tempat tool berikutnya sudah jelas.

const tabs = [
  { value: 'lartas', label: 'Cek LARTAS', icon: ShieldCheck },
  { value: 'cbm', label: 'Kalkulator CBM', icon: Calculator },
  { value: 'analitik', label: 'Analitik', icon: BarChart3 },
  { value: 'pdf', label: 'PDF', icon: Scissors },
  { value: 'it-inventory', label: 'IT Inventory', icon: BookOpenText },
] as const

type ToolsTab = (typeof tabs)[number]['value']

function tabFrom(value: string | undefined): ToolsTab {
  return tabs.some((tab) => tab.value === value) ? (value as ToolsTab) : 'lartas'
}

function PlannedTool({
  icon,
  title,
  description,
  items,
}: {
  icon: ReactNode
  title: string
  description: string
  items: string[]
}) {
  return (
    <section className="card p-5">
      <div className="flex gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{title}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
              Belum tersedia
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-500">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function ToolsWorkspace({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<ToolsTab>(() => tabFrom(initialTab))

  return (
    <Tabs value={tab} onValueChange={(next) => setTab(tabFrom(next ?? undefined))}>
      <TabsList className="h-auto gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="h-auto rounded-lg px-4 py-1.5 text-slate-500 hover:bg-orange-50 hover:text-orange-700 data-active:bg-orange-600 data-active:text-white data-active:shadow-sm"
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="lartas" className="mt-4">
        <ToolsLartasChecker />
      </TabsContent>
      <TabsContent value="cbm" className="mt-4">
        <PlannedTool
          icon={<Calculator size={20} />}
          title="Kalkulator CBM"
          description="Hitung volume dan berat volumetrik kiriman langsung dari dimensi koli."
          items={[
            'Input banyak koli sekaligus (P × L × T, cm) dengan total CBM otomatis',
            'Pembanding berat aktual vs berat volumetrik untuk laut dan udara',
            'Simpan hasil sebagai lampiran catatan job',
          ]}
        />
      </TabsContent>
      <TabsContent value="analitik" className="mt-4">
        <PlannedTool
          icon={<FileStack size={20} />}
          title="Analitik"
          description="Ringkasan data operasional dari Excel tanpa perlu membuka Power BI."
          items={[
            'Unggah Excel, pilih kolom, lalu lihat tabel pivot dan grafik ringkas',
            'Perbandingan nilai invoice vs realisasi per job atau per event',
            'Ekspor hasil ringkasan kembali ke Excel',
          ]}
        />
      </TabsContent>
      <TabsContent value="pdf" className="mt-4">
        <PlannedTool
          icon={<Scissors size={20} />}
          title="PDF"
          description="Potong dan gabung berkas PDF dokumen kepabeanan tanpa aplikasi tambahan."
          items={[
            'Pisahkan halaman tertentu dari satu PDF (mis. lampiran per BC)',
            'Gabungkan beberapa PDF menjadi satu berkas berurutan',
            'Semua proses di browser; berkas tidak disimpan di server',
          ]}
        />
      </TabsContent>
      <TabsContent value="it-inventory" className="mt-4">
        <ItInventoryView />
      </TabsContent>
    </Tabs>
  )
}
