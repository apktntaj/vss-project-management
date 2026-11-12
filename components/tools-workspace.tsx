'use client'

import { useState } from 'react'
import { BookOpenText, Calculator, FileSearch, Scissors, ShieldCheck } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ItInventoryView } from '@/components/it-inventory/it-inventory-view'
import { ToolsCbmCalculator } from '@/components/tools-cbm-calculator'
import { ToolsHsBtki } from '@/components/tools-hs-btki'
import { ToolsLartasChecker } from '@/components/tools-lartas-checker'
import { ToolsPdf } from '@/components/tools-pdf'

// Alat bantu operasional PPJK: Cek LARTAS, Kalkulator CBM, HS BTKI, PDF, dan IT Inventory.

const tabs = [
  { value: 'lartas', label: 'Cek LARTAS', icon: ShieldCheck },
  { value: 'cbm', label: 'Kalkulator CBM', icon: Calculator },
  { value: 'hs-btki', label: 'BTKI-in', icon: FileSearch },
  { value: 'pdf', label: 'PDF', icon: Scissors },
  { value: 'it-inventory', label: 'IT Inventory', icon: BookOpenText },
] as const

type ToolsTab = (typeof tabs)[number]['value']

function tabFrom(value: string | undefined): ToolsTab {
  return tabs.some((tab) => tab.value === value) ? (value as ToolsTab) : 'lartas'
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
        <ToolsCbmCalculator />
      </TabsContent>
      <TabsContent value="hs-btki" className="mt-4">
        <ToolsHsBtki />
      </TabsContent>
      <TabsContent value="pdf" className="mt-4">
        <ToolsPdf />
      </TabsContent>
      <TabsContent value="it-inventory" className="mt-4">
        <ItInventoryView />
      </TabsContent>
    </Tabs>
  )
}
