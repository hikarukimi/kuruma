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
  if (!jwtToken) {
    getJwtToken()
  }

  return {
    Authorization: `Bearer ${jwtToken}`,
  }
}
