import type { ChemicalLedger, ChemicalLedgerMeta, ChemicalLedgerRow, ChemicalLedgersByYear } from '../types'
import { createId, readJson, writeJson } from './storage'

const KEY = 'chemicalLedgers'
const INBOUND_SEED_KEY = 'chemicalLedgersInboundSeeded'
const ACCIDENT_CLASS_SEED_KEY = 'chemicalLedgersAccidentClassSeeded'

const TOXIC_ONLY_KEYS = new Set([
  'chem-sbcl3',
  'chem-naoh',
  'chem-koh',
  '삼염화안티몬',
  '수산화나트륨',
  '수산화칼륨',
])
export const LEDGER_ROW_COUNT = 18

export function formatContentPercent(raw: string): string {
  const compact = raw.replace(/\s/g, '')
  if (!compact) return ''
  const numberPart = compact.replace(/%/g, '')
  if (!numberPart) return ''
  if (/^\d+\.$/.test(numberPart)) return numberPart
  if (/^\d+(\.\d+)?$/.test(numberPart)) return `${numberPart}%`
  return raw
}

export const DEFAULT_INBOUND_SUPPLIER = {
  inName: '한국화공약품',
  inBizNo: '40102837703',
  inAddress: '전북 군산시 해평로 69-3',
  inPhone: '063-442-2100',
} as const

function inboundSupplierEmpty(row: Pick<ChemicalLedgerRow, 'inName' | 'inBizNo' | 'inAddress' | 'inPhone'>): boolean {
  return (
    !row.inName.trim() &&
    !row.inBizNo.trim() &&
    !row.inAddress.trim() &&
    !row.inPhone.trim()
  )
}

function blankLedgerRow(): ChemicalLedgerRow {
  return {
    id: createId('cr'),
    inDate: '',
    carryOver: '',
    inType: '',
    inQty: '',
    inName: '',
    inBizNo: '',
    inAddress: '',
    inPhone: '',
    outDate: '',
    outType: '',
    outQty: '',
    outName: '',
    outBizNo: '',
    outAddress: '',
    outPhone: '',
    stock: '',
    note: '',
    extra: {},
  }
}

export function createLedgerRow(): ChemicalLedgerRow {
  return blankLedgerRow()
}

function emptyRows(count: number): ChemicalLedgerRow[] {
  return Array.from({ length: count }, (_, index) =>
    index === 0
      ? { ...blankLedgerRow(), ...DEFAULT_INBOUND_SUPPLIER }
      : blankLedgerRow(),
  )
}

function createLedger(
  id: string,
  tabName: string,
  productName: string,
  mainUse: string,
  content: string,
  unit: string,
  accidentPreparedness = true,
): ChemicalLedger {
  return {
    id,
    tabName,
    meta: {
      productName,
      mainUse,
      activities: { manufacture: false, import: false, use: true, sale: false },
      category1: '유독물질',
      category2: accidentPreparedness ? '사고대비물질' : '',
      category3: '',
      content,
      content1: content,
      content2: '',
      content3: '',
      unit,
    },
    rows: emptyRows(LEDGER_ROW_COUNT),
  }
}

export function defaultChemicalLedgers(): ChemicalLedger[] {
  return [
    createLedger('chem-hcl', '염산', '염산', '아연도금제거, 압연유 유분분리, 내구성 시험', '38%', '㎖'),
    createLedger('chem-hno3', '질산', '질산', '압연유 유분분리, 금속조직검사 후처리', '62%', '㎖'),
    createLedger('chem-h2o2', '과산화수소', '과산화수소', '압연유 유분분리', '35%', '㎖'),
    createLedger('chem-sbcl3', '삼염화안티몬', '삼염화안티몬', '아연도금제거', '100%', 'g', false),
    createLedger('chem-mek', 'MEK', '메틸에틸케톤', '도막두께 측정, 러빙 테스트', '100%', '㎖'),
    createLedger('chem-h2so4', '황산', '황산', '후처리제 농도 측정', '98.5%', '㎖'),
    createLedger('chem-naoh', '수산화나트륨', '수산화나트륨', '금속조직검사 후처리, 내구성 시험, Cr-Free 농도 측정', '97%', 'g', false),
    createLedger('chem-koh', '수산화칼륨', '수산화칼륨', '압연유 검화가 측정', '98%', 'g', false),
  ]
}

export function createBlankLedger(): ChemicalLedger {
  return {
    id: createId('chem'),
    tabName: '새 물질',
    meta: {
      productName: '',
      mainUse: '',
      activities: { manufacture: false, import: false, use: false, sale: false },
      category1: '',
      category2: '',
      category3: '',
      content: '',
      content1: '',
      content2: '',
      content3: '',
      unit: '',
    },
    rows: Array.from({ length: LEDGER_ROW_COUNT }, () => blankLedgerRow()),
  }
}

function normalizeRow(row: Partial<ChemicalLedgerRow>): ChemicalLedgerRow {
  return {
    ...blankLedgerRow(),
    ...row,
    id: row.id?.trim() || createId('cr'),
    extra: { ...row.extra },
  }
}

function isToxicOnlyLedger(item: ChemicalLedger): boolean {
  return (
    TOXIC_ONLY_KEYS.has(item.id) ||
    TOXIC_ONLY_KEYS.has(item.tabName) ||
    TOXIC_ONLY_KEYS.has(item.meta.productName)
  )
}

export function applyToxicOnlyCategoryDefaults(list: ChemicalLedger[]): ChemicalLedger[] {
  return list.map((item) => {
    if (!isToxicOnlyLedger(item) || item.meta.category2.trim() !== '사고대비물질') return item
    return { ...item, meta: { ...item.meta, category2: '' } }
  })
}

function seedEmptyInboundSupplier(list: ChemicalLedger[]): ChemicalLedger[] {
  return list.map((item) => {
    const first = item.rows[0]
    if (!first || !inboundSupplierEmpty(first)) return item
    return {
      ...item,
      rows: item.rows.map((row, index) =>
        index === 0 ? { ...row, ...DEFAULT_INBOUND_SUPPLIER } : row,
      ),
    }
  })
}

function normalizeMeta(meta: Partial<ChemicalLedgerMeta> | undefined): ChemicalLedgerMeta {
  const base = createBlankLedger().meta
  const next = {
    ...base,
    ...meta,
    activities: {
      ...base.activities,
      ...meta?.activities,
    },
  }
  return {
    ...next,
    content: formatContentPercent(next.content),
    content1: formatContentPercent(next.content1),
    content2: formatContentPercent(next.content2),
    content3: formatContentPercent(next.content3),
  }
}

export function normalizeLedgers(list: ChemicalLedger[]): ChemicalLedger[] {
  return list.map((item) => ({
    id: item.id?.trim() || createId('chem'),
    tabName: item.tabName.trim() || item.meta.productName.trim() || '새 물질',
    meta: normalizeMeta(item.meta),
    rows: (item.rows?.length ? item.rows : emptyRows(LEDGER_ROW_COUNT)).map(normalizeRow),
  }))
}

export function ledgerCalendarYear(): number {
  return new Date().getFullYear()
}

function isYearBook(value: unknown): value is ChemicalLedgersByYear {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeYearBook(book: ChemicalLedgersByYear): ChemicalLedgersByYear {
  const next: ChemicalLedgersByYear = {}
  for (const [year, list] of Object.entries(book)) {
    if (!/^\d{4}$/.test(year) || !Array.isArray(list)) continue
    next[year] = normalizeLedgers(list)
  }
  return next
}

export function blankLedgersForNewYear(source: ChemicalLedger[]): ChemicalLedger[] {
  return normalizeLedgers(source).map((item) => ({
    id: item.id,
    tabName: item.tabName,
    meta: item.meta,
    rows: Array.from({ length: item.rows.length || LEDGER_ROW_COUNT }, () => blankLedgerRow()),
  }))
}

export function ensureLedgerYear(book: ChemicalLedgersByYear, year: number): ChemicalLedgersByYear {
  const key = String(year)
  if (Object.prototype.hasOwnProperty.call(book, key)) return book
  const previous = Object.keys(book)
    .map(Number)
    .filter((item) => Number.isFinite(item) && item < year)
  const source = previous.length > 0 ? book[String(Math.max(...previous))] : defaultChemicalLedgers()
  return { ...book, [key]: blankLedgersForNewYear(source ?? defaultChemicalLedgers()) }
}

export function listLedgerYears(book: ChemicalLedgersByYear): number[] {
  const current = ledgerCalendarYear()
  const stored = Object.keys(book)
    .map(Number)
    .filter((year) => Number.isFinite(year))
  const start = stored.length > 0 ? Math.min(...stored, current) : current
  const years: number[] = []
  for (let year = start; year <= current; year += 1) years.push(year)
  return years
}

function applyPendingSeeds(list: ChemicalLedger[]): { list: ChemicalLedger[]; changed: boolean } {
  let next = list
  let changed = false
  if (!readJson<boolean>(INBOUND_SEED_KEY, false)) {
    next = seedEmptyInboundSupplier(next)
    changed = true
  }
  if (!readJson<boolean>(ACCIDENT_CLASS_SEED_KEY, false)) {
    next = applyToxicOnlyCategoryDefaults(next)
    changed = true
  }
  return { list: next, changed }
}

export function loadChemicalYearBook(): ChemicalLedgersByYear {
  const current = ledgerCalendarYear()
  const saved = readJson<unknown>(KEY, null)
  let book: ChemicalLedgersByYear = {}
  let changed = false

  if (!saved || (Array.isArray(saved) && saved.length === 0)) {
    writeJson(INBOUND_SEED_KEY, true)
    writeJson(ACCIDENT_CLASS_SEED_KEY, true)
    book = { [String(current)]: defaultChemicalLedgers() }
    writeJson(KEY, book)
    return book
  }

  if (Array.isArray(saved)) {
    const legacyYear = current <= 2026 ? current : 2026
    const seeded = applyPendingSeeds(normalizeLedgers(saved as ChemicalLedger[]))
    writeJson(INBOUND_SEED_KEY, true)
    writeJson(ACCIDENT_CLASS_SEED_KEY, true)
    book = { [String(legacyYear)]: seeded.list }
    changed = true
  } else if (isYearBook(saved)) {
    book = normalizeYearBook(saved)
    const needsSeed =
      !readJson<boolean>(INBOUND_SEED_KEY, false) || !readJson<boolean>(ACCIDENT_CLASS_SEED_KEY, false)
    if (needsSeed) {
      for (const year of Object.keys(book)) {
        const seeded = applyPendingSeeds(book[year])
        book[year] = seeded.list
        if (seeded.changed) changed = true
      }
      writeJson(INBOUND_SEED_KEY, true)
      writeJson(ACCIDENT_CLASS_SEED_KEY, true)
    }
  } else {
    book = { [String(current)]: defaultChemicalLedgers() }
    changed = true
  }

  const ensured = ensureLedgerYear(book, current)
  if (ensured !== book) {
    book = ensured
    changed = true
  }
  if (changed) writeJson(KEY, book)
  return book
}

export function saveChemicalYearBook(book: ChemicalLedgersByYear): ChemicalLedgersByYear {
  const normalized = normalizeYearBook(book)
  writeJson(KEY, normalized)
  return normalized
}

export function loadChemicalLedgers(): ChemicalLedger[] {
  const book = loadChemicalYearBook()
  return book[String(ledgerCalendarYear())] ?? []
}

export function saveChemicalLedgers(list: ChemicalLedger[]): ChemicalLedger[] {
  const current = String(ledgerCalendarYear())
  const next = saveChemicalYearBook({ ...loadChemicalYearBook(), [current]: list })
  return next[current] ?? normalizeLedgers(list)
}
