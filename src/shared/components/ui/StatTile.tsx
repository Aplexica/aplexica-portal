// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react';
import { cn } from '@shared/lib/utils';

/**
 * A labelled metric tile. Values default to monospace (machine data:
 * versions, PIDs, paths, counts) so they're visually distinct from prose.
 */
export function StatTile({
  label,
  value,
  icon,
  hint,
  mono = true,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-border bg-surface-raised/40 px-3.5 py-3', className)}>
      <div className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.09em] text-faint">
        {icon ? <span className="text-faint">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className={cn('mt-1.5 truncate text-sm text-foreground', mono && 'font-mono')} title={typeof value === 'string' ? value : undefined}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-faint">{hint}</div> : null}
    </div>
  );
}
