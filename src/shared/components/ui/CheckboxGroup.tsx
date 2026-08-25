// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from '@shared/lib/utils';

export interface CheckboxOption {
  /** The value committed to `value` when checked. */
  value: string;
  /** Human-readable label shown next to the box. */
  label: string;
}

/**
 * A controlled multi-select rendered as a group of checkboxes over a fixed
 * set of options. The selection is the subset of option values that are
 * checked. Lives in `shared` so both portal modes can reuse it.
 *
 * Generic + controlled: pass `value` (the selected values) and `onChange`
 * (called with the next array). Order of `value` follows `options` order.
 */
export function CheckboxGroup({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: CheckboxOption[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  /** Optional group label exposed to assistive tech. */
  ariaLabel?: string;
}) {
  const selected = new Set(value);

  const toggle = (v: string) => {
    // Re-derive from `options` so the result stays in a stable order and
    // never carries stray values that aren't valid options.
    const next = options
      .map((o) => o.value)
      .filter((ov) => (ov === v ? !selected.has(ov) : selected.has(ov)));
    onChange(next);
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-x-4 gap-y-1.5', className)}
    >
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={selected.has(o.value)}
            onChange={() => toggle(o.value)}
            className="h-3.5 w-3.5 accent-accent"
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
