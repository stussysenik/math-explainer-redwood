import { useState, useCallback, useRef } from 'react'

import type { SolveResultData } from 'src/types/solve'

/**
 * Describes a single gate event in the solve pipeline.
 *
 * The backend returns an array of these representing each stage the query
 * passed through (input validation, routing, SymPy execution, verification,
 * graph building). The hook animates through them sequentially so the UI
 * can show real-time progress.
 */
export interface GateEvent {
  gate: string
  status: 'pass' | 'fail' | 'skip'
  data: Record<string, unknown>
  timestamp: number
}

interface SolveStreamState {
  status: 'idle' | 'streaming' | 'complete' | 'error'
  gates: GateEvent[]
  result: SolveResultData | null
  error: string | null
  currentGate: string | null
}

/**
 * useSolveStream — client-side hook for the streaming solve endpoint.
 *
 * Instead of using GraphQL, this calls `POST /.redwood/functions/solveStream`
 * directly and animates through the pipeline gates with small delays so
 * the user sees real-time progress feedback.
 *
 * Usage:
 *   const { status, gates, result, error, currentGate, solve, reset } = useSolveStream()
 *   await solve('integrate x^2 dx')
 */
export function useSolveStream() {
  const [state, setState] = useState<SolveStreamState>({
    status: 'idle',
    gates: [],
    result: null,
    error: null,
    currentGate: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const solve = useCallback(
    async (
      query: string,
      image?: { base64: string; mime: string; filename: string }
    ) => {
      // Abort any in-flight request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState({
        status: 'streaming',
        gates: [],
        result: null,
        error: null,
        currentGate: 'input',
      })

      try {
        const res = await fetch('/.redwood/functions/solveStream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            imageBase64: image?.base64,
            imageMime: image?.mime,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const text = await res.text()
          setState((s) => ({
            ...s,
            status: 'error',
            error: `Server error: ${res.status} ${text}`,
          }))
          return
        }

        const data = await res.json()

        // Animate gates sequentially with small delays for visual feedback
        const gates: GateEvent[] = data.gates || []
        for (let i = 0; i < gates.length; i++) {
          if (controller.signal.aborted) return
          await new Promise((r) => setTimeout(r, 150))
          setState((s) => ({
            ...s,
            gates: gates.slice(0, i + 1),
            currentGate: gates[i].gate,
          }))
        }

        // Set final result
        setState((s) => ({
          ...s,
          status: 'complete',
          result: data.result,
          currentGate: null,
        }))
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setState((s) => ({
          ...s,
          status: 'error',
          error: (err as Error).message,
        }))
      }
    },
    []
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({
      status: 'idle',
      gates: [],
      result: null,
      error: null,
      currentGate: null,
    })
  }, [])

  return { ...state, solve, reset }
}
