const PREFIX = 'seahlab'

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${PREFIX}.${key}`)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(`${PREFIX}.${key}`, JSON.stringify(value))
}

export function removeKey(key: string): void {
  localStorage.removeItem(`${PREFIX}.${key}`)
}

export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}
