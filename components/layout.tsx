'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BriefcaseBusiness,
  CalendarDays,
  FolderKanban,
  Package,
} from 'lucide-react'
const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/general-cargo', label: 'General Cargo', icon: Package },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
]
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="min-h-screen md:flex">
      <aside className="flex w-full flex-col bg-black text-white/70 md:fixed md:inset-y-0 md:z-20 md:w-64">
        <div className="px-6 py-6">
          <p className="text-lg font-bold text-white">
            VSS <span className="text-orange-400">Projects</span>
          </p>
          <p className="mt-1 text-xs text-white/40">Operational control center</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active ? 'bg-orange-600 text-white shadow-lg shadow-orange-950/40' : 'hover:bg-blue-950 hover:text-white'}`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 md:ml-64">
        <div className="mx-auto max-w-[1440px] p-5 md:p-8">{children}</div>
      </main>
    </div>
  )
}
