import { defaultWsBaseUrl, handleAuthExpired, loadValidAuthToken } from 'services';
import type { AccidentSession } from 'services/sessions';

type ConnectDriverRealtimeOptions = {
  sessionId: string;
  onSessionUpdated: (session: AccidentSession) => void;
  onError: (message: string) => void;
  onSignal?: (message: RealtimeSignalMessage) => void;
  onOpen?: (socket: WebSocket) => void;
};

export type RealtimeSignalMessage = {
  type: string;
  sessionId?: string;
  role?: string;
  payload?: unknown;
};

export async function connectDriverRealtime(options: ConnectDriverRealtimeOptions) {
  const token = await loadValidAuthToken();
  if (!token) {
    await handleAuthExpired();
    throw new Error('请先登录');
  }

  const params = new URLSearchParams({
    sessionId: options.sessionId,
    role: 'driver',
    token,
  });
  const socket = new WebSocket(`${defaultWsBaseUrl}/api/v1/ws?${params.toString()}`);

  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'session.join' }));
    options.onOpen?.(socket);
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'session.updated' && message.payload) {
      options.onSessionUpdated(message.payload);
      return;
    }

    if (message.type?.startsWith('webrtc.')) {
      options.onSignal?.(message);
    }
  };

  socket.onerror = () => {
    options.onError('实时状态连接异常');
  };

  socket.onclose = (event) => {
    if (!event.wasClean) {
      options.onError('实时状态连接已断开');
    }
  };

  return socket;
}

export function sendDriverHeartbeat(socket: WebSocket) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'driver.heartbeat' }));
  }
}

export function sendRealtimeSignal(socket: WebSocket | null, type: string, payload?: unknown) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, payload }));
  }
}
