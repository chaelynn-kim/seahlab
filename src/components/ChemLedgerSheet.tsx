import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from 'react'
import type { ChemicalActivities, ChemicalLedger, ChemicalLedgerMeta } from '../types'
import { formatContentPercent } from '../lib/chemicals'
import {
  CHEM_BODY_ROW_KEY,
  CHEM_CELL,
  CHROME_META_LEFT,
  CHROME_META_ROW,
  CHROME_TITLE_ROW,
  DEFAULT_CHEM_CHROME,
  loadChemCellFonts,
  loadChemFormColumns,
  loadChemPageCounts,
  loadChemSheetChrome,
  loadHeaderRowHeights,
  normalizePageCounts,
  pageChunksFromCounts,
  type ChemFormColumn,
  type ChemSheetChrome,
} from '../lib/chemFormLayout'
import { X } from 'lucide-react'
import { ChemLedgerTable, RowHandle, type ChemFormAction } from './ChemLedgerTable'

export const PRINT_PAGE_HEIGHT_MM = 198
export const ALL_TAB_ID = '__all__'

export function printPagePx(): number {
  return (PRINT_PAGE_HEIGHT_MM * 96) / 25.4
}

function withChemPrintProbe<T>(
  sheet: HTMLElement,
  run: (clone: HTMLElement) => T,
  collapseBody = false,
): T {
  const host = document.createElement('div')
  host.className = collapseBody ? 'chem-print-probe is-collapse-body' : 'chem-print-probe'
  const clone = sheet.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.no-print, .chem-page-guides').forEach((node) => node.remove())
  const sourceFields = sheet.querySelectorAll('textarea, input')
  const cloneFields = clone.querySelectorAll('textarea, input')
  sourceFields.forEach((source, index) => {
    const target = cloneFields[index]
    if (
      (source instanceof HTMLTextAreaElement || source instanceof HTMLInputElement) &&
      (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)
    ) {
      target.value = source.value
    }
  })
  if (collapseBody) {
    clone.querySelectorAll<HTMLElement>('tbody tr, tbody td').forEach((node) => {
      node.style.height = ''
      node.style.minHeight = '0'
      node.style.maxHeight = ''
    })
  }
  host.appendChild(clone)
  document.body.appendChild(host)
  const result = run(clone)
  host.remove()
  return result
}

function measurePrintSheetHeight(sheet: HTMLElement): number {
  return withChemPrintProbe(sheet, (clone) =>
    Math.max(clone.scrollHeight, clone.getBoundingClientRect().height),
  )
}

export function countChemPrintPages(sheet: HTMLElement): number {
  return Math.max(1, Math.ceil(measurePrintSheetHeight(sheet) / printPagePx()))
}

function offsetH(root: HTMLElement, selector: string): number {
  const node = root.querySelector(selector)
  return node instanceof HTMLElement ? node.getBoundingClientRect().height : 0
}

function printChromeHeight(root: HTMLElement): number {
  return (
    offsetH(root, '.chem-legal') +
    offsetH(root, '.chem-title-row') +
    offsetH(root, '.chem-meta') +
    offsetH(root, 'thead') +
    offsetH(root, '.chem-foot')
  )
}

function printBodyAvail(sheet: HTMLElement): number {
  return withChemPrintProbe(sheet, (clone) => Math.max(48, printPagePx() - printChromeHeight(clone)), true)
}

function chromeRowStyle(height: number | undefined): CSSProperties | undefined {
  if (height == null) return undefined
  return {
    height,
    minHeight: height,
    maxHeight: height,
    boxSizing: 'border-box',
  }
}

export function chunkLedgerRows(
  sheet: HTMLElement,
  rowCount: number,
): { start: number; end: number }[] {
  if (rowCount <= 0) return [{ start: 0, end: 0 }]
  const host = document.createElement('div')
  host.className = 'chem-print-probe'
  const clone = sheet.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.no-print, .chem-page-guides').forEach((node) => node.remove())
  const sourceFields = sheet.querySelectorAll('textarea, input')
  const cloneFields = clone.querySelectorAll('textarea, input')
  sourceFields.forEach((source, index) => {
    const target = cloneFields[index]
    if (
      (source instanceof HTMLTextAreaElement || source instanceof HTMLInputElement) &&
      (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)
    ) {
      target.value = source.value
    }
  })
  clone.querySelectorAll<HTMLElement>('tbody tr, tbody td').forEach((node) => {
    if (node.style.height || node.style.maxHeight) return
    node.style.minHeight = '0'
  })
  host.appendChild(clone)
  document.body.appendChild(host)
  const page = printPagePx()
  const chrome =
    offsetH(clone, '.chem-legal') +
    offsetH(clone, '.chem-title-row') +
    offsetH(clone, '.chem-meta') +
    offsetH(clone, 'thead') +
    offsetH(clone, '.chem-foot')
  const avail = Math.max(48, page - chrome)
  const rowEls = [...clone.querySelectorAll('tbody tr')] as HTMLElement[]
  const measured = rowEls.map((row) => {
    const styled = Number.parseFloat(row.style.height || row.style.maxHeight || '')
    const rendered = row.getBoundingClientRect().height
    return Math.max(rendered, Number.isFinite(styled) ? styled : 0, 16)
  })
  const avg = measured.length ? measured.reduce((sum, h) => sum + h, 0) / measured.length : 22
  const heights = Array.from({ length: rowCount }, (_, index) => measured[index] ?? avg)
  host.remove()

  const chunks: { start: number; end: number }[] = []
  let start = 0
  let used = 0
  for (let index = 0; index < rowCount; index += 1) {
    const height = heights[index] ?? avg
    if (index > start && used + height > avail) {
      chunks.push({ start, end: index })
      start = index
      used = 0
    }
    used += height
  }
  chunks.push({ start, end: rowCount })
  return chunks
}

export function extraChemPrintGuides(sheet: HTMLElement, rowCount: number): number {
  return Math.max(0, chunkLedgerRows(sheet, rowCount).length - 1)
}

const MIN_FILL_ROW_PX = 16

function assignRef<T>(ref: RefObject<T | null> | undefined, node: T | null) {
  if (ref) (ref as { current: T | null }).current = node
}

export function ChemPageDeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      className="chem-page-del no-print"
      aria-label="이 페이지 삭제"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onDelete()
      }}
    >
      <X size={14} />
    </button>
  )
}

const CLASS_WORDS = ['금지물질', '허가물질', '제한물질', '유독물질', '사고대비물질'] as const

function activeClassWords(meta: ChemicalLedgerMeta): string[] {
  return [meta.category1, meta.category2, meta.category3]
    .map((item) => item.trim())
    .filter(Boolean)
}

function matchesClassWord(word: string, active: string[]): boolean {
  return active.some((item) => item === word || item.includes(word))
}

function stackPageLabel(name: string, page: number, total?: number) {
  return total ? `${name} ${page}/${total}` : `${name} · ${page}쪽`
}

function ClassWord({ word, active }: { word: string; active: string[] }) {
  return <span className={matchesClassWord(word, active) ? 'chem-hl' : undefined}>{word}</span>
}

function ChromeField({
  value,
  editing,
  className,
  ariaLabel,
  wide,
  onChange,
}: {
  value: string
  editing: boolean
  className?: string
  ariaLabel: string
  wide?: boolean
  onChange: (value: string) => void
}) {
  if (!editing) return <span className={className}>{value}</span>
  return (
    <input
      className={`chem-chrome-input${wide ? ' is-wide' : ''}${className ? ` ${className}` : ''}`}
      value={value}
      aria-label={ariaLabel}
      size={wide ? undefined : Math.max(2, value.length || 2)}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function MarkBox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button className="chem-mark" type="button" onClick={onToggle} aria-pressed={checked}>
      <span className={`chem-box ${checked ? 'on' : ''}`}>{checked ? '○' : ''}</span>
      {label}
    </button>
  )
}

export function ChemLedgerSheet({
  ledger,
  year,
  formEdit,
  formAction,
  columns,
  chrome,
  rowHeights,
  fillRowHeight,
  colPx,
  flashColId,
  flashRowId,
  showPageGuides,
  extraGuides,
  showFirstGuide = false,
  pageStart = 1,
  pageTotal,
  pageLabel,
  sheetRef,
  tableWrapRef,
  onChromeChange,
  onUpdateCell,
  onUpdateMeta,
  onToggleActivity,
  onRenameProduct,
  onDeleteRow,
  onInsertRow,
  onInsertCol,
  onDeleteCol,
  onRenameCol,
  onRenameBlock,
  onResizeStart,
  onRowResizeStart,
  cellFonts = {},
  selectedCellIds = [],
  onSelectCells,
}: {
  ledger: ChemicalLedger
  year: number
  formEdit: boolean
  formAction: ChemFormAction
  columns: ChemFormColumn[]
  chrome: ChemSheetChrome
  rowHeights: Record<string, number>
  fillRowHeight: number | null
  colPx: Record<string, number>
  flashColId: string | null
  flashRowId: string | null
  showPageGuides: boolean
  extraGuides: number
  showFirstGuide?: boolean
  pageStart?: number
  pageTotal?: number
  pageLabel?: string
  sheetRef?: RefObject<HTMLFormElement | null>
  tableWrapRef?: RefObject<HTMLDivElement | null>
  onChromeChange: (patch: Partial<ChemSheetChrome>, source: string) => void
  onUpdateCell: (rowId: string, column: ChemFormColumn, value: string) => void
  onUpdateMeta: (patch: Partial<ChemicalLedgerMeta>) => void
  onToggleActivity: (key: keyof ChemicalActivities) => void
  onRenameProduct: (productName: string) => void
  onDeleteRow: (rowId: string) => void
  onInsertRow: (afterId: string) => void
  onInsertCol: (afterId: string) => void
  onDeleteCol: (id: string) => void
  onRenameCol: (id: string, label: string) => void
  onRenameBlock: (id: string, block: string) => void
  onResizeStart: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart: (rowId: string, event: MouseEvent<HTMLButtonElement>) => void
  cellFonts?: Record<string, number>
  selectedCellIds?: string[]
  onSelectCells?: (ids: string[]) => void
}) {
  const classWords = activeClassWords(ledger.meta)
  const caption = pageLabel || ledger.tabName || ledger.meta.productName || '새 물질'
  const ownSheetRef = useRef<HTMLFormElement>(null)
  const ownWrapRef = useRef<HTMLDivElement>(null)
  const [localFill, setLocalFill] = useState<number | null>(null)
  const [overflowGuides, setOverflowGuides] = useState(0)
  const lockedBody = rowHeights[CHEM_BODY_ROW_KEY] != null
  const fillH = fillRowHeight ?? localFill
  const pickChrome = (cellId: string) => {
    if (!formEdit || formAction || !onSelectCells) return undefined
    return () => onSelectCells([cellId])
  }
  const chromeFont = (cellId: string, extra?: CSSProperties): CSSProperties | undefined => {
    const size = cellFonts[cellId]
    if (size == null) return extra
    return { ...extra, fontSize: `${size}px` }
  }
  const chromeClass = (base: string, cellId: string) =>
    `${base}${formEdit && selectedCellIds.includes(cellId) ? ' is-cell-on' : ''}${cellFonts[cellId] != null ? ' is-cell-font' : ''}`

  useLayoutEffect(() => {
    if (lockedBody || fillRowHeight != null) {
      if (fillRowHeight == null) setLocalFill(null)
      return
    }
    const wrap = ownWrapRef.current
    if (!wrap) return
    const measure = () => {
      if (document.body.classList.contains('chem-resizing-row')) return
      if (document.body.classList.contains('chem-printing')) return
      const sheet = ownSheetRef.current
      if (!sheet) return
      const n = Math.max(1, wrap.querySelectorAll('tbody tr').length)
      const available = printBodyAvail(sheet)
      if (available <= 0) return
      const next = Math.max(MIN_FILL_ROW_PX, available / n)
      setLocalFill((prev) => (prev != null && Math.abs(prev - next) < 0.05 ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(measure)
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [lockedBody, fillRowHeight, ledger.rows.length, formEdit, columns, chrome, rowHeights])

  useLayoutEffect(() => {
    const sheet = ownSheetRef.current
    if (!sheet) return
    const update = () => {
      if (document.body.classList.contains('chem-printing')) return
      const next = Math.max(0, countChemPrintPages(sheet) - 1)
      setOverflowGuides((prev) => (prev === next ? prev : next))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [ledger.rows.length, fillH, formEdit, columns, chrome, rowHeights, cellFonts])

  const guideCount = Math.max(extraGuides, overflowGuides)
  const printTotal = Math.max(pageTotal ?? 1, pageStart + guideCount)
  const showHeadBadge = Boolean(showFirstGuide || (guideCount > 0 && (pageTotal ?? 1) <= 1))

  return (
    <form
      className="chem-sheet"
      ref={(node) => {
        ownSheetRef.current = node
        assignRef(sheetRef, node)
      }}
      onSubmit={(event) => event.preventDefault()}
    >
      {showPageGuides || showHeadBadge || guideCount > 0 ? (
        <div className="chem-page-guides no-print" aria-hidden="true">
          {showHeadBadge ? (
            <div className="chem-page-guide is-first">
              <span>{stackPageLabel(caption, pageStart, printTotal)}</span>
            </div>
          ) : null}
          {Array.from({ length: guideCount }, (_, index) => (
            <div
              key={index}
              className="chem-page-guide"
              style={{ top: `${PRINT_PAGE_HEIGHT_MM * (index + 1)}mm` }}
            >
              <span>{stackPageLabel(caption, pageStart + index + 1, printTotal)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p
        className={chromeClass('chem-legal', CHEM_CELL.legal)}
        style={chromeFont(CHEM_CELL.legal)}
        data-cell-id={CHEM_CELL.legal}
        onMouseDown={pickChrome(CHEM_CELL.legal)}
      >
        <ChromeField
          value={chrome.legal}
          editing={formEdit}
          wide
          ariaLabel="서식 근거"
          onChange={(legal) => onChromeChange({ legal }, 'chrome:legal')}
        />
      </p>

      <div className="chem-frame">
        <div
          className={chromeClass(`chem-title-row${formEdit ? ' is-chrome-edit' : ''}`, CHEM_CELL.title)}
          data-row-id={CHROME_TITLE_ROW}
          data-cell-id={CHEM_CELL.title}
          style={chromeFont(CHEM_CELL.title, chromeRowStyle(rowHeights[CHROME_TITLE_ROW]))}
          onMouseDown={pickChrome(CHEM_CELL.title)}
        >
          {formEdit ? (
            <RowHandle
              className="chem-chrome-row-handle"
              onResizeStart={(event) => onRowResizeStart(CHROME_TITLE_ROW, event)}
            />
          ) : null}
          <strong>
            <ChromeField
              value={chrome.titleBefore}
              editing={formEdit}
              ariaLabel="제목 앞"
              onChange={(titleBefore) => onChromeChange({ titleBefore }, 'chrome:titleBefore')}
            />
          </strong>
          <MarkBox
            checked={ledger.meta.activities.manufacture}
            onToggle={() => onToggleActivity('manufacture')}
            label="제조"
          />
          <MarkBox
            checked={ledger.meta.activities.import}
            onToggle={() => onToggleActivity('import')}
            label="수입"
          />
          <MarkBox
            checked={ledger.meta.activities.use}
            onToggle={() => onToggleActivity('use')}
            label="사용"
          />
          <MarkBox
            checked={ledger.meta.activities.sale}
            onToggle={() => onToggleActivity('sale')}
            label="판매"
          />
          <strong>
            <ChromeField
              value={chrome.titleAfter}
              editing={formEdit}
              ariaLabel="제목 뒤"
              onChange={(titleAfter) => onChromeChange({ titleAfter }, 'chrome:titleAfter')}
            />
          </strong>
        </div>

        <div
          className={chromeClass(`chem-meta${formEdit ? ' is-chrome-edit' : ''}`, CHEM_CELL.meta)}
          data-row-id={CHROME_META_ROW}
          data-cell-id={CHEM_CELL.meta}
          style={chromeFont(CHEM_CELL.meta, chromeRowStyle(rowHeights[CHROME_META_ROW]))}
          onMouseDown={pickChrome(CHEM_CELL.meta)}
        >
          {formEdit ? (
            <>
              <RowHandle
                className="chem-chrome-row-handle"
                onResizeStart={(event) => onRowResizeStart(CHROME_META_ROW, event)}
              />
              <button
                className="chem-meta-split no-print"
                type="button"
                aria-label="상단 열 너비 조절"
                style={{ left: `${chrome.metaLeftPct ?? 50}%` }}
                onMouseDown={(event) => onResizeStart(CHROME_META_LEFT, event)}
              />
            </>
          ) : null}
          <div
            className="chem-align-grid"
            style={{ ['--chem-meta-left' as string]: `${chrome.metaLeftPct ?? 50}%` }}
          >
            <label className="chem-inline">
              <span>제품(상품)명 :</span>
              <input value={ledger.meta.productName} onChange={(event) => onRenameProduct(event.target.value)} />
            </label>
            <label className="chem-inline chem-use">
              <span>주요용도 :</span>
              <input
                value={ledger.meta.mainUse}
                onChange={(event) => onUpdateMeta({ mainUse: event.target.value })}
              />
            </label>
            <span className="chem-align-spacer" />

            <span className="chem-class-label">
              {CLASS_WORDS.map((word, index) => (
                <span key={word}>
                  {index > 0 ? ', ' : ''}
                  <ClassWord word={word} active={classWords} />
                </span>
              ))}
            </span>
            <label className="chem-inline">
              <span>1.</span>
              <input
                value={ledger.meta.category1}
                onChange={(event) => onUpdateMeta({ category1: event.target.value })}
              />
            </label>
            <label className="chem-inline">
              <span>2.</span>
              <input
                value={ledger.meta.category2}
                onChange={(event) => onUpdateMeta({ category2: event.target.value })}
              />
            </label>
            <label className="chem-inline">
              <span>3.</span>
              <input
                value={ledger.meta.category3}
                onChange={(event) => onUpdateMeta({ category3: event.target.value })}
              />
            </label>
            <span className="chem-align-spacer" />

            <label className="chem-inline chem-content-lead">
              <span>함량 :</span>
              <input
                value={ledger.meta.content}
                onChange={(event) => onUpdateMeta({ content: formatContentPercent(event.target.value) })}
              />
            </label>
            <label className="chem-inline">
              <span>1.</span>
              <input
                value={ledger.meta.content1}
                onChange={(event) => onUpdateMeta({ content1: formatContentPercent(event.target.value) })}
              />
            </label>
            <label className="chem-inline">
              <span>2.</span>
              <input
                value={ledger.meta.content2}
                onChange={(event) => onUpdateMeta({ content2: formatContentPercent(event.target.value) })}
              />
            </label>
            <label className="chem-inline">
              <span>3.</span>
              <input
                value={ledger.meta.content3}
                onChange={(event) => onUpdateMeta({ content3: formatContentPercent(event.target.value) })}
              />
            </label>
            <div className="chem-unit">
              <span>(단위 :&nbsp;</span>
              <span className="chem-unit-value">
                <span className="chem-unit-sizer" aria-hidden="true">
                  {ledger.meta.unit || ' '}
                </span>
                <input
                  value={ledger.meta.unit}
                  onChange={(event) => onUpdateMeta({ unit: event.target.value })}
                  aria-label="단위"
                  size={1}
                />
              </span>
              <span>)</span>
            </div>
          </div>
        </div>

        <div
          className="chem-table-wrap"
          ref={(node) => {
            ownWrapRef.current = node
            assignRef(tableWrapRef, node)
          }}
        >
          <ChemLedgerTable
            columns={columns}
            rows={ledger.rows}
            unit={ledger.meta.unit}
            year={year}
            formEdit={formEdit}
            formAction={formAction}
            rowHeights={rowHeights}
            fillRowHeight={fillH}
            onUpdateCell={onUpdateCell}
            onDeleteRow={onDeleteRow}
            onInsertRow={onInsertRow}
            onInsertCol={onInsertCol}
            colPx={colPx}
            flashColId={flashColId}
            flashRowId={flashRowId}
            cellFonts={cellFonts}
            selectedCellIds={selectedCellIds}
            onSelectCells={onSelectCells}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onDeleteCol={onDeleteCol}
            onRename={onRenameCol}
            onRenameBlock={onRenameBlock}
            inSection={chrome.inSection ?? DEFAULT_CHEM_CHROME.inSection}
            outSection={chrome.outSection ?? DEFAULT_CHEM_CHROME.outSection}
            onRenameSection={(group, title) =>
              onChromeChange(
                group === 'in' ? { inSection: title } : { outSection: title },
                `chrome:${group}Section`,
              )
            }
          />
        </div>
      </div>

      <div className="chem-foot">
        <span
          className={chromeClass('chem-paper-size', CHEM_CELL.footer)}
          data-cell-id={CHEM_CELL.footer}
          style={chromeFont(CHEM_CELL.footer)}
          onMouseDown={pickChrome(CHEM_CELL.footer)}
        >
          <ChromeField
            value={chrome.footer}
            editing={formEdit}
            ariaLabel="용지 표시"
            onChange={(footer) => onChromeChange({ footer }, 'chrome:footer')}
          />
        </span>
      </div>
    </form>
  )
}


function ChemLedgerAllSheet({
  ledger,
  year,
  pageStart,
  pageTotal,
  pageCounts,
  selectedPageIndex,
  onSelectPage,
  onDeletePage,
  onUpdateLedger,
  formEdit,
  formAction,
  sharedColumns,
  sharedChrome,
  sharedRowHeights,
  colPx,
  flashColId,
  flashRowId,
  onChromeChange,
  onInsertCol,
  onDeleteCol,
  onRenameCol,
  onRenameBlock,
  onResizeStart,
  onRowResizeStart,
  onInsertRow,
  onDeleteRow,
  cellFonts,
  selectedCellIds,
  onSelectCells,
}: {
  ledger: ChemicalLedger
  year: number
  pageStart: number
  pageTotal: number
  pageCounts: number[]
  selectedPageIndex?: number | null
  onSelectPage?: (index: number) => void
  onDeletePage?: (index: number) => void
  onUpdateLedger: (id: string, patch: Partial<ChemicalLedger>) => void
  formEdit: boolean
  formAction: ChemFormAction
  sharedColumns?: ChemFormColumn[]
  sharedChrome?: ChemSheetChrome
  sharedRowHeights?: Record<string, number>
  colPx: Record<string, number>
  flashColId: string | null
  flashRowId: string | null
  onChromeChange: (patch: Partial<ChemSheetChrome>, source: string) => void
  onInsertCol: (afterId: string) => void
  onDeleteCol: (id: string) => void
  onRenameCol: (id: string, label: string) => void
  onRenameBlock: (id: string, block: string) => void
  onResizeStart: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart: (rowId: string, event: MouseEvent<HTMLButtonElement>) => void
  onInsertRow: (afterId: string) => void
  onDeleteRow: (rowId: string) => void
  cellFonts?: Record<string, number>
  selectedCellIds?: string[]
  onSelectCells?: (ids: string[]) => void
}) {
  const columns = sharedColumns ?? loadChemFormColumns(ledger.id)
  const chrome = sharedChrome ?? loadChemSheetChrome(ledger.id)
  const rowHeights = sharedRowHeights ?? loadHeaderRowHeights(ledger.id)
  const fonts = cellFonts ?? loadChemCellFonts(ledger.id)
  const caption = ledger.tabName || ledger.meta.productName || '새 물질'
  const pages = pageChunksFromCounts(normalizePageCounts(pageCounts, ledger.rows.length))

  const updateMeta = (patch: Partial<ChemicalLedgerMeta>) => {
    onUpdateLedger(ledger.id, { meta: { ...ledger.meta, ...patch } })
  }

  return (
    <>
      {pages.map((chunk, index) => {
        const pageOn = Boolean(formEdit && selectedPageIndex === index)
        return (
        <div
          key={`${ledger.id}-p${index}`}
          className={`chem-paper chem-stack-paper${pageOn ? ' is-page-on' : ''}`}
          data-chem-stack-id={ledger.id}
          data-chem-name={caption}
          onMouseDown={() => {
            if (formEdit) onSelectPage?.(index)
          }}
        >
          {pageOn && pages.length > 1 && onDeletePage ? (
            <ChemPageDeleteButton onDelete={() => onDeletePage(index)} />
          ) : null}
          <div className="chem-page-guides no-print" aria-hidden="true">
            <div className="chem-page-guide is-first">
              <span>{stackPageLabel(caption, pageStart + index, pageTotal)}</span>
            </div>
          </div>
          <ChemLedgerSheet
            ledger={{ ...ledger, rows: ledger.rows.slice(chunk.start, chunk.end) }}
            year={year}
            formEdit={formEdit}
            formAction={pageOn ? formAction : null}
            columns={columns}
            chrome={chrome}
            rowHeights={rowHeights}
            fillRowHeight={null}
            colPx={colPx}
            flashColId={flashColId}
            flashRowId={flashRowId}
            cellFonts={fonts}
            selectedCellIds={pageOn ? selectedCellIds : []}
            onSelectCells={onSelectCells}
            showPageGuides={false}
            extraGuides={0}
            pageStart={pageStart + index}
            pageTotal={pageTotal}
            pageLabel={caption}
            onChromeChange={formEdit ? onChromeChange : () => {}}
            onUpdateCell={(rowId, column, value) => {
              if (column.key.startsWith('extra:')) {
                const extraKey = column.key.slice(6)
                const row = ledger.rows.find((item) => item.id === rowId)
                onUpdateLedger(ledger.id, {
                  rows: ledger.rows.map((item) =>
                    item.id === rowId ? { ...item, extra: { ...row?.extra, [extraKey]: value } } : item,
                  ),
                })
                return
              }
              onUpdateLedger(ledger.id, {
                rows: ledger.rows.map((item) =>
                  item.id === rowId ? { ...item, [column.key]: value } : item,
                ),
              })
            }}
            onUpdateMeta={updateMeta}
            onToggleActivity={(key) =>
              updateMeta({ activities: { ...ledger.meta.activities, [key]: !ledger.meta.activities[key] } })
            }
            onRenameProduct={(productName) => {
              onUpdateLedger(ledger.id, {
                meta: { ...ledger.meta, productName },
                tabName:
                  ledger.tabName === ledger.meta.productName || !ledger.tabName
                    ? productName || '새 물질'
                    : ledger.tabName,
              })
            }}
            onDeleteRow={onDeleteRow}
            onInsertRow={onInsertRow}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
            onRenameCol={onRenameCol}
            onRenameBlock={onRenameBlock}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
          />
        </div>
        )
      })}
    </>
  )
}

export function ChemLedgerAllView({
  ledgers,
  year,
  onUpdateLedger,
  formEdit = false,
  formAction = null,
  sharedColumns,
  sharedChrome,
  sharedRowHeights,
  colPx = {},
  flashColId = null,
  flashRowId = null,
  onChromeChange,
  onInsertCol,
  onDeleteCol,
  onRenameCol,
  onRenameBlock,
  onResizeStart,
  onRowResizeStart,
  onInsertRow,
  onDeleteRow,
  cellFonts,
  selectedCellIds,
  onSelectCells,
  pageCountsById = {},
  selectedPage,
  onSelectPage,
  onDeletePage,
}: {
  ledgers: ChemicalLedger[]
  year: number
  onUpdateLedger: (id: string, patch: Partial<ChemicalLedger>) => void
  formEdit?: boolean
  formAction?: ChemFormAction
  sharedColumns?: ChemFormColumn[]
  sharedChrome?: ChemSheetChrome
  sharedRowHeights?: Record<string, number>
  colPx?: Record<string, number>
  flashColId?: string | null
  flashRowId?: string | null
  onChromeChange?: (patch: Partial<ChemSheetChrome>, source: string) => void
  onInsertCol?: (afterId: string) => void
  onDeleteCol?: (id: string) => void
  onRenameCol?: (id: string, label: string) => void
  onRenameBlock?: (id: string, block: string) => void
  onResizeStart?: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart?: (rowId: string, event: MouseEvent<HTMLButtonElement>) => void
  onInsertRow?: (ledgerId: string, afterId: string) => void
  onDeleteRow?: (ledgerId: string, rowId: string) => void
  cellFonts?: Record<string, number>
  selectedCellIds?: string[]
  onSelectCells?: (ids: string[]) => void
  pageCountsById?: Record<string, number[]>
  selectedPage?: { ledgerId: string; index: number } | null
  onSelectPage?: (page: { ledgerId: string; index: number }) => void
  onDeletePage?: (ledgerId: string, index: number) => void
}) {
  const offsets = useMemo(() => {
    const map: Record<string, number> = {}
    let acc = 0
    for (const item of ledgers) {
      map[item.id] = acc
      const counts = normalizePageCounts(pageCountsById[item.id] ?? loadChemPageCounts(item.id, item.rows.length), item.rows.length)
      acc += counts.length
    }
    return map
  }, [ledgers, pageCountsById])

  const totalPages = useMemo(
    () =>
      ledgers.reduce((sum, item) => {
        const counts = normalizePageCounts(pageCountsById[item.id] ?? loadChemPageCounts(item.id, item.rows.length), item.rows.length)
        return sum + counts.length
      }, 0),
    [ledgers, pageCountsById],
  )

  return (
    <div className="chem-all-wrap">
      <div className="chem-all-stack">
        {ledgers.map((ledger) => {
          const counts = normalizePageCounts(
            pageCountsById[ledger.id] ?? loadChemPageCounts(ledger.id, ledger.rows.length),
            ledger.rows.length,
          )
          return (
          <ChemLedgerAllSheet
            key={ledger.id}
            ledger={ledger}
            year={year}
            pageStart={(offsets[ledger.id] ?? 0) + 1}
            pageTotal={Math.max(1, totalPages)}
            pageCounts={counts}
            selectedPageIndex={selectedPage?.ledgerId === ledger.id ? selectedPage.index : null}
            onSelectPage={(index) => onSelectPage?.({ ledgerId: ledger.id, index })}
            onDeletePage={(index) => onDeletePage?.(ledger.id, index)}
            onUpdateLedger={onUpdateLedger}
            formEdit={formEdit}
            formAction={formAction}
            sharedColumns={sharedColumns}
            sharedChrome={sharedChrome}
            sharedRowHeights={sharedRowHeights}
            colPx={colPx}
            flashColId={flashColId}
            flashRowId={flashRowId}
            onChromeChange={onChromeChange ?? (() => {})}
            onInsertCol={onInsertCol ?? (() => {})}
            onDeleteCol={onDeleteCol ?? (() => {})}
            onRenameCol={onRenameCol ?? (() => {})}
            onRenameBlock={onRenameBlock ?? (() => {})}
            onResizeStart={onResizeStart ?? (() => {})}
            onRowResizeStart={onRowResizeStart ?? (() => {})}
            onInsertRow={(afterId) => onInsertRow?.(ledger.id, afterId)}
            onDeleteRow={(rowId) => onDeleteRow?.(ledger.id, rowId)}
            cellFonts={cellFonts}
            selectedCellIds={selectedCellIds}
            onSelectCells={onSelectCells}
          />
          )
        })}
      </div>
    </div>
  )
}

