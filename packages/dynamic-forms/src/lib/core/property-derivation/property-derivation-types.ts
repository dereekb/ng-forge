import { BaseDerivationEntry } from '../derivation/derivation-entry-base';

/**
 * Entry representing a collected property derivation from field definitions.
 *
 * Created during form initialization when traversing field definitions
 * to collect all `type: 'derivation'` logic entries with `targetProperty`.
 *
 * All property derivations are self-targeting: the `fieldKey` is both where the
 * derivation is defined AND where the derived property will be set. Extends
 * {@link BaseDerivationEntry} with the property-pipeline specific `targetProperty`.
 *
 * @public
 */
export interface PropertyDerivationEntry extends BaseDerivationEntry {
  /**
   * The target property to set on the field component.
   *
   * Supports dot-notation for nested properties (max 2 levels).
   */
  targetProperty: string;
}

/**
 * Collection of all property derivation entries from a form's field definitions.
 *
 * @public
 */
export interface PropertyDerivationCollection {
  /**
   * All property derivation entries collected from field definitions.
   *
   * No topological sort needed — property derivations don't chain among
   * themselves (they read formValue and write to the store, never reading
   * from the store).
   */
  entries: PropertyDerivationEntry[];
}

/**
 * Creates an empty property derivation collection.
 *
 * @returns Empty collection
 *
 * @internal
 */
export function createEmptyPropertyDerivationCollection(): PropertyDerivationCollection {
  return { entries: [] };
}
