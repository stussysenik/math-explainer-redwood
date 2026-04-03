import { act, renderHook } from '@redwoodjs/testing/web'

import type { SolveResultData } from 'src/types/solve'

import { useSolveStream } from './useSolveStream'

describe('useSolveStream', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('stores solve identifiers and the normalized solve result from the stream endpoint', async () => {
    const streamResult: SolveResultData = {
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
      stepVerifications: [],
    }

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        conversationId: 'conversation_1',
        messageId: 'message_1',
        gates: [],
        result: streamResult,
      }),
    } as Response)

    const { result } = renderHook(() => useSolveStream())

    await act(async () => {
      await result.current.solve('integral of x^2', undefined, 'conversation_1')
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/.redwood/functions/solveStream',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query: 'integral of x^2',
          conversationId: 'conversation_1',
        }),
      })
    )
    expect(result.current.status).toBe('complete')
    expect(result.current.conversationId).toBe('conversation_1')
    expect(result.current.messageId).toBe('message_1')
    expect(result.current.result?.symbolLatex).toBe('\\frac{x^3}{3}')
  })
})
