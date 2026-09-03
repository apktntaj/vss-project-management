'use client'
export default function Error({reset}:{error:Error;reset:()=>void}){return <main className="grid min-h-screen place-items-center p-5 text-center"><div><h1 className="text-2xl font-bold">Terjadi gangguan</h1><p className="mt-2 text-slate-500">Silakan coba kembali.</p><button onClick={reset} className="btn-primary mt-5">Coba lagi</button></div></main>}
