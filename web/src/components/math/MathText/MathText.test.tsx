import { render, waitFor } from '@redwoodjs/testing/web'

import MathText from './MathText'

describe('MathText', () => {
  it('renders KaTeX markup for delimited inline math', async () => {
    const { container } = render(
      <MathText text={'Find $P(X > 12)$ where $X$ is normal with mean $10$.'} />
    )

    await waitFor(() => {
      expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(3)
    })
  })
})
