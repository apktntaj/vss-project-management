'use client'

// Mengapa: tagihan job terbaca oleh semua peran; hook ini hanya menentukan boleh/tidaknya MENGEDIT
// tagihan (admin atau peran dengan `job:invoice:write`, yakni FINANCE). Server tetap menjadi penjaga
// tulis (`saveJobInvoice`). Sumber kebenaran peran → capability tetap `capabilities.ts` (modul murni,
// aman di klien).

import { useSession } from 'next-auth/react'

import { can } from '@/features/auth/capabilities'

export function useCanEditBilling(): boolean {
  const user = useSession().data?.user
  return Boolean(user && (user.isAdmin || (user.role && can(user.role, 'job:invoice:write'))))
}
