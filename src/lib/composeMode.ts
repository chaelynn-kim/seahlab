import { useEffect, useState } from 'react'

export function useComposeMode() {
  const [compose, setCompose] = useState(false)

  useEffect(() => {
    if (!compose) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          target.blur()
          return
        }
      }
      setCompose(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compose])

  return {
    compose,
    toggleCompose: () => setCompose((value) => !value),
  }
}
