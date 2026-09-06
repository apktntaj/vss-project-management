import type { LocalEvent } from '@/lib/indexeddb'

const DAY = 24 * 60 * 60 * 1000

function calendarDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatEventDateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sept', 'Okt', 'Nov', 'Des']
  const fullDate = (date: Date) => `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} - ${fullDate(end)}`
  }

  return `${fullDate(start)} - ${fullDate(end)}`
}

function getGanttRange(events: LocalEvent[]) {
  if (!events.length) {
    const today = new Date()
    return { start: today, totalDays: 7, totalWeeks: 1 }
  }

  const operationalStart = events.reduce(
    (earliest, event) => Math.min(earliest, new Date(event.createdAt).getTime()),
    new Date(events[0].createdAt).getTime(),
  )
  const operationalEnd = events.reduce(
    (latest, event) => Math.max(latest, addDays(new Date(event.endsAt), 3).getTime()),
    addDays(new Date(events[0].endsAt), 3).getTime(),
  )
  const start = new Date(operationalStart)
  const daysSinceMonday = start.getDay() === 0 ? 6 : start.getDay() - 1
  start.setDate(start.getDate() - daysSinceMonday)
  const end = new Date(operationalEnd)
  end.setDate(end.getDate() + (end.getDay() === 0 ? 0 : 7 - end.getDay()))
  const totalDays = Math.max(7, Math.floor((calendarDay(end) - calendarDay(start)) / DAY) + 1)

  return { start, totalDays, totalWeeks: Math.ceil(totalDays / 7) }
}

function getBarStyle(startDate: Date, endDate: Date, ganttStart: Date, totalDays: number) {
  const start = calendarDay(startDate)
  const end = calendarDay(endDate)
  const timelineStart = calendarDay(ganttStart)

  return {
    left: `${Math.max(0, ((start - timelineStart) / (totalDays * DAY)) * 100)}%`,
    width: `${Math.max(8, (((end - start) / (totalDays * DAY)) * 100) + 4)}%`,
  }
}

function getEventSegmentStyle(event: LocalEvent) {
  const operationalStart = calendarDay(new Date(event.createdAt))
  const operationalEnd = calendarDay(addDays(new Date(event.endsAt), 3))
  const eventStart = calendarDay(new Date(event.startsAt))
  const eventEnd = calendarDay(new Date(event.endsAt))
  const operationalDays = Math.max(1, operationalEnd - operationalStart)

  return {
    left: `${((eventStart - operationalStart) / operationalDays) * 100}%`,
    width: `${Math.max(8, ((eventEnd - eventStart) / operationalDays) * 100)}%`,
  }
}

function getOverlapDays(left: LocalEvent, right: LocalEvent) {
  const startsAt = Math.max(calendarDay(new Date(left.startsAt)), calendarDay(new Date(right.startsAt)))
  const endsAt = Math.min(calendarDay(new Date(left.endsAt)), calendarDay(new Date(right.endsAt)))
  return endsAt >= startsAt ? Math.floor((endsAt - startsAt) / DAY) + 1 : 0
}

function getOverlaps(events: LocalEvent[]) {
  const overlaps: Array<{ left: LocalEvent; right: LocalEvent; days: number }> = []
  for (let left = 0; left < events.length; left += 1) {
    for (let right = left + 1; right < events.length; right += 1) {
      const days = getOverlapDays(events[left], events[right])
      if (days > 0) overlaps.push({ left: events[left], right: events[right], days })
    }
  }
  return overlaps
}

export function EventTimeline({ events }: { events: LocalEvent[] }) {
  const overlaps = getOverlaps(events)
  if (!events.length) {
    return <section className="card p-5 sm:p-6"><p className="text-sm text-slate-500">Belum ada event untuk ditampilkan.</p></section>
  }

  const ganttRange = getGanttRange(events)
  const labels = Array.from(
    { length: ganttRange.totalWeeks },
    (_, index) => new Date(ganttRange.start.getTime() + index * 7 * DAY),
  )

  return (
    <section className="card p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Event timeline</h2>
        <p className="mt-1 text-sm text-slate-500">
          Periode kerja dimulai dari init event hingga tiga hari setelah event selesai.
        </p>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> On going</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Soon</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Done</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-200" /> Preparation &amp; follow-up</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="mb-3 grid grid-cols-[180px_minmax(0,1fr)] items-center gap-4">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Event</div>
            <div className="grid gap-2 text-center text-[10px] font-medium text-slate-500" style={{ gridTemplateColumns: `repeat(${ganttRange.totalWeeks}, minmax(0, 1fr))` }}>
              {labels.map((date) => <div key={date.toISOString()}>{date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</div>)}
            </div>
          </div>
          {events.map((event) => {
            const status = new Date() < new Date(event.startsAt) ? 'soon' : new Date() > new Date(event.endsAt) ? 'done' : 'ongoing'
            const colorClass = status === 'done' ? 'bg-emerald-500' : status === 'soon' ? 'bg-blue-500' : 'bg-orange-500'
            const softColorClass = status === 'done' ? 'bg-emerald-100' : status === 'soon' ? 'bg-blue-100' : 'bg-orange-100'
            const operationalStyle = getBarStyle(new Date(event.createdAt), addDays(new Date(event.endsAt), 3), ganttRange.start, ganttRange.totalDays)

            return (
              <div key={event.id} className="mb-3 grid grid-cols-[180px_minmax(0,1fr)] items-center gap-4">
                <p className="truncate pr-2 text-sm font-medium text-slate-700">{event.officialName}</p>
                <div className="relative h-10 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="absolute inset-0 grid opacity-60" style={{ gridTemplateColumns: `repeat(${ganttRange.totalWeeks}, minmax(0, 1fr))` }}>
                    {labels.map((date) => <div key={`${event.id}-${date.toISOString()}`} className="border-r border-slate-200 last:border-r-0" />)}
                  </div>
                  <div className={`absolute inset-y-1.5 rounded-lg ${softColorClass}`} style={operationalStyle} title={`${event.officialName}: ${formatEventDateRange(event.createdAt, addDays(new Date(event.endsAt), 3).toISOString())}`}>
                    <div className={`absolute inset-y-0 flex items-center rounded-lg ${colorClass} shadow-sm`} style={getEventSegmentStyle(event)} title={`Event berlangsung: ${formatEventDateRange(event.startsAt, event.endsAt)}`}>
                      <span className="ml-2 truncate text-[10px] font-semibold text-white">{event.officialName}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {overlaps.length > 0 && (
        <div className="mt-5 border-t pt-4">
          <h3 className="text-sm font-semibold text-slate-800">Overlap antar-event</h3>
          <div className="mt-2 space-y-2 text-sm text-slate-600">
            {overlaps.map(({ left, right, days }) => <p key={`${left.id}-${right.id}`}><span className="font-medium">{left.officialName}</span>{' dan '}<span className="font-medium">{right.officialName}</span>{` tumpang tindih ${days} hari.`}</p>)}
          </div>
        </div>
      )}
    </section>
  )
}
