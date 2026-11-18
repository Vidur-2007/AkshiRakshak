import { useId, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

/** Large toggle buttons for one question (§5.4), as an accessible radio group. */
export function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: Choice<T>[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const id = useId();
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const i = Math.max(
      0,
      choices.findIndex((c) => c.value === value),
    );
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const next = choices[(i + step + choices.length) % choices.length];
    if (next) {
      onChange(next.value);
      (
        e.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null
      )?.focus();
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="font-medium text-text">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-2"
      >
        {choices.map((c, i) => {
          const checked = c.value === value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={checked}
              data-value={c.value}
              tabIndex={checked || (value === null && i === 0) ? 0 : -1}
              onClick={() => onChange(c.value)}
              className={cn(
                'min-h-13 min-w-24 flex-1 rounded-card border px-4 text-base font-medium transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:flex-none',
                checked
                  ? 'border-brand bg-brand/15 text-text'
                  : 'border-glass-border bg-surface-2 text-text-2 hover:text-text',
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
