import { createId, readJson, writeJson } from './storage'

export type ChemColGroup = 'in' | 'out' | 'end'
export type ChemColKind = 'text' | 'digit' | 'qty'

export interface ChemFormColumn {
  id: string
  key: string
  group: ChemColGroup
  block: string
  label: string
  width: number
  kind: ChemColKind
}

const KEY = 'chemFormLayout'
const KEY_BY_ID = 'chemFormLayoutById'
const HEADER_ROW_KEY = 'chemFormHeaderRows'
const HEADER_ROW_KEY_BY_ID = 'chemFormHeaderRowsById'
const CHROME_KEY_BY_ID = 'chemSheetChromeById'
const FONT_KEY_BY_ID = 'chemFormCellFontsById'

export const CHEM_FONT_MIN = 7
export const CHEM_FONT_MAX = 28
export const CHEM_CELL = {
  title: 'chrome-title',
  meta: 'chrome-meta',
  legal: 'chrome-legal',
  footer: 'chrome-footer',
} as const

export function chemSectionCell(group: ChemColGroup): string {
  return `thead-section:${group}`
}

export function chemBlockCell(colId: string): string {
  return `thead-block:${colId}`
}

export function chemLeafCell(colId: string): string {
  return `thead-leaf:${colId}`
}

export function chemBodyCell(rowId: string, colId: string): string {
  return `tbody:${rowId}:${colId}`
}

export function parseChemBodyCell(cellId: string): { rowId: string; colId: string } | null {
  if (!cellId.startsWith('tbody:')) return null
  const rest = cellId.slice(6)
  const sep = rest.lastIndexOf(':')
  if (sep <= 0 || sep === rest.length - 1) return null
  return { rowId: rest.slice(0, sep), colId: rest.slice(sep + 1) }
}

export function resolveChemCellFont(fonts: Record<string, number>, cellId: string): number | undefined {
  const direct = fonts[cellId]
  if (direct != null) return direct
  const body = parseChemBodyCell(cellId)
  if (body) return fonts[`tbody:${body.colId}`]
  return undefined
}

export function defaultChemCellFont(cellId: string): number {
  if (cellId === CHEM_CELL.title) return 16
  if (cellId.startsWith('tbody:')) return 9
  if (cellId.startsWith('chrome-')) return 12
  return 11
}

export function clampChemCellFont(value: number): number {
  return Math.min(CHEM_FONT_MAX, Math.max(CHEM_FONT_MIN, Math.round(value)))
}

function sanitizeCellFonts(saved: Record<string, number> | null | undefined): Record<string, number> {
  if (!saved) return {}
  return Object.fromEntries(
    Object.entries(saved).filter(([, size]) => Number.isFinite(size) && size >= CHEM_FONT_MIN && size <= CHEM_FONT_MAX),
  )
}

export function loadChemCellFonts(ledgerId = ''): Record<string, number> {
  if (!ledgerId) return {}
  const byId = readJson<Record<string, Record<string, number>>>(FONT_KEY_BY_ID, {})
  return sanitizeCellFonts(byId[ledgerId])
}

export function saveChemCellFonts(fonts: Record<string, number>, ledgerId = ''): void {
  if (!ledgerId) return
  const byId = readJson<Record<string, Record<string, number>>>(FONT_KEY_BY_ID, {})
  writeJson(FONT_KEY_BY_ID, { ...byId, [ledgerId]: sanitizeCellFonts(fonts) })
}

export interface ChemSheetChrome {
  legal: string
  titleBefore: string
  titleAfter: string
  footer: string
  inSection: string
  outSection: string
  metaLeftPct: number
}

export const DEFAULT_CHEM_CHROME: ChemSheetChrome = {
  legal: '¾ 화학물질관리법 시행규칙 [별지 제75호 서식]',
  titleBefore: '화학물질',
  titleAfter: '관리대장',
  footer: '297mm × 210mm [백상지 80g/m²]',
  inSection: '입 고 량',
  outSection: '출 고 량',
  metaLeftPct: 50,
}

function defaultChrome(): ChemSheetChrome {
  return { ...DEFAULT_CHEM_CHROME }
}

function clampMetaLeft(value: number): number {
  return Math.min(72, Math.max(28, value))
}

function normalizeChrome(saved: Partial<ChemSheetChrome> | null | undefined): ChemSheetChrome {
  const metaLeft = Number(saved?.metaLeftPct)
  return {
    legal: typeof saved?.legal === 'string' ? saved.legal : DEFAULT_CHEM_CHROME.legal,
    titleBefore: typeof saved?.titleBefore === 'string' ? saved.titleBefore : DEFAULT_CHEM_CHROME.titleBefore,
    titleAfter: typeof saved?.titleAfter === 'string' ? saved.titleAfter : DEFAULT_CHEM_CHROME.titleAfter,
    footer: typeof saved?.footer === 'string' ? saved.footer : DEFAULT_CHEM_CHROME.footer,
    inSection: typeof saved?.inSection === 'string' ? saved.inSection : DEFAULT_CHEM_CHROME.inSection,
    outSection: typeof saved?.outSection === 'string' ? saved.outSection : DEFAULT_CHEM_CHROME.outSection,
    metaLeftPct: Number.isFinite(metaLeft) ? clampMetaLeft(metaLeft) : DEFAULT_CHEM_CHROME.metaLeftPct,
  }
}

export function loadChemSheetChrome(ledgerId = ''): ChemSheetChrome {
  if (!ledgerId) return defaultChrome()
  const byId = readJson<Record<string, Partial<ChemSheetChrome>>>(CHROME_KEY_BY_ID, {})
  return normalizeChrome(byId[ledgerId])
}

export function saveChemSheetChrome(chrome: ChemSheetChrome, ledgerId = ''): ChemSheetChrome {
  const next = normalizeChrome(chrome)
  if (!ledgerId) return next
  const byId = readJson<Record<string, ChemSheetChrome>>(CHROME_KEY_BY_ID, {})
  writeJson(CHROME_KEY_BY_ID, { ...byId, [ledgerId]: next })
  return next
}

export const HEADER_ROW_IDS = ['thead-section', 'thead-block', 'thead-leaf'] as const
export type HeaderRowId = (typeof HEADER_ROW_IDS)[number]
export const CHEM_BODY_ROW_KEY = 'tbody'
export const CHROME_TITLE_ROW = 'chrome-title'
export const CHROME_META_ROW = 'chrome-meta'
export const CHROME_META_LEFT = 'chrome-meta-left'

export function isChemHeaderRowId(id: string): boolean {
  return id.startsWith('thead-') || id === CHROME_TITLE_ROW || id === CHROME_META_ROW
}

export function keepLayoutHeights(prev: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(prev).filter(([id]) => isChemHeaderRowId(id) || id === CHEM_BODY_ROW_KEY),
  )
}

function sanitizeHeaderHeights(saved: Record<string, number> | null): Record<string, number> {
  if (!saved) return {}
  return Object.fromEntries(
    Object.entries(saved).filter(([, height]) => Number.isFinite(height) && height >= 18),
  )
}

export function loadHeaderRowHeights(ledgerId = ''): Record<string, number> {
  if (ledgerId) {
    const byId = readJson<Record<string, Record<string, number>>>(HEADER_ROW_KEY_BY_ID, {})
    if (byId[ledgerId]) return sanitizeHeaderHeights(byId[ledgerId])
  }
  return {}
}

export function saveHeaderRowHeights(heights: Record<string, number>, ledgerId = ''): void {
  const next = sanitizeHeaderHeights(heights)
  if (!ledgerId) return
  const byId = readJson<Record<string, Record<string, number>>>(HEADER_ROW_KEY_BY_ID, {})
  writeJson(HEADER_ROW_KEY_BY_ID, { ...byId, [ledgerId]: next })
}

export const DEFAULT_CHEM_COLUMNS: ChemFormColumn[] = [
  { id: 'inDate', key: 'inDate', group: 'in', block: '', label: '연월일', width: 4.4, kind: 'text' },
  { id: 'carryOver', key: 'carryOver', group: 'in', block: '', label: '이월량', width: 4.1, kind: 'qty' },
  { id: 'inType', key: 'inType', group: 'in', block: '제조·수입·\n구입량', label: '구분', width: 3.1, kind: 'text' },
  { id: 'inQty', key: 'inQty', group: 'in', block: '제조·수입·\n구입량', label: '수량', width: 4.1, kind: 'qty' },
  { id: 'inName', key: 'inName', group: 'in', block: '구입 명세', label: '상호\n(성명)', width: 7, kind: 'text' },
  { id: 'inBizNo', key: 'inBizNo', group: 'in', block: '구입 명세', label: '사업자등록번호\n(생년월일)', width: 8.2, kind: 'digit' },
  { id: 'inAddress', key: 'inAddress', group: 'in', block: '구입 명세', label: '주소', width: 9.6, kind: 'text' },
  { id: 'inPhone', key: 'inPhone', group: 'in', block: '구입 명세', label: '전화번호', width: 7.6, kind: 'digit' },
  { id: 'outDate', key: 'outDate', group: 'out', block: '', label: '연월일', width: 4.4, kind: 'text' },
  { id: 'outType', key: 'outType', group: 'out', block: '사용·판매량', label: '구분', width: 3.1, kind: 'text' },
  { id: 'outQty', key: 'outQty', group: 'out', block: '사용·판매량', label: '수량', width: 4.1, kind: 'qty' },
  { id: 'outName', key: 'outName', group: 'out', block: '판매 명세', label: '상호\n(성명)', width: 7, kind: 'text' },
  { id: 'outBizNo', key: 'outBizNo', group: 'out', block: '판매 명세', label: '사업자등록번호\n(생년월일)', width: 8.2, kind: 'digit' },
  { id: 'outAddress', key: 'outAddress', group: 'out', block: '판매 명세', label: '주소', width: 9.6, kind: 'text' },
  { id: 'outPhone', key: 'outPhone', group: 'out', block: '판매 명세', label: '전화번호', width: 7.6, kind: 'digit' },
  { id: 'stock', key: 'stock', group: 'end', block: '', label: '재고량', width: 4.1, kind: 'qty' },
  { id: 'note', key: 'note', group: 'end', block: '', label: '비고', width: 2.8, kind: 'text' },
]

function isGroup(value: string): value is ChemColGroup {
  return value === 'in' || value === 'out' || value === 'end'
}

function isKind(value: string): value is ChemColKind {
  return value === 'text' || value === 'digit' || value === 'qty'
}

function normalizeColumn(col: Partial<ChemFormColumn>, index: number): ChemFormColumn {
  const fallback = DEFAULT_CHEM_COLUMNS[index] ?? DEFAULT_CHEM_COLUMNS[0]
  return {
    id: col.id?.trim() || createId('col'),
    key: col.key?.trim() || `extra:${createId('x')}`,
    group: col.group && isGroup(col.group) ? col.group : fallback.group,
    block: col.block ?? '',
    label: col.label ?? '새 열',
    width: Number.isFinite(col.width) && (col.width ?? 0) >= 2 ? Number(col.width) : 5,
    kind: col.kind && isKind(col.kind) ? col.kind : 'text',
  }
}

function stockColumn(): ChemFormColumn {
  const stock = DEFAULT_CHEM_COLUMNS.find((col) => col.id === 'stock')
  return stock ? { ...stock } : { id: 'stock', key: 'stock', group: 'end', block: '', label: '재고량', width: 4.1, kind: 'qty' }
}

function isStockCol(col: ChemFormColumn): boolean {
  return col.id === 'stock' || col.key === 'stock' || col.label.replace(/\s/g, '') === '재고량'
}

function isNoteCol(col: ChemFormColumn): boolean {
  return col.id === 'note' || col.key === 'note' || col.label.replace(/\s/g, '') === '비고'
}

function withBizNoLineBreak(col: ChemFormColumn): ChemFormColumn {
  const compact = col.label.replace(/\s/g, '')
  if (compact !== '사업자등록번호(생년월일)') return col
  if (col.label === '사업자등록번호\n(생년월일)') return col
  return { ...col, label: '사업자등록번호\n(생년월일)' }
}

export function isBizNoHeader(col: ChemFormColumn): boolean {
  return col.id === 'inBizNo' || col.id === 'outBizNo' || col.label.includes('사업자등록번호')
}

export function isDateColumn(col: ChemFormColumn): boolean {
  return (
    col.id === 'inDate' ||
    col.id === 'outDate' ||
    col.key === 'inDate' ||
    col.key === 'outDate' ||
    col.label.replace(/\s/g, '') === '연월일'
  )
}

export function normalizeColumns(list: ChemFormColumn[]): ChemFormColumn[] {
  const next = list.map((item, index) => withBizNoLineBreak(normalizeColumn(item, index)))
  const columns = next.length > 0 ? next : DEFAULT_CHEM_COLUMNS.map((item) => ({ ...item }))
  const stockIndex = columns.findIndex(isStockCol)
  const noteIndex = columns.findIndex(isNoteCol)

  if (stockIndex < 0) {
    if (noteIndex >= 0) columns.splice(noteIndex, 0, stockColumn())
    else columns.push(stockColumn())
  } else if (noteIndex >= 0 && stockIndex > noteIndex) {
    const [stock] = columns.splice(stockIndex, 1)
    const insertAt = columns.findIndex(isNoteCol)
    columns.splice(insertAt, 0, stock)
  }

  return columns
}

function defaultColumns(): ChemFormColumn[] {
  return DEFAULT_CHEM_COLUMNS.map((item) => ({ ...item }))
}

function columnsById(): Record<string, ChemFormColumn[]> {
  return readJson<Record<string, ChemFormColumn[]>>(KEY_BY_ID, {})
}

export function migrateChemFormLayout(ledgerIds: string[]): void {
  const byId = columnsById()
  if (ledgerIds.some((id) => byId[id] && byId[id].length > 0)) return
  const saved = readJson<ChemFormColumn[] | null>(KEY, null)
  if (!saved || saved.length === 0 || ledgerIds.length === 0) return
  const normalized = normalizeColumns(saved)
  const next: Record<string, ChemFormColumn[]> = { ...byId }
  for (const id of ledgerIds) next[id] = normalized
  writeJson(KEY_BY_ID, next)

  const heightsById = readJson<Record<string, Record<string, number>>>(HEADER_ROW_KEY_BY_ID, {})
  if (ledgerIds.some((id) => heightsById[id])) return
  const heights = sanitizeHeaderHeights(readJson<Record<string, number> | null>(HEADER_ROW_KEY, null))
  if (Object.keys(heights).length === 0) return
  const nextHeights: Record<string, Record<string, number>> = { ...heightsById }
  for (const id of ledgerIds) nextHeights[id] = heights
  writeJson(HEADER_ROW_KEY_BY_ID, nextHeights)
}

export function loadChemFormColumns(ledgerId = ''): ChemFormColumn[] {
  if (ledgerId) {
    const saved = columnsById()[ledgerId]
    if (saved && saved.length > 0) return normalizeColumns(saved)
  }
  return defaultColumns()
}

export function saveChemFormColumns(list: ChemFormColumn[], ledgerId = ''): ChemFormColumn[] {
  const normalized = normalizeColumns(list)
  if (!ledgerId) return normalized
  writeJson(KEY_BY_ID, { ...columnsById(), [ledgerId]: normalized })
  return normalized
}

export function saveChemFormLayoutAll(
  ledgerIds: string[],
  columns: ChemFormColumn[],
  chrome: ChemSheetChrome,
  rowHeights: Record<string, number>,
  cellFonts: Record<string, number> = {},
): void {
  const normalized = normalizeColumns(columns)
  const nextChrome = normalizeChrome(chrome)
  const heights = sanitizeHeaderHeights(rowHeights)
  const fonts = sanitizeCellFonts(cellFonts)
  const cols = { ...columnsById() }
  const chromeById = readJson<Record<string, ChemSheetChrome>>(CHROME_KEY_BY_ID, {})
  const heightsById = readJson<Record<string, Record<string, number>>>(HEADER_ROW_KEY_BY_ID, {})
  const fontsById = readJson<Record<string, Record<string, number>>>(FONT_KEY_BY_ID, {})
  for (const id of ledgerIds) {
    if (!id || id === '__all__') continue
    cols[id] = normalized
    chromeById[id] = nextChrome
    heightsById[id] = heights
    fontsById[id] = fonts
  }
  writeJson(KEY_BY_ID, cols)
  writeJson(CHROME_KEY_BY_ID, chromeById)
  writeJson(HEADER_ROW_KEY_BY_ID, heightsById)
  writeJson(FONT_KEY_BY_ID, fontsById)
}

export function removeChemFormLayout(ledgerId: string): void {
  if (!ledgerId) return
  const byId = columnsById()
  if (byId[ledgerId]) {
    const { [ledgerId]: _removed, ...rest } = byId
    writeJson(KEY_BY_ID, rest)
  }
  const heights = readJson<Record<string, Record<string, number>>>(HEADER_ROW_KEY_BY_ID, {})
  if (heights[ledgerId]) {
    const { [ledgerId]: _removed, ...rest } = heights
    writeJson(HEADER_ROW_KEY_BY_ID, rest)
  }
  const chrome = readJson<Record<string, ChemSheetChrome>>(CHROME_KEY_BY_ID, {})
  if (chrome[ledgerId]) {
    const { [ledgerId]: _removed, ...rest } = chrome
    writeJson(CHROME_KEY_BY_ID, rest)
  }
  const fonts = readJson<Record<string, Record<string, number>>>(FONT_KEY_BY_ID, {})
  if (fonts[ledgerId]) {
    const { [ledgerId]: _removed, ...rest } = fonts
    writeJson(FONT_KEY_BY_ID, rest)
  }
}

export function createChemColumn(group: ChemColGroup, block?: string): ChemFormColumn {
  const extraId = createId('x')
  const resolvedBlock =
    block !== undefined
      ? block
      : group === 'in'
        ? '구입 명세'
        : group === 'out'
          ? '판매 명세'
          : ''
  return {
    id: createId('col'),
    key: `extra:${extraId}`,
    group,
    block: resolvedBlock,
    label: '새 열',
    width: 5,
    kind: 'text',
  }
}

export interface HeaderChunk {
  type: 'span2' | 'block'
  block?: string
  cols: ChemFormColumn[]
}

export function groupHeaderChunks(cols: ChemFormColumn[]): HeaderChunk[] {
  const chunks: HeaderChunk[] = []
  let index = 0
  while (index < cols.length) {
    const block = cols[index].block
    if (!block) {
      chunks.push({ type: 'span2', cols: [cols[index]] })
      index += 1
      continue
    }
    let end = index + 1
    while (end < cols.length && cols[end].block === block) end += 1
    chunks.push({ type: 'block', block, cols: cols.slice(index, end) })
    index = end
  }
  return chunks
}
