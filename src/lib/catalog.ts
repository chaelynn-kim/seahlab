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

const REMOVED_KEY = 'equipmentCatalogRemoved'

function loadRemovedIds(): string[] {
  return readJson<string[]>(REMOVED_KEY, []).filter((id) => typeof id === 'string' && id.trim())
}

export function markEquipmentRemoved(id: string): void {
  if (!id) return
  const ids = new Set(loadRemovedIds())
  ids.add(id)
  writeJson(REMOVED_KEY, [...ids])
}

function mergeMissingSeed(list: Equipment[]): Equipment[] {
  const have = new Map(list.map((item) => [item.id, item]))
  const removed = new Set(loadRemovedIds())
  const extras = list.filter((item) => !EQUIPMENT_LIST.some((seed) => seed.id === item.id))
  const merged = EQUIPMENT_LIST.flatMap((seed) => {
    const existing = have.get(seed.id)
    if (existing) return [syncSeedItemKinds(existing, seed)]
    if (removed.has(seed.id)) return []
    return [cloneList(seed)]
  })
  return [...merged, ...extras]
}

function syncSeedItemKinds(existing: Equipment, seed: Equipment): Equipment {
  return {
    ...existing,
    items: existing.items.map((item) => {
      const seedItem = seed.items.find((row) => row.no === item.no)
      if (!seedItem?.inputKind) return item
      if (item.point.trim() !== seedItem.point.trim()) return item
      if (item.inputKind === seedItem.inputKind) return item
      return { ...item, inputKind: seedItem.inputKind }
    }),
  }
}

function normalizeEquipment(list: Equipment[]): Equipment[] {
  return list.map((item) => {
    const name = item.name.trim() || item.shortName.trim() || '새 설비'
    return {
      id: item.id.trim() || createId('eq'),
      name,
      shortName: item.shortName.trim() || name,
      items: normalizeItems(item.items ?? []),
    }
  })
}

export function loadEquipmentCatalog(): Equipment[] {
  const saved = readJson<Equipment[] | null>(EQUIPMENT_KEY, null)
  if (saved && saved.length > 0) {
    const restored = mergeMissingSeed(normalizeEquipment(saved))
    writeJson(EQUIPMENT_KEY, restored)
    return restored
  }
  return cloneList(EQUIPMENT_LIST)
}

export function saveEquipmentCatalog(list: Equipment[]): Equipment[] {
  const normalized = mergeMissingSeed(normalizeEquipment(list))
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
