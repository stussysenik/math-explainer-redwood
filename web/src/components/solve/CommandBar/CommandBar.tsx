import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  onSubmit: (query: string, image?: { base64: string; mime: string; filename: string }) => void
  isLoading: boolean
}

type ImageAttachment = { base64: string; mime: string; filename: string }
type AttachmentSource = 'attached' | 'pasted' | 'dropped'

function getImageFileFromTransfer(
  transfer?: Pick<DataTransfer, 'items' | 'files'> | null
) {
  const imageItem = Array.from(transfer?.items ?? []).find(
    (item) => item.kind === 'file' && item.type.startsWith('image/')
  )
  const itemFile = imageItem?.getAsFile()

  if (itemFile) return itemFile

  return (
    Array.from(transfer?.files ?? []).find((file) =>
      file.type.startsWith('image/')
    ) ?? null
  )
}

function containsFileTransfer(
  transfer?: Pick<DataTransfer, 'items' | 'files' | 'types'> | null
) {
  if (!transfer) return false

  if (Array.from(transfer.files ?? []).length > 0) {
    return true
  }

  if (Array.from(transfer.items ?? []).some((item) => item.kind === 'file')) {
    return true
  }

  return Array.from(transfer.types ?? []).includes('Files')
}

const CommandBar = ({ onSubmit, isLoading }: Props) => {
  const [query, setQuery] = useState('')
  const [imageData, setImageData] = useState<ImageAttachment | null>(null)
  const [attachmentStatus, setAttachmentStatus] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const dragDepthRef = useRef(0)

  const loadImageFile = useCallback((file: File, source: AttachmentSource) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        setAttachmentStatus('Image could not be loaded.')
        return
      }

      const [, base64 = ''] = result.split(',')
      const mime = file.type || 'image/jpeg'
      const filename =
        file.name && file.name.trim() !== ''
          ? file.name
          : source === 'pasted'
            ? 'pasted-image.png'
            : source === 'dropped'
              ? 'dropped-image.png'
              : 'image'

      const sourceLabel =
        source === 'pasted'
          ? 'Pasted'
          : source === 'dropped'
            ? 'Dropped'
            : 'Attached'

      setImageData({ base64, mime, filename })
      setAttachmentStatus(`${sourceLabel} image ready: ${filename}`)
      textareaRef.current?.focus()
    }
    reader.onerror = () => {
      setAttachmentStatus('Image could not be loaded.')
    }
    reader.readAsDataURL(file)
  }, [])

  const attachImageFromTransfer = useCallback((
    transfer: Pick<DataTransfer, 'items' | 'files'> | null | undefined,
    source: Extract<AttachmentSource, 'pasted' | 'dropped'>
  ) => {
    const file = getImageFileFromTransfer(transfer)
    if (!file) return false

    loadImageFile(file, source)
    return true
  }, [loadImageFile])

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
    setAttachmentStatus('')
  }, [query, imageData, isLoading, onSubmit])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    loadImageFile(file, 'attached')

    // Reset the input so the same file can be re-selected
    e.target.value = ''
  }, [loadImageFile])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLFormElement>) => {
    const didAttach = attachImageFromTransfer(e.clipboardData, 'pasted')
    if (!didAttach) return

    e.preventDefault()
  }, [attachImageFromTransfer])

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLFormElement>) => {
    if (isLoading || !containsFileTransfer(e.dataTransfer)) return

    e.preventDefault()
    dragDepthRef.current += 1
    setIsDragActive(true)
  }, [isLoading])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLFormElement>) => {
    if (isLoading || !containsFileTransfer(e.dataTransfer)) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isDragActive) {
      setIsDragActive(true)
    }
  }, [isDragActive, isLoading])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLFormElement>) => {
    if (!containsFileTransfer(e.dataTransfer)) return

    e.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLFormElement>) => {
    if (!containsFileTransfer(e.dataTransfer)) return

    e.preventDefault()
    dragDepthRef.current = 0
    setIsDragActive(false)

    const didAttach = attachImageFromTransfer(e.dataTransfer, 'dropped')
    if (didAttach) return

    setAttachmentStatus('Only image files can be dropped here.')
  }, [attachImageFromTransfer])

  const handleClearImage = useCallback(() => {
    setImageData(null)
    setAttachmentStatus('Image removed.')
  }, [])

  useEffect(() => {
    const handleWindowPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || isLoading) return

      const didAttach = attachImageFromTransfer(event.clipboardData, 'pasted')
      if (!didAttach) return

      event.preventDefault()
    }

    window.addEventListener('paste', handleWindowPaste)

    return () => {
      window.removeEventListener('paste', handleWindowPaste)
    }
  }, [attachImageFromTransfer, isLoading])

  return (
    <div className="sticky bottom-0 z-30 mt-auto pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="-mx-4 bg-white/90 px-4 pt-4 backdrop-blur sm:mx-0 sm:bg-transparent sm:px-0">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onPaste={handlePaste}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mx-auto max-w-2xl rounded-[1.5rem] border bg-white/95 p-3 shadow-lg shadow-stone-900/5 transition-colors sm:p-4 ${isDragActive ? 'border-stone-400 bg-stone-50/95' : 'border-stone-200'}`}
          aria-label="Math query"
          data-testid="command-bar-form"
        >
          <p
            id="command-bar-help"
            className="mb-2 text-xs leading-5 text-stone-500"
          >
            Type a problem, paste or drop an image, or attach a file. Press Enter to send and Shift+Enter for a new line.
          </p>

          <p
            aria-live="polite"
            className="sr-only"
            data-testid="attachment-status"
          >
            {attachmentStatus}
          </p>

          {/* Image badge */}
          {imageData && (
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs text-stone-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                  <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
                </svg>
                <span className="truncate">{imageData.filename}</span>
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="ml-0.5 rounded-full p-0.5 text-stone-500 hover:bg-white hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400"
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
              className={`min-h-[48px] w-full resize-none border-0 bg-transparent px-1 py-2 text-base text-stone-900 outline-none ring-0 placeholder:text-stone-400 focus:outline-none focus:ring-0 ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
              placeholder={isLoading ? 'Processing...' : 'Enter an equation or natural language query...'}
              data-testid="query-input"
              aria-label="Enter an equation or natural language query"
              aria-describedby="command-bar-help"
            />
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[0.7rem] leading-5 text-stone-400">
              {isDragActive
                ? 'Drop the image to attach it.'
                : 'Paste or drop an image anywhere in this composer.'}
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
            {/* Paperclip / image upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-stone-200 px-3 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
              aria-label="Attach image"
              title="Attach image"
              data-testid="attach-image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Image</span>
            </button>

            {/* Shortcut hint */}
            <span className="select-none text-[0.6rem] text-stone-400">
              {'↵ or ⌘↵'}
            </span>

            <button
              type="submit"
              disabled={isLoading || (!query.trim() && !imageData)}
              className="inline-flex min-h-11 items-center rounded-full border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-500 disabled:opacity-50"
              data-testid="submit-query"
            >
              {isLoading ? 'Sending...' : 'Submit'}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CommandBar
