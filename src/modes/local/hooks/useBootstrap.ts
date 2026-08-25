// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useRef, useState } from 'react';
import { bootstrap } from '../lib/api/auth';

export type BootstrapStatus = 'idle' | 'exchanging' | 'success' | 'no-token' | 'failed';

/**
 * Reads a `?bootstrap=<token>` from the URL, POSTs it to
 * /api/auth/bootstrap. The token is copied into memory and stripped from
 * browser history before the request starts. Runs exactly once on mount.
 *
 * The returned status lets the App show a brief "establishing session"
 * splash if needed; the auth/session query is the load-bearing
 * downstream check.
 */
export function useBootstrap(): { status: BootstrapStatus; retry: () => void } {
  const [status, setStatus] = useState<BootstrapStatus>('idle');
  const ranRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const exchange = useCallback(() => {
    const token = tokenRef.current;
    if (!token || inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('exchanging');
    void (async () => {
      try {
        await bootstrap(token);
        tokenRef.current = null;
        inFlightRef.current = false;
        setStatus('success');
      } catch {
        // Retain the scrubbed token only in memory so a transient failure can
        // be retried. Protected routes remain unmounted while status is failed.
        inFlightRef.current = false;
        setStatus('failed');
      }
    })();
  }, []);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const url = new URL(window.location.href);
    const token = url.searchParams.get('bootstrap');
    if (!token) {
      setStatus('no-token');
      return;
    }

    tokenRef.current = token;
    url.searchParams.delete('bootstrap');
    history.replaceState(
      history.state,
      '',
      url.pathname + (url.search ? url.search : '') + url.hash,
    );
    exchange();
  }, [exchange]);

  return { status, retry: exchange };
}
