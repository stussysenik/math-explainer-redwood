/**
 * NIM NLP Router — MathViz Redwood
 *
 * NVIDIA NIM-backed OpenAI-compatible router for the N -> S morphism.
 * Sends the user's math query to a NIM-hosted model and parses the
 * structured JSON response into a validated AIResponse contract.
 *
 * Port of MathViz.Morphisms.NlpRouter.Nim (Elixir).
 *
 * Educational notes:
 *   - NIM exposes an OpenAI-compatible `/chat/completions` endpoint,
 *     so the request shape mirrors the OpenAI Chat Completions API.
 *   - `response_format: { type: "json_object" }` instructs the model
 *     to return raw JSON without markdown fences, but we still guard
 *     against stray prose with `extractJson()`.
 */

import { parseAIResponse } from '../pipeline/contracts'
import type { MathQuery, NlpRouter } from '../pipeline/types'
import { buildMathSystemPrompt } from './systemPrompt'

// ─── Config (read from env at call time) ──────────────────────────────────

function nimConfig() {
  return {
    apiKey: process.env.NVIDIA_NIM_API_KEY ?? process.env.NIM_API_KEY ?? '',
    baseUrl:
      process.env.NVIDIA_NIM_BASE_URL ??
      'https://integrate.api.nvidia.com/v1',
    model: process.env.NVIDIA_NIM_MODEL ?? 'moonshotai/kimi-k2-instruct',
    timeoutMs: parseInt(process.env.NVIDIA_NIM_TIMEOUT_MS ?? '15000', 10),
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────
// EXACT port of @system_prompt from the Elixir NIM module.

const SYSTEM_PROMPT = buildMathSystemPrompt('nim')

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extract the first JSON object from a string that might contain
 * markdown code fences or surrounding prose.
 *
 * Uses a greedy dotall regex identical to the Elixir `~r/\{.*\}/s`.
 */
function extractJson(content: string): string {
  const match = content.match(/\{[\s\S]*\}/)
  return match ? match[0] : content
}

/**
 * Normalize the `content` field from the NIM response.
 * It can be a plain string or an array of text objects.
 */
function extractContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item: unknown) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item) {
          return String((item as { text: unknown }).text)
        }
        return ''
      })
      .join('\n')
  }
  return ''
}

// ─── NIM Router ───────────────────────────────────────────────────────────

export const nimRouter: NlpRouter = {
  async toContract(query: MathQuery, opts?: Record<string, unknown>) {
    const config = nimConfig()

    if (!config.apiKey) {
      return { ok: false as const, error: 'Missing NVIDIA_NIM_API_KEY' }
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
            type: 'image_url' as const,
            image_url: { url: `data:${vision.mime};base64,${vision.base64}` },
          },
        ]
      : query.text.trim()

    const payload = {
      model: config.model,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }

    // ── HTTP request with AbortController for timeout ─────────────────
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        const body = await res.text().catch(() => '<unreadable>')
        return {
          ok: false as const,
          error: `NIM HTTP ${res.status}: ${body}`,
        }
      }

      const body = (await res.json()) as Record<string, unknown>
      return responseToContract(body)
    } catch (err: unknown) {
      clearTimeout(timer)

      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          ok: false as const,
          error: `NIM request timed out after ${config.timeoutMs}ms`,
        }
      }

      const message = err instanceof Error ? err.message : String(err)
      return { ok: false as const, error: `NIM request failed: ${message}` }
    }
  },
}

// ─── Response parsing ─────────────────────────────────────────────────────

/**
 * Extract the assistant's message from the OpenAI-compatible response body,
 * parse the JSON, and validate through `parseAIResponse()`.
 */
function responseToContract(
  body: Record<string, unknown>
):
  | { ok: true; response: ReturnType<typeof parseAIResponse>; adapter: string }
  | { ok: false; error: string } {
  const choices = body.choices as
    | Array<{ message?: { content?: unknown } }>
    | undefined

  if (!choices || choices.length === 0) {
    return {
      ok: false,
      error: `NIM unexpected response: no choices`,
    }
  }

  const rawContent = choices[0]?.message?.content
  const content = extractContent(rawContent)

  if (!content) {
    return { ok: false, error: 'NIM response had empty content' }
  }

  const jsonStr = extractJson(content)

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>
    const aiResponse = parseAIResponse(parsed)
    return { ok: true, response: aiResponse, adapter: 'nim' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `NIM invalid JSON: ${message}` }
  }
}
