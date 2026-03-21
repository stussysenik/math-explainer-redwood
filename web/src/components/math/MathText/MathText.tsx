import { useRef, useEffect } from 'react'
import katex from 'katex'

interface Props {
  text: string
  className?: string
}

// Parse text into segments: { type: 'text' | 'inline' | 'display', content: string }
function parseSegments(text: string) {
  const segments: { type: 'text' | 'inline' | 'display'; content: string }[] = []
  // Match $$...$$ first (display), then $...$ (inline)
  // Use regex to split
  const regex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    const raw = match[0]
    if (raw.startsWith('$$')) {
      segments.push({ type: 'display', content: raw.slice(2, -2).trim() })
    } else {
      segments.push({ type: 'inline', content: raw.slice(1, -1).trim() })
    }
    lastIndex = match.index + raw.length
  }
  // Remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }
  return segments
}

const InlineKaTeX = ({ latex }: { latex: string }) => {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, { throwOnError: false, displayMode: false })
      } catch {
        if (ref.current) ref.current.textContent = latex
      }
    }
  }, [latex])
  return <span ref={ref} />
}

const DisplayKaTeX = ({ latex }: { latex: string }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, { throwOnError: false, displayMode: true })
      } catch {
        if (ref.current) ref.current.textContent = latex
      }
    }
  }, [latex])
  return <div ref={ref} className="my-3" />
}

const MathText = ({ text, className = '' }: Props) => {
  const segments = parseSegments(text)

  return (
    <div className={`whitespace-pre-line text-base leading-7 text-stone-700 ${className}`}>
      {segments.map((seg, i) => {
        if (seg.type === 'display') return <DisplayKaTeX key={i} latex={seg.content} />
        if (seg.type === 'inline') return <InlineKaTeX key={i} latex={seg.content} />
        return <span key={i}>{seg.content}</span>
      })}
    </div>
  )
}

export default MathText
