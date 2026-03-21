/**
 * Graph Builder — MathViz Redwood
 *
 * Builds renderable graph payloads (Desmos, GeoGebra, LaTeX block) from
 * a verified Symbol + Proof pair. Port of the Elixir Morphisms.GraphBuilder.
 *
 * If the proof is not verified, returns an error graph with null payloads.
 */

import type {
  DesmosExpression,
  DesmosPayload,
  GeoGebraPayload,
  Graph,
  Proof,
  Symbol,
} from '../pipeline/types'

/** Default viewport: centered at origin, ±10 on both axes. */
const DEFAULT_VIEWPORT = { xmin: -10, xmax: 10, ymin: -10, ymax: 10 }

/**
 * Build a Graph from a Symbol and its Proof.
 *
 * For verified proofs, constructs Desmos expressions (from raw metadata or
 * fallback to the symbol's graphExpression), a GeoGebra command, and a
 * LaTeX display block.
 *
 * For unverified proofs, returns null payloads with an error LaTeX block.
 */
export function buildGraph(symbol: Symbol, proof: Proof): Graph {
  if (!proof.verified) {
    return {
      desmos: null,
      geogebra: null,
      latexBlock: `\\text{Verification failed: ${proof.state}}`,
    }
  }

  // ─── Desmos ────────────────────────────────────────────────────────
  const rawDesmosExprs = symbol.raw
    ?.verified_desmos_expressions as DesmosExpression[] | undefined

  let desmosExpressions: DesmosExpression[]
  if (Array.isArray(rawDesmosExprs) && rawDesmosExprs.length > 0) {
    // Use pre-built expressions from the AI response
    desmosExpressions = rawDesmosExprs
  } else {
    // Fallback: use the symbol's graph expression
    const latex = symbol.graphExpression || symbol.latex || symbol.expression
    const desmosLatex = ensureRelation(latex)
    desmosExpressions = [{ id: 'expr_1', latex: desmosLatex }]
  }

  const desmos: DesmosPayload = {
    expressions: desmosExpressions,
    viewport: DEFAULT_VIEWPORT,
  }

  // ─── GeoGebra ─────────────────────────────────────────────────────
  const geogebra: GeoGebraPayload = {
    command: `f(x)=${symbol.expression}`,
    expression: symbol.expression,
  }

  // ─── LaTeX Block ──────────────────────────────────────────────────
  const latexBlock = symbol.latex
    ? `\\displaystyle ${symbol.latex}`
    : null

  return { desmos, geogebra, latexBlock }
}

/**
 * Ensure an expression has a "y=" prefix so Desmos renders it as a graph.
 * If the expression already contains "=" it is returned as-is.
 */
function ensureRelation(expr: string): string {
  if (expr.includes('=')) {
    return expr
  }
  return `y=${expr}`
}
