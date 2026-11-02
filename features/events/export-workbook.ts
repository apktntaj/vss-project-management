import 'server-only'

// Perender daftar event (hasil filter yang sama dengan layar) menjadi file .xlsx satu sheet.
// Tanggal ditulis sebagai sel tanggal sungguhan (bukan teks) agar bisa disortir/difilter di Excel.

import ExcelJS from 'exceljs'

import type { EventListItem } from '@/domain/event/types'
import {
  DISPLAY_STATUS_LABEL,
  lifecycleBadge,
} from '@/features/events/components/event-presentation'

const DATE_FORMAT = 'dd mmm yyyy'

// ISO tanggal-saja → Date UTC tengah malam; null tetap kosong. UTC menghindari pergeseran hari
// akibat zona waktu pembaca file.
const toDate = (value: string | null): Date | null =>
  value ? new Date(`${value}T00:00:00Z`) : null

export async function renderEventsWorkbook(items: EventListItem[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Events', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Event', key: 'name', width: 40 },
    { header: 'Alias', key: 'alias', width: 20 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Mulai', key: 'startsOn', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Selesai', key: 'endsOn', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Move In', key: 'moveInOn', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Move Out', key: 'moveOutOn', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Venue', key: 'venue', width: 32 },
    { header: 'Event Organizer', key: 'organizer', width: 32 },
    { header: 'PIC', key: 'pic', width: 22 },
    { header: 'Jumlah Job', key: 'jobCount', width: 12 },
    { header: 'Job Belum Tuntas', key: 'unfinishedJobs', width: 18 },
  ]

  items.forEach((item, index) => {
    const lifecycle = lifecycleBadge(item.lifecycle)
    sheet.addRow({
      no: index + 1,
      name: item.name,
      alias: item.alias ?? '',
      // Lifecycle non-ACTIVE (Dibatalkan/Diarsipkan) menggantikan status tanggal, sama seperti
      // keadaan administratif yang menang atas status turunan.
      status: lifecycle?.label ?? DISPLAY_STATUS_LABEL[item.displayStatus],
      startsOn: toDate(item.startsOn),
      endsOn: toDate(item.endsOn),
      moveInOn: toDate(item.moveInOn),
      moveOutOn: toDate(item.moveOutOn),
      venue: item.venueName,
      organizer: item.eventOrganizerName,
      pic: item.picName,
      jobCount: item.jobCount,
      unfinishedJobs: item.unfinishedJobs,
    })
  })

  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }
  header.alignment = { vertical: 'middle' }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
