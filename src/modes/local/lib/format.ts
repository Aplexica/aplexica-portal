// SPDX-License-Identifier: AGPL-3.0-or-later
import { t } from '@shared/i18n';

export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return t('common.unknown');
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function formatTimestamp(iso: string | undefined): string {
  if (!iso) return t('common.never');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Render in the viewer's local time zone with an explicit short zone
  // label (e.g. "EDT") so it's unambiguous it is NOT UTC. The daemon
  // emits UTC ("…Z"); the browser converts to local here.
  return d.toLocaleString(undefined, { timeZoneName: 'short' });
}

export function formatRelative(iso: string | undefined): string {
  if (!iso) return t('common.never');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
