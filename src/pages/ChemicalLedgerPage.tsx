import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Calendar, ChevronLeft, ChevronRight, FlaskConical, Pencil, Plus, Printer, Redo2, TableProperties, Undo2, X } from 'lucide-react'
import { PageHead } from '../components/layout/PageHead'
import { ComposeModeButton } from '../components/ComposeModeButton'
import diskette from '../assets/diskette.png'
import { ChemLedgerAllView, ChemLedgerSheet, ALL_TAB_ID, PRINT_PAGE_HEIGHT_MM } from '../components/ChemLedgerSheet'
import { ChemFormEditBar, type ChemFormAction } from '../components/ChemLedgerTable'
import { useAppData } from '../context/AppDataContext'
import { useComposeMode } from '../lib/composeMode'
import {
  createChemColumn,
  loadChemFormColumns,
  loadChemSheetChrome,
  loadHeaderRowHeights,
  migrateChemFormLayout,
  normalizeColumns,
  removeChemFormLayout,
  saveChemFormColumns,
  saveChemFormLayoutAll,
  saveChemSheetChrome,
  saveHeaderRowHeights,
  type ChemFormColumn,
  type ChemSheetChrome,
} from '../lib/chemFormLayout'
import {
  applyToxicOnlyCategoryDefaults,
  createBlankLedger,
  createLedgerRow,
  ensureLedgerYear,
  ledgerCalendarYear,
} from '../lib/chemicals'
import type {
  ChemicalActivities,
  ChemicalLedger,
  ChemicalLedgerMeta,
  ChemicalLedgerRow,
  ChemicalLedgersByYear,
} from '../types'

function cloneYearBook(book: ChemicalLedgersByYear): ChemicalLedgersByYear {
  return JSON.parse(JSON.stringify(book)) as ChemicalLedgersByYear
}

function withToxicDefaults(book: ChemicalLedgersByYear): ChemicalLedgersByYear {
  return Object.fromEntries(
    Object.entries(book).map(([year, list]) => [year, applyToxicOnlyCategoryDefaults(list)]),
  )
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

interface FormSnapshot {
  columns: ChemFormColumn[]
  colPx: Record<string, number>
  rowHeights: Record<string, number>
  editRowLock: Record<string, number>
  chrome: ChemSheetChrome
  rows: ChemicalLedgerRow[]
  yearRows: Record<string, ChemicalLedgerRow[]>
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

export function ChemicalLedgerPage() {
  const { chemicalYearBook, saveChemicalYearBookAll } = useAppData()
  const [selectedYear, setSelectedYear] = useState(() => ledgerCalendarYear())
  const [yearOpen, setYearOpen] = useState(false)
  const yearPickRef = useRef<HTMLDivElement>(null)
  const [yearBook, setYearBook] = useState<ChemicalLedgersByYear>(() => withToxicDefaults(cloneYearBook(chemicalYearBook)))
  const yearKey = String(selectedYear)
  const ledgers = yearBook[yearKey] ?? []
  const [selectedId, setSelectedId] = useState(ledgers[0]?.id ?? '')
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [tabEditMode, setTabEditMode] = useState(false)
  const dragTabId = useRef<string | null>(null)
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [formEdit, setFormEdit] = useState(false)
  const { compose, toggleCompose } = useComposeMode()
  const [formAction, setFormAction] = useState<ChemFormAction>(null)
  const [columns, setColumns] = useState<ChemFormColumn[]>(() => {
    const ids = Object.values(chemicalYearBook).flatMap((list) => list.map((item) => item.id))
    migrateChemFormLayout(ids)
    return loadChemFormColumns(ledgers[0]?.id ?? '')
  })
  const [rowHeights, setRowHeights] = useState<Record<string, number>>(() =>
    loadHeaderRowHeights(ledgers[0]?.id ?? ''),
  )
  const [chrome, setChrome] = useState<ChemSheetChrome>(() => loadChemSheetChrome(ledgers[0]?.id ?? ''))
  const [editRowLock, setEditRowLock] = useState<Record<string, number>>({})
  const [colPx, setColPx] = useState<Record<string, number>>({})
  const [flashColId, setFlashColId] = useState<string | null>(null)
  const [flashRowId, setFlashRowId] = useState<string | null>(null)
  const [fillRowHeight, setFillRowHeight] = useState<number | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLFormElement>(null)
  const [pageGuideCount, setPageGuideCount] = useState(0)
  const measureBodyRef = useRef<() => void>(() => {})
  const rowCountRef = useRef(1)
  const colDrag = useRef<{ id: string; startX: number; startPx: number } | null>(null)
  const rowDrag = useRef<{ id: string; startY: number; startH: number } | null>(null)
  const historyRef = useRef<{ past: FormSnapshot[]; future: FormSnapshot[] }>({ past: [], future: [] })
  const lastHistorySourceRef = useRef<string | null>(null)
  const applyingHistoryRef = useRef(false)
  const resizeSnapRef = useRef<FormSnapshot | null>(null)
  const selectedIdRef = useRef(selectedId)
  const selectedYearRef = useRef(selectedYear)
  const layoutRef = useRef<FormSnapshot>({
    columns,
    colPx,
    rowHeights,
    editRowLock,
    chrome,
    rows: [],
    yearRows: {},
    meta: EMPTY_META,
    tabName: '',
  })

  const showAll = selectedId === ALL_TAB_ID
  const selected = useMemo(() => {
    if (selectedId === ALL_TAB_ID) return null
    return ledgers.find((item) => item.id === selectedId) ?? ledgers[0]
  }, [ledgers, selectedId])
  const yearChoices = useMemo(() => {
    const current = ledgerCalendarYear()
    const stored = Object.keys(yearBook)
      .map(Number)
      .filter((year) => Number.isFinite(year))
    const start = Math.min(current - 10, selectedYear, ...stored)
    const end = Math.max(current + 10, selectedYear)
    const years: number[] = []
    for (let year = start; year <= end; year += 1) years.push(year)
    return years
  }, [yearBook, selectedYear])
  selectedIdRef.current = selectedId
  selectedYearRef.current = selectedYear
  layoutRef.current = {
    columns,
    colPx,
    rowHeights,
    editRowLock,
    chrome,
    rows: selected?.rows ?? [],
    yearRows: Object.fromEntries(ledgers.map((item) => [item.id, item.rows])),
    meta: selected?.meta ?? EMPTY_META,
    tabName: selected?.tabName ?? '',
  }
  const formEditRef = useRef(formEdit)
  formEditRef.current = formEdit
  const ledgersRef = useRef(ledgers)
  ledgersRef.current = ledgers

  useEffect(() => {
    setYearBook((prev) => withToxicDefaults(prev))
  }, [])

  useEffect(() => {
    if (!yearOpen) return
    const close = (event: Event) => {
      const target = event.target
      if (target instanceof Node && yearPickRef.current?.contains(target)) return
      setYearOpen(false)
    }
    document.addEventListener('mousedown', close)
    const frame = window.requestAnimationFrame(() => {
      const menu = yearPickRef.current?.querySelector<HTMLElement>('.chem-year-menu')
      const active = menu?.querySelector<HTMLElement>('button.is-active')
      if (!menu || !active) return
      const menuRect = menu.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()
      menu.scrollTop += activeRect.top - menuRect.top
    })
    return () => {
      document.removeEventListener('mousedown', close)
      window.cancelAnimationFrame(frame)
    }
  }, [yearOpen])

  const liveRowHeights = formEdit ? { ...keepHeaderHeights(editRowLock), ...rowHeights } : rowHeights

  const snapshotFormLayout = () => {
    const wrap = tableWrapRef.current
    const table =
      wrap?.querySelector('table') ??
      document.querySelector<HTMLTableElement>('.chem-all-stack table')
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
      chrome: { ...current.chrome },
      rows: cloneJson(current.rows),
      yearRows: cloneJson(current.yearRows),
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
    const id = selectedIdRef.current
    const saved = normalizeColumns(snap.columns)
    setColumns(saved)
    setColPx(snap.colPx)
    setRowHeights(snap.rowHeights)
    setEditRowLock(snap.editRowLock)
    setChrome(snap.chrome)
    if (!formEditRef.current) {
      if (id === ALL_TAB_ID) {
        saveChemFormLayoutAll(
          ledgersRef.current.map((item) => item.id),
          saved,
          snap.chrome,
          snap.rowHeights,
        )
      } else if (id) {
        saveChemFormColumns(saved, id)
        saveHeaderRowHeights(snap.rowHeights, id)
        saveChemSheetChrome(snap.chrome, id)
      }
    }
    if (id === ALL_TAB_ID) {
      const key = String(selectedYearRef.current)
      setYearBook((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).map((item) =>
          snap.yearRows[item.id] ? { ...item, rows: cloneJson(snap.yearRows[item.id]) } : item,
        ),
      }))
      setDirty(true)
      setSaved(false)
    } else if (id) {
      const key = String(selectedYearRef.current)
      setYearBook((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).map((item) =>
          item.id === id ? { ...item, rows: snap.rows, meta: snap.meta, tabName: snap.tabName } : item,
        ),
      }))
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

  useLayoutEffect(() => {
    if (!formEdit || showAll) {
      setPageGuideCount(0)
      return
    }
    const sheet = sheetRef.current
    if (!sheet) return
    const update = () => {
      const pagePx = (PRINT_PAGE_HEIGHT_MM * 96) / 25.4
      const next = Math.max(0, Math.floor((sheet.scrollHeight - 8) / pagePx))
      setPageGuideCount(next)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [formEdit, showAll, fillRowHeight, selected?.rows.length, columns, chrome, rowHeights])

  useEffect(() => {
    const seedId = selectedId === ALL_TAB_ID ? ledgersRef.current[0]?.id ?? '' : selectedId
    clearFormHistory()
    setFormAction(null)
    setColumns(loadChemFormColumns(seedId))
    setRowHeights(loadHeaderRowHeights(seedId))
    setChrome(loadChemSheetChrome(seedId))
    setColPx({})
    setEditRowLock({})
    setFormEdit(false)
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
    if (showAll) return
    if (document.body.classList.contains('chem-printing')) return
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
      if (document.body.classList.contains('chem-printing')) return
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        measureBodyRef.current()
      })
    })
    observer.observe(wrap)
    const onBeforePrint = () => document.body.classList.add('chem-printing')
    const onAfterPrint = () => {
      document.body.classList.remove('chem-printing')
      measureBodyRef.current()
    }
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
      document.body.classList.remove('chem-printing')
    }
  }, [selected?.rows.length, formEdit, showAll])

  useLayoutEffect(() => {
    if (showAll) return
    const wrap = tableWrapRef.current
    const table = wrap?.querySelector('table')
    if (!wrap || !table || fillRowHeight == null) return
    const extra = table.scrollHeight - wrap.clientHeight
    if (extra <= 1 || extra > 12) return
    const n = Math.max(1, rowCountRef.current)
    setFillRowHeight((prev) => {
      if (prev == null) return prev
      const next = Math.max(1, prev - extra / n)
      return Math.abs(prev - next) < 0.05 ? prev : next
    })
  }, [fillRowHeight, selected?.rows.length, formEdit, showAll])

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
            return normalizeColumns(
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

  const updateYearLedgers = (updater: (list: ChemicalLedger[]) => ChemicalLedger[]) => {
    const key = String(selectedYearRef.current)
    setYearBook((prev) => ({ ...prev, [key]: updater(prev[key] ?? []) }))
  }

  const updateLedger = (id: string, patch: Partial<ChemicalLedger>) => {
    updateYearLedgers((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    markDirty()
  }

  const selectYear = (year: number) => {
    if (year === selectedYear) return
    const nextBook = ensureLedgerYear(yearBook, year)
    const nextList = nextBook[String(year)] ?? []
    setYearBook(nextBook)
    setSelectedYear(year)
    const nextId =
      selectedId === ALL_TAB_ID
        ? ALL_TAB_ID
        : nextList.some((item) => item.id === selectedId)
          ? selectedId
          : nextList[0]?.id ?? ALL_TAB_ID
    if (formEditRef.current && nextId === selectedId && nextId !== ALL_TAB_ID) {
      setColumns(loadChemFormColumns(nextId))
      setRowHeights(loadHeaderRowHeights(nextId))
      setChrome(loadChemSheetChrome(nextId))
      setColPx({})
      setEditRowLock({})
    }
    setSelectedId(nextId)
    clearFormHistory()
    setFormEdit(false)
    setFormAction(null)
    setTabEditMode(false)
    setPendingDeleteId(null)
  }

  const insertRowAfter = (ledgerId: string, afterId: string, applyAll: boolean) => {
    const list = ledgersRef.current
    const source = list.find((item) => item.id === ledgerId)
    if (!source) return
    const index = source.rows.findIndex((row) => row.id === afterId)
    const at = index >= 0 ? index + 1 : source.rows.length
    pushFormHistory()
    setRowHeights(keepHeaderHeights)
    setEditRowLock(keepHeaderHeights)
    const inserted = new Map<string, ChemicalLedgerRow>()
    for (const ledger of list) {
      if (!applyAll && ledger.id !== ledgerId) continue
      inserted.set(ledger.id, createLedgerRow())
    }
    updateYearLedgers((prev) =>
      prev.map((ledger) => {
        const row = inserted.get(ledger.id)
        if (!row) return ledger
        const rows = [...ledger.rows]
        rows.splice(Math.min(at, rows.length), 0, row)
        return { ...ledger, rows }
      }),
    )
    const flash = inserted.get(ledgerId)
    if (flash) setFlashRowId(flash.id)
    markDirty()
  }

  const deleteRowAt = (ledgerId: string, rowId: string, applyAll: boolean) => {
    const list = ledgersRef.current
    const source = list.find((item) => item.id === ledgerId)
    if (!source) return
    const index = source.rows.findIndex((row) => row.id === rowId)
    if (index < 0) return
    if (!applyAll && source.rows.length <= 1) return
    pushFormHistory()
    setRowHeights(keepHeaderHeights)
    setEditRowLock(keepHeaderHeights)
    updateYearLedgers((prev) =>
      prev.map((ledger) => {
        if (!applyAll && ledger.id !== ledgerId) return ledger
        if (ledger.rows.length <= 1) return ledger
        if (applyAll && index >= ledger.rows.length) return ledger
        if (!applyAll) return { ...ledger, rows: ledger.rows.filter((row) => row.id !== rowId) }
        return { ...ledger, rows: ledger.rows.filter((_, rowIndex) => rowIndex !== index) }
      }),
    )
    markDirty()
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
    if (!selected) return
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
    const table = event.currentTarget.closest('table')
    const rowEl =
      table?.querySelector(`tr[data-row-id="${rowId}"]`) ??
      tableWrapRef.current?.querySelector(`tr[data-row-id="${rowId}"]`)
    rowDrag.current = {
      id: rowId,
      startY: event.clientY,
      startH: liveRowHeights[rowId] || rowEl?.getBoundingClientRect().height || 22,
    }
    document.body.classList.add('chem-resizing', 'chem-resizing-row')
  }

  const persistColumns = (next: ChemFormColumn[], historySource?: string) => {
    pushFormHistory(historySource)
    const saved = normalizeColumns(next)
    setColumns(saved)
    setColPx((prev) => {
      const mapped: Record<string, number> = {}
      for (const col of saved) {
        mapped[col.id] = prev[col.id] ?? 56
      }
      return mapped
    })
  }

  const persistChrome = (patch: Partial<ChemSheetChrome>, historySource?: string) => {
    pushFormHistory(historySource)
    setChrome((prev) => ({ ...prev, ...patch }))
  }

  const insertCol = (afterId: string) => {
    const after = columns.find((col) => col.id === afterId)
    if (!after) return
    const col = createChemColumn(after.group, after.block)
    const index = columns.findIndex((item) => item.id === afterId)
    persistColumns([...columns.slice(0, index + 1), col, ...columns.slice(index + 1)])
    setFlashColId(col.id)
    setFormAction(null)
  }

  const deleteCol = (id: string) => {
    if (columns.length <= 1) return
    persistColumns(columns.filter((col) => col.id !== id))
  }

  const renameCol = (id: string, label: string) => {
    persistColumns(
      columns.map((col) => (col.id === id ? { ...col, label } : col)),
      `rename:${id}`,
    )
  }

  const renameBlock = (id: string, block: string) => {
    const target = columns.find((col) => col.id === id)
    if (!target) return
    persistColumns(
      columns.map((col) =>
        col.group === target.group && col.block === target.block ? { ...col, block } : col,
      ),
      `rename-block:${target.group}:${id}`,
    )
  }

  const commitFormLayout = () => {
    const id = selectedIdRef.current
    if (id === ALL_TAB_ID) {
      saveChemFormLayoutAll(
        ledgersRef.current.map((item) => item.id),
        columns,
        chrome,
        rowHeights,
      )
    } else {
      saveChemFormColumns(columns, id)
      saveChemSheetChrome(chrome, id)
      saveHeaderRowHeights(rowHeights, id)
    }
    setEditRowLock({})
    setFormEdit(false)
  }

  const confirmDelete = () => {
    if (!pendingDeleteId) return
    const deletedId = pendingDeleteId
    const key = String(selectedYearRef.current)
    setYearBook((prev) => {
      const nextList = (prev[key] ?? []).filter((item) => item.id !== deletedId)
      const nextBook = { ...prev, [key]: nextList }
      const stillUsed = Object.values(nextBook).some((list) => list.some((item) => item.id === deletedId))
      if (!stillUsed) removeChemFormLayout(deletedId)
      setSelectedId((current) => (current === deletedId ? nextList[0]?.id ?? '' : current))
      return nextBook
    })
    setPendingDeleteId(null)
    markDirty()
  }

  const reorderLedgers = (fromId: string, toId: string) => {
    if (fromId === toId) return
    updateYearLedgers((prev) => {
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
    saveChemicalYearBookAll(yearBook)
    setDirty(false)
    setSaved(true)
  }

  const printPage = () => {
    document.body.classList.add('chem-printing')
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
    <section className={`chem-page${compose ? ' is-compose' : ''}`}>
      <PageHead
        className="no-print"
        icon={FlaskConical}
        title="화학물질 관리대장"
        description="연도별 화학물질 입·출고량을 기록·관리합니다."
      />

      <div className="chem-toolbar no-print">
        <div className="date-bar chem-year-bar insp-month-bar">
          <div className="insp-month-shift">
            <button
              className="insp-month-nav"
              type="button"
              aria-label="이전 해"
              onClick={() => selectYear(selectedYear - 1)}
            >
              <ChevronLeft size={14} strokeWidth={2.4} />
              이전
            </button>
            <div className="chem-year-pick" ref={yearPickRef}>
                <button
                  className="chem-year-pick-btn"
                  type="button"
                  aria-label="작성 연도 선택"
                  aria-expanded={yearOpen}
                  aria-haspopup="listbox"
                  onClick={() => setYearOpen((open) => !open)}
                >
                  <span>{selectedYear}년</span>
                  <Calendar size={14} strokeWidth={2.2} aria-hidden="true" />
                </button>
                {yearOpen ? (
                  <ul className="chem-year-menu" role="listbox" aria-label="작성 연도">
                    {yearChoices.map((year) => (
                      <li key={year} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={year === selectedYear}
                          className={year === selectedYear ? 'is-active' : ''}
                          onClick={() => {
                            selectYear(year)
                            setYearOpen(false)
                          }}
                        >
                          {year}년
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            <button
              className="insp-month-nav"
              type="button"
              aria-label="다음 해"
              onClick={() => selectYear(selectedYear + 1)}
            >
              다음
              <ChevronRight size={14} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div className="date-bar chem-tab-bar">
          <div className={`page-tabs${tabEditMode ? ' is-editing-tabs' : ''}`}>
        <div className={`chip ${showAll ? 'active' : ''}`}>
          <button
            type="button"
            onClick={() => {
              setSelectedId(ALL_TAB_ID)
              setFormEdit(false)
              setFormAction(null)
              clearFormHistory()
            }}
          >
            전체
          </button>
        </div>
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
              updateYearLedgers((prev) => [...prev, next])
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
        </div>
      </div>

      {ledgers.length === 0 ? (
        <p className="equip-empty">등록된 물질이 없습니다.</p>
      ) : (
        <>
            <div className="chem-sheet-tools no-print">
              {formEdit ? (
                <>
                  <ChemFormEditBar
                    action={formAction}
                    onAction={setFormAction}
                    layoutOnly={showAll}
                  />
                  <div className="chem-sheet-tool-btns">
                    <ComposeModeButton active={compose} onToggle={toggleCompose} />
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
                      className="chem-doc-btn chem-doc-commit"
                      type="button"
                      onClick={commitFormLayout}
                    >
                      <TableProperties size={14} />
                      양식 수정 완료
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <ComposeModeButton active={compose} onToggle={toggleCompose} />
                  <button
                    className="chem-doc-btn"
                    type="button"
                    onClick={() => {
                      snapshotFormLayout()
                      setFormAction(null)
                      setFormEdit(true)
                    }}
                  >
                    <TableProperties size={14} />
                    양식 수정
                  </button>
                  {showAll ? null : (
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
                    </>
                  )}
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
        {showAll ? (
          <ChemLedgerAllView
            ledgers={ledgers}
            year={selectedYear}
            onUpdateLedger={updateLedger}
            formEdit={formEdit}
            formAction={formAction}
            sharedColumns={columns}
            sharedChrome={chrome}
            sharedRowHeights={liveRowHeights}
            colPx={colPx}
            flashColId={flashColId}
            flashRowId={flashRowId}
            onChromeChange={persistChrome}
            onInsertCol={insertCol}
            onDeleteCol={deleteCol}
            onRenameCol={renameCol}
            onRenameBlock={renameBlock}
            onResizeStart={startColResize}
            onRowResizeStart={startRowResize}
            onInsertRow={(ledgerId, afterId) => insertRowAfter(ledgerId, afterId, true)}
            onDeleteRow={(ledgerId, rowId) => deleteRowAt(ledgerId, rowId, true)}
          />
        ) : selected ? (
        <div className="chem-paper">
          <ChemLedgerSheet
            ledger={selected}
            year={selectedYear}
            formEdit={formEdit}
            formAction={formAction}
            columns={columns}
            chrome={chrome}
            rowHeights={liveRowHeights}
            fillRowHeight={fillRowHeight}
            colPx={colPx}
            flashColId={flashColId}
            flashRowId={flashRowId}
            showPageGuides={formEdit}
            extraGuides={pageGuideCount}
            sheetRef={sheetRef}
            tableWrapRef={tableWrapRef}
            onChromeChange={persistChrome}
            onUpdateCell={updateCell}
            onUpdateMeta={(patch) => updateMeta(patch)}
            onToggleActivity={toggleActivity}
            onRenameProduct={(productName) => {
              pushFormHistory('meta:productName')
              updateLedger(selected.id, {
                meta: { ...selected.meta, productName },
                tabName:
                  selected.tabName === selected.meta.productName || !selected.tabName
                    ? productName || '새 물질'
                    : selected.tabName,
              })
            }}
            onDeleteRow={(rowId) => deleteRowAt(selected.id, rowId, false)}
            onInsertRow={(afterId) => insertRowAfter(selected.id, afterId, false)}
            onInsertCol={insertCol}
            onDeleteCol={deleteCol}
            onRenameCol={renameCol}
            onRenameBlock={renameBlock}
            onResizeStart={startColResize}
            onRowResizeStart={startRowResize}
          />
        </div>
        ) : null}
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
