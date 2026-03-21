/**
 * Solve Service — MathViz Redwood
 *
 * The primary mutation service. Accepts a user query, runs it through the
 * computation pipeline, persists all results, and returns a SolveResponse.
 *
 * Flow:
 *   1. Find or create a conversation
 *   2. Create the user message
 *   3. Run the pipeline
 *   4. Create the assistant message with linked SolveResult
 *   5. Return the response
 */

import type { MutationResolvers } from 'types/graphql'

import { db } from 'src/lib/db'
import { logger } from 'src/lib/logger'
import { runPipeline } from 'src/lib/pipeline'

// ─── Mutations ─────────────────────────────────────────────────────────────

export const solve: MutationResolvers['solve'] = async ({ input }) => {
  const { query, conversationId, imageBase64, imageMime } = input

  // ─── 1. Find or create conversation ────────────────────────────────
  let conversation: { id: string }

  if (conversationId) {
    const existing = await db.conversation.findUnique({
      where: { id: conversationId },
    })
    if (!existing) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }
    conversation = existing
  } else {
    // Create a new conversation with the query as the title
    const title =
      query.length > 60 ? query.slice(0, 57) + '...' : query || 'New Conversation'
    conversation = await db.conversation.create({
      data: { title },
    })
  }

  // ─── 2. Create user message ────────────────────────────────────────
  const userMessage = await db.message.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: query,
    },
  })

  logger.info(
    { messageId: userMessage.id, conversationId: conversation.id },
    'User message created'
  )

  // ─── 3. Run the pipeline ──────────────────────────────────────────
  const vision = imageBase64
    ? { base64: imageBase64, mime: imageMime || 'image/jpeg' }
    : undefined

  let pipelineResult
  try {
    pipelineResult = await runPipeline(query, { vision })
  } catch (err) {
    logger.error({ err, query }, 'Pipeline execution failed')
    throw new Error(
      `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  logger.info(
    {
      mode: pipelineResult.mode,
      status: pipelineResult.status,
      adapter: pipelineResult.adapter,
      timings: pipelineResult.timings,
    },
    'Pipeline completed'
  )

  // ─── 4. Build assistant message content ────────────────────────────
  const assistantContent =
    pipelineResult.mode === 'chat'
      ? pipelineResult.chatReply ?? 'No response generated.'
      : pipelineResult.symbol
        ? `${pipelineResult.symbol.statement}\n\n$$${pipelineResult.symbol.latex}$$`
        : 'Computation complete.'

  // ─── 5. Persist assistant message + SolveResult in a transaction ──
  const assistantMessage = await db.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantContent,
      solveResult: {
        create: {
          mode: pipelineResult.mode,
          status: pipelineResult.status,
          adapter: pipelineResult.adapter,

          // Chat fields
          chatReply: pipelineResult.chatReply,
          chatSteps: JSON.stringify(pipelineResult.chatSteps),

          // Symbol fields
          symbolStatement: pipelineResult.symbol?.statement ?? null,
          symbolExpression: pipelineResult.symbol?.expression ?? null,
          symbolLatex: pipelineResult.symbol?.latex ?? null,
          symbolGraphExpr: pipelineResult.symbol?.graphExpression ?? null,
          symbolSource: pipelineResult.symbol?.source ?? null,
          symbolNotes: JSON.stringify(pipelineResult.symbol?.notes ?? []),
          symbolRaw: JSON.stringify({
            ...(pipelineResult.symbol?.raw ?? {}),
            stepVerificationResults: pipelineResult.stepVerificationResults ?? [],
          }),

          // Proof fields
          proofVerified: pipelineResult.proof?.verified ?? false,
          proofState: pipelineResult.proof?.state ?? null,
          proofSummary: pipelineResult.proof?.summary ?? null,
          proofDurationMs: pipelineResult.proof?.durationMs ?? null,

          // Graph fields
          graphDesmos: JSON.stringify(pipelineResult.graph.desmos ?? {}),
          graphGeogebra: JSON.stringify(pipelineResult.graph.geogebra ?? {}),
          graphLatexBlock: pipelineResult.graph.latexBlock ?? null,

          // Timings
          timingNlpMs: pipelineResult.timings.nlpMs,
          timingSympyMs: pipelineResult.timings.sympyMs,
          timingVerifyMs: pipelineResult.timings.verifyMs,
          timingGraphMs: pipelineResult.timings.graphMs,

          // Error
          error: pipelineResult.error,
        },
      },
    },
    include: {
      solveResult: {
        include: {
          engineResults: true,
        },
      },
    },
  })

  // ─── 6. Create EngineResult for SymPy audit trail ─────────────────
  const solveResult = assistantMessage.solveResult!
  if (pipelineResult.timings.sympyMs > 0 || pipelineResult.usedSidecar) {
    try {
      await db.engineResult.create({
        data: {
          solveResultId: solveResult.id,
          engineName: 'sympy_compute',
          status: pipelineResult.error ? 'error' : 'success',
          result: JSON.stringify({
            expression: pipelineResult.symbol?.expression ?? null,
            latex: pipelineResult.symbol?.latex ?? null,
            usedSidecar: pipelineResult.usedSidecar,
          }),
          durationMs: pipelineResult.timings.sympyMs,
        },
      })
    } catch (err) {
      logger.warn({ err }, 'Failed to create EngineResult for sympy_compute')
    }
  }

  // ─── 7. Return SolveResponse ──────────────────────────────────────
  return {
    messageId: assistantMessage.id,
    conversationId: conversation.id,
    solveResult,
  }
}
