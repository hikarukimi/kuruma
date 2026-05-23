import { apiBaseUrl, storeToken } from '.'

export type AuthUser = {
  id: number
  account: string
  phone?: string
  role: string
  displayName: string
  createdAt: string
  updatedAt: string
}

type LoginPayload = {
  account: string
  password: string
}

type LoginResponse = {
  user: AuthUser
  token: string
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await response.json().catch(() => null))

  if (!response.ok) {
    throw new Error(data?.error || '登录失败，请稍后重试')
  }

  if (!data?.user || !data.token) {
    throw new Error('登录响应格式不正确')
  }

  storeToken(data.token)

  return {
    user: data.user,
    token: data.token,
  }
}
