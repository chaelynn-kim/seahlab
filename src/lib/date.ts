const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${toDateKey(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

export function formatKoreanDate(key: string): string {
  const date = parseDateKey(key)
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`
}

export function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function monthDayDigits(raw: string, year: number): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const yearStr = String(year)
  const yy = yearStr.slice(-2)
  if (digits.length >= 8) return digits.slice(-4)
  if (digits.length >= 6 && (digits.startsWith(yearStr) || digits.startsWith(yy))) return digits.slice(-4)
  if (digits.startsWith(yearStr) && digits.length > 4) return digits.slice(yearStr.length).slice(0, 4)
  if (digits.startsWith(yy) && digits.length > 2) return digits.slice(2, 6)
  return digits.slice(0, 4)
}

export function formatLedgerDate(raw: string, year: number): string {
  const md = monthDayDigits(raw, year)
  if (md.length < 4) return ''
  let month = Number(md.slice(0, 2))
  let day = Number(md.slice(2, 4))
  if (!Number.isFinite(month) || month < 1) month = 1
  if (month > 12) month = 12
  const maxDay = daysInMonth(year, month)
  if (!Number.isFinite(day) || day < 1) day = 1
  if (day > maxDay) day = maxDay
  return `${pad2(year % 100)}-${pad2(month)}-${pad2(day)}`
}

export function ledgerDateMonthDay(value: string, year: number): string {
  const formatted = formatLedgerDate(value, year)
  return formatted.length === 8 ? formatted.slice(3) : ''
}

export function startWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

export function addMonths(year: number, month: number, offset: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + offset, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export function isSameMonth(key: string, year: number, month: number): boolean {
  return key.startsWith(`${year}-${pad2(month)}`)
}

export { WEEKDAYS }
