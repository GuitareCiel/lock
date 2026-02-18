import { getCredentials } from './credentials.js';

class ApiError extends Error {
  public status: number;
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const creds = await getCredentials();
  const url = `${creds.api_url}${path}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${creds.api_key}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as { data?: T; error?: { code: string; message: string } };

  if (!res.ok) {
    const errCode = json.error?.code ?? 'UNKNOWN_ERROR';
    const errMsg = json.error?.message ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, errCode, errMsg);
  }

  return json.data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}
