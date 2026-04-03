import { anthropicRouter } from './anthropic'

describe('anthropicRouter vision support', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = {
      ...originalEnv,
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_MODEL: 'claude-test',
      ANTHROPIC_TIMEOUT_MS: '1000',
      ANTHROPIC_MAX_TOKENS: '512',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('sends image content and preserves tool-use display metadata', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'sympy_compute',
            input: {
              expression: 'diff(x**2, x)',
              raw_latex: '2x',
              desmos_expressions: [{ id: 'expr_1', latex: 'y=2x' }],
              step_verifications: ['Eq(diff(x**2, x), 2*x)'],
              tutor_sections: {
                problem_map: 'Differentiate a polynomial.',
                first_principles: 'Use the power rule as the local change law.',
                takeaways: ['Power rule applies here'],
                check_questions: ['Why does the exponent drop by one?'],
              },
              display: {
                showGraph: true,
                showSteps: true,
                showProof: true,
                graphType: '2d',
              },
            },
          },
        ],
      }),
    } as Response)

    const result = await anthropicRouter.toContract(
      { id: 'q_1', text: '', metadata: {} },
      {
        vision: {
          base64: 'ZmFrZQ==',
          mime: 'image/png',
        },
      }
    )

    expect(result.ok).toBe(true)
    if (result.ok === false) {
      throw new Error('Expected Anthropic router to succeed.')
    }

    expect(result.response.stepVerifications).toEqual([
      'Eq(diff(x**2, x), 2*x)',
    ])
    expect(result.response.tutorSections).toEqual({
      problemMap: 'Differentiate a polynomial.',
      firstPrinciples: 'Use the power rule as the local change law.',
      takeaways: ['Power rule applies here'],
      checkQuestions: ['Why does the exponent drop by one?'],
    })
    expect(result.response.display).toEqual({
      showGraph: true,
      showSteps: true,
      showProof: true,
      graphType: '2d',
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [, request] = fetchSpy.mock.calls[0]
    const payload = JSON.parse(String(request?.body)) as {
      messages: Array<{ content: unknown }>
      tools: Array<{ name: string; input_schema: { properties: Record<string, unknown> } }>
    }

    expect(payload.messages[0].content).toEqual([
      {
        type: 'text',
        text: 'Analyze the uploaded image and extract the mathematical problem',
      },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: 'ZmFrZQ==',
        },
      },
    ])

    const sympyTool = payload.tools.find((tool) => tool.name === 'sympy_compute')
    expect(sympyTool?.input_schema.properties.step_verifications).toBeDefined()
    expect(sympyTool?.input_schema.properties.tutor_sections).toBeDefined()
    expect(sympyTool?.input_schema.properties.display).toBeDefined()
  })
})
