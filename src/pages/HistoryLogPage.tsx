import { useEffect, useMemo, useState } from 'react'
import { History, RefreshCw, Trash2 } from 'lucide-react'
import { PageHead } from '../components/layout/PageHead'
import { ACTIVITY_ACTIONS } from '../lib/activity'
import { formatDateTime } from '../lib/date'
import { useAppData } from '../context/AppDataContext'
import type { ActivityAction } from '../types'

export function HistoryLogPage() {
  const { logs, deleteLog, refreshLogs } = useAppData()
  const [action, setAction] = useState<'전체' | ActivityAction>('전체')
  const [userKey, setUserKey] = useState('전체')

  useEffect(() => {
    refreshLogs()
  }, [refreshLogs])

  const users = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>()
    for (const item of logs) {
      const email = item.user.email.trim()
      const key = email && email !== '-' ? email.toLowerCase() : `name:${item.user.name}`
      if (map.has(key)) continue
      map.set(key, { name: item.user.name, email: email || '-' })
    }
    return [...map.entries()]
      .map(([key, user]) => ({ key, ...user }))
      .sort((left, right) => left.email.localeCompare(right.email, 'ko'))
  }, [logs])

  useEffect(() => {
    if (userKey === '전체') return
    if (users.some((user) => user.key === userKey)) return
    setUserKey('전체')
  }, [userKey, users])

  const filtered = useMemo(() => {
    return logs.filter((item) => {
      const actionOk = action === '전체' || item.action === action
      if (userKey === '전체') return actionOk
      const email = item.user.email.trim()
      const key = email && email !== '-' ? email.toLowerCase() : `name:${item.user.name}`
      return actionOk && key === userKey
    })
  }, [logs, action, userKey])

  return (
    <section>
      <PageHead
        icon={History}
        title="이력 로그"
        description="웹의 이용 이력을 기록·조회합니다. (최근 300건 · 탭 이동 제외 · 담당자만 확인 가능)"
      />

      <div className="log-filter">
        <label className="log-filter-field">
          <span>액션</span>
          <select
            className="log-filter-select"
            value={action}
            onChange={(event) => setAction(event.target.value as '전체' | ActivityAction)}
          >
            <option value="전체">전체</option>
            {ACTIVITY_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="log-filter-field log-filter-search">
          <span>사용자</span>
          <select
            className="log-filter-select"
            value={userKey}
            onChange={(event) => setUserKey(event.target.value)}
          >
            <option value="전체">전체</option>
            {users.map((user) => (
              <option key={user.key} value={user.key}>
                {user.email !== '-' ? `${user.name} (${user.email})` : user.name}
              </option>
            ))}
          </select>
        </label>
        <div className="log-filter-aside">
          <button className="secondary-btn" type="button" onClick={refreshLogs}>
            <RefreshCw size={16} />
            새로고침
          </button>
          <span className="count-label">
            표시 {filtered.length}건 / 전체 {logs.length}건
          </span>
        </div>
      </div>

      <div className="log-table-wrap">
        <table className="log-table">
          <thead>
            <tr>
              <th>시각</th>
              <th>사용자</th>
              <th>액션</th>
              <th>상세</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">표시할 이력이 없습니다.</div>
                </td>
              </tr>
            )}
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>{formatDateTime(item.timestamp)}</td>
                <td>
                  <div className="user-cell">
                    <strong>{item.user.name}</strong>
                    <span>{item.user.email}</span>
                  </div>
                </td>
                <td>
                  <span className="action-pill">{item.action}</span>
                </td>
                <td>{item.detail}</td>
                <td>
                  <button className="delete-cell" type="button" onClick={() => deleteLog(item.id)}>
                    <Trash2 size={14} />
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
