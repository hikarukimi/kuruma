import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export const defaultApiBaseUrl = 'http://localhost:8080';
export const defaultWsBaseUrl = 'ws://localhost:8080';

let authToken = '';
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

export async function loadAuthToken() {
  if (authToken) {
    return authToken;
  }

  authToken = await readStoredToken();
  return authToken;
}

export async function authHeader() {
  const token = await loadAuthToken();

  return {
    Authorization: `Bearer ${token}`
  };
}
