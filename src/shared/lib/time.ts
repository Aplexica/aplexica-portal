// SPDX-License-Identifier: AGPL-3.0-or-later

/** Compact "x ago" relative time for unix-second timestamps. */
export function formatRelativeUnix(sec?: number | null): string {
  if (sec === undefined || sec === null || Number.isNaN(sec)) return '—';
  return formatRelative(new Date(sec * 1000).toISOString());
}

/** Compact "x ago" relative time for ISO strings. Returns "—" when absent. */
export function formatRelative(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  if (Number.isNaN(ms)) return '—';
  if (ms < 0) return 'just now';
  const s = Math.round(ms / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}
