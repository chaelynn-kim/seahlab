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
        TIP
      </button>
      {open ? (
        <div className="insp-tip-panel" id="insp-tip-panel" role="note">
          <p className="insp-tip-title">일상 점검 사용법</p>
          <ul>
            <li>
              칸 클릭 <b className="insp-tip-ok">1번 O</b> → <b className="insp-tip-bad">2번 X</b> →{' '}
              <b className="insp-tip-off">3번 휴</b>
            </li>
            <li>
              기준의 <b className="insp-tip-num">빨간 숫자</b>는 수치 입력
            </li>
            <li>빈 칸의 회색 psi · ℃ · g 는 단위 안내</li>
            <li>기록 전 상단에서 점검자를 먼저 선택</li>
            <li>노란 줄에서 해당 일의 이상 유무 확인</li>
            <li>
              끝나면 <b>저장</b>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}
