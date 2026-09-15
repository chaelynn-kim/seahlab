import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, ClipboardCheck, Pencil, Plus, Printer, Redo2, RotateCcw, TableProperties, Undo2, X } from 'lucide-react'
import { InspectionAllView, InspectionSheet } from '../components/InspectionSheet'
import { ChemFormEditBar, type ChemFormAction } from '../components/ChemLedgerTable'
import { ComposeModeButton } from '../components/ComposeModeButton'
import { InspTipButton } from '../components/InspTipButton'
import { PageHead } from '../components/layout/PageHead'
import diskette from '../assets/diskette.png'
import { useAppData } from '../context/AppDataContext'
import { createCheckItem, createEquipment, markEquipmentRemoved, withItemIds } from '../lib/catalog'
import {
  clampInspCellFont,
  defaultInspCellFont,
  DEFAULT_INSP_COL_PCT,
  INSP_ALL_TAB_ID,
  loadInspFormLayout,
  loadInspSheetChrome,
  saveInspFormLayoutAll,
  saveInspSheetChrome,
  type InspColId,
  type InspFormLayout,
  type InspSheetChrome,
} from '../lib/inspSheet'
import {
  addMonths,
  datesInMonthRange,
  daysInMonth,
  formatSelectedDaysLabel,
  pad2,
  todayKey,
} from '../lib/date'
import {
  blankResults,
  findInspection,
  hasIssueMark,
  inspectionStatus,
  inspectionsContentEqual,
  isBlankDay,
  isOffReading,
  itemKey,
  latestInspectorName,
  nextMark,
  upsertInspection,
} from '../lib/inspections'
import {
  joinFraction,
  parseFractionParts,
  resolveInputKind,
  sanitizeFractionDigit,
  sanitizeNumberInput,
} from '../lib/inputKind'
import { loadInspectorsByEquipment, saveInspectorForEquipment, toInspector } from '../lib/actor'
import { useComposeMode } from '../lib/composeMode'
import type { CheckItem, CheckResult, Equipment, InspectionRecord } from '../types'

function cloneCatalog(list: Equipment[]): Equipment[] {
  return withItemIds(JSON.parse(JSON.stringify(list)) as Equipment[])
}

function cloneInspections(list: InspectionRecord[]): InspectionRecord[] {
  return JSON.parse(JSON.stringify(list)) as InspectionRecord[]
}

interface InspFormSnapshot {
  layout: InspFormLayout
  chrome: InspSheetChrome
  catalog: Equipment[]
}

export function InspectionPage() {
  const { equipmentList, inspectors, inspections, saveCatalog, saveInspectionsAll } = useAppData()
  const today = todayKey()
  const now = new Date()
  const [draftInspections, setDraftInspections] = useState<InspectionRecord[]>(() => cloneInspections(inspections))
  const [recordsDirty, setRecordsDirty] = useState(false)
  const draftRef = useRef(draftInspections)
  draftRef.current = draftInspections
  const savedInspectionsRef = useRef(inspections)
  savedInspectionsRef.current = inspections

  const [catalog, setCatalog] = useState<Equipment[]>(() => cloneCatalog(equipmentList))
  const [catalogDirty, setCatalogDirty] = useState(false)
  const [chrome, setChrome] = useState<InspSheetChrome>(() => loadInspSheetChrome())
  const [chromeDirty, setChromeDirty] = useState(false)
  const [equipmentId, setEquipmentId] = useState(equipmentList[0]?.id ?? '')
  const [layout, setLayout] = useState<InspFormLayout>(() => loadInspFormLayout(equipmentList[0]?.id ?? ''))
  const [layoutDirty, setLayoutDirty] = useState(false)
  const colDrag = useRef<{ id: InspColId; startX: number; startPct: number; tableW: number } | null>(null)
  const rowDrag = useRef<{ id: string; startY: number; startH: number } | null>(null)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDates, setSelectedDates] = useState<string[]>([today])
  const [selectedDate, setSelectedDate] = useState(today)
  const selectAnchorRef = useRef(today)
  const selectedDatesRef = useRef(selectedDates)
  selectedDatesRef.current = selectedDates
  const dayDragRef = useRef<{ start: string; additive: boolean; base: string[] } | null>(null)
  const [inspectorByEquipment, setInspectorByEquipment] = useState<Record<string, string>>(() =>
    loadInspectorsByEquipment(inspectors),
  )
  const [needInspectorId, setNeedInspectorId] = useState<string | null>(null)
  const [inspectorAlert, setInspectorAlert] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [issueNote, setIssueNote] = useState('')
  const [requestDate, setRequestDate] = useState('')
  const [confirmDate, setConfirmDate] = useState('')
  const [tabEditMode, setTabEditMode] = useState(false)
  const [formEdit, setFormEdit] = useState(false)
  const [formAction, setFormAction] = useState<ChemFormAction>(null)
  const [selectedCellIds, setSelectedCellIds] = useState<string[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [printing, setPrinting] = useState(false)
  const { compose, toggleCompose } = useComposeMode()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingMonthReset, setPendingMonthReset] = useState(false)
  const dragTabId = useRef<string | null>(null)
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const dragItemId = useRef<string | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const formEditRef = useRef(formEdit)
  formEditRef.current = formEdit
  const historyRef = useRef<{ past: InspFormSnapshot[]; future: InspFormSnapshot[] }>({ past: [], future: [] })
  const lastHistorySourceRef = useRef<string | null>(null)
  const applyingHistoryRef = useRef(false)
  const resizeSnapRef = useRef<InspFormSnapshot | null>(null)
  const formSnapRef = useRef<InspFormSnapshot>({
    layout,
    chrome,
    catalog,
  })
  formSnapRef.current = { layout, chrome, catalog }

  const showAll = equipmentId === INSP_ALL_TAB_ID
  const equipment = useMemo(
    () => (showAll ? undefined : catalog.find((item) => item.id === equipmentId) ?? catalog[0]),
    [catalog, equipmentId, showAll],
  )

  useEffect(() => {
    if (!catalogDirty) {
      setCatalog(cloneCatalog(equipmentList))
      return
    }
    setCatalog((prev) => {
      const have = new Set(prev.map((item) => item.id))
      const missing = equipmentList.filter((item) => !have.has(item.id))
      return missing.length ? [...prev, ...cloneCatalog(missing)] : prev
    })
  }, [equipmentList, catalogDirty])

  useEffect(() => {
    if (equipmentId === INSP_ALL_TAB_ID) return
    if (!catalog.some((item) => item.id === equipmentId) && catalog[0]) {
      setEquipmentId(catalog[0].id)
    }
  }, [equipmentId, catalog])

  useEffect(() => {
    const seedId = equipmentId === INSP_ALL_TAB_ID ? catalog[0]?.id ?? '' : equipmentId
    setLayout(loadInspFormLayout(seedId))
    setLayoutDirty(false)
    setFormEdit(false)
    setFormAction(null)
    setSelectedCellIds([])
    historyRef.current = { past: [], future: [] }
    lastHistorySourceRef.current = null
    resizeSnapRef.current = null
    setCanUndo(false)
    setCanRedo(false)
  }, [equipmentId])

  useEffect(() => {
    document.body.classList.toggle('chem-form-edit', formEdit)
    if (!formEdit) {
      setFormAction(null)
      setSelectedCellIds([])
    }
    return () => document.body.classList.remove('chem-form-edit')
  }, [formEdit])

  useEffect(() => {
    const onMove = (event: globalThis.MouseEvent) => {
      if (colDrag.current) {
        const { id, startX, startPct, tableW } = colDrag.current
        const next = Math.max(1.4, startPct + ((event.clientX - startX) / tableW) * 100)
        setLayout((prev) => ({ ...prev, colPct: { ...prev.colPct, [id]: next } }))
        setLayoutDirty(true)
      }
      if (rowDrag.current) {
        const height = Math.max(18, rowDrag.current.startH + (event.clientY - rowDrag.current.startY))
        const rowId = rowDrag.current.id
        setLayout((prev) => ({ ...prev, rowHeights: { ...prev.rowHeights, [rowId]: height } }))
        setLayoutDirty(true)
      }
    }
    const onUp = () => {
      const didResize = Boolean(colDrag.current || rowDrag.current)
      colDrag.current = null
      rowDrag.current = null
      document.body.classList.remove('chem-resizing', 'chem-resizing-col', 'chem-resizing-row')
      if (didResize && resizeSnapRef.current) {
        historyRef.current.past.push(resizeSnapRef.current)
        if (historyRef.current.past.length > 80) historyRef.current.past.shift()
        historyRef.current.future = []
        lastHistorySourceRef.current = null
        setCanUndo(true)
        setCanRedo(false)
      }
      resizeSnapRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.classList.remove('chem-resizing', 'chem-resizing-col', 'chem-resizing-row')
    }
  }, [])

  useEffect(() => {
    const start = () => {
      document.body.classList.add('insp-printing')
      setPrinting(true)
    }
    const end = () => {
      document.body.classList.remove('insp-printing')
      setPrinting(false)
    }
    window.addEventListener('beforeprint', start)
    window.addEventListener('afterprint', end)
    return () => {
      window.removeEventListener('beforeprint', start)
      window.removeEventListener('afterprint', end)
      end()
    }
  }, [])

  useEffect(() => {
    if (recordsDirty) return
    const next = cloneInspections(inspections)
    draftRef.current = next
    setDraftInspections(next)
  }, [inspections, recordsDirty])

  const monthPrefix = `${year}-${pad2(month)}`
  const dayCount = daysInMonth(year, month)
  const days = useMemo(() => Array.from({ length: dayCount }, (_, index) => index + 1), [dayCount])

  const recordsByDate = useMemo(() => {
    const map = new Map<string, InspectionRecord>()
    if (!equipment) return map
    for (const record of draftInspections) {
      if (record.equipmentId !== equipment.id || !record.date.startsWith(monthPrefix)) continue
      map.set(record.date, record)
    }
    return map
  }, [equipment, draftInspections, monthPrefix])

  useEffect(() => {
    setInspectorByEquipment((prev) => {
      const next = { ...prev }
      let changed = false
      for (const eq of catalog) {
        const monthRows = draftInspections.filter(
          (record) => record.equipmentId === eq.id && record.date.startsWith(monthPrefix),
        )
        const fromRecord = latestInspectorName(monthRows)
        if (!fromRecord || next[eq.id] === fromRecord) continue
        next[eq.id] = fromRecord
        changed = true
      }
      return changed ? next : prev
    })
  }, [catalog, draftInspections, monthPrefix])

  useEffect(() => {
    const record = equipment
      ? findInspection(draftInspections, equipment.id, selectedDate)
      : undefined
    setIssueNote(record?.issueNote ?? '')
    setRequestDate(record?.requestDate ?? '')
    setConfirmDate(record?.confirmDate ?? '')
  }, [equipment, selectedDate, draftInspections])

  const dayActionLabel = formatSelectedDaysLabel(selectedDates, today)

  const replaceSelection = (dates: string[], primary?: string, keepAnchor = false) => {
    const unique = [...new Set(dates)].sort()
    const next = unique.length ? unique : [primary ?? selectedDate]
    setSelectedDates(next)
    const focus = primary && next.includes(primary) ? primary : next[next.length - 1]
    if (focus) {
      setSelectedDate(focus)
      if (primary && !keepAnchor) selectAnchorRef.current = primary
    }
  }

  const selectSingleDate = (date: string) => {
    replaceSelection([date], date)
  }

  const startDaySelect = (date: string, event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || formEdit) return
    event.preventDefault()
    const additive = event.ctrlKey || event.metaKey
    if (event.shiftKey) {
      const anchor = selectAnchorRef.current
      replaceSelection(datesInMonthRange(monthPrefix, anchor, date, dayCount), date, true)
      dayDragRef.current = { start: anchor, additive: false, base: [] }
    } else if (additive) {
      const prev = selectedDatesRef.current
      const next = prev.includes(date)
        ? prev.length > 1
          ? prev.filter((item) => item !== date)
          : prev
        : [...prev, date]
      replaceSelection(next, date)
      dayDragRef.current = { start: date, additive: true, base: next }
    } else {
      replaceSelection([date], date)
      dayDragRef.current = { start: date, additive: false, base: [] }
    }
    document.body.classList.add('insp-day-selecting')
  }

  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      const drag = dayDragRef.current
      if (!drag) return
      const target = document.elementFromPoint(event.clientX, event.clientY)
      const host = target instanceof Element ? target.closest('[data-insp-day]') : null
      const day = Number(host?.getAttribute('data-insp-day'))
      if (!Number.isFinite(day) || day < 1) return
      const date = `${monthPrefix}-${pad2(day)}`
      const range = datesInMonthRange(monthPrefix, drag.start, date, dayCount)
      if (drag.additive) replaceSelection([...drag.base, ...range], date, true)
      else replaceSelection(range, date, true)
    }
    const onUp = () => {
      if (!dayDragRef.current) return
      dayDragRef.current = null
      document.body.classList.remove('insp-day-selecting')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.classList.remove('insp-day-selecting')
    }
  }, [dayCount, monthPrefix])

  const selectMonth = (nextYear: number, nextMonth: number) => {
    setYear(nextYear)
    setMonth(nextMonth)
    const prefix = `${nextYear}-${pad2(nextMonth)}`
    const kept = selectedDates.filter((date) => date.startsWith(prefix))
    if (kept.length) {
      setSelectedDates(kept)
      if (!kept.includes(selectedDate)) {
        const focus = kept[kept.length - 1]
        setSelectedDate(focus)
        selectAnchorRef.current = focus
      }
      return
    }
    const inThisMonth = today.startsWith(prefix) ? today : `${prefix}-01`
    replaceSelection([inThisMonth], inThisMonth)
  }

  const commitDraft = (next: InspectionRecord[]) => {
    draftRef.current = next
    setDraftInspections(next)
    const dirty = !inspectionsContentEqual(next, savedInspectionsRef.current)
    setRecordsDirty(dirty)
    if (dirty) setSavedFlash(false)
  }

  const assignInspector = (eqId: string, name: string) => {
    setInspectorByEquipment((prev) => ({ ...prev, [eqId]: name }))
    saveInspectorForEquipment(eqId, name)
    setNeedInspectorId((current) => (current === eqId ? null : current))
    setInspectorAlert(false)
    let next = draftRef.current
    let changed = false
    for (const record of next) {
      if (record.equipmentId !== eqId || !record.date.startsWith(monthPrefix)) continue
      if (record.inspector.name === name) continue
      const result = upsertInspection(next, {
        id: record.id,
        equipmentId: record.equipmentId,
        date: record.date,
        inspector: toInspector(name),
        results: record.results,
        readings: record.readings,
        issueNote: record.issueNote,
        requestDate: record.requestDate,
        confirmDate: record.confirmDate,
      })
      next = result.records
      changed = true
    }
    if (changed) commitDraft(next)
  }

  const persistDay = (
    date: string,
    patch: {
      results?: Record<string, CheckResult>
      readings?: Record<string, string>
      issueNote?: string
      requestDate?: string
      confirmDate?: string
    },
    target?: Equipment,
  ): boolean => {
    const eq = target ?? equipment
    if (!eq) return false
    const inspectorName =
      inspectorByEquipment[eq.id]?.trim() ||
      latestInspectorName(
        draftRef.current.filter(
          (record) => record.equipmentId === eq.id && record.date.startsWith(monthPrefix),
        ),
      )
    if (!inspectorName) {
      setNeedInspectorId(eq.id)
      setInspectorAlert(true)
      return false
    }
    setNeedInspectorId((current) => (current === eq.id ? null : current))
    const existing = findInspection(draftRef.current, eq.id, date)
    const sameDay = date === selectedDate && eq.id === equipment?.id
    const next = {
      results: patch.results ?? existing?.results ?? blankResults(eq.items.map((item) => item.no)),
      readings: patch.readings ?? existing?.readings ?? {},
      issueNote: patch.issueNote ?? (sameDay ? issueNote : existing?.issueNote ?? ''),
      requestDate: patch.requestDate ?? (sameDay ? requestDate : existing?.requestDate ?? ''),
      confirmDate: patch.confirmDate ?? (sameDay ? confirmDate : existing?.confirmDate ?? ''),
    }
    if (!hasIssueMark(next.results)) {
      next.issueNote = ''
      next.requestDate = ''
      next.confirmDate = ''
      if (sameDay) {
        setIssueNote('')
        setRequestDate('')
        setConfirmDate('')
      }
    }
    if (isBlankDay(next)) {
      if (existing) {
        commitDraft(draftRef.current.filter((item) => item.id !== existing.id))
      }
      return true
    }
    saveInspectorForEquipment(eq.id, inspectorName)
    const result = upsertInspection(draftRef.current, {
      id: existing?.id,
      equipmentId: eq.id,
      date,
      inspector: toInspector(inspectorName),
      ...next,
    })
    commitDraft(result.records)
    return true
  }

  const toggleCell = (eq: Equipment, day: number, itemNo: number) => {
    const date = `${monthPrefix}-${pad2(day)}`
    selectSingleDate(date)
    const existing = findInspection(draftRef.current, eq.id, date)
    const key = itemKey(itemNo)
    const results = {
      ...(existing?.results ?? blankResults(eq.items.map((item) => item.no))),
      [key]: nextMark(existing?.results[key] ?? ''),
    }
    persistDay(date, { results }, eq)
  }

  const saveReading = (eq: Equipment, day: number, item: CheckItem, value: string) => {
    const date = `${monthPrefix}-${pad2(day)}`
    selectSingleDate(date)
    const existing = findInspection(draftRef.current, eq.id, date)
    const key = itemKey(item.no)
    const kind = resolveInputKind(item)
    const nextValue = value.includes('휴')
      ? '휴'
      : kind === 'number'
        ? sanitizeNumberInput(value)
        : value
    persistDay(
      date,
      {
        readings: { ...(existing?.readings ?? {}), [key]: nextValue },
      },
      eq,
    )
  }

  const saveFraction = (eq: Equipment, day: number, item: CheckItem, reading: string, part: 'num' | 'den', value: string) => {
    const current = parseFractionParts(reading)
    const nextNum = part === 'num' ? sanitizeFractionDigit(value) : current.num.slice(0, 1)
    const nextDen = part === 'den' ? sanitizeFractionDigit(value) : current.den.slice(0, 1)
    saveReading(eq, day, item, joinFraction(nextNum, nextDen))
  }

  const applyDayMark = (date: string, mark: 'O' | 'X' | '휴', target?: Equipment) => {
    const eq = target ?? equipment
    if (!eq) return false
    const existing = findInspection(draftRef.current, eq.id, date)
    const results = {
      ...(existing?.results ?? blankResults(eq.items.map((item) => item.no))),
    }
    const readings = { ...(existing?.readings ?? {}) }
    for (const item of eq.items) {
      const key = itemKey(item.no)
      const kind = resolveInputKind(item)
      if (kind === 'mark') {
        results[key] = mark
        continue
      }
      if (mark === '휴') readings[key] = '휴'
      else if (isOffReading(readings[key])) readings[key] = ''
    }
    return persistDay(date, { results, readings }, eq)
  }

  const markSelectedDays = (mark: 'O' | 'X' | '휴') => {
    for (const date of selectedDates) {
      if (!applyDayMark(date, mark)) break
    }
  }

  const requestMonthReset = () => {
    if (!equipment) return
    setPendingMonthReset(true)
  }

  const confirmMonthReset = () => {
    if (!equipment) {
      setPendingMonthReset(false)
      return
    }
    const eqId = equipment.id
    const prefix = monthPrefix
    commitDraft(
      draftRef.current.filter(
        (item) => item.equipmentId !== eqId || !item.date.startsWith(prefix),
      ),
    )
    setIssueNote('')
    setRequestDate('')
    setConfirmDate('')
    setPendingMonthReset(false)
  }

  const markCatalogDirty = () => {
    setCatalogDirty(true)
    setSavedFlash(false)
  }

  const takeFormSnapshot = (): InspFormSnapshot => ({
    layout: JSON.parse(JSON.stringify(formSnapRef.current.layout)) as InspFormLayout,
    chrome: { ...formSnapRef.current.chrome },
    catalog: cloneCatalog(formSnapRef.current.catalog),
  })

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
    if (!formEditRef.current || applyingHistoryRef.current) return
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

  const applyFormSnapshot = (snap: InspFormSnapshot) => {
    applyingHistoryRef.current = true
    setLayout(snap.layout)
    setChrome(snap.chrome)
    setCatalog(cloneCatalog(snap.catalog))
    setLayoutDirty(true)
    setChromeDirty(true)
    setCatalogDirty(true)
    setSavedFlash(false)
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

  const updateCatalog = (updater: (list: Equipment[]) => Equipment[], source?: string) => {
    pushFormHistory(source)
    setCatalog((prev) => updater(prev))
    markCatalogDirty()
  }

  const updateEquipment = (id: string, patch: Partial<Equipment>, source?: string) => {
    updateCatalog((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)), source)
  }

  const updateItem = (itemId: string, patch: Partial<CheckItem>) => {
    if (!equipment) return
    updateEquipment(
      equipment.id,
      {
        items: equipment.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      },
      `item:${itemId}:${Object.keys(patch).join(',')}`,
    )
  }

  const renumberItems = (items: CheckItem[]): CheckItem[] =>
    items.map((item, index) => ({ ...item, no: index + 1 }))

  const insertItemAfter = (targetEqId: string, afterItemId: string) => {
    updateCatalog((list) => {
      const source = list.find((eq) => eq.id === targetEqId)
      const idx = source?.items.findIndex((item) => (item.id ?? '') === afterItemId) ?? -1
      if (idx < 0) return list
      const targets = new Set(showAll ? list.map((eq) => eq.id) : [targetEqId])
      return list.map((eq) => {
        if (!targets.has(eq.id) || eq.items.length === 0) return eq
        const at = Math.min(idx, eq.items.length - 1)
        const next = [...eq.items]
        next.splice(at + 1, 0, createCheckItem(next))
        return { ...eq, items: renumberItems(next) }
      })
    })
  }

  const deleteItemAt = (targetEqId: string, itemId: string) => {
    updateCatalog((list) => {
      const source = list.find((eq) => eq.id === targetEqId)
      const idx = source?.items.findIndex((item) => (item.id ?? '') === itemId) ?? -1
      if (idx < 0) return list
      const targets = new Set(showAll ? list.map((eq) => eq.id) : [targetEqId])
      return list.map((eq) => {
        if (!targets.has(eq.id) || eq.items.length <= 1) return eq
        const at = Math.min(idx, eq.items.length - 1)
        const next = eq.items.filter((_, index) => index !== at)
        return { ...eq, items: renumberItems(next) }
      })
    })
  }

  const bumpCellFont = (delta: number) => {
    if (selectedCellIds.length === 0) return
    const ids = [...selectedCellIds]
    const reference = ids[ids.length - 1]
    const fonts = layout.cellFonts ?? {}
    const current = fonts[reference] ?? defaultInspCellFont(reference)
    const mixed = ids.some((id) => (fonts[id] ?? defaultInspCellFont(id)) !== current)
    const size = clampInspCellFont(mixed ? current : current + delta)
    pushFormHistory(`font:${[...ids].sort().join(',')}`)
    setLayout((prev) => {
      const nextFonts = { ...(prev.cellFonts ?? {}) }
      for (const id of ids) nextFonts[id] = size
      return { ...prev, cellFonts: nextFonts }
    })
    setLayoutDirty(true)
  }

  const reorderEquipment = (fromId: string, toId: string) => {
    if (fromId === toId) return
    updateCatalog((prev) => {
      const from = prev.findIndex((item) => item.id === fromId)
      const to = prev.findIndex((item) => item.id === toId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const reorderItems = (fromId: string, toId: string) => {
    if (!equipment || fromId === toId) return
    const from = equipment.items.findIndex((item) => item.id === fromId)
    const to = equipment.items.findIndex((item) => item.id === toId)
    if (from < 0 || to < 0) return
    const items = [...equipment.items]
    const [moved] = items.splice(from, 1)
    items.splice(to, 0, moved)
    updateEquipment(equipment.id, { items })
  }

  const confirmDelete = () => {
    if (!pendingDeleteId) return
    const deletedId = pendingDeleteId
    markEquipmentRemoved(deletedId)
    updateCatalog((prev) => {
      const next = prev.filter((item) => item.id !== deletedId)
      setEquipmentId((current) => (current === deletedId ? next[0]?.id ?? '' : current))
      return next
    })
    setPendingDeleteId(null)
  }

  const flashSaved = () => {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1400)
  }

  const persistCatalog = () => {
    if (catalogDirty) saveCatalog(catalog, inspectors)
    if (chromeDirty) saveInspSheetChrome(chrome)
    if (layoutDirty) {
      saveInspFormLayoutAll(catalog.map((item) => item.id), layout)
    }
    setCatalogDirty(false)
    setChromeDirty(false)
    setLayoutDirty(false)
  }

  const updateChrome = (patch: Partial<InspSheetChrome>) => {
    pushFormHistory(`chrome:${Object.keys(patch).join(',')}`)
    setChrome((prev) => ({ ...prev, ...patch }))
    setChromeDirty(true)
    setSavedFlash(false)
  }

  const hasUnsaved = catalogDirty || chromeDirty || layoutDirty || recordsDirty

  const saveAll = () => {
    persistCatalog()
    if (recordsDirty) saveInspectionsAll(draftRef.current)
    setRecordsDirty(false)
    flashSaved()
  }

  const commitFormEdit = () => {
    persistCatalog()
    setFormEdit(false)
    clearFormHistory()
    flashSaved()
  }

  const printPage = () => {
    document.body.classList.add('insp-printing')
    setPrinting(true)
    window.setTimeout(() => window.print(), 50)
  }

  const saveAllRef = useRef(saveAll)
  saveAllRef.current = saveAll
  const commitFormEditRef = useRef(commitFormEdit)
  commitFormEditRef.current = commitFormEdit

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        if (formEditRef.current) commitFormEditRef.current()
        else saveAllRef.current()
        return
      }
      if (!formEditRef.current) return
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

  const toggleDayOk = (eq: Equipment, day: number) => {
    const date = `${monthPrefix}-${pad2(day)}`
    selectSingleDate(date)
    const record = findInspection(draftRef.current, eq.id, date)
    if (inspectionStatus(record) === 'issue') return
    applyDayMark(date, 'O', eq)
  }

  const startColResize = (id: InspColId, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (formEditRef.current) resizeSnapRef.current = takeFormSnapshot()
    const table =
      event.currentTarget.closest('table.insp-sheet') ??
      document.querySelector<HTMLTableElement>('.insp-page .insp-sheet')
    colDrag.current = {
      id,
      startX: event.clientX,
      startPct: layout.colPct[id] ?? DEFAULT_INSP_COL_PCT[id],
      tableW: table?.getBoundingClientRect().width || 1,
    }
    document.body.classList.add('chem-resizing', 'chem-resizing-col')
  }

  const startRowResize = (rowId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (formEditRef.current) resizeSnapRef.current = takeFormSnapshot()
    const table = event.currentTarget.closest('table.insp-sheet')
    const rowEl =
      table?.querySelector(`tr[data-row-id="${CSS.escape(rowId)}"]`) ??
      document.querySelector(`tr[data-row-id="${CSS.escape(rowId)}"]`)
    rowDrag.current = {
      id: rowId,
      startY: event.clientY,
      startH: layout.rowHeights[rowId] || rowEl?.getBoundingClientRect().height || 28,
    }
    document.body.classList.add('chem-resizing', 'chem-resizing-row')
  }

  return (
    <section className={`insp-page${compose ? ' is-compose' : ''}`}>
      <PageHead
        className="no-print"
        icon={ClipboardCheck}
        title="설비 일상 점검"
        description="월별 설비 일상점검 현황을 기록·관리합니다."
      />

      <div className="chem-toolbar no-print">
        <div className="date-bar chem-year-bar insp-month-bar">
          <div className="insp-month-shift">
            <button
              className="insp-month-nav"
              type="button"
              aria-label="이전 달"
              onClick={() => {
                const next = addMonths(year, month, -1)
                selectMonth(next.year, next.month)
              }}
            >
              <ChevronLeft size={14} strokeWidth={2.4} />
              이전
            </button>
            <input
              className="select"
              type="month"
              value={monthPrefix}
              aria-label="조회 월"
              onChange={(event) => {
                const [nextYear, nextMonth] = event.target.value.split('-').map(Number)
                if (!nextYear || !nextMonth) return
                selectMonth(nextYear, nextMonth)
              }}
            />
            <button
              className="insp-month-nav"
              type="button"
              aria-label="다음 달"
              onClick={() => {
                const next = addMonths(year, month, 1)
                selectMonth(next.year, next.month)
              }}
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
                  setEquipmentId(INSP_ALL_TAB_ID)
                  setFormEdit(false)
                  setTabEditMode(false)
                }}
              >
                전체
              </button>
            </div>
            {catalog.map((item) => (
              <div
                key={item.id}
                className={`chip ${item.id === equipment?.id ? 'active' : ''} ${draggingTabId === item.id ? 'is-dragging' : ''}`}
                draggable={tabEditMode}
                onClick={() => setEquipmentId(item.id)}
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
                  if (fromId) reorderEquipment(fromId, item.id)
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
                  onClick={() => setEquipmentId(item.id)}
                  onFocus={() => setEquipmentId(item.id)}
                >
                  {item.shortName || item.name}
                </button>
                {tabEditMode ? (
                  <button
                    className="chip-x"
                    type="button"
                    tabIndex={-1}
                    aria-label={`${item.shortName || item.name} 삭제`}
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
                  const next = createEquipment()
                  updateCatalog((prev) => [...prev, next])
                  setEquipmentId(next.id)
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

      {!catalog.length ? (
        <p className="equip-empty">등록된 설비가 없습니다. 수정에서 설비를 추가해 주세요.</p>
      ) : (
        <>
          <div className="chem-sheet-tools no-print">
            {formEdit ? (
              <>
                <ChemFormEditBar
                  action={formAction}
                  onAction={setFormAction}
                  selectedFont={
                    selectedCellIds.length
                      ? (layout.cellFonts?.[selectedCellIds[selectedCellIds.length - 1]] ??
                        defaultInspCellFont(selectedCellIds[selectedCellIds.length - 1]))
                      : null
                  }
                  canFont={selectedCellIds.length > 0}
                  onFont={bumpCellFont}
                  showColumns={false}
                  showPages={false}
                  rowScope={showAll ? 'all' : 'current'}
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
                  className={`chem-doc-btn${canUndo ? ' chem-doc-commit' : ''}`}
                  type="button"
                  onClick={commitFormEdit}
                >
                  <TableProperties size={14} />
                  양식 수정 완료
                </button>
                </div>
              </>
            ) : (
              <div className="chem-sheet-tool-btns">
                <InspTipButton />
                <ComposeModeButton active={compose} onToggle={toggleCompose} />
                <button
                  className="chem-doc-btn"
                  type="button"
                  onClick={() => {
                    setTabEditMode(false)
                    setFormAction(null)
                    setSelectedCellIds([])
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
                    <button className="chem-doc-btn" type="button" onClick={() => markSelectedDays('O')}>
                      {dayActionLabel} 전체 <span className="insp-tip-ok">정상(O)</span>
                    </button>
                    <button className="chem-doc-btn" type="button" onClick={() => markSelectedDays('X')}>
                      {dayActionLabel} 전체 <span className="insp-tip-bad">이상(X)</span>
                    </button>
                    <button className="chem-doc-btn" type="button" onClick={() => markSelectedDays('휴')}>
                      {dayActionLabel} <span className="insp-tip-off">휴무(휴)</span>
                    </button>
                    <button className="chem-doc-btn insp-reset-btn" type="button" onClick={requestMonthReset}>
                      <RotateCcw size={14} />
                      전체 초기화
                    </button>
                  </>
                )}
                <span className="insp-tool-split" aria-hidden="true" />
                <button
                  className={`chem-doc-btn chem-doc-save ${hasUnsaved ? 'is-dirty' : ''}`}
                  type="button"
                  onClick={saveAll}
                >
                  <img src={diskette} alt="" />
                  {hasUnsaved ? '저장' : savedFlash ? '저장됨' : '저장'}
                </button>
                <button className="chem-doc-btn insp-print-btn" type="button" onClick={printPage}>
                  <Printer size={14} />
                  {showAll ? '전체 인쇄' : '인쇄'}
                </button>
              </div>
            )}
          </div>

          {showAll ? (
            <InspectionAllView
              catalog={catalog}
              inspections={draftInspections}
              year={year}
              month={month}
              days={days}
              monthPrefix={monthPrefix}
              today={today}
              selectedDates={selectedDates}
              inspectors={inspectors}
              inspectorByEquipment={inspectorByEquipment}
              inspectorWarnId={needInspectorId}
              chrome={chrome}
              formEdit={formEdit}
              formAction={formAction}
              printing={printing}
              sharedLayout={layout}
              selectedCellIds={selectedCellIds}
              onSelectCell={(cellId, additive) => {
                setSelectedCellIds((prev) =>
                  additive
                    ? prev.includes(cellId)
                      ? prev.filter((id) => id !== cellId)
                      : [...prev, cellId]
                    : [cellId],
                )
              }}
              onInsertItem={(eqId, itemId) => insertItemAfter(eqId, itemId)}
              onDeleteItemRow={(eqId, itemId) => deleteItemAt(eqId, itemId)}
              onSelectDate={selectSingleDate}
              onDaySelectStart={startDaySelect}
              onToggleCell={toggleCell}
              onSaveReading={saveReading}
              onSaveFraction={saveFraction}
              onToggleDayOk={toggleDayOk}
              onChromeChange={updateChrome}
              onColResizeStart={startColResize}
              onRowResizeStart={startRowResize}
              onIssueNoteChange={(eq, day, value) =>
                persistDay(`${monthPrefix}-${pad2(day)}`, { issueNote: value }, eq)
              }
              onRequestDateChange={(eq, day, value) =>
                persistDay(`${monthPrefix}-${pad2(day)}`, { requestDate: value }, eq)
              }
              onConfirmDateChange={(eq, day, value) =>
                persistDay(`${monthPrefix}-${pad2(day)}`, { confirmDate: value }, eq)
              }
              onInspectorChange={(eq, name) => assignInspector(eq.id, name)}
            />
          ) : equipment ? (
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
            inspectorWarn={needInspectorId === equipment.id}
            chrome={chrome}
            recordsByDate={recordsByDate}
            formEdit={formEdit}
            formAction={formAction}
            printing={printing}
            draggingItemId={draggingItemId}
            layout={layout}
            selectedCellIds={selectedCellIds}
            onSelectCell={(cellId, additive) => {
              setSelectedCellIds((prev) =>
                additive
                  ? prev.includes(cellId)
                    ? prev.filter((id) => id !== cellId)
                    : [...prev, cellId]
                  : [cellId],
              )
            }}
            onInsertItem={(itemId) => insertItemAfter(equipment.id, itemId)}
            onSelectDate={selectSingleDate}
            onDaySelectStart={startDaySelect}
            onToggleCell={(day, itemNo) => toggleCell(equipment, day, itemNo)}
            onSaveReading={(day, item, value) => saveReading(equipment, day, item, value)}
            onSaveFraction={(day, item, reading, part, value) =>
              saveFraction(equipment, day, item, reading, part, value)
            }
            onToggleDayOk={(day) => toggleDayOk(equipment, day)}
            onChromeChange={updateChrome}
            onRenameEquipment={(patch) => updateEquipment(equipment.id, patch)}
            onUpdateItem={updateItem}
            onDeleteItem={(itemId) => deleteItemAt(equipment.id, itemId)}
            onItemDragStart={(itemId) => {
              dragItemId.current = itemId
              setDraggingItemId(itemId)
            }}
            onItemDragOver={() => {}}
            onItemDrop={(itemId) => {
              const fromId = dragItemId.current
              if (fromId) reorderItems(fromId, itemId)
              dragItemId.current = null
              setDraggingItemId(null)
            }}
            onItemDragEnd={() => {
              dragItemId.current = null
              setDraggingItemId(null)
            }}
            onColResizeStart={startColResize}
            onRowResizeStart={startRowResize}
            onIssueNoteChange={(day, value) => {
              const date = `${monthPrefix}-${pad2(day)}`
              selectSingleDate(date)
              setIssueNote(value)
              persistDay(date, { issueNote: value }, equipment)
            }}
            onRequestDateChange={(day, value) => {
              const date = `${monthPrefix}-${pad2(day)}`
              selectSingleDate(date)
              setRequestDate(value)
              persistDay(date, { requestDate: value }, equipment)
            }}
            onConfirmDateChange={(day, value) => {
              const date = `${monthPrefix}-${pad2(day)}`
              selectSingleDate(date)
              setConfirmDate(value)
              persistDay(date, { confirmDate: value }, equipment)
            }}
            onInspectorChange={(name) => assignInspector(equipment.id, name)}
          />
          ) : null}

        </>
      )}

      {inspectorAlert ? (
        <div className="modal-backdrop confirm-backdrop no-print" onClick={() => setInspectorAlert(false)}>
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="insp-inspector-alert"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="insp-inspector-alert">각 점검표에서 점검자를 먼저 선택한 뒤 기록할 수 있습니다.</p>
            <div className="confirm-modal-actions">
              <button className="primary-btn" type="button" onClick={() => setInspectorAlert(false)}>
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingMonthReset ? (
        <div className="modal-backdrop confirm-backdrop no-print" onClick={() => setPendingMonthReset(false)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="insp-reset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="insp-reset-title">초기화하시겠습니까?</p>
            <div className="confirm-modal-actions">
              <button className="secondary-btn" type="button" onClick={() => setPendingMonthReset(false)}>
                아니오
              </button>
              <button className="primary-btn" type="button" onClick={confirmMonthReset}>
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
            aria-labelledby="equip-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="equip-delete-title">삭제 하시겠습니까?</p>
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
