// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react';
import { cn } from '@shared/lib/utils';

/** Consistent page title block: title + optional subtitle + right-aligned actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-accent shadow-sm">
            {icon}
          </span>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
