import { getApiBaseUrl } from './env';
import { getStoredToken } from '../services/sessionStore';
import { Platform } from 'react-native';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = RequestInit & {
  auth?: boolean;
};

async function parseBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    return body ?? {};
  } catch {
    return {};
  }
}

function errorMessage(body: Record<string, unknown>, status: number): string {
  const error = body.error;
  const message = body.message;
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }
  return `Request failed (${status}).`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const token = auth ? await getStoredToken() : null;
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (error) {
    const cause = error instanceof Error ? ` (${error.message})` : '';
    const troubleshooting = Platform.OS === 'web'
      ? ' Start the ELVA CAPITA API from the admin portal with `npm run dev:api` (port 4000).'
      : ' Confirm the phone and computer share Wi-Fi, the API is running, and TCP port 4000 is allowed.';
    throw new Error(
      `Cannot reach ELVA CAPITA at ${url}${cause}.${troubleshooting}`
    );
  }

  const body = await parseBody(response);
  if (!response.ok) {
    throw new ApiError(errorMessage(body, response.status), response.status);
  }
  return body as T;
}
