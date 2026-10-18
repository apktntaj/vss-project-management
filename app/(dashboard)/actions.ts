'use server'

import { signOut } from '@/features/auth'

export async function logoutAction() {
  await signOut({ redirectTo: '/login' })
}
