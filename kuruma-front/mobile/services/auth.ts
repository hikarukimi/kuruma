import { defaultApiBaseUrl } from 'services';

type RegisterPayload = {
  account: string;
  phone?: string;
  password: string;
  displayName: string;
};

type AuthUser = {
  id: number;
  account: string;
  phone?: string;
  role: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

type RegisterResponse = {
  user: AuthUser;
};

type LoginPayload = {
  phone: string;
  password: string;
};

type LoginResponse = {
  user: AuthUser;
  token: string;
};

let authToken = '';

export function getAuthToken() {
  return authToken;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthUser> {
  const response = await fetch(`${defaultApiBaseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as Partial<RegisterResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data?.error || '注册失败，请稍后重试');
  }

  if (!data?.user) {
    throw new Error('注册响应格式不正确');
  }

  return data.user;
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${defaultApiBaseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as Partial<LoginResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data?.error || '登录失败，请稍后重试');
  }

  if (!data?.user || !data.token) {
    throw new Error('登录响应格式不正确');
  }

  authToken = data.token;

  return {
    user: data.user,
    token: data.token,
  };
}
