import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { GripVertical, Plus, Save, Settings, Trash2 } from 'lucide-react'
import { useAppData } from '../context/AppDataContext'
import {
  createCheckItem,
  createEquipment,
  defaultCatalog,
  defaultInspectors,
  withItemIds,
} from '../lib/catalog'
import type { CheckItem, Equipment, InputKind, TimingCode } from '../types'
import { resolveInputKind } from '../lib/inputKind'

export function SettingsPage() {
  const { equipmentList, inspectors, saveCatalog } = useAppData()
  const [draftEquipment, setDraftEquipment] = useState<Equipment[]>(() =>
    withItemIds(JSON.parse(JSON.stringify(equipmentList)) as Equipment[]),
  )
  const [draftInspectors, setDraftInspectors] = useState<string[]>(() => [...inspectors])
  const [selectedId, setSelectedId] = useState(equipmentList[0]?.id ?? '')
  const [newInspector, setNewInspector] = useState('')
  const [saved, setSaved] = useState(false)

  const selected = useMemo(
    () => draftEquipment.find((item) => item.id === selectedId),
    [draftEquipment, selectedId],
  )

  const updateSelected = (patch: Partial<Equipment>) => {
    setDraftEquipment((prev) =>
      prev.map((item) => (item.id === selectedId ? { ...item, ...patch } : item)),
    )
    setSaved(false)
  }

  const updateItem = (index: number, patch: Partial<CheckItem>) => {
    if (!selected) return
    const items = selected.items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    updateSelected({ items })
  }

  const addEquipment = () => {
    const next = createEquipment()
    setDraftEquipment((prev) => [...prev, next])
    setSelectedId(next.id)
    setSaved(false)
  }

  const removeEquipment = (id: string) => {
    setDraftEquipment((prev) => {
      const next = prev.filter((item) => item.id !== id)
      if (selectedId === id) setSelectedId(next[0]?.id ?? '')
      return next
    })
    setSaved(false)
  }

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const pointerStart = useRef({ y: 0, didDrag: false })
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const dragItemIdRef = useRef<string | null>(null)
  const itemPointerStart = useRef({ y: 0, didDrag: false })

  const moveTo = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setDraftEquipment((prev) => {
      const from = prev.findIndex((item) => item.id === fromId)
      const to = prev.findIndex((item) => item.id === toId)
      if (from < 0 || to < 0 || from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      if (!moved) return prev
      next.splice(to, 0, moved)
      return next
    })
    setSaved(false)
  }

  const onRowPointerDown = (event: PointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0) return
    dragIdRef.current = id
    pointerStart.current = { y: event.clientY, didDrag: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onRowPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const fromId = dragIdRef.current
    if (!fromId || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    if (Math.abs(event.clientY - pointerStart.current.y) > 5) {
      pointerStart.current.didDrag = true
      setDraggingId(fromId)
    }
    if (!pointerStart.current.didDrag) return
    const target = document.elementFromPoint(event.clientX, event.clientY)
    const row = target?.closest('[data-equip-id]')
    const toId = row?.getAttribute('data-equip-id')
    if (toId) moveTo(fromId, toId)
  }

  const onRowPointerUp = (event: PointerEvent<HTMLDivElement>, id: string) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!pointerStart.current.didDrag) setSelectedId(id)
    dragIdRef.current = null
    setDraggingId(null)
  }

  const moveItemTo = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setDraftEquipment((prev) =>
      prev.map((eq) => {
        if (eq.id !== selectedId) return eq
        const from = eq.items.findIndex((item) => item.id === fromId)
        const to = eq.items.findIndex((item) => item.id === toId)
        if (from < 0 || to < 0 || from === to) return eq
        const items = [...eq.items]
        const [moved] = items.splice(from, 1)
        if (!moved) return eq
        items.splice(to, 0, moved)
        return { ...eq, items }
      }),
    )
    setSaved(false)
  }

  const onItemPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    dragItemIdRef.current = id
    itemPointerStart.current = { y: event.clientY, didDrag: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onItemPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const fromId = dragItemIdRef.current
    if (!fromId || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    if (Math.abs(event.clientY - itemPointerStart.current.y) > 5) {
      itemPointerStart.current.didDrag = true
      setDraggingItemId(fromId)
    }
    if (!itemPointerStart.current.didDrag) return
    const target = document.elementFromPoint(event.clientX, event.clientY)
    const row = target?.closest('[data-item-id]')
    const toId = row?.getAttribute('data-item-id')
    if (toId) moveItemTo(fromId, toId)
  }

  const onItemPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragItemIdRef.current = null
    setDraggingItemId(null)
  }

  const save = () => {
    saveCatalog(draftEquipment, draftInspectors)
    setSaved(true)
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            <Settings size={24} />
            설정
          </h1>
          <p className="page-desc">
            점검 대상 설비와 점검 항목(NO, 개소, 시기, 기준, 입력 방식), 점검자를 관리합니다. 저장하면
            일상 점검 기록에 바로 반영됩니다.
          </p>
        </div>
        <div className="card-actions">
          <button
            className="secondary-btn"
            type="button"
            onClick={() => {
              const reset = withItemIds(defaultCatalog())
              setDraftEquipment(reset)
              setDraftInspectors(defaultInspectors())
              setSelectedId(reset[0]?.id ?? '')
              setSaved(false)
            }}
          >
            기본값 복원
          </button>
          <button className="primary-btn" type="button" onClick={save}>
            <Save size={16} />
            {saved ? '저장됨' : '저장'}
          </button>
        </div>
      </div>

      <div className="settings-grid">
        <aside className="card settings-nav">
          <div className="equip-section-head">
            <h2>설비</h2>
            <span>{draftEquipment.length}대</span>
          </div>
          <button className="secondary-btn" type="button" onClick={addEquipment}>
            <Plus size={16} />
            추가
          </button>
          <div className="settings-equip-list">
            {draftEquipment.map((item) => (
              <div
                key={item.id}
                data-equip-id={item.id}
                className={`settings-equip-row ${item.id === selectedId ? 'active' : ''} ${item.id === draggingId ? 'dragging' : ''}`}
                onPointerDown={(event) => onRowPointerDown(event, item.id)}
                onPointerMove={onRowPointerMove}
                onPointerUp={(event) => onRowPointerUp(event, item.id)}
                onPointerCancel={(event) => onRowPointerUp(event, item.id)}
              >
                <span className="drag-handle" aria-hidden="true">
                  <GripVertical size={16} />
                </span>
                <div className="settings-equip-item">
                  <strong>{item.name}</strong>
                  <span>항목 {item.items.length}개</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="card settings-editor">
          {!selected ? (
            <p className="equip-empty">왼쪽에서 설비를 선택하거나 추가해 주세요.</p>
          ) : (
            <>
              <div className="equip-section-head">
                <h2>설비 정보</h2>
                <button className="danger-btn" type="button" onClick={() => removeEquipment(selected.id)}>
                  <Trash2 size={14} />
                  설비 삭제
                </button>
              </div>
              <div className="fields">
                <div className="field">
                  <label htmlFor="eq-name">설비명</label>
                  <input
                    id="eq-name"
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="eq-short">약칭</label>
                  <input
                    id="eq-short"
                    value={selected.shortName}
                    onChange={(e) => updateSelected({ shortName: e.target.value })}
                  />
                </div>
              </div>

              <div className="equip-section-head" style={{ marginTop: 8 }}>
                <h2>점검 항목</h2>
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => updateSelected({ items: [...selected.items, createCheckItem(selected.items)] })}
                >
                  <Plus size={16} />
                  항목 추가
                </button>
              </div>
              <div className="table-scroll">
                <table className="check-table settings-table">
                  <thead>
                    <tr>
                      <th>NO</th>
                      <th>개소</th>
                      <th>시기</th>
                      <th>기준</th>
                      <th>입력</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item, index) => {
                      const itemId = item.id ?? `${selected.id}-${index}`
                      return (
                      <tr
                        key={itemId}
                        data-item-id={itemId}
                        className={itemId === draggingItemId ? 'settings-item-row dragging' : 'settings-item-row'}
                      >
                        <td>
                          <input
                            className="table-input no-input"
                            type="number"
                            min={1}
                            value={item.no}
                            onChange={(e) => updateItem(index, { no: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            className="table-input"
                            value={item.point}
                            onChange={(e) => updateItem(index, { point: e.target.value })}
                            placeholder="개소"
                          />
                        </td>
                        <td>
                          <select
                            className="table-input"
                            value={item.timing}
                            onChange={(e) => updateItem(index, { timing: e.target.value as TimingCode })}
                          >
                            <option value="운">운</option>
                            <option value="정">정</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="table-input"
                            value={item.criteria}
                            onChange={(e) => updateItem(index, { criteria: e.target.value })}
                            placeholder="기준"
                          />
                        </td>
                        <td>
                          <select
                            className="table-input"
                            value={resolveInputKind(item)}
                            onChange={(e) => updateItem(index, { inputKind: e.target.value as InputKind })}
                          >
                            <option value="mark">O / X</option>
                            <option value="number">수치</option>
                            <option value="fraction">분수</option>
                          </select>
                        </td>
                        <td>
                          <div className="item-row-actions">
                            <button
                              className="icon-btn item-drag-handle"
                              type="button"
                              aria-label="항목 순서 이동"
                              onPointerDown={(event) => onItemPointerDown(event, itemId)}
                              onPointerMove={onItemPointerMove}
                              onPointerUp={onItemPointerUp}
                              onPointerCancel={onItemPointerUp}
                            >
                              <GripVertical size={16} />
                            </button>
                            <button
                              className="icon-btn danger-icon"
                              type="button"
                              onClick={() =>
                                updateSelected({
                                  items: selected.items.filter((_, i) => i !== index),
                                })
                              }
                              aria-label="항목 삭제"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="equip-section-head">
          <h2>점검자</h2>
          <span>{draftInspectors.length}명</span>
        </div>
        <div className="inspector-edit">
          {draftInspectors.map((name) => (
            <span key={name} className="inspector-chip">
              {name}
              <button
                type="button"
                aria-label={`${name} 삭제`}
                onClick={() => {
                  setDraftInspectors((prev) => prev.filter((item) => item !== name))
                  setSaved(false)
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="inspector-add">
          <div className="field">
            <label htmlFor="new-inspector">점검자 추가</label>
            <input
              id="new-inspector"
              value={newInspector}
              onChange={(e) => setNewInspector(e.target.value)}
              placeholder="이름 입력"
            />
          </div>
          <button
            className="secondary-btn"
            type="button"
            onClick={() => {
              const name = newInspector.trim()
              if (!name || draftInspectors.includes(name)) return
              setDraftInspectors((prev) => [...prev, name])
              setNewInspector('')
              setSaved(false)
            }}
          >
            <Plus size={16} />
            추가
          </button>
        </div>
      </div>
    </section>
  )
}
