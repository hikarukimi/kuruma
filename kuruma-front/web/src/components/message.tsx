import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'

import { MessageContext, type MessageInput, type MessageItem, type MessageType } from './message-context'

const defaultDuration = 4000

const messageClassNames: Record<MessageType, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
}

export function MessageProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const nextIdRef = useRef(1)

  const closeMessage = useCallback((id: number) => {
    setMessages((currentMessages) => currentMessages.filter((message) => message.id !== id))
  }, [])

  const showMessage = useCallback(
    ({ duration = defaultDuration, text, type = 'info' }: MessageInput) => {
      const trimmedText = text.trim()
      if (!trimmedText) {
        return
      }

      const id = nextIdRef.current
      nextIdRef.current += 1

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          duration,
          id,
          text: trimmedText,
          type,
        },
      ])

      window.setTimeout(() => closeMessage(id), duration)
    },
    [closeMessage],
  )

  const contextValue = useMemo(() => ({ showMessage }), [showMessage])

  return (
    <MessageContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed top-5 right-5 z-50 grid w-[min(22rem,calc(100vw-2.5rem))] gap-3">
        {messages.map((message) => (
          <div
            className={`pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 text-sm font-medium shadow-sm ${messageClassNames[message.type]}`}
            key={message.id}
            role="status"
          >
            <span className="flex-1 leading-6">{message.text}</span>
            <button
              className="rounded px-1 text-lg leading-none opacity-70 hover:opacity-100"
              onClick={() => closeMessage(message.id)}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </MessageContext.Provider>
  )
}
