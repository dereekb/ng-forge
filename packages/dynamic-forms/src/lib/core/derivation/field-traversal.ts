import { FieldDef } from '../../definitions/base/field-def';
import { hasChildFields } from '../../models/types/type-guards';
import { getNormalizedArrayMetadata } from '../../utils/array-field/normalized-array-metadata';
import { normalizeFieldsArray } from '../../utils/object-utils';

/**
 * Visitor invoked for every field encountered during traversal.
 *
 * @internal
 */
export type FieldVisitor<TContext> = (field: FieldDef<unknown>, context: TContext) => void;

/**
 * Hooks for mutating the traversal context when crossing container boundaries.
 *
 * Both hooks receive the parent context and the container field; they return
 * a partial object that is merged into a copy of the parent context to form
 * the child context. Layout containers (page, row, container) call
 * `onLayoutChild` and by default leave context unchanged.
 *
 * @internal
 */
export interface FieldTraversalHooks<TContext> {
  /** Called when descending into an `array` field. */
  onArrayChild?: (parent: TContext, field: FieldDef<unknown>) => Partial<TContext>;
  /** Called when descending into a `group` field. */
  onGroupChild?: (parent: TContext, field: FieldDef<unknown>) => Partial<TContext>;
  /** Called when descending into a layout container (page, row, container). */
  onLayoutChild?: (parent: TContext, field: FieldDef<unknown>) => Partial<TContext>;
}

/**
 * Recursively walks a field-definition tree, invoking `visitor` for each field.
 *
 * Owns the subtleties shared across derivation collectors:
 * - Detects container fields via `hasChildFields`.
 * - Falls back to the simplified-array Symbol-metadata template when an array
 *   field has empty `fields` (the case for arrays initialized without a
 *   starting `value` — only the metadata template carries their item shape).
 * - Flattens primitive (FieldDef) and object (FieldDef[]) array items into a
 *   single child list before recursing.
 *
 * Callers customize per-boundary context via {@link FieldTraversalHooks}: e.g.,
 * the value-derivation collector tracks an array path AND a group path (with
 * the group path reset at array boundaries), while the property-derivation
 * collector tracks only the array path.
 *
 * @internal
 */
export function traverseFieldsWithContext<TContext>(
  fields: FieldDef<unknown>[],
  context: TContext,
  visitor: FieldVisitor<TContext>,
  hooks?: FieldTraversalHooks<TContext>,
): void {
  for (const field of fields) {
    visitor(field, context);

    if (!hasChildFields(field)) continue;

    if (field.type === 'array') {
      const childContext = mergeContext(context, hooks?.onArrayChild?.(context, field));
      const arrayChildren = collectArrayChildren(field);
      traverseFieldsWithContext(arrayChildren, childContext, visitor, hooks);
      continue;
    }

    const overrides = field.type === 'group' ? hooks?.onGroupChild?.(context, field) : hooks?.onLayoutChild?.(context, field);
    const childContext = mergeContext(context, overrides);
    traverseFieldsWithContext(normalizeFieldsArray(field.fields) as FieldDef<unknown>[], childContext, visitor, hooks);
  }
}

/**
 * Returns the flattened list of children for an array field, falling back
 * to the Symbol metadata template when `fields` is empty.
 *
 * Caller must ensure `field` is a container (passes `hasChildFields`); this
 * function reads `field.fields` directly and would error otherwise.
 *
 * @internal
 */
function collectArrayChildren(
  field: FieldDef<unknown> & { fields: FieldDef<unknown>[] | Record<string, FieldDef<unknown>> },
): FieldDef<unknown>[] {
  let arrayItems = normalizeFieldsArray(field.fields) as (FieldDef<unknown> | FieldDef<unknown>[])[];

  if (arrayItems.length === 0) {
    const metadataTemplate = getNormalizedArrayMetadata(field)?.template;
    if (metadataTemplate) {
      arrayItems = [
        Array.isArray(metadataTemplate) ? [...(metadataTemplate as readonly FieldDef<unknown>[])] : (metadataTemplate as FieldDef<unknown>),
      ];
    }
  }

  const flattened: FieldDef<unknown>[] = [];
  for (const item of arrayItems) {
    if (Array.isArray(item)) {
      flattened.push(...item);
    } else {
      flattened.push(item);
    }
  }
  return flattened;
}

/** @internal */
function mergeContext<TContext>(base: TContext, overrides: Partial<TContext> | undefined): TContext {
  return overrides ? { ...base, ...overrides } : { ...base };
}
