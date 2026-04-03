import { parseAIResponse, parseToolUseResponse } from './contracts'

describe('pipeline contracts tutor sections', () => {
  it('parses tutor_sections from JSON adapter payloads', () => {
    const response = parseAIResponse({
      mode: 'chat',
      reasoning_steps: ['Map the concept.', 'State the definition.'],
      chat_reply: 'A limit describes approach behavior.',
      tutor_sections: {
        problem_map: 'Limits study how a quantity behaves near a point.',
        first_principles:
          'Start from approaching values rather than substitution shortcuts.',
        formal_statement: 'For every epsilon there exists a delta.',
        derivation: 'Control output error by restricting input distance.',
        worked_example: 'For f(x)=x^2, the limit at 3 is 9.',
        misconception:
          'A limit does not require the function value at the point to exist.',
        takeaways: ['Limits are local', 'Epsilon-delta makes closeness precise'],
        check_questions: ['What changes if the point is missing?'],
        next_step: 'Prove a simple polynomial limit from the definition.',
      },
    })

    expect(response.tutorSections).toEqual({
      problemMap: 'Limits study how a quantity behaves near a point.',
      firstPrinciples:
        'Start from approaching values rather than substitution shortcuts.',
      formalStatement: 'For every epsilon there exists a delta.',
      derivation: 'Control output error by restricting input distance.',
      workedExample: 'For f(x)=x^2, the limit at 3 is 9.',
      misconception:
        'A limit does not require the function value at the point to exist.',
      takeaways: ['Limits are local', 'Epsilon-delta makes closeness precise'],
      checkQuestions: ['What changes if the point is missing?'],
      nextStep: 'Prove a simple polynomial limit from the definition.',
    })
  })

  it('parses tutor_sections from Anthropic tool use', () => {
    const response = parseToolUseResponse({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'explain_concept',
          input: {
            explanation: 'A derivative is an instantaneous rate of change.',
            reasoning_steps: [
              'Identify the varying quantity.',
              'Take a limit of average rates.',
            ],
            tutor_sections: {
              problem_map: 'Derivatives quantify local change.',
              first_principles:
                'Use the limit of a secant slope to define the tangent slope.',
              formal_statement:
                "f'(x)=lim_{h->0} (f(x+h)-f(x))/h when the limit exists.",
              takeaways: ['Derivative means local linear behavior'],
              check_questions: ['Why does h need to approach zero?'],
              next_step: 'Differentiate x^2 from the definition.',
            },
          },
        },
      ],
    })

    expect(response.ok).toBe(true)
    if (response.ok === false) {
      throw new Error(response.error)
    }

    expect(response.response.tutorSections).toEqual({
      problemMap: 'Derivatives quantify local change.',
      firstPrinciples:
        'Use the limit of a secant slope to define the tangent slope.',
      formalStatement:
        "f'(x)=lim_{h->0} (f(x+h)-f(x))/h when the limit exists.",
      takeaways: ['Derivative means local linear behavior'],
      checkQuestions: ['Why does h need to approach zero?'],
      nextStep: 'Differentiate x^2 from the definition.',
    })
  })
})
