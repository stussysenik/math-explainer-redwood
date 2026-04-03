import type { PipelineResult } from 'src/lib/pipeline/types'

export interface ClientSolveResult {
  id: string
  mode: 'computation' | 'chat'
  status: 'idle' | 'computing' | 'verifying' | 'rendering' | 'complete' | 'error'
  adapter: string
  chatReply: string | null
  chatSteps: string[]
  symbolStatement: string | null
  symbolExpression: string | null
  symbolLatex: string | null
  symbolGraphExpr: string | null
  symbolNotes: string[]
  proofVerified: boolean
  proofState: string | null
  proofSummary: string | null
  proofDurationMs: number | null
  graphDesmos: PipelineResult['graph']['desmos']
  graphGeogebra: PipelineResult['graph']['geogebra']
  graphLatexBlock: string | null
  timingNlpMs: number
  timingSympyMs: number
  timingVerifyMs: number
  timingGraphMs: number
  error: string | null
  toolRoute?: PipelineResult['toolRoute']
  engineResults?: PipelineResult['engineResults']
  display?: PipelineResult['display']
  tutorSections?: PipelineResult['tutorSections']
  stepVerifications?: PipelineResult['stepVerificationResults']
}

export function assistantContentFromPipeline(
  pipelineResult: PipelineResult
): string {
  if (pipelineResult.mode === 'chat') {
    return pipelineResult.chatReply ?? 'No response generated.'
  }

  if (pipelineResult.symbol) {
    return `${pipelineResult.symbol.statement}\n\n$$${pipelineResult.symbol.latex}$$`
  }

  return 'Computation complete.'
}

export function toClientSolveResult(
  pipelineResult: PipelineResult,
  options: { id?: string } = {}
): ClientSolveResult {
  return {
    id: options.id ?? 'stream_result',
    mode: pipelineResult.mode,
    status: pipelineResult.status,
    adapter: pipelineResult.adapter,
    chatReply: pipelineResult.chatReply,
    chatSteps: pipelineResult.chatSteps,
    symbolStatement: pipelineResult.symbol?.statement ?? null,
    symbolExpression: pipelineResult.symbol?.expression ?? null,
    symbolLatex: pipelineResult.symbol?.latex ?? null,
    symbolGraphExpr: pipelineResult.symbol?.graphExpression ?? null,
    symbolNotes: pipelineResult.symbol?.notes ?? [],
    proofVerified: pipelineResult.proof?.verified ?? false,
    proofState: pipelineResult.proof?.state ?? null,
    proofSummary: pipelineResult.proof?.summary ?? null,
    proofDurationMs: pipelineResult.proof?.durationMs ?? null,
    graphDesmos: pipelineResult.graph.desmos,
    graphGeogebra: pipelineResult.graph.geogebra,
    graphLatexBlock: pipelineResult.graph.latexBlock,
    timingNlpMs: pipelineResult.timings.nlpMs,
    timingSympyMs: pipelineResult.timings.sympyMs,
    timingVerifyMs: pipelineResult.timings.verifyMs,
    timingGraphMs: pipelineResult.timings.graphMs,
    error: pipelineResult.error,
    toolRoute: pipelineResult.toolRoute,
    engineResults: pipelineResult.engineResults,
    display: pipelineResult.display,
    tutorSections: pipelineResult.tutorSections,
    stepVerifications: pipelineResult.stepVerificationResults,
  }
}
