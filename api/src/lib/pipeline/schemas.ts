/**
 * Pipeline Zod Schemas — MathViz Redwood
 *
 * Runtime validation schemas for each gate in the computation pipeline.
 * Each gate validates data at a stage boundary, ensuring type-safe flow
 * from user input through AI routing, SymPy execution, symbol building,
 * and graph rendering.
 *
 * Educational notes:
 *   - Zod `safeParse()` returns `{ success, data, error }` without throwing,
 *     letting the pipeline degrade gracefully at each gate.
 *   - `.default()` fills missing optional fields so downstream stages
 *     always receive a complete shape.
 */

import { z } from 'zod'

// ─── Gate 1: Input ──────────────────────────────────────────────────────────
/** Validates the raw user request before it enters the pipeline. */
export const SolveInputSchema = z.object({
  query: z.string().min(1).max(4096),
  imageBase64: z.string().optional(),
  imageMime: z.string().optional(),
})

// ─── Gate 2: AI Response ────────────────────────────────────────────────────
/** Display hints that tell the frontend what UI elements to render. */
export const DisplayHintsSchema = z.object({
  showGraph: z.boolean().default(false),
  showSteps: z.boolean().default(true),
  showProof: z.boolean().default(true),
  showMatrix: z.optional(z.boolean().default(false)),
  graphType: z.optional(z.enum(['2d', '3d', 'parametric', 'none']).default('2d')),
}).default({
  showGraph: false,
  showSteps: true,
  showProof: true,
})

/** Validates the normalized AI response from any adapter (stub, Nim, Anthropic). */
export const AIResponseSchema = z.object({
  mode: z.enum(['computation', 'chat']),
  reasoningSteps: z.array(z.string()).min(1).default(['Processing']),
  rawLatex: z.string().nullable().default(null),
  sympyExecutable: z.string().nullable().default(null),
  desmosExpressions: z.array(z.object({
    id: z.string(),
    latex: z.string(),
  })).default([]),
  chatReply: z.string().nullable().default(null),
  toolCalls: z.array(z.object({
    toolName: z.string(),
    toolInput: z.record(z.string(), z.unknown()),
    toolUseId: z.string(),
  })).default([]),
  stepVerifications: z.array(z.string()).optional().default([]),
  display: z.optional(DisplayHintsSchema),
})

// ─── Gate 3: SymPy Response ─────────────────────────────────────────────────
/** Validates the response from the SymPy sidecar (or its stub). */
export const SymPyResponseSchema = z.object({
  requestId: z.string(),
  ok: z.boolean(),
  resultString: z.string().nullable().default(null),
  resultLatex: z.string().nullable().default(null),
  normalizedExpression: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
})

// ─── Gate 4: Symbol ─────────────────────────────────────────────────────────
/** Validates the Symbol produced by buildSymbol(). */
export const SymbolSchema = z.object({
  statement: z.string(),
  expression: z.string(),
  latex: z.string(),
  graphExpression: z.string(),
  source: z.string(),
  notes: z.array(z.string()),
})

// ─── Gate 5: Desmos Payload ─────────────────────────────────────────────────
/** Validates the Desmos graph payload before sending to the renderer. */
export const DesmosPayloadSchema = z.object({
  expressions: z.array(z.object({ id: z.string(), latex: z.string() })).min(1),
  viewport: z.object({
    xmin: z.number(),
    xmax: z.number(),
    ymin: z.number(),
    ymax: z.number(),
  }),
})

// ─── Gate Event Type ────────────────────────────────────────────────────────
/** Shape of events emitted from each pipeline gate for SSE streaming. */
export type GateEvent = {
  gate: string
  status: 'pass' | 'fail' | 'skip'
  data: Record<string, unknown>
  timestamp: number
}
