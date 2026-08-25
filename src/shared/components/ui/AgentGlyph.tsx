// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CSSProperties } from 'react';
import { cn } from '@shared/lib/utils';
import { agentMeta, agentMonogram } from './agent-meta';

/**
 * A monogram tile tinted with the agent's brand hue. Avoids shipping vendor
 * logos while still giving each agent an instantly recognizable color
 * identity. `muted` desaturates it for the not-installed treatment.
 */
export function AgentGlyph({
  id,
  size = 'md',
  muted = false,
  className,
}: {
  id: string;
  size?: 'sm' | 'md' | 'lg';
  muted?: boolean;
  className?: string;
}) {
  const meta = agentMeta(id);
  const dim =
    size === 'lg'
      ? 'h-12 w-12 rounded-lg text-base'
      : size === 'sm'
        ? 'h-7 w-7 rounded-md text-[0.7rem]'
        : 'h-9 w-9 rounded-md text-xs';
  const style: CSSProperties = muted
    ? { background: 'rgb(var(--color-muted))', color: 'rgb(var(--color-faint-text))' }
    : {
        background: `hsl(${meta.hue} 60% 50% / 0.16)`,
        color: `hsl(${meta.hue} 72% 74%)`,
        boxShadow: `inset 0 0 0 1px hsl(${meta.hue} 60% 50% / 0.32)`,
      };
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center font-mono font-semibold', dim, className)}
      style={style}
      aria-hidden="true"
    >
      {agentMonogram(meta.name)}
    </span>
  );
}
