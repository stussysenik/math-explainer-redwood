import { useRef, useEffect, useMemo } from 'react'

import useExternalScript from 'src/hooks/useExternalScript'
import type { GeoGebraPayload } from 'src/types/solve'

// ---------------------------------------------------------------------------
// GeoGebra type declarations
// ---------------------------------------------------------------------------
interface GGBAppletInstance {
  inject: (el: HTMLElement) => void
  getAppletObject: () => GGBApi | undefined
}

interface GGBApi {
  evalCommand: (cmd: string) => void
}

interface GGBAppletConstructor {
  new (
    params: Record<string, unknown>,
    html5?: boolean
  ): GGBAppletInstance
}

declare global {
  interface Window {
    GGBApplet?: GGBAppletConstructor
  }
}

const GEOGEBRA_SCRIPT_URL = 'https://www.geogebra.org/apps/deployggb.js'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface Props {
  config: GeoGebraPayload | null
}

/**
 * Renders a GeoGebra graphing applet.
 *
 * Ported from the Phoenix LiveView GeoGebraHook. Dynamically loads the
 * GeoGebra deploy script, creates an applet, and evaluates the command
 * string from the backend.
 *
 * Uses key-based remounting: parent should pass a `key` that changes
 * when config changes so the component fully remounts.
 */
const GeoGebraGraph = ({ config }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { loaded, error } = useExternalScript(GEOGEBRA_SCRIPT_URL)

  // Stable serialisation of config for the effect dependency
  const configKey = useMemo(
    () => (config ? `${config.command}::${config.expression}` : ''),
    [config]
  )

  useEffect(() => {
    if (!loaded || !config?.command || !window.GGBApplet || !containerRef.current) {
      return
    }

    const container = containerRef.current

    // Create a fresh mount point inside the container
    const mount = document.createElement('div')
    mount.className = 'h-full w-full'
    container.replaceChildren(mount)

    const applet = new window.GGBApplet(
      {
        appName: 'graphing',
        width: container.clientWidth || 640,
        height: container.clientHeight || 352,
        showToolBar: false,
        showMenuBar: false,
        showAlgebraInput: false,
        enableShiftDragZoom: true,
      },
      true
    )

    applet.inject(mount)

    // GeoGebra needs a brief delay after injection before the API is ready
    const timer = window.setTimeout(() => {
      try {
        const api = applet.getAppletObject?.()
        if (api && config.command) {
          api.evalCommand(config.command)
        }
      } catch {
        // Swallow — the graph simply won't render the command
      }
    }, 400)

    return () => {
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, configKey])

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-stone-50 text-sm text-stone-400">
        Failed to load GeoGebra
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="h-full w-full animate-pulse bg-stone-100" aria-label="Loading GeoGebra graph" />
    )
  }

  if (!config?.command) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-stone-50 text-sm text-stone-300">
        No GeoGebra data
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full" data-testid="geogebra-graph" />
}

export default GeoGebraGraph
