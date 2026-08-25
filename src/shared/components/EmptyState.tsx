// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 p-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body ? <div className="max-w-md text-sm text-muted-foreground">{body}</div> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
