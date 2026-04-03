import { nimRouter } from './nim'

describe('nimRouter vision support', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = {
      ...originalEnv,
      NVIDIA_NIM_API_KEY: 'test-key',
      NVIDIA_NIM_BASE_URL: 'https://example.test/v1',
      NVIDIA_NIM_MODEL: 'nim-test-model',
      NVIDIA_NIM_TIMEOUT_MS: '1000',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('sends image_url content and preserves display metadata from JSON mode', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                mode: 'computation',
                reasoning_steps: ['Extract the expression from the image.'],
                raw_latex: 'x^2',
                sympy_executable: 'x**2',
                desmos_expressions: [{ id: 'expr_1', latex: 'y=x^2' }],
                step_verifications: ['Eq(x**2, x**2)'],
                tutor_sections: {
                  problem_map: 'Translate the image into a symbolic square function.',
                  derivation: 'Identify the visible polynomial and preserve it as x^2.',
                  takeaways: ['The extracted expression is a parabola'],
                  check_questions: ['What graph shape does x^2 produce?'],
                },
                display: {
                  showGraph: true,
                  showSteps: true,
                  showProof: true,
                  graphType: '2d',
                },
              }),
            },
          },
        ],
      }),
    } as Response)

    const result = await nimRouter.toContract(
      { id: 'q_1', text: '', metadata: {} },
      {
        vision: {
          base64: 'ZmFrZQ==',
          mime: 'image/webp',
        },
      }
    )

    expect(result.ok).toBe(true)
    if (result.ok === false) {
      throw new Error('Expected NIM router to succeed.')
    }

    expect(result.response.display).toEqual({
      showGraph: true,
      showSteps: true,
      showProof: true,
      graphType: '2d',
    })
    expect(result.response.stepVerifications).toEqual(['Eq(x**2, x**2)'])
    expect(result.response.tutorSections).toEqual({
      problemMap: 'Translate the image into a symbolic square function.',
      derivation: 'Identify the visible polynomial and preserve it as x^2.',
      takeaways: ['The extracted expression is a parabola'],
      checkQuestions: ['What graph shape does x^2 produce?'],
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [, request] = fetchSpy.mock.calls[0]
    const payload = JSON.parse(String(request?.body)) as {
      messages: Array<{ role: string; content: unknown }>
    }

    expect(payload.messages[1].content).toEqual([
      {
        type: 'text',
        text: 'Analyze the uploaded image and extract the mathematical problem',
      },
      {
        type: 'image_url',
        image_url: { url: 'data:image/webp;base64,ZmFrZQ==' },
      },
    ])
  })
})
