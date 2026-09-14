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
import { appendActivityLog, deleteActivityLog, loadActivityLogs, saveActivityLogs } from '../lib/activity'
import { DEFAULT_ACTOR } from '../lib/actor'
import {
  loadEquipmentCatalog,
  loadInspectors,
  saveEquipmentCatalog,
  saveInspectors,
} from '../lib/catalog'
import {
  cloudHasChemicals,
  cloudHasInspections,
  loadCloudBundle,
  saveCatalogCloud,
  saveChemicalYearBookCloud,
  saveInspectionsCloud,
  saveLogsCloud,
} from '../lib/cloudStore'
import { ledgerCalendarYear, loadChemicalYearBook, saveChemicalYearBook } from '../lib/chemicals'
import { loadApprovalStamp, saveApprovalStamp as persistApprovalStamp } from '../lib/approvalStamp'
import {
  inspectionContentKey,
  loadInspections,
  removeInspection,
  saveInspections,
  upsertInspection,
  type InspectionDraft,
} from '../lib/inspections'
import { BootPage } from '../pages/BootPage'
import type { ActivityLog, ChemicalLedger, ChemicalLedgersByYear, Equipment, InspectionRecord, UserProfile } from '../types'
import { useAuth } from './AuthContext'

interface AppDataContextValue {
  equipmentList: Equipment[]
  inspectors: string[]
  approvalStamp: string | null
  inspections: InspectionRecord[]
  logs: ActivityLog[]
  chemicalLedgers: ChemicalLedger[]
  chemicalYearBook: ChemicalLedgersByYear
  cloudError: string
  saveCatalog: (equipment: Equipment[], inspectorNames: string[]) => void
  saveApprovalStamp: (dataUrl: string | null) => void
  saveInspection: (draft: InspectionDraft, options?: { log?: boolean }) => InspectionRecord
  saveInspectionsAll: (records: InspectionRecord[]) => void
  deleteInspection: (id: string) => void
  saveChemicalYearBookAll: (book: ChemicalLedgersByYear) => void
  saveChemicalLedgersAll: (list: ChemicalLedger[]) => void
  deleteLog: (id: string) => void
  refreshLogs: () => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

function actorOf(profile: UserProfile | null): UserProfile {
  return profile ?? DEFAULT_ACTOR
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const actor = actorOf(profile)
  const [hydrated, setHydrated] = useState(false)
  const [cloudError, setCloudError] = useState('')
  const [equipmentList, setEquipmentList] = useState<Equipment[]>(() => loadEquipmentCatalog())
  const [inspectors, setInspectors] = useState<string[]>(() => loadInspectors())
  const [approvalStamp, setApprovalStamp] = useState<string | null>(() => loadApprovalStamp())
  const stampRef = useRef(approvalStamp)
  stampRef.current = approvalStamp
  const [inspections, setInspections] = useState<InspectionRecord[]>(() => loadInspections())
  const inspectionsRef = useRef(inspections)
  inspectionsRef.current = inspections
  const [logs, setLogs] = useState<ActivityLog[]>(() => loadActivityLogs())
  const [chemicalYearBook, setChemicalYearBook] = useState<ChemicalLedgersByYear>(() => loadChemicalYearBook())
  const chemicalLedgers = chemicalYearBook[String(ledgerCalendarYear())] ?? []

  const rememberError = useCallback((err: unknown, fallback: string) => {
    console.error(err)
    setCloudError(fallback)
  }, [])

  const pushInspections = useCallback(
    (records: InspectionRecord[]) => {
      void saveInspectionsCloud(records).catch((err) => rememberError(err, '점검 기록을 클라우드에 저장하지 못했습니다.'))
    },
    [rememberError],
  )

  const pushChemicals = useCallback(
    (book: ChemicalLedgersByYear) => {
      void saveChemicalYearBookCloud(book).catch((err) =>
        rememberError(err, '화학물질 대장을 클라우드에 저장하지 못했습니다.'),
      )
    },
    [rememberError],
  )

  const pushCatalog = useCallback(
    (equipment: Equipment[], names: string[], stamp = stampRef.current) => {
      void saveCatalogCloud(equipment, names, stamp).catch((err) =>
        rememberError(err, '설정을 클라우드에 저장하지 못했습니다.'),
      )
    },
    [rememberError],
  )

  const pushLogs = useCallback(
    (next: ActivityLog[]) => {
      void saveLogsCloud(next).catch((err) => rememberError(err, '이력을 클라우드에 저장하지 못했습니다.'))
    },
    [rememberError],
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const hydrate = async () => {
      try {
        const cloud = await loadCloudBundle()
        if (cancelled) return

        if (cloudHasInspections(cloud)) {
          saveInspections(cloud.inspections)
          setInspections(cloud.inspections)
        } else if (inspectionsRef.current.length > 0) {
          await saveInspectionsCloud(inspectionsRef.current)
        }

        if (cloudHasChemicals(cloud)) {
          const next = saveChemicalYearBook(cloud.chemicalYearBook)
          setChemicalYearBook(next)
        } else {
          await saveChemicalYearBookCloud(loadChemicalYearBook())
        }

        if (cloud.catalog) {
          const nextEquipment = saveEquipmentCatalog(cloud.catalog.equipment)
          const nextInspectors = saveInspectors(cloud.catalog.inspectors)
          setEquipmentList(nextEquipment)
          setInspectors(nextInspectors)
          if (typeof cloud.catalog.approvalStamp === 'string') {
            const nextStamp = persistApprovalStamp(
              cloud.catalog.approvalStamp.startsWith('data:image/') ? cloud.catalog.approvalStamp : null,
            )
            stampRef.current = nextStamp
            setApprovalStamp(nextStamp)
          }
        } else {
          await saveCatalogCloud(loadEquipmentCatalog(), loadInspectors(), stampRef.current)
        }

        if (cloud.logs.length > 0) {
          saveActivityLogs(cloud.logs)
          setLogs(cloud.logs)
        } else {
          const localLogs = loadActivityLogs()
          if (localLogs.length > 0) await saveLogsCloud(localLogs)
        }
        setCloudError('')
      } catch (err) {
        rememberError(err, '클라우드 기록을 불러오지 못했습니다. 로그인·보안 규칙을 확인해 주세요.')
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [rememberError, user])

  const refreshLogs = useCallback(() => {
    const next = loadActivityLogs()
    setLogs(next)
    pushLogs(next)
  }, [pushLogs])

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
      pushCatalog(nextEquipment, nextInspectors)
      appendActivityLog(actor, '설정 변경', `설비 ${nextEquipment.length}대 · 점검자 ${nextInspectors.length}명`)
      refreshLogs()
    },
    [actor, pushCatalog, refreshLogs],
  )

  const saveApprovalStamp = useCallback(
    (dataUrl: string | null) => {
      const next = persistApprovalStamp(dataUrl)
      stampRef.current = next
      setApprovalStamp(next)
      pushCatalog(equipmentList, inspectors, next)
      appendActivityLog(actor, '설정 변경', '계장 서명 변경')
      refreshLogs()
    },
    [actor, equipmentList, inspectors, pushCatalog, refreshLogs],
  )

  const saveInspection = useCallback(
    (draft: InspectionDraft, options?: { log?: boolean }) => {
      const result = upsertInspection(inspectionsRef.current, draft)
      inspectionsRef.current = result.records
      saveInspections(result.records)
      setInspections(result.records)
      pushInspections(result.records)
      if (options?.log !== false) {
        const equipment = findEquipment(result.record.equipmentId)
        appendActivityLog(
          actor,
          result.isNew ? '일상 점검 작성' : '일상 점검 수정',
          `${equipment?.name ?? result.record.equipmentId} · ${result.record.date}`,
        )
        refreshLogs()
      }
      return result.record
    },
    [actor, findEquipment, pushInspections, refreshLogs],
  )

  const saveInspectionsAll = useCallback(
    (records: InspectionRecord[]) => {
      const prev = inspectionsRef.current
      const prevById = new Map(prev.map((item) => [item.id, item]))
      const nextById = new Set(records.map((item) => item.id))

      inspectionsRef.current = records
      saveInspections(records)
      setInspections(records)
      pushInspections(records)

      let logged = false
      for (const record of records) {
        const old = prevById.get(record.id)
        const equipment = findEquipment(record.equipmentId)
        const label = `${equipment?.name ?? record.equipmentId} · ${record.date}`
        if (!old) {
          appendActivityLog(actor, '일상 점검 작성', label)
          logged = true
        } else if (inspectionContentKey(old) !== inspectionContentKey(record)) {
          appendActivityLog(actor, '일상 점검 수정', label)
          logged = true
        }
      }
      for (const old of prev) {
        if (nextById.has(old.id)) continue
        const equipment = findEquipment(old.equipmentId)
        appendActivityLog(
          actor,
          '점검 기록 삭제',
          `${equipment?.name ?? old.equipmentId} · ${old.date}`,
        )
        logged = true
      }
      if (logged) refreshLogs()
    },
    [actor, findEquipment, pushInspections, refreshLogs],
  )

  const deleteInspection = useCallback(
    (id: string) => {
      const target = inspectionsRef.current.find((item) => item.id === id)
      const next = removeInspection(inspectionsRef.current, id)
      inspectionsRef.current = next
      saveInspections(next)
      setInspections(next)
      pushInspections(next)
      if (target) {
        const equipment = findEquipment(target.equipmentId)
        appendActivityLog(
          actor,
          '점검 기록 삭제',
          `${equipment?.name ?? target.equipmentId} · ${target.date}`,
        )
        refreshLogs()
      }
    },
    [actor, findEquipment, pushInspections, refreshLogs],
  )

  const saveChemicalYearBookAll = useCallback(
    (book: ChemicalLedgersByYear) => {
      const next = saveChemicalYearBook(book)
      setChemicalYearBook(next)
      pushChemicals(next)
      const years = Object.keys(next)
        .sort()
        .map((year) => `${year}년`)
        .join(', ')
      appendActivityLog(actor, '화학물질 대장 저장', years)
      refreshLogs()
    },
    [actor, pushChemicals, refreshLogs],
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
      pushLogs(next)
      if (target) {
        appendActivityLog(actor, '이력 삭제', `${target.action} · ${target.detail}`)
        const after = loadActivityLogs()
        setLogs(after)
        pushLogs(after)
      }
    },
    [actor, logs, pushLogs],
  )

  const value = useMemo(
    () => ({
      equipmentList,
      inspectors,
      approvalStamp,
      inspections,
      logs,
      chemicalLedgers,
      chemicalYearBook,
      cloudError,
      saveCatalog,
      saveApprovalStamp,
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
      approvalStamp,
      inspections,
      logs,
      chemicalLedgers,
      chemicalYearBook,
      cloudError,
      saveCatalog,
      saveApprovalStamp,
      saveInspection,
      saveInspectionsAll,
      deleteInspection,
      saveChemicalYearBookAll,
      saveChemicalLedgersAll,
      deleteLog,
      refreshLogs,
    ],
  )

  if (!hydrated) return <BootPage />

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider')
  }
  return context
}
