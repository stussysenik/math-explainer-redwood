import type { PipelineResult } from 'src/lib/pipeline/types'

import { toClientSolveResult } from './solveResult'

describe('toClientSolveResult', () => {
  it('flattens pipeline output into the web solve-result contract', () => {
    const pipelineResult: PipelineResult = {
      query: {
        id: 'query_1',
        text: 'integral of x^2',
        metadata: {},
      },
      symbol: {
        statement: 'Result for: integral of x^2',
        expression: 'x**3/3',
        latex: '\\frac{x^3}{3}',
        graphExpression: 'y=x^3/3',
        source: 'stub',
        raw: {},
        notes: ['Apply the power rule.'],
      },
      proof: {
        verified: true,
        state: 'Proof complete',
        summary: 'Verified by the mock prover.',
        durationMs: 12,
      },
      graph: {
        desmos: {
          expressions: [{ id: 'expr_1', latex: 'y=x^3/3' }],
          viewport: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
        },
        geogebra: {
          command: 'f(x)=x^3/3',
          expression: 'x**3/3',
        },
        latexBlock: '\\displaystyle \\frac{x^3}{3}',
      },
      isVerified: true,
      mode: 'computation',
      chatReply: null,
      chatSteps: ['Apply the power rule.'],
      status: 'complete',
      timings: {
        nlpMs: 3,
        sympyMs: 4,
        verifyMs: 5,
        graphMs: 6,
      },
      adapter: 'stub',
      usedSidecar: false,
      error: null,
      toolRoute: {
        tools: ['sympy_compute', 'wolfram_alpha'],
        confidence: 0.91,
        reasoning: 'Symbolic differentiation first, then external verification.',
        backend: 'langchain',
      },
      engineResults: [
        {
          engineName: 'tool_router',
          status: 'success',
          result: {
            backend: 'langchain',
            tools: ['sympy_compute', 'wolfram_alpha'],
          },
          durationMs: 8,
        },
        {
          engineName: 'sympy_compute',
          status: 'success',
          result: { expression: 'x**3/3' },
          durationMs: 4,
        },
      ],
      tutorSections: {
        problemMap: 'Integrating x^2 asks for an antiderivative.',
        firstPrinciples: 'Reverse the power rule.',
        formalStatement:
          'If d/dx[x^3/3] = x^2, then an antiderivative is x^3/3 + C.',
        derivation:
          'Increase the exponent by one and divide by the new exponent.',
        workedExample: 'Differentiate x^3/3 to recover x^2.',
        misconception:
          'Do not forget the integration constant in indefinite integrals.',
        takeaways: ['Integration inverts differentiation'],
        checkQuestions: ['Why do we divide by 3?'],
        nextStep: 'Integrate a trig function by the same reverse-rule logic.',
      },
      display: {
        showGraph: true,
        showSteps: true,
        showProof: true,
      },
      stepVerificationResults: [
        {
          step: 0,
          verified: true,
          sympyExpression: 'Eq(integrate(x**2, x), x**3/3)',
          sympyResult: 'True',
        },
      ],
    }

    expect(toClientSolveResult(pipelineResult, { id: 'solve_1' })).toEqual({
      id: 'solve_1',
      mode: 'computation',
      status: 'complete',
      adapter: 'stub',
      chatReply: null,
      chatSteps: ['Apply the power rule.'],
      symbolStatement: 'Result for: integral of x^2',
      symbolExpression: 'x**3/3',
      symbolLatex: '\\frac{x^3}{3}',
      symbolGraphExpr: 'y=x^3/3',
      symbolNotes: ['Apply the power rule.'],
      proofVerified: true,
      proofState: 'Proof complete',
      proofSummary: 'Verified by the mock prover.',
      proofDurationMs: 12,
      graphDesmos: {
        expressions: [{ id: 'expr_1', latex: 'y=x^3/3' }],
        viewport: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
      },
      graphGeogebra: {
        command: 'f(x)=x^3/3',
        expression: 'x**3/3',
      },
      graphLatexBlock: '\\displaystyle \\frac{x^3}{3}',
      timingNlpMs: 3,
      timingSympyMs: 4,
      timingVerifyMs: 5,
      timingGraphMs: 6,
      error: null,
      toolRoute: {
        tools: ['sympy_compute', 'wolfram_alpha'],
        confidence: 0.91,
        reasoning: 'Symbolic differentiation first, then external verification.',
        backend: 'langchain',
      },
      engineResults: [
        {
          engineName: 'tool_router',
          status: 'success',
          result: {
            backend: 'langchain',
            tools: ['sympy_compute', 'wolfram_alpha'],
          },
          durationMs: 8,
        },
        {
          engineName: 'sympy_compute',
          status: 'success',
          result: { expression: 'x**3/3' },
          durationMs: 4,
        },
      ],
      tutorSections: {
        problemMap: 'Integrating x^2 asks for an antiderivative.',
        firstPrinciples: 'Reverse the power rule.',
        formalStatement:
          'If d/dx[x^3/3] = x^2, then an antiderivative is x^3/3 + C.',
        derivation:
          'Increase the exponent by one and divide by the new exponent.',
        workedExample: 'Differentiate x^3/3 to recover x^2.',
        misconception:
          'Do not forget the integration constant in indefinite integrals.',
        takeaways: ['Integration inverts differentiation'],
        checkQuestions: ['Why do we divide by 3?'],
        nextStep: 'Integrate a trig function by the same reverse-rule logic.',
      },
      display: {
        showGraph: true,
        showSteps: true,
        showProof: true,
      },
      stepVerifications: [
        {
          step: 0,
          verified: true,
          sympyExpression: 'Eq(integrate(x**2, x), x**3/3)',
          sympyResult: 'True',
        },
      ],
    })
  })
})
