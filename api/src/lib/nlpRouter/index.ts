/**
 * NLP Router Factory — MathViz Redwood
 *
 * Reads the `MATH_VIZ_NLP_MODE` environment variable (or auto-detects based
 * on which API keys are present) and returns the appropriate NLP router with
 * automatic fallback to the stub router on error.
 *
 * Port of MathViz.RuntimeEnv.nlp_mode/1 auto-detection logic (Elixir).
 *
 * Mode mapping:
 *   "stub"            → stubRouter
 *   "nim"             → nimRouter
 *   "dual"            → nimRouter with stub fallback on error
 *   "anthropic"       → anthropicRouter
 *   "anthropic_dual"  → anthropicRouter with stub fallback on error
 *   auto-detect       → checks for API keys, picks the best available
 */

import { logger } from 'src/lib/logger'

import type { MathQuery, NlpRouter } from '../pipeline/types'
import { anthropicRouter } from './anthropic'
import { nimRouter } from './nim'
import { stubRouter } from './stub'

// ─── Mode Detection ───────────────────────────────────────────────────────

type NlpMode = 'stub' | 'nim' | 'dual' | 'anthropic' | 'anthropic_dual'

/**
 * Determine the NLP mode from the environment.
 *
 * Priority:
 *   1. Explicit `MATH_VIZ_NLP_MODE` value
 *   2. Auto-detect: ANTHROPIC_API_KEY → anthropic_dual, NIM key → dual, else stub
 */
function detectMode(): NlpMode {
  const explicit = process.env.MATH_VIZ_NLP_MODE

  switch (explicit) {
    case 'nim':
      return 'nim'
    case 'dual':
      return 'dual'
    case 'stub':
      return 'stub'
    case 'anthropic':
      return 'anthropic'
    case 'anthropic_dual':
      return 'anthropic_dual'
    default:
      break
  }

  // Auto-detect based on available API keys
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic_dual'
  if (process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY) return 'dual'
  return 'stub'
}

// ─── Router Wrappers ──────────────────────────────────────────────────────

/**
 * Wrap a primary router with a fallback router.
 *
 * If the primary router returns `{ ok: false }`, the fallback is tried
 * instead. This gives us graceful degradation: e.g. if NIM is down, we
 * still get a usable (if less capable) stub response.
 */
function withFallback(
  primary: NlpRouter,
  fallback: NlpRouter,
  primaryName: string
): NlpRouter {
  return {
    async toContract(query: MathQuery, opts?: Record<string, unknown>) {
      const result = await primary.toContract(query, opts)

      if (result.ok === true) return result

      logger.warn(
        { error: result.error, mode: primaryName },
        `${primaryName} router failed, falling back to stub`
      )

      return fallback.toContract(query, opts)
    },
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────

/**
 * Build and return the NLP router for the current environment.
 *
 * Called once per request (routers are stateless, so there is no cost to
 * re-reading env vars). In production you would typically call this at
 * server start and cache the result.
 */
export function getRouter(): NlpRouter {
  const mode = detectMode()

  logger.debug({ mode }, 'NLP router mode')

  switch (mode) {
    case 'nim':
      return nimRouter

    case 'dual':
      return withFallback(nimRouter, stubRouter, 'nim')

    case 'anthropic':
      return anthropicRouter

    case 'anthropic_dual':
      return withFallback(anthropicRouter, stubRouter, 'anthropic')

    case 'stub':
    default:
      return stubRouter
  }
}
