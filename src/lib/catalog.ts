import { EQUIPMENT_LIST } from '../data/equipment'
import { DEFAULT_INSPECTORS } from './actor'
import { inferInputKind, isInputKind } from './inputKind'
import { createId, readJson, writeJson } from './storage'
import type { CheckItem, Equipment, TimingCode } from '../types'

const EQUIPMENT_KEY = 'equipmentCatalog'
const INSPECTOR_KEY = 'inspectors'

function cloneList<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isTiming(value: string): value is TimingCode {
  return value === '운' || value === '정'
}

function normalizeItems(items: CheckItem[]): CheckItem[] {
  return items.map((item, index) => {
    const criteria = item.criteria.trim()
    return {
      id: item.id?.trim() || createId('ci'),
      no: Number(item.no) || index + 1,
      point: item.point.trim(),
      timing: isTiming(item.timing) ? item.timing : '정',
      criteria,
      inputKind: isInputKind(item.inputKind) ? item.inputKind : inferInputKind(criteria),
    }
  })
}

function normalizeEquipment(list: Equipment[]): Equipment[] {
  return list
    .map((item) => ({
      id: item.id.trim() || createId('eq'),
      name: item.name.trim(),
      shortName: item.shortName.trim() || item.name.trim(),
      items: normalizeItems(item.items ?? []),
    }))
    .filter((item) => item.name.length > 0)
}

export function loadEquipmentCatalog(): Equipment[] {
  const saved = readJson<Equipment[] | null>(EQUIPMENT_KEY, null)
  if (saved && saved.length > 0) return normalizeEquipment(saved)
  return cloneList(EQUIPMENT_LIST)
}

export function saveEquipmentCatalog(list: Equipment[]): Equipment[] {
  const normalized = normalizeEquipment(list)
  writeJson(EQUIPMENT_KEY, normalized)
  return normalized
}

export function loadInspectors(): string[] {
  const saved = readJson<string[] | null>(INSPECTOR_KEY, null)
  if (saved && saved.length > 0) {
    return saved.map((name) => name.trim()).filter(Boolean)
  }
  return [...DEFAULT_INSPECTORS]
}

export function saveInspectors(names: string[]): string[] {
  const normalized = names.map((name) => name.trim()).filter(Boolean)
  writeJson(INSPECTOR_KEY, normalized)
  return normalized
}

export function createEquipment(): Equipment {
  return {
    id: createId('eq'),
    name: '새 설비',
    shortName: '새설비',
    items: [{ id: createId('ci'), no: 1, point: '', timing: '정', criteria: '', inputKind: 'mark' }],
  }
}

export function createCheckItem(items: CheckItem[]): CheckItem {
  const nextNo = items.reduce((max, item) => Math.max(max, item.no), 0) + 1
  return { id: createId('ci'), no: nextNo, point: '', timing: '정', criteria: '', inputKind: 'mark' }
}

export function withItemIds(list: Equipment[]): Equipment[] {
  return list.map((eq) => ({
    ...eq,
    items: eq.items.map((item) => ({
      ...item,
      id: item.id?.trim() || createId('ci'),
      inputKind: isInputKind(item.inputKind) ? item.inputKind : inferInputKind(item.criteria),
    })),
  }))
}

export function defaultCatalog(): Equipment[] {
  return cloneList(EQUIPMENT_LIST)
}

export function defaultInspectors(): string[] {
  return [...DEFAULT_INSPECTORS]
}
