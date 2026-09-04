import { useEffect, useMemo, useState } from 'react'
import { History, RefreshCw, Trash2 } from 'lucide-react'
import { ACTIVITY_ACTIONS } from '../lib/activity'
import { formatDateTime } from '../lib/date'
import { useAppData } from '../context/AppDataContext'
import type { ActivityAction } from '../types'

export function HistoryLogPage() {
  const { logs, deleteLog, refreshLogs } = useAppData()
  const [action, setAction] = useState<'전체' | ActivityAction>('전체')
  const [query, setQuery] = useState('')

  useEffect(() => {
    refreshLogs()
  }, [refreshLogs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return logs.filter((item) => {
      const actionOk = action === '전체' || item.action === action
      const userOk =
        !q ||
        item.user.email.toLowerCase().includes(q) ||
        item.user.name.toLowerCase().includes(q)
      return actionOk && userOk
    })
  }, [logs, action, query])

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            <History size={24} />
            이력 로그
          </h1>
          <p className="page-desc">
            기능 이용 이력을 기록·조회합니다. (최근 300건 · 탭 이동 제외)
          </p>
        </div>
      </div>

      <div className="toolbar">
        <select
          className="select"
          value={action}
          onChange={(e) => setAction(e.target.value as '전체' | ActivityAction)}
          aria-label="액션"
        >
          <option value="전체">액션: 전체</option>
          {ACTIVITY_ACTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <label className="search">
          <span>사용자</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="점검자 이름 검색"
          />
        </label>
        <button className="secondary-btn" type="button" onClick={refreshLogs}>
          <RefreshCw size={16} />
          새로고침
        </button>
        <span className="count-label">
          표시 {filtered.length}건 / 전체 {logs.length}건
        </span>
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
                    <span>{item.user.department}</span>
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
