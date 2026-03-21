import KaTeXBlock from 'src/components/math/KaTeXBlock/KaTeXBlock'
import MathText from 'src/components/math/MathText/MathText'

interface StepVerification {
  verified: boolean
  sympyExpression?: string
  sympyResult?: string
}

interface Props {
  steps: string[]
  stepVerifications?: StepVerification[]
  finalLatex?: string
}

/**
 * Detect whether a string contains LaTeX math notation.
 * Looks for common LaTeX markers: backslashes, carets, curly braces.
 */
function looksLikeLatex(text: string): boolean {
  return /[\\^{]/.test(text)
}

/**
 * Check whether text contains $...$ or $$...$$ delimiters for inline/display math.
 */
function hasDollarDelimiters(text: string): boolean {
  return /\$[^\$]/.test(text)
}

/**
 * Renders a numbered list of computation steps with verification badges.
 *
 * Each step shows:
 * - A numbered circle (green if verified, gray if unverified)
 * - Step text with KaTeX rendering for math content
 * - A small verification badge indicating SymPy verification status
 *
 * An optional `finalLatex` is displayed at the end in a highlighted
 * answer box using KaTeX display mode.
 */
const StepByStep = ({ steps, stepVerifications, finalLatex }: Props) => {
  if (steps.length === 0 && !finalLatex) return null

  const verifiedCount = stepVerifications
    ? stepVerifications.filter((v) => v.verified).length
    : 0
  const totalSteps = steps.length
  const allVerified = stepVerifications
    ? stepVerifications.length >= totalSteps && verifiedCount === totalSteps
    : false

  return (
    <section className="space-y-3" data-testid="step-by-step">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-stone-400">
        Steps
      </p>

      <ol className="space-y-3">
        {steps.map((step, index) => {
          const verification = stepVerifications?.[index]
          const isVerified = verification?.verified ?? false

          // Circle color: green if verified, gray if no verification data, red if explicitly failed
          let circleClasses =
            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold'
          if (verification) {
            circleClasses += isVerified
              ? ' bg-emerald-100 text-emerald-700'
              : ' bg-rose-100 text-rose-600'
          } else {
            circleClasses += ' bg-stone-100 text-stone-500'
          }

          return (
            <li key={index} className="flex items-start gap-3">
              {/* Numbered circle */}
              <span className={circleClasses}>{index + 1}</span>

              {/* Step content + verification badge */}
              <div className="flex-1 pt-0.5">
                <span className="text-base leading-7 text-stone-700">
                  {hasDollarDelimiters(step) ? (
                    <MathText text={step} />
                  ) : looksLikeLatex(step) ? (
                    <KaTeXBlock
                      latex={step}
                      displayMode={false}
                      className="inline"
                    />
                  ) : (
                    step
                  )}
                </span>

                {/* Verification badge */}
                {verification ? (
                  isVerified ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-emerald-600">
                      &#10003; SYMPY VERIFIED
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-rose-500">
                      &#10007; UNVERIFIED
                    </span>
                  )
                ) : (
                  <span className="ml-2 inline-flex items-center rounded-full bg-stone-50 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-stone-400">
                    &#9675; UNVERIFIED
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Verification summary bar */}
      {stepVerifications && stepVerifications.length > 0 && (
        allVerified ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700 font-medium">
            &#10003; ALL {totalSteps} STEPS VERIFIED BY SYMPY
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700 font-medium">
            &#10003; {verifiedCount}/{totalSteps} STEPS VERIFIED
          </div>
        )
      )}

      {/* Final answer highlight */}
      {finalLatex && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 px-6 py-4">
          <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-emerald-600">
            Result
          </p>
          <KaTeXBlock latex={finalLatex} displayMode className="text-lg" />
        </div>
      )}
    </section>
  )
}

export default StepByStep
