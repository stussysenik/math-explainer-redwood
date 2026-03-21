/**
 * Stub NLP Router — MathViz Redwood
 *
 * A deterministic, offline router that pattern-matches on the query text
 * to produce known-good AI responses. Used for development, testing, and
 * offline mode. Port of the Elixir NlpRouter.Stub module.
 *
 * Pattern priority (first match wins):
 *   1. Empty query      → default parabola x²
 *   2. Known derivatives → exact symbolic result
 *   3. Known integrals   → exact symbolic result
 *   4. Theory questions  → chat mode with explanation
 *   5. Explicit math     → computation mode, parse directly
 *   6. Fallback          → chat mode, apologetic message
 */

import type {
  AIResponse,
  DesmosExpression,
  MathQuery,
  NlpRouter,
} from '../pipeline/types'

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Normalize query text for pattern matching. */
function normalize(text: string): string {
  return text.trim().toLowerCase()
}

/** Build a computation-mode AIResponse. */
function computationResponse(opts: {
  latex: string
  sympy: string
  desmos: string
  steps?: string[]
}): AIResponse {
  return {
    mode: 'computation',
    reasoningSteps: opts.steps ?? [`Computed result: ${opts.latex}`],
    rawLatex: opts.latex,
    sympyExecutable: opts.sympy,
    desmosExpressions: [{ id: 'expr_1', latex: opts.desmos }],
    chatReply: null,
    toolCalls: [],
  }
}

/** Build a chat-mode AIResponse. */
function chatResponse(reply: string, steps?: string[]): AIResponse {
  return {
    mode: 'chat',
    reasoningSteps: steps ?? ['Providing explanation'],
    rawLatex: null,
    sympyExecutable: null,
    desmosExpressions: [],
    chatReply: reply,
    toolCalls: [],
  }
}

// ─── Concept Keywords ──────────────────────────────────────────────────────

const CONCEPT_KEYWORDS = [
  'derivative',
  'integral',
  'limit',
  'function',
  'equation',
  'theorem',
  'proof',
  'calculus',
  'algebra',
  'geometry',
  'trigonometry',
  'matrix',
  'vector',
  'polynomial',
  'logarithm',
  'exponential',
  'series',
  'sequence',
  'probability',
  'statistics',
  'topology',
  'group theory',
  'linear algebra',
  'differential equation',
  'complex analysis',
  'number theory',
  'set theory',
  'graph theory',
  'combinatorics',
  'optimization',
  'fourier',
  'laplace',
  'transform',
]

const QUESTION_PATTERNS = [
  'what is',
  'what are',
  'explain',
  'how does',
  'how do',
  'why is',
  'why does',
  'define',
  'describe',
  'tell me about',
  'can you explain',
  '?',
]

// ─── Pattern Matchers ──────────────────────────────────────────────────────

function matchDerivative(q: string): AIResponse | null {
  if (q.includes('derivative of sin')) {
    return computationResponse({
      latex: '\\cos(x)',
      sympy: 'diff(sin(x), x)',
      desmos: 'y=\\cos(x)',
      steps: ['Apply derivative rule: d/dx[sin(x)] = cos(x)'],
    })
  }
  if (q.includes('derivative of cos')) {
    return computationResponse({
      latex: '-\\sin(x)',
      sympy: 'diff(cos(x), x)',
      desmos: 'y=-\\sin(x)',
      steps: ['Apply derivative rule: d/dx[cos(x)] = -sin(x)'],
    })
  }
  if (q.includes('derivative of x^2') || q.includes('derivative of x²')) {
    return computationResponse({
      latex: '2 x',
      sympy: 'diff(x**2, x)',
      desmos: 'y=2*x',
      steps: ['Apply power rule: d/dx[x²] = 2x'],
    })
  }
  return null
}

function matchIntegral(q: string): AIResponse | null {
  if (q.includes('integral of x^2') || q.includes('integral of x²')) {
    return computationResponse({
      latex: '\\frac{x^3}{3}',
      sympy: 'integrate(x**2, x)',
      desmos: 'y=x^3/3',
      steps: ['Apply power rule for integration: ∫x² dx = x³/3 + C'],
    })
  }
  return null
}

function matchTheoryQuestion(q: string): AIResponse | null {
  const hasConceptKeyword = CONCEPT_KEYWORDS.some((kw) => q.includes(kw))
  const hasQuestionPattern = QUESTION_PATTERNS.some((pat) => q.includes(pat))

  if (hasConceptKeyword && hasQuestionPattern) {
    // Use specific replies for common concepts, matching original Elixir stub
    if (q.includes('integral')) {
      return chatResponse(
        'An integral accumulates quantity over a range. You can read it as adding infinitely small pieces together. In calculus, a definite integral gives total accumulated value, such as area under a curve, while an indefinite integral gives a family of antiderivatives.',
        ['Recognize the prompt as a conceptual calculus question.']
      )
    }
    if (q.includes('derivative')) {
      return chatResponse(
        'A derivative measures how fast a quantity changes with respect to another quantity. Geometrically, it is the slope of the tangent line to a curve at a point. In applications, it captures rates of change like velocity, growth, or sensitivity.',
        ['Recognize the prompt as a conceptual calculus question.']
      )
    }
    // Generic theory reply
    const concept =
      CONCEPT_KEYWORDS.find((kw) => q.includes(kw)) ?? 'this concept'
    return chatResponse(
      `I read your question as a theory question about ${concept}, so I am answering directly instead of forcing it through the symbolic pipeline.`,
      ['Recognize the prompt as a conceptual math question.']
    )
  }
  return null
}

function matchExplicitExpression(q: string): AIResponse | null {
  // Check for explicit math expression markers
  const hasEquals = q.includes('=')
  const hasTrigOrTranscendental = /\b(sin|cos|tan|exp|log)\b/.test(q)
  const hasPower = /x\^?\d/.test(q) || /x²|x³/.test(q)

  if (hasEquals || hasTrigOrTranscendental || hasPower) {
    // Try to extract the expression from the query
    let expression = q
    // Remove common prefixes like "graph", "plot", "compute", "solve"
    expression = expression
      .replace(/^(graph|plot|compute|solve|evaluate|simplify|expand)\s+/i, '')
      .trim()

    // Build a latex-ish representation (best effort for stub)
    const latex = expression
      .replace(/\*\*/g, '^')
      .replace(/\*/g, ' \\cdot ')
    const sympy = expression
    const desmos = expression.startsWith('y=')
      ? expression
      : `y=${expression}`

    return computationResponse({
      latex,
      sympy,
      desmos,
      steps: [`Parsed expression: ${expression}`],
    })
  }
  return null
}

// ─── Stub Router ───────────────────────────────────────────────────────────

export const stubRouter: NlpRouter = {
  async toContract(query: MathQuery) {
    const q = normalize(query.text)

    // 1. Empty query → default parabola
    if (q === '') {
      return {
        ok: true as const,
        response: computationResponse({
          latex: 'x^2',
          sympy: 'x**2',
          desmos: 'y=x^2',
          steps: ['Default: showing parabola x²'],
        }),
        adapter: 'stub',
      }
    }

    // 2. Known derivatives
    const derivResult = matchDerivative(q)
    if (derivResult) {
      return { ok: true as const, response: derivResult, adapter: 'stub' }
    }

    // 3. Known integrals
    const integralResult = matchIntegral(q)
    if (integralResult) {
      return { ok: true as const, response: integralResult, adapter: 'stub' }
    }

    // 4. Theory / conceptual questions
    const theoryResult = matchTheoryQuestion(q)
    if (theoryResult) {
      return { ok: true as const, response: theoryResult, adapter: 'stub' }
    }

    // 5. Explicit math expressions
    const exprResult = matchExplicitExpression(q)
    if (exprResult) {
      return { ok: true as const, response: exprResult, adapter: 'stub' }
    }

    // 6. Fallback → chat mode
    return {
      ok: true as const,
      response: chatResponse(
        'I need a specific math problem to work on. Try something like:\n\n' +
          '- "Find P(X > 12) where X is normal with mean 10 and variance 4"\n' +
          '- "Derivative of sin(x) * e^x"\n' +
          '- "Solve y\'\' + 4y = 0 with y(0)=1"\n' +
          '- Or upload an image of a textbook problem using the paperclip icon\n\n' +
          'You can also ask conceptual questions like "What is the Central Limit Theorem?"',
        ['Query did not match a known computation or theory pattern']
      ),
      adapter: 'stub',
    }
  },
}
