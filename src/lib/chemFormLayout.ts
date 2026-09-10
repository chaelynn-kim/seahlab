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
const HEADER_ROW_KEY = 'chemFormHeaderRows'

export const HEADER_ROW_IDS = ['thead-section', 'thead-block', 'thead-leaf'] as const
export type HeaderRowId = (typeof HEADER_ROW_IDS)[number]

export function loadHeaderRowHeights(): Record<string, number> {
  const saved = readJson<Record<string, number> | null>(HEADER_ROW_KEY, null)
  if (!saved) return {}
  return Object.fromEntries(
    HEADER_ROW_IDS.filter((id) => Number.isFinite(saved[id]) && saved[id] >= 18).map((id) => [id, saved[id]]),
  )
}

export function saveHeaderRowHeights(heights: Record<string, number>): void {
  writeJson(
    HEADER_ROW_KEY,
    Object.fromEntries(HEADER_ROW_IDS.filter((id) => Number.isFinite(heights[id])).map((id) => [id, heights[id]])),
  )
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

export function loadChemFormColumns(): ChemFormColumn[] {
  const saved = readJson<ChemFormColumn[] | null>(KEY, null)
  if (!saved || saved.length === 0) return DEFAULT_CHEM_COLUMNS.map((item) => ({ ...item }))
  const normalized = normalizeColumns(saved)
  const savedStock = saved.findIndex((col) => col.id === 'stock' || col.key === 'stock')
  const savedNote = saved.findIndex((col) => col.id === 'note' || col.key === 'note')
  const bizRelabeled = saved.some((col, index) => col.label !== normalized[index]?.label)
  if (savedStock < 0 || (savedNote >= 0 && savedStock > savedNote) || bizRelabeled) writeJson(KEY, normalized)
  return normalized
}

export function saveChemFormColumns(list: ChemFormColumn[]): ChemFormColumn[] {
  const normalized = normalizeColumns(list)
  writeJson(KEY, normalized)
  return normalized
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
