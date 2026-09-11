import { useEffect, useRef, useState } from 'react'
import { formatLedgerDate, monthDayDigits } from '../lib/date'

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

export function DateField({
  value,
  year,
  onChange,
  lockSize = false,
}: {
  value: string
  year: number
  onChange: (value: string) => void
  lockSize?: boolean
}) {
  const complete = formatLedgerDate(value, year)
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const display = focused && draft !== null ? draft : complete
  const ref = useAutoHeight(display, !lockSize)

  return (
    <textarea
      ref={ref}
      className="chem-wrap chem-wrap-digit"
      rows={1}
      inputMode="numeric"
      placeholder={focused ? 'MMDD' : ''}
      value={display}
      aria-label={`${year}년 연월일`}
      onFocus={(event) => {
        setFocused(true)
        setDraft(null)
        event.currentTarget.select()
      }}
      onBlur={() => {
        if (draft !== null) {
          const digits = monthDayDigits(draft, year)
          if (digits.length === 4) onChange(formatLedgerDate(digits, year))
          else if (!digits) onChange('')
        }
        setFocused(false)
        setDraft(null)
      }}
      onChange={(event) => {
        const digits = monthDayDigits(event.target.value, year)
        if (digits.length === 4) {
          const next = formatLedgerDate(digits, year)
          setDraft(next)
          onChange(next)
          return
        }
        setDraft(digits.length <= 2 ? digits : `${digits.slice(0, 2)}-${digits.slice(2)}`)
        if (!digits) onChange('')
      }}
    />
  )
}
