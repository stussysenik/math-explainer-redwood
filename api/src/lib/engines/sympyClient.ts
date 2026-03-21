/**
 * SymPy HTTP Client — calls the Python FastAPI sidecar for symbolic computation.
 * Port of MathViz.Engines.SidecarClient (Elixir).
 *
 * The sidecar runs a lightweight FastAPI server that accepts SymPy expressions,
 * evaluates them in a sandboxed Python environment, and returns structured results
 * including LaTeX rendering and normalized expressions.
 *
 * Fallback: if the sidecar is unreachable or returns an error, the pipeline
 * gracefully degrades to its stub response path (see pipeline/index.ts).
 */

import type { SymPyResponse } from '../pipeline/types'

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8100'
const SIDECAR_TIMEOUT_MS = parseInt(process.env.SIDECAR_TIMEOUT_MS || '10000', 10)

let requestCounter = 0

function nextRequestId(): string {
  return `rw_${Date.now()}_${++requestCounter}`
}

/**
 * Execute a SymPy expression via the Python sidecar.
 *
 * @param sympyExecutable - A valid SymPy expression string (e.g. "solve(x**2 - 4, x)")
 * @param opts.timeoutMs  - Override the default HTTP timeout (default: SIDECAR_TIMEOUT_MS)
 * @returns A SymPyResponse with ok=true on success, or ok=false with an error message
 */
export async function execute(
  sympyExecutable: string,
  opts?: { timeoutMs?: number }
): Promise<SymPyResponse> {
  const requestId = nextRequestId()
  const timeoutMs = opts?.timeoutMs ?? SIDECAR_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${SIDECAR_URL}/api/sympy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: requestId,
        sympy_executable: sympyExecutable,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      return {
        requestId,
        ok: false,
        resultString: null,
        resultLatex: null,
        normalizedExpression: null,
        error: `Sidecar returned HTTP ${res.status}: ${text}`,
      }
    }

    const data = await res.json()
    return {
      requestId: data.request_id || requestId,
      ok: data.ok ?? false,
      resultString: data.result_string ?? null,
      resultLatex: data.result_latex ?? null,
      normalizedExpression: data.normalized_expression ?? null,
      error: data.error ?? null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isAbort = err instanceof DOMException && err.name === 'AbortError'
    return {
      requestId,
      ok: false,
      resultString: null,
      resultLatex: null,
      normalizedExpression: null,
      error: isAbort ? `Sidecar timeout after ${timeoutMs}ms` : `Sidecar unavailable: ${message}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Quick liveness probe for the sidecar.
 *
 * @returns true if the sidecar /health endpoint responds 200 within 2 seconds
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${SIDECAR_URL}/health`, { signal: controller.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

export const sympyClient = { execute, healthCheck }
