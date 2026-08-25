// SPDX-License-Identifier: AGPL-3.0-or-later
import { api, type RequestOptions } from './client';
import { WhoamiSchema, type Whoami } from '@shared/schemas';

export async function bootstrap(token: string, init?: RequestOptions): Promise<Whoami> {
  const raw = await api.post<unknown>('/api/auth/bootstrap', { token }, { ...init, skipRetry: true });
  return WhoamiSchema.parse(raw);
}

export async function session(init?: RequestOptions): Promise<Whoami> {
  const raw = await api.get<unknown>('/api/auth/session', init);
  return WhoamiSchema.parse(raw);
}

export async function logout(init?: RequestOptions): Promise<void> {
  await api.post('/api/auth/logout', undefined, { ...init, skipRetry: true });
}
