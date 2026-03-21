import React from 'react'

type TheoremType = 'theorem' | 'definition' | 'proof' | 'example' | 'remark'

interface Props {
  type: TheoremType
  title?: string
  children: React.ReactNode
}

/**
 * Textbook-style math environment inspired by LaTeX amsthm.
 *
 * Renders a coloured block with a label and optional title, matching the
 * convention used in mathematics textbooks for definitions, theorems,
 * proofs, examples, and remarks.
 */

const CONFIG: Record<
  TheoremType,
  {
    label: string
    border: string
    bg: string
    labelColor: string
    italic: boolean
    serif: boolean
    qed: boolean
  }
> = {
  definition: {
    label: 'DEFINITION',
    border: 'border-l-blue-600',
    bg: 'bg-blue-50/60',
    labelColor: 'text-blue-600',
    italic: false,
    serif: false,
    qed: false,
  },
  theorem: {
    label: 'THEOREM',
    border: 'border-l-emerald-600',
    bg: 'bg-emerald-50/60',
    labelColor: 'text-emerald-600',
    italic: true,
    serif: true,
    qed: false,
  },
  proof: {
    label: 'Proof.',
    border: 'border-l-stone-400',
    bg: '',
    labelColor: 'text-stone-600',
    italic: false,
    serif: false,
    qed: true,
  },
  example: {
    label: 'EXAMPLE',
    border: 'border-l-amber-500',
    bg: 'bg-amber-50/60',
    labelColor: 'text-amber-600',
    italic: false,
    serif: false,
    qed: false,
  },
  remark: {
    label: 'Remark.',
    border: 'border-l-stone-300',
    bg: '',
    labelColor: 'text-stone-500',
    italic: false,
    serif: false,
    qed: false,
  },
}

const TheoremBox = ({ type, title, children }: Props) => {
  const c = CONFIG[type]

  return (
    <div
      className={`rounded-lg border-l-4 ${c.border} ${c.bg} px-6 py-4`}
      data-testid={`theorem-box-${type}`}
    >
      {/* Label row */}
      <p className={`mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em] ${c.labelColor}`}>
        {type === 'proof' || type === 'remark' ? (
          <em>{c.label}</em>
        ) : (
          <>
            {c.label}
            {title && (
              <span className="ml-2 normal-case tracking-normal text-stone-700">
                ({title})
              </span>
            )}
          </>
        )}
        {type !== 'proof' && type !== 'remark' && title == null && ''}
      </p>

      {/* Body */}
      <div
        className={`text-base leading-7 text-stone-700 ${c.serif ? 'font-serif' : ''} ${c.italic ? 'italic' : ''}`}
      >
        {children}
      </div>

      {/* QED tombstone for proofs */}
      {c.qed && (
        <p className="mt-3 text-right text-lg leading-none text-stone-400" aria-label="QED">
          {'  \u25A1'}
        </p>
      )}
    </div>
  )
}

export default TheoremBox
