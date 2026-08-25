// SPDX-License-Identifier: AGPL-3.0-or-later
import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBootstrap } from './useBootstrap';

describe('useBootstrap', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });
  afterEach(() => {
    history.replaceState({}, '', '/');
  });

  it('does nothing when no ?bootstrap= param is present', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useBootstrap());
    await waitFor(() => expect(result.current.status).toBe('no-token'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs the token to /api/auth/bootstrap and strips it from the URL', async () => {
    history.replaceState({}, '', '/some/path?bootstrap=tok-abc&keep=yes');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ user: 'local', daemon: {}, mode: 'local' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const { result, rerender } = renderHook(() => useBootstrap(), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(fetchSpy).toHaveBeenCalledOnce();
    rerender();
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/auth/bootstrap');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe(JSON.stringify({ token: 'tok-abc' }));

    // history was rewritten without the bootstrap param
    expect(window.location.search).not.toContain('bootstrap=');
    expect(window.location.search).toContain('keep=yes');
    expect(window.location.pathname).toBe('/some/path');
  });

  it('fails closed, scrubs the token before exchange, and retries only from memory', async () => {
    history.replaceState({}, '', '/?bootstrap=bad');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized', code: 'auth' }), { status: 401 }),
    );
    const { result } = renderHook(() => useBootstrap());
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(window.location.search).not.toContain('bootstrap=');

    act(() => {
      result.current.retry();
      result.current.retry();
    });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(window.location.search).not.toContain('bootstrap=');
  });
});
