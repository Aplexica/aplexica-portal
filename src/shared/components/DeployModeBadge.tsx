// SPDX-License-Identifier: AGPL-3.0-or-later
import { t } from '@shared/i18n';
import { StatusDot } from './ui/StatusDot';

const PILL =
  'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground';

/** Topbar pill identifying the daemon-local application. */
export function DeployModeBadge() {
  return (
    <span
      className={PILL}
      title={t('deployMode.localTooltip')}
      aria-label={t('deployMode.localTooltip')}
    >
      <StatusDot tone="success" size="sm" />
      {t('deployMode.local')}
    </span>
  );
}
