import { render, screen } from '@redwoodjs/testing/web'

import TutorStructure from './TutorStructure'

describe('TutorStructure', () => {
  it('renders the structured teaching sections', () => {
    render(
      <TutorStructure
        sections={{
          problemMap: 'We are studying the derivative of $x^2$.',
          firstPrinciples: 'A derivative is the limit of average rates of change.',
          formalStatement:
            "$f'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}$ when the limit exists.",
          derivation: 'Expand $(x+h)^2$, subtract $x^2$, divide by $h$, then take the limit.',
          workedExample: 'For $f(x)=x^2$, the derivative simplifies to $2x$.',
          misconception: 'A derivative is not just algebraic symbol pushing.',
          takeaways: ['Derivatives are local change laws.'],
          checkQuestions: ['What cancels before taking the limit?'],
          nextStep: 'Differentiate $x^3$ from the definition.',
        }}
      />
    )

    expect(screen.getByTestId('tutor-structure')).toBeInTheDocument()
    expect(screen.getAllByText('First Principles')).toHaveLength(2)
    expect(screen.getByText('Key Takeaways')).toBeInTheDocument()
    expect(screen.getByText('Check Questions')).toBeInTheDocument()
    expect(screen.getByText('Next Step')).toBeInTheDocument()
  })
})
