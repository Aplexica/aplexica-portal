// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/lib/utils';

const badge = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-5 ring-1 ring-inset',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground ring-border',
        success: 'bg-success/12 text-success ring-success/30',
        idle: 'bg-idle/12 text-idle ring-idle/30',
        warning: 'bg-warning/12 text-warning ring-warning/30',
        danger: 'bg-danger/12 text-danger ring-danger/30',
        info: 'bg-info/12 text-info ring-info/30',
        accent: 'bg-accent/12 text-accent ring-accent/30',
        outline: 'bg-transparent text-muted-foreground ring-border-strong',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badge>['tone']>;

export function Badge({
  tone,
  className,
  children,
  'aria-label': ariaLabel,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
  /** Optional accessible label, e.g. a count pill's "3 pending projects". */
  'aria-label'?: string;
}) {
  return (
    <span className={cn(badge({ tone }), className)} aria-label={ariaLabel}>
      {children}
    </span>
  );
}
