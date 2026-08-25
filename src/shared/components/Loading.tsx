// SPDX-License-Identifier: AGPL-3.0-or-later
import { t } from '@shared/i18n';

export function Loading({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 p-6 text-sm text-muted-foreground"
    >
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-accent" aria-hidden="true" />
      <span>{label ?? t('app.loading')}</span>
    </div>
  );
}
