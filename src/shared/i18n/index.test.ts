// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('local string catalogue', () => {
  it('resolves local navigation strings', () => {
    expect(t('nav.dashboard')).toBe('Dashboard');
    expect(t('nav.connect')).toBe('Connect to Cloud');
  });

  it('interpolates variables and preserves unknown placeholders', () => {
    expect(t('connect.step', { current: 2, total: 3 })).toBe('Step 2 of 3');
    expect(t('connect.step', { current: 2 })).toBe('Step 2 of {total}');
  });

  it('returns an unresolved key verbatim', () => {
    expect(t('missing.key')).toBe('missing.key');
  });
});
