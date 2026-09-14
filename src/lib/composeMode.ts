import { useEffect, useState } from 'react'

async function enterFullscreen() {
  if (document.fullscreenElement) return
  try {
    await document.documentElement.requestFullscreen()
  } catch {
    /* browser may deny; CSS compose layout still applies */
  }
}

async function leaveFullscreen() {
  if (!document.fullscreenElement) return
  try {
    await document.exitFullscreen()
  } catch {
    /* already left or unsupported */
  }
}

export function useComposeMode() {
  const [compose, setCompose] = useState(false)

  useEffect(() => {
    if (!compose) {
      void leaveFullscreen()
      return
    }

    void enterFullscreen()

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

    const onFullscreen = () => {
      if (!document.fullscreenElement) setCompose(false)
    }

    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
  }, [compose])

  return {
    compose,
    toggleCompose: () => setCompose((value) => !value),
  }
}
