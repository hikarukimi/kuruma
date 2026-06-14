import { Camera } from 'expo-camera';
import * as Location from 'expo-location';

type PermissionStatus = {
  canAskAgain?: boolean;
  granted: boolean;
  status?: string;
};

export type AppPermissions = {
  camera: boolean;
  location: boolean;
  microphone: boolean;
};

const permissionCheckTimeoutMs = 1000;
const permissionRefreshDelayMs = 250;

export async function checkAppPermissions(): Promise<AppPermissions> {
  const [camera, microphone, location] = await Promise.all([
    checkPermission(() => Camera.getCameraPermissionsAsync()),
    checkPermission(() => Camera.getMicrophonePermissionsAsync()),
    checkPermission(() => Location.getForegroundPermissionsAsync()),
  ]);

  return {
    camera: camera.granted,
    location: location.granted,
    microphone: microphone.granted,
  };
}

export async function requestAppPermissions(): Promise<AppPermissions> {
  await requestPermission(() => Camera.requestCameraPermissionsAsync());
  await requestPermission(() => Camera.requestMicrophonePermissionsAsync());
  await requestPermission(() => Location.requestForegroundPermissionsAsync());
  await delay(permissionRefreshDelayMs);

  return checkAppPermissions();
}

export async function getAppPermissionsWithFallback(): Promise<AppPermissions> {
  const camera = await getPermissionWithFallback(
    () => Camera.getCameraPermissionsAsync(),
    () => Camera.requestCameraPermissionsAsync()
  );
  const microphone = await getPermissionWithFallback(
    () => Camera.getMicrophonePermissionsAsync(),
    () => Camera.requestMicrophonePermissionsAsync()
  );
  const location = await getPermissionWithFallback(
    () => Location.getForegroundPermissionsAsync(),
    () => Location.requestForegroundPermissionsAsync()
  );

  return {
    camera: camera.granted,
    location: location.granted,
    microphone: microphone.granted,
  };
}

async function checkPermission(checkPermissionStatus: () => Promise<PermissionStatus>) {
  return (
    (await withTimeout(checkPermissionStatus(), permissionCheckTimeoutMs)) ?? { granted: false }
  );
}

async function requestPermission(requestPermissionStatus: () => Promise<PermissionStatus>) {
  return requestPermissionStatus().catch(() => ({ granted: false }));
}

async function getPermissionWithFallback(
  checkPermission: () => Promise<PermissionStatus>,
  requestPermission: () => Promise<PermissionStatus>
) {
  const checked = await withTimeout(checkPermission(), permissionCheckTimeoutMs);
  if (checked?.granted) {
    return checked;
  }

  if (checked && checked.canAskAgain === false) {
    return checked;
  }

  const requested = await requestPermission();
  if (requested.granted) {
    return requested;
  }

  await delay(permissionRefreshDelayMs);
  const refreshed = await withTimeout(checkPermission(), permissionCheckTimeoutMs);
  return refreshed ?? requested;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(null))
      .finally(() => clearTimeout(timer));
  });
}

function delay(timeoutMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}
