const mockClassify = jest.fn()
const mockSympyExecute = jest.fn()

jest.mock('../engines/toolRouteClient', () => ({
  toolRouteClient: {
    classify: (...args: unknown[]) => mockClassify(...args),
  },
}))

jest.mock('../engines/sympyClient', () => ({
  sympyClient: {
    execute: (...args: unknown[]) => mockSympyExecute(...args),
    healthCheck: jest.fn(),
  },
}))

import { runPipeline } from './index'
import type { AIResponse, NlpRouter } from './types'

function computationRouter(response: Partial<AIResponse> = {}): NlpRouter {
  return {
    async toContract() {
      return {
        ok: true as const,
        adapter: 'stub',
        response: {
          mode: 'computation',
          reasoningSteps: ['Differentiate the polynomial.'],
          rawLatex: '2x',
          sympyExecutable: 'diff(x**2, x)',
          desmosExpressions: [{ id: 'expr_1', latex: 'y=2x' }],
          chatReply: null,
          toolCalls: [],
          stepVerifications: ['Eq(diff(x**2, x), 2*x)'],
          display: {
            showGraph: true,
            showSteps: true,
            showProof: true,
            graphType: '2d',
          },
          ...response,
        },
      }
    },
  }
}

describe('runPipeline planner provenance', () => {
  beforeEach(() => {
    mockClassify.mockReset()
    mockSympyExecute.mockReset()
    mockSympyExecute.mockResolvedValue({
      requestId: 'sympy_1',
      ok: true,
      resultString: '2*x',
      resultLatex: '2 x',
      normalizedExpression: '2*x',
      error: null,
    })
  })

  it('records a LangChain planner stage and exposes its provenance', async () => {
    mockClassify.mockResolvedValue({
      ok: true,
      plan: {
        tools: ['sympy_compute', 'wolfram_alpha'],
        confidence: 0.91,
        reasoning: 'Symbolic differentiation first, then an external check.',
        backend: 'langchain',
      },
    })

    const gates: Array<Record<string, unknown>> = []
    const result = await runPipeline('derivative of x^2', {
      router: computationRouter(),
      verifyDelayMs: 0,
      notify: (event, data) => {
        if (event.startsWith('gate:')) gates.push(data)
      },
    })

    expect(mockClassify).toHaveBeenCalledWith(
      'derivative of x^2',
      expect.objectContaining({
        hasVision: false,
        strict_verification: true,
      })
    )

    expect(result.toolRoute).toEqual({
      tools: ['sympy_compute', 'wolfram_alpha'],
      confidence: 0.91,
      reasoning: 'Symbolic differentiation first, then an external check.',
      backend: 'langchain',
    })

    expect(result.engineResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          engineName: 'tool_router',
          status: 'success',
          result: expect.objectContaining({
            backend: 'langchain',
            tools: ['sympy_compute', 'wolfram_alpha'],
          }),
        }),
        expect.objectContaining({
          engineName: 'sympy_compute',
          status: 'success',
        }),
      ])
    )

    expect(gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gate: 'planner',
          status: 'pass',
          data: expect.objectContaining({
            backend: 'langchain',
            tools: ['sympy_compute', 'wolfram_alpha'],
          }),
        }),
      ])
    )
  })

  it('degrades cleanly when the planner is unavailable', async () => {
    mockClassify.mockResolvedValue({
      ok: false,
      error: 'Sidecar timeout after 10000ms',
    })

    const gates: Array<Record<string, unknown>> = []
    const result = await runPipeline('derivative of x^2', {
      router: computationRouter(),
      verifyDelayMs: 0,
      notify: (event, data) => {
        if (event.startsWith('gate:')) gates.push(data)
      },
    })

    expect(result.toolRoute).toBeUndefined()
    expect(result.engineResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          engineName: 'tool_router',
          status: 'timeout',
          result: expect.objectContaining({
            error: 'Sidecar timeout after 10000ms',
          }),
        }),
      ])
    )
    expect(result.mode).toBe('computation')
    expect(gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gate: 'planner',
          status: 'fail',
        }),
      ])
    )
  })
})
