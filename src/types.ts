export type CheckResult = 'O' | 'X' | '휴' | ''

export type TimingCode = '운' | '정'

export type InputKind = 'mark' | 'number' | 'fraction'

export interface CheckItem {
  id?: string
  no: number
  point: string
  timing: TimingCode
  criteria: string
  inputKind?: InputKind
}

export interface Equipment {
  id: string
  name: string
  shortName: string
  items: CheckItem[]
}

export interface UserProfile {
  email: string
  name: string
  department: string
}

export interface InspectionRecord {
  id: string
  equipmentId: string
  date: string
  inspector: UserProfile
  results: Record<string, CheckResult>
  readings?: Record<string, string>
  issueNote: string
  requestDate: string
  confirmDate: string
  createdAt: string
  updatedAt: string
}

export type ActivityAction =
  | '일상 점검 작성'
  | '일상 점검 수정'
  | '점검 기록 삭제'
  | '이력 삭제'
  | '설정 변경'
  | '화학물질 대장 저장'

export interface ActivityLog {
  id: string
  timestamp: string
  user: UserProfile
  action: ActivityAction
  detail: string
}

export interface ChemicalActivities {
  manufacture: boolean
  import: boolean
  use: boolean
  sale: boolean
}

export interface ChemicalLedgerMeta {
  productName: string
  mainUse: string
  activities: ChemicalActivities
  category1: string
  category2: string
  category3: string
  content: string
  content1: string
  content2: string
  content3: string
  unit: string
}

export interface ChemicalLedgerRow {
  id: string
  inDate: string
  carryOver: string
  inType: string
  inQty: string
  inName: string
  inBizNo: string
  inAddress: string
  inPhone: string
  outDate: string
  outType: string
  outQty: string
  outName: string
  outBizNo: string
  outAddress: string
  outPhone: string
  stock: string
  note: string
  extra: Record<string, string>
}

export interface ChemicalLedger {
  id: string
  tabName: string
  meta: ChemicalLedgerMeta
  rows: ChemicalLedgerRow[]
}

export type ChemicalLedgersByYear = Record<string, ChemicalLedger[]>
