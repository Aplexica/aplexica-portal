// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, setSessionExpiryHandler } from './client';

describe('api client', () => {
  beforeEach(() => {
    document.cookie = '__Host-aplexica_csrf=csrf-abc; path=/; Secure';
    setSessionExpiryHandler(null);
  });

  afterEach(() => {
    // Clear cookies so a stale CSRF from one test doesn't bleed into
    // the next.
    document.cookie = '__Host-aplexica_csrf=; path=/; Secure; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    vi.restoreAllMocks();
  });

  it('injects X-CSRF-Token from cookie on POST requests', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await api.post('/api/whatever', { hello: 'world' });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBe('csrf-abc');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.credentials).toBe('include');
    expect(init.body).toBe(JSON.stringify({ hello: 'world' }));
  });

  it('does NOT inject X-CSRF-Token on GET requests', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await api.get('/api/agents');

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBeNull();
  });

  it('unwraps the {error, code} envelope on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'not found', code: 'not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(api.get('/api/agents/missing')).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'not found',
    });
  });

  it('retries once on 401 via the installed expiry handler', async () => {
    let call = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return new Response(JSON.stringify({ error: 'expired', code: 'auth' }), { status: 401 });
      }
      return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const handler = vi.fn().mockResolvedValue(true);
    setSessionExpiryHandler(handler);

    const result = await api.get<{ ok: boolean }>('/api/daemon');
    expect(result).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 401 when skipRetry is set', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'bad token', code: 'auth' }), { status: 401 }),
    );
    const handler = vi.fn().mockResolvedValue(true);
    setSessionExpiryHandler(handler);

    await expect(api.post('/api/auth/bootstrap', { token: 'x' }, { skipRetry: true })).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns undefined for 204 responses (e.g. DELETE)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const out = await api.delete('/api/rules/some');
    expect(out).toBeUndefined();
  });
});
