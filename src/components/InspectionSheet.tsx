import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import signGyejang from '../assets/insp-sign-gyejang.png'
import { PRINT_PAGE_HEIGHT_MM } from './ChemLedgerSheet'
import { type ChemFormAction } from './ChemLedgerTable'
import { useAppData } from '../context/AppDataContext'
import { pad2 } from '../lib/date'
import { dayConfirmMark, itemKey, recordHasIssueMark } from '../lib/inspections'
import {
  parseFractionParts,
  readingUnit,
  resolveInputKind,
  sanitizeFractionDigit,
  shouldHighlightCriteria,
  splitCriteriaHighlight,
} from '../lib/inputKind'
import {
  DEFAULT_INSP_COL_PCT,
  emptyInspLayout,
  INSP_ALL_TAB_ID,
  inspCellId,
  loadInspFormLayout,
  type InspColId,
  type InspFormLayout,
  type InspSheetChrome,
} from '../lib/inspSheet'
import type {
  CheckItem,
  CheckResult,
  Equipment,
  InputKind,
  InspectionRecord,
  TimingCode,
} from '../types'

function fontStyle(cellId: string, fonts?: Record<string, number>): { fontSize: string } | undefined {
  const size = fonts?.[cellId] ?? undefined
  if (size == null) return undefined
  return { fontSize: `${size}px` }
}

function CriteriaText({ text, highlight }: { text: string; highlight: boolean }) {
  if (!highlight) return <>{text}</>
  return (
    <>
      {splitCriteriaHighlight(text).map((part, index) =>
        part.highlight ? (
          <span key={`${part.text}-${index}`} className="criteria-num">
            {part.text}
          </span>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  )
}

function focusInspCell(day: number, row: number, from?: EventTarget | null) {
  const root = from instanceof Element ? from.closest('table') ?? document : document
  root.querySelector<HTMLElement>(`[data-insp-cell="${day}-${row}"]`)?.focus()
}

function handleDayKey(
  event: KeyboardEvent,
  day: number,
  row: number,
  lastDay: number,
  mode: 'mark' | 'number' | 'fraction-num' | 'fraction-den' | 'status',
) {
  const from = event.currentTarget
  if (event.key === 'ArrowLeft' && day > 1) {
    event.preventDefault()
    focusInspCell(day - 1, row, from)
    return
  }
  if (event.key === 'ArrowRight' && day < lastDay) {
    event.preventDefault()
    focusInspCell(day + 1, row, from)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    focusInspCell(day, row - 1, from)
    return
  }
  if (event.key === 'ArrowDown' || (event.key === 'Enter' && mode !== 'mark' && mode !== 'status')) {
    event.preventDefault()
    focusInspCell(day, row + 1, from)
    return
  }
  if (event.key !== 'Tab') return
  if (mode === 'fraction-num' && !event.shiftKey) return
  if (mode === 'fraction-den' && event.shiftKey) return
  event.preventDefault()
  if (event.shiftKey) {
    if (day > 1) focusInspCell(day - 1, row, from)
    else focusInspCell(lastDay, row - 1, from)
    return
  }
  if (day < lastDay) focusInspCell(day + 1, row, from)
  else focusInspCell(1, row + 1, from)
}

function FractionInput({
  num,
  den,
  numLabel,
  denLabel,
  day,
  row,
  lastDay,
  onFocusCell,
  onNumChange,
  onDenChange,
}: {
  num: string
  den: string
  numLabel: string
  denLabel: string
  day: number
  row: number
  lastDay: number
  onFocusCell: () => void
  onNumChange: (value: string) => void
  onDenChange: (value: string) => void
}) {
  const showSlash = Boolean(num || den)
  return (
    <div className={`insp-fraction${showSlash ? ' has-value' : ''}`}>
      <input
        value={num.slice(0, 1)}
        size={1}
        maxLength={1}
        inputMode="numeric"
        aria-label={numLabel}
        data-insp-cell={`${day}-${row}`}
        onFocus={onFocusCell}
        onKeyDown={(event) => handleDayKey(event, day, row, lastDay, 'fraction-num')}
        onChange={(event) => {
          const next = sanitizeFractionDigit(event.target.value)
          onNumChange(next)
          if (!next) return
          const denInput = event.currentTarget.parentElement?.querySelectorAll('input')[1]
          window.requestAnimationFrame(() => denInput?.focus())
        }}
      />
      <span>/</span>
      <input
        value={den.slice(0, 1)}
        size={1}
        maxLength={1}
        inputMode="numeric"
        aria-label={denLabel}
        onFocus={onFocusCell}
        onKeyDown={(event) => handleDayKey(event, day, row, lastDay, 'fraction-den')}
        onChange={(event) => onDenChange(sanitizeFractionDigit(event.target.value))}
      />
    </div>
  )
}

function markClass(mark: CheckResult): string {
  if (mark === 'O') return ' is-ok'
  if (mark === 'X') return ' is-bad'
  if (mark === '휴') return ' is-off'
  return ''
}

function dayColClass(date: string, selectedDates: string[], today: string, printing: boolean): string {
  if (printing) return 'day-col'
  return `day-col${selectedDates.includes(date) ? ' is-active' : ''}${date === today ? ' is-today' : ''}`
}

function ColHandle({
  colId,
  onStart,
}: {
  colId: InspColId
  onStart?: (id: InspColId, event: MouseEvent<HTMLButtonElement>) => void
}) {
  if (!onStart) return null
  return (
    <button
      className="chem-col-handle no-print"
      type="button"
      aria-label="열 너비 조절"
      onMouseDown={(event) => onStart(colId, event)}
    />
  )
}

function RowHandle({
  rowId,
  onStart,
}: {
  rowId: string
  onStart?: (id: string, event: MouseEvent<HTMLButtonElement>) => void
}) {
  if (!onStart) return null
  return (
    <button
      className="chem-row-handle no-print"
      type="button"
      aria-label="행 높이 조절"
      onMouseDown={(event) => onStart(rowId, event)}
    />
  )
}

function CellHandles({
  colId,
  rowId,
  formCol,
  formRow,
  selectedCols,
  selectedRows,
  onCol,
  onRow,
}: {
  colId?: InspColId
  rowId?: string
  formCol?: string
  formRow?: string
  selectedCols: Set<string>
  selectedRows: Set<string>
  onCol?: (id: InspColId, event: MouseEvent<HTMLButtonElement>) => void
  onRow?: (id: string, event: MouseEvent<HTMLButtonElement>) => void
}) {
  const showCol = Boolean(colId && onCol && selectedCols.has(formCol ?? colId))
  const showRow = Boolean(rowId && onRow && selectedRows.has(formRow ?? rowId))
  if (!showCol && !showRow) return null
  return (
    <>
      {showCol && colId ? <ColHandle colId={colId} onStart={onCol} /> : null}
      {showRow && rowId ? <RowHandle rowId={rowId} onStart={onRow} /> : null}
    </>
  )
}

function colWidth(id: InspColId, layout: InspFormLayout, fallback: string): string {
  const pct = layout.colPct[id]
  return pct != null ? `${pct}%` : fallback
}

function rowStyle(rowId: string, layout: InspFormLayout): { height: number } | undefined {
  const height = layout.rowHeights[rowId]
  return height ? { height } : undefined
}

export type InspectionSheetProps = {
  equipment: Equipment
  year: number
  month: number
  days: number[]
  monthPrefix: string
  today: string
  selectedDates: string[]
  inspectorName: string
  inspectors: string[]
  inspectorWarn?: boolean
  chrome: InspSheetChrome
  recordsByDate: Map<string, InspectionRecord>
  formEdit: boolean
  formAction?: ChemFormAction
  printing?: boolean
  layoutOnly?: boolean
  draggingItemId?: string | null
  selectedCellIds?: string[]
  onSelectCell?: (cellId: string, additive: boolean) => void
  onInsertItem?: (itemId: string) => void
  onSelectDate: (date: string) => void
  onDaySelectStart?: (date: string, event: PointerEvent<HTMLButtonElement>) => void
  onToggleCell: (day: number, itemNo: number) => void
  onSaveReading: (day: number, item: CheckItem, value: string) => void
  onSaveFraction: (day: number, item: CheckItem, reading: string, part: 'num' | 'den', value: string) => void
  onToggleDayOk: (day: number) => void
  onChromeChange: (patch: Partial<InspSheetChrome>) => void
  onRenameEquipment: (patch: Partial<Pick<Equipment, 'name' | 'shortName'>>) => void
  onUpdateItem: (itemId: string, patch: Partial<CheckItem>) => void
  onDeleteItem: (itemId: string) => void
  onItemDragStart?: (itemId: string) => void
  onItemDragOver?: () => void
  onItemDrop?: (itemId: string) => void
  onItemDragEnd?: () => void
  onIssueNoteChange: (day: number, value: string) => void
  onRequestDateChange: (day: number, value: string) => void
  onConfirmDateChange: (day: number, value: string) => void
  onInspectorChange: (name: string) => void
  layout?: InspFormLayout
  onColResizeStart?: (id: InspColId, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart?: (id: string, event: MouseEvent<HTMLButtonElement>) => void
}

export function InspectionSheet({
  equipment,
  year,
  month,
  days,
  monthPrefix,
  today,
  selectedDates,
  inspectorName,
  inspectors,
  inspectorWarn = false,
  chrome,
  recordsByDate,
  formEdit,
  formAction = null,
  printing = false,
  layoutOnly = false,
  selectedCellIds = [],
  onSelectCell,
  onInsertItem,
  onSelectDate,
  onDaySelectStart,
  onToggleCell,
  onSaveReading,
  onSaveFraction,
  onToggleDayOk,
  onChromeChange,
  onRenameEquipment,
  onUpdateItem,
  onDeleteItem,
  onIssueNoteChange,
  onRequestDateChange,
  onConfirmDateChange,
  onInspectorChange,
  layout = emptyInspLayout(),
  onColResizeStart,
  onRowResizeStart,
}: InspectionSheetProps) {
  const title = `${year}년도 ${pad2(month)}월 소그룹 설비 일상 점검표`
  const { approvalStamp } = useAppData()
  const stampSrc = approvalStamp || signGyejang
  const dayCount = days.length
  const editUi = formEdit && !printing
  const editFields = editUi && !layoutOnly
  const showRowTools = editUi && (formAction === 'row-add' || formAction === 'row-del')
  const fonts = layout.cellFonts ?? {}
  const pickCell = (cellId: string, className = '') => {
    const on = editUi && !formAction && selectedCellIds.includes(cellId)
    const sized = fonts[cellId] != null
    return {
      className: [className, on ? 'is-cell-on' : '', sized ? 'is-cell-font' : ''].filter(Boolean).join(' '),
      style: fontStyle(cellId, fonts),
      onMouseDown: (event: MouseEvent<HTMLTableCellElement>) => {
        if (!editUi || formAction || event.button !== 0) return
        if ((event.target as HTMLElement).closest('.chem-col-handle, .chem-row-handle, .chem-row-tools, .icon-btn')) return
        onSelectCell?.(cellId, event.shiftKey || event.ctrlKey || event.metaKey)
      },
    }
  }
  const signSpan = 3
  const stampCols = 1 + signSpan
  const useDayStamp = dayCount >= stampCols
  const stampSpan = useDayStamp ? stampCols : 1
  const titleSpan = 5 + dayCount - 3 - stampSpan
  const dateSpan = Math.max(2, Math.round(dayCount / 8))
  const noteSpan = Math.max(1, 5 + dayCount - 1 - dateSpan * 2)
  const statusRow = equipment.items.length
  const dayWidth = colWidth('day', layout, `${(64 / Math.max(dayCount, 1)).toFixed(3)}%`)
  const canResize = editUi && !formAction
  const resize = canResize ? onColResizeStart : undefined
  const rowResize = canResize ? onRowResizeStart : undefined
  const selectedCols = new Set(selectedCellIds.map((id) => id.slice(id.indexOf(':') + 1)).filter(Boolean))
  const selectedRows = new Set(selectedCellIds.map((id) => id.slice(0, id.indexOf(':'))).filter(Boolean))
  const handles = (opts: { colId?: InspColId; rowId?: string; formCol?: string; formRow?: string }) => (
    <CellHandles
      colId={opts.colId}
      rowId={opts.rowId}
      formCol={opts.formCol}
      formRow={opts.formRow}
      selectedCols={selectedCols}
      selectedRows={selectedRows}
      onCol={resize}
      onRow={rowResize}
    />
  )

  const issueRows = days.flatMap((day) => {
    const record = recordsByDate.get(`${monthPrefix}-${pad2(day)}`)
    if (!recordHasIssueMark(record)) return []
    return [
      {
        day,
        note: record?.issueNote ?? '',
        requestDate: record?.requestDate ?? '',
        confirmDate: record?.confirmDate ?? '',
      },
    ]
  })

  return (
    <div className="insp-paper">
      <table className={`insp-sheet${editUi ? ' is-form-edit' : ''}`}>
        <colgroup>
          {showRowTools ? <col className="col-edit" /> : null}
          <col className="col-equip" style={{ width: colWidth('equip', layout, `${DEFAULT_INSP_COL_PCT.equip}%`) }} />
          <col className="col-no" style={{ width: colWidth('no', layout, `${DEFAULT_INSP_COL_PCT.no}%`) }} />
          <col className="col-point" style={{ width: colWidth('point', layout, `${DEFAULT_INSP_COL_PCT.point}%`) }} />
          <col className="col-timing" style={{ width: colWidth('timing', layout, `${DEFAULT_INSP_COL_PCT.timing}%`) }} />
          <col className="col-criteria" style={{ width: colWidth('criteria', layout, `${DEFAULT_INSP_COL_PCT.criteria}%`) }} />
          {days.map((day) => (
            <col key={day} className="col-day" style={{ width: dayWidth }} />
          ))}
        </colgroup>
        <thead>
          <tr className="insp-banner insp-banner-title" data-row-id="banner-title" style={rowStyle('banner-title', layout)}>
            {showRowTools ? <td className="chem-edit-col no-print" /> : null}
            <th {...pickCell(inspCellId('banner-title', 'title'), 'insp-sheet-title')} colSpan={5 + dayCount} scope="col">
              {title}
              {handles({ colId: 'day', rowId: 'banner-title', formCol: 'title' })}
            </th>
          </tr>
          <tr className="insp-banner" data-row-id="banner-line" style={rowStyle('banner-line', layout)}>
            {showRowTools ? <td className="chem-edit-col no-print" /> : null}
            <th {...pickCell(inspCellId('banner-line', 'equip'))} scope="row">
              라인명
              {handles({ colId: 'equip', rowId: 'banner-line' })}
            </th>
            <td {...pickCell(inspCellId('banner-line', 'point'))} colSpan={2}>
              {editUi ? (
                <input
                  className="insp-sheet-input"
                  value={chrome.lineName}
                  aria-label="라인명"
                  onChange={(event) => onChromeChange({ lineName: event.target.value })}
                />
              ) : (
                chrome.lineName
              )}
              {handles({ colId: 'point', rowId: 'banner-line' })}
            </td>
            <td {...pickCell(inspCellId('banner-line', 'support'), 'insp-support')} rowSpan={2} colSpan={titleSpan}>
              {editUi ? (
                <input
                  className="insp-sheet-input"
                  value={chrome.supportTeam}
                  aria-label="지원팀"
                  onChange={(event) => onChromeChange({ supportTeam: event.target.value })}
                />
              ) : (
                chrome.supportTeam
              )}
              {handles({ colId: 'day', rowId: 'banner-line', formCol: 'support' })}
            </td>
            {useDayStamp ? (
              <>
                <th {...pickCell(inspCellId('banner-line', 'stamp-label'), 'insp-stamp-label')} rowSpan={2} scope="row">
                  {editUi ? (
                    <input
                      className="insp-sheet-input"
                      value={chrome.approvalLabel}
                      aria-label="결재 구분"
                      onChange={(event) => onChromeChange({ approvalLabel: event.target.value })}
                    />
                  ) : (
                    chrome.approvalLabel.split('').map((letter, index) => (
                      <span key={`${letter}-${index}`}>{letter}</span>
                    ))
                  )}
                  {handles({ colId: 'day', rowId: 'banner-line', formCol: 'stamp-label' })}
                </th>
                <th {...pickCell(inspCellId('banner-line', 'stamp-role'), 'insp-stamp-role')} colSpan={signSpan} scope="col">
                  {editUi ? (
                    <input
                      className="insp-sheet-input"
                      value={chrome.approvalRole}
                      aria-label="결재 직책"
                      onChange={(event) => onChromeChange({ approvalRole: event.target.value })}
                    />
                  ) : (
                    chrome.approvalRole
                  )}
                  {handles({ colId: 'day', rowId: 'banner-line', formCol: 'stamp-role' })}
                </th>
              </>
            ) : (
              <td {...pickCell(inspCellId('banner-inspector', 'stamp'), 'insp-approval')} rowSpan={2} colSpan={stampSpan}>
                <table className="insp-stamp">
                  <tbody>
                    <tr>
                      <th className="insp-stamp-label" rowSpan={2} scope="row">
                        {editUi ? (
                          <input
                            className="insp-sheet-input"
                            value={chrome.approvalLabel}
                            aria-label="결재 구분"
                            onChange={(event) => onChromeChange({ approvalLabel: event.target.value })}
                          />
                        ) : (
                          chrome.approvalLabel.split('').map((letter, index) => (
                            <span key={`${letter}-${index}`}>{letter}</span>
                          ))
                        )}
                      </th>
                      <th className="insp-stamp-role" scope="col">
                        {editUi ? (
                          <input
                            className="insp-sheet-input"
                            value={chrome.approvalRole}
                            aria-label="결재 직책"
                            onChange={(event) => onChromeChange({ approvalRole: event.target.value })}
                          />
                        ) : (
                          chrome.approvalRole
                        )}
                      </th>
                    </tr>
                    <tr>
                      <td className="insp-stamp-sign">
                        <img src={stampSrc} alt={`${chrome.approvalRole} 서명`} />
                      </td>
                    </tr>
                  </tbody>
                </table>
                {handles({ colId: 'day', rowId: 'banner-inspector', formCol: 'stamp' })}
              </td>
            )}
          </tr>
          <tr className="insp-banner" data-row-id="banner-inspector" style={rowStyle('banner-inspector', layout)}>
            {showRowTools ? <td className="chem-edit-col no-print" /> : null}
            <th {...pickCell(inspCellId('banner-inspector', 'equip'))} scope="row">
              점검자
              {handles({ colId: 'equip', rowId: 'banner-inspector' })}
            </th>
            <td {...pickCell(inspCellId('banner-inspector', 'point'), 'insp-inspector')} colSpan={2}>
              {printing ? (
                inspectorName || '—'
              ) : (
                <select
                  className={`insp-inspector-select${inspectorWarn ? ' select-warn' : ''}`}
                  value={inspectorName}
                  aria-label="점검자"
                  onChange={(event) => onInspectorChange(event.target.value)}
                >
                  <option value="" disabled>
                    선택
                  </option>
                  {inspectorName && !inspectors.includes(inspectorName) ? (
                    <option value={inspectorName}>{inspectorName}</option>
                  ) : null}
                  {inspectors.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              {handles({ colId: 'point', rowId: 'banner-inspector' })}
            </td>
            {useDayStamp ? (
              <td {...pickCell(inspCellId('banner-inspector', 'stamp-sign'), 'insp-stamp-sign')} colSpan={signSpan}>
                <img src={stampSrc} alt={`${chrome.approvalRole} 서명`} />
                {handles({ colId: 'day', rowId: 'banner-inspector', formCol: 'stamp-sign' })}
              </td>
            ) : null}
          </tr>
          <tr className="insp-cols" data-row-id="cols" style={rowStyle('cols', layout)}>
            {showRowTools ? (
              <th className="chem-edit-col no-print">{formAction === 'row-add' ? '추가' : '삭제'}</th>
            ) : null}
            <th {...pickCell(inspCellId('cols', 'equip'))}>
              설비명
              {handles({ colId: 'equip', rowId: 'cols' })}
            </th>
            <th {...pickCell(inspCellId('cols', 'no'))}>
              NO
              {handles({ colId: 'no', rowId: 'cols' })}
            </th>
            <th {...pickCell(inspCellId('cols', 'point'))}>
              개소
              {handles({ colId: 'point', rowId: 'cols' })}
            </th>
            <th {...pickCell(inspCellId('cols', 'timing'))}>
              시기
              {handles({ colId: 'timing', rowId: 'cols' })}
            </th>
            <th {...pickCell(inspCellId('cols', 'criteria'))}>
              기준
              {handles({ colId: 'criteria', rowId: 'cols' })}
            </th>
            {days.map((day) => {
                const date = `${monthPrefix}-${pad2(day)}`
                return (
                  <th
                    key={day}
                    data-insp-day={day}
                    {...pickCell(inspCellId('cols', 'day'), dayColClass(date, selectedDates, today, printing))}
                  >
                    <button
                      type="button"
                      aria-pressed={selectedDates.includes(date)}
                      onClick={(event) => {
                        if (event.detail !== 0) return
                        onSelectDate(date)
                      }}
                      onPointerDown={(event) => onDaySelectStart?.(date, event)}
                    >
                      {day}
                    </button>
                    {handles({ colId: 'day', rowId: 'cols' })}
                  </th>
                )
              })}
          </tr>
        </thead>
        <tbody>
          {equipment.items.map((item, index) => {
            const key = itemKey(item.no)
            const kind = resolveInputKind(item)
            const unit = kind === 'number' ? readingUnit(item) : ''
            const itemId = item.id ?? `${equipment.id}-${index}`
            return (
              <tr
                key={itemId}
                data-item-id={itemId}
                data-row-id={itemId}
                style={rowStyle(itemId, layout)}
              >
                {showRowTools ? (
                  <td className="chem-edit-col no-print">
                    <div className="chem-row-tools">
                      {formAction === 'row-add' ? (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="아래에 행 추가"
                          onClick={() => onInsertItem?.(itemId)}
                        >
                          <Plus size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="icon-btn danger-icon"
                          aria-label="행 삭제"
                          disabled={equipment.items.length <= 1}
                          onClick={() => onDeleteItem(itemId)}
                        >
                          <Minus size={14} />
                        </button>
                      )}
                    </div>
                    <RowHandle rowId={itemId} onStart={selectedRows.has(`item-${index}`) ? rowResize : undefined} />
                  </td>
                ) : null}
                {index === 0 ? (
                  <th
                    {...pickCell(inspCellId('item-0', 'equip'), 'insp-equip')}
                    rowSpan={Math.max(1, equipment.items.length)}
                    scope="row"
                  >
                    {handles({ colId: 'equip', rowId: itemId, formRow: `item-${index}` })}
                    {editFields ? (
                      <div className="insp-equip-edit">
                        <input
                          className="insp-sheet-input"
                          value={equipment.shortName}
                          aria-label="약칭"
                          onChange={(event) => onRenameEquipment({ shortName: event.target.value })}
                        />
                        <input
                          className="insp-sheet-input"
                          value={equipment.name}
                          aria-label="설비명"
                          onChange={(event) => onRenameEquipment({ name: event.target.value })}
                        />
                      </div>
                    ) : (
                      <>
                        <strong>{equipment.shortName || equipment.name}</strong>
                        {equipment.name && equipment.name !== equipment.shortName ? (
                          <span>{equipment.name}</span>
                        ) : null}
                      </>
                    )}
                  </th>
                ) : null}
                <td {...pickCell(inspCellId(`item-${index}`, 'no'))}>
                  {handles({ colId: 'no', rowId: itemId, formRow: `item-${index}` })}
                  {editFields ? (
                    <input
                      className="insp-sheet-input"
                      inputMode="numeric"
                      min={1}
                      value={item.no}
                      onChange={(event) => onUpdateItem(itemId, { no: Number(event.target.value) })}
                    />
                  ) : (
                    item.no
                  )}
                </td>
                <td {...pickCell(inspCellId(`item-${index}`, 'point'), 'insp-point')}>
                  {handles({ colId: 'point', rowId: itemId, formRow: `item-${index}` })}
                  {editFields ? (
                    <input
                      className="insp-sheet-input"
                      value={item.point}
                      onChange={(event) => onUpdateItem(itemId, { point: event.target.value })}
                    />
                  ) : (
                    item.point
                  )}
                </td>
                <td {...pickCell(inspCellId(`item-${index}`, 'timing'))}>
                  {handles({ colId: 'timing', rowId: itemId, formRow: `item-${index}` })}
                  {editFields ? (
                    <select
                      className="insp-sheet-input"
                      value={item.timing}
                      onChange={(event) => onUpdateItem(itemId, { timing: event.target.value as TimingCode })}
                    >
                      <option value="운">운</option>
                      <option value="정">정</option>
                    </select>
                  ) : (
                    item.timing
                  )}
                </td>
                <td {...pickCell(inspCellId(`item-${index}`, 'criteria'), 'insp-criteria')}>
                  {handles({ colId: 'criteria', rowId: itemId, formRow: `item-${index}` })}
                  {editFields ? (
                    <>
                      <input
                        className="insp-sheet-input"
                        value={item.criteria}
                        onChange={(event) => onUpdateItem(itemId, { criteria: event.target.value })}
                      />
                      <select
                        className="insp-sheet-input"
                        value={kind}
                        aria-label="입력 종류"
                        onChange={(event) =>
                          onUpdateItem(itemId, { inputKind: event.target.value as InputKind })
                        }
                      >
                        <option value="mark">O / X / 휴</option>
                        <option value="number">수치</option>
                        <option value="fraction">분수</option>
                      </select>
                    </>
                  ) : (
                    <CriteriaText
                      text={item.criteria}
                      highlight={shouldHighlightCriteria(equipment.id, item.no)}
                    />
                  )}
                </td>
                {days.map((day) => {
                    const date = `${monthPrefix}-${pad2(day)}`
                    const record = recordsByDate.get(date)
                    const mark = record?.results[key] ?? ''
                    const reading = record?.readings?.[key] ?? ''
                    const fraction = parseFractionParts(reading)
                    return (
                      <td
                        key={day}
                        data-insp-day={day}
                        {...pickCell(
                          inspCellId(`item-${index}`, 'day'),
                          dayColClass(date, selectedDates, today, printing),
                        )}
                      >
                        {handles({ colId: 'day', rowId: itemId, formRow: `item-${index}` })}
                        {kind === 'mark' ? (
                          <button
                            className={`insp-mark${markClass(mark)}`}
                            type="button"
                            data-insp-cell={`${day}-${index}`}
                            aria-label={`${day}일 ${item.point} ${mark === '휴' ? '휴무' : mark || '미입력'}`}
                            onClick={() => onToggleCell(day, item.no)}
                            onKeyDown={(event) => {
                              handleDayKey(event, day, index, dayCount, 'mark')
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                onToggleCell(day, item.no)
                                window.requestAnimationFrame(() => focusInspCell(day, index + 1))
                              }
                            }}
                          >
                            {mark || ''}
                          </button>
                        ) : reading === '휴' ? (
                          <button
                            className="insp-mark is-off"
                            type="button"
                            data-insp-cell={`${day}-${index}`}
                            aria-label={`${day}일 ${item.point} 휴무`}
                            onClick={() => onSaveReading(day, item, '')}
                            onKeyDown={(event) => handleDayKey(event, day, index, dayCount, 'mark')}
                          >
                            휴
                          </button>
                        ) : kind === 'fraction' ? (
                          <FractionInput
                            num={fraction.num}
                            den={fraction.den}
                            numLabel={`${day}일 ${item.point} 분자`}
                            denLabel={`${day}일 ${item.point} 분모`}
                            day={day}
                            row={index}
                            lastDay={dayCount}
                            onFocusCell={() => onSelectDate(date)}
                            onNumChange={(value) => onSaveFraction(day, item, reading, 'num', value)}
                            onDenChange={(value) => onSaveFraction(day, item, reading, 'den', value)}
                          />
                        ) : (
                          <div className={`insp-reading-wrap${reading ? ' has-value' : ''}`}>
                            <input
                              className="insp-reading"
                              value={reading}
                              size={1}
                              inputMode="decimal"
                              data-insp-cell={`${day}-${index}`}
                              aria-label={`${day}일 ${item.point} 수치${unit ? ` (${unit})` : ''}`}
                              onFocus={() => onSelectDate(date)}
                              onKeyDown={(event) => handleDayKey(event, day, index, dayCount, 'number')}
                              onChange={(event) => onSaveReading(day, item, event.target.value)}
                            />
                            {unit && !printing ? (
                              <span className="insp-unit-hint" aria-hidden="true">
                                {unit}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                    )
                  })}
              </tr>
            )
          })}
          <>
              <tr className="insp-status-row" data-row-id="status" style={rowStyle('status', layout)}>
                {showRowTools ? <td className="chem-edit-col no-print" /> : null}
                <td {...pickCell(inspCellId('status', 'label'), 'insp-status-label')} colSpan={5}>
                  점검 이상 유무 확인 (정상 : O, 이상 : X)
                  {handles({ colId: 'criteria', rowId: 'status', formCol: 'label' })}
                </td>
                {days.map((day) => {
                  const date = `${monthPrefix}-${pad2(day)}`
                  const mark = dayConfirmMark(recordsByDate.get(date), equipment.items)
                  return (
                    <td
                      key={day}
                      data-insp-day={day}
                      {...pickCell(
                        inspCellId('status', 'day'),
                        dayColClass(date, selectedDates, today, printing),
                      )}
                    >
                      {handles({ colId: 'day', rowId: 'status' })}
                      <button
                        className={`insp-mark${markClass(mark)}`}
                        type="button"
                        data-insp-cell={`${day}-${statusRow}`}
                        aria-label={`${day}일 이상 유무 ${mark || '미입력'}`}
                        onClick={() => onToggleDayOk(day)}
                        onKeyDown={(event) => handleDayKey(event, day, statusRow, dayCount, 'status')}
                      >
                        {mark || ''}
                      </button>
                    </td>
                  )
                })}
              </tr>
              <tr className="insp-foot-head" data-row-id="foot-head" style={rowStyle('foot-head', layout)}>
                {showRowTools ? <th className="chem-edit-col no-print" /> : null}
                <th {...pickCell(inspCellId('foot-head', 'date'))}>
                  일자
                  {handles({ colId: 'equip', rowId: 'foot-head', formCol: 'date' })}
                </th>
                <th {...pickCell(inspCellId('foot-head', 'note'))} colSpan={noteSpan}>
                  이상 발견 개소 및 조치사항
                  {handles({ colId: 'criteria', rowId: 'foot-head', formCol: 'note' })}
                </th>
                <th {...pickCell(inspCellId('foot-head', 'request'), 'insp-foot-date-col')} colSpan={dateSpan}>
                  생산 요청일자
                  {handles({ colId: 'day', rowId: 'foot-head', formCol: 'request' })}
                </th>
                <th {...pickCell(inspCellId('foot-head', 'confirm'), 'insp-foot-date-col')} colSpan={dateSpan}>
                  설비 확인일자
                  {handles({ colId: 'day', rowId: 'foot-head', formCol: 'confirm' })}
                </th>
              </tr>
              {issueRows.length ? (
                issueRows.map((row) => (
                <tr
                  className="insp-foot-body"
                  data-row-id={`foot-body-${row.day}`}
                  key={`issue-${row.day}`}
                  style={rowStyle(`foot-body-${row.day}`, layout)}
                >
                  {showRowTools ? <td className="chem-edit-col no-print" /> : null}
                  <td {...pickCell(inspCellId('foot-body', 'date'))}>
                    {row.day}
                    {handles({
                      colId: 'equip',
                      rowId: `foot-body-${row.day}`,
                      formCol: 'date',
                      formRow: 'foot-body',
                    })}
                  </td>
                  <td {...pickCell(inspCellId('foot-body', 'note'))} colSpan={noteSpan}>
                    {handles({
                      colId: 'criteria',
                      rowId: `foot-body-${row.day}`,
                      formCol: 'note',
                      formRow: 'foot-body',
                    })}
                    <textarea
                      value={row.note}
                      aria-label={`${row.day}일 이상 발견 개소 및 조치사항`}
                      placeholder={`${row.day}일에 발견된 이상 개소 및 조치사항을 작성하세요.`}
                      onFocus={() => onSelectDate(`${monthPrefix}-${pad2(row.day)}`)}
                      onChange={(event) => onIssueNoteChange(row.day, event.target.value)}
                    />
                  </td>
                  <td {...pickCell(inspCellId('foot-body', 'request'), 'insp-foot-date-col')} colSpan={dateSpan}>
                    {handles({
                      colId: 'day',
                      rowId: `foot-body-${row.day}`,
                      formCol: 'request',
                      formRow: 'foot-body',
                    })}
                    <input
                      className="insp-foot-date"
                      type="date"
                      value={row.requestDate}
                      aria-label={`${row.day}일 생산 요청일자`}
                      onFocus={() => onSelectDate(`${monthPrefix}-${pad2(row.day)}`)}
                      onChange={(event) => onRequestDateChange(row.day, event.target.value)}
                    />
                  </td>
                  <td {...pickCell(inspCellId('foot-body', 'confirm'), 'insp-foot-date-col')} colSpan={dateSpan}>
                    {handles({
                      colId: 'day',
                      rowId: `foot-body-${row.day}`,
                      formCol: 'confirm',
                      formRow: 'foot-body',
                    })}
                    <input
                      className="insp-foot-date"
                      type="date"
                      value={row.confirmDate}
                      aria-label={`${row.day}일 설비 확인일자`}
                      onFocus={() => onSelectDate(`${monthPrefix}-${pad2(row.day)}`)}
                      onChange={(event) => onConfirmDateChange(row.day, event.target.value)}
                    />
                  </td>
                </tr>
                ))
              ) : (
                <tr className="insp-foot-body insp-foot-empty" data-row-id="foot-body-empty" style={rowStyle('foot-body-empty', layout)}>
                  {showRowTools ? <td className="chem-edit-col no-print" /> : null}
                  <td {...pickCell(inspCellId('foot-body', 'date'))}>
                    -
                    {handles({ colId: 'equip', rowId: 'foot-body-empty', formCol: 'date', formRow: 'foot-body' })}
                  </td>
                  <td {...pickCell(inspCellId('foot-body', 'note'))} colSpan={noteSpan}>
                    -
                    {handles({ colId: 'criteria', rowId: 'foot-body-empty', formCol: 'note', formRow: 'foot-body' })}
                  </td>
                  <td {...pickCell(inspCellId('foot-body', 'request'), 'insp-foot-date-col')} colSpan={dateSpan}>
                    -
                    {handles({ colId: 'day', rowId: 'foot-body-empty', formCol: 'request', formRow: 'foot-body' })}
                  </td>
                  <td {...pickCell(inspCellId('foot-body', 'confirm'), 'insp-foot-date-col')} colSpan={dateSpan}>
                    -
                    {handles({ colId: 'day', rowId: 'foot-body-empty', formCol: 'confirm', formRow: 'foot-body' })}
                  </td>
                </tr>
              )}
            </>
        </tbody>
      </table>
    </div>
  )
}

export { INSP_ALL_TAB_ID }

function monthRecords(
  inspections: InspectionRecord[],
  equipmentId: string,
  monthPrefix: string,
): Map<string, InspectionRecord> {
  const map = new Map<string, InspectionRecord>()
  for (const record of inspections) {
    if (record.equipmentId !== equipmentId || !record.date.startsWith(monthPrefix)) continue
    map.set(record.date, record)
  }
  return map
}

function inspPagePx(): number {
  return (PRINT_PAGE_HEIGHT_MM * 96) / 25.4
}

function InspectionAllSheet({
  equipment,
  pageStart,
  pageTotal,
  onPageCount,
  inspections,
  year,
  month,
  days,
  monthPrefix,
  today,
  selectedDates,
  inspectors,
  inspectorByEquipment,
  inspectorWarnId,
  chrome,
  formEdit,
  formAction = null,
  printing,
  sharedLayout,
  selectedCellIds = [],
  onSelectCell,
  onInsertItem,
  onDeleteItemRow,
  onSelectDate,
  onDaySelectStart,
  onToggleCell,
  onSaveReading,
  onSaveFraction,
  onToggleDayOk,
  onChromeChange,
  onColResizeStart,
  onRowResizeStart,
  onIssueNoteChange,
  onRequestDateChange,
  onConfirmDateChange,
  onInspectorChange,
}: {
  equipment: Equipment
  pageStart: number
  pageTotal: number
  onPageCount: (equipmentId: string, count: number) => void
  inspections: InspectionRecord[]
  year: number
  month: number
  days: number[]
  monthPrefix: string
  today: string
  selectedDates: string[]
  inspectors: string[]
  inspectorByEquipment: Record<string, string>
  inspectorWarnId?: string | null
  chrome: InspSheetChrome
  formEdit: boolean
  formAction?: ChemFormAction
  printing: boolean
  sharedLayout?: InspFormLayout
  selectedCellIds?: string[]
  onSelectCell?: (cellId: string, additive: boolean) => void
  onInsertItem?: (equipmentId: string, itemId: string) => void
  onDeleteItemRow?: (equipmentId: string, itemId: string) => void
  onSelectDate: (date: string) => void
  onDaySelectStart?: (date: string, event: PointerEvent<HTMLButtonElement>) => void
  onToggleCell: (equipment: Equipment, day: number, itemNo: number) => void
  onSaveReading: (equipment: Equipment, day: number, item: CheckItem, value: string) => void
  onSaveFraction: (
    equipment: Equipment,
    day: number,
    item: CheckItem,
    reading: string,
    part: 'num' | 'den',
    value: string,
  ) => void
  onToggleDayOk: (equipment: Equipment, day: number) => void
  onChromeChange?: (patch: Partial<InspSheetChrome>) => void
  onColResizeStart?: (id: InspColId, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart?: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onIssueNoteChange: (equipment: Equipment, day: number, value: string) => void
  onRequestDateChange: (equipment: Equipment, day: number, value: string) => void
  onConfirmDateChange: (equipment: Equipment, day: number, value: string) => void
  onInspectorChange: (equipment: Equipment, name: string) => void
}) {
  const paperRef = useRef<HTMLDivElement>(null)
  const [extraGuides, setExtraGuides] = useState(0)
  const recordsByDate = monthRecords(inspections, equipment.id, monthPrefix)
  const layout = formEdit && sharedLayout ? sharedLayout : loadInspFormLayout(equipment.id)
  const name = equipment.shortName || equipment.name

  useLayoutEffect(() => {
    const paper = paperRef.current
    if (!paper) return
    const update = () => {
      const next = Math.max(1, Math.ceil((paper.scrollHeight - 8) / inspPagePx()))
      setExtraGuides(Math.max(0, next - 1))
      onPageCount(equipment.id, next)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(paper)
    return () => observer.disconnect()
  }, [equipment.id, equipment.items, layout, chrome, inspections, monthPrefix, onPageCount])

  return (
    <div ref={paperRef} className="insp-stack-paper" data-insp-name={name}>
      <div className="chem-page-guides no-print" aria-hidden="true">
        <div className="chem-page-guide is-first">
          <span>{`${name} ${pageStart}/${pageTotal}`}</span>
        </div>
        {Array.from({ length: extraGuides }, (_, index) => (
          <div
            key={index}
            className="chem-page-guide"
            style={{ top: `${PRINT_PAGE_HEIGHT_MM * (index + 1)}mm` }}
          >
            <span>{`${name} ${pageStart + index + 1}/${pageTotal}`}</span>
          </div>
        ))}
      </div>
      <InspectionSheet
        equipment={equipment}
        year={year}
        month={month}
        days={days}
        monthPrefix={monthPrefix}
        today={today}
        selectedDates={selectedDates}
        inspectorName={inspectorByEquipment[equipment.id] ?? ''}
        inspectors={inspectors}
        inspectorWarn={inspectorWarnId === equipment.id}
        chrome={chrome}
        recordsByDate={recordsByDate}
        formEdit={formEdit}
        formAction={formAction}
        printing={printing}
        layoutOnly={formEdit}
        draggingItemId={null}
        layout={layout}
        selectedCellIds={selectedCellIds}
        onSelectCell={onSelectCell}
        onInsertItem={(itemId) => onInsertItem?.(equipment.id, itemId)}
        onSelectDate={onSelectDate}
        onDaySelectStart={onDaySelectStart}
        onToggleCell={(day, itemNo) => onToggleCell(equipment, day, itemNo)}
        onSaveReading={(day, item, value) => onSaveReading(equipment, day, item, value)}
        onSaveFraction={(day, item, reading, part, value) =>
          onSaveFraction(equipment, day, item, reading, part, value)
        }
        onToggleDayOk={(day) => onToggleDayOk(equipment, day)}
        onChromeChange={onChromeChange ?? (() => {})}
        onRenameEquipment={() => {}}
        onUpdateItem={() => {}}
        onDeleteItem={(itemId) => onDeleteItemRow?.(equipment.id, itemId)}
        onItemDragStart={() => {}}
        onItemDragOver={() => {}}
        onItemDrop={() => {}}
        onItemDragEnd={() => {}}
        onColResizeStart={onColResizeStart}
        onRowResizeStart={onRowResizeStart}
        onIssueNoteChange={(day, value) => onIssueNoteChange(equipment, day, value)}
        onRequestDateChange={(day, value) => onRequestDateChange(equipment, day, value)}
        onConfirmDateChange={(day, value) => onConfirmDateChange(equipment, day, value)}
        onInspectorChange={(name) => onInspectorChange(equipment, name)}
      />
    </div>
  )
}

export type InspectionAllViewProps = {
  catalog: Equipment[]
  inspections: InspectionRecord[]
  year: number
  month: number
  days: number[]
  monthPrefix: string
  today: string
  selectedDates: string[]
  inspectors: string[]
  inspectorByEquipment: Record<string, string>
  inspectorWarnId?: string | null
  chrome: InspSheetChrome
  formEdit?: boolean
  formAction?: ChemFormAction
  printing?: boolean
  sharedLayout?: InspFormLayout
  selectedCellIds?: string[]
  onSelectCell?: (cellId: string, additive: boolean) => void
  onInsertItem?: (equipmentId: string, itemId: string) => void
  onDeleteItemRow?: (equipmentId: string, itemId: string) => void
  onSelectDate: (date: string) => void
  onDaySelectStart?: (date: string, event: PointerEvent<HTMLButtonElement>) => void
  onToggleCell: (equipment: Equipment, day: number, itemNo: number) => void
  onSaveReading: (equipment: Equipment, day: number, item: CheckItem, value: string) => void
  onSaveFraction: (
    equipment: Equipment,
    day: number,
    item: CheckItem,
    reading: string,
    part: 'num' | 'den',
    value: string,
  ) => void
  onToggleDayOk: (equipment: Equipment, day: number) => void
  onChromeChange?: (patch: Partial<InspSheetChrome>) => void
  onColResizeStart?: (id: InspColId, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart?: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onIssueNoteChange: (equipment: Equipment, day: number, value: string) => void
  onRequestDateChange: (equipment: Equipment, day: number, value: string) => void
  onConfirmDateChange: (equipment: Equipment, day: number, value: string) => void
  onInspectorChange: (equipment: Equipment, name: string) => void
}

export function InspectionAllView({
  catalog,
  inspections,
  year,
  month,
  days,
  monthPrefix,
  today,
  selectedDates,
  inspectors,
  inspectorByEquipment,
  inspectorWarnId = null,
  chrome,
  formEdit = false,
  formAction = null,
  printing = false,
  sharedLayout,
  selectedCellIds = [],
  onSelectCell,
  onInsertItem,
  onDeleteItemRow,
  onSelectDate,
  onDaySelectStart,
  onToggleCell,
  onSaveReading,
  onSaveFraction,
  onToggleDayOk,
  onChromeChange,
  onColResizeStart,
  onRowResizeStart,
  onIssueNoteChange,
  onRequestDateChange,
  onConfirmDateChange,
  onInspectorChange,
}: InspectionAllViewProps) {
  const [counts, setCounts] = useState<Record<string, number>>({})

  const onPageCount = useCallback((equipmentId: string, count: number) => {
    setCounts((prev) => (prev[equipmentId] === count ? prev : { ...prev, [equipmentId]: count }))
  }, [])

  const offsets = useMemo(() => {
    const map: Record<string, number> = {}
    let acc = 0
    for (const item of catalog) {
      map[item.id] = acc
      acc += counts[item.id] ?? 1
    }
    return map
  }, [catalog, counts])

  const totalPages = useMemo(
    () => catalog.reduce((sum, item) => sum + (counts[item.id] ?? 1), 0),
    [catalog, counts],
  )

  return (
    <div className="insp-all-wrap">
      <div className="insp-all-stack">
        {catalog.map((equipment) => (
          <InspectionAllSheet
            key={equipment.id}
            equipment={equipment}
            pageStart={(offsets[equipment.id] ?? 0) + 1}
            pageTotal={Math.max(1, totalPages)}
            onPageCount={onPageCount}
            inspections={inspections}
            year={year}
            month={month}
            days={days}
            monthPrefix={monthPrefix}
            today={today}
            selectedDates={selectedDates}
            inspectors={inspectors}
            inspectorByEquipment={inspectorByEquipment}
            inspectorWarnId={inspectorWarnId}
            chrome={chrome}
            formEdit={formEdit}
            formAction={formAction}
            printing={printing}
            sharedLayout={sharedLayout}
            selectedCellIds={selectedCellIds}
            onSelectCell={onSelectCell}
            onInsertItem={onInsertItem}
            onDeleteItemRow={onDeleteItemRow}
            onSelectDate={onSelectDate}
            onDaySelectStart={onDaySelectStart}
            onToggleCell={onToggleCell}
            onSaveReading={onSaveReading}
            onSaveFraction={onSaveFraction}
            onToggleDayOk={onToggleDayOk}
            onChromeChange={onChromeChange}
            onColResizeStart={onColResizeStart}
            onRowResizeStart={onRowResizeStart}
            onIssueNoteChange={onIssueNoteChange}
            onRequestDateChange={onRequestDateChange}
            onConfirmDateChange={onConfirmDateChange}
            onInspectorChange={onInspectorChange}
          />
        ))}
      </div>
    </div>
  )
}
