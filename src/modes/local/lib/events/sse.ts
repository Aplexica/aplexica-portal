// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState } from 'react';
import type { EventKind, SSEEvent } from '@shared/schemas';
import { EVENT_KINDS } from '@shared/schemas';

export type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

/**
 * Auto-reconnecting SSE subscription. Backoff cadence: 1s → 2s → 4s →
 * 8s → 16s → 30s cap. Resets to the start whenever a connection opens
 * successfully (the `onopen` callback fires) so a flaky network only
 * stays at the cap as long as it stays disconnected.
 *
 * `EventSourceClass` is parameterised so vitest can inject a stub
 * without needing a real `EventSource` in jsdom.
 */
export interface EventStreamHandle {
  /** Newest-first list of events received since mount. Capped at `limit`. */
  events: SSEEvent[];
  /** Current connection state — surfaces to the EventsPage status badge. */
  state: ConnectionState;
}

export interface UseEventStreamOptions {
  /** Path to the SSE endpoint. Defaults to `/api/events/stream`. */
  url?: string;
  /** Maximum events held in memory. Older events drop off the tail. */
  limit?: number;
  /** Kinds to keep; defaults to all canonical kinds. */
  kinds?: readonly string[];
  /** Optional EventSource constructor for tests. */
  EventSourceClass?: typeof EventSource;
  /** Override for the backoff schedule (ms). Tests use [0] for instant. */
  backoffSchedule?: readonly number[];
}

const DEFAULT_BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000] as const;

export function useEventStream(options: UseEventStreamOptions = {}): EventStreamHandle {
  const {
    url = '/api/events/stream',
    limit = 200,
    kinds = EVENT_KINDS,
    EventSourceClass,
    backoffSchedule = DEFAULT_BACKOFF,
  } = options;

  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [state, setState] = useState<ConnectionState>('connecting');

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIdxRef = useRef(0);
  const closedRef = useRef(false);
  const kindsRef = useRef(kinds);
  kindsRef.current = kinds;

  useEffect(() => {
    closedRef.current = false;
    const ESCtor = EventSourceClass ?? (typeof EventSource !== 'undefined' ? EventSource : undefined);
    if (!ESCtor) {
      // jsdom without polyfill — bail; the page still renders, just
      // no live updates.
      setState('closed');
      return;
    }

    const connect = () => {
      if (closedRef.current) return;
      setState((s) => (s === 'open' ? 'open' : s === 'connecting' ? 'connecting' : 'reconnecting'));
      const es = new ESCtor(url, { withCredentials: true });
      esRef.current = es;

      es.onopen = () => {
        backoffIdxRef.current = 0;
        setState('open');
      };

      const onEvent = (kind: string) => (ev: MessageEvent) => {
        let body: unknown;
        try {
          body = ev.data ? JSON.parse(ev.data) : undefined;
        } catch {
          body = ev.data;
        }
        if (!kindsRef.current.includes(kind)) return;
        const seq = Number((ev as MessageEvent & { lastEventId?: string }).lastEventId) || 0;
        const frame: SSEEvent = {
          seq,
          kind: kind as EventKind,
          ts: new Date().toISOString(),
          body,
        };
        setEvents((prev) => [frame, ...prev].slice(0, limit));
      };

      for (const k of EVENT_KINDS) es.addEventListener(k, onEvent(k));

      es.onerror = () => {
        if (closedRef.current) return;
        es.close();
        esRef.current = null;
        const delay = backoffSchedule[Math.min(backoffIdxRef.current, backoffSchedule.length - 1)];
        backoffIdxRef.current += 1;
        setState('reconnecting');
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setState('closed');
    };
    // The url string is the only reconnect-worthy dependency; ESCtor /
    // backoff schedule are effectively constants per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, limit, EventSourceClass]);

  return { events, state };
}
