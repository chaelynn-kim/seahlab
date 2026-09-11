import type { CheckItem, CheckResult, InspectionRecord } from '../types'
import { resolveInputKind } from './inputKind'
import { createId, readJson, writeJson } from './storage'

const KEY = 'inspections'

export type InspectionDraft = Omit<InspectionRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
}

export function loadInspections(): InspectionRecord[] {
  return readJson<InspectionRecord[]>(KEY, [])
}

export function saveInspections(records: InspectionRecord[]): void {
  writeJson(KEY, records)
}

export function inspectionContentKey(record: InspectionRecord): string {
  return JSON.stringify({
    id: record.id,
    equipmentId: record.equipmentId,
    date: record.date,
    inspector: record.inspector.name,
    results: record.results,
    readings: record.readings ?? {},
    issueNote: record.issueNote,
    requestDate: record.requestDate,
    confirmDate: record.confirmDate,
  })
}

export function inspectionsContentEqual(
  left: InspectionRecord[],
  right: InspectionRecord[],
): boolean {
  if (left.length !== right.length) return false
  const rightKeys = new Set(right.map(inspectionContentKey))
  return left.every((record) => rightKeys.has(inspectionContentKey(record)))
}

export function findInspection(
  records: InspectionRecord[],
  equipmentId: string,
  date: string,
): InspectionRecord | undefined {
  return records.find((item) => item.equipmentId === equipmentId && item.date === date)
}

export function latestInspectorName(records: Iterable<InspectionRecord>): string {
  let latest: InspectionRecord | undefined
  for (const record of records) {
    if (!latest || record.updatedAt > latest.updatedAt) latest = record
  }
  return latest?.inspector.name.trim() ?? ''
}

export function itemKey(no: number): string {
  return String(no)
}

export function blankResults(nos: number[]): Record<string, CheckResult> {
  return Object.fromEntries(nos.map((no) => [itemKey(no), '' as CheckResult]))
}

export function nextMark(current: CheckResult): CheckResult {
  if (current === '') return 'O'
  if (current === 'O') return 'X'
  if (current === 'X') return '휴'
  return ''
}

export function isRecordedMark(value: CheckResult | undefined): boolean {
  return value === 'O' || value === 'X' || value === '휴'
}

export function isOffReading(value: string | undefined): boolean {
  return value?.trim() === '휴'
}

export function isItemFilled(item: CheckItem, record?: InspectionRecord): boolean {
  const key = itemKey(item.no)
  if (resolveInputKind(item) === 'mark') {
    return isRecordedMark(record?.results[key])
  }
  return Boolean(record?.readings?.[key]?.trim())
}

export function isBlankDay(input: {
  results: Record<string, CheckResult>
  readings?: Record<string, string>
  issueNote: string
  requestDate: string
  confirmDate: string
}): boolean {
  const hasResult = Object.values(input.results).some((value) => isRecordedMark(value))
  const hasReading = Object.values(input.readings ?? {}).some((value) => value.trim().length > 0)
  return !hasResult && !hasReading && !input.issueNote.trim() && !input.requestDate && !input.confirmDate
}

export function upsertInspection(
  records: InspectionRecord[],
  draft: InspectionDraft,
): { records: InspectionRecord[]; record: InspectionRecord; isNew: boolean } {
  const now = new Date().toISOString()
  const existing = draft.id
    ? records.find((item) => item.id === draft.id)
    : findInspection(records, draft.equipmentId, draft.date)

  if (existing) {
    const record: InspectionRecord = {
      ...existing,
      ...draft,
      readings: draft.readings ?? existing.readings ?? {},
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
    }
    return {
      records: records.map((item) => (item.id === existing.id ? record : item)),
      record,
      isNew: false,
    }
  }

  const record: InspectionRecord = {
    ...draft,
    readings: draft.readings ?? {},
    id: createId('insp'),
    createdAt: now,
    updatedAt: now,
  }
  return { records: [record, ...records], record, isNew: true }
}

export function removeInspection(
  records: InspectionRecord[],
  id: string,
): InspectionRecord[] {
  return records.filter((item) => item.id !== id)
}

export function inspectionStatus(
  record: InspectionRecord | undefined,
): 'empty' | 'ok' | 'issue' | 'off' {
  if (!record) return 'empty'
  const values = Object.values(record.results)
  const readings = Object.values(record.readings ?? {}).map((value) => value.trim()).filter(Boolean)
  const realReadings = readings.filter((value) => value !== '휴')
  if (values.some((value) => value === 'X')) return 'issue'
  if (values.some((value) => value === 'O') || realReadings.length > 0) return 'ok'
  if (values.some((value) => value === '휴') || readings.some((value) => value === '휴')) return 'off'
  return 'empty'
}

export function hasIssueMark(results: Record<string, CheckResult> | undefined): boolean {
  return Object.values(results ?? {}).some((value) => value === 'X')
}

export function recordHasIssueMark(record: InspectionRecord | undefined): boolean {
  return hasIssueMark(record?.results)
}

export function dayConfirmMark(
  record: InspectionRecord | undefined,
  items: CheckItem[],
): CheckResult {
  if (!record || items.length === 0) return ''
  if (inspectionStatus(record) === 'off') return ''

  let allOk = true
  let anyIssue = false

  for (const item of items) {
    const key = itemKey(item.no)
    if (resolveInputKind(item) === 'mark') {
      const mark = record.results[key] ?? ''
      if (mark === 'X') anyIssue = true
      if (mark !== 'O') allOk = false
      continue
    }
    const reading = record.readings?.[key]?.trim() ?? ''
    if (!reading || reading === '휴') allOk = false
  }

  if (anyIssue) return 'X'
  if (allOk) return 'O'
  return ''
}
