import { currentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import { UserForm } from '@/components/user-form'
export default async function NewUser(){const session=await currentUser();if(session?.user.role!=='SUPERVISOR')redirect('/');return <><div className="mb-7"><h1 className="text-2xl font-bold">Tambah pengguna</h1><p className="mt-1 text-sm text-slate-500">Buat akun baru untuk tim operasional.</p></div><UserForm/></>}
