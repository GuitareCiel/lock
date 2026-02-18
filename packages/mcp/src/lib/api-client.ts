import type { ApiResponse } from './types.js';

const API_URL = process.env.LOCK_API_URL ?? 'http://localhost:3000';
const API_KEY = process.env.LOCK_API_KEY ?? '';

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: headers(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API GET ${path} failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (json.error) {
    throw new Error(`API error: ${json.error.code} - ${json.error.message}`);
  }

  return json.data as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API POST ${path} failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (json.error) {
    throw new Error(`API error: ${json.error.code} - ${json.error.message}`);
  }

  return json.data as T;
}
