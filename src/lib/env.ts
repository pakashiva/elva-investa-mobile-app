import { Platform } from 'react-native';
import Constants from 'expo-constants';

type ExtraConfig = {
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

function readEnv(name: string): string | undefined {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) {
    return fromProcess;
  }
  return undefined;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function lanHostFromExpo(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.linkingUri ??
    '';
  const host = hostUri
    .replace(/^exp:\/\//, '')
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .trim();

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }
  return host;
}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function isLoopbackHost(url: string): boolean {
  const host = url
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .trim()
    .toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

function isReleaseBuild(): boolean {
  const execution = Constants.executionEnvironment;
  return (
    execution === 'standalone' ||
    execution === 'bare' ||
    String(Constants.appOwnership) === 'standalone'
  );
}

export function getApiBaseUrl(): string {
  const configured =
    readEnv('EXPO_PUBLIC_API_URL') ?? extra.apiBaseUrl?.trim();
  const lanHost = lanHostFromExpo();

  if (configured) {
    const base = stripTrailingSlash(configured);
    // A phone cannot reach the PC via 127.0.0.1. Use Expo's LAN host instead.
    if (isLoopbackHost(base) && lanHost && isIpv4(lanHost)) {
      return `http://${lanHost}:4000`;
    }
    return base;
  }

  if (isReleaseBuild()) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set for this build. Set it on EAS preview/production and rebuild.',
    );
  }

  if (lanHost) {
    return `http://${lanHost}:4000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }

  return 'http://127.0.0.1:4000';
}
