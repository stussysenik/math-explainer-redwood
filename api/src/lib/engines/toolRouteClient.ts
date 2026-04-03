import { ToolRoutePlanSchema } from '../pipeline/schemas'
import type { ToolRoutePlan } from '../pipeline/types'

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8100'
const SIDECAR_TIMEOUT_MS = parseInt(process.env.SIDECAR_TIMEOUT_MS || '10000', 10)

export async function classify(
  query: string,
  context?: Record<string, unknown>,
  opts?: { timeoutMs?: number }
): Promise<
  | { ok: true; plan: ToolRoutePlan }
  | { ok: false; error: string }
> {
  const timeoutMs = opts?.timeoutMs ?? SIDECAR_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${SIDECAR_URL}/api/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context: context ?? {} }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '<unreadable>')
      return { ok: false, error: `Sidecar returned HTTP ${res.status}: ${text}` }
    }

    const raw = (await res.json()) as unknown
    const parsed = ToolRoutePlanSchema.safeParse(raw)
    if (!parsed.success) {
      const error = parsed.error.issues.map((issue) => issue.message).join('; ')
      return { ok: false, error: `Invalid tool route response: ${error}` }
    }

    return { ok: true, plan: parsed.data as ToolRoutePlan }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isAbort = err instanceof DOMException && err.name === 'AbortError'
    return {
      ok: false,
      error: isAbort
        ? `Sidecar timeout after ${timeoutMs}ms`
        : `Sidecar unavailable: ${message}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

export const toolRouteClient = { classify }
