import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { Platform } from 'react-native';

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const configuredWsBaseUrl = process.env.EXPO_PUBLIC_WS_BASE_URL?.trim();

export const defaultApiBaseUrl = configuredApiBaseUrl || 'http://localhost:8080';
export const defaultWsBaseUrl = configuredWsBaseUrl || defaultApiBaseUrl.replace(/^http/, 'ws');

let authToken = '';
let isHandlingAuthExpired = false;
const authTokenStorageKey = 'kuruma.authToken';
const authTokenFileUri = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}kuruma-auth-token.txt`
  : '';

async function readStoredToken() {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(authTokenStorageKey) || '';
    }

    if (!authTokenFileUri) {
      return '';
    }

    return (await FileSystem.readAsStringAsync(authTokenFileUri)).trim();
  } catch {
    return '';
  }
}

export async function storeToken(token: string) {
  authToken = token;

  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(authTokenStorageKey, token);
    return;
  }

  if (!authTokenFileUri) {
    return;
  }

  await FileSystem.writeAsStringAsync(authTokenFileUri, token);
}

export async function clearAuthToken() {
  authToken = '';

  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(authTokenStorageKey);
    return;
  }

  if (!authTokenFileUri) {
    return;
  }

  await FileSystem.deleteAsync(authTokenFileUri, { idempotent: true });
}

export async function handleAuthExpired() {
  await clearAuthToken();

  if (isHandlingAuthExpired) {
    return;
  }

  isHandlingAuthExpired = true;
  router.replace('/login');
  setTimeout(() => {
    isHandlingAuthExpired = false;
  }, 0);
}

export async function loadAuthToken() {
  if (authToken) {
    return authToken;
  }

  authToken = await readStoredToken();
  return authToken;
}

export async function loadValidAuthToken() {
  const token = await loadAuthToken();
  if (token && isAuthTokenExpired(token)) {
    await handleAuthExpired();
    return '';
  }

  return token;
}

export async function assertAuthorizedResponse(response: Response) {
  if (response.status !== 401 && response.status !== 403) {
    return;
  }

  await handleAuthExpired();
  throw new Error('登录已失效，请重新登录');
}

export async function authHeader() {
  const token = await loadValidAuthToken();

  return {
    Authorization: `Bearer ${token}`,
  };
}

function isAuthTokenExpired(token: string) {
  const [, payload] = token.split('.');
  if (!payload) {
    return true;
  }

  try {
    const decodedPayload = JSON.parse(decodeBase64Url(payload)) as { exp?: number };
    const expiresAt = decodedPayload.exp;
    return !Number.isFinite(expiresAt) || Date.now() >= expiresAt * 1000;
  } catch {
    return true;
  }
}

function decodeBase64Url(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  let buffer = 0;
  let bits = 0;
  let output = '';

  for (const char of normalizedValue) {
    if (char === '=') {
      break;
    }

    const index = alphabet.indexOf(char);
    if (index < 0) {
      throw new Error('Invalid base64url value');
    }

    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}
