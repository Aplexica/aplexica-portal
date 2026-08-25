// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, type KeyboardEvent } from 'react';
import { cn } from '@shared/lib/utils';

/**
 * A controlled chip/tag editor for open-ended string lists. Free-text is
 * allowed (tags are open-ended): Enter or comma commits the draft as a
 * chip, Backspace on an empty draft removes the last chip, and each chip
 * has an × to remove it. An optional `suggestions` row offers one-click
 * adds for common values (a suggestion already present is hidden).
 *
 * Generic + controlled — pass `value` (current chips) and `onChange`.
 * Lives in `shared` so both portal modes can reuse it.
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  inputId,
  ariaLabel,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Predefined values offered as one-click chips below the field. */
  suggestions?: string[];
  placeholder?: string;
  /** id wired to an external <label htmlFor> so getByLabel finds the input. */
  inputId?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState('');

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const commitDraft = () => {
    if (draft.trim()) addTag(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault();
      removeTag(value[value.length - 1]);
    }
  };

  const openSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={inputId}
          aria-label={ariaLabel}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commitDraft}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {openSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {openSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded-full border border-dashed border-border-strong px-2 py-0.5 text-xs text-muted-foreground hover:border-accent hover:text-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
