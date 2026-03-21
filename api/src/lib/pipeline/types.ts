/**
 * Pipeline Types — MathViz Redwood
 *
 * These interfaces model the entire computation pipeline from natural-language
 * query through symbolic algebra, verification, and graph rendering.
 *
 * The pipeline is a functor chain:  Query → Symbol → Proof → Graph
 * Each stage produces an immutable value object that feeds the next.
 */

// ─── Query ─────────────────────────────────────────────────────────────────
/** A normalized math query ready for NLP routing. */
export interface MathQuery {
  text: string
  id: string
  metadata: Record<string, unknown>
}

// ─── Symbol ────────────────────────────────────────────────────────────────
/** The symbolic representation produced by the NLP + CAS pipeline. */
export interface Symbol {
  statement: string
  expression: string
  latex: string
  graphExpression: string
  source: 'stub' | 'nim' | 'anthropic' | 'contract'
  raw: Record<string, unknown>
  notes: string[]
}

// ─── Proof ─────────────────────────────────────────────────────────────────
/** Verification result from the mock (or real) prover. */
export interface Proof {
  verified: boolean
  state: string
  summary: string | null
  durationMs: number | null
}

// ─── Graph Payloads ────────────────────────────────────────────────────────
export interface DesmosExpression {
  id: string
  latex: string
}

export interface DesmosPayload {
  expressions: DesmosExpression[]
  viewport: { xmin: number; xmax: number; ymin: number; ymax: number }
}

export interface GeoGebraPayload {
  command: string
  expression: string
}

export interface Graph {
  desmos: DesmosPayload | null
  geogebra: GeoGebraPayload | null
  latexBlock: string | null
}

// ─── Display Hints ─────────────────────────────────────────────────────────
/** UI rendering hints extracted from the AI response's display object. */
export interface DisplayHints {
  showGraph: boolean
  showSteps: boolean
  showProof: boolean
  showMatrix?: boolean
  graphType?: '2d' | '3d' | 'parametric' | 'none'
}

// ─── Pipeline Result ───────────────────────────────────────────────────────
/** The complete output of a single pipeline run. */
export interface PipelineResult {
  query: MathQuery | null
  symbol: Symbol | null
  proof: Proof | null
  graph: Graph
  isVerified: boolean
  mode: 'computation' | 'chat'
  chatReply: string | null
  chatSteps: string[]
  status: 'idle' | 'computing' | 'verifying' | 'rendering' | 'complete' | 'error'
  timings: { nlpMs: number; sympyMs: number; verifyMs: number; graphMs: number }
  adapter: 'stub' | 'nim' | 'anthropic'
  /** Whether the real Python sidecar was used (true) or the inline stub (false). */
  usedSidecar: boolean
  error: string | null
  /** UI display hints from the AI response (optional). */
  display?: DisplayHints
  /** Step-by-step SymPy verification results. */
  stepVerificationResults?: Array<{
    step: number
    verified: boolean
    sympyExpression: string
    sympyResult: string | null
  }>
}

// ─── AI Response ───────────────────────────────────────────────────────────
/** Normalized response from any AI adapter (stub, Nim, Anthropic). */
export interface AIResponse {
  mode: 'computation' | 'chat'
  reasoningSteps: string[]
  rawLatex: string | null
  sympyExecutable: string | null
  desmosExpressions: DesmosExpression[]
  chatReply: string | null
  toolCalls: ToolCall[]
  stepVerifications?: string[]  // SymPy boolean expressions for each step
}

export interface ToolCall {
  toolName: string
  toolInput: Record<string, unknown>
  toolUseId: string
}

// ─── SymPy Sidecar ─────────────────────────────────────────────────────────
export interface SymPyRequest {
  requestId: string
  sympyExecutable: string
}

export interface SymPyResponse {
  requestId: string
  ok: boolean
  resultString: string | null
  resultLatex: string | null
  normalizedExpression: string | null
  error: string | null
}

// ─── NLP Router Contract ───────────────────────────────────────────────────
/** Any NLP router (stub, Nim, Anthropic) must implement this interface. */
export interface NlpRouter {
  toContract(
    query: MathQuery,
    opts?: Record<string, unknown>
  ): Promise<
    | { ok: true; response: AIResponse; adapter: string }
    | { ok: false; error: string }
  >
}
