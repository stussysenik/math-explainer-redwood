/**
 * Anthropic NLP Router — MathViz Redwood
 *
 * Claude-backed router for the N -> S morphism with native tool calling.
 * Sends the user's math query to the Anthropic Messages API and interprets
 * both structured tool_use blocks and plain-text JSON responses.
 *
 * Port of MathViz.Morphisms.NlpRouter.Anthropic (Elixir).
 *
 * Educational notes:
 *   - Anthropic's tool calling lets the model invoke typed functions.
 *     When a `tool_use` block appears in the response content, we extract
 *     the tool name + input and map it to our AIResponse contract via
 *     `parseToolUseResponse()`.
 *   - If the model responds with plain text instead, we fall back to
 *     extracting JSON just like the NIM router does.
 */

import { parseAIResponse, parseToolUseResponse } from '../pipeline/contracts'
import type { MathQuery, NlpRouter } from '../pipeline/types'

// ─── Config (read from env at call time) ──────────────────────────────────

function anthropicConfig() {
  return {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5-20250929',
    timeoutMs: parseInt(process.env.ANTHROPIC_TIMEOUT_MS ?? '30000', 10),
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS ?? '2048', 10),
  }
}

const ANTHROPIC_VERSION = '2023-06-01'

// ─── System Prompt ────────────────────────────────────────────────────────
// EXACT port of @system_prompt from the Elixir Anthropic module.

const SYSTEM_PROMPT = `You are a verified-first math tutor at the level of Terence Tao and Richard Feynman.
Use the provided tools to answer math questions. For computations, use sympy_compute.
For conceptual/theory questions, use explain_concept. For verification or numerical work,
use wolfram_alpha. For matrix/numerical methods, use octave_compute.
Always show your reasoning. Prefer symbolic computation over numerical when possible.
If a question can benefit from multiple tools, call them all.
Also include a "display" object that hints the UI what to render:
- showGraph: true if result should be graphed (functions, curves, distributions)
- showSteps: true if step-by-step reasoning should be displayed
- showProof: true if formal verification section is needed
- showMatrix: true if matrix notation should be used
- graphType: "2d" for y=f(x), "3d" for surfaces, "parametric" for parametric curves, "none" if no graph needed

When including math expressions in chat_reply text, wrap them in $...$ for inline math or $$...$$ for display math. Example: "The derivative is $\\frac{d}{dx}[x^2] = 2x$".

For computation mode, also include a "step_verifications" array. Each entry is a SymPy boolean expression (using Eq, simplify, etc.) that verifies the corresponding reasoning step. When evaluated by SymPy, each should return True if the step is correct.

Example for "derivative of x^3":
  "step_verifications": ["Eq(diff(x**3, x), 3*x**2)"]

Example for normal distribution P(X > 12) with X~N(10,4):
  "step_verifications": [
    "Eq(sqrt(4), 2)",
    "Eq((12-10)/2, 1)"
  ]

Keep step_verifications simple — one expression per reasoning step, using SymPy functions only (Eq, diff, integrate, simplify, sqrt, sin, cos, exp, log, symbols, Rational, factorial, binomial, stats.Normal if needed). If a step cannot be verified symbolically, omit it from the array.`

// ─── Tool Definitions ─────────────────────────────────────────────────────
// EXACT port of @tools from the Elixir Anthropic module.

const TOOLS = [
  {
    name: 'sympy_compute',
    description:
      'Execute symbolic math using SymPy. Use for derivatives, integrals, simplification, factoring, solving equations, limits, and series.',
    input_schema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description:
            'A SymPy-safe expression (e.g. diff(x**3, x), integrate(sin(x), x), simplify(...))',
        },
        raw_latex: {
          type: 'string',
          description: 'KaTeX-ready LaTeX for the intended result',
        },
        desmos_expressions: {
          type: 'array',
          description: 'Desmos graph expressions',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              latex: { type: 'string' },
            },
            required: ['id', 'latex'],
          },
        },
      },
      required: ['expression', 'raw_latex'],
    },
  },
  {
    name: 'wolfram_alpha',
    description:
      'Query Wolfram Alpha for numerical computation, equation solving, step-by-step solutions, or to verify a symbolic result.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The math query in natural language or notation',
        },
        purpose: {
          type: 'string',
          enum: ['primary', 'verify'],
          description:
            'Whether this is the primary computation or a verification check',
        },
      },
      required: ['query', 'purpose'],
    },
  },
  {
    name: 'octave_compute',
    description:
      'Execute numerical computation using GNU Octave. Use for matrix operations, eigenvalues, numerical methods, signal processing, and large-scale computation.',
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Octave/MATLAB code to execute',
        },
        description: {
          type: 'string',
          description: 'What this computation does',
        },
      },
      required: ['code', 'description'],
    },
  },
  {
    name: 'explain_concept',
    description:
      'Explain a mathematical concept, theorem, or theory. Use for conceptual questions, definitions, proofs, and educational explanations.',
    input_schema: {
      type: 'object',
      properties: {
        explanation: {
          type: 'string',
          description: 'The full explanation text',
        },
        reasoning_steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Step-by-step reasoning leading to the explanation',
        },
      },
      required: ['explanation', 'reasoning_steps'],
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extract the first JSON object from a string that might contain
 * markdown code fences or surrounding prose.
 */
function extractJson(content: string): string {
  const match = content.match(/\{[\s\S]*\}/)
  return match ? match[0] : content
}

// ─── Anthropic Router ─────────────────────────────────────────────────────

export const anthropicRouter: NlpRouter = {
  async toContract(query: MathQuery, opts?: Record<string, unknown>) {
    const config = anthropicConfig()

    if (!config.apiKey) {
      return { ok: false as const, error: 'Missing ANTHROPIC_API_KEY' }
    }

    const temperature =
      typeof opts?.temperature === 'number' ? opts.temperature : 0.0

    // Build user message content — multipart when vision data is present
    const vision = opts?.vision as { base64: string; mime: string } | undefined
    const userContent = vision
      ? [
          {
            type: 'text' as const,
            text: query.text.trim() || 'Analyze the uploaded image and extract the mathematical problem',
          },
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: vision.mime,
              data: vision.base64,
            },
          },
        ]
      : query.text.trim()

    const payload = {
      model: config.model,
      max_tokens: config.maxTokens,
      temperature,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: userContent }],
    }

    // ── HTTP request with AbortController for timeout ─────────────────
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        const body = await res.text().catch(() => '<unreadable>')
        return {
          ok: false as const,
          error: `Anthropic HTTP ${res.status}: ${body}`,
        }
      }

      const body = (await res.json()) as Record<string, unknown>
      return responseToContract(body)
    } catch (err: unknown) {
      clearTimeout(timer)

      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          ok: false as const,
          error: `Anthropic request timed out after ${config.timeoutMs}ms`,
        }
      }

      const message = err instanceof Error ? err.message : String(err)
      return {
        ok: false as const,
        error: `Anthropic request failed: ${message}`,
      }
    }
  },
}

// ─── Response parsing ─────────────────────────────────────────────────────

/**
 * Route the Anthropic response body to the appropriate parser.
 *
 * If any content block has `type: "tool_use"`, we delegate to
 * `parseToolUseResponse()`. Otherwise we try to extract JSON from the
 * first text block and run it through `parseAIResponse()`.
 */
function responseToContract(
  body: Record<string, unknown>
):
  | { ok: true; response: ReturnType<typeof parseAIResponse>; adapter: string }
  | { ok: false; error: string } {
  const content = body.content as Array<Record<string, unknown>> | undefined

  if (!Array.isArray(content)) {
    return {
      ok: false,
      error: 'Anthropic unexpected response: no content array',
    }
  }

  const hasToolUse = content.some((block) => block.type === 'tool_use')

  if (hasToolUse) {
    // Delegate to tool-use parser from contracts
    const result = parseToolUseResponse(body)
    if (result.ok === false) {
      return { ok: false, error: result.error }
    }
    return { ok: true, response: result.response, adapter: 'anthropic' }
  }

  // Plain text response — extract JSON
  const textBlock = content.find((block) => block.type === 'text')
  if (!textBlock || typeof textBlock.text !== 'string') {
    return {
      ok: false,
      error: 'Anthropic response had no text content',
    }
  }

  const jsonStr = extractJson(textBlock.text as string)

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>
    const aiResponse = parseAIResponse(parsed)
    return { ok: true, response: aiResponse, adapter: 'anthropic' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Anthropic invalid JSON: ${message}` }
  }
}
