import './globals.css'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: { default: 'VSS Project Management', template: '%s | VSS' }, description: 'Operational project, task, resource, cargo, and customs control' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body>{children}</body></html> }
