import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { FlaskConical, Pencil, Plus, Printer, Redo2, TableProperties, Undo2, X } from 'lucide-react'
import diskette from '../assets/diskette.png'
import { ChemFormEditBar, ChemLedgerTable, type ChemFormAction } from '../components/ChemLedgerTable'
import { useAppData } from '../context/AppDataContext'
import {
  createChemColumn,
  loadChemFormColumns,
  loadHeaderRowHeights,
  saveChemFormColumns,
  saveHeaderRowHeights,
  type ChemFormColumn,
} from '../lib/chemFormLayout'
import {
  applyToxicOnlyCategoryDefaults,
  createBlankLedger,
  createLedgerRow,
  formatContentPercent,
} from '../lib/chemicals'
import type { ChemicalActivities, ChemicalLedger, ChemicalLedgerMeta, ChemicalLedgerRow } from '../types'

function cloneLedgers(list: ChemicalLedger[]): ChemicalLedger[] {
  return JSON.parse(JSON.stringify(list)) as ChemicalLedger[]
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

interface FormSnapshot {
  columns: ChemFormColumn[]
  colPx: Record<string, number>
  rowHeights: Record<string, number>
  editRowLock: Record<string, number>
  rows: ChemicalLedgerRow[]
  meta: ChemicalLedgerMeta
  tabName: string
}

const EMPTY_META: ChemicalLedgerMeta = {
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
}

function keepHeaderHeights(prev: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(prev).filter(([id]) => id.startsWith('thead-')))
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

function ClassWord({ word, active }: { word: string; active: string[] }) {
  return <span className={matchesClassWord(word, active) ? 'chem-hl' : undefined}>{word}</span>
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

export function ChemicalLedgerPage() {
  const { chemicalLedgers, saveChemicalLedgersAll } = useAppData()
  const [ledgers, setLedgers] = useState<ChemicalLedger[]>(() =>
    applyToxicOnlyCategoryDefaults(cloneLedgers(chemicalLedgers)),
  )
  const [selectedId, setSelectedId] = useState(chemicalLedgers[0]?.id ?? '')
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [tabEditMode, setTabEditMode] = useState(false)
  const dragTabId = useRef<string | null>(null)
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [formEdit, setFormEdit] = useState(false)
  const [formAction, setFormAction] = useState<ChemFormAction>(null)
  const [columns, setColumns] = useState<ChemFormColumn[]>(() => loadChemFormColumns())
  const [rowHeights, setRowHeights] = useState<Record<string, number>>(() => loadHeaderRowHeights())
  const [editRowLock, setEditRowLock] = useState<Record<string, number>>({})
  const [colPx, setColPx] = useState<Record<string, number>>({})
  const [flashColId, setFlashColId] = useState<string | null>(null)
  const [flashRowId, setFlashRowId] = useState<string | null>(null)
  const [fillRowHeight, setFillRowHeight] = useState<number | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const measureBodyRef = useRef<() => void>(() => {})
  const rowCountRef = useRef(1)
  const colDrag = useRef<{ id: string; startX: number; startPx: number } | null>(null)
  const rowDrag = useRef<{ id: string; startY: number; startH: number } | null>(null)
  const historyRef = useRef<{ past: FormSnapshot[]; future: FormSnapshot[] }>({ past: [], future: [] })
  const lastHistorySourceRef = useRef<string | null>(null)
  const applyingHistoryRef = useRef(false)
  const resizeSnapRef = useRef<FormSnapshot | null>(null)
  const selectedIdRef = useRef(selectedId)
  const layoutRef = useRef<FormSnapshot>({
    columns,
    colPx,
    rowHeights,
    editRowLock,
    rows: [],
    meta: EMPTY_META,
    tabName: '',
  })

  const selected = useMemo(
    () => ledgers.find((item) => item.id === selectedId) ?? ledgers[0],
    [ledgers, selectedId],
  )
  const classWords = selected ? activeClassWords(selected.meta) : []
  selectedIdRef.current = selectedId
  layoutRef.current = {
    columns,
    colPx,
    rowHeights,
    editRowLock,
    rows: selected?.rows ?? [],
    meta: selected?.meta ?? EMPTY_META,
    tabName: selected?.tabName ?? '',
  }
  const formEditRef = useRef(formEdit)
  formEditRef.current = formEdit

  useEffect(() => {
    setLedgers((prev) => applyToxicOnlyCategoryDefaults(prev))
  }, [])

  const liveRowHeights = formEdit ? { ...keepHeaderHeights(editRowLock), ...rowHeights } : keepHeaderHeights(rowHeights)

  const snapshotFormLayout = () => {
    const wrap = tableWrapRef.current
    const table = wrap?.querySelector('table')
    const tableW = wrap?.clientWidth || table?.getBoundingClientRect().width || 900
    const sum = columns.reduce((total, col) => total + col.width, 0) || 1
    setColPx(Object.fromEntries(columns.map((col) => [col.id, Math.max(28, (col.width / sum) * tableW)])))
    if (!table) return
    const next: Record<string, number> = {}
    table.querySelectorAll<HTMLTableRowElement>('tr[data-row-id^="thead-"]').forEach((tr) => {
      const id = tr.dataset.rowId
      if (id) next[id] = Math.max(22, Math.round(tr.getBoundingClientRect().height))
    })
    setEditRowLock(next)
  }

  const takeFormSnapshot = (): FormSnapshot => {
    const current = layoutRef.current
    return {
      columns: cloneJson(current.columns),
      colPx: { ...current.colPx },
      rowHeights: { ...current.rowHeights },
      editRowLock: { ...current.editRowLock },
      rows: cloneJson(current.rows),
      meta: cloneJson(current.meta),
      tabName: current.tabName,
    }
  }

  const syncHistoryButtons = (past = historyRef.current.past.length, future = historyRef.current.future.length) => {
    setCanUndo(past > 0)
    setCanRedo(future > 0)
  }

  const clearFormHistory = () => {
    historyRef.current = { past: [], future: [] }
    lastHistorySourceRef.current = null
    resizeSnapRef.current = null
    syncHistoryButtons(0, 0)
  }

  const pushFormHistory = (source?: string) => {
    if (applyingHistoryRef.current) return
    if (source && lastHistorySourceRef.current === source) {
      historyRef.current.future = []
      syncHistoryButtons()
      return
    }
    historyRef.current.past.push(takeFormSnapshot())
    if (historyRef.current.past.length > 80) historyRef.current.past.shift()
    historyRef.current.future = []
    lastHistorySourceRef.current = source ?? `step:${historyRef.current.past.length}`
    syncHistoryButtons()
  }

  const applyFormSnapshot = (snap: FormSnapshot) => {
    applyingHistoryRef.current = true
    const saved = saveChemFormColumns(snap.columns)
    setColumns(saved)
    setColPx(snap.colPx)
    setRowHeights(snap.rowHeights)
    setEditRowLock(snap.editRowLock)
    saveHeaderRowHeights(snap.rowHeights)
    const id = selectedIdRef.current
    if (id) {
      setLedgers((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, rows: snap.rows, meta: snap.meta, tabName: snap.tabName } : item,
        ),
      )
      setDirty(true)
      setSaved(false)
    }
    queueMicrotask(() => {
      applyingHistoryRef.current = false
    })
  }

  const undoForm = () => {
    const { past, future } = historyRef.current
    if (past.length === 0) return
    const prev = past.pop()
    if (!prev) return
    lastHistorySourceRef.current = null
    future.push(takeFormSnapshot())
    applyFormSnapshot(prev)
    syncHistoryButtons()
  }

  const redoForm = () => {
    const { past, future } = historyRef.current
    if (future.length === 0) return
    const next = future.pop()
    if (!next) return
    lastHistorySourceRef.current = null
    past.push(takeFormSnapshot())
    applyFormSnapshot(next)
    syncHistoryButtons()
  }

  useEffect(() => {
    document.body.classList.toggle('chem-form-edit', formEdit)
    if (!formEdit) {
      setFlashColId(null)
      setFlashRowId(null)
      setFormAction(null)
    }
    return () => document.body.classList.remove('chem-form-edit')
  }, [formEdit])

  useEffect(() => {
    clearFormHistory()
  }, [selectedId])

  useEffect(() => {
    if (!flashColId && !flashRowId) return
    const timer = window.setTimeout(() => {
      setFlashColId(null)
      setFlashRowId(null)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [flashColId, flashRowId])

  useEffect(() => {
    const id = flashRowId ?? flashColId
    if (!id || !tableWrapRef.current) return
    const target = flashRowId
      ? tableWrapRef.current.querySelector(`[data-row-id="${CSS.escape(flashRowId)}"]`)
      : tableWrapRef.current.querySelector(`[data-col-id="${CSS.escape(flashColId ?? '')}"]`)
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [flashColId, flashRowId])

  rowCountRef.current = selected?.rows.length ?? 1

  const measureBodyRows = () => {
    const wrap = tableWrapRef.current
    if (!wrap) return
    const wrapH = wrap.clientHeight
    if (wrapH < 40) return
    const thead = wrap.querySelector('thead')
    const n = Math.max(1, rowCountRef.current)
    const headH = thead?.offsetHeight ?? 0
    const available = wrapH - headH
    if (available <= 0) return
    const next = available / n
    setFillRowHeight((prev) => (prev != null && Math.abs(prev - next) < 0.05 ? prev : next))
  }
  measureBodyRef.current = measureBodyRows

  useLayoutEffect(() => {
    measureBodyRows()
    const wrap = tableWrapRef.current
    if (!wrap) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      if (document.body.classList.contains('chem-resizing-row')) return
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        measureBodyRef.current()
      })
    })
    observer.observe(wrap)
    window.addEventListener('beforeprint', measureBodyRows)
    window.addEventListener('afterprint', measureBodyRows)
    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('beforeprint', measureBodyRows)
      window.removeEventListener('afterprint', measureBodyRows)
    }
  }, [selected?.rows.length, formEdit])

  useLayoutEffect(() => {
    const wrap = tableWrapRef.current
    const table = wrap?.querySelector('table')
    if (!wrap || !table || fillRowHeight == null) return
    const extra = table.scrollHeight - wrap.clientHeight
    if (extra <= 1) return
    const n = Math.max(1, rowCountRef.current)
    setFillRowHeight((prev) => {
      if (prev == null) return prev
      const next = Math.max(1, prev - extra / n)
      return Math.abs(prev - next) < 0.05 ? prev : next
    })
  }, [fillRowHeight, selected?.rows.length, formEdit])

  useEffect(() => {
    const onMove = (event: globalThis.MouseEvent) => {
      if (colDrag.current) {
        const width = Math.max(28, colDrag.current.startPx + (event.clientX - colDrag.current.startX))
        const id = colDrag.current.id
        setColPx((prev) => ({ ...prev, [id]: width }))
      }
      if (rowDrag.current) {
        const height = Math.max(22, rowDrag.current.startH + (event.clientY - rowDrag.current.startY))
        const id = rowDrag.current.id
        setRowHeights((prev) => ({ ...prev, [id]: height }))
      }
    }
    const onUp = () => {
      const didResize = Boolean(colDrag.current || rowDrag.current)
      if (colDrag.current) {
        setColPx((current) => {
          setColumns((prev) => {
            const total = prev.reduce((sum, col) => sum + (current[col.id] ?? 40), 0) || 1
            return saveChemFormColumns(
              prev.map((col) => ({
                ...col,
                width: ((current[col.id] ?? 40) / total) * 100,
              })),
            )
          })
          return current
        })
        colDrag.current = null
      }
      if (rowDrag.current?.id.startsWith('thead-')) {
        setRowHeights((current) => {
          saveHeaderRowHeights(current)
          return current
        })
      }
      rowDrag.current = null
      document.body.classList.remove('chem-resizing', 'chem-resizing-col', 'chem-resizing-row')
      if (didResize) {
        const snap = resizeSnapRef.current
        if (snap) {
          historyRef.current.past.push(snap)
          if (historyRef.current.past.length > 80) historyRef.current.past.shift()
          historyRef.current.future = []
          lastHistorySourceRef.current = null
          setCanUndo(true)
          setCanRedo(false)
        }
        window.requestAnimationFrame(() => measureBodyRef.current())
      }
      resizeSnapRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const markDirty = () => {
    setDirty(true)
    setSaved(false)
  }

  const updateLedger = (id: string, patch: Partial<ChemicalLedger>) => {
    setLedgers((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    markDirty()
  }

  const replaceRows = (rows: ChemicalLedgerRow[]) => {
    if (!selected) return
    pushFormHistory()
    setRowHeights(keepHeaderHeights)
    setEditRowLock(keepHeaderHeights)
    updateLedger(selected.id, { rows })
  }

  const updateMeta = (patch: Partial<ChemicalLedgerMeta>, historySource?: string | false) => {
    if (!selected) return
    if (historySource !== false) {
      pushFormHistory(historySource ?? `meta:${Object.keys(patch).sort().join(',')}`)
    }
    updateLedger(selected.id, { meta: { ...selected.meta, ...patch } })
  }

  const toggleActivity = (key: keyof ChemicalActivities) => {
    if (!selected) return
    pushFormHistory()
    updateMeta({ activities: { ...selected.meta.activities, [key]: !selected.meta.activities[key] } }, false)
  }

  const updateRow = (rowId: string, patch: Partial<ChemicalLedgerRow>) => {
    if (!selected) return
    updateLedger(selected.id, {
      rows: selected.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    })
  }

  const updateCell = (rowId: string, column: ChemFormColumn, value: string) => {
    pushFormHistory(`cell:${rowId}:${column.key}`)
    if (column.key.startsWith('extra:')) {
      const extraKey = column.key.slice(6)
      const row = selected?.rows.find((item) => item.id === rowId)
      updateRow(rowId, { extra: { ...row?.extra, [extraKey]: value } })
      return
    }
    updateRow(rowId, { [column.key]: value } as Partial<ChemicalLedgerRow>)
  }

  const startColResize = (id: string, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (formEditRef.current) resizeSnapRef.current = takeFormSnapshot()
    const startPx = colPx[id] ?? 40
    colDrag.current = { id, startX: event.clientX, startPx }
    document.body.classList.add('chem-resizing', 'chem-resizing-col')
  }

  const startRowResize = (rowId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (formEditRef.current) resizeSnapRef.current = takeFormSnapshot()
    const rowEl = tableWrapRef.current?.querySelector(`tr[data-row-id="${rowId}"]`)
    rowDrag.current = {
      id: rowId,
      startY: event.clientY,
      startH: liveRowHeights[rowId] || rowEl?.getBoundingClientRect().height || 22,
    }
    document.body.classList.add('chem-resizing', 'chem-resizing-row')
  }

  const persistColumns = (next: ChemFormColumn[], historySource?: string) => {
    pushFormHistory(historySource)
    const saved = saveChemFormColumns(next)
    setColumns(saved)
    setColPx((prev) => {
      const mapped: Record<string, number> = {}
      for (const col of saved) {
        mapped[col.id] = prev[col.id] ?? 56
      }
      return mapped
    })
  }

  const confirmDelete = () => {
    if (!pendingDeleteId) return
    setLedgers((prev) => {
      const next = prev.filter((item) => item.id !== pendingDeleteId)
      setSelectedId((current) => (current === pendingDeleteId ? next[0]?.id ?? '' : current))
      return next
    })
    setPendingDeleteId(null)
    markDirty()
  }

  const reorderLedgers = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setLedgers((prev) => {
      const from = prev.findIndex((item) => item.id === fromId)
      const to = prev.findIndex((item) => item.id === toId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    markDirty()
  }

  const save = () => {
    saveChemicalLedgersAll(ledgers)
    setDirty(false)
    setSaved(true)
  }

  const printPage = () => {
    window.print()
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undoForm()
      } else if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
        event.preventDefault()
        redoForm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section className="chem-page">
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">
            <FlaskConical size={24} />
            화학물질 관리대장
          </h1>
          <p className="page-desc">
            화학물질관리법 시행규칙 별지 제75호 서식입니다. 각 칸을 직접 작성한 뒤 저장하고, A4 가로 한 장으로
            인쇄(PDF 저장)할 수 있습니다.
          </p>
        </div>
      </div>

      <div className={`page-tabs no-print${tabEditMode ? ' is-editing-tabs' : ''}`}>
        {ledgers.map((item) => (
          <div
            key={item.id}
            className={`chip ${item.id === selected?.id ? 'active' : ''} ${draggingTabId === item.id ? 'is-dragging' : ''}`}
            draggable={tabEditMode}
            onClick={() => setSelectedId(item.id)}
            onDragStart={(event) => {
              if (!tabEditMode) return
              dragTabId.current = item.id
              setDraggingTabId(item.id)
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(event) => {
              if (!tabEditMode || !dragTabId.current) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(event) => {
              event.preventDefault()
              const fromId = dragTabId.current
              if (fromId) reorderLedgers(fromId, item.id)
              dragTabId.current = null
              setDraggingTabId(null)
            }}
            onDragEnd={() => {
              dragTabId.current = null
              setDraggingTabId(null)
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedId(item.id)}
              onFocus={() => setSelectedId(item.id)}
            >
              {item.tabName || '새 물질'}
            </button>
            {tabEditMode ? (
              <button
                className="chip-x"
                type="button"
                tabIndex={-1}
                aria-label={`${item.tabName || '새 물질'} 삭제`}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setPendingDeleteId(item.id)
                }}
              >
                <X size={11} strokeWidth={3} />
              </button>
            ) : null}
          </div>
        ))}
        {tabEditMode ? (
          <button
            className="chip chip-add"
            type="button"
            onClick={() => {
              const next = createBlankLedger()
              setLedgers((prev) => [...prev, next])
              setSelectedId(next.id)
              markDirty()
            }}
          >
            <Plus size={14} />
            추가
          </button>
        ) : null}
        <button
          className={`chip chip-add ${tabEditMode ? 'is-edit' : ''}`}
          type="button"
          onClick={() => {
            setTabEditMode((value) => !value)
            setPendingDeleteId(null)
          }}
        >
          <Pencil size={14} />
          {tabEditMode ? '수정 완료' : '수정'}
        </button>
      </div>

      {!selected ? (
        <p className="equip-empty">등록된 물질이 없습니다.</p>
      ) : (
        <>
            {formEdit && (
              <ChemFormEditBar
                action={formAction}
                onAction={setFormAction}
              />
            )}
            <div className="chem-sheet-tools no-print">
              {formEdit ? (
                <>
                  <button
                    className="chem-doc-btn chem-doc-icon"
                    type="button"
                    aria-label="뒤로가기"
                    disabled={!canUndo}
                    onClick={undoForm}
                  >
                    <Undo2 size={16} />
                  </button>
                  <button
                    className="chem-doc-btn chem-doc-icon"
                    type="button"
                    aria-label="앞으로가기"
                    disabled={!canRedo}
                    onClick={redoForm}
                  >
                    <Redo2 size={16} />
                  </button>
                  <button
                    className="chem-doc-btn is-on"
                    type="button"
                    onClick={() => {
                      setEditRowLock({})
                      setFormEdit(false)
                    }}
                  >
                    <TableProperties size={14} />
                    양식 수정 완료
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="chem-doc-btn"
                    type="button"
                    onClick={() => {
                      snapshotFormLayout()
                      setFormEdit(true)
                    }}
                  >
                    <TableProperties size={14} />
                    양식 수정
                  </button>
                  <button
                    className="chem-doc-btn chem-doc-icon"
                    type="button"
                    aria-label="뒤로가기"
                    disabled={!canUndo}
                    onClick={undoForm}
                  >
                    <Undo2 size={16} />
                  </button>
                  <button
                    className="chem-doc-btn chem-doc-icon"
                    type="button"
                    aria-label="앞으로가기"
                    disabled={!canRedo}
                    onClick={redoForm}
                  >
                    <Redo2 size={16} />
                  </button>
                  <button
                    className={`chem-doc-btn chem-doc-save ${dirty ? 'is-dirty' : ''}`}
                    type="button"
                    onClick={save}
                  >
                    <img src={diskette} alt="" />
                    {dirty ? '저장' : saved ? '저장됨' : '저장'}
                  </button>
                  <button className="chem-doc-btn" type="button" onClick={printPage}>
                    <Printer size={14} />
                    인쇄
                  </button>
                </>
              )}
            </div>
        <div className="chem-paper">
          <form className="chem-sheet" onSubmit={(event) => event.preventDefault()}>
            <p className="chem-legal">¾ 화학물질관리법 시행규칙 [별지 제75호 서식]</p>

            <div className="chem-frame">
            <div className="chem-title-row">
              <strong>화학물질</strong>
              <MarkBox
                checked={selected.meta.activities.manufacture}
                onToggle={() => toggleActivity('manufacture')}
                label="제조"
              />
              <MarkBox
                checked={selected.meta.activities.import}
                onToggle={() => toggleActivity('import')}
                label="수입"
              />
              <MarkBox
                checked={selected.meta.activities.use}
                onToggle={() => toggleActivity('use')}
                label="사용"
              />
              <MarkBox
                checked={selected.meta.activities.sale}
                onToggle={() => toggleActivity('sale')}
                label="판매"
              />
              <strong>관리대장</strong>
            </div>

            <div className="chem-meta">
              <div className="chem-align-grid">
                <label className="chem-inline">
                  <span>제품(상품)명 :</span>
                  <input
                    value={selected.meta.productName}
                    onChange={(e) => {
                      const productName = e.target.value
                      pushFormHistory('meta:productName')
                      updateLedger(selected.id, {
                        meta: { ...selected.meta, productName },
                        tabName: selected.tabName === selected.meta.productName || !selected.tabName
                          ? productName || '새 물질'
                          : selected.tabName,
                      })
                    }}
                  />
                </label>
                <label className="chem-inline chem-use">
                  <span>주요용도 :</span>
                  <input
                    value={selected.meta.mainUse}
                    onChange={(e) => updateMeta({ mainUse: e.target.value })}
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
                    value={selected.meta.category1}
                    onChange={(e) => updateMeta({ category1: e.target.value })}
                  />
                </label>
                <label className="chem-inline">
                  <span>2.</span>
                  <input
                    value={selected.meta.category2}
                    onChange={(e) => updateMeta({ category2: e.target.value })}
                  />
                </label>
                <label className="chem-inline">
                  <span>3.</span>
                  <input
                    value={selected.meta.category3}
                    onChange={(e) => updateMeta({ category3: e.target.value })}
                  />
                </label>
                <span className="chem-align-spacer" />

                <label className="chem-inline chem-content-lead">
                  <span>함량 :</span>
                  <input
                    value={selected.meta.content}
                    onChange={(e) => updateMeta({ content: formatContentPercent(e.target.value) })}
                  />
                </label>
                <label className="chem-inline">
                  <span>1.</span>
                  <input
                    value={selected.meta.content1}
                    onChange={(e) => updateMeta({ content1: formatContentPercent(e.target.value) })}
                  />
                </label>
                <label className="chem-inline">
                  <span>2.</span>
                  <input
                    value={selected.meta.content2}
                    onChange={(e) => updateMeta({ content2: formatContentPercent(e.target.value) })}
                  />
                </label>
                <label className="chem-inline">
                  <span>3.</span>
                  <input
                    value={selected.meta.content3}
                    onChange={(e) => updateMeta({ content3: formatContentPercent(e.target.value) })}
                  />
                </label>
                <div className="chem-unit">
                  <span>(단위 :&nbsp;</span>
                  <span className="chem-unit-value">
                    <span className="chem-unit-sizer" aria-hidden="true">
                      {selected.meta.unit || ' '}
                    </span>
                    <input
                      value={selected.meta.unit}
                      onChange={(e) => updateMeta({ unit: e.target.value })}
                      aria-label="단위"
                      size={1}
                    />
                  </span>
                  <span>)</span>
                </div>
              </div>
            </div>

            <div className="chem-table-wrap" ref={tableWrapRef}>
              <ChemLedgerTable
                columns={columns}
                rows={selected.rows}
                unit={selected.meta.unit}
                formEdit={formEdit}
                formAction={formAction}
                rowHeights={liveRowHeights}
                fillRowHeight={fillRowHeight}
                onUpdateCell={updateCell}
                onDeleteRow={(rowId) =>
                  replaceRows(selected.rows.filter((row) => row.id !== rowId))
                }
                onInsertRow={(afterId) => {
                  const index = selected.rows.findIndex((row) => row.id === afterId)
                  const next = [...selected.rows]
                  const row = createLedgerRow()
                  next.splice(index + 1, 0, row)
                  replaceRows(next)
                  setFlashRowId(row.id)
                }}
                onInsertCol={(afterId) => {
                  const after = columns.find((col) => col.id === afterId)
                  if (!after) return
                  const col = createChemColumn(after.group, after.block)
                  const index = columns.findIndex((item) => item.id === afterId)
                  persistColumns([...columns.slice(0, index + 1), col, ...columns.slice(index + 1)])
                  setFlashColId(col.id)
                  setFormAction(null)
                }}
                colPx={colPx}
                flashColId={flashColId}
                flashRowId={flashRowId}
                onResizeStart={startColResize}
                onRowResizeStart={startRowResize}
                onDeleteCol={(id) => {
                  if (columns.length <= 1) return
                  persistColumns(columns.filter((col) => col.id !== id))
                }}
                onRename={(id, label) =>
                  persistColumns(
                    columns.map((col) => (col.id === id ? { ...col, label } : col)),
                    `rename:${id}`,
                  )
                }
              />
            </div>
            </div>

            <div className="chem-foot">
              <span className="chem-paper-size">297mm × 210mm [백상지 80g/m²]</span>
            </div>
          </form>
        </div>
        </>
      )}

      {pendingDeleteId && (
        <div className="modal-backdrop confirm-backdrop no-print" onClick={() => setPendingDeleteId(null)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chem-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="chem-delete-title">삭제 하시겠습니까?</p>
            <div className="confirm-modal-actions">
              <button className="secondary-btn" type="button" onClick={() => setPendingDeleteId(null)}>
                아니오
              </button>
              <button className="primary-btn" type="button" onClick={confirmDelete}>
                예
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
