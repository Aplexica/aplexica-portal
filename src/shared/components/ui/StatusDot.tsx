// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from '@shared/lib/utils';

export type StatusTone = 'success' | 'idle' | 'warning' | 'danger' | 'neutral' | 'info' | 'accent';

const FILL: Record<StatusTone, string> = {
  success: 'bg-success',
  idle: 'bg-idle',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-neutral',
  info: 'bg-info',
  accent: 'bg-accent',
};

/**
 * A small status indicator. `pulse` adds a live "ping" ring (use for the
 * actively-syncing state). `hollow` draws a ring-only dot (use for
 * not-installed / inactive) so presence reads instantly by shape AND color.
 */
export function StatusDot({
  tone = 'neutral',
  pulse = false,
  hollow = false,
  size = 'md',
  className,
}: {
  tone?: StatusTone;
  pulse?: boolean;
  hollow?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dim = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  return (
    <span className={cn('relative inline-flex shrink-0', dim, className)} aria-hidden="true">
      {pulse && !hollow ? (
        <span
          className={cn('absolute inset-0 rounded-full', FILL[tone])}
          style={{ animation: 'apx-ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }}
        />
      ) : null}
      <span
        className={cn(
          'relative inline-flex rounded-full',
          dim,
          hollow ? 'border-2 border-neutral bg-transparent' : FILL[tone],
        )}
      />
    </span>
  );
}
