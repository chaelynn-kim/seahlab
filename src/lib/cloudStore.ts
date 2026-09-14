import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { ActivityLog, ChemicalLedgersByYear, Equipment, InspectionRecord } from '../types'
import { db } from './firebase'

const INSPECTIONS = 'inspections'
const CHEMICALS = 'chemicals'
const META = 'meta'
const CATALOG_ID = 'catalog'
const LOGS_ID = 'logs'
const BATCH_LIMIT = 400

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size))
  }
  return groups
}

export interface CloudCatalog {
  equipment: Equipment[]
  inspectors: string[]
  approvalStamp?: string
}

export interface CloudBundle {
  inspections: InspectionRecord[]
  chemicalYearBook: ChemicalLedgersByYear
  catalog: CloudCatalog | null
  logs: ActivityLog[]
}

export async function loadCloudBundle(): Promise<CloudBundle> {
  const [inspectionSnap, chemicalSnap, catalogSnap, logsSnap] = await Promise.all([
    getDocs(collection(db, INSPECTIONS)),
    getDocs(collection(db, CHEMICALS)),
    getDoc(doc(db, META, CATALOG_ID)),
    getDoc(doc(db, META, LOGS_ID)),
  ])

  const chemicalYearBook: ChemicalLedgersByYear = {}
  for (const item of chemicalSnap.docs) {
    const ledgers = item.data().ledgers
    if (Array.isArray(ledgers)) chemicalYearBook[item.id] = ledgers
  }

  const catalogData = catalogSnap.exists() ? catalogSnap.data() : null
  const logsData = logsSnap.exists() ? logsSnap.data() : null

  return {
    inspections: inspectionSnap.docs.map((item) => item.data() as InspectionRecord),
    chemicalYearBook,
    catalog:
      catalogData && Array.isArray(catalogData.equipment)
        ? {
            equipment: catalogData.equipment as Equipment[],
            inspectors: Array.isArray(catalogData.inspectors) ? (catalogData.inspectors as string[]) : [],
            approvalStamp: typeof catalogData.approvalStamp === 'string' ? catalogData.approvalStamp : undefined,
          }
        : null,
    logs: Array.isArray(logsData?.items) ? (logsData.items as ActivityLog[]) : [],
  }
}

export async function saveInspectionsCloud(records: InspectionRecord[]): Promise<void> {
  const existing = await getDocs(collection(db, INSPECTIONS))
  const keep = new Set(records.map((item) => item.id))
  const deletes = existing.docs.filter((item) => !keep.has(item.id)).map((item) => item.ref)
  for (const group of chunk(deletes, BATCH_LIMIT)) {
    const batch = writeBatch(db)
    for (const ref of group) batch.delete(ref)
    await batch.commit()
  }
  for (const group of chunk(records, BATCH_LIMIT)) {
    const batch = writeBatch(db)
    for (const record of group) {
      batch.set(doc(db, INSPECTIONS, record.id), { ...record, readings: record.readings ?? {} })
    }
    await batch.commit()
  }
}

export async function saveChemicalYearBookCloud(book: ChemicalLedgersByYear): Promise<void> {
  const years = Object.keys(book)
  const existing = await getDocs(collection(db, CHEMICALS))
  const keep = new Set(years)
  await Promise.all(
    existing.docs.filter((item) => !keep.has(item.id)).map((item) => deleteDoc(item.ref)),
  )
  await Promise.all(years.map((year) => setDoc(doc(db, CHEMICALS, year), { ledgers: book[year] })))
}

export async function saveCatalogCloud(
  equipment: Equipment[],
  inspectors: string[],
  approvalStamp?: string | null,
): Promise<void> {
  const payload: CloudCatalog = { equipment, inspectors }
  if (approvalStamp !== undefined) {
    payload.approvalStamp = approvalStamp ?? ''
  } else {
    const current = await getDoc(doc(db, META, CATALOG_ID))
    const saved = current.exists() ? current.data().approvalStamp : undefined
    if (typeof saved === 'string') payload.approvalStamp = saved
  }
  await setDoc(doc(db, META, CATALOG_ID), payload)
}

export async function saveLogsCloud(logs: ActivityLog[]): Promise<void> {
  await setDoc(doc(db, META, LOGS_ID), { items: logs })
}

export function cloudHasInspections(bundle: CloudBundle): boolean {
  return bundle.inspections.length > 0
}

export function cloudHasChemicals(bundle: CloudBundle): boolean {
  return Object.values(bundle.chemicalYearBook).some((list) => list.length > 0)
}
