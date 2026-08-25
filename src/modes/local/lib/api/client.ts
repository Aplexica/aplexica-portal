// SPDX-License-Identifier: AGPL-3.0-or-later
import { LocalApiErrorSchema } from '@shared/schemas';

/** Cookie name the daemon sets via Set-Cookie; JS readable (HttpOnly off). */
export const CSRF_COOKIE = '__Host-aplexica_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

/** Pluggable session-expiry handler. The App installs one on mount. */
export type SessionExpiryHandler = () => Promise<boolean>;
let onSessionExpired: SessionExpiryHandler | null = null;
export function setSessionExpiryHandler(h: SessionExpiryHandler | null) {
  onSessionExpired = h;
}

/** Error thrown when the daemon returns a non-2xx with a typed envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const raw of cookies) {
    const idx = raw.indexOf('=');
    if (idx === -1) continue;
    const k = raw.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(raw.slice(idx + 1));
  }
  return null;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip the one-shot retry on 401. Used by the bootstrap call itself. */
  skipRetry?: boolean;
}

/**
 * Typed fetch wrapper. Injects the CSRF double-submit header on
 * mutating verbs, sets credentials: 'include' so the session cookie
 * rides, unwraps the local error envelope { error, code }, and offers a
 * single retry on 401 via the installed expiry handler.
 */
export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers ?? {});
  headers.set('Accept', 'application/json');

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (typeof options.body === 'string' || options.body instanceof FormData) {
      body = options.body as BodyInit;
    } else {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }
  }

  if (MUTATING_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers.set(CSRF_HEADER, csrf);
  }

  const doFetch = () =>
    fetch(path, {
      ...options,
      method,
      headers,
      body,
      credentials: options.credentials ?? 'include',
    });

  let res = await doFetch();
  if (res.status === 401 && !options.skipRetry && onSessionExpired) {
    const recovered = await onSessionExpired();
    if (recovered) {
      // Refresh the CSRF header from the freshly set cookie before
      // retrying so the second attempt doesn't 403.
      if (MUTATING_METHODS.has(method)) {
        const csrf = readCookie(CSRF_COOKIE);
        if (csrf) headers.set(CSRF_HEADER, csrf);
      }
      res = await doFetch();
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Non-JSON body — preserve as a string so error path can surface.
      parsed = text;
    }
  }

  if (!res.ok) {
    const env = LocalApiErrorSchema.safeParse(parsed);
    if (env.success) {
      throw new ApiError(res.status, env.data.code, env.data.error);
    }
    throw new ApiError(res.status, 'http_error', typeof parsed === 'string' ? parsed : `HTTP ${res.status}`);
  }

  return parsed as T;
}

export const api = {
  get: <T = unknown>(path: string, init?: RequestOptions) => request<T>(path, { ...init, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'PUT', body }),
  patch: <T = unknown>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'DELETE' }),
};
