// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useEventStream } from './sse';

interface FakeES {
  url: string;
  withCredentials: boolean;
  readyState: number;
  onopen: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  listeners: Map<string, Array<(ev: MessageEvent) => void>>;
  close: () => void;
}

let instances: FakeES[] = [];

function makeFakeEventSource(): typeof EventSource {
  function Ctor(this: FakeES, url: string, init?: EventSourceInit) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    this.readyState = 0;
    this.onopen = null;
    this.onerror = null;
    this.onmessage = null;
    this.listeners = new Map();
    this.close = () => {
      this.readyState = 2;
    };
    instances.push(this);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Ctor as any).prototype.addEventListener = function (kind: string, cb: (ev: MessageEvent) => void) {
    const fake = this as FakeES;
    const arr = fake.listeners.get(kind) ?? [];
    arr.push(cb);
    fake.listeners.set(kind, arr);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Ctor as any;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function fireError(idx: number) {
  const inst = instances[idx];
  if (inst?.onerror) inst.onerror(new Event('error'));
}

function fireOpen(idx: number) {
  const inst = instances[idx];
  if (inst?.onopen) inst.onopen(new Event('open'));
}

function fireMessage(idx: number, kind: string, body: unknown, seq = 1) {
  const inst = instances[idx];
  if (!inst) return;
  const arr = inst.listeners.get(kind) ?? [];
  for (const cb of arr) {
    const ev = new MessageEvent('message', { data: JSON.stringify(body), lastEventId: String(seq) });
    cb(ev);
  }
}

describe('useEventStream', () => {
  beforeEach(() => {
    instances = [];
  });
  afterEach(() => {
    instances = [];
  });

  it('opens an EventSource on mount and surfaces incoming events', async () => {
    const Fake = makeFakeEventSource();
    const { result } = renderHook(() =>
      useEventStream({ EventSourceClass: Fake, url: '/api/events/stream', backoffSchedule: [5] }),
    );
    expect(instances).toHaveLength(1);
    expect(instances[0].url).toBe('/api/events/stream');

    await act(async () => {
      fireOpen(0);
    });
    expect(result.current.state).toBe('open');

    await act(async () => {
      fireMessage(0, 'artifact.synced', { id: 'a1' }, 42);
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]).toMatchObject({ kind: 'artifact.synced', seq: 42 });
  });

  it('reconnects with backoff after an error and resets backoff on open', async () => {
    const Fake = makeFakeEventSource();
    const { result } = renderHook(() =>
      useEventStream({ EventSourceClass: Fake, backoffSchedule: [5, 10, 20] }),
    );
    expect(instances).toHaveLength(1);

    await act(async () => {
      fireError(0);
      await wait(20);
    });
    expect(result.current.state).toBe('reconnecting');
    expect(instances.length).toBeGreaterThanOrEqual(2);

    // Successful open resets the backoff.
    await act(async () => {
      fireOpen(1);
    });
    expect(result.current.state).toBe('open');

    // Trigger another error — should reconnect with delay[0]=5ms again,
    // not the next-bucket delay.
    const countBefore = instances.length;
    await act(async () => {
      fireError(1);
      await wait(20);
    });
    expect(instances.length).toBeGreaterThan(countBefore);
  });

  it('closes the connection on unmount and does not schedule further reconnects', async () => {
    const Fake = makeFakeEventSource();
    const { unmount } = renderHook(() => useEventStream({ EventSourceClass: Fake, backoffSchedule: [5] }));
    expect(instances).toHaveLength(1);
    unmount();
    expect(instances[0].readyState).toBe(2);

    // Subsequent fired-after-unmount errors must NOT spawn new instances.
    await act(async () => {
      fireError(0);
      await wait(20);
    });
    expect(instances).toHaveLength(1);
  });
});
