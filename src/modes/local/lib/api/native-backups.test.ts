// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveNativeBackupSchedule } from './native-backups';

describe('native backup API', () => {
  beforeEach(() => {
    document.cookie = '__Host-aplexica_csrf=csrf-abc; path=/';
  });

  afterEach(() => {
    document.cookie = '__Host-aplexica_csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    vi.restoreAllMocks();
  });

  it('does not send server-managed schedule run timestamps', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          enabled: true,
          intervalMinutes: 1440,
          agents: ['claude-code'],
          destination: 'cloud',
          nextRunAt: '2026-07-06T02:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await saveNativeBackupSchedule({
      enabled: true,
      intervalMinutes: 1440,
      agents: ['claude-code'],
      destination: 'cloud',
      lastRunAt: '',
      nextRunAt: '',
    });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      enabled: true,
      intervalMinutes: 1440,
      agents: ['claude-code'],
      destination: 'cloud',
    });
  });
});
