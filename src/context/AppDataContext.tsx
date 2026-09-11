import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { appendActivityLog, deleteActivityLog, loadActivityLogs } from '../lib/activity'
import { DEFAULT_ACTOR } from '../lib/actor'
import {
  loadEquipmentCatalog,
  loadInspectors,
  saveEquipmentCatalog,
  saveInspectors,
} from '../lib/catalog'
import {
  inspectionContentKey,
  loadInspections,
  removeInspection,
  saveInspections,
  upsertInspection,
  type InspectionDraft,
} from '../lib/inspections'
import { ledgerCalendarYear, loadChemicalYearBook, saveChemicalYearBook } from '../lib/chemicals'
import type { ActivityLog, ChemicalLedger, ChemicalLedgersByYear, Equipment, InspectionRecord } from '../types'

interface AppDataContextValue {
  equipmentList: Equipment[]
  inspectors: string[]
  inspections: InspectionRecord[]
  logs: ActivityLog[]
  chemicalLedgers: ChemicalLedger[]
  chemicalYearBook: ChemicalLedgersByYear
  saveCatalog: (equipment: Equipment[], inspectorNames: string[]) => void
  saveInspection: (draft: InspectionDraft, options?: { log?: boolean }) => InspectionRecord
  saveInspectionsAll: (records: InspectionRecord[]) => void
  deleteInspection: (id: string) => void
  saveChemicalYearBookAll: (book: ChemicalLedgersByYear) => void
  saveChemicalLedgersAll: (list: ChemicalLedger[]) => void
  deleteLog: (id: string) => void
  refreshLogs: () => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>(() => loadEquipmentCatalog())
  const [inspectors, setInspectors] = useState<string[]>(() => loadInspectors())
  const [inspections, setInspections] = useState<InspectionRecord[]>(() => loadInspections())
  const inspectionsRef = useRef(inspections)
  inspectionsRef.current = inspections
  const [logs, setLogs] = useState<ActivityLog[]>(() => loadActivityLogs())
  const [chemicalYearBook, setChemicalYearBook] = useState<ChemicalLedgersByYear>(() => loadChemicalYearBook())
  const chemicalLedgers = chemicalYearBook[String(ledgerCalendarYear())] ?? []

  useEffect(() => {
    setEquipmentList(loadEquipmentCatalog())
  }, [])

  const refreshLogs = useCallback(() => {
    setLogs(loadActivityLogs())
  }, [])

  const findEquipment = useCallback(
    (id: string) => equipmentList.find((item) => item.id === id),
    [equipmentList],
  )

  const saveCatalog = useCallback(
    (equipment: Equipment[], inspectorNames: string[]) => {
      const nextEquipment = saveEquipmentCatalog(equipment)
      const nextInspectors = saveInspectors(inspectorNames)
      setEquipmentList(nextEquipment)
      setInspectors(nextInspectors)
      appendActivityLog(
        DEFAULT_ACTOR,
        '설정 변경',
        `설비 ${nextEquipment.length}대 · 점검자 ${nextInspectors.length}명`,
      )
      refreshLogs()
    },
    [refreshLogs],
  )

  const saveInspection = useCallback(
    (draft: InspectionDraft, options?: { log?: boolean }) => {
      const result = upsertInspection(inspectionsRef.current, draft)
      inspectionsRef.current = result.records
      saveInspections(result.records)
      setInspections(result.records)
      if (options?.log !== false) {
        const equipment = findEquipment(result.record.equipmentId)
        appendActivityLog(
          result.record.inspector,
          result.isNew ? '일상 점검 작성' : '일상 점검 수정',
          `${equipment?.name ?? result.record.equipmentId} · ${result.record.date}`,
        )
        refreshLogs()
      }
      return result.record
    },
    [findEquipment, refreshLogs],
  )

  const saveInspectionsAll = useCallback(
    (records: InspectionRecord[]) => {
      const prev = inspectionsRef.current
      const prevById = new Map(prev.map((item) => [item.id, item]))
      const nextById = new Set(records.map((item) => item.id))

      inspectionsRef.current = records
      saveInspections(records)
      setInspections(records)

      let logged = false
      for (const record of records) {
        const old = prevById.get(record.id)
        const equipment = findEquipment(record.equipmentId)
        const label = `${equipment?.name ?? record.equipmentId} · ${record.date}`
        if (!old) {
          appendActivityLog(record.inspector, '일상 점검 작성', label)
          logged = true
        } else if (inspectionContentKey(old) !== inspectionContentKey(record)) {
          appendActivityLog(record.inspector, '일상 점검 수정', label)
          logged = true
        }
      }
      for (const old of prev) {
        if (nextById.has(old.id)) continue
        const equipment = findEquipment(old.equipmentId)
        appendActivityLog(
          old.inspector,
          '점검 기록 삭제',
          `${equipment?.name ?? old.equipmentId} · ${old.date}`,
        )
        logged = true
      }
      if (logged) refreshLogs()
    },
    [findEquipment, refreshLogs],
  )

  const deleteInspection = useCallback(
    (id: string) => {
      const target = inspectionsRef.current.find((item) => item.id === id)
      const next = removeInspection(inspectionsRef.current, id)
      inspectionsRef.current = next
      saveInspections(next)
      setInspections(next)
      if (target) {
        const equipment = findEquipment(target.equipmentId)
        appendActivityLog(
          target.inspector,
          '점검 기록 삭제',
          `${equipment?.name ?? target.equipmentId} · ${target.date}`,
        )
        refreshLogs()
      }
    },
    [findEquipment, refreshLogs],
  )

  const saveChemicalYearBookAll = useCallback(
    (book: ChemicalLedgersByYear) => {
      const next = saveChemicalYearBook(book)
      setChemicalYearBook(next)
      const years = Object.keys(next)
        .sort()
        .map((year) => `${year}년`)
        .join(', ')
      appendActivityLog(DEFAULT_ACTOR, '화학물질 대장 저장', years)
      refreshLogs()
    },
    [refreshLogs],
  )

  const saveChemicalLedgersAll = useCallback(
    (list: ChemicalLedger[]) => {
      saveChemicalYearBookAll({ ...chemicalYearBook, [String(ledgerCalendarYear())]: list })
    },
    [chemicalYearBook, saveChemicalYearBookAll],
  )

  const deleteLog = useCallback(
    (id: string) => {
      const target = logs.find((item) => item.id === id)
      const next = deleteActivityLog(id)
      setLogs(next)
      if (target) {
        appendActivityLog(DEFAULT_ACTOR, '이력 삭제', `${target.action} · ${target.detail}`)
        setLogs(loadActivityLogs())
      }
    },
    [logs],
  )

  const value = useMemo(
    () => ({
      equipmentList,
      inspectors,
      inspections,
      logs,
      chemicalLedgers,
      chemicalYearBook,
      saveCatalog,
      saveInspection,
      saveInspectionsAll,
      deleteInspection,
      saveChemicalYearBookAll,
      saveChemicalLedgersAll,
      deleteLog,
      refreshLogs,
    }),
    [
      equipmentList,
      inspectors,
      inspections,
      logs,
      chemicalLedgers,
      chemicalYearBook,
      saveCatalog,
      saveInspection,
      saveInspectionsAll,
      deleteInspection,
      saveChemicalYearBookAll,
      saveChemicalLedgersAll,
      deleteLog,
      refreshLogs,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider')
  }
  return context
}
