/**
 * Pipeline Orchestrator — MathViz Redwood
 *
 * The main entry point that chains the NLP router, SymPy sidecar (with stub
 * fallback), verifier, and graph builder into a single computation pipeline.
 *
 * Port of the Elixir Pipeline.run/2.
 *
 * Flow (now with Zod-validated gates at each stage boundary):
 *   1. Gate 1 — Input:   Validate raw query text via SolveInputSchema
 *   2. Gate 2 — Routing: Route through NLP, validate AIResponse via AIResponseSchema
 *   3. Gate 3 — SymPy:   Execute SymPy, validate via SymPyResponseSchema
 *   4. Gate 4 — Symbol:  Build Symbol, validate via SymbolSchema
 *   5. Gate 5 — Verify:  Run verifier
 *   6. Gate 6 — Graph:   Build graph, validate Desmos payload via DesmosPayloadSchema
 *   7. Return complete PipelineResult with gate events
 *
 * Educational notes:
 *   - Each gate uses Zod `safeParse()` for non-throwing validation.
 *   - On gate failure the pipeline either degrades gracefully (fallback)
 *     or returns an error result — it never throws.
 *   - The `notify` callback emits gate events that the SSE endpoint
 *     collects for real-time client feedback.
 */

import { logger } from 'src/lib/logger'

import { sympyClient } from '../engines/sympyClient'
import { toolRouteClient } from '../engines/toolRouteClient'
import { buildGraph } from '../morphisms/graphBuilder'
import { verify } from '../morphisms/verifier'
import { getRouter } from '../nlpRouter'

import { buildSymbol } from './contracts'
import {
  AIResponseSchema,
  DesmosPayloadSchema,
  SolveInputSchema,
  SymbolSchema,
  SymPyResponseSchema,
} from './schemas'
import type {
  AIResponse,
  DisplayHints,
  EngineResultRecord,
  Graph,
  MathQuery,
  NlpRouter,
  PipelineResult,
  SymPyResponse,
  ToolRoutePlan,
} from './types'

// ─── Sidecar Config ───────────────────────────────────────────────────────

/** Set SIDECAR_ENABLED=false to skip the Python sidecar entirely. */
const SIDECAR_ENABLED = process.env.SIDECAR_ENABLED !== 'false'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PipelineOptions {
  /** Which NLP router to use. Defaults to stub. */
  router?: NlpRouter
  /** Verifier delay in ms. */
  verifyDelayMs?: number
  /**
   * Callback for stage notifications (for real-time updates / SSE).
   * Signature: (event: string, data: Record<string, unknown>) => void
   */
  notify?: (event: string, data: Record<string, unknown>) => void
  /** Vision data for image-based queries. */
  vision?: { base64: string; mime: string }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Generate a simple unique ID. */
function generateId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Build a MathQuery from raw text. */
function buildQuery(text: string): MathQuery {
  return {
    text: text.trim(),
    id: generateId(),
    metadata: {},
  }
}

function plannerContext(
  query: MathQuery,
  vision?: { base64: string; mime: string }
): Record<string, unknown> {
  return {
    hasVision: Boolean(vision),
    inputMode: vision ? 'image+text' : 'text',
    strict_verification: true,
    preferred_engine: 'sympy',
    queryLength: query.text.length,
  }
}

/** Create a stub SymPy response from the AI response (Phase 1 only). */
function stubSympyResponse(
  requestId: string,
  expression: string | null,
  latex: string | null
): SymPyResponse {
  return {
    requestId,
    ok: true,
    resultString: expression,
    resultLatex: latex,
    normalizedExpression: expression,
    error: null,
  }
}

/** Build an empty graph. */
function emptyGraph(): Graph {
  return { desmos: null, geogebra: null, latexBlock: null }
}

/** Notification callback type alias for readability. */
type NotifyFn = (event: string, data: Record<string, unknown>) => void

/**
 * Verify each SymPy step-verification expression via the sidecar.
 *
 * Each expression in stepVerifications should evaluate to True when
 * executed by SymPy if the corresponding reasoning step is correct.
 * Non-blocking: returns empty results if the sidecar is down.
 */
async function verifySteps(
  stepVerifications: string[] | undefined,
  notify: NotifyFn
): Promise<Array<{ step: number; verified: boolean; sympyExpression: string; sympyResult: string | null }>> {
  if (!stepVerifications || stepVerifications.length === 0) return []

  const results: Array<{ step: number; verified: boolean; sympyExpression: string; sympyResult: string | null }> = []
  for (let i = 0; i < stepVerifications.length; i++) {
    const expr = stepVerifications[i]
    try {
      const response = await sympyClient.execute(expr)
      results.push({
        step: i,
        verified: response.ok && response.resultString?.trim() === 'True',
        sympyExpression: expr,
        sympyResult: response.resultString,
      })
    } catch {
      results.push({
        step: i,
        verified: false,
        sympyExpression: expr,
        sympyResult: null,
      })
    }
  }

  const verifiedCount = results.filter((r) => r.verified).length
  notify('step_verification', {
    total: results.length,
    verified: verifiedCount,
    results: results as unknown as Record<string, unknown>[],
  })

  return results
}

/**
 * Execute the SymPy computation step.
 *
 * Attempts the real sidecar when SIDECAR_ENABLED is true and the AI response
 * contains a sympyExecutable expression. Falls back to the inline stub on any
 * sidecar error or when the sidecar is disabled.
 */
async function executeSympyStep(
  requestId: string,
  aiResponse: AIResponse
): Promise<{ sympyResponse: SymPyResponse; sympyMs: number; usedSidecar: boolean }> {
  const startMs = Date.now()

  if (SIDECAR_ENABLED && aiResponse.sympyExecutable) {
    try {
      const response = await sympyClient.execute(aiResponse.sympyExecutable)
      const sympyMs = Date.now() - startMs
      if (response.ok) {
        return { sympyResponse: response, sympyMs, usedSidecar: true }
      }
      // Sidecar returned error — fall back to stub
      logger.warn({ error: response.error }, 'SymPy sidecar error, falling back to stub')
    } catch (err) {
      logger.warn({ err }, 'SymPy sidecar unreachable, falling back to stub')
    }
  }

  // Stub fallback
  const sympyMs = Date.now() - startMs
  return {
    sympyResponse: stubSympyResponse(
      requestId,
      aiResponse.sympyExecutable,
      aiResponse.rawLatex
    ),
    sympyMs,
    usedSidecar: false,
  }
}

async function runToolPlanner(
  query: MathQuery,
  notify: NotifyFn,
  vision?: { base64: string; mime: string }
): Promise<{ toolRoute?: ToolRoutePlan; engineResult?: EngineResultRecord }> {
  if (!SIDECAR_ENABLED) {
    emitGate(notify, 'planner', 'skip', { reason: 'sidecar disabled' })
    return {}
  }

  const startMs = Date.now()
  const routeResult = await toolRouteClient.classify(
    query.text,
    plannerContext(query, vision)
  )
  const durationMs = Date.now() - startMs

  if (routeResult.ok === false) {
    emitGate(notify, 'planner', 'fail', { error: routeResult.error })
    return {
      engineResult: {
        engineName: 'tool_router',
        status: routeResult.error.includes('timeout') ? 'timeout' : 'error',
        result: { error: routeResult.error },
        durationMs,
      },
    }
  }

  emitGate(notify, 'planner', 'pass', {
    backend: routeResult.plan.backend,
    tools: routeResult.plan.tools,
    confidence: routeResult.plan.confidence,
  })

  return {
    toolRoute: routeResult.plan,
    engineResult: {
      engineName: 'tool_router',
      status: 'success',
      result: routeResult.plan as unknown as Record<string, unknown>,
      durationMs,
    },
  }
}

/**
 * Emit a gate event via the notify callback.
 *
 * @param notify - The callback (may be a no-op)
 * @param gate   - Gate name (e.g. "input", "routing", "sympy", "symbol", "graph")
 * @param status - "pass" | "fail" | "skip"
 * @param data   - Arbitrary metadata for the event
 */
function emitGate(
  notify: (event: string, data: Record<string, unknown>) => void,
  gate: string,
  status: 'pass' | 'fail' | 'skip',
  data: Record<string, unknown> = {}
): void {
  notify(`gate:${gate}`, { gate, status, data, timestamp: Date.now() })
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

/**
 * Run the full computation pipeline.
 *
 * @param queryText  - The raw user query string
 * @param opts       - Pipeline configuration options
 * @returns A complete PipelineResult
 */
export async function runPipeline(
  queryText: string,
  opts: PipelineOptions = {}
): Promise<PipelineResult> {
  const router = opts.router ?? getRouter()
  const notify = opts.notify ?? (() => {})

  const timings = { nlpMs: 0, sympyMs: 0, verifyMs: 0, graphMs: 0 }
  const engineResults: EngineResultRecord[] = []

  // ─── Gate 1: Validate Input ───────────────────────────────────────
  const inputResult = SolveInputSchema.safeParse({
    query: queryText,
    imageBase64: opts.vision?.base64,
    imageMime: opts.vision?.mime,
  })

  if (!inputResult.success) {
    const errorMsg = inputResult.error.issues.map((i) => i.message).join('; ')
    logger.error({ error: errorMsg }, 'Gate 1 (input) validation failed')
    emitGate(notify, 'input', 'fail', { error: errorMsg })
    return {
      query: null,
      symbol: null,
      proof: null,
      graph: emptyGraph(),
      isVerified: false,
      mode: 'chat',
      chatReply: null,
      chatSteps: [],
      status: 'error',
      timings,
      adapter: 'stub',
      usedSidecar: false,
      error: `Input validation failed: ${errorMsg}`,
      engineResults,
    }
  }

  emitGate(notify, 'input', 'pass', { query: inputResult.data.query })

  // ─── Stage 1: Build Query ──────────────────────────────────────────
  const query = buildQuery(inputResult.data.query)
  notify('query', { queryId: query.id })

  // ─── Stage 1b: Tool Planner / Provenance ───────────────────────────
  const planner = await runToolPlanner(query, notify, opts.vision)
  if (planner.engineResult) {
    engineResults.push(planner.engineResult)
  }

  // ─── Gate 2: NLP Routing ──────────────────────────────────────────
  notify('computing', {})
  const nlpStart = Date.now()

  const routeResult = await router.toContract(query, opts.vision ? { vision: opts.vision } : undefined)

  timings.nlpMs = Date.now() - nlpStart

  if (routeResult.ok === false) {
    logger.error({ error: routeResult.error }, 'NLP routing failed')
    emitGate(notify, 'routing', 'fail', { error: routeResult.error })
    return {
      query,
      symbol: null,
      proof: null,
      graph: emptyGraph(),
      isVerified: false,
      mode: 'chat',
      chatReply: null,
      chatSteps: [],
      status: 'error',
      timings,
      adapter: 'stub',
      usedSidecar: false,
      error: routeResult.error,
      toolRoute: planner.toolRoute,
      engineResults,
    }
  }

  const { response: aiResponse, adapter } = routeResult
  const adapterType = adapter as 'stub' | 'nim' | 'anthropic'

  // Validate the AI response shape with Zod
  const aiValidation = AIResponseSchema.safeParse(aiResponse)
  if (!aiValidation.success) {
    const errorMsg = aiValidation.error.issues.map((i) => i.message).join('; ')
    logger.warn({ error: errorMsg }, 'Gate 2 (AI response) validation warning — proceeding with raw response')
    emitGate(notify, 'routing', 'pass', {
      mode: aiResponse.mode,
      adapter: adapterType,
      validationWarning: errorMsg,
    })
  } else {
    emitGate(notify, 'routing', 'pass', {
      mode: aiResponse.mode,
      adapter: adapterType,
    })
  }

  // Extract display hints from the AI response (if present via Zod validation)
  let display: DisplayHints | undefined
  if (aiValidation.success && aiValidation.data.display) {
    display = aiValidation.data.display as DisplayHints
  }

  // ─── Stage 2b: Chat Mode Early Return ─────────────────────────────
  if (aiResponse.mode === 'chat') {
    // Still verify steps if the AI provided step_verifications (even in chat mode)
    const stepVerificationResults = await verifySteps(aiResponse.stepVerifications, notify)

    emitGate(notify, 'sympy', 'skip', { reason: 'chat mode' })
    emitGate(notify, 'symbol', 'skip', { reason: 'chat mode' })
    emitGate(notify, 'graph', 'skip', { reason: 'chat mode' })
    return {
      query,
      symbol: null,
      proof: null,
      graph: emptyGraph(),
      isVerified: false,
      mode: 'chat',
      chatReply: aiResponse.chatReply,
      chatSteps: aiResponse.reasoningSteps,
      status: 'complete',
      timings,
      adapter: adapterType,
      usedSidecar: false,
      error: null,
      display,
      tutorSections: aiResponse.tutorSections,
      stepVerificationResults: stepVerificationResults.length > 0 ? stepVerificationResults : undefined,
      toolRoute: planner.toolRoute,
      engineResults,
    }
  }

  // ─── Gate 3: SymPy (sidecar with stub fallback) ───────────────────
  const { sympyResponse, sympyMs, usedSidecar } = await executeSympyStep(
    query.id,
    aiResponse
  )
  timings.sympyMs = sympyMs
  if (aiResponse.sympyExecutable) {
    engineResults.push({
      engineName: 'sympy_compute',
      status: sympyResponse.ok ? 'success' : 'error',
      result: {
        expression: aiResponse.sympyExecutable,
        normalizedExpression: sympyResponse.normalizedExpression,
        latex: sympyResponse.resultLatex,
        usedSidecar,
        error: sympyResponse.error,
      },
      durationMs: sympyMs,
    })
  }

  // Validate SymPy response
  const sympyValidation = SymPyResponseSchema.safeParse(sympyResponse)
  if (!sympyValidation.success) {
    const errorMsg = sympyValidation.error.issues.map((i) => i.message).join('; ')
    logger.warn({ error: errorMsg }, 'Gate 3 (SymPy) validation warning — proceeding with raw response')
    emitGate(notify, 'sympy', 'pass', {
      ok: sympyResponse.ok,
      usedSidecar,
      validationWarning: errorMsg,
    })
  } else {
    emitGate(notify, 'sympy', 'pass', {
      ok: sympyResponse.ok,
      usedSidecar,
    })
  }

  // ─── Gate 4: Build Symbol ─────────────────────────────────────────
  const symbol = buildSymbol(query, aiResponse, sympyResponse)
  symbol.raw = {
    ...symbol.raw,
    tool_route: planner.toolRoute ?? null,
    engine_results: engineResults,
  }

  // Validate the symbol
  const symbolValidation = SymbolSchema.safeParse(symbol)
  if (!symbolValidation.success) {
    const errorMsg = symbolValidation.error.issues.map((i) => i.message).join('; ')
    logger.warn({ error: errorMsg }, 'Gate 4 (symbol) validation warning — proceeding')
    emitGate(notify, 'symbol', 'pass', {
      expression: symbol.expression,
      validationWarning: errorMsg,
    })
  } else {
    emitGate(notify, 'symbol', 'pass', {
      expression: symbol.expression,
      latex: symbol.latex,
    })
  }

  // ─── Stage 5: Verify ──────────────────────────────────────────────
  notify('verifying', {})
  const verifyStart = Date.now()

  const proof = await verify(symbol, { delayMs: opts.verifyDelayMs })

  timings.verifyMs = Date.now() - verifyStart

  emitGate(notify, 'verify', proof.verified ? 'pass' : 'fail', {
    verified: proof.verified,
    state: proof.state,
  })

  // ─── Gate 6: Build Graph ──────────────────────────────────────────
  notify('rendering', {})
  const graphStart = Date.now()

  const graph = buildGraph(symbol, proof)

  timings.graphMs = Date.now() - graphStart

  // Validate Desmos payload if present
  if (graph.desmos) {
    const desmosValidation = DesmosPayloadSchema.safeParse(graph.desmos)
    if (!desmosValidation.success) {
      const errorMsg = desmosValidation.error.issues.map((i) => i.message).join('; ')
      logger.warn({ error: errorMsg }, 'Gate 6 (desmos) validation warning')
      emitGate(notify, 'graph', 'pass', {
        hasDesmos: true,
        validationWarning: errorMsg,
      })
    } else {
      emitGate(notify, 'graph', 'pass', {
        hasDesmos: true,
        expressionCount: graph.desmos.expressions.length,
      })
    }
  } else {
    emitGate(notify, 'graph', 'pass', { hasDesmos: false })
  }

  // ─── Stage 6b: Step Verification ─────────────────────────────────
  const stepVerificationResults = await verifySteps(aiResponse.stepVerifications, notify)

  // ─── Stage 7: Return Result ───────────────────────────────────────
  notify('complete', {})

  return {
    query,
    symbol,
    proof,
    graph,
    isVerified: proof.verified,
    mode: 'computation',
    chatReply: null,
    chatSteps: aiResponse.reasoningSteps,
    status: 'complete',
    timings,
    adapter: adapterType,
    usedSidecar,
    error: null,
    display,
    tutorSections: aiResponse.tutorSections,
    stepVerificationResults: stepVerificationResults.length > 0 ? stepVerificationResults : undefined,
    toolRoute: planner.toolRoute,
    engineResults,
  }
}
