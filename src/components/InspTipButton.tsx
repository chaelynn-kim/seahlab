import { useEffect, useRef, useState } from 'react'
import { Lightbulb } from 'lucide-react'

export function InspTipButton() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="insp-tip" ref={wrapRef}>
      <button
        className={`chem-doc-btn insp-tip-btn${open ? ' is-on' : ''}`}
        type="button"
        aria-expanded={open}
        aria-controls="insp-tip-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Lightbulb size={14} />
        작성 TIP
      </button>
      {open ? (
        <div className="insp-tip-panel" id="insp-tip-panel" role="note">
          <p className="insp-tip-title">일상 점검 작성법</p>
          <ul>
            <li className="insp-tip-cycle">
              * 1번 클릭 : <b className="insp-tip-ok">정상(O)</b> → 2번 클릭 : <b className="insp-tip-bad">이상(X)</b> →{' '}
              3번 클릭 : <b className="insp-tip-off">휴무(휴)</b>
            </li>
            <li>
              * 기준의 빨간색 표시 항목은 <b>수치 입력</b>
            </li>
            <li>
              * 작성 후 <b>저장</b> 필수
            </li>
          </ul>
          <p className="insp-tip-title">날짜 선택</p>
          <ul>
            <li>* 클릭 : 날짜 1개 선택</li>
            <li>* 드래그 : 연속 날짜 선택</li>
            <li>* Shift+클릭 : 구간 선택</li>
            <li>* Ctrl+클릭 : 날짜 개별 선택/해제</li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}
