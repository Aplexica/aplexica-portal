// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from '@shared/lib/utils';
import { Tooltip } from './Tooltip';

/**
 * A labelled version chip. The label disambiguates WHICH version this is —
 * the Aplexica adapter's, or the agent's own — which was the exact confusion
 * in the old UI ("is that the plugin version or the agent version?").
 */
export function VersionTag({
  label,
  value,
  tip,
  className,
}: {
  label: string;
  value?: string | null;
  tip: string;
  className?: string;
}) {
  const shown = value ? (value.startsWith('v') ? value : `v${value}`) : '—';
  return (
    <Tooltip label={tip}>
      <span
        className={cn(
          'inline-flex items-baseline gap-1.5 rounded-md border border-border bg-surface-raised/50 px-2 py-1',
          className,
        )}
      >
        <span className="text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-faint">
          {label}
        </span>
        <span className={cn('font-mono text-xs', value ? 'text-foreground' : 'text-faint')}>{shown}</span>
      </span>
    </Tooltip>
  );
}
