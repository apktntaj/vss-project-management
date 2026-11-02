'use client'

// Mengapa: UI hanya menampilkan tagihan job untuk pengguna yang memang boleh membacanya (admin atau
// peran dengan `job:invoice:read`, yakni FINANCE). Server tetap meredaksi data tagihan untuk peran
// lain; hook ini hanya menyembunyikan placeholder netral dari tampilan. Sumber kebenaran peran →
// capability tetap `capabilities.ts` (modul murni, aman di klien).

import { useSession } from 'next-auth/react'

import { can } from '@/features/auth/capabilities'

export function useCanSeeBilling(): boolean {
  const user = useSession().data?.user
  return Boolean(user && (user.isAdmin || (user.role && can(user.role, 'job:invoice:read'))))
}
