'use client'

import { useState, type FormEvent } from 'react'
import { Download, FileText, LoaderCircle } from 'lucide-react'
import { bc23ManualFields, type Bc23ManualField } from '@/domain/ceisa/bc23'
import { completeBc23Draft, type Bc23DraftResponse } from '@/lib/ceisa/bc23-draft'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Bc23CeisaReferences } from '@/components/ceisa/bc23-ceisa-references'

function notify(message: string, tone: 'info' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

function parseManualValue(field: Bc23ManualField, value: string): unknown {
  if (field.kind === 'number') {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new Error('Masukkan angka yang valid.')
    return parsed
  }
  if (field.kind === 'json') {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) throw new Error('Masukkan array JSON yang valid.')
    return parsed
  }
  return value.trim()
}

export function Bc23DraftDemo() {
  const [invoice, setInvoice] = useState<File | null>(null)
  const [transport, setTransport] = useState<File | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [transportError, setTransportError] = useState<string | null>(null)
  const [result, setResult] = useState<Bc23DraftResponse | null>(null)
  const [manualValues, setManualValues] = useState<Record<string, string>>({})
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextInvoiceError = invoice ? null : 'Commercial Invoice wajib dipilih.'
    const nextTransportError = transport ? null : 'B/L atau AWB wajib dipilih.'
    setInvoiceError(nextInvoiceError)
    setTransportError(nextTransportError)
    if (nextInvoiceError || nextTransportError) return

    const formData = new FormData()
    formData.set('invoice', invoice!)
    formData.set('transport', transport!)
    setSubmitting(true)
    try {
      const response = await fetch('/api/ceisa/bc-23/draft', { method: 'POST', body: formData })
      const payload = await response.json() as Bc23DraftResponse & { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Draft BC 2.3 tidak dapat dibuat.')
      setResult(payload)
      setManualValues({})
      setManualErrors({})
      notify('Draft BC 2.3 berhasil dibuat secara lokal.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Draft BC 2.3 tidak dapat dibuat.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function applyManualValues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!result) return
    const missingPaths = new Set(result.issues.filter((issue) => issue.code === 'REQUIRED_FIELD_MISSING').map((issue) => issue.path))
    const values: Record<string, unknown> = {}
    const errors: Record<string, string> = {}
    for (const field of bc23ManualFields.filter((candidate) => missingPaths.has(candidate.path))) {
      const value = manualValues[field.path] ?? ''
      if (!value.trim()) {
        errors[field.path] = `${field.label} wajib diisi.`
        continue
      }
      try {
        values[field.path] = parseManualValue(field, value)
      } catch (error) {
        errors[field.path] = error instanceof Error ? error.message : 'Nilai tidak valid.'
      }
    }
    setManualErrors(errors)
    if (Object.keys(errors).length) return
    setResult(completeBc23Draft(result, values))
    notify('Data manual diterapkan ke draft lokal.')
  }

  function downloadDraft() {
    if (!result) return
    const href = URL.createObjectURL(new Blob([JSON.stringify(result.draft, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = 'bc-23-draft.json'
    anchor.click()
    URL.revokeObjectURL(href)
  }

  const missingPaths = new Set(result?.issues.filter((issue) => issue.code === 'REQUIRED_FIELD_MISSING').map((issue) => issue.path) ?? [])
  const missingFields = bc23ManualFields.filter((field) => missingPaths.has(field.path))

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
    <header className="space-y-2">
      <p className="text-sm font-medium text-primary">Demo lokal · tidak mengirim ke CEISA</p>
      <h1 className="text-2xl font-semibold tracking-tight">Draft BC 2.3 dari dokumen sumber</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">Unggah Commercial Invoice dan B/L atau AWB. Sistem mengisi data yang tercetak, lalu operator melengkapi field wajib yang belum tersedia.</p>
    </header>

    <form onSubmit={submit} className="rounded-xl border bg-card p-5">
      <FieldGroup className="grid gap-5 md:grid-cols-2">
        <Field data-invalid={!!invoiceError}>
          <FieldLabel htmlFor="bc23-invoice">Commercial Invoice</FieldLabel>
          <Input id="bc23-invoice" type="file" accept="application/pdf,.xls,.xlsx,.xlsm,.xlsb,.xltx,.xltm" aria-invalid={!!invoiceError} onChange={(event) => { setInvoice(event.target.files?.[0] ?? null); setInvoiceError(null) }} />
          <FieldDescription>PDF atau Excel, maksimum 10 MB.</FieldDescription>
          {invoiceError && <FieldError>{invoiceError}</FieldError>}
        </Field>
        <Field data-invalid={!!transportError}>
          <FieldLabel htmlFor="bc23-transport">B/L atau AWB</FieldLabel>
          <Input id="bc23-transport" type="file" accept="application/pdf,.xls,.xlsx,.xlsm,.xlsb,.xltx,.xltm" aria-invalid={!!transportError} onChange={(event) => { setTransport(event.target.files?.[0] ?? null); setTransportError(null) }} />
          <FieldDescription>PDF atau Excel, maksimum 10 MB.</FieldDescription>
          {transportError && <FieldError>{transportError}</FieldError>}
        </Field>
      </FieldGroup>
      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}{submitting ? 'Membuat draft…' : 'Buat draft lokal'}</Button>
      </div>
    </form>

    {result && <section className="space-y-4 rounded-xl border bg-card p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Hasil draft</h2>
          <p className="text-sm text-muted-foreground">Schema BC 2.3 versi {result.schema.versionLabel} · status {result.draftStatus}</p>
        </div>
        <Button type="button" variant="outline" onClick={downloadDraft}><Download aria-hidden="true" />Unduh JSON</Button>
      </div>
      <Tabs defaultValue={missingFields.length ? 'complete' : 'issues'}>
        <TabsList>
          <TabsTrigger value="complete">Lengkapi ({missingFields.length})</TabsTrigger>
          <TabsTrigger value="issues">Issue ({result.issues.length})</TabsTrigger>
          <TabsTrigger value="draft">Draft JSON</TabsTrigger>
          <TabsTrigger value="sources">Dokumen sumber</TabsTrigger>
        </TabsList>
        <TabsContent value="complete" className="pt-4">
          {missingFields.length === 0 ? <p className="text-sm text-muted-foreground">Semua field wajib tingkat atas telah tersedia. Validasi CEISA tetap belum dilakukan.</p> : <form onSubmit={applyManualValues} className="space-y-5">
            <p className="text-sm text-muted-foreground">Nilai di bawah hanya hidup di browser sampai halaman ditutup atau draft baru dibuat. Kode referensi harus berasal dari sumber CEISA yang terverifikasi.</p>
            <FieldGroup className="grid gap-5 md:grid-cols-2">
              {missingFields.map((field) => <Field key={field.path} data-invalid={!!manualErrors[field.path]}>
                <FieldLabel htmlFor={`bc23-${field.path}`}>{field.label}</FieldLabel>
                {field.kind === 'json'
                  ? <Textarea id={`bc23-${field.path}`} value={manualValues[field.path] ?? ''} aria-invalid={!!manualErrors[field.path]} onChange={(event) => setManualValues((current) => ({ ...current, [field.path]: event.target.value }))} placeholder="[]" />
                  : <Input id={`bc23-${field.path}`} type={field.kind} value={manualValues[field.path] ?? ''} aria-invalid={!!manualErrors[field.path]} onChange={(event) => setManualValues((current) => ({ ...current, [field.path]: event.target.value }))} />}
                <FieldDescription>{field.description}</FieldDescription>
                {manualErrors[field.path] && <FieldError>{manualErrors[field.path]}</FieldError>}
              </Field>)}
            </FieldGroup>
            <Bc23CeisaReferences
              officeCode={manualValues.kodeKantor ?? String(result.draft.kodeKantor ?? '')}
              currencyCode={manualValues.kodeValuta ?? String(result.draft.kodeValuta ?? '')}
              onValue={(field, value) => setManualValues((current) => ({ ...current, [field]: value }))}
            />
            <Button type="submit">Terapkan ke draft lokal</Button>
          </form>}
        </TabsContent>
        <TabsContent value="issues" className="pt-4">
          {result.issues.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada issue lokal. Validasi dan pengiriman CEISA tetap tidak dilakukan pada demo ini.</p> : <Table>
            <TableHeader><TableRow><TableHead>Severity</TableHead><TableHead>Field</TableHead><TableHead>Kode</TableHead><TableHead>Pesan</TableHead></TableRow></TableHeader>
            <TableBody>{result.issues.map((issue, index) => <TableRow key={`${issue.code}-${issue.path}-${index}`}><TableCell>{issue.severity}</TableCell><TableCell>{issue.path}</TableCell><TableCell>{issue.code}</TableCell><TableCell className="whitespace-normal">{issue.message}</TableCell></TableRow>)}</TableBody>
          </Table>}
        </TabsContent>
        <TabsContent value="draft" className="pt-4"><pre className="max-h-[32rem] overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(result.draft, null, 2)}</pre></TabsContent>
        <TabsContent value="sources" className="pt-4"><pre className="max-h-[32rem] overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(result.sources, null, 2)}</pre></TabsContent>
      </Tabs>
    </section>}
  </div>
}
