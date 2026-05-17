import { defaultWsBaseUrl, loadAuthToken } from 'services';
import type { AccidentSession } from 'services/sessions';

type ConnectDriverRealtimeOptions = {
  sessionId: string;
  onSessionUpdated: (session: AccidentSession) => void;
  onError: (message: string) => void;
};

export async function connectDriverRealtime(options: ConnectDriverRealtimeOptions) {
  const token = await loadAuthToken();
  if (!token) {
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
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'session.updated' && message.payload) {
      options.onSessionUpdated(message.payload);
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
