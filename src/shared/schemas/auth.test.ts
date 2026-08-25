// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { BootstrapRequestSchema, WhoamiSchema } from './auth';

describe('WhoamiSchema', () => {
  it('accepts a daemon session identity', () => {
    expect(
      WhoamiSchema.safeParse({
        user: 'local-user',
        daemon: { version: '1.0.0' },
        mode: 'local',
      }).success,
    ).toBe(true);
  });

  it('rejects a missing user', () => {
    expect(WhoamiSchema.safeParse({ daemon: {}, mode: 'local' }).success).toBe(false);
  });
});

describe('BootstrapRequestSchema', () => {
  it('requires a non-empty token', () => {
    expect(BootstrapRequestSchema.safeParse({ token: 'one-time-token' }).success).toBe(true);
    expect(BootstrapRequestSchema.safeParse({ token: '' }).success).toBe(false);
  });
});
