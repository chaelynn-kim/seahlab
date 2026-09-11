import { LINE_NAME, SUPPORT_TEAM } from '../data/equipment'
import { readJson, writeJson } from './storage'

export interface InspSheetChrome {
  lineName: string
  supportTeam: string
  approvalLabel: string
  approvalRole: string
}

const KEY = 'inspSheetChrome'

export const DEFAULT_INSP_CHROME: InspSheetChrome = {
  lineName: LINE_NAME,
  supportTeam: SUPPORT_TEAM,
  approvalLabel: '결재',
  approvalRole: '계장',
}

export function loadInspSheetChrome(): InspSheetChrome {
  const saved = readJson<Partial<InspSheetChrome> | null>(KEY, null)
  return { ...DEFAULT_INSP_CHROME, ...saved }
}

export function saveInspSheetChrome(chrome: InspSheetChrome): void {
  writeJson(KEY, chrome)
}

export const INSP_ALL_TAB_ID = '__all__'

export type InspColId = 'equip' | 'no' | 'point' | 'timing' | 'criteria' | 'day' | 'kind'

export interface InspFormLayout {
  colPct: Partial<Record<InspColId, number>>
  rowHeights: Record<string, number>
}

const LAYOUT_KEY = 'inspFormLayoutById'

export const DEFAULT_INSP_COL_PCT: Record<InspColId, number> = {
  equip: 8,
  no: 3,
  point: 9,
  timing: 3,
  criteria: 13,
  day: 2.06,
  kind: 8,
}

export function emptyInspLayout(): InspFormLayout {
  return { colPct: {}, rowHeights: {} }
}

function sanitizeLayout(saved: Partial<InspFormLayout> | null | undefined): InspFormLayout {
  const colPct: Partial<Record<InspColId, number>> = {}
  for (const [key, value] of Object.entries(saved?.colPct ?? {})) {
    if (Number.isFinite(value) && value >= 1.2) colPct[key as InspColId] = value
  }
  const rowHeights = Object.fromEntries(
    Object.entries(saved?.rowHeights ?? {}).filter(([, height]) => Number.isFinite(height) && height >= 18),
  )
  return { colPct, rowHeights }
}

export function loadInspFormLayout(equipmentId: string): InspFormLayout {
  if (!equipmentId || equipmentId === INSP_ALL_TAB_ID) return emptyInspLayout()
  const byId = readJson<Record<string, Partial<InspFormLayout>>>(LAYOUT_KEY, {})
  return sanitizeLayout(byId[equipmentId])
}

export function saveInspFormLayout(equipmentId: string, layout: InspFormLayout): void {
  if (!equipmentId || equipmentId === INSP_ALL_TAB_ID) return
  const byId = readJson<Record<string, InspFormLayout>>(LAYOUT_KEY, {})
  writeJson(LAYOUT_KEY, { ...byId, [equipmentId]: sanitizeLayout(layout) })
}

export function saveInspFormLayoutAll(equipmentIds: string[], layout: InspFormLayout): void {
  const next = sanitizeLayout(layout)
  const byId = readJson<Record<string, InspFormLayout>>(LAYOUT_KEY, {})
  for (const id of equipmentIds) {
    if (!id || id === INSP_ALL_TAB_ID) continue
    byId[id] = next
  }
  writeJson(LAYOUT_KEY, byId)
}
