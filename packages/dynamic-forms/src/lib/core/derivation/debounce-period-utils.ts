import { DEFAULT_DEBOUNCE_MS } from '../../utils/debounce/debounce';
import { BaseDerivationEntry } from './derivation-entry-base';

/**
 * Returns the unique set of debounce periods declared by `entries` whose
 * `trigger === 'debounced'`. Entries without an explicit `debounceMs` use
 * {@link DEFAULT_DEBOUNCE_MS}.
 *
 * @internal
 */
export function getDebouncePeriods(entries: ReadonlyArray<Pick<BaseDerivationEntry, 'trigger' | 'debounceMs'>>): number[] {
  const periods = new Set<number>();
  for (const entry of entries) {
    if (entry.trigger === 'debounced') {
      periods.add(entry.debounceMs ?? DEFAULT_DEBOUNCE_MS);
    }
  }
  return Array.from(periods);
}

/**
 * Filters `entries` down to those whose `trigger === 'debounced'` and whose
 * effective `debounceMs` (defaulting to {@link DEFAULT_DEBOUNCE_MS}) equals `period`.
 *
 * @internal
 */
export function filterEntriesByDebouncePeriod<TEntry extends Pick<BaseDerivationEntry, 'trigger' | 'debounceMs'>>(
  entries: ReadonlyArray<TEntry>,
  period: number,
): TEntry[] {
  return entries.filter((entry) => entry.trigger === 'debounced' && (entry.debounceMs ?? DEFAULT_DEBOUNCE_MS) === period);
}
