'use client'

// Mengapa: leaf KLIEN untuk filter daftar event. Ia TIDAK memfilter di browser — perubahan filter
// ditulis ke URL search params lalu `router.replace(...)`, sehingga Server Component dashboard
// membaca ulang dan repository memfilter SEPENUHNYA sisi-server (Req 16.2/16.4). Ini menjaga agar
// filter tetap milik server (bukan membaca seluruh tabel ke browser lalu menyaring). Leaf ini tak
// mengimpor modul server-only apa pun.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

// Jeda sebelum ketikan pencarian ditulis ke URL. Tiap penulisan memicu render ulang server penuh,
// jadi satu render per jeda mengetik — bukan satu per huruf.
const SEARCH_DEBOUNCE_MS = 300

// Pilihan filter status yang diekspos ke UI. `all`/`active` memetakan ke filter lifecycle; sisanya
// ke display-status (turunan tanggal, diterjemahkan ke predikat tanggal oleh repository).
const STATUS_OPTIONS = [
  ['all', 'Semua'],
  ['active', 'Aktif'],
  ['soon', 'Akan datang'],
  ['ongoing', 'Berlangsung'],
  ['done', 'Selesai'],
] as const

type StatusValue = (typeof STATUS_OPTIONS)[number][0]

/**
 * Baris filter: kotak pencarian + radio status + pilih PIC + slot aksi di ujung kanan (mis. tombol
 * "Event baru"). Setiap perubahan filter menulis `search`/`status`/`pic` ke URL; RSC membaca ulang
 * params itu dan memfilter di server. Nilai saat ini dibaca dari `useSearchParams` agar kontrol
 * tetap sinkron dengan URL (mis. setelah refresh atau tautan langsung).
 */
export function EventFilters({
  children,
  pics,
}: {
  children?: ReactNode
  /** Opsi PIC untuk filter; bila undefined (master data gagal dimuat) kontrol disembunyikan. */
  pics?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentSearch = searchParams.get('search') ?? ''
  const currentStatus = (searchParams.get('status') as StatusValue | null) ?? 'all'
  const currentPic = searchParams.get('pic') ?? ''

  // Tulis pasangan key→value ke URL (null menghapus key), pertahankan param lain, lalu replace.
  const applyParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams],
  )

  // Nilai kotak dipegang lokal agar ketikan langsung tampil; URL baru ditulis setelah jeda.
  const [searchInput, setSearchInput] = useState(currentSearch)
  const debounceTimer = useRef<number | undefined>(undefined)
  // `applyParams` berganti tiap URL berubah; timer harus memakai versi terbaru agar tidak menimpa
  // perubahan filter lain yang terjadi selama jeda.
  const latestApplyParams = useRef(applyParams)
  latestApplyParams.current = applyParams
  useEffect(() => () => window.clearTimeout(debounceTimer.current), [])

  const changeSearch = (value: string) => {
    setSearchInput(value)
    window.clearTimeout(debounceTimer.current)
    debounceTimer.current = window.setTimeout(
      () => latestApplyParams.current({ search: value }),
      SEARCH_DEBOUNCE_MS,
    )
  }

  const hasFilters = currentSearch.length > 0 || currentStatus !== 'all' || currentPic !== ''

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative w-full lg:w-80 lg:flex-none">
          <span className="sr-only">Cari event</span>
          <Search
            className="absolute left-3 top-[7px] text-orange-500"
            size={14}
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(inputEvent) => changeSearch(inputEvent.target.value)}
            className="input m-0 pl-10 shadow-none focus-visible:outline-none"
            placeholder="Cari event..."
          />
        </label>
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 px-0 py-2">
          <legend className="sr-only">Filter status event</legend>
          {STATUS_OPTIONS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-500">
              <input
                type="radio"
                name="event-status"
                value={value}
                checked={currentStatus === value}
                onChange={() => applyParams({ status: value === 'all' ? null : value })}
                className="h-4 w-4 accent-orange-600"
              />
              {label}
            </label>
          ))}
        </fieldset>
        {pics ? (
          <select
            value={currentPic}
            onChange={(selectEvent) => applyParams({ pic: selectEvent.target.value || null })}
            className="input m-0 max-w-48 py-2 text-sm shadow-none focus-visible:outline-none"
            aria-label="Filter PIC"
          >
            <option value="">Semua PIC</option>
            {pics.map((pic) => (
              <option key={pic.id} value={pic.id}>
                {pic.name}
              </option>
            ))}
          </select>
        ) : null}
        {children ? <div className="flex-none lg:ml-auto">{children}</div> : null}
      </div>
      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            window.clearTimeout(debounceTimer.current)
            setSearchInput('')
            applyParams({ search: null, status: null, pic: null })
          }}
          className="mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800"
        >
          Reset filter
        </button>
      ) : null}
    </div>
  )
}
