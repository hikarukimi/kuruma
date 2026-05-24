import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type MessageType = 'error' | 'warning' | 'success' | 'info';

type MessageInput = {
  text: string;
  type?: MessageType;
  duration?: number;
};

type MessageItem = Required<MessageInput> & {
  id: number;
};

type MessageContextValue = {
  showMessage: (message: MessageInput) => void;
};

const MessageContext = createContext<MessageContextValue | null>(null);

const defaultDuration = 4000;

const messageStyles: Record<MessageType, { container: object; text: object }> = {
  error: {
    container: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
    text: { color: '#be123c' },
  },
  warning: {
    container: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
    text: { color: '#b45309' },
  },
  success: {
    container: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
    text: { color: '#047857' },
  },
  info: {
    container: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
    text: { color: '#1d4ed8' },
  },
};

export function MessageProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const nextIdRef = useRef(1);

  const closeMessage = useCallback((id: number) => {
    setMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
  }, []);

  const showMessage = useCallback(
    ({ duration = defaultDuration, text, type = 'info' }: MessageInput) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      const id = nextIdRef.current;
      nextIdRef.current += 1;

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          duration,
          id,
          text: trimmedText,
          type,
        },
      ]);

      setTimeout(() => closeMessage(id), duration);
    },
    [closeMessage]
  );

  const contextValue = useMemo(() => ({ showMessage }), [showMessage]);

  return (
    <MessageContext.Provider value={contextValue}>
      {children}
      <View pointerEvents="box-none" style={styles.overlay}>
        {messages.map((message) => (
          <View
            key={message.id}
            pointerEvents="box-none"
            style={[styles.message, messageStyles[message.type].container]}>
            <Text style={[styles.messageText, messageStyles[message.type].text]}>
              {message.text}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => closeMessage(message.id)}
              style={styles.closeButton}>
              <Text style={[styles.closeText, messageStyles[message.type].text]}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </MessageContext.Provider>
  );
}

export function useMessage() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage must be used within MessageProvider');
  }

  return context;
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  closeText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  message: {
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 4,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#0f172a',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  overlay: {
    gap: 10,
    left: 16,
    position: 'absolute',
    right: 16,
    top: 56,
    zIndex: 1000,
  },
});
