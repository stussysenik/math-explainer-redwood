export type PipelineStatus = 'idle' | 'computing' | 'verifying' | 'rendering' | 'complete' | 'error'
export type ResponseMode = 'computation' | 'chat'

export interface SymbolData {
  statement: string
  expression: string
  source: string
  notes: string[]
}

export interface ProofData {
  verified: boolean
  state: string
  summary: string
}

export interface DesmosPayload {
  expressions: Array<{ id: string; latex: string }>
  viewport: { xmin: number; xmax: number; ymin: number; ymax: number }
}

export interface GeoGebraPayload {
  command: string
  expression: string
}

export interface GraphConfig {
  desmos: DesmosPayload | null
  geogebra: GeoGebraPayload | null
}

export interface TimingData {
  nlpMs: number
  sympyMs: number
  verifyMs: number
  graphMs: number
}

export interface DisplayHints {
  showGraph: boolean
  showSteps: boolean
  showProof: boolean
  showMatrix?: boolean
  graphType?: '2d' | '3d' | 'parametric' | 'none'
}

export interface StepVerification {
  step: number
  verified: boolean
  sympyExpression?: string
  sympyResult?: string
}

export interface SolveResultData {
  id: string
  mode: ResponseMode
  status: PipelineStatus
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
  graphDesmos: DesmosPayload | null
  graphGeogebra: GeoGebraPayload | null
  graphLatexBlock: string | null
  timingNlpMs: number
  timingSympyMs: number
  timingVerifyMs: number
  timingGraphMs: number
  error: string | null
  display?: DisplayHints
  stepVerifications?: StepVerification[]
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}
