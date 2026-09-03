export default function Loading() {
  return <div className="space-y-5 animate-pulse"><div className="h-8 w-64 rounded bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-white shadow-sm" />)}</div><div className="h-96 rounded-2xl bg-white shadow-sm" /></div>
}
