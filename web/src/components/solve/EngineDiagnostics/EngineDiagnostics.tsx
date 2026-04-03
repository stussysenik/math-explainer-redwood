import { useState } from 'react'

import type { SolveResultData } from 'src/types/solve'

interface Props {
  result: SolveResultData
}

/**
 * Collapsible diagnostics panel that shows engine timing, adapter info,
 * proof state, and any error message. Styled as a compact detail card
 * that lives in the page header area.
 */
const EngineDiagnostics = ({ result }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-lg"
      data-testid="engine-diagnostics"
    >
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-stone-500">
          Engine
        </span>
        <svg
          className={`h-4 w-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {open && (
        <div className="mt-4 space-y-4">
          {/* Adapter badge */}
          <div className="flex items-center gap-2">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-stone-400">
              Adapter
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-[0.7rem] font-medium text-stone-600">
              {result.adapter}
            </span>
          </div>

          {/* 2x2 timing grid */}
          <div className="grid grid-cols-2 gap-3">
            <TimingCell label="N \u2192 S" ms={result.timingNlpMs} />
            <TimingCell label="SymPy" ms={result.timingSympyMs} />
            <TimingCell label="S \u2192 L" ms={result.timingVerifyMs} />
            <TimingCell label="S \u2192 G" ms={result.timingGraphMs} />
          </div>

          {result.toolRoute && (
            <div className="space-y-1">
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-stone-400">
                Planner
              </span>
              <p className="font-mono text-xs text-stone-600">
                {result.toolRoute.backend} :: {result.toolRoute.tools.join(' → ') || 'no tools'}
              </p>
              <p className="font-mono text-xs text-stone-500">
                confidence={result.toolRoute.confidence.toFixed(2)}
              </p>
            </div>
          )}

          {/* Proof state */}
          {result.proofState && (
            <div className="space-y-1">
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-stone-400">
                Proof
              </span>
              <p className="font-mono text-xs text-stone-600">{result.proofState}</p>
              {result.proofSummary && (
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-stone-500">
                  {result.proofSummary}
                </pre>
              )}
            </div>
          )}

          {/* Error */}
          {result.error && (
            <p className="text-sm leading-6 text-rose-600">{result.error}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timing cell sub-component
// ---------------------------------------------------------------------------
function TimingCell({ label, ms }: { label: string; ms: number }) {
  const display = ms > 0 ? `${ms} ms` : '\u2014'
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2">
      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-stone-400">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm text-stone-700">{display}</p>
    </div>
  )
}

export default EngineDiagnostics
