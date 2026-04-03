import type { MathQuery } from 'src/lib/pipeline/types'

import { stubRouter } from './stub'

describe('stubRouter', () => {
  it('returns an upload-specific response for image-only requests', async () => {
    const query: MathQuery = {
      id: 'query_1',
      text: '',
      metadata: {},
    }

    const result = await stubRouter.toContract(query, {
      vision: {
        base64: 'ZmFrZQ==',
        mime: 'image/png',
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok === false) {
      throw new Error('Expected a successful stub response.')
    }

    expect(result.response.mode).toBe('chat')
    expect(result.response.chatReply).toContain('image')
    expect(result.response.chatReply).toContain('prompt')
  })

  it('formats fallback suggestions with math delimiters', async () => {
    const query: MathQuery = {
      id: 'query_2',
      text: 'Solve these!',
      metadata: {},
    }

    const result = await stubRouter.toContract(query)

    expect(result.ok).toBe(true)
    if (result.ok === false) {
      throw new Error('Expected a successful stub response.')
    }

    expect(result.response.mode).toBe('chat')
    expect(result.response.chatReply).toContain('$P(X > 12)$')
    expect(result.response.chatReply).toContain('$\\sin(x) \\cdot e^x$')
    expect(result.response.chatReply).toContain("$y'' + 4y = 0$")
  })
})
