import { LINE_NAME } from '../data/equipment'
import { readJson, writeJson } from './storage'
import type { UserProfile } from '../types'

export const DEFAULT_INSPECTORS = ['신지훈', '한상준', '임행영', '채소영', '김성진'] as const

export const DEFAULT_ACTOR: UserProfile = {
  name: LINE_NAME,
  email: '-',
  department: LINE_NAME,
}

export function toInspector(name: string): UserProfile {
  const trimmed = name.trim()
  return {
    name: trimmed,
    email: '-',
    department: LINE_NAME,
  }
}

export function saveLastInspectorName(name: string): void {
  writeJson('lastInspector', name.trim())
}

export function resolveInspectorName(inspectors: string[], saved?: string): string {
  if (saved && inspectors.includes(saved)) return saved
  return ''
}

export function loadLastInspectorName(inspectors: string[]): string {
  const saved = readJson<string>('lastInspector', '')
  return resolveInspectorName(inspectors, saved)
}
