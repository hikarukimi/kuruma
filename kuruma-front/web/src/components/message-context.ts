import { createContext, useContext } from 'react'

export type MessageType = 'error' | 'warning' | 'success' | 'info'

export type MessageInput = {
  text: string
  type?: MessageType
  duration?: number
}

export type MessageItem = Required<MessageInput> & {
  id: number
}

export type MessageContextValue = {
  showMessage: (message: MessageInput) => void
}

export const MessageContext = createContext<MessageContextValue | null>(null)

export function useMessage() {
  const context = useContext(MessageContext)
  if (!context) {
    throw new Error('useMessage must be used within MessageProvider')
  }

  return context
}
