import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardCheck, RotateCcw } from 'lucide-react'
import diskette from '../assets/diskette.png'
import { LINE_NAME, SUPPORT_TEAM } from '../data/equipment'
import { useAppData } from '../context/AppDataContext'
import {
  addMonths,
  daysInMonth,
  formatKoreanDate,
  formatMonthLabel,
  pad2,
  todayKey,
} from '../lib/date'
import {
  blankResults,
  findInspection,
  inspectionStatus,
  isBlankDay,
  isItemFilled,
  itemKey,
} from '../lib/inspections'
import {
  joinFraction,
  parseFractionParts,
  readingPlaceholder,
  resolveInputKind,
  sanitizeDigits,
  sanitizeNumberInput,
  splitCriteriaHighlight,
} from '../lib/inputKind'
import { loadLastInspectorName, saveLastInspectorName, toInspector } from '../lib/actor'
import type { CheckItem, CheckResult, InspectionRecord } from '../types'

function CriteriaText({ text }: { text: string }) {
  return (
    <>
      {splitCriteriaHighlight(text).map((part, index) =>
        part.highlight ? (
          <span key={`${part.text}-${index}`} className="criteria-num">
            {part.text}
          </span>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  )
}

function FractionInput({
  num,
  den,
  numLabel,
  denLabel,
  onFocusCell,
  onNumChange,
  onDenChange,
}: {
  num: string
  den: string
  numLabel: string
  denLabel: string
  onFocusCell: () => void
  onNumChange: (value: string) => void
  onDenChange: (value: string) => void
}) {
  const denRef = useRef<HTMLInputElement>(null)

  const focusDen = () => {
    const input = denRef.current
    if (!input) return
    input.focus()
    input.select()
  }

  return (
    <div className="fraction-input">
      <input
        value={num}
        inputMode="numeric"
        aria-label={numLabel}
        onFocus={onFocusCell}
        onKeyDown={(event) => {
          if (event.key === '/' || event.key === 'Enter') {
            event.preventDefault()
            focusDen()
          }
        }}
        onChange={(event) => {
          const raw = event.target.value
          if (raw.includes('/')) {
            onNumChange(sanitizeDigits(raw))
            queueMicrotask(focusDen)
            return
          }
          const next = sanitizeDigits(raw)
          const wasEmpty = num.length === 0
          onNumChange(next)
          if (wasEmpty && next.length > 0) queueMicrotask(focusDen)
        }}
      />
      <span>/</span>
      <input
        ref={denRef}
        value={den}
        inputMode="numeric"
        aria-label={denLabel}
        onFocus={onFocusCell}
        onChange={(event) => onDenChange(sanitizeDigits(event.target.value))}
      />
    </div>
  )
}

function nextMark(current: CheckResult): CheckResult {
  if (current === '') return 'O'
  if (current === 'O') return 'X'
  return ''
}

function mergeRecord(
  list: InspectionRecord[],
  record: InspectionRecord,
): InspectionRecord[] {
  const index = list.findIndex((item) => item.id === record.id)
  if (index < 0) return [record, ...list]
  const next = [...list]
  next[index] = record
  return next
}

export function InspectionPage() {
  const { equipmentList, inspectors, inspections, saveInspection, deleteInspection } = useAppData()
  const today = todayKey()
  const now = new Date()
  const inspectionsRef = useRef(inspections)
  inspectionsRef.current = inspections

  const [equipmentId, setEquipmentId] = useState(equipmentList[0]?.id ?? '')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(today)
  const [inspectorName, setInspectorName] = useState(() => loadLastInspectorName(inspectors))
  const [needInspector, setNeedInspector] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [issueNote, setIssueNote] = useState('')
  const [requestDate, setRequestDate] = useState('')
  const [confirmDate, setConfirmDate] = useState('')

  const equipment = useMemo(
    () => equipmentList.find((item) => item.id === equipmentId) ?? equipmentList[0],
    [equipmentList, equipmentId],
  )

  useEffect(() => {
    if (!equipmentList.some((item) => item.id === equipmentId) && equipmentList[0]) {
      setEquipmentId(equipmentList[0].id)
    }
  }, [equipmentId, equipmentList])

  const monthPrefix = `${year}-${pad2(month)}`
  const dayCount = daysInMonth(year, month)
  const days = useMemo(() => Array.from({ length: dayCount }, (_, index) => index + 1), [dayCount])

  const recordsByDate = useMemo(() => {
    const map = new Map<string, InspectionRecord>()
    if (!equipment) return map
    for (const record of inspections) {
      if (record.equipmentId !== equipment.id || !record.date.startsWith(monthPrefix)) continue
      map.set(record.date, record)
    }
    return map
  }, [equipment, inspections, monthPrefix])

  const selectedRecord = equipment ? recordsByDate.get(selectedDate) : undefined

  useEffect(() => {
    const record = equipment
      ? findInspection(inspectionsRef.current, equipment.id, selectedDate)
      : undefined
    setIssueNote(record?.issueNote ?? '')
    setRequestDate(record?.requestDate ?? '')
    setConfirmDate(record?.confirmDate ?? '')
  }, [equipment, selectedDate])

  useEffect(() => {
    const cell = document.querySelector<HTMLElement>('.month-grid thead .col-active')
    cell?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [equipment?.id, monthPrefix])

  const filledToday = equipment
    ? equipment.items.filter((item) => isItemFilled(item, selectedRecord)).length
    : 0
  const doneDays = [...recordsByDate.values()].filter((record) => inspectionStatus(record) !== 'empty').length
  const completePct = equipment?.items.length
    ? Math.round((filledToday / equipment.items.length) * 100)
    : 0

  const selectMonth = (nextYear: number, nextMonth: number) => {
    setYear(nextYear)
    setMonth(nextMonth)
    const prefix = `${nextYear}-${pad2(nextMonth)}`
    if (selectedDate.startsWith(prefix)) return
    const inThisMonth = today.startsWith(prefix) ? today : `${prefix}-01`
    setSelectedDate(inThisMonth)
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
    log = false,
  ): boolean => {
    if (!equipment) return false
    if (!inspectorName) {
      setNeedInspector(true)
      return false
    }
    setNeedInspector(false)
    const existing = findInspection(inspectionsRef.current, equipment.id, date)
    const sameDay = date === selectedDate
    const next = {
      results: patch.results ?? existing?.results ?? blankResults(equipment.items.map((item) => item.no)),
      readings: patch.readings ?? existing?.readings ?? {},
      issueNote: patch.issueNote ?? (sameDay ? issueNote : existing?.issueNote ?? ''),
      requestDate: patch.requestDate ?? (sameDay ? requestDate : existing?.requestDate ?? ''),
      confirmDate: patch.confirmDate ?? (sameDay ? confirmDate : existing?.confirmDate ?? ''),
    }
    if (isBlankDay(next)) {
      if (existing) {
        deleteInspection(existing.id)
        inspectionsRef.current = inspectionsRef.current.filter((item) => item.id !== existing.id)
      }
      return true
    }
    saveLastInspectorName(inspectorName)
    const record = saveInspection(
      {
        id: existing?.id,
        equipmentId: equipment.id,
        date,
        inspector: toInspector(inspectorName),
        ...next,
      },
      { log: log || !existing },
    )
    inspectionsRef.current = mergeRecord(inspectionsRef.current, record)
    return true
  }

  const toggleCell = (day: number, itemNo: number) => {
    if (!equipment) return
    const date = `${monthPrefix}-${pad2(day)}`
    setSelectedDate(date)
    const existing = findInspection(inspectionsRef.current, equipment.id, date)
    const key = itemKey(itemNo)
    const results = {
      ...(existing?.results ?? blankResults(equipment.items.map((item) => item.no))),
      [key]: nextMark(existing?.results[key] ?? ''),
    }
    persistDay(date, { results })
  }

  const saveReading = (day: number, item: CheckItem, value: string) => {
    if (!equipment) return
    const date = `${monthPrefix}-${pad2(day)}`
    setSelectedDate(date)
    const existing = findInspection(inspectionsRef.current, equipment.id, date)
    const key = itemKey(item.no)
    const kind = resolveInputKind(item)
    const nextValue = kind === 'number' ? sanitizeNumberInput(value) : value
    persistDay(date, {
      readings: { ...(existing?.readings ?? {}), [key]: nextValue },
    })
  }

  const saveFraction = (day: number, item: CheckItem, reading: string, part: 'num' | 'den', value: string) => {
    const current = parseFractionParts(reading)
    const nextNum = part === 'num' ? sanitizeDigits(value) : current.num
    const nextDen = part === 'den' ? sanitizeDigits(value) : current.den
    saveReading(day, item, joinFraction(nextNum, nextDen))
  }

  const markDayOk = () => {
    if (!equipment) return
    const existing = findInspection(inspectionsRef.current, equipment.id, selectedDate)
    const results = {
      ...(existing?.results ?? blankResults(equipment.items.map((item) => item.no))),
    }
    for (const item of equipment.items) {
      if (resolveInputKind(item) === 'mark') results[itemKey(item.no)] = 'O'
    }
    const ok = persistDay(selectedDate, { results, readings: existing?.readings ?? {} })
    if (ok) flashSaved()
  }

  const resetDay = () => {
    if (!equipment) return
    const existing = findInspection(inspectionsRef.current, equipment.id, selectedDate)
    if (existing) {
      deleteInspection(existing.id)
      inspectionsRef.current = inspectionsRef.current.filter((item) => item.id !== existing.id)
    }
    setIssueNote('')
    setRequestDate('')
    setConfirmDate('')
  }

  const flashSaved = () => {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1400)
  }

  const saveNotes = () => {
    const ok = persistDay(
      selectedDate,
      { issueNote, requestDate, confirmDate },
      true,
    )
    if (ok) flashSaved()
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            <ClipboardCheck size={24} />
            일상 점검
          </h1>
          <p className="page-desc">
            {LINE_NAME} · {SUPPORT_TEAM} · 빨간 기준은 수치/분수, 그 외 항목은 O/X로 날짜 칸에 바로 기록합니다.
          </p>
        </div>
      </div>

      <div className="date-bar">
        <label className="grid-control">
          <span className="date-bar-label">설비</span>
          <select
            className="select"
            value={equipment?.id ?? ''}
            onChange={(event) => setEquipmentId(event.target.value)}
          >
            {equipmentList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid-control">
          <span className="date-bar-label">조회 월</span>
          <input
            className="select"
            type="month"
            value={monthPrefix}
            onChange={(event) => {
              const [nextYear, nextMonth] = event.target.value.split('-').map(Number)
              if (!nextYear || !nextMonth) return
              selectMonth(nextYear, nextMonth)
            }}
          />
        </label>
        <label className="grid-control">
          <span className="date-bar-label">
            점검자 <span className="req">*</span>
          </span>
          <select
            className={`select ${needInspector ? 'select-warn' : ''}`}
            value={inspectorName}
            onChange={(event) => {
              setInspectorName(event.target.value)
              setNeedInspector(false)
              saveLastInspectorName(event.target.value)
            }}
          >
            <option value="" disabled>
              선택
            </option>
            {inspectors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="date-progress">
          <div className="date-progress-track" aria-hidden="true">
            <div className="date-progress-fill" style={{ width: `${completePct}%` }} />
          </div>
          <span>
            {formatKoreanDate(selectedDate)} · {filledToday} / {equipment?.items.length ?? 0} 항목 · {doneDays}일
            기록
          </span>
        </div>
      </div>

      {!equipment ? (
        <p className="equip-empty">등록된 설비가 없습니다. 설정에서 설비를 추가해 주세요.</p>
      ) : (
        <div className="card month-grid-card">
          <div className="month-grid-head">
            <div>
              <h2>{equipment.name}</h2>
              <p>
                {formatMonthLabel(year, month)} · 수치·분수는 칸에 값을 넣고, 상태 항목은 칸을 눌러 O/X를
                바꿉니다.
              </p>
            </div>
            <div className="month-grid-actions">
              <button className="secondary-btn" type="button" onClick={markDayOk}>
                선택일 전체 정상(O)
              </button>
              <button className="reset-rect" type="button" onClick={resetDay}>
                <RotateCcw size={16} />
                초기화
              </button>
              <button className="save-rect" type="button" onClick={saveNotes}>
                <img src={diskette} alt="" />
                {savedFlash ? '저장됨' : '저장'}
              </button>
            </div>
          </div>

          {needInspector && <p className="grid-hint">점검자를 먼저 선택한 뒤 기록할 수 있습니다.</p>}

          <div className="month-grid-wrap">
            <table className="month-grid">
              <thead>
                <tr>
                  <th className="sticky-meta col-equip">설비명</th>
                  <th className="sticky-meta col-no">NO</th>
                  <th className="sticky-meta col-point">개소</th>
                  <th className="sticky-meta col-timing">시기</th>
                  <th className="sticky-meta col-criteria">기준</th>
                  {days.map((day) => {
                    const date = `${monthPrefix}-${pad2(day)}`
                    const active = date === selectedDate
                    const isToday = date === today
                    return (
                      <th
                        key={day}
                        className={`day-col ${active ? 'col-active' : ''} ${isToday ? 'col-today' : ''}`}
                      >
                        <button type="button" onClick={() => setSelectedDate(date)}>
                          {day}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {equipment.items.map((item, index) => {
                  const key = itemKey(item.no)
                  const kind = resolveInputKind(item)
                  return (
                    <tr key={item.id ?? `${item.no}-${item.point}`}>
                      {index === 0 && (
                        <th className="sticky-meta col-equip" rowSpan={equipment.items.length} scope="row">
                          {equipment.name}
                        </th>
                      )}
                      <td className="sticky-meta col-no">{item.no}</td>
                      <td className="sticky-meta col-point">{item.point}</td>
                      <td className="sticky-meta col-timing">{item.timing}</td>
                      <td className="sticky-meta col-criteria">
                        <CriteriaText text={item.criteria} />
                      </td>
                      {days.map((day) => {
                        const date = `${monthPrefix}-${pad2(day)}`
                        const record = recordsByDate.get(date)
                        const mark = record?.results[key] ?? ''
                        const reading = record?.readings?.[key] ?? ''
                        const fraction = parseFractionParts(reading)
                        const active = date === selectedDate
                        const isToday = date === today
                        return (
                          <td
                            key={day}
                            className={`day-col ${active ? 'col-active' : ''} ${isToday ? 'col-today' : ''}`}
                          >
                            {kind === 'mark' ? (
                              <button
                                className={`grid-mark ${mark === 'O' ? 'on-ok' : ''} ${mark === 'X' ? 'on-x' : ''}`}
                                type="button"
                                aria-label={`${day}일 ${item.point} ${mark || '미입력'}`}
                                onClick={() => toggleCell(day, item.no)}
                              >
                                {mark || ''}
                              </button>
                            ) : kind === 'fraction' ? (
                              <FractionInput
                                num={fraction.num}
                                den={fraction.den}
                                numLabel={`${day}일 ${item.point} 분자`}
                                denLabel={`${day}일 ${item.point} 분모`}
                                onFocusCell={() => setSelectedDate(date)}
                                onNumChange={(value) => saveFraction(day, item, reading, 'num', value)}
                                onDenChange={(value) => saveFraction(day, item, reading, 'den', value)}
                              />
                            ) : (
                              <input
                                className="grid-reading"
                                value={reading}
                                inputMode="decimal"
                                placeholder={readingPlaceholder(item)}
                                aria-label={`${day}일 ${item.point} 수치`}
                                onFocus={() => setSelectedDate(date)}
                                onChange={(event) => saveReading(day, item, event.target.value)}
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="day-note">
            <div className="field">
              <label htmlFor="issueNote">이상 발견 개소 및 조치사항</label>
              <textarea
                id="issueNote"
                rows={2}
                value={issueNote}
                onChange={(event) => setIssueNote(event.target.value)}
                onBlur={() => persistDay(selectedDate, { issueNote, requestDate, confirmDate })}
                placeholder="이상이 있으면 개소와 조치를 적습니다."
              />
            </div>
            <div className="two-col">
              <div className="field">
                <label htmlFor="requestDate">생산 요청일자</label>
                <input
                  id="requestDate"
                  type="date"
                  value={requestDate}
                  onChange={(event) => {
                    setRequestDate(event.target.value)
                    persistDay(selectedDate, { issueNote, requestDate: event.target.value, confirmDate })
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="confirmDate">설비 확인일자</label>
                <input
                  id="confirmDate"
                  type="date"
                  value={confirmDate}
                  onChange={(event) => {
                    setConfirmDate(event.target.value)
                    persistDay(selectedDate, { issueNote, requestDate, confirmDate: event.target.value })
                  }}
                />
              </div>
            </div>
          </div>

          <div className="month-nav">
            <button
              className="secondary-btn"
              type="button"
              onClick={() => {
                const next = addMonths(year, month, -1)
                selectMonth(next.year, next.month)
              }}
            >
              이전 달
            </button>
            <button
              className="secondary-btn"
              type="button"
              onClick={() => {
                const next = addMonths(year, month, 1)
                selectMonth(next.year, next.month)
              }}
            >
              다음 달
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

