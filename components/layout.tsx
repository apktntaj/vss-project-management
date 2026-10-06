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
  FolderKanban,
  LogOut,
  Package,
  Settings,
  Menu,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { logoutAction } from '@/app/(dashboard)/actions'
const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/kanban', label: 'Tickets', icon: FolderKanban },
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem('vss-sidebar-collapsed') === 'true')
    } catch {
      /* Storage may be unavailable. */
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])
  useEffect(() => {
    const receiveToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: unknown; tone?: unknown }>).detail
      if (
        !detail ||
        typeof detail.message !== 'string' ||
        (detail.tone !== 'success' && detail.tone !== 'error')
      ) {
        return
      }
      setToast({ message: detail.message, tone: detail.tone })
    }
    window.addEventListener('vss:toast', receiveToast)
    return () => window.removeEventListener('vss:toast', receiveToast)
  }, [])

  function toggleSidebar() {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem('vss-sidebar-collapsed', String(!value))
      } catch {
        /* Keep navigation usable without storage. */
      }
      return !value
    })
  }

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  return (
    <div className="min-h-screen md:flex">
      <a href="#main-content" className="skip-link">
        Lewati ke konten utama
      </a>
      <aside
        aria-label="Navigasi utama"
        className={cn(
          'hidden flex-col overflow-y-auto bg-slate-900 text-white/70 transition-[width] duration-200 md:fixed md:inset-y-0 md:z-20 md:flex',
          collapsed ? 'md:w-20' : 'md:w-64',
        )}
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
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Kembangkan sidebar' : 'Ciutkan sidebar'}
            aria-expanded={!collapsed}
            className="hidden shrink-0 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white md:inline-flex"
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
        {!collapsed && (
          <p className="px-6 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Workspace
          </p>
        )}
        <nav className="flex flex-col gap-1 px-3 pb-3">
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
                aria-current={active ? 'page' : undefined}
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
        id="main-content"
        tabIndex={-1}
        className={`min-w-0 flex-1 transition-[margin] duration-200 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}
      >
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-white px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
              <DialogTrigger
                render={<Button variant="outline" size="icon" className="md:hidden" />}
                aria-label="Buka menu navigasi"
              >
                <Menu />
              </DialogTrigger>
              <DialogContent className="max-h-[85dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>VSS Projects</DialogTitle>
                  <DialogDescription>Navigasi workspace operasional</DialogDescription>
                </DialogHeader>
                <nav aria-label="Navigasi mobile" className="flex flex-col gap-1">
                  {links
                    .filter((link) => link.available !== false)
                    .map(({ href, label, icon: Icon }) => {
                      const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'workspace-nav',
                            active ? 'workspace-nav-active' : 'workspace-nav-idle',
                          )}
                        >
                          <Icon size={18} />
                          {label}
                        </Link>
                      )
                    })}
                  {user.isAdmin && (
                    <Link
                      href="/settings"
                      onClick={() => setMobileOpen(false)}
                      className="workspace-nav workspace-nav-idle"
                    >
                      <Settings size={18} />
                      Settings
                    </Link>
                  )}
                </nav>
                <p className="truncate text-sm text-muted-foreground">{user.name ?? 'Pengguna'}</p>
                <form action={logoutAction}>
                  <Button type="submit" variant="ghost">
                    <LogOut data-icon="inline-start" />
                    Keluar
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <span className="hidden text-sm text-muted-foreground sm:inline">Workspace</span>
            <ChevronRight size={14} className="hidden text-muted-foreground sm:block" />
            <span className="truncate text-sm font-semibold">
              {links.find((link) =>
                link.href === '/' ? pathname === '/' : pathname.startsWith(link.href),
              )?.label ?? (pathname.startsWith('/settings') ? 'Settings' : 'Detail operasional')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-slate-700 lg:inline">
              {user.name ?? 'Pengguna'}
            </span>
            <span
              title={user.name ?? 'Pengguna'}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-semibold text-white"
            >
              {(user.name ?? 'VSS')
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </span>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] p-4 py-7 sm:p-6 md:p-8 lg:p-10">{children}</div>
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
