import { useEffect, useRef } from 'react'

function useAutoHeight(value: string, enabled: boolean) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!enabled) {
      el.style.height = ''
      return
    }

    const resize = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [value, enabled])

  return ref
}

export function QtyField({
  value,
  unit,
  onChange,
  lockSize = false,
}: {
  value: string
  unit: string
  onChange: (value: string) => void
  lockSize?: boolean
}) {
  const ref = useAutoHeight(value, !lockSize)
  const filled = value.trim().length > 0

  return (
    <span
      className={`chem-qty ${filled ? 'has-qty' : 'empty-qty'}`}
      onClick={() => ref.current?.focus()}
    >
      <textarea
        ref={ref}
        className="chem-wrap chem-wrap-digit"
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <em>{unit}</em>
    </span>
  )
}

export function WrapField({
  value,
  onChange,
  variant = 'keep',
  lockSize = false,
}: {
  value: string
  onChange: (value: string) => void
  variant?: 'keep' | 'digit'
  lockSize?: boolean
}) {
  const ref = useAutoHeight(value, !lockSize)

  return (
    <textarea
      ref={ref}
      className={`chem-wrap chem-wrap-${variant}`}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
