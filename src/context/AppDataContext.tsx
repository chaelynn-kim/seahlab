import {
  createContext,
  useCallback,
  useContext,
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
  loadInspections,
  removeInspection,
  saveInspections,
  upsertInspection,
  type InspectionDraft,
} from '../lib/inspections'
import { loadChemicalLedgers, saveChemicalLedgers } from '../lib/chemicals'
import type { ActivityLog, ChemicalLedger, Equipment, InspectionRecord } from '../types'

interface AppDataContextValue {
  equipmentList: Equipment[]
  inspectors: string[]
  inspections: InspectionRecord[]
  logs: ActivityLog[]
  chemicalLedgers: ChemicalLedger[]
  saveCatalog: (equipment: Equipment[], inspectorNames: string[]) => void
  saveInspection: (draft: InspectionDraft, options?: { log?: boolean }) => InspectionRecord
  deleteInspection: (id: string) => void
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
  const [chemicalLedgers, setChemicalLedgers] = useState<ChemicalLedger[]>(() => loadChemicalLedgers())

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

  const saveChemicalLedgersAll = useCallback(
    (list: ChemicalLedger[]) => {
      const next = saveChemicalLedgers(list)
      setChemicalLedgers(next)
      appendActivityLog(DEFAULT_ACTOR, '화학물질 대장 저장', `물질 ${next.length}종`)
      refreshLogs()
    },
    [refreshLogs],
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
      saveCatalog,
      saveInspection,
      deleteInspection,
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
      saveCatalog,
      saveInspection,
      deleteInspection,
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
