import { assertAuthorizedResponse, authHeader, defaultApiBaseUrl } from 'services';

export type AccidentSession = {
  id: string;
  driverName: string;
  driverPhoneMasked: string;
  description: string;
  locationStatus: string;
  networkStatus: string;
  driverOnline: boolean;
  signalingStatus: string;
  recordingStatus: string;
  callStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateSessionInput = Partial<
  Pick<
    AccidentSession,
    | 'driverName'
    | 'driverPhoneMasked'
    | 'description'
    | 'locationStatus'
    | 'networkStatus'
    | 'driverOnline'
    | 'signalingStatus'
    | 'recordingStatus'
    | 'callStatus'
  >
>;

type SessionResponse = {
  session?: AccidentSession;
  error?: string;
};

type SessionsResponse = {
  sessions?: AccidentSession[];
  error?: string;
};

export async function listSessions() {
  const response = await fetch(`${defaultApiBaseUrl}/api/v1/sessions`, {
    headers: await authHeader(),
  });
  await assertAuthorizedResponse(response);
  const data = (await response.json()) as SessionsResponse;

  if (!response.ok) {
    throw new Error(data.error || '获取会话列表失败');
  }

  return data.sessions || [];
}

export async function createSession(input: CreateSessionInput = {}) {
  const response = await fetch(`${defaultApiBaseUrl}/api/v1/sessions`, {
    method: 'POST',
    headers: {
      ...(await authHeader()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  await assertAuthorizedResponse(response);
  const data = (await response.json()) as SessionResponse;

  if (!response.ok || !data.session) {
    throw new Error(data.error || '创建会话失败');
  }

  return data.session;
}
