// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backfillEvents } from './events';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('backfillEvents', () => {
  afterEach(() => vi.restoreAllMocks());

  it('omits the before cursor on the first (newest) page', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ events: [], nextBefore: 0 }));

    await backfillEvents({ limit: 100 });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).not.toContain('before=');
    expect(url).toContain('limit=100');
  });

  it('sends the before cursor when paging backward into history', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ events: [], nextBefore: 0 }));

    await backfillEvents({ before: 1781711087119, limit: 100 });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('before=1781711087119');
  });

  it('parses the newest-first page with its nextBefore cursor', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        events: [
          { seq: 3, type: 'artifact.synced', timestamp: '2026-06-21T18:54:43Z', agent: 'claude-code', name: 'b' },
          { seq: 2, type: 'artifact.synced', timestamp: '2026-06-21T18:53:41Z', agent: 'codex', name: 'a' },
        ],
        nextBefore: 2,
      }),
    );

    const page = await backfillEvents({ limit: 100 });
    expect(page.events[0].seq).toBe(3);
    expect(page.nextBefore).toBe(2);
  });
});
