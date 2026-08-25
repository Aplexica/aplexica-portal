// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@shared/lib/utils';

/**
 * Surface container. `interactive` adds hover lift for clickable cards.
 * `accentHue` paints a thin left rail in a custom hue (used by agent cards
 * to carry the per-agent brand color).
 */
export function Card({
  children,
  className,
  interactive = false,
  accentHue,
  muted = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  accentHue?: number;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border bg-surface shadow-sm',
        muted ? 'border-dashed border-border-strong/70 bg-surface/40' : 'border-border',
        interactive &&
          'transition-all duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
        className,
      )}
      style={
        accentHue !== undefined
          ? ({ '--rail': `hsl(${accentHue} 70% 55%)` } as CSSProperties)
          : undefined
      }
    >
      {accentHue !== undefined && (
        <span
          aria-hidden="true"
          className={cn('absolute inset-y-0 left-0 w-1', muted && 'opacity-40')}
          style={{ background: 'var(--rail)' }}
        />
      )}
      {children}
    </div>
  );
}

/** Section panel with an uppercase eyebrow header and optional right slot. */
export function Panel({
  title,
  icon,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-md border border-border bg-surface shadow-sm', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {icon ? <span className="text-faint">{icon}</span> : null}
          {title}
        </h2>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
