import type { ActivityAction, ActivityLog, UserProfile } from '../types'
import { createId, readJson, writeJson } from './storage'

const LOG_KEY = 'activityLogs'
const MAX_LOGS = 300

export function loadActivityLogs(): ActivityLog[] {
  return readJson<ActivityLog[]>(LOG_KEY, [])
}

export function saveActivityLogs(logs: ActivityLog[]): void {
  writeJson(LOG_KEY, logs.slice(0, MAX_LOGS))
}

export function appendActivityLog(
  user: UserProfile,
  action: ActivityAction,
  detail: string,
): ActivityLog {
  const entry: ActivityLog = {
    id: createId('log'),
    timestamp: new Date().toISOString(),
    user,
    action,
    detail,
  }
  const next = [entry, ...loadActivityLogs()].slice(0, MAX_LOGS)
  saveActivityLogs(next)
  return entry
}

export function deleteActivityLog(id: string): ActivityLog[] {
  const next = loadActivityLogs().filter((item) => item.id !== id)
  saveActivityLogs(next)
  return next
}

export const ACTIVITY_ACTIONS: ActivityAction[] = [
  '일상 점검 작성',
  '일상 점검 수정',
  '점검 기록 삭제',
  '이력 삭제',
  '설정 변경',
  '화학물질 대장 저장',
]
