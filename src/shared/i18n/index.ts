// SPDX-License-Identifier: AGPL-3.0-or-later
import strings from './en.json';

type StringDict = Record<string, unknown>;

/**
 * Resolve a dotted-path key from the English string catalogue. Returns
 * the key itself when the path doesn't resolve to a string — that way
 * a missing key shows up loudly in the UI instead of silently rendering
 * `undefined`.
 *
 * Supports `{placeholder}` interpolation: t('step', { current: 2, total: 4 }).
 */
export function t(path: string, vars?: Record<string, string | number>): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as StringDict)) {
      return (acc as StringDict)[key];
    }
    return undefined;
  }, strings);
  const out = typeof value === 'string' ? value : path;
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (k in vars) return String(vars[k]);
    return m;
  });
}
