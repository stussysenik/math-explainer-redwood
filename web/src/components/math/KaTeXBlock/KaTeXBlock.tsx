import { useRef, useEffect } from 'react'
import katex from 'katex'

interface KaTeXBlockProps {
  latex: string
  displayMode?: boolean
  className?: string
}

const KaTeXBlock = ({ latex, displayMode = true, className = '' }: KaTeXBlockProps) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (!latex) {
      containerRef.current.innerHTML = '<p class="text-sm text-stone-500">Verified math will render here.</p>'
      return
    }
    katex.render(latex, containerRef.current, {
      throwOnError: false,
      displayMode,
      strict: false,
    })
  }, [latex, displayMode])

  return <div ref={containerRef} className={`min-h-0 py-1 ${className}`} data-testid="katex-output" />
}

export default KaTeXBlock
