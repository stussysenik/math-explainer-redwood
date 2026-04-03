import { useCallback, useEffect, useState } from 'react'

import { useMutation } from '@redwoodjs/web'
import { Metadata } from '@redwoodjs/web'

import KaTeXBlock from 'src/components/math/KaTeXBlock/KaTeXBlock'
import MathText from 'src/components/math/MathText/MathText'
import CommandBar from 'src/components/solve/CommandBar/CommandBar'
import ConversationThread from 'src/components/solve/ConversationThread/ConversationThread'
import EngineDiagnostics from 'src/components/solve/EngineDiagnostics/EngineDiagnostics'
import GateProgress from 'src/components/solve/GateProgress/GateProgress'
import GraphSection from 'src/components/solve/GraphSection/GraphSection'
import StatusIndicator from 'src/components/solve/StatusIndicator/StatusIndicator'
import StepByStep from 'src/components/solve/StepByStep/StepByStep'
import TheoremBox from 'src/components/solve/TheoremBox/TheoremBox'
import TutorStructure from 'src/components/solve/TutorStructure/TutorStructure'
import { useSolveStream } from 'src/hooks/useSolveStream'
import type {
  ConversationMessage,
  SolveResultData,
  PipelineStatus,
  DesmosPayload,
  GeoGebraPayload,
} from 'src/types/solve'

const SOLVE_MUTATION = gql`
  mutation SolveMutation($input: SolveInput!) {
    solve(input: $input) {
      messageId
      conversationId
      solveResult {
        id
        mode
        status
        adapter
        chatReply
        chatSteps
        symbolStatement
        symbolExpression
        symbolLatex
        symbolGraphExpr
        symbolNotes
        proofVerified
        proofState
        proofSummary
        proofDurationMs
        graphDesmos
        graphGeogebra
        graphLatexBlock
        timingNlpMs
        timingSympyMs
        timingVerifyMs
        timingGraphMs
        error
      }
    }
  }
`

// ---------------------------------------------------------------------------
// Helpers: safely parse graph JSON that may already be an object or a string
// ---------------------------------------------------------------------------
function parseDesmosConfig(raw: unknown): DesmosPayload | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw as DesmosPayload
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as DesmosPayload
    } catch {
      return null
    }
  }
  return null
}

function parseGeogebraConfig(raw: unknown): GeoGebraPayload | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw as GeoGebraPayload
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as GeoGebraPayload
    } catch {
      return null
    }
  }
  return null
}

function summarizeSolveResult(result: SolveResultData): string {
  if (result.mode === 'chat') {
    return result.chatReply || 'Response received.'
  }

  return (
    result.symbolStatement ||
    result.symbolExpression ||
    'Computation complete.'
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const HomePage = () => {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [inputQuery, setInputQuery] = useState('')
  const [status, setStatus] = useState<PipelineStatus>('idle')
  const [solveResult, setSolveResult] = useState<SolveResultData | null>(null)

  // GraphQL fallback path (kept for backwards compatibility)
  const [solveMutation, { loading: gqlLoading }] = useMutation(SOLVE_MUTATION)

  // Streaming path — primary solve mechanism
  const stream = useSolveStream()

  // Unified loading state: either the stream or the GraphQL mutation is active
  const isLoading = stream.status === 'streaming' || gqlLoading

  const handleSubmit = useCallback(async (
    query: string,
    image?: { base64: string; mime: string; filename: string }
  ) => {
    const trimmedQuery = query.trim()
    const userMessage =
      trimmedQuery || (image ? `Uploaded image: ${image.filename}` : query)

    setInputQuery(userMessage)
    setSolveResult(null)
    setStatus('computing')

    // Add user message (guard against duplicate if handleSubmit fires twice)
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last?.role === 'user' && last?.content === userMessage) return prev
      return [...prev, { role: 'user', content: userMessage }]
    })

    // Primary path: streaming endpoint
    try {
      await stream.solve(trimmedQuery, image, conversationId)
    } catch {
      // If the stream hook itself throws unexpectedly, fall through
    }
  }, [conversationId, stream])

  useEffect(() => {
    if (stream.status !== 'complete' || !stream.result) return

    setConversationId(stream.conversationId)
    setSolveResult(stream.result)
    setStatus(stream.result.status as PipelineStatus)

    const summary = summarizeSolveResult(stream.result)
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant' && last?.content === summary) return prev
      return [...prev, { role: 'assistant', content: summary }]
    })
  }, [stream.conversationId, stream.result, stream.status])

  useEffect(() => {
    if (stream.status !== 'error' || !stream.error) return

    setStatus('error')
    setSolveResult(null)
    setMessages((prev) => {
      const errMsg = 'Error: ' + stream.error
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant' && last?.content === errMsg) return prev
      return [...prev, { role: 'assistant', content: errMsg }]
    })
  }, [stream.error, stream.status])

  // GraphQL fallback handler (not wired to submit by default, available if needed)
  const handleGqlFallback = useCallback(async (
    query: string,
    image?: { base64: string; mime: string; filename: string }
  ) => {
    try {
      const { data } = await solveMutation({
        variables: {
          input: {
            query,
            conversationId,
            imageBase64: image?.base64,
            imageMime: image?.mime,
            imageFilename: image?.filename,
          }
        }
      })

      const result = data.solve.solveResult as SolveResultData
      setConversationId(data.solve.conversationId)
      setSolveResult(result)
      setStatus(result.status as PipelineStatus)

      const summary = summarizeSolveResult(result)
      setMessages(prev => [...prev, { role: 'assistant', content: summary }])
    } catch (err) {
      setStatus('error')
      setSolveResult(null)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (err as Error).message }])
    }
  }, [conversationId, solveMutation])
  void handleGqlFallback

  const handleNewChat = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setSolveResult(null)
    setStatus('idle')
    setInputQuery('')
    stream.reset()
  }, [stream])

  // Derived state
  const hasOutput = solveResult !== null
  const isChat = solveResult?.mode === 'chat'
  const isComputation = solveResult?.mode === 'computation'
  const hasError = !!solveResult?.error

  // Parse graph payloads (handles both pre-parsed objects and JSON strings)
  const desmosConfig = parseDesmosConfig(solveResult?.graphDesmos)
  const geogebraConfig = parseGeogebraConfig(solveResult?.graphGeogebra)
  const hasGraph =
    (desmosConfig !== null && (desmosConfig.expressions?.length ?? 0) > 0) ||
    (geogebraConfig !== null && !!geogebraConfig.command)

  return (
    <>
      <Metadata title="MathViz" description="Verified-first math orchestration" />

      <header className="flex items-center justify-between gap-3 py-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-stone-500">
          MathViz
        </p>

        <div className="flex items-center gap-3">
          {/* Engine diagnostics — replaces the placeholder */}
          {solveResult && <EngineDiagnostics result={solveResult} />}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleNewChat}
              className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
              data-testid="new-chat-btn"
            >
              New Chat
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 pb-40 pt-6">
        <ConversationThread messages={messages} />

        <div className="space-y-12 sm:space-y-14">
          {/* Gate progress — shows pipeline stages in real time */}
          {stream.status === 'streaming' && (
            <div className="animate-in fade-in">
              <GateProgress
                gates={stream.gates}
                currentGate={stream.currentGate}
              />
            </div>
          )}

          {/* Fallback loading indicator (only when using GraphQL path) */}
          {stream.status === 'idle' && status === 'computing' && !solveResult && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
                <p className="text-sm font-medium text-amber-700">Computing...</p>
              </div>
              <p className="mt-2 text-sm text-stone-500">
                Routing through NLP pipeline and symbolic verification
              </p>
            </div>
          )}

          {hasOutput && (
            <section className="space-y-8">
              <StatusIndicator
                status={status}
                isVerified={solveResult?.proofVerified ?? false}
                hasChatReply={!!solveResult?.chatReply}
                hasError={hasError}
              />

              {/* ------- ERROR ------- */}
              {hasError && !isChat && !isComputation && (
                <p className="text-sm leading-6 text-rose-700">{solveResult.error}</p>
              )}

              {/* ------- CHAT / THEORY ------- */}
              {isChat && solveResult?.chatReply && (
                <>
                  <TheoremBox type="definition" title={inputQuery}>
                    <MathText text={solveResult.chatReply} />
                  </TheoremBox>
                  <TutorStructure sections={solveResult.tutorSections} />
                </>
              )}

              {/* ------- COMPUTATION ------- */}
              {isComputation && (
                <>
                  {/* Main LaTeX result */}
                  {solveResult.symbolLatex && (
                    <KaTeXBlock latex={solveResult.symbolLatex} />
                  )}

                  <TutorStructure sections={solveResult.tutorSections} />

                  {/* Step-by-step reasoning */}
                  {solveResult.chatSteps.length > 0 && (
                    <StepByStep
                      steps={solveResult.chatSteps}
                      stepVerifications={solveResult.stepVerifications}
                      finalLatex={solveResult.graphLatexBlock ?? undefined}
                    />
                  )}

                  {/* Symbol details */}
                  {(solveResult.symbolStatement || solveResult.symbolExpression) && (
                    <div className="border-l border-stone-200 pl-4">
                      {solveResult.symbolStatement && (
                        <p className="font-serif text-2xl leading-tight text-stone-950">
                          {solveResult.symbolStatement}
                        </p>
                      )}
                      {solveResult.symbolExpression && (
                        <p className="mt-3 font-mono text-sm text-stone-600">
                          {solveResult.symbolExpression}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Proof section */}
                  {solveResult.proofState && (
                    <TheoremBox type="proof">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <span className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-stone-400">
                          {solveResult.proofState}
                        </span>
                        {solveResult.proofDurationMs != null && solveResult.proofDurationMs > 0 && (
                          <span className="font-mono text-[0.6rem] text-stone-400">
                            {solveResult.proofDurationMs} ms
                          </span>
                        )}
                      </div>
                      {solveResult.proofSummary && (
                        <pre
                          className="overflow-x-auto font-mono text-xs leading-7 text-stone-600"
                          data-testid="proof-state"
                        >
                          {solveResult.proofSummary}
                        </pre>
                      )}
                    </TheoremBox>
                  )}

                  {/* Graph section (Desmos + GeoGebra tabs) */}
                  {hasGraph && (
                    <GraphSection
                      desmosConfig={desmosConfig}
                      geogebraConfig={geogebraConfig}
                    />
                  )}
                </>
              )}

              {/* Error at the bottom for computation/chat modes */}
              {hasError && (isChat || isComputation) && (
                <p className="text-sm leading-6 text-rose-700">{solveResult.error}</p>
              )}
            </section>
          )}
        </div>
      </div>

      <CommandBar onSubmit={handleSubmit} isLoading={isLoading} />
    </>
  )
}

export default HomePage
