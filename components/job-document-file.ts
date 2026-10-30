const spreadsheetExtensions = ['xls', 'xlsx', 'xlsm', 'xlsb', 'xltx', 'xltm']

export const jobDocumentAccept =
  'application/pdf,.pdf,application/vnd.ms-excel,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel.sheet.macroEnabled.12,.xlsm,application/vnd.ms-excel.sheet.binary.macroEnabled.12,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.template,.xltx,application/vnd.ms-excel.template.macroEnabled.12,.xltm'

const fileExtension = (file: File) => file.name.split('.').pop()?.toLowerCase()
const isPdf = (file: File) => file.type === 'application/pdf' || fileExtension(file) === 'pdf'

export const isAcceptedJobDocument = (file: File) =>
  isPdf(file) || spreadsheetExtensions.includes(fileExtension(file) || '')
