import type { CheckItem, InputKind } from '../types'

const UNICODE_FRACTIONS: Record<string, { num: number; den: number }> = {
  '½': { num: 1, den: 2 },
  '⅓': { num: 1, den: 3 },
  '⅔': { num: 2, den: 3 },
  '¼': { num: 1, den: 4 },
  '¾': { num: 3, den: 4 },
  '⅕': { num: 1, den: 5 },
  '⅖': { num: 2, den: 5 },
  '⅗': { num: 3, den: 5 },
  '⅘': { num: 4, den: 5 },
  '⅙': { num: 1, den: 6 },
  '⅚': { num: 5, den: 6 },
  '⅛': { num: 1, den: 8 },
  '⅜': { num: 3, den: 8 },
  '⅝': { num: 5, den: 8 },
  '⅞': { num: 7, den: 8 },
}

const KINDS: InputKind[] = ['mark', 'number', 'fraction']

export function isInputKind(value: string | undefined): value is InputKind {
  return KINDS.includes(value as InputKind)
}

export function inferInputKind(criteria: string): InputKind {
  if (fractionDenom(criteria) !== undefined) return 'fraction'
  if (
    /(\d+(?:\.\d+)?|⅓|⅔)\s*(L|ℓ|psi|℃|°C|%|bar|g)/i.test(criteria) &&
    /(유지|이내|이상|이하|확인|↑|↓)/.test(criteria)
  ) {
    return 'number'
  }
  if (/\d+\s*(L|ℓ|psi|g)\s*(이상|이내|이하)/i.test(criteria)) return 'number'
  if (/\d+(?:\.\d+)?\s*mm/i.test(criteria)) return 'number'
  if (/\d+\s*~\s*\d+\s*\(?\s*bar/i.test(criteria)) return 'number'
  if (/\d+\s*[-~]\s*\d+\s*℃/.test(criteria)) return 'number'
  if (/발열\s*\d+\s*℃/i.test(criteria)) return 'number'
  if (/오염도\s*\d+\s*%/i.test(criteria)) return 'number'
  return 'mark'
}

export function resolveInputKind(item: CheckItem): InputKind {
  return isInputKind(item.inputKind) ? item.inputKind : inferInputKind(item.criteria)
}

export function fractionDenom(criteria: string): number | undefined {
  for (const [token, value] of Object.entries(UNICODE_FRACTIONS)) {
    if (criteria.includes(token)) return value.den
  }
  const match = criteria.match(/(\d+)\s*\/\s*(\d+)/)
  if (match?.[2]) return Number(match[2])
  return undefined
}

export function parseFractionParts(value: string): { num: string; den: string } {
  if (!value.trim()) return { num: '', den: '' }
  const slash = value.indexOf('/')
  if (slash < 0) return { num: value.replace(/[^\d]/g, ''), den: '' }
  return {
    num: value.slice(0, slash).replace(/[^\d]/g, ''),
    den: value.slice(slash + 1).replace(/[^\d]/g, ''),
  }
}

export function joinFraction(num: string, den: string): string {
  if (!num && !den) return ''
  return `${num}/${den}`
}

export function readingUnit(item: CheckItem): string {
  const attached = item.criteria.match(/(?:\d+(?:\.\d+)?|⅓|⅔)\s*(L|ℓ|psi|℃|°C|˚C|%|mm|g)/i)
  if (attached?.[1]) return normalizeReadingUnit(attached[1])
  if (/\(\s*bar\s*\)|\bbar\b/i.test(item.criteria)) return 'bar'
  return ''
}

function normalizeReadingUnit(raw: string): string {
  const unit = raw.trim()
  if (/^(l|ℓ)$/i.test(unit)) return 'L'
  if (/^(℃|°C|˚C)$/i.test(unit)) return '℃'
  if (/^psi$/i.test(unit)) return 'psi'
  if (/^mm$/i.test(unit)) return 'mm'
  if (/^g$/i.test(unit)) return 'g'
  return unit
}

export function readingPlaceholder(item: CheckItem): string {
  return readingUnit(item) || '수치'
}

export function sanitizeNumberInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot < 0) return cleaned
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`
}

export function sanitizeDigits(raw: string): string {
  return raw.replace(/[^\d]/g, '')
}

export function sanitizeFractionDigit(raw: string): string {
  return sanitizeDigits(raw).slice(-1)
}

const CRITERIA_HIGHLIGHT_NOS: Record<string, readonly number[]> = {
  'q-fog': [1, 2, 4, 5, 6],
  'pencil-hardness': [3],
  tensile: [3, 4, 5],
  arl: [1, 7],
  oven: [3],
  press: [2],
}

export function shouldHighlightCriteria(equipmentId: string, itemNo: number): boolean {
  return CRITERIA_HIGHLIGHT_NOS[equipmentId]?.includes(itemNo) ?? false
}

const HIGHLIGHT_RE =
  /[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d+(?:\.\d+)?(?:\s*[~\-–]\s*\d+(?:\.\d+)?)?(?:\s*\/\s*\d+(?:\.\d+)?)?(?:\s*(?:L|ℓ|psi|℃|°C|˚C|%|bar|mm|g))?(?:\s*\(\s*bar\s*\))?(?:\s*[↓↑])?/gi

export function splitCriteriaHighlight(criteria: string): { text: string; highlight: boolean }[] {
  let source = criteria
  for (const [token, value] of Object.entries(UNICODE_FRACTIONS)) {
    source = source.split(token).join(`${value.num}/${value.den}`)
  }
  const parts: { text: string; highlight: boolean }[] = []
  let last = 0
  for (const match of source.matchAll(HIGHLIGHT_RE)) {
    const index = match.index ?? 0
    if (index > last) parts.push({ text: source.slice(last, index), highlight: false })
    parts.push({ text: match[0], highlight: true })
    last = index + match[0].length
  }
  if (last < source.length) parts.push({ text: source.slice(last), highlight: false })
  if (parts.length === 0) parts.push({ text: source, highlight: false })
  return parts
}
