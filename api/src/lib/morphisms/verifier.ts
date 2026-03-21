/**
 * Mock Verifier — MathViz Redwood
 *
 * Simulates a proof verification step in the pipeline. In production this
 * would delegate to a real proof assistant (Lean, Coq, etc). The mock
 * accepts all expressions unless they contain the word "reject".
 *
 * Port of the Elixir Morphisms.Verifier module.
 */

import type { Proof, Symbol } from '../pipeline/types'

export interface VerifierOptions {
  /** Simulated verification delay in ms. Default 100 for dev, 1000 for prod-like. */
  delayMs?: number
}

/**
 * Verify a symbolic computation result.
 *
 * The mock verifier accepts everything unless the expression contains "reject".
 * A configurable delay simulates real verification latency.
 */
export async function verify(
  symbol: Symbol,
  opts: VerifierOptions = {}
): Promise<Proof> {
  const delayMs = opts.delayMs ?? 100

  const start = Date.now()

  // Simulate verification work
  await new Promise((resolve) => setTimeout(resolve, delayMs))

  const shouldReject = symbol.expression.toLowerCase().includes('reject')

  const durationMs = Date.now() - start

  if (shouldReject) {
    return {
      verified: false,
      state: 'Verification rejected',
      summary: `Expression "${symbol.expression}" was rejected by the verifier.`,
      durationMs,
    }
  }

  return {
    verified: true,
    state: 'Proof complete',
    summary: `Verified: ${symbol.statement}`,
    durationMs,
  }
}
