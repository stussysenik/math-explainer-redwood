/**
 * Pipeline Contracts — MathViz Redwood
 *
 * Validation and transformation functions that sit at the boundaries between
 * pipeline stages. These ensure data flowing through the pipeline conforms
 * to expected shapes. Port of the Elixir Pipeline.Contracts module.
 */

import type {
  AIResponse,
  DesmosExpression,
  DesmosPayload,
  MathQuery,
  Symbol,
  SymPyResponse,
  ToolCall,
} from './types'

// ─── Default Viewport ──────────────────────────────────────────────────────
const DEFAULT_VIEWPORT = { xmin: -10, xmax: 10, ymin: -10, ymax: 10 }

// ─── parseAIResponse ───────────────────────────────────────────────────────

/**
 * Validate and normalize a raw payload into an AIResponse.
 *
 * Accepts a loosely-typed object (e.g. from JSON) and returns a properly
 * typed AIResponse, filling in defaults for missing fields.
 */
export function parseAIResponse(
  payload: Record<string, unknown>
): AIResponse {
  const mode =
    payload.mode === 'computation' || payload.mode === 'chat'
      ? payload.mode
      : 'chat'

  const reasoningSteps = Array.isArray(payload.reasoningSteps)
    ? (payload.reasoningSteps as string[])
    : Array.isArray(payload.reasoning_steps)
      ? (payload.reasoning_steps as string[])
      : []

  const rawLatex =
    typeof payload.rawLatex === 'string'
      ? payload.rawLatex
      : typeof payload.raw_latex === 'string'
        ? payload.raw_latex
        : null

  const sympyExecutable =
    typeof payload.sympyExecutable === 'string'
      ? payload.sympyExecutable
      : typeof payload.sympy_executable === 'string'
        ? payload.sympy_executable
        : null

  const desmosExpressions = Array.isArray(payload.desmosExpressions)
    ? (payload.desmosExpressions as DesmosExpression[])
    : Array.isArray(payload.desmos_expressions)
      ? (payload.desmos_expressions as DesmosExpression[])
      : []

  const chatReply =
    typeof payload.chatReply === 'string'
      ? payload.chatReply
      : typeof payload.chat_reply === 'string'
        ? payload.chat_reply
        : null

  const toolCalls = Array.isArray(payload.toolCalls)
    ? payload.toolCalls
    : Array.isArray(payload.tool_calls)
      ? payload.tool_calls
      : []

  const stepVerifications = Array.isArray(payload.step_verifications)
    ? (payload.step_verifications as string[])
    : Array.isArray(payload.stepVerifications)
      ? (payload.stepVerifications as string[])
      : []

  return {
    mode,
    reasoningSteps,
    rawLatex,
    sympyExecutable,
    desmosExpressions,
    chatReply,
    toolCalls: toolCalls.map((tc: Record<string, unknown>) => ({
      toolName: String(tc.toolName ?? tc.tool_name ?? ''),
      toolInput: (tc.toolInput ?? tc.tool_input ?? {}) as Record<
        string,
        unknown
      >,
      toolUseId: String(tc.toolUseId ?? tc.tool_use_id ?? ''),
    })),
    stepVerifications,
  }
}

// ─── buildSymbol ───────────────────────────────────────────────────────────

/**
 * Build a Symbol from an AIResponse and optional SymPyResponse.
 *
 * If a SymPy response is available and successful, its normalized expression
 * and latex override the AI response values. Otherwise we fall back to the
 * AI response's raw outputs.
 */
export function buildSymbol(
  query: MathQuery,
  aiResponse: AIResponse,
  sympyResponse?: SymPyResponse | null
): Symbol {
  // Determine expression and latex from SymPy if available
  const expression =
    sympyResponse?.ok && sympyResponse.normalizedExpression
      ? sympyResponse.normalizedExpression
      : aiResponse.sympyExecutable ?? aiResponse.rawLatex ?? query.text

  const latex =
    sympyResponse?.ok && sympyResponse.resultLatex
      ? sympyResponse.resultLatex
      : aiResponse.rawLatex ?? expression

  // Graph expression: prefer desmos expressions, fall back to expression
  const graphExpression =
    aiResponse.desmosExpressions.length > 0
      ? aiResponse.desmosExpressions[0].latex
      : relationFromExpression(expression)

  // Build the raw metadata object for downstream consumers
  const raw: Record<string, unknown> = {
    ai_response: {
      mode: aiResponse.mode,
      rawLatex: aiResponse.rawLatex,
      sympyExecutable: aiResponse.sympyExecutable,
    },
    sympy_response: sympyResponse ?? null,
    verified_desmos_expressions:
      aiResponse.desmosExpressions.length > 0
        ? aiResponse.desmosExpressions
        : null,
  }

  const statement = `Result for: ${query.text}`

  return {
    statement,
    expression,
    latex,
    graphExpression,
    source: 'stub',
    raw,
    notes: aiResponse.reasoningSteps,
  }
}

// ─── toDesmosPayload ───────────────────────────────────────────────────────

/**
 * Build a DesmosPayload from a list of expressions and optional viewport.
 */
export function toDesmosPayload(
  expressions: DesmosExpression[],
  viewport?: { xmin: number; xmax: number; ymin: number; ymax: number }
): DesmosPayload {
  return {
    expressions,
    viewport: viewport ?? DEFAULT_VIEWPORT,
  }
}

// ─── relationFromExpression ────────────────────────────────────────────────

/**
 * Ensure an expression has a "y=" prefix to form a plottable relation.
 * If the expression already contains "=", it's returned as-is.
 */
export function relationFromExpression(expr: string): string {
  if (expr.includes('=')) {
    return expr
  }
  return `y=${expr}`
}

// ─── parseToolUseResponse ─────────────────────────────────────────────────

/**
 * Parse an Anthropic response body that contains `tool_use` content blocks.
 *
 * Port of MathViz.Contracts.parse_tool_use_response/1 (Elixir).
 *
 * Logic:
 *   1. Filter content blocks for `tool_use` → build ToolCall objects.
 *   2. Filter content blocks for `text` → join into a single string.
 *   3. Priority routing:
 *      - If a `sympy_compute` tool call exists → computation mode.
 *      - If an `explain_concept` tool call exists → chat mode.
 *      - Otherwise → error (no recognized tool calls).
 */
export function parseToolUseResponse(
  body: Record<string, unknown>
): { ok: true; response: AIResponse } | { ok: false; error: string } {
  const content = body.content as Array<Record<string, unknown>> | undefined

  if (!Array.isArray(content)) {
    return { ok: false, error: 'No tool_use content in response' }
  }

  // ── Extract tool calls ────────────────────────────────────────────
  const toolCalls: ToolCall[] = content
    .filter((block) => block.type === 'tool_use')
    .map((block) => ({
      toolName: String(block.name ?? ''),
      toolInput: (block.input ?? {}) as Record<string, unknown>,
      toolUseId: String(block.id ?? ''),
    }))

  // ── Extract text parts ────────────────────────────────────────────
  const textParts = content
    .filter((block) => block.type === 'text')
    .map((block) => String(block.text ?? ''))
    .join('\n')

  // ── Route by tool priority ────────────────────────────────────────
  const sympyCall = toolCalls.find((tc) => tc.toolName === 'sympy_compute')
  const explainCall = toolCalls.find(
    (tc) => tc.toolName === 'explain_concept'
  )

  if (sympyCall) {
    const input = sympyCall.toolInput
    const desmosRaw = Array.isArray(input.desmos_expressions)
      ? (input.desmos_expressions as Array<Record<string, unknown>>)
      : []

    const desmosExpressions: DesmosExpression[] = desmosRaw.map((expr) => ({
      id: String(expr.id ?? 'graph1'),
      latex: String(expr.latex ?? ''),
    }))

    const reasoning = extractReasoning(explainCall, textParts)

    return {
      ok: true,
      response: {
        mode: 'computation',
        reasoningSteps: reasoning,
        rawLatex:
          typeof input.raw_latex === 'string'
            ? input.raw_latex
            : typeof input.expression === 'string'
              ? input.expression
              : '',
        sympyExecutable:
          typeof input.expression === 'string'
            ? input.expression
            : typeof input.raw_latex === 'string'
              ? input.raw_latex
              : '',
        desmosExpressions,
        chatReply: null,
        toolCalls,
        stepVerifications: Array.isArray(input.step_verifications)
          ? (input.step_verifications as string[])
          : [],
      },
    }
  }

  if (explainCall) {
    const input = explainCall.toolInput

    return {
      ok: true,
      response: {
        mode: 'chat',
        reasoningSteps: Array.isArray(input.reasoning_steps)
          ? (input.reasoning_steps as string[])
          : ['Conceptual explanation'],
        rawLatex: null,
        sympyExecutable: null,
        desmosExpressions: [],
        chatReply:
          typeof input.explanation === 'string'
            ? input.explanation
            : textParts,
        toolCalls,
        stepVerifications: Array.isArray(input.step_verifications)
          ? (input.step_verifications as string[])
          : [],
      },
    }
  }

  return { ok: false, error: 'No recognized tool calls (sympy_compute or explain_concept)' }
}

/**
 * Extract reasoning steps from an explain_concept tool call, or fall back
 * to any text parts from the response.
 *
 * Port of MathViz.Contracts.extract_reasoning/2 (Elixir).
 */
function extractReasoning(
  explainCall: ToolCall | undefined,
  textParts: string
): string[] {
  if (explainCall) {
    const steps = explainCall.toolInput.reasoning_steps
    if (Array.isArray(steps)) return steps as string[]
    return ['Tool-based computation']
  }
  if (textParts !== '') return [textParts]
  return ['Tool-based computation']
}
