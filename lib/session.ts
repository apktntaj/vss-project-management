import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
export async function currentUser() { return getServerSession(authOptions) }
export async function requireUser() { const session = await currentUser(); if (!session?.user?.id) return null; return session.user }
export function unauthorized() { return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 }) }
export function forbidden() { return NextResponse.json({ error: 'Akses khusus Supervisor' }, { status: 403 }) }
