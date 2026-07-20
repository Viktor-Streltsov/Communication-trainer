/**
 * Shared API client.
 *
 * apiFetch() behaves like fetch() but automatically:
 *   - resolves the base URL from VITE_API_BASE_URL
 *   - injects `Authorization: Bearer {token}` when a token is stored
 *
 * Token is stored in Capacitor Preferences (see storage.ts).
 * We read it lazily on every request so it is always up-to-date
 * after login / logout without needing to re-create the client.
 */

import { storageGet } from './storage';

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_USER_KEY  = 'auth_user_id';

const baseUrl = () => import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await storageGet(AUTH_TOKEN_KEY);

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${baseUrl()}${path}`, { ...init, headers });
}
