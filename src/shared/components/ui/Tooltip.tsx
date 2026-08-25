// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@shared/lib/utils';

/**
 * Lightweight, dependency-free tooltip. Shows on hover AND keyboard focus,
 * and exposes the label via aria-describedby so it's accessible. Pure CSS
 * positioning (no portal/popper) — fine for short hint strings.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2 rounded-md border border-border-strong bg-surface-raised px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground shadow-md transition-all duration-100',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          open ? 'opacity-100 translate-y-0' : 'invisible -translate-y-0.5 opacity-0',
        )}
      >
        {label}
      </span>
    </span>
  );
}
