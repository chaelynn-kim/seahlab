import type { MouseEvent } from 'react'
import { useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { ChemicalLedgerRow } from '../types'
import {
  HEADER_ROW_IDS,
  isBizNoHeader,
  type ChemFormColumn,
  type HeaderChunk,
  type HeaderRowId,
  groupHeaderChunks,
} from '../lib/chemFormLayout'
import { QtyField, WrapField } from './ChemLedgerFields'

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ') || undefined
}

function HeaderNameInput({
  value,
  onChange,
  locked = false,
}: {
  value: string
  onChange: (value: string) => void
  locked?: boolean
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

function ColHandle({
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

function RowHandle({
  onResizeStart,
}: {
  onResizeStart: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      className="chem-row-handle no-print"
      type="button"
      aria-label="행 높이 조절"
      onMouseDown={onResizeStart}
    />
  )
}

export type ChemFormAction = 'col-add' | 'col-del' | 'row-add' | 'row-del' | null

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
  formEdit,
  formAction,
  canDeleteCol,
  style,
  onResizeStart,
  onRowResizeStart,
  onInsertCol,
  onDeleteCol,
}: {
  title: string
  cols: ChemFormColumn[]
  formEdit: boolean
  formAction: ChemFormAction
  canDeleteCol: boolean
  style?: { height: number; minHeight: number; maxHeight: number }
  onResizeStart: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart: (rowId: string, event: MouseEvent<HTMLButtonElement>) => void
  onInsertCol: (afterId: string) => void
  onDeleteCol: (id: string) => void
}) {
  if (cols.length === 0) return null
  const last = cols[cols.length - 1]
  const pick = pickColProps(formAction, last.id, onInsertCol, onDeleteCol)
  return (
    <th
      colSpan={cols.length}
      className={cx(formEdit && 'chem-th-edit', pick.className)}
      style={style}
      onClick={pick.onClick}
    >
      {title}
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
  bandStyle?: { height: number; minHeight: number; maxHeight: number }
  span2Style?: { height: number; minHeight: number; maxHeight: number }
  flashColId?: string | null
  onResizeStart: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onRowResizeStart: (rowId: string, event: MouseEvent<HTMLButtonElement>) => void
  onInsertCol: (afterId: string) => void
  onDeleteCol: (id: string) => void
  onRename: (id: string, label: string) => void
}) {
  return (
    <>
      {chunks.map((chunk) => {
        if (chunk.type === 'span2') {
          const col = chunk.cols[0]
          const pick = pickColProps(formAction, col.id, onInsertCol, onDeleteCol)
          return (
            <th
              key={col.id}
              rowSpan={2}
              data-col-id={col.id}
              className={cx(formEdit && 'chem-th-edit', flashColId === col.id && 'is-flash', pick.className)}
              style={span2Style}
              onClick={pick.onClick}
            >
              {formEdit ? (
                <HeaderNameInput
                  value={col.label}
                  locked={Boolean(pick.className)}
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
        return (
          <th
            key={chunk.block}
            colSpan={chunk.cols.length}
            className={cx(formEdit && 'chem-th-edit', pick.className)}
            style={bandStyle}
            onClick={pick.onClick}
          >
            <HeaderLines text={chunk.block ?? ''} />
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
          return (
            <th
              key={col.id}
              data-col-id={col.id}
              className={cx(
                formEdit && 'chem-th-edit',
                isBizNoHeader(col) && 'chem-th-biz',
                flashColId === col.id && 'is-flash',
                pick.className,
              )}
              style={style}
              onClick={pick.onClick}
            >
              {formEdit ? (
                <HeaderNameInput
                  value={col.label}
                  locked={Boolean(pick.className)}
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
  flashColId?: string | null
  flashRowId?: string | null
  fillRowHeight?: number | null
}

export function ChemLedgerTable({
  columns,
  colPx,
  rows,
  unit,
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
  flashColId,
  flashRowId,
  fillRowHeight,
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
            title="입 고 량"
            cols={inCols}
            formEdit={formEdit}
            formAction={formAction}
            canDeleteCol={canDeleteCol}
            style={sectionStyle}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
          />
          <SectionHeads
            title="출 고 량"
            cols={outCols}
            formEdit={formEdit}
            formAction={formAction}
            canDeleteCol={canDeleteCol}
            style={sectionStyle}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
          />
          {endCols.map((col) => {
            const pick = pickColProps(formAction, col.id, onInsertCol, onDeleteCol)
            return (
              <th
                key={col.id}
                rowSpan={3}
                data-col-id={col.id}
                className={cx(formEdit && 'chem-th-edit', flashColId === col.id && 'is-flash', pick.className)}
                style={endStyle}
                onClick={pick.onClick}
              >
                {formEdit ? (
                  <HeaderNameInput
                    value={col.label}
                    locked={Boolean(pick.className)}
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
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
            onRename={onRename}
          />
          <BlockRow
            chunks={outChunks}
            formEdit={formEdit}
            formAction={formAction}
            canDeleteCol={canDeleteCol}
            bandStyle={blockStyle}
            span2Style={span2Style}
            flashColId={flashColId}
            onResizeStart={onResizeStart}
            onRowResizeStart={onRowResizeStart}
            onInsertCol={onInsertCol}
            onDeleteCol={onDeleteCol}
            onRename={onRename}
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
          const rowH = rowHeights[row.id] ?? fillRowHeight ?? undefined
          const cellStyle = rowH
            ? { height: rowH, minHeight: rowH, maxHeight: rowH }
            : undefined
          return (
            <tr
              key={row.id}
              data-row-id={row.id}
              className={cx(Boolean(rowH) && 'is-row-locked', flashRowId === row.id && 'is-flash')}
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
              {columns.map((col) => (
                <td
                  key={col.id}
                  data-col-id={col.id}
                  className={flashColId === col.id ? 'is-flash' : undefined}
                  style={cellStyle}
                >
                  {col.kind === 'qty' ? (
                    <QtyField
                      value={cellValue(row, col)}
                      unit={unit}
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
                  {formEdit ? <RowHandle onResizeStart={(event) => onRowResizeStart(row.id, event)} /> : null}
                </td>
              ))}
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
}: {
  action: ChemFormAction
  onAction: (next: ChemFormAction) => void
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
            : '열 경계를 끌어 너비를, 행 아래쪽을 끌어 높이를 바꿀 수 있습니다.'

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
      </div>
    </div>
  )
}
