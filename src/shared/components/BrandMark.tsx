// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from '@shared/lib/utils';

/**
 * Aplexica brand mark — the "Tilde-A": the letter A whose crossbar is a
 * flowing coral tilde (~), a direct reference to ~/.aplexica where canonical
 * state lives. Matches the marketing wordmark (Aplexica_Website
 * src/components/ui/Wordmark.astro). The A strokes inherit currentColor so
 * the mark adapts to its surface; the tilde stays coral as the brand signal.
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size * (24 / 30)}
      viewBox="0 0 30 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* A strokes — currentColor adapts to the surface */}
      <path d="M5 22 L15 3 L25 22" stroke="currentColor" strokeWidth="2.4" fill="none" />
      {/* Coral tilde crossbar — references ~/.aplexica */}
      <path d="M10 15 Q12.5 12.5 15 15 T20 15" stroke="rgb(var(--color-accent))" strokeWidth="2.2" fill="none" />
    </svg>
  );
}
