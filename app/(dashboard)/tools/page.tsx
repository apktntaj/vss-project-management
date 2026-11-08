import { ToolsWorkspace } from '@/components/tools-workspace'

export const metadata = { title: 'Tools | VSS' }

export default function ToolsPage({ searchParams }: { searchParams: { tab?: string } }) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Alat kerja PPJK
        </p>
        <h1 className="mt-1 text-2xl font-bold">Tools</h1>
        <p className="mt-1 text-sm text-slate-500">
          Alat bantu harian di luar alur job: cek LARTAS, hitung CBM, analitik Excel, olah PDF, dan pembukuan IT Inventory.
        </p>
      </header>
      <ToolsWorkspace initialTab={searchParams.tab} />
    </div>
  )
}
