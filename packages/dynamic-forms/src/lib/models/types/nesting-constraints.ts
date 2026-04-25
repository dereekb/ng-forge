import { LeafFieldTypes } from '../registry/field-registry';
import type { RowField } from '../../definitions/default/row-field';
import type { GroupField } from '../../definitions/default/group-field';
import type { ArrayField, SimplifiedArrayField } from '../../definitions/default/array-field';
import type { HiddenField } from '../../definitions/default/hidden-field';
import type { ContainerField } from '../../definitions/default/container-field';

/**
 * Type constraints for field nesting rules
 * These ensure that container fields can only contain valid child field types
 *
 * Note: We explicitly list types instead of using Exclude to avoid circular dependencies
 */

/**
 * Fields that are allowed as children of Page fields
 * Pages can contain: rows, groups, arrays, and leaf fields (but NOT other pages)
 */
export type PageAllowedChildren = LeafFieldTypes | RowField | GroupField | ArrayField | SimplifiedArrayField | ContainerField;

/**
 * Fields that are allowed as children of Group fields
 * Groups can contain: rows and leaf fields (but NOT pages or other groups)
 */
export type GroupAllowedChildren = LeafFieldTypes | RowField | ContainerField;

/**
 * Fields that are allowed as children of Array fields
 * Arrays can contain: rows, groups, and leaf fields (but NOT pages or other arrays)
 * Groups are used for creating object arrays where each array item is an object
 */
export type ArrayAllowedChildren = LeafFieldTypes | RowField | GroupField | ContainerField;

/**
 * Fields that are allowed as children of Container fields.
 * Containers can contain: rows, groups, arrays, other containers, and leaf
 * fields (but NOT pages or hidden fields). Hidden fields are excluded
 * because containers are layout primitives and hidden fields don't render.
 */
export type ContainerAllowedChildren =
  | Exclude<LeafFieldTypes, HiddenField>
  | RowField
  | GroupField
  | ArrayField
  | SimplifiedArrayField
  | ContainerField;

/**
 * Row is a synthetic field type that resolves to a Container at runtime, so
 * it accepts the same children as a Container.
 */
export type RowAllowedChildren = ContainerAllowedChildren;
