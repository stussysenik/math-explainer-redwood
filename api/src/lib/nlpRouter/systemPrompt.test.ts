import { buildMathSystemPrompt } from './systemPrompt'

describe('buildMathSystemPrompt', () => {
  it('applies the study-tutor structure to the strict math JSON adapter', () => {
    const prompt = buildMathSystemPrompt('nim')

    expect(prompt).toContain('build deep, transferable understanding')
    expect(prompt).toContain('Start with a compact map of the problem')
    expect(prompt).toContain('intuition')
    expect(prompt).toContain('formal statement')
    expect(prompt).toContain('mechanism or derivation')
    expect(prompt).toContain('worked example')
    expect(prompt).toContain('common failure mode')
    expect(prompt).toContain('If an image is present, transcribe the visible mathematics first')
    expect(prompt).toContain('display')
    expect(prompt).toContain('step_verifications')
    expect(prompt).toContain('desmos_expressions')
    expect(prompt).toContain('tutor_sections')
    expect(prompt).toContain('problem_map')
    expect(prompt).toContain('check_questions')
  })

  it('keeps the tool-driven adapter aligned with the same teaching flow', () => {
    const prompt = buildMathSystemPrompt('anthropic')

    expect(prompt).toContain('Use the provided tools to answer math questions')
    expect(prompt).toContain('compact map of the problem')
    expect(prompt).toContain('worked example')
    expect(prompt).toContain('common failure mode')
    expect(prompt).toContain('sympy_compute')
    expect(prompt).toContain('explain_concept')
    expect(prompt).toContain('display')
    expect(prompt).toContain('step_verifications')
    expect(prompt).toContain('tutor_sections')
  })
})
