import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Calendar, ChevronLeft, ChevronRight, FlaskConical, Pencil, Plus, Printer, Redo2, RotateCcw, TableProperties, Undo2, X } from 'lucide-react'
import { PageHead } from '../components/layout/PageHead'
import { ComposeModeButton } from '../components/ComposeModeButton'
import diskette from '../assets/diskette.png'
import {
  ChemLedgerAllView,
  ChemLedgerSheet,
  ChemPageDeleteButton,
  ALL_TAB_ID,
} from '../components/ChemLedgerSheet'
import { ChemFormEditBar, type ChemFormAction } from '../components/ChemLedgerTable'
import { useAppData } from '../context/AppDataContext'
import { useComposeMode } from '../lib/composeMode'
import {
  CHEM_BODY_ROW_KEY,
  CHROME_META_LEFT,
  clampChemCellFont,
  createChemColumn,
  defaultChemCellFont,
  isChemHeaderRowId,
  parseChemBodyCell,
  resolveChemCellFont,
  keepLayoutHeights,
  loadChemCellFonts,
  loadChemFormColumns,
  loadChemPageCounts,
  loadChemSheetChrome,
  loadHeaderRowHeights,
  migrateChemFormLayout,
  normalizeColumns,
  normalizePageCounts,
  pageChunksFromCounts,
  pageIndexForRow,
  removeChemFormLayout,
  saveChemCellFonts,
  saveChemFormColumns,
  saveChemFormLayoutAll,
  saveChemPageCounts,
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
  LEDGER_ROW_COUNT,
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
  cellFonts: Record<string, number>
  rows: ChemicalLedgerRow[]
  yearRows: Record<string, ChemicalLedgerRow[]>
  pageCountsById: Record<string, number[]>
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
  return Object.fromEntries(Object.entries(prev).filter(([id]) => isChemHeaderRowId(id)))
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
  const [pendingReset, setPendingReset] = useState(false)
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
  const [cellFonts, setCellFonts] = useState<Record<string, number>>(() => loadChemCellFonts(ledgers[0]?.id ?? ''))
  const [selectedCellIds, setSelectedCellIds] = useState<string[]>([])
  const [editRowLock, setEditRowLock] = useState<Record<string, number>>({})
  const [colPx, setColPx] = useState<Record<string, number>>({})
  const [flashColId, setFlashColId] = useState<string | null>(null)
  const [flashRowId, setFlashRowId] = useState<string | null>(null)
  const [pageCountsById, setPageCountsById] = useState<Record<string, number[]>>({})
  const [selectedPage, setSelectedPage] = useState<{ ledgerId: string; index: number } | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLFormElement>(null)
  const rowHeightsRef = useRef(rowHeights)
  const colDrag = useRef<{
    id: string
    startX: number
    startPx: number
    kind?: 'meta-split'
    grid?: HTMLElement
  } | null>(null)
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
    cellFonts,
    rows: [],
    yearRows: {},
    pageCountsById: {},
    meta: EMPTY_META,
    tabName: '',
  })

  const showAll = selectedId === ALL_TAB_ID
  const selected = useMemo(() => {
    if (selectedId === ALL_TAB_ID) return null
    return ledgers.find((item) => item.id === selectedId) ?? ledgers[0]
  }, [ledgers, selectedId])
  const displayChunks = useMemo(() => {
    const count = selected?.rows.length ?? 0
    if (!count) return [{ start: 0, end: 0 }]
    const counts = normalizePageCounts(pageCountsById[selected?.id ?? ''], count)
    return pageChunksFromCounts(counts)
  }, [pageCountsById, selected?.id, selected?.rows.length])
  const selectedPageIndex = selected
    ? selectedPage?.ledgerId === selected.id
      ? Math.min(selectedPage.index, Math.max(0, displayChunks.length - 1))
      : 0
    : selectedPage?.index ?? 0
  const editPageLedger =
    (showAll ? ledgers.find((item) => item.id === selectedPage?.ledgerId) : selected) ?? ledgers[0]
  const editPageCounts = editPageLedger
    ? normalizePageCounts(pageCountsById[editPageLedger.id], editPageLedger.rows.length)
    : [1]
  const editPageLabel = editPageLedger
    ? `${editPageLedger.tabName || editPageLedger.meta.productName || '물질'} ${
        (selectedPage?.ledgerId === editPageLedger.id ? selectedPage.index : 0) + 1
      }쪽`
    : '1쪽'
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
    cellFonts,
    rows: selected?.rows ?? [],
    yearRows: Object.fromEntries(ledgers.map((item) => [item.id, item.rows])),
    pageCountsById,
    meta: selected?.meta ?? EMPTY_META,
    tabName: selected?.tabName ?? '',
  }
  const formEditRef = useRef(formEdit)
  formEditRef.current = formEdit
  rowHeightsRef.current = rowHeights
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
      cellFonts: { ...current.cellFonts },
      rows: cloneJson(current.rows),
      yearRows: cloneJson(current.yearRows),
      pageCountsById: cloneJson(current.pageCountsById),
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
    setCellFonts(snap.cellFonts)
    setPageCountsById(snap.pageCountsById ?? {})
    if (!formEditRef.current) {
      saveChemFormLayoutAll(
        ledgersRef.current.map((item) => item.id),
        saved,
        snap.chrome,
        snap.rowHeights,
        snap.cellFonts,
      )
      for (const item of ledgersRef.current) {
        const rows = snap.yearRows[item.id] ?? (item.id === id ? snap.rows : item.rows)
        saveChemPageCounts(snap.pageCountsById[item.id] ?? [rows.length], item.id, rows.length)
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
      setSelectedCellIds([])
    }
    return () => document.body.classList.remove('chem-form-edit')
  }, [formEdit])

  useLayoutEffect(() => {
    if (showAll) {
      setSelectedPage((prev) => prev ?? (ledgersRef.current[0] ? { ledgerId: ledgersRef.current[0].id, index: 0 } : null))
      return
    }
    if (selected) {
      setSelectedPage((prev) =>
        prev?.ledgerId === selected.id ? prev : { ledgerId: selected.id, index: 0 },
      )
    }
  }, [showAll, selected?.id])

  useEffect(() => {
    const seedId = selectedId === ALL_TAB_ID ? ledgersRef.current[0]?.id ?? '' : selectedId
    clearFormHistory()
    setFormAction(null)
    setColumns(loadChemFormColumns(seedId))
    setRowHeights(loadHeaderRowHeights(seedId))
    setChrome(loadChemSheetChrome(seedId))
    setCellFonts(loadChemCellFonts(seedId))
    setSelectedCellIds([])
    setColPx({})
    setEditRowLock({})
    setFormEdit(false)
  }, [selectedId])

  useEffect(() => {
    const next: Record<string, number[]> = {}
    for (const item of ledgers) {
      next[item.id] = loadChemPageCounts(item.id, item.rows.length)
    }
    setPageCountsById(next)
  }, [yearKey, ledgers.map((item) => item.id).join('|')])

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

  useEffect(() => {
    const onBeforePrint = () => {
      document.body.classList.add('chem-printing')
    }
    const onAfterPrint = () => {
      document.body.classList.remove('chem-printing')
    }
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
      document.body.classList.remove('chem-printing')
    }
  }, [])

  useEffect(() => {
    const onMove = (event: globalThis.MouseEvent) => {
      if (colDrag.current) {
        if (colDrag.current.kind === 'meta-split') {
          const grid = colDrag.current.grid
          if (grid) {
            const rect = grid.getBoundingClientRect()
            const pct = Math.min(72, Math.max(28, ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100))
            setChrome((prev) =>
              Math.abs(prev.metaLeftPct - pct) < 0.15 ? prev : { ...prev, metaLeftPct: pct },
            )
          }
        } else {
          const width = Math.max(28, colDrag.current.startPx + (event.clientX - colDrag.current.startX))
          const id = colDrag.current.id
          setColPx((prev) => ({ ...prev, [id]: width }))
        }
      }
      if (rowDrag.current) {
        const height = Math.max(22, rowDrag.current.startH + (event.clientY - rowDrag.current.startY))
        const id = rowDrag.current.id
        setRowHeights((prev) =>
          isChemHeaderRowId(id)
            ? { ...prev, [id]: height }
            : { ...prev, [CHEM_BODY_ROW_KEY]: height },
        )
      }
    }
    const onUp = () => {
      const didResize = Boolean(colDrag.current || rowDrag.current)
      if (colDrag.current) {
        if (colDrag.current.kind !== 'meta-split') {
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
        }
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
        if (formEditRef.current) {
          window.setTimeout(() => {
            const current = layoutRef.current
            saveChemFormLayoutAll(
              ledgersRef.current.map((item) => item.id),
              current.columns,
              current.chrome,
              { ...keepHeaderHeights(current.editRowLock), ...current.rowHeights },
              current.cellFonts,
            )
          }, 0)
        }
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
      setCellFonts(loadChemCellFonts(nextId))
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

  const persistPageCounts = (next: Record<string, number[]>, rowLookup?: Record<string, number>) => {
    setPageCountsById(next)
    for (const item of ledgersRef.current) {
      const rowCount = rowLookup?.[item.id] ?? item.rows.length
      saveChemPageCounts(next[item.id] ?? [rowCount], item.id, rowCount)
    }
  }

  const insertRowAfter = (ledgerId: string, afterId: string, applyAll: boolean) => {
    const list = ledgersRef.current
    const source = list.find((item) => item.id === ledgerId)
    if (!source) return
    const index = source.rows.findIndex((row) => row.id === afterId)
    const at = index >= 0 ? index + 1 : source.rows.length
    const pageFrom = pageIndexForRow(
      normalizePageCounts(pageCountsById[ledgerId], source.rows.length),
      index >= 0 ? index : source.rows.length - 1,
    )
    pushFormHistory()
    setRowHeights(keepLayoutHeights)
    setEditRowLock(keepHeaderHeights)
    const inserted = new Map<string, ChemicalLedgerRow>()
    for (const ledger of list) {
      if (!applyAll && ledger.id !== ledgerId) continue
      inserted.set(ledger.id, createLedgerRow())
    }
    const nextCounts: Record<string, number[]> = { ...pageCountsById }
    const nextRowLens: Record<string, number> = {}
    updateYearLedgers((prev) =>
      prev.map((ledger) => {
        const row = inserted.get(ledger.id)
        if (!row) return ledger
        const rows = [...ledger.rows]
        rows.splice(Math.min(at, rows.length), 0, row)
        const counts = [...normalizePageCounts(pageCountsById[ledger.id], ledger.rows.length)]
        const page = Math.min(pageFrom, counts.length - 1)
        counts[page] += 1
        nextCounts[ledger.id] = counts
        nextRowLens[ledger.id] = rows.length
        return { ...ledger, rows }
      }),
    )
    persistPageCounts(nextCounts, nextRowLens)
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
    const pageFrom = pageIndexForRow(normalizePageCounts(pageCountsById[ledgerId], source.rows.length), index)
    const sourceCounts = normalizePageCounts(pageCountsById[ledgerId], source.rows.length)
    if (sourceCounts[pageFrom] <= 1 && sourceCounts.length > 1) return
    pushFormHistory()
    setRowHeights(keepLayoutHeights)
    setEditRowLock(keepHeaderHeights)
    const nextCounts: Record<string, number[]> = { ...pageCountsById }
    const nextRowLens: Record<string, number> = {}
    updateYearLedgers((prev) =>
      prev.map((ledger) => {
        if (!applyAll && ledger.id !== ledgerId) return ledger
        if (ledger.rows.length <= 1) return ledger
        if (applyAll && index >= ledger.rows.length) return ledger
        const counts = [...normalizePageCounts(pageCountsById[ledger.id], ledger.rows.length)]
        const page = Math.min(pageFrom, counts.length - 1)
        if (counts[page] <= 1 && counts.length > 1) return ledger
        const rows = applyAll
          ? ledger.rows.filter((_, rowIndex) => rowIndex !== index)
          : ledger.rows.filter((row) => row.id !== rowId)
        if (rows.length === ledger.rows.length) return ledger
        counts[page] = Math.max(1, counts[page] - 1)
        nextCounts[ledger.id] = counts
        nextRowLens[ledger.id] = rows.length
        return { ...ledger, rows }
      }),
    )
    persistPageCounts(nextCounts, nextRowLens)
    markDirty()
  }

  const addFormPage = () => {
    if (showAll || selectedId === ALL_TAB_ID) return
    const list = ledgersRef.current
    const targets = list.filter((item) => item.id === selectedId)
    if (targets.length === 0) return
    pushFormHistory('page-add')
    const nextCounts: Record<string, number[]> = { ...pageCountsById }
    const nextRowLens: Record<string, number> = {}
    let focus: { ledgerId: string; index: number } | null = null
    updateYearLedgers((prev) =>
      prev.map((ledger) => {
        if (!targets.some((item) => item.id === ledger.id)) return ledger
        const extra = Array.from({ length: LEDGER_ROW_COUNT }, () => createLedgerRow())
        const rows = [...ledger.rows, ...extra]
        const counts = [...normalizePageCounts(pageCountsById[ledger.id], ledger.rows.length), LEDGER_ROW_COUNT]
        nextCounts[ledger.id] = counts
        nextRowLens[ledger.id] = rows.length
        if (!focus) focus = { ledgerId: ledger.id, index: counts.length - 1 }
        return { ...ledger, rows }
      }),
    )
    persistPageCounts(nextCounts, nextRowLens)
    if (focus) setSelectedPage(focus)
    markDirty()
  }

  const deleteFormPage = (ledgerId: string, pageIndex: number) => {
    const list = ledgersRef.current
    const source = list.find((item) => item.id === ledgerId)
    if (!source) return
    const counts = normalizePageCounts(pageCountsById[ledgerId], source.rows.length)
    if (counts.length <= 1) return
    const chunk = pageChunksFromCounts(counts)[pageIndex]
    if (!chunk) return
    pushFormHistory('page-del')
    const kept = source.rows.filter((_, index) => index < chunk.start || index >= chunk.end)
    const rows = kept.length > 0 ? kept : [createLedgerRow()]
    const nextList = counts.filter((_, index) => index !== pageIndex)
    const nextCounts: Record<string, number[]> = {
      ...pageCountsById,
      [ledgerId]: normalizePageCounts(nextList, rows.length),
    }
    updateYearLedgers((prev) => prev.map((item) => (item.id === ledgerId ? { ...item, rows } : item)))
    persistPageCounts(nextCounts, { [ledgerId]: rows.length })
    const maxIndex = Math.max(0, nextCounts[ledgerId].length - 1)
    setSelectedPage({ ledgerId, index: Math.min(pageIndex, maxIndex) })
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
    if (id === CHROME_META_LEFT) {
      const grid =
        event.currentTarget.closest('.chem-meta')?.querySelector<HTMLElement>('.chem-align-grid') ?? undefined
      colDrag.current = {
        id,
        startX: event.clientX,
        startPx: chrome.metaLeftPct ?? 50,
        kind: 'meta-split',
        grid,
      }
    } else {
      colDrag.current = { id, startX: event.clientX, startPx: colPx[id] ?? 40 }
    }
    document.body.classList.add('chem-resizing', 'chem-resizing-col')
  }

  const startRowResize = (rowId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (formEditRef.current) resizeSnapRef.current = takeFormSnapshot()
    const rowEl =
      event.currentTarget.closest<HTMLElement>('[data-row-id]') ??
      tableWrapRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(rowId)}"]`) ??
      sheetRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(rowId)}"]`)
    if (isChemHeaderRowId(rowId)) {
      setRowHeights((prev) => {
        if (prev[CHEM_BODY_ROW_KEY] != null) return prev
        const bodyH = rowEl?.closest('.chem-table')?.querySelector('tbody tr')?.getBoundingClientRect().height
        if (bodyH == null) return prev
        return { ...prev, [CHEM_BODY_ROW_KEY]: bodyH }
      })
    }
    rowDrag.current = {
      id: rowId,
      startY: event.clientY,
      startH: isChemHeaderRowId(rowId)
        ? liveRowHeights[rowId] || rowEl?.getBoundingClientRect().height || 22
        : liveRowHeights[CHEM_BODY_ROW_KEY] ||
          rowEl?.getBoundingClientRect().height ||
          22,
    }
    document.body.classList.add('chem-resizing', 'chem-resizing-row')
  }

  const persistSharedLayout = (
    nextColumns = columns,
    nextChrome = chrome,
    nextHeights = rowHeights,
    nextFonts = cellFonts,
  ) => {
    saveChemFormLayoutAll(
      ledgersRef.current.map((item) => item.id),
      nextColumns,
      nextChrome,
      nextHeights,
      nextFonts,
    )
  }

  const persistColumns = (next: ChemFormColumn[], historySource?: string) => {
    pushFormHistory(historySource)
    const saved = normalizeColumns(next)
    const ids = new Set(saved.map((col) => col.id))
    const nextFonts = Object.fromEntries(
      Object.entries(cellFonts).filter(([key]) => {
        if (key.startsWith('chrome-') || key.startsWith('thead-section:')) return true
        const sep = key.lastIndexOf(':')
        if (sep < 0) return true
        return ids.has(key.slice(sep + 1))
      }),
    )
    persistSharedLayout(saved, chrome, rowHeights, nextFonts)
    setColumns(saved)
    setCellFonts(nextFonts)
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
    setChrome((prev) => {
      const next = { ...prev, ...patch }
      persistSharedLayout(columns, next, rowHeights, cellFonts)
      return next
    })
  }

  const bumpCellFont = (delta: number) => {
    if (selectedCellIds.length === 0) return
    const ids = [...selectedCellIds]
    const reference = ids[ids.length - 1]
    const current = resolveChemCellFont(cellFonts, reference) ?? defaultChemCellFont(reference)
    const mixed = ids.some((id) => (resolveChemCellFont(cellFonts, id) ?? defaultChemCellFont(id)) !== current)
    const size = clampChemCellFont(mixed ? current : current + delta)
    pushFormHistory(`font:${[...ids].sort().join(',')}`)
    setCellFonts((prev) => {
      const next = { ...prev }
      const bodyCols = new Set<string>()
      for (const id of ids) {
        const body = parseChemBodyCell(id)
        if (body) bodyCols.add(body.colId)
        else next[id] = size
      }
      for (const colId of bodyCols) {
        next[`tbody:${colId}`] = size
        for (const key of Object.keys(next)) {
          const parsed = parseChemBodyCell(key)
          if (parsed?.colId === colId) delete next[key]
        }
      }
      persistSharedLayout(columns, chrome, rowHeights, next)
      return next
    })
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
    saveChemFormLayoutAll(
      ledgersRef.current.map((item) => item.id),
      columns,
      chrome,
      { ...keepHeaderHeights(editRowLock), ...rowHeights },
      cellFonts,
    )
    for (const item of ledgersRef.current) {
      saveChemPageCounts(pageCountsById[item.id] ?? [item.rows.length], item.id, item.rows.length)
    }
    setEditRowLock({})
    setFormEdit(false)
    clearFormHistory()
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
    window.setTimeout(() => window.print(), 50)
  }

  const confirmReset = () => {
    if (!selected) {
      setPendingReset(false)
      return
    }
    pushFormHistory()
    const count = Math.max(LEDGER_ROW_COUNT, selected.rows.length)
    updateLedger(selected.id, {
      rows: Array.from({ length: count }, () => createLedgerRow()),
    })
    setPendingReset(false)
  }

  const saveRef = useRef(save)
  saveRef.current = save
  const commitFormLayoutRef = useRef(commitFormLayout)
  commitFormLayoutRef.current = commitFormLayout

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        if (formEditRef.current) commitFormLayoutRef.current()
        else saveRef.current()
        return
      }
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undoForm()
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
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
              saveChemFormColumns(columns, next.id)
              saveChemSheetChrome(chrome, next.id)
              saveHeaderRowHeights(rowHeights, next.id)
              saveChemCellFonts(cellFonts, next.id)
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
                    canFont={selectedCellIds.length > 0}
                    selectedFont={
                      selectedCellIds.length > 0
                        ? resolveChemCellFont(cellFonts, selectedCellIds[selectedCellIds.length - 1]) ??
                          defaultChemCellFont(selectedCellIds[selectedCellIds.length - 1])
                        : null
                    }
                    onFont={bumpCellFont}
                    onAddPage={showAll ? undefined : addFormPage}
                    showPages={!showAll}
                    pageCount={editPageCounts.length}
                    selectedPageIndex={
                      selectedPage?.ledgerId === editPageLedger?.id ? selectedPage.index : 0
                    }
                    onSelectPage={(index) => {
                      if (!editPageLedger) return
                      setSelectedPage({ ledgerId: editPageLedger.id, index })
                    }}
                    selectedPageLabel={editPageLabel}
                  />
                  <div className="chem-sheet-tool-btns">
                    <ComposeModeButton active={compose} onToggle={toggleCompose} />
                    <button
                      className="chem-doc-btn chem-doc-icon"
                      type="button"
                      aria-label="이전"
                      disabled={!canUndo}
                      onClick={undoForm}
                    >
                      <Undo2 size={16} />
                    </button>
                    <button
                      className="chem-doc-btn chem-doc-icon"
                      type="button"
                      aria-label="다음"
                      disabled={!canRedo}
                      onClick={redoForm}
                    >
                      <Redo2 size={16} />
                    </button>
                    <button
                      className={`chem-doc-btn${canUndo ? ' chem-doc-commit' : ''}`}
                      type="button"
                      onClick={commitFormLayout}
                    >
                      <TableProperties size={14} />
                      양식 수정 완료
                    </button>
                  </div>
                </>
              ) : (
                <div className="chem-sheet-tool-btns">
                  <ComposeModeButton active={compose} onToggle={toggleCompose} />
                  <button
                    className="chem-doc-btn"
                    type="button"
                    onClick={() => {
                      snapshotFormLayout()
                      setFormAction(null)
                      clearFormHistory()
                      setFormEdit(true)
                    }}
                  >
                    <TableProperties size={14} />
                    양식 수정
                  </button>
                  {showAll ? null : (
                    <>
                      <span className="insp-tool-split" aria-hidden="true" />
                      <button
                        className="chem-doc-btn chem-doc-icon"
                        type="button"
                        aria-label="이전"
                        disabled={!canUndo}
                        onClick={undoForm}
                      >
                        <Undo2 size={16} />
                      </button>
                      <button
                        className="chem-doc-btn chem-doc-icon"
                        type="button"
                        aria-label="다음"
                        disabled={!canRedo}
                        onClick={redoForm}
                      >
                        <Redo2 size={16} />
                      </button>
                      <button
                        className="chem-doc-btn insp-reset-btn"
                        type="button"
                        onClick={() => setPendingReset(true)}
                      >
                        <RotateCcw size={14} />
                        전체 초기화
                      </button>
                    </>
                  )}
                  <span className="insp-tool-split" aria-hidden="true" />
                  <button
                    className={`chem-doc-btn chem-doc-save ${dirty ? 'is-dirty' : ''}`}
                    type="button"
                    onClick={save}
                  >
                    <img src={diskette} alt="" />
                    {dirty ? '저장' : saved ? '저장됨' : '저장'}
                  </button>
                  <button className="chem-doc-btn insp-print-btn" type="button" onClick={printPage}>
                    <Printer size={14} />
                    인쇄
                  </button>
                </div>
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
            cellFonts={cellFonts}
            selectedCellIds={selectedCellIds}
            onSelectCells={setSelectedCellIds}
            pageCountsById={pageCountsById}
            selectedPage={selectedPage}
            onSelectPage={setSelectedPage}
          />
        ) : selected ? (
        <div className={displayChunks.length > 1 ? 'chem-page-stack' : 'chem-page-view'}>
          {displayChunks.map((chunk, index) => {
            const paged = displayChunks.length > 1
            const pageCaption = selected.tabName || selected.meta.productName || '새 물질'
            const pageOn = formEdit && paged && selectedPageIndex === index
            return (
            <div
              key={`${selected.id}-p${index}`}
              className={`chem-paper${paged ? ' chem-stack-paper' : ''}${pageOn ? ' is-page-on' : ''}`}
              onMouseDown={() => {
                if (formEdit) setSelectedPage({ ledgerId: selected.id, index })
              }}
            >
              {pageOn && paged ? (
                <ChemPageDeleteButton onDelete={() => deleteFormPage(selected.id, index)} />
              ) : null}
              {paged ? (
                <div className="chem-page-guides no-print" aria-hidden="true">
                  <div className="chem-page-guide is-first">
                    <span>{`${pageCaption} ${index + 1}/${displayChunks.length}`}</span>
                  </div>
                </div>
              ) : null}
              <ChemLedgerSheet
                ledger={{ ...selected, rows: selected.rows.slice(chunk.start, chunk.end) }}
                year={selectedYear}
                formEdit={formEdit}
                formAction={pageOn || displayChunks.length === 1 ? formAction : null}
                columns={columns}
                chrome={chrome}
                rowHeights={liveRowHeights}
                fillRowHeight={null}
                colPx={colPx}
                flashColId={flashColId}
                flashRowId={flashRowId}
                cellFonts={cellFonts}
                selectedCellIds={pageOn || displayChunks.length === 1 ? selectedCellIds : []}
                onSelectCells={setSelectedCellIds}
                showPageGuides={false}
                extraGuides={0}
                pageStart={index + 1}
                pageTotal={displayChunks.length}
                pageLabel={pageCaption}
                sheetRef={index === 0 ? sheetRef : undefined}
                tableWrapRef={index === 0 ? tableWrapRef : undefined}
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
            )
          })}
        </div>
        ) : null}
        </>
      )}
      {pendingReset ? (
        <div className="modal-backdrop confirm-backdrop no-print" onClick={() => setPendingReset(false)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chem-reset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="chem-reset-title">초기화하시겠습니까?</p>
            <div className="confirm-modal-actions">
              <button className="secondary-btn" type="button" onClick={() => setPendingReset(false)}>
                아니오
              </button>
              <button className="primary-btn" type="button" onClick={confirmReset}>
                예
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
