'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  BriefcaseBusiness,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Database,
  FolderKanban,
  LogOut,
  Package,
  Settings,
} from 'lucide-react'
import { logoutAction } from '@/app/(dashboard)/actions'
import { getDemoDataMode, setDemoDataMode } from '@/lib/data-client'
const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/kanban', label: 'Ticket Saya', icon: FolderKanban },
  { href: '/general-cargo', label: 'General Cargo', icon: Package, available: false },
  { href: '/projects', label: 'Projects', icon: FolderKanban, available: false },
]
export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: { name?: string | null; email?: string | null; isAdmin: boolean }
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [demoMode, setDemoMode] = useState<'EMPTY' | 'MOCK'>('EMPTY')
  const [changingDemoMode, setChangingDemoMode] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)

  useEffect(() => {
    getDemoDataMode().then(setDemoMode)
    const pendingToast = window.sessionStorage.getItem('vss-demo-data-toast')
    if (!pendingToast) return
    window.sessionStorage.removeItem('vss-demo-data-toast')
    setToast({ message: pendingToast, tone: 'success' })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  async function toggleDemoMode() {
    const nextMode = demoMode === 'MOCK' ? 'EMPTY' : 'MOCK'
    setChangingDemoMode(true)
    try {
      await setDemoDataMode(nextMode)
      window.sessionStorage.setItem(
        'vss-demo-data-toast',
        nextMode === 'MOCK' ? 'Data mock dimuat.' : 'Data demo dikosongkan.',
      )
      window.location.reload()
    } catch {
      setToast({ message: 'Mode data tidak dapat diubah.', tone: 'error' })
      setChangingDemoMode(false)
    }
  }
  return (
    <div className="min-h-screen md:flex">
      <aside
        className={`flex w-full flex-col bg-slate-800 text-white/70 transition-[width] duration-200 md:fixed md:inset-y-0 md:z-20 ${collapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        <div
          className={`flex items-start gap-3 py-6 ${collapsed ? 'justify-center px-4' : 'justify-between px-6'}`}
        >
          <div className={`min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
            <p className="text-lg font-bold text-white">
              VSS <span className="text-orange-400">Projects</span>
            </p>
            <p className="mt-1 text-xs text-white/40">Operational control center</p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Kembangkan sidebar' : 'Ciutkan sidebar'}
            aria-expanded={!collapsed}
            className="hidden shrink-0 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white md:inline-flex"
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1">
          {links.map(({ href, label, icon: Icon, available = true }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            const content = (
              <>
                <Icon size={18} />
                <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
                {!available && (
                  <span
                    className={`rounded-full bg-orange-200 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-orange-900 ${collapsed ? 'md:hidden' : ''}`}
                  >
                    Soon
                  </span>
                )}
              </>
            )
            if (!available) {
              return (
                <span
                  key={href}
                  aria-disabled="true"
                  title={`${label} segera hadir`}
                  className={`flex shrink-0 cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/35 ${collapsed ? 'md:justify-center' : ''}`}
                >
                  {content}
                </span>
              )
            }
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${collapsed ? 'md:justify-center' : ''} ${active ? 'bg-orange-600 text-white shadow-lg shadow-orange-950/40' : 'hover:bg-slate-700 hover:text-white'}`}
              >
                {content}
              </Link>
            )
          })}
        </nav>
        <div
          className={`mt-auto border-t border-white/10 p-3 ${collapsed ? 'md:text-center' : ''}`}
        >
          <button
            type="button"
            role="switch"
            aria-checked={demoMode === 'MOCK'}
            aria-label="Ganti mode data demo"
            title={collapsed ? `Data ${demoMode === 'MOCK' ? 'mock' : 'kosong'}` : undefined}
            disabled={changingDemoMode}
            onClick={toggleDemoMode}
            className={`mb-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition hover:bg-slate-700 hover:text-white disabled:cursor-wait disabled:opacity-60 ${collapsed ? 'md:justify-center' : ''}`}
          >
            <Database size={18} />
            <span className={`flex min-w-0 flex-1 items-center justify-between gap-2 ${collapsed ? 'md:hidden' : ''}`}>
              <span>
                <span className="block text-white">Data demo</span>
                <span className="block text-xs text-white/45">{demoMode === 'MOCK' ? 'Mock lengkap' : 'Kosong'}</span>
              </span>
              <span
                aria-hidden="true"
                className={`relative h-5 w-9 rounded-full transition ${demoMode === 'MOCK' ? 'bg-orange-500' : 'bg-white/20'}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${demoMode === 'MOCK' ? 'left-[18px]' : 'left-0.5'}`}
                />
              </span>
            </span>
          </button>
          {user.isAdmin && (
            <Link
              href="/settings"
              title={collapsed ? 'Settings' : undefined}
              className={`mb-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${collapsed ? 'md:justify-center' : ''} ${pathname.startsWith('/settings') ? 'bg-orange-600 text-white shadow-lg shadow-orange-950/40' : 'hover:bg-slate-700 hover:text-white'}`}
            >
              <Settings size={18} />
              <span className={collapsed ? 'md:hidden' : ''}>Settings</span>
            </Link>
          )}
          <div className={`mb-3 min-w-0 px-3 ${collapsed ? 'md:hidden' : ''}`}>
            <p className="truncate text-sm font-semibold text-white">
              {user.name ?? 'Pengguna demo'}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title={collapsed ? 'Keluar' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-700 hover:text-white ${collapsed ? 'md:justify-center' : ''}`}
            >
              <LogOut size={18} />
              <span className={collapsed ? 'md:hidden' : ''}>Keluar</span>
            </button>
          </form>
        </div>
      </aside>
      <main
        className={`min-w-0 flex-1 transition-[margin] duration-200 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}
      >
        <div className="mx-auto max-w-[1440px] p-5 md:p-8">{children}</div>
      </main>
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
