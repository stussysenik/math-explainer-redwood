/**
 * Solve Stream Endpoint — MathViz Redwood
 *
 * A Redwood serverless function (non-GraphQL) that runs the computation
 * pipeline and returns gate-by-gate events alongside the final result.
 *
 * Since Redwood serverless functions return a complete response (not a
 * persistent connection), this uses "Option A": all gate events are
 * collected during pipeline execution and returned as a JSON array.
 * The client can process them sequentially with small delays for a
 * visual gate-by-gate effect.
 *
 * Endpoint: POST /api/solveStream
 * Body:     {
 *             query: string,
 *             conversationId?: string,
 *             imageBase64?: string,
 *             imageMime?: string,
 *             imageFilename?: string
 *           }
 * Response: {
 *             conversationId: string | null,
 *             messageId: string | null,
 *             gates: GateEvent[],
 *             result: ClientSolveResult
 *           }
 *
 * Educational notes:
 *   - The `notify` callback collects gate events into an array rather
 *     than writing to a stream, making this compatible with Lambda-style
 *     serverless functions.
 *   - DB persistence mirrors the GraphQL solve mutation so both paths
 *     produce identical audit trails.
 */

import type { APIGatewayEvent, Context } from 'aws-lambda'

import { db } from 'src/lib/db'
import { logger } from 'src/lib/logger'
import { runPipeline } from 'src/lib/pipeline'
import { SolveInputSchema } from 'src/lib/pipeline/schemas'
import type { GateEvent } from 'src/lib/pipeline/schemas'
import {
  assistantContentFromPipeline,
  toClientSolveResult,
} from 'src/lib/solveResult'

// ─── CORS & Response Helpers ────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS,
    },
    body: JSON.stringify(body),
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const handler = async (event: APIGatewayEvent, _context: Context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed. Use POST.' })
  }

  // ─── 1. Parse and validate input ────────────────────────────────────
  let rawBody: Record<string, unknown>
  try {
    rawBody = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const inputResult = SolveInputSchema.safeParse(rawBody)
  if (!inputResult.success) {
    const errors = inputResult.error.issues.map((i) => i.message)
    return jsonResponse(400, { error: 'Validation failed', details: errors })
  }

  const { query, conversationId, imageBase64, imageMime, imageFilename } =
    inputResult.data

  // ─── 2. Collect gate events via notify callback ─────────────────────
  const gates: GateEvent[] = []

  const notify = (eventName: string, data: Record<string, unknown> = {}) => {
    // Gate events have the "gate:" prefix from emitGate()
    if (eventName.startsWith('gate:')) {
      gates.push(data as unknown as GateEvent)
    } else {
      // Stage notifications (computing, verifying, rendering, complete)
      gates.push({
        gate: eventName,
        status: 'pass',
        data,
        timestamp: Date.now(),
      })
    }
  }

  // ─── 3. Run the pipeline ────────────────────────────────────────────
  const vision = imageBase64
    ? { base64: imageBase64, mime: imageMime || 'image/jpeg' }
    : undefined

  let pipelineResult
  try {
    pipelineResult = await runPipeline(query, { notify, vision })
  } catch (err) {
    logger.error({ err, query }, 'solveStream pipeline failed')
    return jsonResponse(500, {
      error: `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      gates,
    })
  }

  // ─── 4. Persist to DB (mirrors solve service) ──────────────────────
  let resolvedConversationId = conversationId ?? null
  let resolvedMessageId: string | null = null
  let solveResultId: string | undefined
  const userMessageContent = query || `Uploaded image: ${imageFilename ?? 'image'}`

  try {
    let conversation = conversationId
      ? await db.conversation.findUnique({
          where: { id: conversationId },
        })
      : null

    if (!conversation) {
      if (conversationId) {
        logger.warn(
          { conversationId },
          'solveStream conversation not found, creating a new one'
        )
      }

      const title =
        query.length > 60
          ? query.slice(0, 57) + '...'
          : query || imageFilename || 'New Conversation'
      conversation = await db.conversation.create({
        data: { title },
      })
    }

    resolvedConversationId = conversation.id

    // Create user message
    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: userMessageContent,
        hasImage: !!imageBase64,
        imageMime: imageMime ?? null,
        imageFilename: imageFilename ?? null,
      },
    })

    // Persist assistant message + SolveResult
    const assistantMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantContentFromPipeline(pipelineResult),
        solveResult: {
          create: {
            mode: pipelineResult.mode,
            status: pipelineResult.status,
            adapter: pipelineResult.adapter,
            chatReply: pipelineResult.chatReply,
            chatSteps: JSON.stringify(pipelineResult.chatSteps),
            symbolStatement: pipelineResult.symbol?.statement ?? null,
            symbolExpression: pipelineResult.symbol?.expression ?? null,
            symbolLatex: pipelineResult.symbol?.latex ?? null,
            symbolGraphExpr: pipelineResult.symbol?.graphExpression ?? null,
            symbolSource: pipelineResult.symbol?.source ?? null,
            symbolNotes: JSON.stringify(pipelineResult.symbol?.notes ?? []),
            symbolRaw: JSON.stringify({
              ...(pipelineResult.symbol?.raw ?? {}),
              stepVerificationResults: pipelineResult.stepVerificationResults ?? [],
              toolRoute: pipelineResult.toolRoute ?? null,
              engineResults: pipelineResult.engineResults ?? [],
            }),
            proofVerified: pipelineResult.proof?.verified ?? false,
            proofState: pipelineResult.proof?.state ?? null,
            proofSummary: pipelineResult.proof?.summary ?? null,
            proofDurationMs: pipelineResult.proof?.durationMs ?? null,
            graphDesmos: JSON.stringify(pipelineResult.graph.desmos ?? {}),
            graphGeogebra: JSON.stringify(pipelineResult.graph.geogebra ?? {}),
            graphLatexBlock: pipelineResult.graph.latexBlock ?? null,
            timingNlpMs: pipelineResult.timings.nlpMs,
            timingSympyMs: pipelineResult.timings.sympyMs,
            timingVerifyMs: pipelineResult.timings.verifyMs,
            timingGraphMs: pipelineResult.timings.graphMs,
            error: pipelineResult.error,
          },
        },
      },
      include: {
        solveResult: true,
      },
    })
    resolvedMessageId = assistantMessage.id
    solveResultId = assistantMessage.solveResult?.id

    // Engine-level audit trail
    if (pipelineResult.engineResults && pipelineResult.engineResults.length > 0) {
      const solveResult = assistantMessage.solveResult!
      await db.engineResult.createMany({
        data: pipelineResult.engineResults.map((engineResult) => ({
          solveResultId: solveResult.id,
          engineName: engineResult.engineName,
          toolUseId: engineResult.toolUseId ?? null,
          status: engineResult.status,
          result: JSON.stringify(engineResult.result),
          durationMs: engineResult.durationMs,
        })),
      })
    }

    logger.info(
      {
        conversationId: conversation.id,
        messageId: assistantMessage.id,
        gateCount: gates.length,
      },
      'solveStream persisted'
    )
  } catch (err) {
    // DB persistence failure should not break the response —
    // the pipeline result is still valid
    logger.error({ err }, 'solveStream DB persistence failed')
  }

  // ─── 5. Return collected gates + result ─────────────────────────────
  return jsonResponse(200, {
    conversationId: resolvedConversationId,
    messageId: resolvedMessageId,
    gates,
    result: toClientSolveResult(pipelineResult, { id: solveResultId }),
  })
}
