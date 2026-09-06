'use client'
import { useState } from 'react'
export function JobDetailActions({token}:{id:string;token:string}){const [value]=useState(token);return <div className="rounded-lg bg-blue-50 p-4"><p className="text-sm font-medium text-blue-900">Token tracking lokal</p><p className="mt-2 break-all text-xs text-blue-800">{value}</p><p className="mt-2 text-xs text-slate-500">Data hanya tersedia pada browser ini.</p></div>}
