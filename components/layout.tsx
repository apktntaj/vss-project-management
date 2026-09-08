'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  BriefcaseBusiness,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  FolderKanban,
  Package,
} from 'lucide-react'
const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/general-cargo', label: 'General Cargo', icon: Package, available: false },
  { href: '/projects', label: 'Projects', icon: FolderKanban, available: false },
]
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
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
                    className={`rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300 ${collapsed ? 'md:hidden' : ''}`}
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
      </aside>
      <main
        className={`min-w-0 flex-1 transition-[margin] duration-200 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}
      >
        <div className="mx-auto max-w-[1440px] p-5 md:p-8">{children}</div>
      </main>
    </div>
  )
}
