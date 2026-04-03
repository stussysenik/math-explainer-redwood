import type { GateEvent } from 'src/hooks/useSolveStream'

/**
 * Pipeline gate definitions.
 *
 * Each gate in the solve pipeline has a key and a label-builder function.
 * The label function receives the gate's data payload and returns a
 * human-readable description for the progress indicator.
 */
const GATE_DEFS: Record<string, (data: Record<string, unknown>) => string> = {
  input: () => 'Input validated',
  planner: (d) => {
    const backend = (d.backend as string) || 'planner'
    const tools = Array.isArray(d.tools) ? d.tools.join(' → ') : 'default route'
    return `Planner: ${backend} → ${tools}`
  },
  routing: (d) => {
    const adapter = (d.adapter as string) || '?'
    const mode = (d.mode as string) || '?'
    return `Routed via ${adapter} \u2192 ${mode}`
  },
  sympy: (d) => {
    if (d.ok === false) return 'SymPy: fallback to stub'
    const expr = (d.expression as string) || 'done'
    return `SymPy: ${expr}`
  },
  symbol: () => 'Symbol normalized',
  verify: (d) => {
    const state = d.verified ? 'true' : (d.state as string) || 'pending'
    return `Verified: ${state}`
  },
  graph: () => 'Graph ready',
  step_verification: (d) => {
    const verified = typeof d.verified === 'number' ? d.verified : '?'
    const total = typeof d.total === 'number' ? d.total : '?'
    return `Step checks: ${verified}/${total}`
  },
}

/** Ordered list of gates for rendering future (not-yet-reached) gates. */
const GATE_ORDER = ['input', 'planner', 'routing', 'sympy', 'symbol', 'verify', 'graph', 'step_verification']

interface Props {
  gates: GateEvent[]
  currentGate: string | null
}

/**
 * GateProgress -- compact pipeline progress indicator.
 *
 * Renders each gate as a single line with a status icon:
 *   - Passed gate  -> green checkmark
 *   - Current gate -> pulsing amber dot
 *   - Future gate  -> gray circle
 *   - Failed gate  -> red X
 *
 * Designed to sit inside the result area while the streaming hook
 * animates through gate events.
 */
const GateProgress = ({ gates, currentGate }: Props) => {
  // Build a lookup of gates that have arrived so far
  const gateMap = new Map(gates.map((g) => [g.gate, g]))

  return (
    <div
      className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 space-y-1"
      role="status"
      aria-label="Pipeline progress"
    >
      {GATE_ORDER.map((key) => {
        const event = gateMap.get(key)
        const isCurrent = key === currentGate && !event
        const isPassed = event?.status === 'pass'
        const isFailed = event?.status === 'fail'
        const isSkipped = event?.status === 'skip'
        const isActiveCurrent = key === currentGate && !!event

        // Determine the label
        let label: string
        if (event) {
          const builder = GATE_DEFS[key]
          label = builder ? builder(event.data) : key
        } else {
          // Future gate — show default label
          const builder = GATE_DEFS[key]
          label = builder ? builder({}) : key
        }

        // Icon + text color
        let icon: React.ReactNode
        let textColor: string

        if (isFailed) {
          icon = <span className="text-rose-500 font-bold">&times;</span>
          textColor = 'text-rose-600'
        } else if (isPassed && !isActiveCurrent) {
          icon = (
            <svg
              className="h-3 w-3 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )
          textColor = 'text-emerald-600'
        } else if (isActiveCurrent) {
          // This gate just arrived and is the current gate — show pulsing
          icon = (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
          )
          textColor = 'text-amber-600'
        } else if (isCurrent) {
          // Current but hasn't arrived yet — pulsing
          icon = (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
          )
          textColor = 'text-amber-600'
        } else if (isSkipped) {
          icon = (
            <span className="inline-flex h-2.5 w-2.5 rounded-full border border-stone-300 bg-stone-200" />
          )
          textColor = 'text-stone-400'
        } else {
          // Future gate
          icon = (
            <span className="inline-flex h-2.5 w-2.5 rounded-full border border-stone-300" />
          )
          textColor = 'text-stone-400'
        }

        return (
          <div key={key} className="flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center">
              {icon}
            </span>
            <span className={`text-xs font-medium ${textColor}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default GateProgress
