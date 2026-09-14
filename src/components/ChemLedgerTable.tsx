import type { CSSProperties, MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { ChemicalLedgerRow } from '../types'
import {
  CHEM_BODY_ROW_KEY,
  HEADER_ROW_IDS,
  chemBlockCell,
  chemBodyCell,
  chemLeafCell,
  chemSectionCell,
  isBizNoHeader,
  isDateColumn,
  parseChemBodyCell,
  resolveChemCellFont,
  type ChemColGroup,
  type ChemFormColumn,
  type HeaderChunk,
  type HeaderRowId,
  groupHeaderChunks,
} from '../lib/chemFormLayout'
import { DateField, QtyField, WrapField } from './ChemLedgerFields'

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ') || undefined
}

function HeaderNameInput({
  value,
  onChange,
  locked = false,
  onActivate,
}: {
  value: string
  onChange: (value: string) => void
  locked?: boolean
  onActivate?: () => void
}) {
  const lines = Math.max(1, value.split('\n').length)
  return (
    <textarea
      className="chem-th-input"
      value={value}
      rows={lines}
      placeholder="열 이름"
      readOnly={locked}
      tabIndex={locked ? -1 : 0}
      onMouseDown={(event) => {
        if (locked) return
        onActivate?.()
        event.stopPropagation()
      }}
      onClick={(event) => {
        if (!locked) event.stopPropagation()
      }}
      onFocus={(event) => {
        if (locked) {
          event.currentTarget.blur()
          return
        }
        onActivate?.()
        event.currentTarget.select()
      }}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function HeaderLines({ text }: { text: string }) {
  const parts = text.split('\n')
  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {index > 0 ? <br /> : null}
          {part}
        </span>
      ))}
    </>
  )
}

export function ColHandle({
  onResizeStart,
}: {
  onResizeStart: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      className="chem-col-handle no-print"
      type="button"
      aria-label="열 너비 조절"
      onMouseDown={onResizeStart}
    />
  )
}

export function RowHandle({
  onResizeStart,
  className,
}: {
  onResizeStart: (event: MouseEvent<HTMLButtonElement>) => void
  className?: string
}) {
  return (
    <button
      className={`chem-row-handle no-print${className ? ` ${className}` : ''}`}
      type="button"
      aria-label="행 높이 조절"
      onMouseDown={onResizeStart}
    />
  )
}

export type ChemFormAction = 'col-add' | 'col-del' | 'row-add' | 'row-del' | null

function isHandleTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest('.chem-col-handle, .chem-row-handle, .chem-meta-split, .chem-row-tools, .icon-btn'),
  )
}

function cellFontStyle(
  fonts: Record<string, number>,
  cellId: string,
  extra?: CSSProperties,
): CSSProperties | undefined {
  const size = resolveChemCellFont(fonts, cellId)
  if (size == null) return extra
  return { ...extra, fontSize: `${size}px` }
}

interface ChemCellInteract {
  selectedIds: string[]
  fonts: Record<string, number>
  enabled: boolean
  onPointerDown: (cellId: string) => void
}

function cellProps(
  interact: ChemCellInteract | undefined,
  cellId: string,
  extraClass?: string,
  extraStyle?: CSSProperties,
) {
  const fonts = interact?.fonts ?? {}
  const sized = resolveChemCellFont(fonts, cellId) != null
  const selected = Boolean(interact?.selectedIds.includes(cellId))
  return {
    'data-cell-id': cellId,
    className: cx(extraClass, selected && 'is-cell-on', sized && 'is-cell-font'),
    style: cellFontStyle(fonts, cellId, extraStyle),
    onPointerDown: interact?.enabled
      ? (event: ReactPointerEvent<HTMLElement>) => {
          if (isHandleTarget(event.target)) return
          if (event.button !== 0) return
          const target = event.target
          const onField =
            target instanceof Element &&
            Boolean(target.closest('input, textarea, button, select'))
          if (!onField) event.preventDefault()
          interact.onPointerDown(cellId)
        }
      : undefined,
  }
}

function pickColProps(
  formAction: ChemFormAction,
  colId: string,
  onInsertCol: (id: string) => void,
  onDeleteCol?: (id: string) => void,
): { className?: string; onClick?: () => void } {
  if (formAction === 'col-add') {
    return { className: 'is-col-pick is-col-add', onClick: () => onInsertCol(colId) }
  }
  if (formAction === 'col-del' && onDeleteCol) {
    return { className: 'is-col-pick is-col-del', onClick: () => onDeleteCol(colId) }
  }
  return {}
}

function HeaderColTools({
  formEdit,
  formAction,
  canDelete,
  showAdd,
  showDelete,
  onResizeStart,
  onRowResizeStart,
}: {
  formEdit: boolean
  formAction: ChemFormAction
  canDelete: boolean
  showAdd?: boolean
  showDelete?: boolean
  onResizeStart: (event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  if (!formEdit) return null
  return (
    <>
      {formAction === 'col-add' && showAdd ? (
        <span className="chem-col-add no-print" aria-hidden="true">
          <Plus size={12} />
        </span>
      ) : null}
      {formAction === 'col-del' && showDelete ? (
        <span className={`chem-col-del no-print${canDelete ? '' : ' is-off'}`} aria-hidden="true">
          <Minus size={12} />
        </span>
      ) : null}
      {formAction === 'col-add' || formAction === 'col-del' ? null : (
        <>
          <ColHandle onResizeStart={onResizeStart} />
          <RowHandle onResizeStart={onRowResizeStart} />
        </>
      )}
    </>
  )
}

function headerBandStyle(
  heights: Record<string, number>,
  start: HeaderRowId,
  span: number,
): { height: number; minHeight: number; maxHeight: number } | undefined {
  const index = HEADER_ROW_IDS.indexOf(start)
  const h = HEADER_ROW_IDS.slice(index, index + span).reduce((sum, id) => sum + (heights[id] ?? 0), 0)
  return h > 0 ? { height: h, minHeight: h, maxHeight: h } : undefined
}

function cellValue(row: ChemicalLedgerRow, column: ChemFormColumn): string {
  if (column.key.startsWith('extra:')) return row.extra[column.key.slice(6)] ?? ''
  const key = column.key as keyof ChemicalLedgerRow
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

function SectionHeads({
  title,
  cols,
  group,
  formEdit,
  formAction,
  canDeleteCol,
  style,
  interact,
  onResizeStart,
  onRowResizeStart,
  onInsertCol,
  onDeleteCol,
  onRenameTitle,
}: {
  title: string
  cols: ChemFormColumn[]
  group: ChemColGroup
  formEdit: boolean
  formAction: ChemFormAction
  canDeleteCol: boolean
  style?: { height: number; minHeight: number; maxHeight: number }
  interact?: ChemCellInteract
  onResizeStart: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart: (rowId: string, event: MouseEvent<HTMLButtonElement>) => void
  onInsertCol: (afterId: string) => void
  onDeleteCol: (id: string) => void
  onRenameTitle: (value: string) => void
}) {
  if (cols.length === 0) return null
  const last = cols[cols.length - 1]
  const pick = pickColProps(formAction, last.id, onInsertCol, onDeleteCol)
  const cellId = chemSectionCell(group)
  return (
    <th
      colSpan={cols.length}
      {...cellProps(interact, cellId, cx(formEdit && 'chem-th-edit', pick.className), style)}
      onClick={pick.onClick}
    >
      {formEdit ? (
        <HeaderNameInput
          value={title}
          locked={Boolean(pick.className)}
          onActivate={() => interact?.onPointerDown(cellId)}
          onChange={onRenameTitle}
        />
      ) : (
        <HeaderLines text={title} />
      )}
      <HeaderColTools
        formEdit={formEdit}
        formAction={formAction}
        canDelete={canDeleteCol}
        showAdd
        showDelete
        onResizeStart={(event) => onResizeStart(last.id, event)}
        onRowResizeStart={(event) => onRowResizeStart('thead-section', event)}
      />
    </th>
  )
}

function BlockRow({
  chunks,
  formEdit,
  formAction,
  canDeleteCol,
  bandStyle,
  span2Style,
  flashColId,
  interact,
  onResizeStart,
  onRowResizeStart,
  onInsertCol,
  onDeleteCol,
  onRename,
  onRenameBlock,
}: {
  chunks: HeaderChunk[]
  formEdit: boolean
  formAction: ChemFormAction
  canDeleteCol: boolean
  bandStyle?: { height: number; minHeight: number; maxHeight: number }
  span2Style?: { height: number; minHeight: number; maxHeight: number }
  flashColId?: string | null
  interact?: ChemCellInteract
  onResizeStart: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart: (rowId: string, event: MouseEvent<HTMLButtonElement>) => void
  onInsertCol: (afterId: string) => void
  onDeleteCol: (id: string) => void
  onRename: (id: string, label: string) => void
  onRenameBlock: (id: string, block: string) => void
}) {
  return (
    <>
      {chunks.map((chunk) => {
        if (chunk.type === 'span2') {
          const col = chunk.cols[0]
          const pick = pickColProps(formAction, col.id, onInsertCol, onDeleteCol)
          const cellId = chemLeafCell(col.id)
          return (
            <th
              key={col.id}
              rowSpan={2}
              data-col-id={col.id}
              {...cellProps(
                interact,
                cellId,
                cx(formEdit && 'chem-th-edit', flashColId === col.id && 'is-flash', pick.className),
                span2Style,
              )}
              onClick={pick.onClick}
            >
              {formEdit ? (
                <HeaderNameInput
                  value={col.label}
                  locked={Boolean(pick.className)}
                  onActivate={() => interact?.onPointerDown(cellId)}
                  onChange={(value) => onRename(col.id, value)}
                />
              ) : (
                <HeaderLines text={col.label} />
              )}
              <HeaderColTools
                formEdit={formEdit}
                formAction={formAction}
                canDelete={canDeleteCol}
                showAdd
                showDelete
                onResizeStart={(event) => onResizeStart(col.id, event)}
                onRowResizeStart={(event) => onRowResizeStart('thead-leaf', event)}
              />
            </th>
          )
        }
        const last = chunk.cols[chunk.cols.length - 1]
        const pick = last ? pickColProps(formAction, last.id, onInsertCol, onDeleteCol) : {}
        const cellId = chemBlockCell(chunk.cols[0]?.id ?? chunk.block ?? 'block')
        return (
          <th
            key={chunk.cols[0]?.id ?? chunk.block}
            colSpan={chunk.cols.length}
            {...cellProps(interact, cellId, cx(formEdit && 'chem-th-edit', pick.className), bandStyle)}
            onClick={pick.onClick}
          >
            {formEdit ? (
              <HeaderNameInput
                value={chunk.block ?? ''}
                locked={Boolean(pick.className)}
                onActivate={() => interact?.onPointerDown(cellId)}
                onChange={(value) => {
                  if (last) onRenameBlock(last.id, value)
                }}
              />
            ) : (
              <HeaderLines text={chunk.block ?? ''} />
            )}
            {last ? (
              <HeaderColTools
                formEdit={formEdit}
                formAction={formAction}
                canDelete={canDeleteCol}
                showAdd
                showDelete
                onResizeStart={(event) => onResizeStart(last.id, event)}
                onRowResizeStart={(event) => onRowResizeStart('thead-block', event)}
              />
            ) : null}
          </th>
        )
      })}
    </>
  )
}

function LeafRow({
  chunks,
  formEdit,
  formAction,
  canDeleteCol,
  style,
  flashColId,
  interact,
  onResizeStart,
  onRowResizeStart,
  onInsertCol,
  onDeleteCol,
  onRename,
}: {
  chunks: HeaderChunk[]
  formEdit: boolean
  formAction: ChemFormAction
  canDeleteCol: boolean
  style?: { height: number; minHeight: number; maxHeight: number }
  flashColId?: string | null
  interact?: ChemCellInteract
  onResizeStart: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart: (rowId: string, event: MouseEvent<HTMLButtonElement>) => void
  onInsertCol: (afterId: string) => void
  onDeleteCol: (id: string) => void
  onRename: (id: string, label: string) => void
}) {
  return (
    <>
      {chunks
        .filter((chunk) => chunk.type === 'block')
        .flatMap((chunk) => chunk.cols)
        .map((col) => {
          const pick = pickColProps(formAction, col.id, onInsertCol, onDeleteCol)
          const cellId = chemLeafCell(col.id)
          return (
            <th
              key={col.id}
              data-col-id={col.id}
              {...cellProps(
                interact,
                cellId,
                cx(
                  formEdit && 'chem-th-edit',
                  isBizNoHeader(col) && 'chem-th-biz',
                  flashColId === col.id && 'is-flash',
                  pick.className,
                ),
                style,
              )}
              onClick={pick.onClick}
            >
              {formEdit ? (
                <HeaderNameInput
                  value={col.label}
                  locked={Boolean(pick.className)}
                  onActivate={() => interact?.onPointerDown(cellId)}
                  onChange={(value) => onRename(col.id, value)}
                />
              ) : (
                <HeaderLines text={col.label} />
              )}
              <HeaderColTools
                formEdit={formEdit}
                formAction={formAction}
                canDelete={canDeleteCol}
                showAdd
                showDelete
                onResizeStart={(event) => onResizeStart(col.id, event)}
                onRowResizeStart={(event) => onRowResizeStart('thead-leaf', event)}
              />
            </th>
          )
        })}
    </>
  )
}

interface ChemLedgerTableProps {
  columns: ChemFormColumn[]
  colPx: Record<string, number>
  rows: ChemicalLedgerRow[]
  unit: string
  year: number
  formEdit: boolean
  formAction: ChemFormAction
  rowHeights: Record<string, number>
  onUpdateCell: (rowId: string, column: ChemFormColumn, value: string) => void
  onDeleteRow: (rowId: string) => void
  onInsertRow: (afterId: string) => void
  onInsertCol: (afterId: string) => void
  onResizeStart: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart: (rowId: string, event: MouseEvent<HTMLButtonElement>) => void
  onDeleteCol: (id: string) => void
  onRename: (id: string, label: string) => void
  onRenameBlock: (id: string, block: string) => void
  inSection: string
  outSection: string
  onRenameSection: (group: 'in' | 'out', title: string) => void
  flashColId?: string | null
  flashRowId?: string | null
  fillRowHeight?: number | null
  cellFonts?: Record<string, number>
  selectedCellIds?: string[]
  onSelectCells?: (ids: string[]) => void
}

export function ChemLedgerTable({
  columns,
  colPx,
  rows,
  unit,
  year,
  formEdit,
  formAction,
  rowHeights,
  onUpdateCell,
  onDeleteRow,
  onInsertRow,
  onInsertCol,
  onResizeStart,
  onRowResizeStart,
  onDeleteCol,
  onRename,
  onRenameBlock,
  inSection,
  outSection,
  onRenameSection,
  flashColId,
  flashRowId,
  fillRowHeight,
  cellFonts = {},
  selectedCellIds = [],
  onSelectCells,
}: ChemLedgerTableProps) {
  const inCols = columns.filter((item) => item.group === 'in')
  const outCols = columns.filter((item) => item.group === 'out')
  const endCols = columns.filter((item) => item.group === 'end')
  const inChunks = groupHeaderChunks(inCols)
  const outChunks = groupHeaderChunks(outCols)
  const showRowTools = formEdit && (formAction === 'row-add' || formAction === 'row-del')
  const canDeleteCol = columns.length > 1
  const pxSum = columns.reduce((sum, col) => sum + (colPx[col.id] ?? 40), 0) || 1
  const sectionStyle = headerBandStyle(rowHeights, 'thead-section', 1)
  const blockStyle = headerBandStyle(rowHeights, 'thead-block', 1)
  const leafStyle = headerBandStyle(rowHeights, 'thead-leaf', 1)
  const span2Style = headerBandStyle(rowHeights, 'thead-block', 2)
  const endStyle = headerBandStyle(rowHeights, 'thead-section', 3)
  const selectAnchor = useRef<string | null>(null)
  const selecting = useRef(false)
  const interact: ChemCellInteract = {
    selectedIds: formEdit ? selectedCellIds : [],
    fonts: cellFonts,
    enabled: formEdit && !formAction,
    onPointerDown: (cellId) => {
      if (!formEdit || formAction || !onSelectCells) return
      selecting.current = true
      selectAnchor.current = cellId
      onSelectCells([cellId])
      document.body.classList.add('chem-selecting-cells')
    },
  }

  useEffect(() => {
    if (!formEdit) return
    const expand = (anchor: string, current: string) => {
      if (anchor === current) return [anchor]
      const a = parseChemBodyCell(anchor)
      const b = parseChemBodyCell(current)
      if (a && b) {
        const r0 = rows.findIndex((row) => row.id === a.rowId)
        const r1 = rows.findIndex((row) => row.id === b.rowId)
        const c0 = columns.findIndex((col) => col.id === a.colId)
        const c1 = columns.findIndex((col) => col.id === b.colId)
        if (r0 < 0 || r1 < 0 || c0 < 0 || c1 < 0) return [anchor, current]
        const rMin = Math.min(r0, r1)
        const rMax = Math.max(r0, r1)
        const cMin = Math.min(c0, c1)
        const cMax = Math.max(c0, c1)
        const ids: string[] = []
        for (let rowIndex = rMin; rowIndex <= rMax; rowIndex += 1) {
          for (let colIndex = cMin; colIndex <= cMax; colIndex += 1) {
            ids.push(chemBodyCell(rows[rowIndex].id, columns[colIndex].id))
          }
        }
        return ids
      }
      const headerPrefix =
        anchor.startsWith('thead-leaf:') && current.startsWith('thead-leaf:')
          ? 'thead-leaf:'
          : anchor.startsWith('thead-block:') && current.startsWith('thead-block:')
            ? 'thead-block:'
            : null
      if (headerPrefix) {
        const c0 = columns.findIndex((col) => col.id === anchor.slice(headerPrefix.length))
        const c1 = columns.findIndex((col) => col.id === current.slice(headerPrefix.length))
        if (c0 < 0 || c1 < 0) return [anchor, current]
        const cMin = Math.min(c0, c1)
        const cMax = Math.max(c0, c1)
        const makeId = headerPrefix === 'thead-leaf:' ? chemLeafCell : chemBlockCell
        return columns.slice(cMin, cMax + 1).map((col) => makeId(col.id))
      }
      return [anchor, current]
    }
    const onMove = (event: PointerEvent) => {
      if (!selecting.current || !selectAnchor.current || !onSelectCells || formAction) return
      const node = document.elementFromPoint(event.clientX, event.clientY)
      const cell = node instanceof Element ? node.closest('[data-cell-id]') : null
      const id = cell?.getAttribute('data-cell-id')
      if (!id) return
      onSelectCells(expand(selectAnchor.current, id))
    }
    const onUp = () => {
      selecting.current = false
      selectAnchor.current = null
      document.body.classList.remove('chem-selecting-cells')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.classList.remove('chem-selecting-cells')
    }
  }, [formEdit, formAction, columns, rows, onSelectCells])

  useEffect(() => {
    if (!formEdit || !flashColId) return
    const input = document.querySelector<HTMLTextAreaElement>(
      `th[data-col-id="${CSS.escape(flashColId)}"] .chem-th-input`,
    )
    if (!input) return
    input.focus()
    input.select()
  }, [flashColId, formEdit])

  return (
    <table
      className={`chem-table ${formEdit ? 'is-editing' : ''}`}
    >
      <colgroup>
        {showRowTools ? <col className="chem-edit-col" style={{ width: 40 }} /> : null}
        {columns.map((col) => (
          <col
            key={col.id}
            style={{
              width: formEdit
                ? `calc((100% - ${showRowTools ? 40 : 0}px) * ${(colPx[col.id] ?? 40) / pxSum})`
                : `${col.width}%`,
            }}
          />
        ))}
      </colgroup>
      <thead>
        <tr className="chem-col-sizers" aria-hidden="true">
          {showRowTools ? <th className="chem-edit-col" style={{ width: 40 }} /> : null}
          {columns.map((col) => (
            <th
              key={col.id}
              style={{
                width: formEdit
                  ? `calc((100% - ${showRowTools ? 40 : 0}px) * ${(colPx[col.id] ?? 40) / pxSum})`
                  : `${col.width}%`,
              }}
            />
          ))}
        </tr>
        <tr
          data-row-id="thead-section"
          className={sectionStyle ? 'is-row-locked' : undefined}
          style={sectionStyle}
        >
          {showRowTools ? (
            <th className="chem-edit-col no-print" rowSpan={3} style={endStyle}>
              {formAction === 'row-add' ? '추가' : '삭제'}
              <RowHandle onResizeStart={(event) => onRowResizeStart('thead-leaf', event)} />
            </th>
          ) : null}
          <SectionHeads
            title={inSection}
            cols={inCols}
            group="in"
            formEdit={formEdit}
            formAction={formAction}
            canDeleteCol={canDeleteCol}
            style={sectionStyle}
            interact={interact}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
            onRenameTitle={(value) => onRenameSection('in', value)}
          />
          <SectionHeads
            title={outSection}
            cols={outCols}
            group="out"
            formEdit={formEdit}
            formAction={formAction}
            canDeleteCol={canDeleteCol}
            style={sectionStyle}
            interact={interact}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
            onRenameTitle={(value) => onRenameSection('out', value)}
          />
          {endCols.map((col) => {
            const pick = pickColProps(formAction, col.id, onInsertCol, onDeleteCol)
            const cellId = chemLeafCell(col.id)
            return (
              <th
                key={col.id}
                rowSpan={3}
                data-col-id={col.id}
                {...cellProps(
                  interact,
                  cellId,
                  cx(formEdit && 'chem-th-edit', flashColId === col.id && 'is-flash', pick.className),
                  endStyle,
                )}
                onClick={pick.onClick}
              >
                {formEdit ? (
                  <HeaderNameInput
                    value={col.label}
                    locked={Boolean(pick.className)}
                    onActivate={() => interact?.onPointerDown(cellId)}
                    onChange={(value) => onRename(col.id, value)}
                  />
                ) : (
                  <HeaderLines text={col.label} />
                )}
                <HeaderColTools
                  formEdit={formEdit}
                  formAction={formAction}
                  canDelete={canDeleteCol}
                  showAdd
                  showDelete
                  onResizeStart={(event) => onResizeStart(col.id, event)}
                  onRowResizeStart={(event) => onRowResizeStart('thead-leaf', event)}
                />
              </th>
            )
          })}
        </tr>
        <tr
          data-row-id="thead-block"
          className={blockStyle ? 'is-row-locked' : undefined}
          style={blockStyle}
        >
          <BlockRow
            chunks={inChunks}
            formEdit={formEdit}
            formAction={formAction}
            canDeleteCol={canDeleteCol}
            bandStyle={blockStyle}
            span2Style={span2Style}
            flashColId={flashColId}
            interact={interact}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
            onRename={onRename}
            onRenameBlock={onRenameBlock}
          />
          <BlockRow
            chunks={outChunks}
            formEdit={formEdit}
            formAction={formAction}
            canDeleteCol={canDeleteCol}
            bandStyle={blockStyle}
            span2Style={span2Style}
            flashColId={flashColId}
            interact={interact}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
            onRename={onRename}
            onRenameBlock={onRenameBlock}
          />
        </tr>
        <tr
          data-row-id="thead-leaf"
          className={leafStyle ? 'is-row-locked' : undefined}
          style={leafStyle}
        >
          <LeafRow
            chunks={inChunks}
            formEdit={formEdit}
            formAction={formAction}
            canDeleteCol={canDeleteCol}
            style={leafStyle}
            flashColId={flashColId}
            interact={interact}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
            onRename={onRename}
          />
          <LeafRow
            chunks={outChunks}
            formEdit={formEdit}
            formAction={formAction}
            canDeleteCol={canDeleteCol}
            style={leafStyle}
            flashColId={flashColId}
            interact={interact}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
            onRename={onRename}
          />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const savedBody = rowHeights[CHEM_BODY_ROW_KEY]
          const rowH = savedBody ?? fillRowHeight ?? undefined
          const cellStyle = rowH
            ? savedBody
              ? { height: rowH, minHeight: rowH, maxHeight: rowH }
              : { minHeight: rowH }
            : undefined
          return (
            <tr
              key={row.id}
              data-row-id={row.id}
              className={flashRowId === row.id ? 'is-flash' : undefined}
              style={cellStyle}
            >
              {showRowTools ? (
                <td className="chem-edit-col no-print" style={cellStyle}>
                  <div className="chem-row-tools">
                    {formAction === 'row-add' ? (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="아래에 행 추가"
                        onClick={() => onInsertRow(row.id)}
                      >
                        <Plus size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn danger-icon"
                        aria-label="행 삭제"
                        disabled={rows.length <= 1}
                        onClick={() => onDeleteRow(row.id)}
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                  <RowHandle onResizeStart={(event) => onRowResizeStart(row.id, event)} />
                </td>
              ) : null}
              {columns.map((col) => {
                const cellId = chemBodyCell(row.id, col.id)
                return (
                <td
                  key={col.id}
                  data-col-id={col.id}
                  {...cellProps(
                    interact,
                    cellId,
                    flashColId === col.id ? 'is-flash' : undefined,
                    cellStyle,
                  )}
                >
                  {col.kind === 'qty' ? (
                    <QtyField
                      value={cellValue(row, col)}
                      unit={unit}
                      lockSize
                      onChange={(value) => onUpdateCell(row.id, col, value)}
                    />
                  ) : isDateColumn(col) ? (
                    <DateField
                      value={cellValue(row, col)}
                      year={year}
                      lockSize
                      onChange={(value) => onUpdateCell(row.id, col, value)}
                    />
                  ) : (
                    <WrapField
                      variant={col.kind === 'digit' ? 'digit' : 'keep'}
                      value={cellValue(row, col)}
                      lockSize
                      onChange={(value) => onUpdateCell(row.id, col, value)}
                    />
                  )}
                  {formEdit ? (
                    <>
                      <ColHandle onResizeStart={(event) => onResizeStart(col.id, event)} />
                      <RowHandle onResizeStart={(event) => onRowResizeStart(row.id, event)} />
                    </>
                  ) : null}
                </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function ChemFormEditBar({
  action,
  onAction,
  layoutOnly = false,
  selectedFont,
  canFont,
  onFont,
}: {
  action: ChemFormAction
  onAction: (next: ChemFormAction) => void
  layoutOnly?: boolean
  selectedFont?: number | null
  canFont?: boolean
  onFont?: (delta: number) => void
}) {
  const toggle = (next: Exclude<ChemFormAction, null>) => {
    onAction(action === next ? null : next)
  }
  const hint =
    action === 'col-add'
      ? '헤더 칸을 눌러 그 옆에 열을 추가하세요.'
      : action === 'col-del'
        ? '삭제할 열의 헤더 칸을 누르세요.'
        : action === 'row-add'
          ? '왼쪽 + 를 눌러 그 아래에 행을 추가하세요.'
          : action === 'row-del'
            ? '왼쪽 − 를 눌러 해당 행을 삭제하세요.'
            : layoutOnly
              ? '칸을 누르거나 드래그해 선택한 뒤, 글자 크기를 조절할 수 있습니다. 모든 물질 양식에 적용됩니다.'
              : '칸을 누르거나 드래그해 선택한 뒤, 글자 크기를 조절할 수 있습니다.'

  return (
    <div className="chem-form-bar no-print">
      <span>{hint}</span>
      <div className="chem-form-tools">
        <div className="chem-form-tool-group">
          <strong>열</strong>
          <button
            className={`secondary-btn ${action === 'col-add' ? 'is-on' : ''}`}
            type="button"
            onClick={() => toggle('col-add')}
          >
            <Plus size={14} />
            열 추가
          </button>
          <button
            className={`secondary-btn ${action === 'col-del' ? 'is-on' : ''}`}
            type="button"
            onClick={() => toggle('col-del')}
          >
            <Minus size={14} />
            열 삭제
          </button>
        </div>
        <div className="chem-form-tool-group">
          <strong>행</strong>
          <button
            className={`secondary-btn ${action === 'row-add' ? 'is-on' : ''}`}
            type="button"
            onClick={() => toggle('row-add')}
          >
            <Plus size={14} />
            행 추가
          </button>
          <button
            className={`secondary-btn ${action === 'row-del' ? 'is-on' : ''}`}
            type="button"
            onClick={() => toggle('row-del')}
          >
            <Minus size={14} />
            행 삭제
          </button>
        </div>
        <div className="chem-form-tool-group">
          <strong>글자</strong>
          <button
            className="secondary-btn"
            type="button"
            aria-label="글자 작게"
            disabled={!canFont}
            onClick={() => onFont?.(-1)}
          >
            <Minus size={14} />
          </button>
          <span className={`chem-font-size${canFont ? '' : ' is-off'}`}>
            {canFont && selectedFont != null ? `${selectedFont}px` : '칸 선택'}
          </span>
          <button
            className="secondary-btn"
            type="button"
            aria-label="글자 크게"
            disabled={!canFont}
            onClick={() => onFont?.(1)}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
