import { act, fireEvent, render, screen, waitFor } from '@redwoodjs/testing/web'

import CommandBar from './CommandBar'

class MockFileReader {
  result: string | ArrayBuffer | null
  onload: null | (() => void)
  onerror: null | (() => void)

  constructor() {
    this.result = null
    this.onload = null
    this.onerror = null
  }

  readAsDataURL(file: File) {
    this.result = `data:${file.type};base64,ZmFrZQ==`
    if (this.onload) this.onload()
  }
}

describe('CommandBar', () => {
  const originalFileReader = global.FileReader

  beforeEach(() => {
    ;(global as typeof globalThis & { FileReader: typeof FileReader }).FileReader =
      MockFileReader as unknown as typeof FileReader
  })

  afterEach(() => {
    ;(global as typeof globalThis & { FileReader: typeof FileReader }).FileReader =
      originalFileReader
  })

  it('accepts pasted clipboard images and submits them', async () => {
    const onSubmit = jest.fn()

    render(<CommandBar onSubmit={onSubmit} isLoading={false} />)

    const textarea = screen.getByTestId('query-input')
    const file = new File(['fake'], 'clipboard.png', { type: 'image/png' })

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
      },
    })

    await waitFor(() => {
      expect(screen.getByText('clipboard.png')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('submit-query'))

    expect(onSubmit).toHaveBeenCalledWith('', {
      base64: 'ZmFrZQ==',
      mime: 'image/png',
      filename: 'clipboard.png',
    })
  })

  it('accepts dropped image files and submits them', async () => {
    const onSubmit = jest.fn()

    render(<CommandBar onSubmit={onSubmit} isLoading={false} />)

    const form = screen.getByTestId('command-bar-form')
    const file = new File(['fake'], 'drop.png', { type: 'image/png' })
    const dataTransfer = {
      items: [
        {
          kind: 'file',
          type: 'image/png',
          getAsFile: () => file,
        },
      ],
      files: [file],
      types: ['Files'],
    }

    fireEvent.dragEnter(form, { dataTransfer })
    expect(screen.getByText('Drop the image to attach it.')).toBeInTheDocument()

    fireEvent.drop(form, { dataTransfer })

    await waitFor(() => {
      expect(screen.getByText('drop.png')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('submit-query'))

    expect(onSubmit).toHaveBeenCalledWith('', {
      base64: 'ZmFrZQ==',
      mime: 'image/png',
      filename: 'drop.png',
    })
  })

  it('accepts page-level pasted clipboard images and submits them', async () => {
    const onSubmit = jest.fn()

    render(<CommandBar onSubmit={onSubmit} isLoading={false} />)

    const file = new File(['fake'], 'window-paste.png', { type: 'image/png' })
    const pasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    }) as ClipboardEvent

    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
        files: [file],
      },
      configurable: true,
    })

    act(() => {
      window.dispatchEvent(pasteEvent)
    })

    await waitFor(() => {
      expect(screen.getByText('window-paste.png')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('submit-query'))

    expect(onSubmit).toHaveBeenCalledWith('', {
      base64: 'ZmFrZQ==',
      mime: 'image/png',
      filename: 'window-paste.png',
    })
  })

  it('exposes accessible helper text for image paste and upload', () => {
    render(<CommandBar onSubmit={jest.fn()} isLoading={false} />)

    expect(
      screen.getByText(
        'Type a problem, paste or drop an image, or attach a file. Press Enter to send and Shift+Enter for a new line.'
      )
    ).toBeInTheDocument()
    expect(screen.getByTestId('attach-image')).toHaveTextContent('Image')
  })
})
