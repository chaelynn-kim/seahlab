import { Maximize2, Minimize2 } from 'lucide-react'

export function ComposeModeButton({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      className={`chem-doc-btn${active ? ' is-on' : ''}`}
      type="button"
      onClick={onToggle}
    >
      {active ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      {active ? '작성 모드 종료' : '작성 모드'}
    </button>
  )
}
