import { useState, useRef, useCallback } from 'react'

interface Props {
  onSubmit: (query: string, image?: { base64: string; mime: string; filename: string }) => void
  isLoading: boolean
}

const CommandBar = ({ onSubmit, isLoading }: Props) => {
  const [query, setQuery] = useState('')
  const [imageData, setImageData] = useState<{ base64: string; mime: string; filename: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter (no shift) → submit
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
    // Shift+Enter → allow default (newline)
    // Cmd/Ctrl+Enter → submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }, [])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if ((!trimmed && !imageData) || isLoading) return
    onSubmit(trimmed, imageData ?? undefined)
    setQuery('')
    setImageData(null)
  }, [query, imageData, isLoading, onSubmit])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // result is "data:<mime>;base64,<data>"
      const base64 = result.split(',')[1]
      const mime = file.type || 'image/jpeg'
      setImageData({ base64, mime, filename: file.name })
    }
    reader.readAsDataURL(file)

    // Reset the input so the same file can be re-selected
    e.target.value = ''
  }, [])

  const handleClearImage = useCallback(() => {
    setImageData(null)
  }, [])

  return (
    <div className="sticky bottom-0 z-30 mt-auto pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="-mx-4 bg-white/90 px-4 pt-4 backdrop-blur sm:mx-0 sm:bg-transparent sm:px-0">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mx-auto max-w-2xl rounded-[1.5rem] border border-stone-200 bg-white/95 p-3 shadow-lg shadow-stone-900/5"
          aria-label="Math query"
        >
          {/* Image badge */}
          {imageData && (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                  <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
                </svg>
                {imageData.filename}
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="ml-0.5 text-stone-400 hover:text-stone-600"
                  aria-label="Remove image"
                >
                  &times;
                </button>
              </span>
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
              className={`min-h-[48px] w-full resize-none border-0 bg-transparent px-1 py-2 text-base text-stone-900 outline-none ring-0 placeholder:text-stone-400 focus:outline-none focus:ring-0 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder={isLoading ? 'Processing...' : 'Enter an equation or natural language query...'}
              data-testid="query-input"
              aria-label="Enter an equation or natural language query"
            />
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
          />

          <div className="mt-3 flex items-center justify-end gap-3">
            {/* Paperclip / image upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              aria-label="Attach image"
              title="Attach image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Shortcut hint */}
            <span className="text-[0.6rem] text-stone-400 select-none">
              {'↵ or ⌘↵'}
            </span>

            <button
              type="submit"
              disabled={isLoading || (!query.trim() && !imageData)}
              className="inline-flex items-center rounded-full border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
              data-testid="submit-query"
            >
              {isLoading ? 'Sending...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CommandBar
