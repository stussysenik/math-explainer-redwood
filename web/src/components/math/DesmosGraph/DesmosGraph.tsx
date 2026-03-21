import { useRef, useEffect, useCallback } from 'react'

import useExternalScript from 'src/hooks/useExternalScript'
import type { DesmosPayload } from 'src/types/solve'

// ---------------------------------------------------------------------------
// Desmos type declarations
// ---------------------------------------------------------------------------
interface DesmosExpression {
  id: string
  latex: string
}

interface DesmosCalculator {
  setBlank: () => void
  setMathBounds: (bounds: {
    left: number
    right: number
    bottom: number
    top: number
  }) => void
  setExpression: (expr: DesmosExpression) => void
  destroy: () => void
}

interface DesmosCalculatorOptions {
  expressions?: boolean
  settingsMenu?: boolean
  zoomButtons?: boolean
  expressionsTopbar?: boolean
}

interface DesmosStatic {
  GraphingCalculator: (
    el: HTMLElement,
    opts?: DesmosCalculatorOptions
  ) => DesmosCalculator
}

declare global {
  interface Window {
    Desmos?: DesmosStatic
  }
}

// ---------------------------------------------------------------------------
// Resolve the API key
// ---------------------------------------------------------------------------
const FALLBACK_KEY = 'dcb31709b452b1cf9dc26972add0fda6'

function getDesmosApiKey(): string {
  // Redwood injects env vars that are listed in redwood.toml
  // includeEnvironmentVariables as process.env.* at build time.
  if (typeof process !== 'undefined' && process.env.DESMOS_API_KEY) {
    return process.env.DESMOS_API_KEY
  }
  return FALLBACK_KEY
}

const DESMOS_SCRIPT_URL = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${getDesmosApiKey()}`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface Props {
  config: DesmosPayload | null
}

/**
 * Renders a Desmos graphing calculator.
 *
 * Ported from the Phoenix LiveView DesmosHook. The component dynamically loads
 * the Desmos API script, creates a GraphingCalculator instance, and keeps it
 * in sync with the `config` prop (expressions + viewport).
 */
const DesmosGraph = ({ config }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const calcRef = useRef<DesmosCalculator | null>(null)
  const { loaded, error } = useExternalScript(DESMOS_SCRIPT_URL)

  // Initialise the calculator once the script is ready
  const getOrCreateCalculator = useCallback((): DesmosCalculator | null => {
    if (!window.Desmos || !containerRef.current) return null
    if (calcRef.current) return calcRef.current

    const calc = window.Desmos.GraphingCalculator(containerRef.current, {
      expressions: true,
      settingsMenu: false,
      zoomButtons: true,
      expressionsTopbar: false,
    })
    calcRef.current = calc
    return calc
  }, [])

  // Sync expressions + viewport whenever config or loaded state changes
  useEffect(() => {
    if (!loaded) return
    const calculator = getOrCreateCalculator()
    if (!calculator) return

    const expressions = config?.expressions ?? []
    if (expressions.length === 0) {
      calculator.setBlank()
      return
    }

    const viewport = config?.viewport ?? {}
    calculator.setBlank()
    calculator.setMathBounds({
      left: viewport.xmin ?? -10,
      right: viewport.xmax ?? 10,
      bottom: viewport.ymin ?? -10,
      top: viewport.ymax ?? 10,
    })

    expressions.forEach((expr, index) => {
      calculator.setExpression({
        id: expr.id || `expr-${index}`,
        latex: expr.latex,
      })
    })
  }, [loaded, config, getOrCreateCalculator])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (calcRef.current) {
        calcRef.current.destroy()
        calcRef.current = null
      }
    }
  }, [])

  // Loading / error states
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-stone-50 text-sm text-stone-400">
        Failed to load Desmos
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="h-full w-full animate-pulse bg-stone-100" aria-label="Loading Desmos graph" />
    )
  }

  return <div ref={containerRef} className="h-full w-full" data-testid="desmos-graph" />
}

export default DesmosGraph
