// Konten overview dashboard (SERVER): special instruction per event → event belum ada job → ETA
// dekat dokumen kurang → ETA belum diisi → bobot event. Murni presentasi — seluruh daftar dihitung `lib/dashboard.ts`.

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { formatDayShort } from '@/features/events/components/event-presentation'
import {
  ARRIVAL_PLAN_HORIZON_DAYS,
  ETA_HORIZON_DAYS,
  type OperationsDashboard,
} from '@/lib/dashboard'

const TH = 'whitespace-nowrap border-b border-border px-3 py-2.5 font-semibold'
const TD = 'px-3 py-3 align-middle'
const ROW = 'border-b border-border/60 last:border-0'

function SectionHeader({ title, hint, count }: { title: string; hint: string; count: number }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ring-border">
          {count}
        </span>
      </div>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </>
  )
}

function EventCell({
  eventId,
  name,
  venueName,
}: {
  eventId: string
  name: string
  venueName: string
}) {
  return (
    <>
      <Link
        href={`/events/${eventId}`}
        className="font-medium transition-colors hover:text-foreground"
        title={name}
      >
        <span className="block max-w-[220px] truncate sm:max-w-[280px]">{name}</span>
      </Link>
      <span
        className="mt-0.5 block max-w-[220px] truncate text-xs text-muted-foreground sm:max-w-[280px]"
        title={venueName}
      >
        {venueName || 'Venue belum diinput'}
      </span>
    </>
  )
}

function JobEventCells({
  jobId,
  jobTitle,
  eventId,
  eventName,
}: {
  jobId: string
  jobTitle: string
  eventId: string
  eventName: string
}) {
  return (
    <>
      <td className={TD}>
        <Link
          href={`/jobs/${jobId}`}
          className="font-medium transition-colors hover:text-foreground"
          title={jobTitle}
        >
          <span className="block max-w-[220px] truncate sm:max-w-[320px]">{jobTitle}</span>
        </Link>
      </td>
      <td className={TD}>
        <Link
          href={`/events/${eventId}`}
          className="transition-colors hover:text-foreground"
          title={eventName}
        >
          <span className="block max-w-[180px] truncate sm:max-w-[240px]">{eventName}</span>
        </Link>
      </td>
    </>
  )
}

export function DashboardOverview({
  today,
  operations,
}: {
  today: string
  operations: OperationsDashboard
}) {
  const { eventsWithoutJob, etaDocsMissing, etaMissing, eventWeights, specialInstructions } = operations
  const instructionCount = specialInstructions.reduce((sum, group) => sum + group.jobs.length, 0)

  return (
    <>
      <section
        id="special-instructions"
        className="card p-5 sm:p-6"
        aria-label="Special instructions"
      >
        <SectionHeader
          title="Special instructions"
          hint="Permintaan khusus klien pada job yang belum selesai, dikelompokkan per event."
          count={instructionCount}
        />
        {specialInstructions.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Tidak ada special instruction pada job aktif.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {specialInstructions.map((group) => (
              <div key={group.eventId}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    href={`/events/${group.eventId}`}
                    className="font-semibold transition-colors hover:text-foreground"
                  >
                    {group.eventName}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {[group.venueName, group.startsOn ? formatDayShort(group.startsOn) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {group.jobs.map((job) => (
                    <li
                      key={job.jobId}
                      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                    >
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                      <div className="min-w-0">
                        <Link
                          href={`/jobs/${job.jobId}`}
                          className="block truncate text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                          title={job.jobTitle}
                        >
                          {job.jobTitle}
                        </Link>
                        <p className="whitespace-pre-wrap font-medium text-slate-800">{job.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="event-tanpa-job" className="card p-5 sm:p-6" aria-label="Event belum ada job">
        <SectionHeader
          title="Event belum ada job"
          hint={`Mulai dalam ${ARRIVAL_PLAN_HORIZON_DAYS} hari tanpa satu pun job tercatat.`}
          count={eventsWithoutJob.length}
        />
        {eventsWithoutJob.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Semua event yang mulai dalam {ARRIVAL_PLAN_HORIZON_DAYS} hari sudah punya job.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className={TH}>Pameran</th>
                  <th className={TH}>Mulai</th>
                  <th className={TH}>Tenggat tiba</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {eventsWithoutJob.map((row) => (
                  <tr key={row.eventId} className={ROW}>
                    <td className={TD}>
                      <EventCell
                        eventId={row.eventId}
                        name={row.eventName}
                        venueName={row.venueName}
                      />
                    </td>
                    <td className={`${TD} whitespace-nowrap tabular-nums text-muted-foreground`}>
                      {formatDayShort(row.startsOn)}
                    </td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>
                      {formatDayShort(row.arrivalDeadline)}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {row.daysToDeadline < 0 ? (
                        <span className="-mx-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 font-medium tabular-nums text-destructive ring-1 ring-inset ring-border">
                          lewat {-row.daysToDeadline} hari
                        </span>
                      ) : row.daysToDeadline === 0 ? (
                        <span className="-mx-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 font-medium tabular-nums text-destructive ring-1 ring-inset ring-border">
                          hari ini
                        </span>
                      ) : (
                        <span className="tabular-nums text-muted-foreground">
                          {row.daysToDeadline} hari lagi
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        id="eta-dokumen"
        className="card p-5 sm:p-6"
        aria-label="ETA dekat, dokumen belum lengkap"
      >
        <SectionHeader
          title="ETA dekat, dokumen belum lengkap"
          hint={`ETA dalam ${ETA_HORIZON_DAYS} hari (atau sudah lewat selagi pameran belum selesai) tanpa CIPL lengkap atau nomor B/L·AWB.`}
          count={etaDocsMissing.length}
        />
        {etaDocsMissing.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Tidak ada job dengan ETA dekat yang dokumennya kurang.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className={TH}>Job</th>
                  <th className={TH}>Event</th>
                  <th className={TH}>ETA</th>
                  <th className={TH}>Kekurangan</th>
                </tr>
              </thead>
              <tbody>
                {etaDocsMissing.map((row) => (
                  <tr key={row.jobId} className={ROW}>
                    <JobEventCells
                      jobId={row.jobId}
                      jobTitle={row.jobTitle}
                      eventId={row.eventId}
                      eventName={row.eventName}
                    />
                    <td className={`${TD} whitespace-nowrap`}>
                      <span
                        className={
                          row.eta < today
                            ? '-mx-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 font-medium tabular-nums text-destructive ring-1 ring-inset ring-border'
                            : 'tabular-nums'
                        }
                      >
                        {formatDayShort(row.eta)}
                      </span>
                    </td>
                    <td className={`${TD} min-w-48`}>{row.missing.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="eta-kosong" className="card p-5 sm:p-6" aria-label="ETA belum diisi">
        <SectionHeader
          title="ETA belum diisi"
          hint="Job aktif pada pameran yang belum selesai tanpa tanggal ETA."
          count={etaMissing.length}
        />
        {etaMissing.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Semua job aktif sudah punya ETA.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className={TH}>Job</th>
                  <th className={TH}>Event</th>
                  <th className={TH}>Tenggat tiba</th>
                </tr>
              </thead>
              <tbody>
                {etaMissing.map((row) => (
                  <tr key={row.jobId} className={ROW}>
                    <JobEventCells
                      jobId={row.jobId}
                      jobTitle={row.jobTitle}
                      eventId={row.eventId}
                      eventName={row.eventName}
                    />
                    <td className={`${TD} whitespace-nowrap`}>
                      {row.arrivalDeadline === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={
                            row.arrivalDeadline < today
                              ? '-mx-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 font-medium tabular-nums text-destructive ring-1 ring-inset ring-border'
                              : 'tabular-nums'
                          }
                        >
                          {formatDayShort(row.arrivalDeadline)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="bobot-event" className="card p-5 sm:p-6" aria-label="Bobot event">
        <SectionHeader
          title="Bobot event"
          hint={`Skor = jumlah job + total koli, untuk pameran yang belum selesai dan mulai dalam ${ARRIVAL_PLAN_HORIZON_DAYS} hari.`}
          count={eventWeights.length}
        />
        {eventWeights.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Tidak ada pameran dalam {ARRIVAL_PLAN_HORIZON_DAYS} hari.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className={TH}>Pameran</th>
                  <th className={TH}>Mulai</th>
                  <th className={`${TH} text-right`}>Job</th>
                  <th className={`${TH} text-right`}>Koli</th>
                  <th className={`${TH} text-right`}>Skor</th>
                </tr>
              </thead>
              <tbody>
                {eventWeights.map((row) => (
                  <tr key={row.eventId} className={ROW}>
                    <td className={TD}>
                      <EventCell
                        eventId={row.eventId}
                        name={row.eventName}
                        venueName={row.venueName}
                      />
                    </td>
                    <td className={`${TD} whitespace-nowrap tabular-nums text-muted-foreground`}>
                      {formatDayShort(row.startsOn)}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{row.jobCount}</td>
                    <td className={`${TD} text-right tabular-nums`}>{row.koliCount}</td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
