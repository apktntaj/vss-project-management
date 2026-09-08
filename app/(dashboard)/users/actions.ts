'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { addDemoUser } from '@/lib/demo-users'

export type AddUserState = { error: string | null; success: string | null }

export async function addUserAction(
  _state: AddUserState,
  formData: FormData,
): Promise<AddUserState> {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return { error: 'Hanya admin yang dapat menambah user.', success: null }
  }

  const result = addDemoUser({
    nama: formData.get('nama'),
    email: formData.get('email'),
    password: formData.get('password'),
    isAdmin: formData.get('isAdmin') === 'on',
  })
  if (!result.ok) return { error: result.error, success: null }

  revalidatePath('/users')
  return { error: null, success: `${result.user.nama} berhasil ditambahkan.` }
}
