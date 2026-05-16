import { defaultApiBaseUrl } from 'services';

type RegisterPayload = {
  account: string;
  phone?: string;
  password: string;
  displayName: string;
};

type RegisterUser = {
  id: number;
  account: string;
  phone?: string;
  role: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

type RegisterResponse = {
  user: RegisterUser;
};

export async function registerUser(payload: RegisterPayload): Promise<RegisterUser> {
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
