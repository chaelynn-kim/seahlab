export type CheckResult = 'O' | 'X' | ''

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

export interface ActivityLog {
  id: string
  timestamp: string
  user: UserProfile
  action: ActivityAction
  detail: string
}
