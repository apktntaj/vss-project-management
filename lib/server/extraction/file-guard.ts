import 'server-only'

import { MAX_DOCUMENT_SIZE } from './config'
import { DocumentExtractionError } from './errors'

const spreadsheetExtensions = new Set(['xls', 'xlsx', 'xlsm', 'xlsb', 'xltx', 'xltm'])

function extension(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

export function isPdf(file: File) {
  return file.type === 'application/pdf' || extension(file) === 'pdf'
}

export function isSpreadsheet(file: File) {
  return (
    spreadsheetExtensions.has(extension(file)) ||
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}

export function assertSupportedDocumentFile(file: File): void {
  if (!isPdf(file) && !isSpreadsheet(file)) {
    throw new DocumentExtractionError('File harus berupa PDF atau Excel.', 400, 'UNSUPPORTED_FILE_TYPE')
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new DocumentExtractionError('Ukuran dokumen melebihi batas 10 MB.', 413, 'FILE_TOO_LARGE')
  }
}
