import { useState, useEffect } from 'react'

/**
 * Module-level cache of script load promises.
 * Each unique URL gets exactly one <script> tag, no matter how many
 * components request it. The Promise resolves once the script fires
 * its "load" event and rejects on "error".
 */
const scriptCache = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  const cached = scriptCache.get(src)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    // Check if already in the DOM (e.g. added by a previous page load)
    const existing = document.querySelector(
      `script[src="${CSS.escape(src)}"]`
    ) as HTMLScriptElement | null

    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve()
      } else {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener(
          'error',
          () => reject(new Error(`Failed to load script: ${src}`)),
          { once: true }
        )
      }
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.defer = true
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true'
        resolve()
      },
      { once: true }
    )
    script.addEventListener(
      'error',
      () => reject(new Error(`Failed to load script: ${src}`)),
      { once: true }
    )
    document.head.appendChild(script)
  })

  scriptCache.set(src, promise)
  return promise
}

interface ScriptState {
  loaded: boolean
  error: boolean
}

/**
 * React hook that dynamically loads an external <script> tag.
 *
 * Uses a module-level Map to guarantee each URL is fetched at most once,
 * even across multiple components and re-renders.
 *
 * @param src - Full URL of the script to load
 * @returns `{ loaded, error }` booleans
 */
export default function useExternalScript(src: string): ScriptState {
  const [state, setState] = useState<ScriptState>({ loaded: false, error: false })

  useEffect(() => {
    if (!src) {
      setState({ loaded: false, error: true })
      return
    }

    // If this exact script already loaded synchronously (cache hit from a
    // previous mount), the .then fires on the next microtick.
    let cancelled = false

    loadScript(src)
      .then(() => {
        if (!cancelled) setState({ loaded: true, error: false })
      })
      .catch(() => {
        if (!cancelled) setState({ loaded: false, error: true })
      })

    return () => {
      cancelled = true
    }
  }, [src])

  return state
}
