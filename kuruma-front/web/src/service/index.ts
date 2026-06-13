export const apiBaseUrl = 'http://localhost:8080/api/v1'
export const wsBaseUrl = 'ws://localhost:8080/api/v1'
const authTokenStorageKey = 'kuruma.authToken'

let jwtToken = ''

export function storeToken(token: string) {
  jwtToken = token
  localStorage.setItem(authTokenStorageKey, token)
}

export function getJwtToken() {
  if (!jwtToken) {
    jwtToken = localStorage.getItem(authTokenStorageKey) || ''
  }

  return jwtToken
}

export function clearToken() {
  jwtToken = ''
  localStorage.removeItem(authTokenStorageKey)
}

export function authHeader() {
  const token = getJwtToken()
  if (!token) {
    handleAuthExpired()
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

export function handleAuthExpired() {
  clearToken()
  if (window.location.pathname !== '/login') {
    window.location.replace('/login')
  }
  throw new Error('请先登录')
}

export async function assertAuthorizedResponse(response: Response) {
  if (response.status === 401) {
    handleAuthExpired()
  }
}
