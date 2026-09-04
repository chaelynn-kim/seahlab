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

export function findInspection(
  records: InspectionRecord[],
  equipmentId: string,
  date: string,
): InspectionRecord | undefined {
  return records.find((item) => item.equipmentId === equipmentId && item.date === date)
}

export function itemKey(no: number): string {
  return String(no)
}

export function blankResults(nos: number[]): Record<string, CheckResult> {
  return Object.fromEntries(nos.map((no) => [itemKey(no), '' as CheckResult]))
}

export function isItemFilled(item: CheckItem, record?: InspectionRecord): boolean {
  const key = itemKey(item.no)
  if (resolveInputKind(item) === 'mark') {
    const value = record?.results[key]
    return value === 'O' || value === 'X'
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
  const hasResult = Object.values(input.results).some((value) => value === 'O' || value === 'X')
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

export function inspectionStatus(record: InspectionRecord | undefined): 'empty' | 'ok' | 'issue' {
  if (!record) return 'empty'
  const values = Object.values(record.results)
  if (values.some((value) => value === 'X') || record.issueNote.trim()) return 'issue'
  if (values.some((value) => value === 'O')) return 'ok'
  if (Object.values(record.readings ?? {}).some((value) => value.trim().length > 0)) return 'ok'
  return 'empty'
}
