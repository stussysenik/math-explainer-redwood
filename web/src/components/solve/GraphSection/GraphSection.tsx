import { useState } from 'react'

import DesmosGraph from 'src/components/math/DesmosGraph/DesmosGraph'
import GeoGebraGraph from 'src/components/math/GeoGebraGraph/GeoGebraGraph'
import type { DesmosPayload, GeoGebraPayload } from 'src/types/solve'

type Engine = 'desmos' | 'geogebra'

interface Props {
  desmosConfig: DesmosPayload | null
  geogebraConfig: GeoGebraPayload | null
}

/**
 * Tabbed container that renders Desmos and/or GeoGebra graphs.
 *
 * Only shows tabs for engines that actually have data. If both are present,
 * a pill-style tab row lets the user switch between them. If only one is
 * present the graph renders without tabs.
 */
const GraphSection = ({ desmosConfig, geogebraConfig }: Props) => {
  const hasDesmos = desmosConfig !== null && (desmosConfig.expressions?.length ?? 0) > 0
  const hasGeogebra = geogebraConfig !== null && !!geogebraConfig.command

  // Nothing to render
  if (!hasDesmos && !hasGeogebra) return null

  const availableEngines: Engine[] = []
  if (hasDesmos) availableEngines.push('desmos')
  if (hasGeogebra) availableEngines.push('geogebra')

  // Default to first available engine
  const [activeTab, setActiveTab] = useState<Engine>(availableEngines[0])

  const showTabs = availableEngines.length > 1

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-stone-400">
          Graph
        </p>
        {showTabs && (
          <div className="flex gap-1 rounded-full border border-stone-200 bg-white p-0.5">
            {availableEngines.map((engine) => (
              <button
                key={engine}
                type="button"
                onClick={() => setActiveTab(engine)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === engine
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {engine === 'desmos' ? 'Desmos' : 'GeoGebra'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="h-[60vh] min-h-[22rem] w-full overflow-hidden rounded-none border-y border-stone-200 bg-stone-50 sm:rounded-2xl sm:border"
        data-testid="graph-container"
      >
        {activeTab === 'desmos' && hasDesmos && (
          <DesmosGraph config={desmosConfig} />
        )}
        {activeTab === 'geogebra' && hasGeogebra && (
          <GeoGebraGraph
            config={geogebraConfig}
            key={geogebraConfig?.command ?? ''}
          />
        )}
      </div>
    </section>
  )
}

export default GraphSection
