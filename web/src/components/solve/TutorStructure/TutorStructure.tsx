import MathText from 'src/components/math/MathText/MathText'
import type { TutorSections } from 'src/types/solve'

interface Props {
  sections?: TutorSections
}

function hasContent(sections?: TutorSections): sections is TutorSections {
  if (!sections) return false

  return Boolean(
    sections.problemMap ||
      sections.firstPrinciples ||
      sections.formalStatement ||
      sections.derivation ||
      sections.workedExample ||
      sections.misconception ||
      sections.nextStep ||
      sections.takeaways.length > 0 ||
      sections.checkQuestions.length > 0
  )
}

function SectionCard({
  label,
  body,
}: {
  label: string
  body?: string
}) {
  if (!body) return null

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-stone-400">
        {label}
      </p>
      <div className="mt-2 text-sm leading-7 text-stone-700">
        <MathText text={body} />
      </div>
    </div>
  )
}

const TutorStructure = ({ sections }: Props) => {
  if (!hasContent(sections)) return null

  return (
    <section
      className="space-y-4"
      aria-label="Tutor structure"
      data-testid="tutor-structure"
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-stone-400">
        First Principles
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard label="Problem Map" body={sections.problemMap} />
        <SectionCard label="First Principles" body={sections.firstPrinciples} />
        <SectionCard label="Formal Statement" body={sections.formalStatement} />
        <SectionCard label="Derivation" body={sections.derivation} />
        <SectionCard label="Worked Example" body={sections.workedExample} />
        <SectionCard label="Misconception" body={sections.misconception} />
      </div>

      {sections.takeaways.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-emerald-600">
            Key Takeaways
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-7 text-emerald-900">
            {sections.takeaways.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-2">
                <span className="font-mono text-emerald-600">{index + 1}.</span>
                <MathText text={item} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {sections.checkQuestions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-amber-700">
            Check Questions
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-7 text-amber-900">
            {sections.checkQuestions.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-2">
                <span className="font-mono text-amber-700">Q{index + 1}.</span>
                <MathText text={item} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <SectionCard label="Next Step" body={sections.nextStep} />
    </section>
  )
}

export default TutorStructure
