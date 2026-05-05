import * as rxjs from 'rxjs';
import { Observable } from 'rxjs';
import * as _angular_core from '@angular/core';
import { Signal, ResourceRef, Type, ViewContainerRef, InjectionToken, Injector, WritableSignal, EnvironmentInjector, Provider, EnvironmentProviders, Resource, PipeTransform } from '@angular/core';
import * as _ng_forge_dynamic_forms from '@ng-forge/dynamic-forms';
import * as _angular_forms_signals from '@angular/forms/signals';
import { FieldContext, TreeValidationResult, ValidationError as ValidationError$1, FieldTree, SchemaPath, SchemaPathTree } from '@angular/forms/signals';
import { FormSchema } from '@ng-forge/dynamic-forms/schema';
import * as _angular_forms from '@angular/forms';

type WithInputSignals<T> = {
    readonly [K in keyof T]-?: Signal<T[K]>;
};

type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

type DynamicText = string | Observable<string> | Signal<string>;

/**
 * Configuration for an HTTP request used by declarative HTTP validators, derivations, and conditions.
 *
 * All string values in `queryParams` are treated as expressions evaluated by ExpressionParser.
 * When `evaluateBodyExpressions` is true, top-level string values in `body` are also evaluated as expressions (shallow only).
 */
interface HttpRequestConfig {
    /** URL to send the request to */
    url: string;
    /** HTTP method. Defaults to 'GET' */
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /**
     * URL path parameters. Keys correspond to `:key` placeholders in the URL.
     * Values are expressions evaluated by ExpressionParser against the current EvaluationContext.
     *
     * @example
     * ```typescript
     * {
     *   url: '/api/users/:userId/orders/:orderId',
     *   params: { userId: 'formValue.userId', orderId: 'fieldValue' }
     * }
     * // With userId=42 and fieldValue='abc' → '/api/users/42/orders/abc'
     * ```
     */
    params?: Record<string, string>;
    /**
     * Query parameters appended to the URL.
     * Values are expressions evaluated by ExpressionParser against the current EvaluationContext.
     */
    queryParams?: Record<string, string>;
    /** Request body (for POST/PUT/PATCH) */
    body?: Record<string, unknown>;
    /**
     * When true, top-level string values in `body` are treated as expressions
     * and evaluated by ExpressionParser (shallow only — nested objects are passed through as-is).
     */
    evaluateBodyExpressions?: boolean;
    /** HTTP headers to include in the request */
    headers?: Record<string, string>;
}

/**
 * Comparison operators for field value and form value conditions.
 *
 * @public
 */
type ComparisonOperator = 'equals' | 'notEquals' | 'greater' | 'less' | 'greaterOrEqual' | 'lessOrEqual' | 'contains' | 'startsWith' | 'endsWith' | 'matches';
/**
 * Condition that compares a specific field's value against an expected value.
 *
 * @public
 */
interface FieldValueCondition {
    type: 'fieldValue';
    /** Path to the field whose value to compare */
    fieldPath: string;
    /** Comparison operator */
    operator: ComparisonOperator;
    /** Value to compare against */
    value?: unknown;
}
/**
 * Condition that invokes a registered custom function by name.
 *
 * Register functions via `customFnConfig.customFunctions`.
 *
 * @public
 */
interface CustomCondition {
    type: 'custom';
    /** Name of the registered custom function to invoke */
    functionName: string;
}
/**
 * Condition that evaluates a JavaScript expression using the secure AST-based parser.
 *
 * The expression has access to `formValue`, `fieldValue`, `externalData`, etc.
 *
 * @public
 */
interface JavascriptCondition {
    type: 'javascript';
    /** JavaScript expression string to evaluate */
    expression: string;
}
/**
 * Condition that evaluates based on an HTTP response from a remote server.
 *
 * The HTTP request is resolved reactively — when dependent form values change,
 * the request is re-evaluated (with debouncing). The result is cached per
 * resolved request to avoid redundant network calls.
 *
 * Since `LogicFn` must return `boolean` synchronously, this condition uses
 * a signal-based async resolution pattern internally.
 *
 * @public
 */
interface HttpCondition {
    type: 'http';
    /** HTTP request configuration */
    http: HttpRequestConfig;
    /**
     * Expression to extract boolean from response (scope: `{ response }`).
     * e.g. `'response.allowed'`, `'response.permissions.canEdit'`
     * When omitted, the entire response is coerced to boolean: `!!response`
     */
    responseExpression?: string;
    /**
     * Value to return while the HTTP request is in-flight.
     *
     * Choose based on the logic type and desired UX:
     * - For `hidden`: `false` = visible while loading, `true` = hidden while loading
     * - For `disabled`: `false` = enabled while loading, `true` = disabled while loading
     * - For `required`: `false` = optional while loading, `true` = required while loading
     *
     * @default false
     */
    pendingValue?: boolean;
    /** Cache duration in ms for HTTP responses. @default 30000 */
    cacheDurationMs?: number;
    /**
     * Debounce time in milliseconds for re-evaluation when dependent form values change.
     * @default 300
     */
    debounceMs?: number;
}
/**
 * Condition that evaluates based on a registered async function.
 *
 * The function is resolved reactively — when dependent form values change,
 * the function is re-evaluated (with debouncing). The result is cached per
 * evaluation to avoid redundant calls.
 *
 * Since `LogicFn` must return `boolean` synchronously, this condition uses
 * a signal-based async resolution pattern internally.
 *
 * @public
 */
interface AsyncCondition {
    type: 'async';
    /** Name of the registered async condition function */
    asyncFunctionName: string;
    /**
     * Value to return while async resolution is pending.
     *
     * Choose based on the logic type and desired UX:
     * - For `hidden`: `false` = visible while loading, `true` = hidden while loading
     * - For `disabled`: `false` = enabled while loading, `true` = disabled while loading
     * - For `required`: `false` = optional while loading, `true` = required while loading
     *
     * @default false
     */
    pendingValue?: boolean;
    /**
     * Debounce ms for re-evaluation.
     * @default 300
     */
    debounceMs?: number;
}
/**
 * Logical AND — all sub-conditions must be true.
 *
 * @public
 */
interface AndCondition {
    type: 'and';
    /** Sub-conditions that must all evaluate to true */
    conditions: ConditionalExpression[];
}
/**
 * Logical OR — at least one sub-condition must be true.
 *
 * @public
 */
interface OrCondition {
    type: 'or';
    /** Sub-conditions where at least one must evaluate to true */
    conditions: ConditionalExpression[];
}
/**
 * Discriminated union of all conditional expression types.
 *
 * Each variant only allows the properties relevant to its type,
 * providing compile-time safety against invalid property combinations.
 *
 * @public
 */
type ConditionalExpression = FieldValueCondition | CustomCondition | JavascriptCondition | HttpCondition | AsyncCondition | AndCondition | OrCondition;

/**
 * Logic configuration for container fields (page, group, row, array).
 * Containers only support the 'hidden' logic type since they are layout containers,
 * not form controls (they can't be readonly, disabled, or required).
 */
interface ContainerLogicConfig {
    /** Only 'hidden' is supported for container fields */
    type: 'hidden';
    /**
     * Condition that determines when this container is hidden.
     * Can be a boolean or a conditional expression evaluated against form values.
     */
    condition: ConditionalExpression | boolean;
}

/**
 * An array item template is an array of allowed children that defines one OBJECT array item's fields.
 * Used for object arrays where each item is `{ key1: value1, key2: value2, ... }`.
 */
type ArrayItemTemplate = readonly ArrayAllowedChildren[];
/**
 * An array item definition can be either:
 * - A single field (ArrayAllowedChildren) for PRIMITIVE array items - extracts field value directly
 * - An array of fields (ArrayItemTemplate) for OBJECT array items - merges fields into object
 *
 * This allows support for:
 * - Primitive arrays: `['tag1', 'tag2']`
 * - Object arrays: `[{ name: 'Alice', email: '...' }]`
 * - Heterogeneous arrays: `[{ value: 'x' }, 'y']` (mixed primitives and objects)
 */
type ArrayItemDefinition = ArrayAllowedChildren | ArrayItemTemplate;
/**
 * Array field interface for creating dynamic field collections that map to array values.
 *
 * Key concepts:
 * - The outer `fields` array defines INITIAL ITEMS (each element is one array item to render)
 * - Each element can be either:
 *   - A single FieldDef (primitive item) - the field's value is extracted directly
 *   - An array of FieldDefs (object item) - fields are merged into an object
 * - Items can have different field configurations (heterogeneous arrays supported)
 * - Empty `fields: []` means no initial items - user adds via buttons with explicit templates
 * - Initial values are declared via `value` property on each field definition
 *
 * @example
 * // Primitive array: ['angular', 'typescript']
 * {
 *   key: 'tags',
 *   type: 'array',
 *   fields: [
 *     { key: 'tag', type: 'input', value: 'angular' },      // Single field = primitive
 *     { key: 'tag', type: 'input', value: 'typescript' },
 *   ]
 * }
 *
 * @example
 * // Object array: [{ name: 'Alice', email: '...' }]
 * {
 *   key: 'contacts',
 *   type: 'array',
 *   fields: [
 *     [                                                      // Array = object
 *       { key: 'name', type: 'input', value: 'Alice' },
 *       { key: 'email', type: 'input', value: 'alice@example.com' }
 *     ],
 *   ]
 * }
 *
 * @example
 * // Heterogeneous array: [{ label: 'Structured' }, 'Simple']
 * {
 *   key: 'items',
 *   type: 'array',
 *   fields: [
 *     [{ key: 'label', type: 'input', value: 'Structured' }],  // Object item
 *     { key: 'value', type: 'input', value: 'Simple' },        // Primitive item
 *   ]
 * }
 *
 * @example
 * // Empty array (add items via buttons)
 * {
 *   key: 'tags',
 *   type: 'array',
 *   fields: []  // No initial items - user adds via button with template
 * }
 *
 * Nesting constraints: Arrays can contain rows, leaf fields, or groups (for object arrays),
 * but NOT pages or other arrays. Runtime validation enforces these rules.
 *
 * Note: Arrays are container fields and do not support `meta` since they have no native form element.
 */
interface ArrayField<TFields extends readonly ArrayItemDefinition[] = readonly ArrayItemDefinition[]> extends FieldDef<never> {
    type: 'array';
    /**
     * Array of item definitions. Each element defines one array item:
     * - Single FieldDef = primitive item (field's value is extracted directly)
     * - Array of FieldDefs = object item (fields are merged into an object)
     * - Empty array `[]` = no initial items (add via buttons with explicit templates)
     * - Items can have different configurations (heterogeneous arrays supported)
     * - Initial values are set via `value` property on each field definition
     */
    readonly fields: TFields;
    /** Array fields do not have a label property **/
    readonly label?: never;
    /** Arrays do not support meta - they have no native form element **/
    readonly meta?: never;
    /**
     * Logic configurations for conditional array visibility.
     * Only 'hidden' type logic is supported for arrays.
     */
    readonly logic?: ContainerLogicConfig[];
    /**
     * Minimum number of items required in the array.
     * Validation fails if the array has fewer items than this value.
     */
    readonly minLength?: number;
    /**
     * Maximum number of items allowed in the array.
     * Validation fails if the array has more items than this value.
     */
    readonly maxLength?: number;
}
/**
 * Type guard for ArrayField with proper type narrowing.
 * Validates that the field is an array type with a fields property that is an array.
 * Fields can contain either single FieldDefs (primitive items) or arrays of FieldDefs (object items).
 */
declare function isArrayField(field: FieldDef<any>): field is ArrayField;
/**
 * Configuration for auto-generated add/remove buttons in simplified array fields.
 */
interface ArrayButtonConfig {
    /** Custom label for the button */
    readonly label?: string;
    /** Additional properties passed to the button component */
    readonly props?: Record<string, unknown>;
}
/**
 * Simplified array field interface for common use cases.
 *
 * Instead of manually specifying each item in `fields`, provide a `template` that defines
 * the structure of a single item, and a `value` array with initial data.
 * The library auto-generates add/remove buttons.
 *
 * Discriminant: `template` presence → simplified API; `Array.isArray(template)` → object vs primitive.
 *
 * @example
 * // Primitive array: ['angular', 'typescript']
 * {
 *   key: 'tags',
 *   type: 'array',
 *   template: { key: 'value', type: 'input', label: 'Tag', required: true },
 *   value: ['angular', 'typescript']
 * }
 *
 * @example
 * // Object array: [{ name: 'Jane', phone: '555' }]
 * {
 *   key: 'contacts',
 *   type: 'array',
 *   template: [
 *     { key: 'name', type: 'input', label: 'Contact Name', required: true },
 *     { key: 'phone', type: 'input', label: 'Phone Number' },
 *   ],
 *   value: [{ name: 'Jane', phone: '555' }]
 * }
 *
 * @example
 * // Button customization / opt-out
 * {
 *   key: 'tags',
 *   type: 'array',
 *   template: { key: 'value', type: 'input', label: 'Tag' },
 *   addButton: { label: 'Add Tag', props: { color: 'primary' } },
 *   removeButton: false
 * }
 */
interface SimplifiedArrayField extends FieldDef<never> {
    type: 'array';
    /**
     * Template defining the structure of a single array item.
     * - Single field (ArrayAllowedChildren) → primitive array (each item is a single value)
     * - Array of fields (readonly ArrayAllowedChildren[]) → object array (each item is an object)
     */
    readonly template: ArrayAllowedChildren | readonly ArrayAllowedChildren[];
    /** Initial values for the array. Each element creates one array item. */
    readonly value?: readonly unknown[];
    /**
     * Configuration for the auto-generated "Add" button, or `false` to disable it.
     * Defaults to a button with label "Add".
     */
    readonly addButton?: ArrayButtonConfig | false;
    /**
     * Configuration for the auto-generated "Remove" button on each item, or `false` to disable it.
     * Defaults to a button with label "Remove".
     */
    readonly removeButton?: ArrayButtonConfig | false;
    /** Simplified arrays do not support the label property */
    readonly label?: never;
    /** Simplified arrays do not support meta */
    readonly meta?: never;
    /**
     * Logic configurations for conditional array visibility.
     * Only 'hidden' type logic is supported for arrays.
     */
    readonly logic?: ContainerLogicConfig[];
    /**
     * Minimum number of items required in the array.
     * Validation fails if the array has fewer items than this value.
     */
    readonly minLength?: number;
    /**
     * Maximum number of items allowed in the array.
     * Validation fails if the array has more items than this value.
     */
    readonly maxLength?: number;
    /** Mutually exclusive with `template` — use `fields` for the full API instead */
    readonly fields?: never;
}
/**
 * Type guard for SimplifiedArrayField.
 * Checks for `type: 'array'` with a `template` property (discriminant from full ArrayField).
 */
declare function isSimplifiedArrayField(field: FieldDef<any>): field is SimplifiedArrayField;

/**
 * Group field interface for creating logical field groupings that map to object values
 * Groups create nested form structures where child field values are collected into an object
 * This is a programmatic grouping only - users cannot customize this field type
 *
 * TypeScript cannot enforce field nesting rules due to circular dependency limitations.
 * For documentation: Groups should contain rows and leaf fields, but NOT pages or other groups.
 * Runtime validation enforces these rules.
 *
 * Note: Groups are container fields and do not support `meta` since they have no native form element.
 */
interface GroupField<TFields extends readonly GroupAllowedChildren[] = readonly GroupAllowedChildren[]> extends FieldDef<never> {
    type: 'group';
    readonly fields: TFields;
    /** Groups do not have a label property - they are logical containers only **/
    readonly label?: never;
    /** Groups do not support meta - they have no native form element **/
    readonly meta?: never;
    /**
     * Logic configurations for conditional group visibility.
     * Only 'hidden' type logic is supported for groups.
     */
    readonly logic?: ContainerLogicConfig[];
}
/**
 * Type guard for GroupField with proper type narrowing
 */
declare function isGroupField(field: FieldDef<any>): field is GroupField;

/**
 * Scalar types supported by hidden fields.
 * These are the primitive value types that can be stored.
 */
type HiddenScalar = string | number | boolean;
/**
 * All value types supported by hidden fields.
 * Supports both scalar values and arrays of scalars for storing
 * multiple IDs or similar data.
 */
type HiddenValue = HiddenScalar | HiddenScalar[];
/**
 * Hidden field definition for storing values without rendering UI.
 *
 * Hidden fields participate in the form schema and contribute to form values,
 * but do not render any visible component. They are useful for:
 * - Storing IDs when updating existing records
 * - Persisting metadata that shouldn't be user-editable
 * - Tracking computed values that need to be submitted
 *
 * Unlike the `hidden` property on other fields (which hides a rendered field),
 * this field type renders nothing at all - it's a componentless field.
 *
 * @example
 * ```typescript
 * // Store a record ID for updates
 * const idField: HiddenField<string> = {
 *   type: 'hidden',
 *   key: 'id',
 *   value: '550e8400-e29b-41d4-a716-446655440000',
 * };
 *
 * // Store multiple tag IDs
 * const tagIdsField: HiddenField<number[]> = {
 *   type: 'hidden',
 *   key: 'tagIds',
 *   value: [1, 2, 3],
 * };
 * ```
 *
 * @typeParam TValue - The type of value stored (must be HiddenValue compatible)
 */
interface HiddenField<TValue extends HiddenValue = HiddenValue> extends FieldDef<never> {
    /** Discriminant for hidden field type */
    type: 'hidden';
    /**
     * The value to store in the form.
     * This is required - a hidden field without a value serves no purpose.
     */
    value: TValue;
}

/**
 * Page field interface for creating top-level page layouts
 * This is a special field type that contains other field definitions
 * The page itself doesn't have a value - it's a layout container like row
 * Pages can only be used at the top level and cannot be nested
 * This is a programmatic field type only - users cannot customize this field type
 *
 * TypeScript cannot enforce field nesting rules due to circular dependency limitations.
 * For documentation: Pages should contain rows, groups, and leaf fields, but NOT other pages.
 * Runtime validation enforces these rules.
 *
 * Note: Pages are container fields and do not support `meta` since they have no native form element.
 */
interface PageField<TFields extends readonly PageAllowedChildren[] = PageAllowedChildren[]> extends FieldDef<never> {
    type: 'page';
    /** Child field definitions to render within this page */
    readonly fields: TFields;
    /** Page fields do not have a label property **/
    readonly label?: never;
    /** Pages do not support meta - they have no native form element **/
    readonly meta?: never;
    /**
     * Logic configurations for conditional page visibility.
     * Only 'hidden' type logic is supported for pages.
     *
     * @example
     * ```typescript
     * {
     *   key: 'businessPage',
     *   type: 'page',
     *   logic: [{
     *     type: 'hidden',
     *     condition: {
     *       type: 'fieldValue',
     *       fieldPath: 'accountType',
     *       operator: 'notEquals',
     *       value: 'business',
     *     },
     *   }],
     *   fields: [...]
     * }
     * ```
     */
    readonly logic?: ContainerLogicConfig[];
}
/**
 * Type guard for PageField with proper type narrowing
 */
declare function isPageField(field: FieldDef<unknown>): field is PageField;

/**
 * Helper type to convert union to intersection.
 * Uses `U extends U` to trigger distributive conditional type behavior.
 */
type UnionToIntersection<U> = (U extends U ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
/**
 * Depth counter for recursion limiting (prevents infinite type instantiation)
 */
type Depth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/**
 * Widens literal types to their primitive equivalents, recursively for objects and arrays.
 * This prevents `as const` from over-narrowing types like `''` to literal `''` instead of `string`.
 *
 * Depth-limited to prevent slow type checking on deeply nested `as const` objects.
 * Falls back to `T` (unwidened) when depth is exhausted.
 *
 * Note: For object types, `readonly` modifiers are intentionally stripped (`-readonly`)
 * so that inferred form value types have mutable properties. This is by design since
 * `as const` adds `readonly` to all properties, but form values should be mutable.
 *
 * @example
 * ```typescript
 * type A = Widen<''>; // string
 * type B = Widen<false>; // boolean
 * type C = Widen<42>; // number
 * type D = Widen<string[]>; // string[]
 * type E = Widen<{ name: 'Jane' }>; // { name: string }
 * ```
 */
type Widen<T, D extends number = 5> = [D] extends [never] ? T : T extends string ? string : T extends number ? number : T extends boolean ? boolean : T extends readonly (infer U)[] ? Widen<U, Depth[D]>[] : T extends Record<string, unknown> ? {
    -readonly [K in keyof T]: Widen<T[K], Depth[D]>;
} : T;
/**
 * Infer value type based on field type and props.
 * - Slider fields: always number
 * - Input fields with props.type: 'number': number
 * - Other fields: widen the literal value type
 */
type InferValueType<T, V> = T extends {
    type: 'slider';
} ? number : T extends {
    type: 'input';
    props: {
        type: 'number';
    };
} ? number : Widen<V>;
/**
 * Make type optional if field is not required.
 * Hidden fields are never optional since they require a value property.
 */
type MaybeOptional<T, V> = T extends {
    type: 'hidden';
} ? V : T extends {
    required: true;
} ? V : V | undefined;
/**
 * Infers the value type from a single template field (for primitive arrays).
 * Mirrors InferValueType logic: slider → number, input[number] → number, else string.
 */
type InferSingleTemplateValue<T, D extends number> = T extends {
    type: 'slider';
} ? number : T extends {
    type: 'input';
    props: {
        type: 'number';
    };
} ? number : T extends {
    type: 'checkbox' | 'toggle';
} ? boolean : T extends {
    value: infer V;
} ? Widen<V, Depth[D]> : string;
/**
 * Infers the value type for an array field.
 * Handles four cases:
 * 1. Simplified array with template + value → infer item type from value
 * 2. Simplified array with array template (no value) → infer object type from template fields
 * 3. Simplified array with single-field template (no value) → infer primitive type from template field
 * 4. Full-API array with fields → infer from children
 */
type InferArrayValue<T, D extends number> = T extends {
    template: unknown;
    value: readonly (infer Item)[];
} ? Widen<Item>[] : T extends {
    template: infer TArr;
} ? TArr extends readonly RegisteredFieldTypes[] ? InferFormValueWithDepth<[...TArr], Depth[D]>[] : InferSingleTemplateValue<TArr, D>[] : T extends {
    fields: infer F;
} ? F extends RegisteredFieldTypes[] ? InferFormValueWithDepth<F, Depth[D]>[] : unknown[] : unknown[];
/**
 * Process a single field and determine its contribution to the form value type
 */
type ProcessField<T, D extends number = 5> = [D] extends [never] ? Record<string, unknown> : T extends {
    type: 'page' | 'row';
    fields: infer F;
} ? F extends RegisteredFieldTypes[] ? InferFormValueWithDepth<F, Depth[D]> : never : T extends {
    type: 'group';
    key: infer K;
    fields: infer F;
} ? K extends string ? F extends RegisteredFieldTypes[] ? {
    [P in K]: InferFormValueWithDepth<F, Depth[D]>;
} : {
    [P in K]: Record<string, unknown>;
} : never : T extends {
    type: 'array';
    key: infer K;
} ? K extends string ? {
    [P in K]: InferArrayValue<T, D>;
} : never : T extends {
    type: 'text';
} ? never : T extends {
    type: 'submit' | 'button' | 'next' | 'previous' | 'addArrayItem' | 'removeArrayItem';
} ? never : T extends {
    key: infer K;
    value: infer V;
} ? K extends string ? {
    [P in K]: MaybeOptional<T, InferValueType<T, V>>;
} : never : T extends {
    key: infer K;
} ? K extends string ? {
    [P in K]: MaybeOptional<T, string>;
} : never : never;
/**
 * Internal helper with depth tracking
 */
type InferFormValueWithDepth<T extends RegisteredFieldTypes[], D extends number = 5> = UnionToIntersection<ProcessField<T[number], D>>;
/**
 * Helper to extract fields from either fields array or FormConfig
 */
type ExtractFields<T> = T extends {
    fields: infer TFields;
} ? TFields extends readonly RegisteredFieldTypes[] ? TFields : never : T extends readonly RegisteredFieldTypes[] ? T : never;
/**
 * Infer form value type from fields array or FormConfig.
 * Recursively processes nested structures and merges the results.
 * Limited to 5 levels of nesting to prevent infinite type instantiation.
 *
 * @example
 * ```typescript
 * // From fields array
 * const fields = [
 *   { type: 'input', key: 'email', value: '', required: true },
 *   { type: 'input', key: 'name', value: '' }
 * ] as const;
 * type FieldsValue = InferFormValue<typeof fields>;
 *
 * // From FormConfig
 * const config = {
 *   fields: [
 *     { type: 'input', key: 'email', value: '', required: true },
 *     { type: 'input', key: 'name', value: '' }
 *   ]
 * } as const satisfies FormConfig;
 * type ConfigValue = InferFormValue<typeof config>;
 *
 * // Result: { email: string; name?: string }
 * ```
 */
type InferFormValue$1<T> = ExtractFields<T> extends readonly RegisteredFieldTypes[] ? InferFormValueWithDepth<ExtractFields<T> extends RegisteredFieldTypes[] ? ExtractFields<T> : [...ExtractFields<T>], 5> : never;

/**
 * Mapping configuration for interpreting HTTP responses as validation results.
 *
 * Expressions in `validWhen` and `errorParams` are evaluated with scope `{ response }` only —
 * they do NOT have access to `formValue`, `fieldValue`, or the full `EvaluationContext`.
 * This is intentional for v1: response mapping is purely about interpreting the HTTP response.
 */
interface HttpValidationResponseMapping {
    /**
     * Expression evaluated with scope `{ response }`. Must evaluate to `true` (strict boolean) to be valid.
     *
     * NOTE: This is the OPPOSITE of the function-based HttpCustomValidator.onSuccess
     * convention, which maps successful HTTP responses to validation errors.
     * Here, `=== true` means "validation passed". Non-boolean results are treated as invalid and trigger a warning.
     */
    validWhen: string;
    /** Error kind returned when validation fails — maps to field-level `validationMessages` */
    errorKind: string;
    /**
     * Parameters to include in the validation error for message interpolation.
     * Map of parameter names to expressions evaluated against `{ response }`.
     */
    errorParams?: Record<string, string>;
}

/**
 * Base configuration shared by all validators
 */
interface BaseValidatorConfig {
    /** Conditional logic for when validator applies */
    when?: ConditionalExpression;
}
/**
 * Built-in validator configuration (required, email, min, max, etc.)
 */
interface BuiltInValidatorConfig extends BaseValidatorConfig {
    /** Validator type identifier */
    type: 'required' | 'email' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern';
    /** Static value for the validator (e.g., min value, pattern) */
    value?: number | string | RegExp;
    /** Dynamic value expression that evaluates to validator parameter */
    expression?: string;
}
/**
 * Custom validator configuration using Angular's public FieldContext API
 * Returns ValidationError | ValidationError[] | null synchronously
 *
 * Supports two patterns:
 * 1. Function-based: { type: 'custom', functionName: 'myValidator' }
 * 2. Expression-based: { type: 'custom', expression: 'fieldValue === formValue.password', kind: 'passwordMismatch' }
 */
interface CustomValidatorConfig extends BaseValidatorConfig {
    /** Validator type identifier */
    type: 'custom';
    /** Name of registered validator function (function-based pattern) */
    functionName?: string;
    /** Optional parameters to pass to validator function */
    params?: Record<string, unknown>;
    /** JavaScript expression to evaluate (expression-based pattern) */
    expression?: string;
    /** Error kind for expression-based validators - links to validationMessages */
    kind?: string;
    /**
     * Parameters to include in error object for message interpolation (expression-based pattern)
     * Map of parameter names to expressions that will be evaluated in the same context as the validation expression
     *
     * @example
     * errorParams: {
     *   minValue: 'formValue.minValue',
     *   maxValue: 'formValue.maxValue'
     * }
     * // Allows message template: "Value must be between {{minValue}} and {{maxValue}}"
     */
    errorParams?: Record<string, string>;
}
/**
 * Async custom validator configuration using Angular's validateAsync API.
 * Returns Observable<ValidationError | ValidationError[] | null>.
 *
 */
interface AsyncValidatorConfig extends BaseValidatorConfig {
    /** Validator type identifier. */
    type: 'async';
    /** Name of registered async validator function */
    functionName: string;
    /** Optional parameters to pass to validator function */
    params?: Record<string, unknown>;
}
/**
 * Function-based HTTP validator configuration — requires a registered function.
 *
 * Uses Angular's `validateHttp` API. The function is registered via
 * `customFnConfig.httpValidators`.
 *
 * Discriminated from `DeclarativeHttpValidatorConfig` by the presence of `functionName`.
 *
 */
interface FunctionHttpValidatorConfig extends BaseValidatorConfig {
    /** Validator type identifier. */
    type: 'http';
    /** Name of registered HTTP validator configuration */
    functionName: string;
    /** Optional parameters to pass to HTTP validator */
    params?: Record<string, unknown>;
}
/**
 * Declarative HTTP validator configuration — fully JSON-serializable, no function registration required.
 *
 * Uses `HttpRequestConfig` to define the HTTP request and `HttpValidationResponseMapping`
 * to interpret the response as a validation result. Powered by Angular's `validateHttp` API.
 *
 * Discriminated from `FunctionHttpValidatorConfig` by the presence of `http` + `responseMapping`
 * (and absence of `functionName`).
 */
interface DeclarativeHttpValidatorConfig extends BaseValidatorConfig {
    /** Validator type identifier */
    type: 'http';
    /** HTTP request configuration with expression-based query params and body */
    http: HttpRequestConfig;
    /** Mapping that interprets the HTTP response as a validation result */
    responseMapping: HttpValidationResponseMapping;
}
/**
 * Configuration for signal forms validator functions that can be serialized from API.
 * Discriminated union type for type-safe validator configuration.
 *
 * Note: `FunctionHttpValidatorConfig` and `DeclarativeHttpValidatorConfig` both use `type: 'http'`.
 * They are discriminated by property presence: `functionName` → function-based, `http` → declarative.
 * Use `isFunctionHttpValidator()` for type-safe narrowing when `type` alone is insufficient.
 */
type ValidatorConfig = BuiltInValidatorConfig | CustomValidatorConfig | AsyncValidatorConfig | FunctionHttpValidatorConfig | DeclarativeHttpValidatorConfig;

/**
 * Special form-state conditions for button disabled logic.
 *
 * These conditions evaluate form or page-level state rather than field values,
 * and are primarily used for controlling button disabled states.
 *
 * @example
 * ```typescript
 * // Disable submit button when form is invalid or submitting
 * {
 *   key: 'submit',
 *   type: 'submit',
 *   label: 'Submit',
 *   logic: [
 *     { type: 'disabled', condition: 'formInvalid' },
 *     { type: 'disabled', condition: 'formSubmitting' },
 *   ]
 * }
 *
 * // Disable next button when current page is invalid
 * nextButton({
 *   key: 'next',
 *   label: 'Next',
 *   logic: [
 *     { type: 'disabled', condition: 'pageInvalid' },
 *   ]
 * })
 * ```
 *
 * @public
 */
type FormStateCondition = 
/** True when form.valid() === false */
'formInvalid'
/** True when form.submitting() === true */
 | 'formSubmitting'
/** True when fields on the current page are invalid (for paged forms) */
 | 'pageInvalid';
/**
 * Logic type for controlling field state (hidden, readonly, disabled, required).
 *
 * @public
 */
type StateLogicType = 'hidden' | 'readonly' | 'disabled' | 'required';
/**
 * Base configuration for conditional field state logic.
 *
 * @internal
 */
interface BaseStateLogicConfig {
    /**
     * Logic type identifier for field state.
     *
     * - `hidden`: Hide the field from view (still participates in form state)
     * - `readonly`: Make the field read-only
     * - `disabled`: Disable user interaction
     * - `required`: Make the field required
     */
    type: StateLogicType;
    /**
     * Condition that determines when this logic applies.
     *
     * Can be:
     * - `boolean`: Static value (always applies or never applies)
     * - `ConditionalExpression`: Expression evaluated against field/form values
     * - `FormStateCondition`: Special form/page state check (for buttons)
     *
     * @example
     * ```typescript
     * // Static condition
     * condition: true
     *
     * // Field value condition
     * condition: {
     *   type: 'fieldValue',
     *   fieldPath: 'status',
     *   operator: 'equals',
     *   value: 'locked'
     * }
     *
     * // Form state condition (for buttons)
     * condition: 'formSubmitting'
     * ```
     */
    condition: ConditionalExpression | boolean | FormStateCondition;
}
/**
 * State logic that evaluates immediately on change (default).
 *
 * @internal
 */
interface ImmediateStateLogicConfig extends BaseStateLogicConfig {
    /**
     * Trigger for immediate evaluation.
     * @default 'onChange'
     */
    trigger?: 'onChange';
    /** Not allowed for onChange trigger */
    debounceMs?: never;
}
/**
 * State logic that evaluates after a debounce period.
 *
 * @internal
 */
interface DebouncedStateLogicConfig extends BaseStateLogicConfig {
    /**
     * Trigger for debounced evaluation.
     * Evaluates after the value has stabilized for the debounce duration.
     */
    trigger: 'debounced';
    /**
     * Debounce duration in milliseconds.
     * @default 500
     */
    debounceMs?: number;
}
/**
 * Configuration for conditional field state logic.
 *
 * Defines how field behavior changes based on conditions.
 * Supports hiding, disabling, making readonly, or requiring fields
 * based on form state or field values.
 *
 * @example
 * ```typescript
 * // Hide email field when contact method is not email
 * {
 *   type: 'hidden',
 *   condition: {
 *     type: 'fieldValue',
 *     fieldPath: 'contactMethod',
 *     operator: 'notEquals',
 *     value: 'email'
 *   }
 * }
 *
 * // Disable button when form is submitting
 * {
 *   type: 'disabled',
 *   condition: 'formSubmitting'
 * }
 *
 * // Debounced visibility (avoids flicker during rapid typing)
 * {
 *   type: 'hidden',
 *   trigger: 'debounced',
 *   debounceMs: 300,
 *   condition: {
 *     type: 'fieldValue',
 *     fieldPath: 'search',
 *     operator: 'isEmpty'
 *   }
 * }
 * ```
 *
 * @public
 */
type StateLogicConfig = ImmediateStateLogicConfig | DebouncedStateLogicConfig;
/**
 * Shared fields that appear on all derivation logic config variants.
 *
 * @internal
 */
interface SharedDerivationFields {
    /**
     * Logic type identifier for value derivation.
     */
    type: 'derivation';
    /**
     * Target property name for property derivation.
     *
     * When set, this derivation targets a field property (like `minDate`, `options`,
     * `label`, `placeholder`) instead of the field's value. The derivation is routed
     * to the property derivation pipeline.
     *
     * When absent, the derivation targets the field's value (default behavior).
     *
     * **Depth limit (max 2 levels):** Only simple and single-dot-nested paths are
     * supported. Paths with 2+ dots (e.g., `'a.b.c'`) will throw at runtime.
     *
     * @example
     * ```typescript
     * // Property derivation (new unified API)
     * {
     *   key: 'endDate',
     *   type: 'datepicker',
     *   logic: [{
     *     type: 'derivation',
     *     targetProperty: 'minDate',
     *     expression: 'formValue.startDate'
     *   }]
     * }
     *
     * // Value derivation (no targetProperty — existing behavior)
     * {
     *   key: 'total',
     *   type: 'input',
     *   logic: [{
     *     type: 'derivation',
     *     expression: 'formValue.quantity * formValue.unitPrice'
     *   }]
     * }
     * ```
     */
    targetProperty?: string;
    /**
     * Optional name for this derivation for debugging purposes.
     *
     * When provided, this name appears in derivation debug logs,
     * making it easier to identify specific derivations in complex forms.
     *
     * @example
     * ```typescript
     * {
     *   key: 'lineTotal',
     *   type: 'input',
     *   logic: [{
     *     type: 'derivation',
     *     debugName: 'Calculate line total',
     *     expression: 'formValue.quantity * formValue.unitPrice'
     *   }]
     * }
     * ```
     */
    debugName?: string;
    /**
     * Condition that determines when this derivation applies.
     *
     * Can be:
     * - `boolean`: Static value (always applies or never applies)
     * - `ConditionalExpression`: Expression evaluated against field/form values
     *
     * Defaults to `true` (always apply).
     *
     * Note: FormStateCondition is not supported for derivations.
     *
     * @example
     * ```typescript
     * // Always compute (default)
     * condition: true
     *
     * // Conditional derivation
     * condition: {
     *   type: 'fieldValue',
     *   fieldPath: 'country',
     *   operator: 'equals',
     *   value: 'USA'
     * }
     * ```
     */
    condition?: ConditionalExpression | boolean;
    /**
     * When true, the derivation stops running after the user manually
     * edits the target field.
     *
     * This is useful for "smart defaults" — values that should be
     * auto-filled initially but respected once the user explicitly changes them.
     *
     * Uses the field's `dirty()` signal to detect user modification.
     * Derivations write directly to `value.set()` which does not trigger
     * `markAsDirty()`, so `dirty === true` reliably indicates a user edit.
     *
     * @example
     * ```typescript
     * // Auto-fill display name from first + last name, but stop if user edits it
     * {
     *   key: 'displayName',
     *   logic: [{
     *     type: 'derivation',
     *     expression: 'formValue.firstName + " " + formValue.lastName',
     *     stopOnUserOverride: true
     *   }]
     * }
     * ```
     */
    stopOnUserOverride?: boolean;
    /**
     * When true (and `stopOnUserOverride` is also true), clears the
     * user-override flag when any dependency of this derivation changes,
     * allowing the derivation to run again.
     *
     * This is useful when a user override should only persist until the
     * underlying data changes — e.g., when switching countries, the
     * phone prefix should re-derive even if the user previously edited it.
     *
     * @example
     * ```typescript
     * {
     *   key: 'phonePrefix',
     *   logic: [{
     *     type: 'derivation',
     *     value: '+1',
     *     condition: { type: 'fieldValue', fieldPath: 'country', operator: 'equals', value: 'USA' },
     *     stopOnUserOverride: true,
     *     reEngageOnDependencyChange: true,
     *     dependsOn: ['country']
     *   }]
     * }
     * ```
     */
    reEngageOnDependencyChange?: boolean;
}
/**
 * Trigger variants for derivation timing.
 * @internal
 */
type ImmediateDerivationTrigger = {
    trigger?: 'onChange';
    debounceMs?: never;
};
type DebouncedDerivationTrigger = {
    trigger: 'debounced';
    debounceMs?: number;
};
/**
 * Base for HTTP derivations. `source: 'http'` is required.
 * TypeScript enforces `dependsOn` and `responseExpression` at the type level.
 *
 * @internal
 */
interface HttpDerivationBase extends SharedDerivationFields {
    /** Identifies this derivation as HTTP-driven. */
    source: 'http';
    /**
     * HTTP request configuration for server-driven derivations.
     *
     * The request is sent when dependencies change, with automatic
     * debouncing and cancellation of in-flight requests.
     *
     * Configure debounce via the `trigger: 'debounced'` + `debounceMs` mechanism.
     *
     * @example
     * ```typescript
     * {
     *   key: 'exchangeRate',
     *   logic: [{
     *     type: 'derivation',
     *     source: 'http',
     *     http: {
     *       url: '/api/exchange-rate',
     *       method: 'GET',
     *       queryParams: {
     *         from: 'formValue.sourceCurrency',
     *         to: 'formValue.targetCurrency',
     *       },
     *     },
     *     responseExpression: 'response.rate',
     *     dependsOn: ['sourceCurrency', 'targetCurrency'],
     *   }]
     * }
     * ```
     */
    http: HttpRequestConfig;
    /**
     * Explicit field dependencies. Required for HTTP derivations to prevent
     * wildcard triggering on every keystroke.
     *
     * The wildcard token `'*'` is rejected. The structural token `'$group'`
     * (and `'$group.X'`) is allowed and resolves to the field's parent container
     * path — be aware this fires whenever any sibling under that group changes,
     * so the caller owns the request frequency (consider `trigger: 'debounced'`).
     */
    dependsOn: string[];
    /**
     * Expression to extract the derived value from the HTTP response.
     *
     * Evaluated via `ExpressionParser` with `{ response }` as the evaluation scope.
     *
     * @example
     * ```typescript
     * responseExpression: 'response.rate'
     * responseExpression: 'response.data.suggestedPrice'
     * ```
     */
    responseExpression: string;
    value?: never;
    expression?: never;
    functionName?: never;
    asyncFunctionName?: never;
}
/**
 * Base for async function derivations. `source: 'asyncFunction'` is required.
 * TypeScript enforces `dependsOn` at the type level.
 *
 * @internal
 */
interface AsyncFunctionDerivationBase extends SharedDerivationFields {
    /** Identifies this derivation as async-function-driven. */
    source: 'asyncFunction';
    /**
     * Name of a registered async derivation function.
     *
     * The function receives the evaluation context and returns a Promise or Observable
     * of the derived value. Register functions in `customFnConfig.asyncDerivations`.
     *
     * @example
     * ```typescript
     * {
     *   key: 'suggestedPrice',
     *   logic: [{
     *     type: 'derivation',
     *     source: 'asyncFunction',
     *     asyncFunctionName: 'fetchSuggestedPrice',
     *     dependsOn: ['productId', 'quantity'],
     *   }]
     * }
     * ```
     */
    asyncFunctionName: string;
    /**
     * Explicit field dependencies. Required for async derivations to prevent
     * wildcard triggering on every form change.
     *
     * The wildcard token `'*'` is rejected. The structural token `'$group'`
     * (and `'$group.X'`) is allowed and resolves to the field's parent container
     * path — be aware this fires whenever any sibling under that group changes,
     * so the caller owns the invocation frequency (handle this via
     * `trigger: 'debounced'` or via debouncing inside the async function).
     */
    dependsOn: string[];
    value?: never;
    expression?: never;
    functionName?: never;
    http?: never;
    responseExpression?: never;
}
/**
 * Base for expression derivations.
 *
 * @internal
 */
interface ExpressionDerivationBase extends SharedDerivationFields {
    source?: never;
    /**
     * JavaScript expression to evaluate for the derived value.
     *
     * Has access to `formValue` object containing all form values.
     * For array fields, `formValue` is scoped to the current array item.
     * Uses the same secure AST-based parser as other expressions.
     *
     * @example
     * ```typescript
     * expression: 'formValue.quantity * formValue.unitPrice'
     * expression: 'formValue.firstName + " " + formValue.lastName'
     * expression: 'formValue.price * (1 - formValue.discount / 100)'
     * ```
     */
    expression: string;
    /**
     * Explicit field dependencies for expressions.
     *
     * For `expression`, dependencies are automatically extracted from the expression.
     * Provide `dependsOn` to override automatic detection for complex expressions.
     *
     * @example
     * ```typescript
     * // Override automatic detection for complex expressions
     * {
     *   key: 'total',
     *   logic: [{
     *     type: 'derivation',
     *     expression: 'calculateTotal(formValue)',
     *     dependsOn: ['quantity', 'unitPrice', 'discount']
     *   }]
     * }
     * ```
     */
    dependsOn?: string[];
    value?: never;
    functionName?: never;
    http?: never;
    asyncFunctionName?: never;
    responseExpression?: never;
}
/**
 * Base for value derivations.
 *
 * @internal
 */
interface ValueDerivationBase extends SharedDerivationFields {
    source?: never;
    /**
     * Static value to set on this field.
     *
     * Use when the derived value is a constant.
     *
     * @example
     * ```typescript
     * value: '+1'           // String
     * value: 100            // Number
     * value: true           // Boolean
     * value: { code: 'US' } // Object
     * ```
     */
    value: unknown;
    /**
     * Explicit field dependencies for value derivations.
     *
     * For `value` (static), no dependencies are needed.
     * Provide `dependsOn` to conditionally re-evaluate when specific fields change.
     */
    dependsOn?: string[];
    expression?: never;
    functionName?: never;
    http?: never;
    asyncFunctionName?: never;
    responseExpression?: never;
}
/**
 * Base for custom sync function derivations.
 *
 * @internal
 */
interface FunctionDerivationBase extends SharedDerivationFields {
    source?: never;
    /**
     * Name of a registered custom derivation function.
     *
     * The function receives the evaluation context and returns the derived value.
     * Register functions in `customFnConfig.derivations`.
     *
     * @example
     * ```typescript
     * functionName: 'getCurrencyForCountry'
     * functionName: 'calculateTax'
     * functionName: 'formatPhoneNumber'
     * ```
     */
    functionName: string;
    /**
     * Explicit field dependencies for function derivations.
     *
     * If not provided, defaults to all fields ('*').
     * Specify `dependsOn` for better performance when the function only
     * depends on a subset of fields.
     *
     * @example
     * ```typescript
     * // Only re-evaluate when country changes
     * {
     *   key: 'currency',
     *   logic: [{
     *     type: 'derivation',
     *     functionName: 'getCurrencyForCountry',
     *     dependsOn: ['country']
     *   }]
     * }
     * ```
     */
    dependsOn?: string[];
    value?: never;
    expression?: never;
    http?: never;
    asyncFunctionName?: never;
    responseExpression?: never;
}
/**
 * HTTP derivation that evaluates immediately on change (default).
 * @internal
 */
type OnChangeHttpDerivationLogicConfig = HttpDerivationBase & ImmediateDerivationTrigger;
/**
 * HTTP derivation that evaluates after a debounce period.
 * @internal
 */
type DebouncedHttpDerivationLogicConfig = HttpDerivationBase & DebouncedDerivationTrigger;
/**
 * Async function derivation that evaluates immediately on change (default).
 * @internal
 */
type OnChangeAsyncFunctionDerivationLogicConfig = AsyncFunctionDerivationBase & ImmediateDerivationTrigger;
/**
 * Async function derivation that evaluates after a debounce period.
 * @internal
 */
type DebouncedAsyncFunctionDerivationLogicConfig = AsyncFunctionDerivationBase & DebouncedDerivationTrigger;
/**
 * Expression derivation that evaluates immediately on change (default).
 * @internal
 */
type OnChangeExpressionDerivationLogicConfig = ExpressionDerivationBase & ImmediateDerivationTrigger;
/**
 * Expression derivation that evaluates after a debounce period.
 * @internal
 */
type DebouncedExpressionDerivationLogicConfig = ExpressionDerivationBase & DebouncedDerivationTrigger;
/**
 * Value derivation that evaluates immediately on change (default).
 * @internal
 */
type OnChangeValueDerivationLogicConfig = ValueDerivationBase & ImmediateDerivationTrigger;
/**
 * Value derivation that evaluates after a debounce period.
 * @internal
 */
type DebouncedValueDerivationLogicConfig = ValueDerivationBase & DebouncedDerivationTrigger;
/**
 * Function derivation that evaluates immediately on change (default).
 * @internal
 */
type OnChangeFunctionDerivationLogicConfig = FunctionDerivationBase & ImmediateDerivationTrigger;
/**
 * Function derivation that evaluates after a debounce period.
 * @internal
 */
type DebouncedFunctionDerivationLogicConfig = FunctionDerivationBase & DebouncedDerivationTrigger;
/**
 * Configuration for value derivation logic.
 *
 * Enables programmatic value derivation based on conditions.
 * Derivations are self-targeting: the logic is placed on the field
 * that should receive the computed value.
 *
 * @example
 * ```typescript
 * // Set phone prefix based on country selection
 * {
 *   key: 'phonePrefix',
 *   logic: [{
 *     type: 'derivation',
 *     value: '+1',
 *     condition: {
 *       type: 'fieldValue',
 *       fieldPath: 'country',
 *       operator: 'equals',
 *       value: 'USA'
 *     }
 *   }]
 * }
 *
 * // Compute total from quantity and price
 * {
 *   key: 'total',
 *   derivation: 'formValue.quantity * formValue.unitPrice'
 * }
 *
 * // Use custom function for complex logic
 * {
 *   key: 'currency',
 *   logic: [{
 *     type: 'derivation',
 *     functionName: 'getCurrencyForCountry'
 *   }]
 * }
 *
 * // Self-transform with debounced trigger
 * // (applies after user stops typing)
 * {
 *   key: 'email',
 *   logic: [{
 *     type: 'derivation',
 *     expression: 'formValue.email.toLowerCase()',
 *     trigger: 'debounced',
 *     debounceMs: 500
 *   }]
 * }
 *
 * // Array item derivation (formValue is scoped to current item)
 * {
 *   key: 'lineTotal',  // Inside array field
 *   derivation: 'formValue.quantity * formValue.unitPrice'
 * }
 * ```
 *
 * @public
 */
type DerivationLogicConfig = OnChangeHttpDerivationLogicConfig | DebouncedHttpDerivationLogicConfig | OnChangeAsyncFunctionDerivationLogicConfig | DebouncedAsyncFunctionDerivationLogicConfig | OnChangeExpressionDerivationLogicConfig | DebouncedExpressionDerivationLogicConfig | OnChangeValueDerivationLogicConfig | DebouncedValueDerivationLogicConfig | OnChangeFunctionDerivationLogicConfig | DebouncedFunctionDerivationLogicConfig;
/**
 * Union type for all logic configurations.
 *
 * - `StateLogicConfig`: For field state changes (hidden, readonly, disabled, required)
 * - `DerivationLogicConfig`: For value derivation (including property derivation via `targetProperty`)
 *
 * @public
 */
type LogicConfig = StateLogicConfig | DerivationLogicConfig;
/**
 * Log level for derivation debug output.
 *
 * - 'none': No debug logging
 * - 'summary': Log cycle completion with counts (default in dev mode)
 * - 'verbose': Log individual derivation evaluations with details
 *
 * @public
 */
type DerivationLogLevel = 'none' | 'summary' | 'verbose';
/**
 * Type guard to check if a condition is a FormStateCondition.
 *
 * @param condition - The condition to check
 * @returns true if the condition is a FormStateCondition
 *
 * @public
 */
declare function isFormStateCondition(condition: StateLogicConfig['condition'] | DerivationLogicConfig['condition']): condition is FormStateCondition;

/**
 * Configuration for applying predefined schemas
 */
interface SchemaApplicationConfig {
    /** Schema application type */
    type: 'apply' | 'applyWhen' | 'applyWhenValue' | 'applyEach';
    /** Schema identifier or inline schema definition */
    schema: string | SchemaDefinition;
    /** Condition for conditional application */
    condition?: ConditionalExpression;
    /** Type predicate for applyWhenValue */
    typePredicate?: string;
}
/**
 * Reusable schema definition that can be referenced by name
 */
interface SchemaDefinition {
    /** Unique schema identifier */
    name: string;
    /** Schema description */
    description?: string;
    /** Field path pattern this schema applies to */
    pathPattern?: string;
    /** Validators to apply */
    validators?: ValidatorConfig[];
    /** Logic rules to apply */
    logic?: LogicConfig[];
    /** Nested schema applications */
    subSchemas?: SchemaApplicationConfig[];
}

/**
 * Custom validator function signature using Angular's public FieldContext API
 *
 * Takes FieldContext (full Angular context) and optional params, returns validation error(s) or null.
 * Provides access to field state, form hierarchy, and other fields for validation logic.
 *
 * **Use FieldContext public APIs to access:**
 * - Current field value: `ctx.value()`
 * - Field state: `ctx.state` (errors, touched, dirty, etc.)
 * - Other field values: `ctx.valueOf(path)` where path is a FieldPath
 * - Other field states: `ctx.stateOf(path)`
 * - Other fields: `ctx.fieldTreeOf(path)`
 * - Current field tree: `ctx.fieldTree`
 *
 * **Return Types:**
 * - Single error: `{ kind: 'errorKind' }` for field-level validation
 * - Multiple errors: `[{ kind: 'error1' }, { kind: 'error2' }]` for cross-field validation
 * - No error: `null` when validation passes
 *
 * **Best Practice - Return Only Error Kind:**
 * Validators should focus on validation logic, not presentation.
 * Return just the error `kind` and configure messages at field level for i18n support.
 *
 * @example Single Field Validation
 * ```typescript
 * const noSpaces: CustomValidator<string> = (ctx) => {
 *   const value = ctx.value();
 *   if (typeof value === 'string' && value.includes(' ')) {
 *     return { kind: 'noSpaces' };
 *   }
 *   return null;
 * };
 *
 * // Field configuration
 * {
 *   key: 'username',
 *   validators: [{ type: 'custom', functionName: 'noSpaces' }],
 *   validationMessages: {
 *     noSpaces: 'Spaces are not allowed'
 *   }
 * }
 * ```
 *
 * @example Cross-Field Validation with valueOf()
 * ```typescript
 * // Compare two fields using public API
 * const lessThan: CustomValidator<number> = (ctx, params) => {
 *   const value = ctx.value();
 *   const compareToPath = params?.field as string;
 *
 *   // Use valueOf() to access other field - public API!
 *   const otherValue = ctx.valueOf(compareToPath as any);
 *
 *   if (otherValue !== undefined && value >= otherValue) {
 *     return { kind: 'notLessThan' };
 *   }
 *   return null;
 * };
 * ```
 *
 * @example Multiple Errors (Cross-Field Validation)
 * ```typescript
 * const validateDateRange: CustomValidator = (ctx) => {
 *   const errors: ValidationError[] = [];
 *
 *   const startDate = ctx.valueOf('startDate' as any);
 *   const endDate = ctx.valueOf('endDate' as any);
 *
 *   if (!startDate) errors.push({ kind: 'startDateRequired' });
 *   if (!endDate) errors.push({ kind: 'endDateRequired' });
 *   if (startDate && endDate && startDate > endDate) {
 *     errors.push({ kind: 'invalidDateRange' });
 *   }
 *
 *   return errors.length > 0 ? errors : null;
 * };
 * ```
 *
 * **Message Resolution Priority:**
 * 1. Field-level `validationMessages[kind]` (highest priority - per-field customization)
 * 2. Form-level `defaultValidationMessages[kind]` (fallback for common messages)
 * 3. **No message configured = Warning logged + error NOT displayed**
 *
 * **Important:** Validator-returned messages are NOT used. All messages MUST be explicitly configured.
 *
 * @template TValue The type of value stored in the field being validated
 */
type CustomValidator<TValue = unknown> = (ctx: FieldContext<TValue>, params?: Record<string, unknown>) => ValidationError$1 | ValidationError$1[] | null;
/**
 * Async custom validator configuration using Angular's resource-based API
 *
 * Angular's validateAsync uses the resource API for async validation,
 * which provides better integration with Signal Forms lifecycle management.
 *
 * **Structure:**
 * - `params`: Function that computes params from field context
 * - `factory`: Function that creates a ResourceRef from params signal
 * - `onSuccess`: Maps successful resource result to validation errors
 * - `onError`: Optional handler for resource errors (network failures, etc.)
 *
 * **Use Cases:**
 * - Database lookups via services with resource API
 * - Complex async business logic with Angular resources
 * - Any async operation using Angular's resource pattern
 *
 * **Note:** For HTTP validation, prefer `HttpCustomValidator` which provides
 * a simpler API specifically designed for HTTP requests.
 *
 * @example Database Lookup with Resource
 * ```typescript
 * const checkUsernameAvailable: AsyncCustomValidator<string> = {
 *   params: (ctx) => ({ username: ctx.value() }),
 *   factory: (params) => {
 *     const injector = inject(Injector);
 *     return resource({
 *       request: () => params(),
 *       loader: ({ request }) => {
 *         if (!request?.username) return null;
 *         const service = injector.get(UserService);
 *         return firstValueFrom(service.checkAvailability(request.username));
 *       }
 *     });
 *   },
 *   onSuccess: (result, ctx) => {
 *     if (!result) return null;
 *     return result.available ? null : { kind: 'usernameTaken' };
 *   },
 *   onError: (error, ctx) => {
 *     console.error('Availability check failed:', error);
 *     return null; // Don't block form on network errors
 *   }
 * };
 * ```
 *
 * @template TValue The type of value stored in the field being validated
 * @template TParams The type of params passed to the resource
 * @template TResult The type of result returned by the resource
 */
interface AsyncCustomValidator<TValue = unknown, TParams = unknown, TResult = unknown> {
    /**
     * Function that receives field context and returns resource params.
     * Params will be tracked as a signal and trigger resource reload when changed.
     */
    readonly params: (ctx: FieldContext<TValue>, config?: Record<string, unknown>) => TParams;
    /**
     * Function that creates a ResourceRef from the params signal.
     * The resource will be automatically managed by Angular's lifecycle.
     */
    readonly factory: (params: Signal<TParams | undefined>) => ResourceRef<TResult | undefined>;
    /**
     * Optional function to map successful resource result to validation errors.
     * Return null if validation passes, or ValidationError/ValidationError[] if validation fails.
     */
    readonly onSuccess?: (result: TResult, ctx: FieldContext<TValue>) => TreeValidationResult;
    /**
     * Optional error handler for resource errors (network failures, etc.).
     * Return null to ignore the error, or ValidationError to display it to the user.
     */
    readonly onError?: (error: unknown, ctx: FieldContext<TValue>) => ValidationError$1 | ValidationError$1[] | null;
}
/**
 * HTTP request configuration for validateHttp API
 */
interface HttpResourceRequest {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string | string[]>;
}
/**
 * HTTP-based validator configuration for Angular's validateHttp API
 *
 * Angular's validateHttp provides optimized HTTP validation with automatic
 * request cancellation and integration with the resource API.
 *
 * **Benefits:**
 * - Automatic request cancellation when field value changes
 * - Built-in integration with Angular's resource management
 * - Simpler than AsyncCustomValidator for HTTP use cases
 *
 * **Structure:**
 * - `request`: Function that returns URL string or HttpResourceRequest
 * - `onSuccess`: REQUIRED - Maps HTTP response to validation errors (inverted logic!)
 * - `onError`: Optional handler for HTTP errors (network failures, 4xx/5xx)
 *
 * **Important:** `onSuccess` uses inverted logic - it maps SUCCESSFUL HTTP responses
 * to validation errors. For example, if the API returns `{ available: false }`,
 * your `onSuccess` should return `{ kind: 'usernameTaken' }`.
 *
 * @example Username Availability Check (GET)
 * ```typescript
 * const checkUsername: HttpCustomValidator<string> = {
 *   request: (ctx) => {
 *     const username = ctx.value();
 *     if (!username) return undefined; // Skip validation if empty
 *     return `/api/users/check-username?username=${encodeURIComponent(username)}`;
 *   },
 *   onSuccess: (response, ctx) => {
 *     // Inverted logic: successful response may indicate validation failure
 *     return response.available ? null : { kind: 'usernameTaken' };
 *   },
 *   onError: (error, ctx) => {
 *     console.error('Availability check failed:', error);
 *     return null; // Don't block form on network errors
 *   }
 * };
 * ```
 *
 * @example Address Validation (POST with Body)
 * ```typescript
 * const validateAddress: HttpCustomValidator = {
 *   request: (ctx) => {
 *     const zipCode = ctx.value();
 *     if (!zipCode) return undefined;
 *
 *     return {
 *       url: '/api/validate-address',
 *       method: 'POST',
 *       body: {
 *         street: ctx.valueOf('street' as any),
 *         city: ctx.valueOf('city' as any),
 *         zipCode: zipCode
 *       },
 *       headers: { 'Content-Type': 'application/json' }
 *     };
 *   },
 *   onSuccess: (response) => {
 *     return response.valid ? null : { kind: 'invalidAddress' };
 *   }
 * };
 * ```
 *
 * @template TValue The type of value stored in the field being validated
 * @template TResult The type of HTTP response
 */
interface HttpCustomValidator<TValue = unknown, TResult = unknown> {
    /**
     * Function that returns the HTTP request configuration.
     * Can return:
     * - `undefined` to skip validation (e.g., if field is empty)
     * - `string` for simple GET requests (just the URL)
     * - `HttpResourceRequest` for full control (method, body, headers)
     */
    readonly request: (ctx: FieldContext<TValue>, config?: Record<string, unknown>) => string | HttpResourceRequest | undefined;
    /**
     * REQUIRED function to map successful HTTP response to validation errors.
     *
     * **Inverted Logic:** This is called on successful HTTP responses.
     * Return null if validation passes, or ValidationError/ValidationError[] if validation fails.
     *
     * Example: API returns `{ available: false }` → return `{ kind: 'usernameTaken' }`
     */
    readonly onSuccess: (result: TResult, ctx: FieldContext<TValue>) => TreeValidationResult;
    /**
     * Optional error handler for HTTP errors (network failures, 4xx/5xx status codes).
     * Return null to ignore the error, or ValidationError to display it to the user.
     *
     * Common pattern: Log the error and return null to avoid blocking form submission
     * on network issues.
     */
    readonly onError?: (error: unknown, ctx: FieldContext<TValue>) => ValidationError$1 | ValidationError$1[] | null;
}

/**
 * Interface for dynamic forms logger implementations.
 * Allows custom logging integrations (Sentry, DataDog, etc.)
 */
interface Logger {
    /**
     * Log a debug message.
     * Use for detailed diagnostic information during development.
     */
    debug(message: string, ...args: unknown[]): void;
    /**
     * Log an info message.
     * Use for general operational information.
     */
    info(message: string, ...args: unknown[]): void;
    /**
     * Log a warning message.
     * Use for potentially problematic situations that don't prevent operation.
     */
    warn(message: string, ...args: unknown[]): void;
    /**
     * Log an error message.
     * Use for error conditions that may affect functionality.
     */
    error(message: string, ...args: unknown[]): void;
}

/**
 * Shared shape for DI-scoped warning trackers that dedupe log output.
 *
 * Used by both the derivation-warning tracker (keys are field paths) and the
 * deprecation-warning tracker (keys are deprecation IDs). The property is
 * generic so the same shape works for any string-keyed warning domain.
 *
 * @internal
 */
interface WarningTracker {
    warnedKeys: Set<string>;
}

/**
 * Represents the state information of a single form field.
 *
 * Used in evaluation contexts to allow expressions and conditions
 * to reference field state (e.g., `fieldState.touched`, `formFieldState.email.dirty`).
 *
 * @public
 */
interface FieldStateInfo {
    readonly touched: boolean;
    readonly dirty: boolean;
    /** Convenience property: equivalent to `!dirty` */
    readonly pristine: boolean;
    readonly valid: boolean;
    readonly invalid: boolean;
    readonly pending: boolean;
    /**
     * Whether the field is currently hidden.
     *
     * Note: This is a library-managed property, not a native Angular Signal Forms
     * property. Returns `false` if the field instance does not expose a `hidden` signal.
     */
    readonly hidden: boolean;
    /**
     * Whether the field is currently readonly.
     *
     * Note: This is a library-managed property, not a native Angular Signal Forms
     * property. Returns `false` if the field instance does not expose a `readonly` signal.
     */
    readonly readonly: boolean;
    /**
     * Whether the field is currently disabled.
     *
     * Note: This is a library-managed property, not a native Angular Signal Forms
     * property. Returns `false` if the field instance does not expose a `disabled` signal.
     */
    readonly disabled: boolean;
}
/**
 * Map of field keys to their state information.
 *
 * Used as `formFieldState` in evaluation contexts to access
 * state of any field in the form by key.
 *
 * @public
 */
type FormFieldStateMap = Record<string, FieldStateInfo | undefined>;
/**
 * Field state context for the current field being evaluated.
 *
 * Used as `fieldState` in evaluation contexts.
 *
 * @public
 */
type FieldStateContext = FieldStateInfo;

interface EvaluationContext<TValue = unknown, TFormValue extends Record<string, unknown> = any> {
    /** Current field value */
    fieldValue: TValue;
    /**
     * Form value for the current evaluation scope.
     *
     * For regular (non-array) derivations, this contains the complete form value.
     * For array item derivations, this is scoped to the current array item.
     * Use `rootFormValue` to access the complete form when inside an array context.
     */
    formValue: TFormValue;
    /** Field path for relative references */
    fieldPath: string;
    /** Custom evaluation functions */
    customFunctions?: Record<string, (context: EvaluationContext) => unknown>;
    /** Logger for diagnostic output */
    logger: Logger;
    /**
     * Value of the field's nearest parent **group** (or array item, when the
     * field has no inner group above the array boundary).
     *
     * Complements `formValue` and `fieldValue` for derivations on fields nested
     * inside groups built by factory helpers, where the parent group's key
     * isn't known at config-authoring time. Mirrors the runtime semantics of
     * the `'$group'` token used in `dependsOn`.
     *
     * Resolution at evaluation time:
     * - Inside a group at form root: the parent group's value object (e.g.,
     *   for `address.state`, `groupValue === formValue.address`).
     * - Inside nested groups: the innermost parent group's value object.
     * - Directly inside an array item (no inner group): the array item itself
     *   (same shape as `formValue` in array context).
     * - Inside a group inside an array item: the inner group's value object
     *   within the current item.
     * - Field at form root with no parent container: `undefined`.
     *
     * @example
     * ```typescript
     * // Field 'state' inside group 'address':
     * deriveStateFromCountry: (ctx) => {
     *   const country = ctx.groupValue?.country;  // no need to know parent key
     *   return country === 'usa' ? 'NY' : '';
     * }
     * ```
     */
    groupValue?: unknown;
    /**
     * Root form value when inside an array context.
     *
     * This provides access to values outside the current array item.
     * When a derivation targets an array item field (e.g., `items.$.lineTotal`),
     * `formValue` is scoped to the current array item, while `rootFormValue`
     * provides access to the entire form value including fields outside the array.
     *
     * @example
     * ```typescript
     * // In an array item derivation (on the lineTotal field inside lineItems array):
     * {
     *   key: 'lineTotal',
     *   type: 'input',
     *   // formValue = current array item { quantity: 2, unitPrice: 50 }
     *   // rootFormValue = entire form { globalDiscount: 0.1, lineItems: [...] }
     *   derivation: 'formValue.quantity * formValue.unitPrice * (1 - rootFormValue.globalDiscount)'
     * }
     * ```
     *
     * For non-array derivations, `rootFormValue` is not set and `formValue`
     * contains the entire form value.
     */
    rootFormValue?: Record<string, unknown>;
    /**
     * Current array index when inside an array derivation.
     */
    arrayIndex?: number;
    /**
     * Path to the array field when inside an array derivation.
     */
    arrayPath?: string;
    /**
     * External data signals resolved to their current values.
     *
     * This allows forms to reference data from outside the form context
     * in conditional logic, derivations, and other expressions.
     *
     * @example
     * ```typescript
     * // In form config:
     * externalData: {
     *   userRole: computed(() => this.userService.currentRole()),
     *   permissions: computed(() => this.authService.permissions()),
     * }
     *
     * // In JavaScript expression:
     * condition: {
     *   type: 'javascript',
     *   expression: "externalData.userRole === 'admin'"
     * }
     * ```
     */
    externalData?: Record<string, unknown>;
    /**
     * DI-scoped tracker for deprecation warnings.
     * Used by the condition evaluator to deduplicate deprecation warnings.
     */
    deprecationTracker?: WarningTracker;
    /**
     * State of the current field being evaluated.
     *
     * Provides access to field state properties like `touched`, `dirty`, `valid`, etc.
     * Uses a Proxy for lazy evaluation — properties are only read when accessed.
     *
     * @example
     * ```typescript
     * // In a JavaScript expression:
     * condition: {
     *   type: 'javascript',
     *   expression: "fieldState.touched && fieldState.dirty"
     * }
     * ```
     */
    fieldState?: FieldStateContext;
    /**
     * State of all fields in the form, keyed by field key.
     *
     * Provides access to any field's state properties by key.
     * Uses a Proxy for lazy evaluation — field state is only read when accessed.
     *
     * @example
     * ```typescript
     * // In a JavaScript expression:
     * condition: {
     *   type: 'javascript',
     *   expression: "formFieldState.email.dirty && formFieldState.email.valid"
     * }
     * ```
     */
    formFieldState?: FormFieldStateMap;
    /** Allow additional properties for flexible expression evaluation */
    [key: string]: unknown;
}

/**
 * Custom function signature for conditional expressions
 *
 * Custom functions are used for conditional logic in:
 * - `when` conditions (field visibility, conditional validation)
 * - `readonly` logic (dynamic readonly state)
 * - `disabled` logic (dynamic disabled state)
 * - Dynamic value calculations
 *
 * Unlike validators, custom functions:
 * - Return any value (typically boolean for conditions, but could be strings, numbers, etc.)
 * - Do NOT return ValidationError objects
 * - Receive EvaluationContext (field values) not FieldContext (field state)
 *
 * @example
 * ```typescript
 * // Boolean condition function
 * const isAdult: CustomFunction = (ctx) => {
 *   return ctx.age >= 18;
 * };
 *
 * // Used in field configuration:
 * {
 *   key: 'alcoholPreference',
 *   type: 'select',
 *   when: { function: 'isAdult' }  // Only show if isAdult returns true
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Calculation function
 * const calculateDiscount: CustomFunction = (ctx) => {
 *   const price = ctx.price || 0;
 *   const isVip = ctx.isVip || false;
 *   return isVip ? price * 0.8 : price * 0.9;
 * };
 * ```
 */
type CustomFunction<TFormValue extends Record<string, unknown> = any> = (context: EvaluationContext<unknown, TFormValue>) => unknown;

/**
 * Async function for derivations — returns any value.
 *
 * The function receives the evaluation context and may return a Promise or Observable.
 * Register functions in `customFnConfig.asyncDerivations`.
 *
 * @example
 * ```typescript
 * const fetchPrice: AsyncDerivationFunction = async (context) => {
 *   const response = await fetch(`/api/price?product=${context.formValue.productId}`);
 *   const data = await response.json();
 *   return data.price;
 * };
 * ```
 *
 * @public
 */
type AsyncDerivationFunction<TFormValue extends Record<string, unknown> = any> = (context: EvaluationContext<unknown, TFormValue>) => Promise<unknown> | Observable<unknown>;
/**
 * Async function for conditions — returns boolean.
 *
 * The function receives the evaluation context and may return a Promise or Observable.
 * Register functions in `customFnConfig.asyncConditions`.
 *
 * @example
 * ```typescript
 * const checkPermission: AsyncConditionFunction = async (context) => {
 *   const response = await fetch(`/api/permissions?user=${context.formValue.userId}`);
 *   const data = await response.json();
 *   return data.canEdit;
 * };
 * ```
 *
 * @public
 */
type AsyncConditionFunction<TFormValue extends Record<string, unknown> = any> = (context: EvaluationContext<unknown, TFormValue>) => Promise<boolean> | Observable<boolean>;

/**
 * Re-export Angular's ValidationError for consistency
 * This replaces our custom ValidationError interface
 */
type ValidationError = ValidationError$1;
interface ValidationMessages {
    required?: DynamicText;
    email?: DynamicText;
    min?: DynamicText;
    max?: DynamicText;
    minLength?: DynamicText;
    maxLength?: DynamicText;
    pattern?: DynamicText;
    [key: string]: DynamicText | undefined;
}

/**
 * The result type for submission actions.
 * Can be either a Promise or an Observable.
 *
 * For success: return `undefined`, `null`, `void`, or any non-TreeValidationResult value.
 * For server errors: return `TreeValidationResult` (array of field errors).
 */
type SubmissionActionResult = Promise<TreeValidationResult> | Observable<TreeValidationResult | unknown>;
/**
 * Configuration for form submission handling.
 *
 * When provided, enables integration with Angular Signal Forms' native `submit()` function.
 * The submission mechanism is **optional** - you can still handle submission manually
 * via the `(submitted)` output if you prefer.
 *
 * Supports both Promise-based and Observable-based submission actions. When an Observable
 * is returned, it will be automatically converted using `firstValueFrom`.
 *
 * @example
 * ```typescript
 * // Using Observable (recommended for HTTP calls)
 * // Simply return the HTTP observable - no need to map the result
 * const config: FormConfig = {
 *   fields: [...],
 *   submission: {
 *     action: (form) => this.http.post('/api/submit', form().value())
 *   }
 * };
 *
 * // With error handling for server validation errors
 * const config: FormConfig = {
 *   fields: [...],
 *   submission: {
 *     action: (form) => {
 *       return this.http.post('/api/submit', form().value()).pipe(
 *         catchError((error) => {
 *           if (error.error?.code === 'EMAIL_EXISTS') {
 *             return of([{ field: form.email, error: { kind: 'server', message: 'Email already exists' }}]);
 *           }
 *           throw error;
 *         })
 *       );
 *     }
 *   }
 * };
 *
 * // Using Promise (also supported)
 * const config: FormConfig = {
 *   fields: [...],
 *   submission: {
 *     action: async (form) => {
 *       const value = form().value();
 *       try {
 *         await this.api.submit(value);
 *         return undefined;
 *       } catch (error) {
 *         if (error.code === 'EMAIL_EXISTS') {
 *           return [{ field: form.email, error: { kind: 'server', message: 'Email already exists' }}];
 *         }
 *         throw error;
 *       }
 *     }
 *   }
 * };
 * ```
 *
 * @typeParam TValue - The form value type
 *
 * @public
 * @experimental
 */
interface SubmissionConfig<TValue = unknown> {
    /**
     * Action called when the form is submitted.
     *
     * This function receives the form's `FieldTree` and should return either a Promise or
     * an Observable. For Observable returns, it will be automatically converted using `firstValueFrom`.
     *
     * **Return values:**
     * - For success: return `undefined`, `null`, or simply let the Observable complete (the emitted value is ignored unless it's a TreeValidationResult)
     * - For server errors: return `TreeValidationResult` (array of field/error pairs)
     *
     * **Observable support:** You can return an HttpClient observable directly without mapping the result.
     * The form will treat Observable completion as success. Only return `TreeValidationResult` if you need
     * to report server-side validation errors.
     *
     * Server errors returned will be automatically applied to the corresponding form fields.
     *
     * While this action is executing, `form().submitting()` will be `true`, enabling
     * automatic button disabling and loading states.
     *
     * @param form - The form's FieldTree instance
     * @returns Promise or Observable - for errors, return TreeValidationResult
     *
     * @example
     * ```typescript
     * // Simple - just return the HTTP observable
     * action: (form) => this.http.post('/api/register', form().value())
     *
     * // With server error handling
     * action: (form) => {
     *   return this.http.post('/api/register', form().value()).pipe(
     *     catchError((error) => {
     *       if (error.status === 409) {
     *         return of([{
     *           field: form.email,
     *           error: { kind: 'server', message: 'Email already exists' }
     *         }]);
     *       }
     *       throw error;
     *     })
     *   );
     * }
     *
     * // Promise-based alternative
     * action: async (form) => {
     *   await fetch('/api/register', {
     *     method: 'POST',
     *     body: JSON.stringify(form().value())
     *   });
     *   // Return undefined for success, or TreeValidationResult for errors
     * }
     * ```
     */
    action: (form: FieldTree<TValue>) => SubmissionActionResult;
}

/**
 * Configuration interface for defining dynamic form structure and behavior.
 *
 * This interface defines the complete form schema including field definitions,
 * validation rules, conditional logic, and submission handling using Angular's
 * signal-based reactive forms.
 *
 * @example
 * ```typescript
 * const formConfig = {
 *   fields: [
 *     { type: 'input', key: 'email', value: '', label: 'Email', required: true },
 *     { type: 'group', key: 'address', label: 'Address', fields: [
 *       { type: 'input', key: 'street', value: '', label: 'Street' },
 *       { type: 'input', key: 'city', value: '', label: 'City' }
 *     ]},
 *   ],
 * } as const satisfies FormConfig;
 *
 * // Infer form value type from config
 * type FormValue = InferFormValue<typeof formConfig>;
 * ```
 *
 * @typeParam TFields - Array of registered field types available for this form
 * @typeParam TValue - The strongly-typed interface for form values
 * @typeParam TProps - The type for form-level default props (library-specific)
 *
 * @public
 */
interface FormConfig<TFields extends NarrowFields | RegisteredFieldTypes[] = RegisteredFieldTypes[], TValue = InferFormValue$1<TFields extends readonly RegisteredFieldTypes[] ? TFields : RegisteredFieldTypes[]>, TProps extends object = Record<string, unknown>, TSchemaValue = unknown> {
    /**
     * Array of field definitions that define the form structure.
     *
     * Fields are rendered in the order they appear in this array.
     * Supports nested groups and conditional field visibility.
     *
     * @example
     * ```typescript
     * fields: [
     *   { type: 'input', key: 'firstName', label: 'First Name' },
     *   { type: 'group', key: 'address', label: 'Address', fields: [
     *     { type: 'input', key: 'street', label: 'Street' }
     *   ]}
     * ]
     * ```
     */
    fields: TFields;
    /**
     * Optional form-level validation schema using Standard Schema spec.
     *
     * Provides additional validation beyond field-level validation.
     * Supports Zod, Valibot, ArkType, and other Standard Schema compliant libraries.
     * Useful for cross-field validation rules.
     *
     * @example
     * ```typescript
     * import { z } from 'zod';
     * import { standardSchema } from '@ng-forge/dynamic-forms/schema';
     *
     * const PasswordSchema = z.object({
     *   password: z.string().min(8),
     *   confirmPassword: z.string(),
     * }).refine(
     *   (data) => data.password === data.confirmPassword,
     *   { message: 'Passwords must match', path: ['confirmPassword'] }
     * );
     *
     * const formConfig = {
     *   fields: [...],
     *   schema: standardSchema(PasswordSchema),
     * } as const satisfies FormConfig;
     * ```
     */
    schema?: FormSchema<TSchemaValue>;
    /**
     * Global form configuration options.
     *
     * Controls form-wide behavior like validation timing and disabled state.
     *
     * @value {}
     */
    options?: FormOptions;
    /**
     * Global schemas available to all fields.
     *
     * Reusable validation schemas that can be referenced by field definitions.
     * Promotes consistency and reduces duplication.
     *
     * @example
     * ```typescript
     * schemas: [
     *   { name: 'addressSchema', schema: {
     *     street: validators.required,
     *     zipCode: validators.pattern(/^\d{5}$/)
     *   }}
     * ]
     * ```
     */
    schemas?: SchemaDefinition[];
    /**
     * Form-level validation messages that act as fallback for field-level messages.
     *
     * These messages are used when a field has validation errors but no
     * field-level `validationMessages` are defined for that specific error.
     * This allows you to define common validation messages once at the form level
     * instead of repeating them for each field.
     *
     * @example
     * ```typescript
     * defaultValidationMessages: {
     *   required: 'This field is required',
     *   email: 'Please enter a valid email address',
     *   minLength: 'Must be at least {{requiredLength}} characters'
     * }
     * ```
     */
    defaultValidationMessages?: ValidationMessages;
    /**
     * Signal forms adapter configuration.
     */
    customFnConfig?: CustomFnConfig<TValue extends Record<string, unknown> ? TValue : Record<string, unknown>>;
    /**
     * Form submission configuration.
     *
     * When provided, enables integration with Angular Signal Forms' native `submit()` function.
     * The submission mechanism is **optional** - you can still handle submission manually
     * via the `(submitted)` output if you prefer.
     *
     * While the submission action is executing, `form().submitting()` will be `true`,
     * which automatically disables submit buttons (unless configured otherwise).
     *
     * Server errors returned from the action will be automatically applied to the
     * corresponding form fields.
     *
     * @example
     * ```typescript
     * const config: FormConfig = {
     *   fields: [...],
     *   submission: {
     *     action: async (form) => {
     *       const value = form().value();
     *       try {
     *         await this.api.submit(value);
     *         return undefined;
     *       } catch (error) {
     *         return [{ field: form.email, error: { kind: 'server', message: 'Email exists' }}];
     *       }
     *     }
     *   }
     * };
     * ```
     */
    submission?: SubmissionConfig<TValue>;
    /**
     * Default props applied to all fields in the form.
     *
     * These props serve as defaults that can be overridden at the field level.
     * Useful for setting consistent styling across the entire form (e.g., appearance,
     * size, or other UI library-specific props).
     *
     * The cascade order is: Library config → Form defaultProps → Field props
     * Each level can override the previous one.
     *
     * @example
     * ```typescript
     * // Material example
     * const config: MatFormConfig = {
     *   defaultProps: {
     *     appearance: 'outline',
     *     subscriptSizing: 'dynamic',
     *   },
     *   fields: [
     *     { type: 'input', key: 'name', label: 'Name' },  // Uses defaultProps
     *     { type: 'input', key: 'email', props: { appearance: 'fill' } },  // Override
     *   ],
     * };
     * ```
     */
    defaultProps?: TProps;
    /**
     * External data signals available to conditional logic and derivations.
     *
     * Provides a way to inject external application state into form expressions.
     * Each property is a Signal that will be unwrapped and made available in the
     * `EvaluationContext` under `externalData`.
     *
     * The signals are read reactively in logic functions (when/readonly/disabled)
     * so changes to the external data will trigger re-evaluation of conditions.
     *
     * @example
     * ```typescript
     * const config: FormConfig = {
     *   externalData: {
     *     userRole: computed(() => this.authService.currentRole()),
     *     permissions: computed(() => this.authService.permissions()),
     *     featureFlags: computed(() => this.featureFlagService.flags()),
     *   },
     *   fields: [
     *     {
     *       type: 'input',
     *       key: 'adminField',
     *       label: 'Admin Only Field',
     *       logic: [{
     *         effect: 'show',
     *         condition: {
     *           type: 'javascript',
     *           expression: "externalData.userRole === 'admin'"
     *         }
     *       }]
     *     },
     *     {
     *       type: 'select',
     *       key: 'advancedOption',
     *       label: 'Advanced Option',
     *       logic: [{
     *         effect: 'show',
     *         condition: {
     *           type: 'javascript',
     *           expression: "externalData.featureFlags.advancedMode === true"
     *         }
     *       }]
     *     }
     *   ]
     * };
     * ```
     */
    externalData?: Record<string, Signal<unknown>>;
    /**
     * Form-wide default wrappers applied to every field that does not explicitly opt out.
     *
     * Merged into a field's effective wrapper chain between auto-associated wrappers
     * (outermost) and field-level `wrappers` (innermost). Fields with `wrappers: null`
     * opt out entirely — no defaults, no auto-associations.
     *
     * @example
     * ```typescript
     * const config: FormConfig = {
     *   defaultWrappers: [{ type: 'css', cssClasses: 'mb-2' }],
     *   fields: [
     *     { type: 'input', key: 'name' },                           // gets default wrappers
     *     { type: 'input', key: 'email', wrappers: null },           // opts out
     *     { type: 'input', key: 'age', wrappers: [{ type: 'css', cssClasses: 'highlight' }] }, // defaults + field-level
     *   ],
     * };
     * ```
     */
    defaultWrappers?: readonly WrapperConfig[];
}
/**
 * Signal forms adapter configuration for advanced form behavior.
 *
 * Provides configuration options for signal forms integration including
 * legacy migration, custom functions, and custom validators.
 *
 * @example
 * ```typescript
 * customFnConfig: {
 *   customFunctions: {
 *     isAdult: (context) => context.age >= 18,
 *     formatCurrency: (context) => new Intl.NumberFormat('en-US', {
 *       style: 'currency',
 *       currency: 'USD'
 *     }).format(context.value)
 *   },
 *   derivations: {
 *     getCurrencyForCountry: (context) => {
 *       const countryToCurrency: Record<string, string> = {
 *         'USA': 'USD', 'Germany': 'EUR', 'UK': 'GBP'
 *       };
 *       return countryToCurrency[context.formValue.country as string] ?? 'USD';
 *     }
 *   },
 *   simpleValidators: {
 *     noSpaces: (value) => {
 *       return typeof value === 'string' && value.includes(' ')
 *         ? { kind: 'noSpaces', message: 'Spaces not allowed' }
 *         : null;
 *     }
 *   },
 *   contextValidators: {
 *     lessThanField: (ctx, params) => {
 *       const value = ctx.value();
 *       const otherField = params?.field as string;
 *       const otherValue = ctx.root()[otherField]?.value();
 *       if (otherValue !== undefined && value >= otherValue) {
 *         return { kind: 'notLessThan', message: `Must be less than ${otherField}` };
 *       }
 *       return null;
 *     }
 *   }
 * }
 * ```
 *
 * @public
 */
interface CustomFnConfig<TFormValue extends Record<string, unknown> = Record<string, unknown>> {
    /**
     * Custom evaluation functions for conditional expressions.
     *
     * Used for: when/readonly/disabled logic
     * Return type: any value (typically boolean)
     *
     * @example
     * ```typescript
     * customFunctions: {
     *   isAdult: (context) => context.age >= 18,
     *   calculateAge: (context) => {
     *     const birthDate = new Date(context.birthDate);
     *     return new Date().getFullYear() - birthDate.getFullYear();
     *   }
     * }
     * ```
     */
    customFunctions?: Record<string, CustomFunction<TFormValue>>;
    /**
     * Custom derivation functions for value derivation logic.
     *
     * These functions compute derived values and are called when a
     * `DerivationLogicConfig` references them by `functionName`.
     *
     * Derivation functions:
     * - Receive an `EvaluationContext` with access to `formValue`
     * - Return the value to set on the target field
     * - Are called reactively when dependencies change
     *
     * Use derivation functions for complex mappings or logic that
     * can't be easily expressed as a JavaScript expression.
     *
     * @example
     * ```typescript
     * derivations: {
     *   // Country to currency mapping
     *   getCurrencyForCountry: (context) => {
     *     const countryToCurrency: Record<string, string> = {
     *       'USA': 'USD',
     *       'Germany': 'EUR',
     *       'France': 'EUR',
     *       'UK': 'GBP',
     *       'Japan': 'JPY'
     *     };
     *     return countryToCurrency[context.formValue.country as string] ?? 'USD';
     *   },
     *
     *   // Complex tax calculation
     *   calculateTax: (context) => {
     *     const subtotal = context.formValue.subtotal as number ?? 0;
     *     const state = context.formValue.state as string;
     *     const taxRates: Record<string, number> = {
     *       'CA': 0.0725, 'NY': 0.08, 'TX': 0.0625
     *     };
     *     return subtotal * (taxRates[state] ?? 0);
     *   },
     *
     *   // Format phone number
     *   formatPhoneNumber: (context) => {
     *     const phone = context.fieldValue as string ?? '';
     *     const digits = phone.replace(/\D/g, '');
     *     if (digits.length === 10) {
     *       return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
     *     }
     *     return phone;
     *   }
     * }
     * ```
     *
     * Field configuration using a derivation function:
     * ```typescript
     * // Derivation is defined on the target field (currency), not the source field (country)
     * {
     *   key: 'currency',
     *   type: 'select',
     *   logic: [
     *     {
     *       type: 'derivation',
     *       functionName: 'getCurrencyForCountry',
     *       dependsOn: ['country']
     *     }
     *   ]
     * }
     * ```
     */
    derivations?: Record<string, CustomFunction<TFormValue>>;
    /**
     * Async derivation functions for asynchronous value derivation logic.
     *
     * These functions perform asynchronous operations (service calls, complex pipelines)
     * and return the derived value via a Promise or Observable. They are called when a
     * `DerivationLogicConfig` references them by `asyncFunctionName`.
     *
     * Async derivation functions:
     * - Receive an `EvaluationContext` with access to `formValue`
     * - Return a Promise or Observable of the value to set on the target field
     * - Handle their own I/O (no HttpClient provided — use injected services)
     * - Require explicit `dependsOn` to avoid triggering on every form change
     *
     * @example
     * ```typescript
     * asyncDerivations: {
     *   fetchSuggestedPrice: async (context) => {
     *     const response = await fetch(`/api/price?product=${context.formValue.productId}`);
     *     const data = await response.json();
     *     return data.suggestedPrice;
     *   },
     *   lookupAddress: (context) => {
     *     return addressService.lookup(context.formValue.zipCode).pipe(
     *       map(result => result.formattedAddress)
     *     );
     *   },
     * }
     * ```
     */
    asyncDerivations?: Record<string, AsyncDerivationFunction<TFormValue>>;
    /**
     * Async condition functions for asynchronous field state logic.
     *
     * These functions perform asynchronous operations and return a boolean
     * indicating whether the condition is met. They are referenced by
     * `asyncFunctionName` in `AsyncCondition` expressions.
     *
     * Async condition functions:
     * - Receive an `EvaluationContext` with access to `formValue`
     * - Return a Promise or Observable of boolean
     * - Handle their own I/O (use injected services)
     *
     * @example
     * ```typescript
     * asyncConditions: {
     *   checkPermission: async (context) => {
     *     const response = await fetch(`/api/permissions?role=${context.formValue.role}`);
     *     const data = await response.json();
     *     return data.canEdit;
     *   },
     * }
     * ```
     */
    asyncConditions?: Record<string, AsyncConditionFunction<TFormValue>>;
    /**
     * Custom validators using Angular's public FieldContext API
     *
     * (ctx, params?) => ValidationError | ValidationError[] | null
     *
     * Validators receive FieldContext which provides access to:
     * - Current field value: `ctx.value()`
     * - Field state: `ctx.state` (errors, touched, dirty, etc.)
     * - Other field values: `ctx.valueOf(path)` - public API!
     * - Other field states: `ctx.stateOf(path)`
     * - Parameters from JSON configuration
     *
     * **Return Types:**
     * - Single error: `{ kind: 'errorKind' }` for field-level validation
     * - Multiple errors: `[{ kind: 'error1' }, { kind: 'error2' }]` for cross-field validation
     * - No error: `null` when validation passes
     *
     * @example Single Field Validation
     * ```typescript
     * validators: {
     *   noSpaces: (ctx) => {
     *     const value = ctx.value();
     *     if (typeof value === 'string' && value.includes(' ')) {
     *       return { kind: 'noSpaces' };
     *     }
     *     return null;
     *   }
     * }
     * ```
     *
     * @example Cross-Field Validation (Public API)
     * ```typescript
     * validators: {
     *   lessThan: (ctx, params) => {
     *     const value = ctx.value();
     *     const compareToPath = params?.field as string;
     *
     *     // Use valueOf() to access other field - public API!
     *     const otherValue = ctx.valueOf(compareToPath as any);
     *
     *     if (otherValue !== undefined && value >= otherValue) {
     *       return { kind: 'notLessThan' };
     *     }
     *     return null;
     *   }
     * }
     * ```
     *
     * @example Multiple Errors
     * ```typescript
     * validators: {
     *   validateDateRange: (ctx) => {
     *     const errors: ValidationError[] = [];
     *     const startDate = ctx.valueOf('startDate' as any);
     *     const endDate = ctx.valueOf('endDate' as any);
     *
     *     if (!startDate) errors.push({ kind: 'startDateRequired' });
     *     if (!endDate) errors.push({ kind: 'endDateRequired' });
     *     if (startDate && endDate && startDate > endDate) {
     *       errors.push({ kind: 'invalidDateRange' });
     *     }
     *
     *     return errors.length > 0 ? errors : null;
     *   }
     * }
     * ```
     */
    validators?: Record<string, CustomValidator>;
    /**
     * Async custom validators using Angular's resource-based validateAsync() API
     *
     * Angular's validateAsync uses the resource API for async validation.
     * Validators must provide params, factory, onSuccess, and optional onError callbacks.
     *
     * **Structure:**
     * - `params`: Function that computes params from field context
     * - `factory`: Function that creates ResourceRef from params signal
     * - `onSuccess`: Maps resource result to validation errors
     * - `onError`: Optional handler for resource errors
     *
     * **Use Cases:**
     * - Database lookups via services with resource API
     * - Complex async business logic with Angular resources
     *
     * **Note:** For HTTP validation, prefer `httpValidators` which provides
     * a simpler API specifically designed for HTTP requests.
     *
     * @example Database Lookup with Resource
     * ```typescript
     * asyncValidators: {
     *   checkUsernameAvailable: {
     *     params: (ctx) => ({ username: ctx.value() }),
     *     factory: (params) => {
     *       const injector = inject(Injector);
     *       return resource({
     *         request: () => params(),
     *         loader: ({ request }) => {
     *           if (!request?.username) return null;
     *           const service = injector.get(UserService);
     *           return firstValueFrom(service.checkAvailability(request.username));
     *         }
     *       });
     *     },
     *     onSuccess: (result, ctx) => {
     *       if (!result) return null;
     *       return result.available ? null : { kind: 'usernameTaken' };
     *     },
     *     onError: (error, ctx) => {
     *       console.error('Availability check failed:', error);
     *       return null; // Don't block form on network errors
     *     }
     *   }
     * }
     * ```
     */
    asyncValidators?: Record<string, AsyncCustomValidator>;
    /**
     * HTTP validators using Angular's validateHttp() API.
     *
     * For function-based HTTP validation with automatic request cancellation.
     * Prefer declarative HTTP validators (`type: 'http'` with `http` + `responseMapping`)
     * for fully JSON-serializable validation when possible.
     *
     * @example
     * ```typescript
     * httpValidators: {
     *   checkUsername: {
     *     request: (ctx) => `/api/users/check?username=${encodeURIComponent(ctx.value())}`,
     *     onSuccess: (response) => response.available ? null : { kind: 'usernameTaken' },
     *   }
     * }
     * ```
     */
    httpValidators?: Record<string, HttpCustomValidator>;
}
/**
 * Global form configuration options.
 *
 * Controls form-wide behavior including disabled state
 * and button behavior configuration.
 *
 * @example
 * ```typescript
 * options: {
 *   disabled: false,
 *   submitButton: { disableWhenInvalid: true }
 * }
 * ```
 *
 * @public
 */
interface FormOptions {
    /**
     * Disable the entire form.
     *
     * When enabled, all form fields become read-only and cannot
     * be modified by user interaction.
     *
     * @value false
     */
    disabled?: boolean;
    /**
     * Maximum number of iterations for derivation chain processing.
     *
     * Derivations can trigger other derivations (e.g., A → B → C).
     * This limit prevents infinite loops in case of circular dependencies
     * that weren't caught at build time.
     *
     * Increase this value if you have legitimate deep derivation chains
     * (more than 10 levels deep).
     *
     * @default 10
     */
    maxDerivationIterations?: number;
    /**
     * Default disabled behavior for submit buttons.
     *
     * Controls when submit buttons are automatically disabled.
     * Can be overridden per-button via the `logic` array on individual button fields.
     *
     * @example
     * ```typescript
     * options: {
     *   submitButton: {
     *     disableWhenInvalid: true,      // Disable when form is invalid
     *     disableWhileSubmitting: true,  // Disable during submission
     *   }
     * }
     * ```
     */
    submitButton?: SubmitButtonOptions;
    /**
     * Default disabled behavior for next page buttons.
     *
     * Controls when next page buttons are automatically disabled in paged forms.
     * Can be overridden per-button via the `logic` array on individual button fields.
     *
     * @example
     * ```typescript
     * options: {
     *   nextButton: {
     *     disableWhenPageInvalid: true,  // Disable when current page is invalid
     *     disableWhileSubmitting: true,  // Disable during submission
     *   }
     * }
     * ```
     */
    nextButton?: NextButtonOptions;
    /**
     * Whether to exclude values of hidden fields from submission output.
     *
     * Overrides the global `withValueExclusionDefaults()` setting for this form.
     * Can be further overridden per-field on individual `FieldDef` entries.
     *
     * @default undefined (uses global setting)
     */
    excludeValueIfHidden?: boolean;
    /**
     * Whether to exclude values of disabled fields from submission output.
     *
     * Overrides the global `withValueExclusionDefaults()` setting for this form.
     * Can be further overridden per-field on individual `FieldDef` entries.
     *
     * @default undefined (uses global setting)
     */
    excludeValueIfDisabled?: boolean;
    /**
     * Whether to exclude values of readonly fields from submission output.
     *
     * Overrides the global `withValueExclusionDefaults()` setting for this form.
     * Can be further overridden per-field on individual `FieldDef` entries.
     *
     * @default undefined (uses global setting)
     */
    excludeValueIfReadonly?: boolean;
    /**
     * Whether to attach the current form value to all events dispatched through the EventBus.
     *
     * This per-form setting overrides the global `withEventFormValue()` feature:
     * - `true` - Enable form value emission for this form (even if globally disabled)
     * - `false` - Disable form value emission for this form (even if globally enabled)
     * - `undefined` - Use global setting (default)
     *
     * When enabled, events will include a `formValue` property with the current form state.
     * Use the `hasFormValue()` type guard to safely access this property.
     *
     * @example
     * ```typescript
     * // Enable for this form only (no global withEventFormValue() needed)
     * const config: FormConfig = {
     *   fields: [...],
     *   options: { emitFormValueOnEvents: true }
     * };
     *
     * // Disable for this form (when globally enabled)
     * const config: FormConfig = {
     *   fields: [...],
     *   options: { emitFormValueOnEvents: false }
     * };
     * ```
     *
     * @default undefined (uses global setting)
     */
    emitFormValueOnEvents?: boolean;
}
/**
 * Options for controlling submit button disabled behavior.
 *
 * @public
 */
interface SubmitButtonOptions {
    /**
     * Disable submit button when the form is invalid.
     *
     * @default true
     */
    disableWhenInvalid?: boolean;
    /**
     * Disable submit button while the form is submitting.
     *
     * Requires `submission.action` to be configured for automatic detection.
     *
     * @default true
     */
    disableWhileSubmitting?: boolean;
}
/**
 * Options for controlling next page button disabled behavior.
 *
 * @public
 */
interface NextButtonOptions {
    /**
     * Disable next button when the current page has invalid fields.
     *
     * @default true
     */
    disableWhenPageInvalid?: boolean;
    /**
     * Disable next button while the form is submitting.
     *
     * @default true
     */
    disableWhileSubmitting?: boolean;
}

/**
 * Context for resolving button disabled state.
 *
 * @public
 */
interface ButtonLogicContext {
    /** The form's FieldTree instance (supports both string and number keys for array indices) */
    form: FieldTree<unknown, string | number>;
    /** Form-level options */
    formOptions?: FormOptions;
    /** Field-level logic array (if provided) */
    fieldLogic?: LogicConfig[];
    /** Explicit disabled state from field definition */
    explicitlyDisabled?: boolean;
    /** Current page validity signal (for paged forms) */
    currentPageValid?: Signal<boolean>;
    /** Current form value for evaluating conditional expressions */
    formValue?: unknown;
    /** Optional logger for diagnostic output. Falls back to no-op logger if not provided. */
    logger?: Logger;
}
/**
 * Allowed logic types for non-form-bound elements (buttons, text fields, etc.).
 * These elements only support hidden and disabled states - not readonly or required
 * since they don't participate in form validation.
 *
 * @public
 */
type NonFieldLogicType = 'hidden' | 'disabled';
/**
 * Logic config restricted to types valid for non-form-bound elements.
 * This is a subset of LogicConfig that only includes hidden and disabled types.
 *
 * @public
 */
type NonFieldLogicConfig = LogicConfig & {
    type: NonFieldLogicType;
};
/**
 * Context for resolving state (hidden/disabled) for non-form-bound elements.
 *
 * This is a generalized context that can be used by any field mapper (buttons, text fields,
 * or any non-form-bound elements) to evaluate logic from a `logic` array.
 *
 * Note: While this context accepts the full `LogicConfig[]` for flexibility, the resolver
 * functions only process hidden and disabled types. Other logic types (readonly, required,
 * derivation) are ignored for non-form-bound elements.
 *
 * @public
 */
interface NonFieldLogicContext {
    /** The form's FieldTree instance (supports both string and number keys for array indices) */
    form: FieldTree<unknown, string | number>;
    /**
     * Field-level logic array containing conditions.
     * Accepts full LogicConfig[] for compatibility, but only hidden and disabled types are processed.
     */
    fieldLogic?: LogicConfig[];
    /** Explicit state from field definition (e.g., `hidden: true` or `disabled: true`) */
    explicitValue?: boolean;
    /** Current form value for evaluating conditional expressions */
    formValue?: unknown;
    /** Optional logger for diagnostic output. Falls back to no-op logger if not provided. */
    logger?: Logger;
}
/**
 * Resolves the disabled state for a submit button.
 *
 * The disabled state is determined by (in order of precedence):
 * 1. Explicit `disabled: true` on the field definition
 * 2. Field-level `logic` array (if present, overrides form-level defaults)
 * 3. Form-level `options.submitButton` defaults
 *
 * @param ctx - The button logic context
 * @returns A computed signal that returns true when the button should be disabled
 *
 * @example
 * ```typescript
 * const disabled = resolveSubmitButtonDisabled({
 *   form: formInstance,
 *   formOptions: config.options,
 *   fieldLogic: buttonField.logic,
 *   explicitlyDisabled: buttonField.disabled,
 * });
 *
 * // Use in template
 * <button [disabled]="disabled()">Submit</button>
 * ```
 *
 * @public
 */
declare function resolveSubmitButtonDisabled(ctx: ButtonLogicContext): Signal<boolean>;
/**
 * Resolves the disabled state for a next page button.
 *
 * The disabled state is determined by (in order of precedence):
 * 1. Explicit `disabled: true` on the field definition
 * 2. Field-level `logic` array (if present, overrides form-level defaults)
 * 3. Form-level `options.nextButton` defaults
 *
 * @param ctx - The button logic context
 * @returns A computed signal that returns true when the button should be disabled
 *
 * @example
 * ```typescript
 * const disabled = resolveNextButtonDisabled({
 *   form: formInstance,
 *   formOptions: config.options,
 *   fieldLogic: buttonField.logic,
 *   explicitlyDisabled: buttonField.disabled,
 *   currentPageValid: pageOrchestrator.currentPageValid,
 * });
 * ```
 *
 * @public
 */
declare function resolveNextButtonDisabled(ctx: ButtonLogicContext): Signal<boolean>;
/**
 * Evaluates the hidden state for non-form-bound elements synchronously.
 *
 * This is a pure function (no signal allocation) that can be called directly inside
 * an existing `computed()` block without creating ephemeral signal allocations.
 *
 * The hidden state is determined by (in order of precedence):
 * 1. Explicit `hidden: true` on the field definition
 * 2. Field-level `logic` array with `type: 'hidden'` conditions
 *
 * @param ctx - The context containing form, logic array, and explicit hidden state
 * @returns true when the element should be hidden
 *
 * @public
 */
declare function evaluateNonFieldHidden(ctx: NonFieldLogicContext): boolean;
/**
 * Resolves the hidden state for non-form-bound elements as a reactive signal.
 *
 * Wraps {@link evaluateNonFieldHidden} in a `computed()` for use cases where a standalone
 * signal is needed. When calling from inside an existing `computed()`, prefer
 * {@link evaluateNonFieldHidden} directly to avoid ephemeral signal allocation.
 *
 * @param ctx - The context containing form, logic array, and explicit hidden state
 * @returns A computed signal that returns true when the element should be hidden
 *
 * @public
 */
declare function resolveNonFieldHidden(ctx: NonFieldLogicContext): Signal<boolean>;
/**
 * Evaluates the disabled state for non-form-bound elements synchronously.
 *
 * This is a pure function (no signal allocation) that can be called directly inside
 * an existing `computed()` block without creating ephemeral signal allocations.
 *
 * The disabled state is determined by (in order of precedence):
 * 1. Explicit `disabled: true` on the field definition
 * 2. Field-level `logic` array with `type: 'disabled'` conditions
 *
 * @param ctx - The context containing form, logic array, and explicit disabled state
 * @returns true when the element should be disabled
 *
 * @public
 */
declare function evaluateNonFieldDisabled(ctx: NonFieldLogicContext): boolean;
/**
 * Resolves the disabled state for non-form-bound elements as a reactive signal.
 *
 * Wraps {@link evaluateNonFieldDisabled} in a `computed()` for use cases where a standalone
 * signal is needed. When calling from inside an existing `computed()`, prefer
 * {@link evaluateNonFieldDisabled} directly to avoid ephemeral signal allocation.
 *
 * @param ctx - The context containing form, logic array, and explicit disabled state
 * @returns A computed signal that returns true when the element should be disabled
 *
 * @public
 */
declare function resolveNonFieldDisabled(ctx: NonFieldLogicContext): Signal<boolean>;

/**
 * Text element type for rendering different HTML text elements
 */
type TextElementType = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span';
/**
 * Properties for text field configuration
 */
type TextProps = {
    /** The HTML element type to render */
    elementType: TextElementType;
};
/**
 * Text field definition for displaying translatable text content
 */
interface TextField extends FieldDef<TextProps> {
    type: 'text';
    /**
     * Logic rules for conditional visibility.
     * Text fields only support 'hidden' logic type since they are display-only
     * and don't participate in form validation (no disabled/readonly/required).
     */
    readonly logic?: NonFieldLogicConfig[];
}

/**
 * Configuration for the built-in 'css' wrapper type.
 *
 * The CSS wrapper applies CSS classes around wrapped content via a DynamicText
 * input that resolves to space-separated class names.
 *
 * @example
 * ```typescript
 * const wrapper: CssWrapper = {
 *   type: 'css',
 *   cssClasses: 'my-css-class another-class',
 * };
 * ```
 */
interface CssWrapper {
    readonly type: 'css';
    /** CSS classes to apply to the wrapper */
    readonly cssClasses?: DynamicText;
}

/**
 * Configuration for the built-in 'row' wrapper type.
 *
 * The row wrapper applies grid/flex layout to the wrapped content, providing
 * horizontal field arrangement with 12-column sizing utilities (`df-col-1`
 * through `df-col-12`) available to child fields via their own `col` property.
 *
 * Applied automatically by `rowFieldMapper` when a user writes `{ type: 'row' }` —
 * users do not construct this config directly.
 *
 * @example
 * ```typescript
 * const wrapper: RowWrapper = { type: 'row' };
 * ```
 */
interface RowWrapper {
    readonly type: 'row';
}

/**
 * Container field interface for wrapping child fields with UI chrome.
 *
 * A container field is a container that renders its children inside a chain
 * of wrapper components. Each wrapper provides visual decoration (sections,
 * headers, expand/collapse, styling) without affecting the form data structure.
 *
 * Like a row field, the container field:
 * - Does not create a new form context
 * - Flattens child values into the parent form
 * - Is purely a visual/layout container
 *
 * Unlike a row field, the container field:
 * - Supports a `wrappers` array that chains wrapper components around the children
 * - Uses imperative `ViewContainerRef.createComponent()` for the wrapper chain
 *
 * Containers are pure layout primitives that flatten their children into the
 * parent form, so any registered field type may appear inside — including
 * pages, hidden fields, rows, and other containers (see
 * {@link ContainerAllowedChildren}).
 *
 * @example
 * ```typescript
 * const field: ContainerField = {
 *   type: 'container',
 *   key: 'contactSection',
 *   fields: [
 *     { key: 'email', type: 'input', value: '' },
 *     { key: 'phone', type: 'input', value: '' },
 *   ],
 *   wrappers: [
 *     { type: 'section', header: 'Contact Info' },
 *   ]
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Multiple wrappers chain from outermost to innermost
 * const field: ContainerField = {
 *   type: 'container',
 *   key: 'styledSection',
 *   fields: [{ key: 'name', type: 'input', value: '' }],
 *   wrappers: [
 *     { type: 'section', header: 'Details' },  // outermost
 *     { type: 'style', class: 'highlight' },    // innermost
 *   ]
 * };
 * ```
 */
interface ContainerField<TFields extends readonly ContainerAllowedChildren[] = readonly ContainerAllowedChildren[], TWrapperConfigs extends readonly WrapperConfig[] = readonly WrapperConfig[]> extends FieldDef<never> {
    type: 'container';
    /** Child definitions to render within this container */
    readonly fields: TFields;
    /**
     * Wrapper components to chain around the children.
     * Applied outermost-first: the first wrapper in the array is the outermost.
     * Each wrapper component receives the subsequent wrapper (or children) inside
     * its `#fieldComponent` ViewContainerRef slot.
     */
    readonly wrappers: TWrapperConfigs;
    /** Container fields do not have a label property */
    readonly label?: never;
    /** Containers do not support meta — they have no native form element */
    readonly meta?: never;
    /**
     * Logic configurations for conditional container visibility.
     * Only 'hidden' type logic is supported for containers.
     */
    readonly logic?: ContainerLogicConfig[];
}
/**
 * Type guard for ContainerField with proper type narrowing.
 *
 * `wrappers` is part of the type but optional in practice — many configs use
 * containers purely as flex/layout wrappers without any wrapper components.
 * Match on `type === 'container'` and the `fields` shape only, mirroring
 * `isPageField` / `isRowField`.
 */
declare function isContainerTypedField(field: FieldDef<any>): field is ContainerField;

/**
 * Container fields registry - augment this interface to add custom container fields
 *
 * @example
 * ```typescript
 * declare module '@ng-forge/dynamic-forms' {
 *   interface FieldRegistryContainers {
 *     'my-container': MyContainerFieldDef;
 *   }
 * }
 * ```
 */
interface FieldRegistryContainers {
    page: PageField;
    row: RowField;
    group: GroupField;
    array: ArrayField | SimplifiedArrayField;
    container: ContainerField;
}
/**
 * Leaf fields registry - augment this interface to add custom leaf fields
 *
 * @example
 * ```typescript
 * declare module '@ng-forge/dynamic-forms' {
 *   interface FieldRegistryLeaves {
 *     'my-input': MyInputFieldDef;
 *   }
 * }
 * ```
 */
interface FieldRegistryLeaves {
    text: TextField;
    hidden: HiddenField;
}
/**
 * Wrapper type registry for module augmentation.
 *
 * Augment this interface to add type-safe wrapper type definitions.
 *
 * @example
 * ```typescript
 * declare module '@ng-forge/dynamic-forms' {
 *   interface FieldRegistryWrappers {
 *     'section': MySectionFieldDef
 *   }
 * }
 * ```
 */
interface FieldRegistryWrappers {
    css: CssWrapper;
    row: RowWrapper;
}
/**
 * Global interface for dynamic form field definitions with categorization
 * This interface combines containers and leaves from their respective registries
 *
 * Container fields: Layout fields that contain other fields (page, row, group, array)
 * Leaf fields: Fields that can hold values or display content (input, text, etc.)
 *
 * To add custom fields, augment FieldRegistryContainers or FieldRegistryLeaves
 */
interface DynamicFormFieldRegistry {
    /**
     * Container fields that hold other fields (no value, have children)
     */
    containers: FieldRegistryContainers;
    /**
     * Leaf fields that have values or display content
     */
    leaves: FieldRegistryLeaves;
    /**
     * Field wrappers types
     */
    wrappers: FieldRegistryWrappers;
}
/**
 * Union type of all registered container field definitions
 */
type ContainerFieldTypes = DynamicFormFieldRegistry['containers'][keyof DynamicFormFieldRegistry['containers']];
/**
 * Union type of all registered leaf field definitions
 */
type LeafFieldTypes = DynamicFormFieldRegistry['leaves'][keyof DynamicFormFieldRegistry['leaves']];
/**
 * Union type of all registered field definitions
 */
type RegisteredFieldTypes = ContainerFieldTypes | LeafFieldTypes;
/**
 * Extract field types that are available in the registry
 */
type AvailableFieldTypes = keyof DynamicFormFieldRegistry['containers'] | keyof DynamicFormFieldRegistry['leaves'];
/**
 * Extract wrapper types that are available in the registry
 */
type RegisteredWrapperTypes = keyof DynamicFormFieldRegistry['wrappers'];
/**
 * Combined registry mapping type names to field definitions.
 * This flattens containers and leaves into a single mapping.
 */
type FieldTypeMap = DynamicFormFieldRegistry['containers'] & DynamicFormFieldRegistry['leaves'];
/**
 * Extract a specific field type from RegisteredFieldTypes based on the `type` discriminant.
 * This enables proper type narrowing when defining fields.
 *
 * @example
 * ```typescript
 * // Extract a specific field type
 * type MyInputField = ExtractField<'input'>;
 *
 * // Use in field definitions for proper props inference
 * const field: ExtractField<'input'> = {
 *   type: 'input',
 *   key: 'email',
 *   value: '',
 *   props: { type: 'email' } // Only input props allowed here
 * };
 * ```
 */
type ExtractField<T extends AvailableFieldTypes> = T extends keyof FieldTypeMap ? FieldTypeMap[T] : never;
/**
 * Narrow a field definition based on its `type` property.
 * Use this to get proper type inference when working with field unions.
 *
 * @example
 * ```typescript
 * function processField<T extends RegisteredFieldTypes>(field: T): NarrowField<T> {
 *   return field as NarrowField<T>;
 * }
 * ```
 */
type NarrowField<T> = T extends {
    type: infer TType;
} ? (TType extends AvailableFieldTypes ? ExtractField<TType> : T) : T;
/**
 * Narrow each field in an array based on its `type` property.
 * Use with `satisfies` to get proper type inference for field arrays.
 *
 * @example
 * ```typescript
 * const fields = [
 *   { type: 'input', key: 'name', value: '', props: { type: 'text' } },
 *   { type: 'select', key: 'country', value: 'us', options: [...] },
 * ] as const satisfies NarrowFields;
 * ```
 */
type NarrowFields = readonly NarrowField<RegisteredFieldTypes>[];

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
type PageAllowedChildren = LeafFieldTypes | RowField | GroupField | ArrayField | SimplifiedArrayField | ContainerField;
/**
 * Fields that are allowed as children of Group fields
 * Groups can contain: rows and leaf fields (but NOT pages or other groups)
 */
type GroupAllowedChildren = LeafFieldTypes | RowField | ContainerField;
/**
 * Fields that are allowed as children of Array fields
 * Arrays can contain: rows, groups, and leaf fields (but NOT pages or other arrays)
 * Groups are used for creating object arrays where each array item is an object
 */
type ArrayAllowedChildren = LeafFieldTypes | RowField | GroupField | ContainerField;
/**
 * Fields that are allowed as children of Container fields.
 * Containers are pure layout primitives that flatten their children into the
 * parent form, so most registered field types may appear inside — including
 * hidden fields and other containers — but NOT pages.
 */
type ContainerAllowedChildren = LeafFieldTypes | RowField | GroupField | ArrayField | SimplifiedArrayField | ContainerField;
/**
 * Row is a synthetic field type that resolves to a Container at runtime, so
 * it accepts the same children as a Container.
 */
type RowAllowedChildren = ContainerAllowedChildren;

/**
 * Row field interface for creating horizontal layouts.
 * A row is a synthetic field type that resolves to a Container at runtime,
 * with a synthesized `{ type: 'row' }` wrapper applied for layout. The row
 * itself does not hold a value — its children flatten into the parent form.
 *
 * Note: Rows do not support `meta` since they have no native form element.
 */
interface RowField<TFields extends readonly RowAllowedChildren[] = readonly RowAllowedChildren[]> extends FieldDef<never> {
    type: 'row';
    /** Child definitions to render within this row */
    readonly fields: TFields;
    /** Row fields do not have a label property **/
    readonly label?: never;
    /** Rows do not support meta - they have no native form element **/
    readonly meta?: never;
    /**
     * Logic configurations for conditional row visibility.
     * Only 'hidden' type logic is supported for rows.
     */
    readonly logic?: ContainerLogicConfig[];
}
/**
 * Type guard for RowField with proper type narrowing
 */
declare function isRowField(field: FieldDef<any>): field is RowField;

/**
 * Resolves a wrapper type name to its registered config interface.
 *
 * When `TWrappers` is a specific registered key (e.g., `'css'`), resolves to
 * the full config type from `FieldRegistryWrappers` (e.g., `CssWrapper`),
 * providing type-safe access to wrapper-specific properties like `cssClasses`.
 *
 * When `TWrappers` is the full `RegisteredWrapperTypes` union, distributes
 * to produce a discriminated union of all registered wrapper configs.
 *
 * @example
 * ```typescript
 * // Resolves to CssWrapper — cssClasses is typed
 * type CssConfig = WrapperConfig<'css'>;
 *
 * // Union of all registered wrapper configs
 * type AnyConfig = WrapperConfig;
 * ```
 */
type WrapperConfig<TWrappers extends RegisteredWrapperTypes = RegisteredWrapperTypes> = TWrappers extends keyof FieldRegistryWrappers ? FieldRegistryWrappers[TWrappers] : {
    readonly type: TWrappers;
};
/**
 * Signature of a lazy component loader — either a direct component class or
 * an ES module whose `default` export is the component. Shared by field and
 * wrapper registrations so the `loadComponent: () => import('./x.component')`
 * idiom types cleanly in both places.
 */
type LazyComponentLoader<T = unknown> = () => Promise<Type<T> | {
    default: Type<T>;
}>;
/**
 * Configuration interface for registering wrapper types.
 *
 * Defines how a wrapper component is loaded and identified. Wrapper components
 * provide visual decoration around field content (sections, headers, styling)
 * without affecting the form data structure.
 *
 * @example
 * ```typescript
 * const SectionWrapper: WrapperTypeDefinition = {
 *   name: 'section',
 *   loadComponent: () => import('./section-wrapper.component').then(m => m.SectionWrapperComponent),
 * };
 * ```
 */
interface WrapperTypeDefinition<T extends WrapperConfig = WrapperConfig> {
    /** Unique identifier for the wrapper type (also serves as discriminant from FieldTypeDefinition) */
    wrapperName: string;
    /** Wrapper definition type marker (internal use) */
    _wrapper?: T;
    /**
     * Function to load the wrapper component (supports lazy loading).
     * Returns a Promise that resolves to the component class or module with default export.
     */
    loadComponent: LazyComponentLoader;
    /**
     * Field types this wrapper should auto-apply to.
     *
     * When a field's `type` matches any entry, the wrapper is injected into that
     * field's effective wrapper chain at the lowest priority (can be overridden
     * by `FormConfig.defaultWrappers` or the field-level `wrappers` array, and
     * fully cleared with `wrappers: null`).
     */
    types?: readonly string[];
}
/**
 * Type guard for WrapperTypeDefinition.
 *
 * Discriminates via `wrapperName` — field types use `name`, wrapper types use `wrapperName`.
 */
declare function isWrapperTypeDefinition(value: unknown): value is WrapperTypeDefinition;
/**
 * Contract that wrapper components must satisfy.
 *
 * Each wrapper exposes a `#fieldComponent` ViewContainerRef where the inner
 * content (next wrapper, or the field) is rendered imperatively. Config
 * properties (minus `type`) are set on the component via `setInput`; a
 * wrapper opts into a key by declaring a matching `input()`, and unknown
 * keys are silently dropped. Wrappers may additionally declare a
 * `fieldInputs` input for the wrapped field's mapper outputs (see
 * `WrapperFieldInputs` for when that's undefined).
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <dbx-section [header]="header() ?? ''">
 *       <ng-container #fieldComponent></ng-container>
 *     </dbx-section>
 *   `,
 * })
 * export class SectionWrapperComponent implements FieldWrapperContract {
 *   readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });
 *   readonly header = input<string>();
 *   readonly fieldInputs = input<WrapperFieldInputs>();
 * }
 * ```
 */
interface FieldWrapperContract {
    /** ViewContainerRef slot where inner content is rendered */
    readonly fieldComponent: Signal<ViewContainerRef>;
}
/**
 * Injection token for the wrapper type registry.
 *
 * Provides access to the map of registered wrapper types. The registry is
 * populated via `provideDynamicForm()` and used by `ContainerFieldComponent` to
 * resolve wrapper types to their component implementations.
 */
declare const WRAPPER_REGISTRY: InjectionToken<Map<string, WrapperTypeDefinition<RowWrapper | _ng_forge_dynamic_forms.CssWrapper>>>;

/**
 * Base interface for native HTML attributes that can be passed to form field elements.
 *
 * This interface serves as the base type for all meta attributes. Specific field types
 * (like input, textarea) extend this with their own specialized meta types.
 *
 * @example
 * ```typescript
 * // Using FieldMeta for custom attributes
 * meta: {
 *   'data-testid': 'email-input',
 *   'aria-describedby': 'email-help',
 *   'x-custom': 'value'
 * }
 * ```
 *
 * @public
 */
interface FieldMeta {
    /**
     * Allows any data-* attribute
     */
    [key: `data-${string}`]: string | undefined;
    /**
     * Allows any aria-* attribute
     */
    [key: `aria-${string}`]: string | boolean | undefined;
    /**
     * Allows additional custom attributes as escape hatch
     */
    [key: string]: string | number | boolean | undefined;
}

/**
 * Base interface for all dynamic form field definitions.
 *
 * This interface defines the common properties that all field types must implement.
 * Field-specific properties are defined through the generic TProps parameter,
 * providing type safety for field-specific configuration.
 *
 * @example
 * ```typescript
 * // Basic text input field
 * const textField: FieldDef<{ type?: string }> = {
 *   key: 'email',
 *   type: 'input',
 *   label: 'Email Address',
 *   props: { type: 'email' },
 *   col: 12
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Complex field with conditional logic
 * const conditionalField: FieldDef<SelectProps> = {
 *   key: 'country',
 *   type: 'select',
 *   label: 'Country',
 *   props: {
 *     options: [
 *       { label: 'United States', value: 'us' },
 *       { label: 'Canada', value: 'ca' }
 *     ]
 *   },
 *   hidden: false,
 *   disabled: false,
 *   col: 6
 * };
 * ```
 *
 * @typeParam TProps - Field-specific properties interface
 * @typeParam TMeta - Native HTML attributes interface (extends FieldMeta)
 *
 * @public
 */
interface FieldDef<TProps, TMeta extends FieldMeta = FieldMeta> {
    /**
     * Unique field identifier used for form binding and value tracking.
     *
     * This key is used to associate the field with form values and must be
     * unique within the form. It follows object property naming conventions.
     *
     * @example
     * ```typescript
     * // Simple field key
     * key: 'email'
     *
     * // Nested object notation
     * key: 'address.street'
     *
     * // Array notation
     * key: 'hobbies[0]'
     * ```
     */
    key: string;
    /**
     * Field type identifier for component selection.
     *
     * Determines which component will be rendered for this field.
     * Must match a registered field type name in the field registry.
     *
     * @example
     * ```typescript
     * type: 'input'     // Text input field
     * type: 'select'    // Dropdown selection
     * type: 'checkbox'  // Boolean checkbox
     * type: 'group'     // Field group container
     * ```
     */
    type: string;
    /**
     * Human-readable field label displayed to users.
     *
     * Provides accessible labeling for form fields and is typically
     * displayed above or beside the field input. Supports static strings,
     * translation keys, Observables, and Signals for dynamic content.
     *
     * @example
     * ```typescript
     * // Static string
     * label: 'Email Address'
     *
     * // Translation key (auto-detected)
     * label: 'form.email.label'
     *
     * // Observable from translation service
     * label: this.transloco.selectTranslate('form.email.label')
     *
     * // Signal-based
     * label: computed(() => this.translations().email.label)
     * ```
     */
    label?: DynamicText;
    /**
     * Field-specific properties and configuration options.
     *
     * Contains type-specific configuration that varies based on the field type.
     * The shape is defined by the TProps generic parameter.
     *
     * @example
     * ```typescript
     * // Input field props (placeholder is at field level, not inside props)
     * props: { type: 'email' }
     *
     * // Select field props
     * props: { options: [{ label: 'Yes', value: true }], multiple: false }
     *
     * // Button field props
     * props: { buttonType: 'submit', variant: 'primary' }
     * ```
     */
    props?: TProps;
    /**
     * Native HTML attributes to pass through to the underlying element.
     *
     * Contains attributes that are applied directly to the native input/element.
     * Useful for accessibility, autocomplete hints, and custom attributes.
     * The shape is defined by the TMeta generic parameter, which extends FieldMeta.
     *
     * @example
     * ```typescript
     * // Input field meta
     * meta: {
     *   autocomplete: 'email',
     *   inputmode: 'email',
     *   'aria-describedby': 'email-help',
     *   'data-testid': 'email-input'
     * }
     *
     * // Textarea meta
     * meta: {
     *   wrap: 'soft',
     *   spellcheck: true,
     *   'aria-label': 'Description field'
     * }
     * ```
     */
    meta?: TMeta;
    /**
     * Additional CSS classes for custom styling.
     *
     * Space-separated string of CSS class names that will be applied
     * to the field container for custom styling.
     *
     * @example
     * ```typescript
     * className: 'highlight required-field'
     * className: 'mt-4 text-center'
     * ```
     */
    className?: string;
    /**
     * Whether the field is disabled and cannot be interacted with.
     *
     * When true, the field is rendered in a disabled state and cannot
     * receive user input. The value can still be modified programmatically.
     *
     * @value false
     */
    disabled?: boolean;
    /**
     * Whether the field is read-only.
     *
     * When true, the field displays its value but cannot be modified
     * by user interaction. Differs from disabled in styling and accessibility.
     *
     * @value false
     */
    readonly?: boolean;
    /**
     * Whether the field is hidden from view.
     *
     * When true, the field is not rendered in the UI but still participates
     * in form state and validation. Useful for conditional field display.
     *
     * @value false
     */
    hidden?: boolean;
    /**
     * Tab index for keyboard navigation.
     *
     * Controls the order in which fields receive focus when navigating
     * with the Tab key. Follows standard HTML tabindex behavior.
     *
     * @example
     * ```typescript
     * tabIndex: 1    // First field in tab order
     * tabIndex: -1   // Excluded from tab navigation
     * tabIndex: 0    // Natural tab order
     * ```
     */
    tabIndex?: number | undefined;
    /**
     * Whether to exclude this field's value from submission output when hidden.
     *
     * Overrides both the global `withValueExclusionDefaults()` and form-level `FormOptions` settings.
     *
     * @default undefined (uses form-level or global setting)
     */
    excludeValueIfHidden?: boolean;
    /**
     * Whether to exclude this field's value from submission output when disabled.
     *
     * Overrides both the global `withValueExclusionDefaults()` and form-level `FormOptions` settings.
     *
     * @default undefined (uses form-level or global setting)
     */
    excludeValueIfDisabled?: boolean;
    /**
     * Whether to exclude this field's value from submission output when readonly.
     *
     * Overrides both the global `withValueExclusionDefaults()` and form-level `FormOptions` settings.
     *
     * @default undefined (uses form-level or global setting)
     */
    excludeValueIfReadonly?: boolean;
    /**
     * Column sizing configuration for responsive grid layout.
     *
     * Specifies how many columns this field should span in a 12-column
     * grid system. Supports responsive behavior and field arrangement.
     *
     * @example
     * ```typescript
     * col: 12  // Full width
     * col: 6   // Half width
     * col: 4   // One third width
     * col: 3   // Quarter width
     * ```
     *
     * @value 12
     */
    col?: number;
    /**
     * Wrapper components to chain around this field.
     *
     * - `undefined` — inherit auto-associations + form defaults.
     * - `null` — render bare (see `skipAuto`/`skipDefaults` for partial opt-out).
     * - `readonly WrapperConfig[]` — merged innermost with auto + defaults.
     * - `[]` is **not** an opt-out; inherits like `undefined`.
     */
    wrappers?: readonly WrapperConfig[] | null;
    /**
     * Skip the auto-association layer (`WrapperTypeDefinition.types`) while
     * keeping form-level defaults and any field-level `wrappers`. Use when a
     * global wrapper auto-applies to this field type but isn't wanted here.
     */
    skipAutoWrappers?: boolean;
    /**
     * Skip the form-level `defaultWrappers` layer while keeping auto-associations
     * and any field-level `wrappers`.
     */
    skipDefaultWrappers?: boolean;
}
type IncludedKeys = 'label' | 'className' | 'hidden' | 'tabIndex';
/**
 * Type utility for extracting component input properties from field definitions.
 *
 * Transforms field definition properties into Angular component input signals,
 * enabling type-safe component binding with automatic signal creation.
 *
 * @example
 * ```typescript
 * // Field definition
 * interface MyFieldDef extends FieldDef<MyProps> {
 *   customProp: string;
 * }
 *
 * // Component using FieldComponent type
 * @Component({...})
 * export class MyFieldComponent implements FieldComponent<MyFieldDef> {
 *   label = input<string>();
 *   className = input<string>();
 *   hidden = input<boolean>();
 *   tabIndex = input<number>();
 * }
 * ```
 *
 * @typeParam T - Field definition type to extract properties from
 *
 * @public
 */
type FieldComponent<T extends FieldDef<unknown, FieldMeta>> = Prettify<WithInputSignals<Pick<T, IncludedKeys>>>;

/**
 * Field signal context - the "nervous system" of the dynamic form.
 * Provided via FIELD_SIGNAL_CONTEXT injection token.
 *
 * Gives mappers and components access to form state, values, and configuration.
 * Container fields (Group, Array) create scoped contexts with nested forms.
 *
 * The `form` property uses Angular's FieldTree which includes Subfields<TModel>
 * for type-safe child field access via bracket notation when TModel is a Record.
 *
 * Note: Form-level configuration (defaultValidationMessages, formOptions, defaultProps)
 * is provided via dedicated injection tokens (DEFAULT_VALIDATION_MESSAGES, FORM_OPTIONS,
 * DEFAULT_PROPS) at the DynamicForm level and inherited by all children.
 */
interface FieldSignalContext<TModel extends Record<string, unknown> = Record<string, unknown>> {
    injector: Injector;
    value: WritableSignal<Partial<TModel> | undefined>;
    defaultValues: () => TModel;
    form: FieldTree<TModel>;
    /** Current page validity signal for paged forms. Used by next button to determine disabled state. */
    currentPageValid?: Signal<boolean>;
}
/**
 * Array context for fields rendered within arrays.
 * Provides position and parent array information for components inside array fields.
 */
interface ArrayContext {
    /** The key of the parent array field. */
    arrayKey: string;
    /**
     * The index of this item within the array.
     * Uses linkedSignal to automatically update when items are added/removed,
     * allowing index-dependent logic to react without component recreation.
     */
    index: Signal<number>;
    /** The current form value for token resolution. */
    formValue: unknown;
    /** The array field definition. */
    field: FieldDef<unknown>;
}
/**
 * Mapper function that converts a field definition to component inputs.
 *
 * Mappers run within an injection context and can inject FIELD_SIGNAL_CONTEXT.
 * Returns a Signal to enable reactive updates when dependencies change.
 */
type MapperFn<T extends FieldDef<unknown>> = (input: T) => Signal<Record<string, unknown>>;

/**
 * Defines how a field type handles form values and data collection.
 *
 * - 'include': Field contributes to form values (default for input fields)
 * - 'exclude': Field is excluded from form values (for display/layout fields)
 * - 'flatten': Field's children are flattened to parent level (for container fields)
 */
type ValueHandlingMode = 'include' | 'exclude' | 'flatten';
/**
 * Semantic grouping of interchangeable field UI alternatives.
 *
 * Used by tooling (e.g., openapi-generator) to discover which field types
 * can substitute for each other. A field with scope 'boolean' means it's
 * one of several ways to render a boolean value (checkbox, toggle, etc.).
 */
type FieldScope = 'boolean' | 'single-select' | 'multi-select' | 'text-input' | 'numeric' | 'date';
/**
 * Mapped component inputs that must be available before a field component is instantiated.
 *
 * This protects components that declare required Angular inputs and eagerly read them in
 * host bindings or computed signals. Renderers should defer component creation until all
 * listed mapped inputs are present.
 */
type RenderReadyInput = 'field' | (string & {});
/**
 * Configuration interface for registering custom field types.
 *
 * Defines how a field type should be handled by the dynamic form system,
 * including its component loading strategy and field-to-component mapping logic.
 * Supports both eager-loaded and lazy-loaded components.
 *
 * @typeParam T - The field definition type this field type handles
 *
 * @example
 * ```typescript
 * const CustomInputType: FieldTypeDefinition<InputFieldDef> = {
 *   name: 'custom-input',
 *   loadComponent: () => import('./custom-input.component').then(m => m.CustomInputComponent),
 *   mapper: customInputMapper
 * };
 *
 * // Register with providers
 * provideDynamicForm(CustomInputType)
 * ```
 */
interface FieldTypeDefinition<T extends FieldDef<any> = any> {
    /** Unique identifier for the field type */
    name: string;
    /** Field definition type marker (internal use) */
    _fieldDef?: T;
    /**
     * Function to load the component (supports lazy loading).
     * Returns a Promise that resolves to the component class or module with default export.
     *
     * Optional - omit for componentless fields (e.g., hidden fields) that only
     * contribute to form values without rendering any UI.
     */
    loadComponent?: LazyComponentLoader;
    /**
     * Mapper function that converts field definition to component bindings.
     *
     * Optional - omit for componentless fields (like hidden fields) that don't need
     * input mapping. When omitted for componentless fields (no loadComponent), an empty
     * signal is returned. When omitted for regular fields with a component, falls back
     * to baseFieldMapper.
     */
    mapper?: MapperFn<T>;
    /** How this field type handles form values and data collection (defaults to 'include') */
    valueHandling?: ValueHandlingMode;
    /**
     * List of prop keys to forward to the meta object.
     *
     * Some props (like `type` for inputs, `rows`/`cols` for textareas) are actually
     * native HTML attributes. Specifying them here causes them to be merged into
     * the meta object before being passed to the component, ensuring they're applied
     * via the meta tracking mechanism.
     *
     * Note: Meta values always take precedence over forwarded props.
     *
     * @example
     * ```typescript
     * {
     *   name: 'input',
     *   propsToMeta: ['type'],
     *   // ...
     * }
     * ```
     */
    propsToMeta?: string[];
    /** Semantic scope for tooling to discover interchangeable field alternatives */
    scope?: FieldScope | FieldScope[];
    /** Mapped component inputs that must exist before the renderer instantiates the component */
    renderReadyWhen?: RenderReadyInput[];
}
/**
 * Injection token for the global field type registry.
 *
 * Provides access to the map of registered field types throughout the application.
 * The registry is populated by the provideDynamicForm function and used by
 * field rendering components to resolve field types to their implementations.
 *
 * @example
 * ```typescript
 * constructor(@Inject(FIELD_REGISTRY) private registry: Map<string, FieldTypeDefinition>) {
 *   const inputType = registry.get('input');
 * }
 * ```
 */
declare const FIELD_REGISTRY: InjectionToken<Map<string, FieldTypeDefinition<any>>>;

/**
 * Resolved field ready for rendering with ngComponentOutlet / DfFieldOutlet.
 */
interface ResolvedField {
    key: string;
    /** The original field definition (used by DfFieldOutlet to resolve wrappers). */
    fieldDef: FieldDef<unknown>;
    component: Type<unknown>;
    injector: Injector;
    inputs: Signal<Record<string, unknown>>;
    renderReady: Signal<boolean>;
}

/**
 * Form mode enumeration distinguishing between paged and non-paged forms
 */
type FormMode = 'paged' | 'non-paged';
/**
 * Result of form mode detection with validation details
 */
interface FormModeDetectionResult {
    /** The detected form mode */
    mode: FormMode;
    /** Whether the form configuration is valid for the detected mode */
    isValid: boolean;
    /** Array of validation errors if form is invalid */
    errors: string[];
}

/**
 * Error from async field component loading.
 *
 * @public
 */
interface FieldLoadingError {
    readonly fieldType: string;
    readonly fieldKey: string;
    readonly error: Error;
}

/**
 * Base interface for all form events in the dynamic form system.
 *
 * All form events must implement this interface to be compatible with
 * the event bus system. The type property is used for event filtering
 * and type-safe subscriptions.
 *
 * @example
 * ```typescript
 * export class SubmitEvent implements FormEvent {
 *   readonly type = 'submit';
 * }
 *
 * export class ValidationErrorEvent implements FormEvent {
 *   readonly type = 'validation-error';
 *   constructor(public errors: ValidationErrors) {}
 * }
 * ```
 */
interface FormEvent {
    /** Unique identifier for the event type used for filtering and subscriptions */
    readonly type: string;
    /**
     * Optional form value attached to the event when `withEventFormValue()` is enabled
     * or `options.emitFormValueOnEvents` is set to `true` in the form config.
     *
     * Use the `hasFormValue()` type guard to check if this property is present.
     */
    readonly formValue?: unknown;
}
/**
 * Type guard to check if a form event has a form value attached.
 *
 * Use this to safely access the `formValue` property on events when
 * `withEventFormValue()` is enabled globally or `options.emitFormValueOnEvents`
 * is set to `true` in the form config.
 *
 * @example
 * ```typescript
 * eventBus.on<SubmitEvent>('submit').subscribe(event => {
 *   if (hasFormValue(event)) {
 *     console.log('Form value:', event.formValue);
 *   }
 * });
 * ```
 *
 * @param event - The form event to check
 * @returns `true` if the event has a form value attached, narrowing the type
 *
 * @public
 */
declare function hasFormValue<T extends FormEvent>(event: T): event is T & {
    formValue: unknown;
};
/**
 * Constructor type for form event classes.
 *
 * Defines the shape of event class constructors that can be used with
 * the event bus dispatch system. Supports both parameterless and
 * parameterized event constructors.
 *
 * @typeParam T - The form event type being constructed
 *
 * @example
 * ```typescript
 * // Parameterless event constructor
 * const SubmitEventCtor: FormEventConstructor<SubmitEvent> = SubmitEvent;
 *
 * // Parameterized event constructor
 * const ErrorEventCtor: FormEventConstructor<ErrorEvent> = ErrorEvent;
 * eventBus.dispatch(ErrorEventCtor);
 * ```
 */
type FormEventConstructor<T extends FormEvent = FormEvent> = new (...args: any[]) => T;

/**
 * Event dispatched when the form should be cleared.
 *
 * This event instructs the dynamic form component to clear all field values,
 * resetting them to empty/undefined state regardless of their default values.
 *
 * @example
 * ```typescript
 * // Dispatch from a button component
 * eventBus.dispatch(FormClearEvent);
 * ```
 *
 * @example
 * ```typescript
 * // Listen for clear events
 * eventBus.on<FormClearEvent>('form-clear').subscribe(() => {
 *   console.log('Form was cleared');
 * });
 * ```
 */
declare class FormClearEvent implements FormEvent {
    readonly type: "form-clear";
}

/**
 * Event dispatched when the form should be reset to its default values.
 *
 * This event instructs the dynamic form component to restore all field values
 * to their initial default values as defined in the form configuration.
 *
 * @example
 * ```typescript
 * // Dispatch from a button component
 * eventBus.dispatch(FormResetEvent);
 * ```
 *
 * @example
 * ```typescript
 * // Listen for reset events
 * eventBus.on<FormResetEvent>('form-reset').subscribe(() => {
 *   console.log('Form was reset to defaults');
 * });
 * ```
 */
declare class FormResetEvent implements FormEvent {
    readonly type: "form-reset";
}

declare class PageChangeEvent implements FormEvent {
    /** The current page index (0-based) */
    readonly currentPageIndex: number;
    /** Total number of pages */
    readonly totalPages: number;
    /** Previous page index (0-based), undefined if first navigation */
    readonly previousPageIndex?: number | undefined;
    readonly type: "page-change";
    constructor(
    /** The current page index (0-based) */
    currentPageIndex: number, 
    /** Total number of pages */
    totalPages: number, 
    /** Previous page index (0-based), undefined if first navigation */
    previousPageIndex?: number | undefined);
}

/**
 * State interface for the page orchestrator
 */
interface PageOrchestratorState {
    /** Current page index (0-based) */
    currentPageIndex: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether the current page is the first page */
    isFirstPage: boolean;
    /** Whether the current page is the last page */
    isLastPage: boolean;
    /** Whether navigation is currently disabled */
    navigationDisabled: boolean;
}

declare class PageNavigationStateChangeEvent implements FormEvent {
    state: PageOrchestratorState;
    type: "page-navigation-state-change";
    constructor(state: PageOrchestratorState);
}

/**
 * Dynamic form component — renders a form based on configuration.
 * Delegates state management to `FormStateManager`.
 *
 * @example
 *```html
 * <form [dynamic-form]="formConfig" [(value)]="formData" (submitted)="handleSubmit($event)"></form>
 * ```
 */
declare class DynamicForm<TFields extends RegisteredFieldTypes[] = RegisteredFieldTypes[], TModel extends Record<string, unknown> = InferFormValue$1<TFields> & Record<string, unknown>> {
    /** Form configuration defining the structure, validation, and behavior. */
    config: _angular_core.InputSignal<FormConfig<TFields, InferFormValue$1<TFields extends readonly RegisteredFieldTypes[] ? TFields : RegisteredFieldTypes[]>, Record<string, unknown>, unknown>>;
    /** Runtime form options that override config options when provided. */
    formOptions: _angular_core.InputSignal<FormOptions | undefined>;
    /** Form values for two-way data binding. */
    value: _angular_core.ModelSignal<Partial<TModel> | undefined>;
    private destroyRef;
    private injector;
    protected environmentInjector: EnvironmentInjector;
    private eventBus;
    private logger;
    private dispatcher;
    /** State manager that owns all form state. Initialized via connectDeps() to guarantee
     * FORM_STATE_DEPS is populated before FormStateManager is injected. */
    private readonly stateManager;
    private componentId;
    /** The currently active config used for form rendering */
    activeConfig: Signal<FormConfig<TFields, InferFormValue$1<TFields extends readonly RegisteredFieldTypes[] ? TFields : RegisteredFieldTypes[]>, Record<string, unknown>, unknown> | undefined>;
    /** Current render phase: 'render' = showing form, 'teardown' = hiding old components */
    renderPhase: Signal<"teardown" | "render">;
    /** Computed form mode detection with validation */
    formModeDetection: Signal<_ng_forge_dynamic_forms.FormModeDetectionResult>;
    /** Page field definitions for paged forms */
    pageFieldDefinitions: Signal<_ng_forge_dynamic_forms.PageField<_ng_forge_dynamic_forms.PageAllowedChildren[]>[]>;
    /** Effective form options (merged from config and input) */
    effectiveFormOptions: Signal<{
        disabled?: boolean;
        maxDerivationIterations?: number;
        submitButton?: _ng_forge_dynamic_forms.SubmitButtonOptions;
        nextButton?: _ng_forge_dynamic_forms.NextButtonOptions;
        excludeValueIfHidden?: boolean;
        excludeValueIfDisabled?: boolean;
        excludeValueIfReadonly?: boolean;
        emitFormValueOnEvents?: boolean;
    }>;
    /** Field signal context for injection into child components */
    fieldSignalContext: Signal<_ng_forge_dynamic_forms.FieldSignalContext<TModel>>;
    /** Default values computed from field definitions */
    defaultValues: WritableSignal<TModel>;
    /** The Angular Signal Form instance */
    form: Signal<FieldTree<TModel, string | number>>;
    /** Current form values (reactive) */
    formValue: Signal<TModel | (TModel extends infer T ? T extends TModel ? T extends _angular_forms.AbstractControl<unknown, infer TValue extends unknown, any> ? TValue : never : never : never)>;
    /** Whether the form is currently valid */
    valid: Signal<boolean>;
    /** Whether the form is currently invalid */
    invalid: Signal<boolean>;
    /** Whether any form field has been modified */
    dirty: Signal<boolean>;
    /** Whether any form field has been touched (blurred) */
    touched: Signal<boolean>;
    /** Current validation errors from all fields */
    errors: Signal<_angular_forms_signals.ValidationError.WithFieldTree[]>;
    /** Whether the form is disabled (from options or form state) */
    disabled: Signal<boolean>;
    /** Whether the form is currently submitting */
    submitting: Signal<boolean>;
    /** Collects errors from async field component loading for error boundary patterns */
    fieldLoadingErrors: WritableSignal<FieldLoadingError[]>;
    /** Whether to render the form template */
    shouldRender: Signal<boolean>;
    /** Resolved fields ready for rendering */
    protected resolvedFields: Signal<ResolvedField[]>;
    /**
     * Recursively counts container components that will emit ComponentInitializedEvent.
     * Includes the dynamic-form component itself (+1).
     *
     * Recurses into all container children, including those nested inside array
     * item templates, to avoid a premature (initialized) emission.
     */
    private totalComponentsCount;
    initialized$: rxjs.Observable<boolean>;
    /** Emits when form validity changes. */
    validityChange: _angular_core.OutputRef<boolean>;
    /** Emits when form dirty state changes. */
    dirtyChange: _angular_core.OutputRef<boolean>;
    /**
     * Emits form values when submitted (via SubmitEvent) and form is valid.
     *
     * **Important:** This output only emits when the form is valid. If you need to
     * handle submit events regardless of validity, use the `(events)` output and
     * filter for `'submit'` events.
     *
     * Note: Does not emit when `submission.action` is configured - use one or the other.
     */
    submitted: _angular_core.OutputRef<Partial<TModel>>;
    /** Emits when form is reset to default values. */
    reset: _angular_core.OutputRef<FormResetEvent>;
    /** Emits when form is cleared to empty state. */
    cleared: _angular_core.OutputRef<FormClearEvent>;
    /** Emits all form events for custom event handling. */
    events: _angular_core.OutputRef<_ng_forge_dynamic_forms.FormEvent>;
    /**
     * Emits when all form components are initialized and ready for interaction.
     * Useful for E2E testing to ensure the form is fully rendered before interaction.
     */
    initialized: _angular_core.OutputRef<boolean>;
    /** Emits when the current page changes in paged forms. */
    onPageChange: _angular_core.OutputRef<PageChangeEvent>;
    /** Emits when page navigation state changes (canGoNext, canGoPrevious, etc.). */
    onPageNavigationStateChange: _angular_core.OutputRef<PageNavigationStateChangeEvent>;
    constructor();
    /**
     * Handles native form submission triggered by:
     * - Pressing Enter in an input field
     * - Clicking a button with type="submit"
     * - Programmatic form.submit() calls
     *
     * This method prevents the default form submission behavior (page reload)
     * and dispatches a SubmitEvent through the EventBus for processing.
     *
     * @param event - The native submit event from the form element
     */
    protected onNativeSubmit(event: Event): void;
    private setupEffects;
    /**
     * Populates FORM_STATE_DEPS with this component's input signals, then injects
     * FormStateManager. Must be called as a field initializer (after the input signals
     * are declared) so that FormStateManager reads populated deps when it is constructed.
     * inject() is valid here because field initializers run inside the injection context.
     */
    private connectDeps;
    private setupEventHandlers;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<DynamicForm<any, any>, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<DynamicForm<any, any>, "form[dynamic-form]", never, { "config": { "alias": "dynamic-form"; "required": true; "isSignal": true; }; "formOptions": { "alias": "formOptions"; "required": false; "isSignal": true; }; "value": { "alias": "value"; "required": false; "isSignal": true; }; }, { "value": "valueChange"; "validityChange": "validityChange"; "dirtyChange": "dirtyChange"; "submitted": "submitted"; "reset": "reset"; "cleared": "cleared"; "events": "events"; "initialized": "initialized"; "onPageChange": "onPageChange"; "onPageNavigationStateChange": "onPageNavigationStateChange"; }, never, never, true, never>;
}

declare class EventBus {
    private readonly pipeline$;
    private readonly globalEmitFormValue;
    private readonly rootFormRegistry;
    private readonly formOptions;
    private readonly logger;
    events$: Observable<FormEvent>;
    /**
     * Dispatches a pre-created event instance directly.
     *
     * Use this overload with the `arrayEvent()` factory or any other code that
     * produces a `FormEvent` instance rather than a constructor:
     *
     * ```typescript
     * eventBus.dispatch(arrayEvent('contacts').append(template));
     * eventBus.dispatch(arrayEvent('contacts').pop());
     * ```
     *
     * @param event - A FormEvent instance to dispatch
     */
    dispatch(event: FormEvent): void;
    /**
     * Dispatches an event to all subscribers by instantiating the provided constructor.
     *
     * Creates an instance of the provided event constructor and broadcasts it
     * through the event pipeline to all active subscribers.
     *
     * If `withEventFormValue()` is enabled globally or `options.emitFormValueOnEvents`
     * is set to `true` in the form config, the current form value will be attached
     * to the event's `formValue` property.
     *
     * @param eventConstructor - Constructor function for the event to dispatch
     * @param args - Arguments to pass to the event constructor
     *
     * @example
     * ```typescript
     * // Dispatch a submit event
     * eventBus.dispatch(SubmitEvent);
     *
     * // Dispatch a custom event with args
     * eventBus.dispatch(CustomFormEvent, 'arg1', 42);
     * ```
     */
    dispatch<T extends FormEventConstructor>(eventConstructor: T, ...args: ConstructorParameters<T>): void;
    /**
     * Dispatches a pre-created event instance directly.
     * Used internally by EventDispatcher to forward events into the bus.
     * @internal
     */
    emitInstance(event: FormEvent): void;
    /**
     * Shared emit path for both dispatch() and emitInstance().
     * Attaches form value if configured, then pushes to the pipeline.
     */
    private emit;
    /**
     * Emits an event through the pipeline. Catches any synchronous exception that escapes
     * RxJS's own error handling so dispatch() callers are never disrupted by a failing subscriber.
     */
    private safeEmit;
    /**
     * Determines whether form value should be attached to events.
     *
     * Precedence rules:
     * 1. Per-form setting (if defined) takes precedence
     * 2. Falls back to global setting
     */
    private shouldEmitFormValue;
    /**
     * Subscribes to events of a specific type.
     *
     * @param eventType - The type of event to subscribe to
     * @returns Observable that emits events of the specified type
     */
    on<T extends FormEvent>(eventType: T['type']): Observable<T>;
    /**
     * Subscribes to events of multiple types.
     *
     * @param eventType - Array of event types to subscribe to
     * @returns Observable that emits events matching any of the specified types
     */
    on<T extends FormEvent>(eventType: Array<T['type']>): Observable<T>;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<EventBus, never>;
    static ɵprov: _angular_core.ɵɵInjectableDeclaration<EventBus>;
}

/**
 * Injectable service for dispatching events into a DynamicForm from outside the form.
 *
 * ## When to use
 *
 * Use `EventDispatcher` when you need to drive form behaviour **from the host component** —
 * for example, appending array items in response to a field value change, triggering a form
 * reset from a toolbar button, or reacting to external application state.
 *
 * This is the recommended alternative to accessing the form's internals via `viewChild`.
 *
 * ## Setup
 *
 * Provide `EventDispatcher` at the **host component** level (not root). DynamicForm
 * automatically detects it and connects its internal event bus to the dispatcher.
 *
 * ```typescript
 * @Component({
 *   providers: [EventDispatcher],
 *   template: `<form [dynamic-form]="config" [(value)]="formValue"></form>`
 * })
 * export class MyComponent {
 *   readonly dispatcher = inject(EventDispatcher);
 *   readonly formValue = signal<Record<string, unknown>>({});
 *
 *   constructor() {
 *     effect(() => {
 *       const category = this.formValue()?.['category'] as string | undefined;
 *       if (category) {
 *         this.dispatcher.dispatch(
 *           arrayEvent('tasks').append([{ key: 'name', type: 'input', label: 'Task', value: category }])
 *         );
 *       }
 *     });
 *   }
 * }
 * ```
 *
 * ## Multi-form note
 *
 * If multiple `DynamicForm` instances exist under the same provider scope, **all forms**
 * will receive dispatched events. To target a specific form, scope the provider to a
 * wrapper component that contains only that form.
 *
 * ## What events can be dispatched
 *
 * Any `FormEvent` instance is accepted — array events, reset/clear events, custom events, etc.
 * The `arrayEvent()` builder is the recommended way to construct array manipulation events:
 *
 * ```typescript
 * dispatcher.dispatch(arrayEvent('tasks').append(template));
 * dispatcher.dispatch(arrayEvent('tasks').removeAt(0));
 * dispatcher.dispatch(new FormResetEvent());
 * ```
 */
declare class EventDispatcher {
    private bus;
    /**
     * Dispatches a form event into the connected DynamicForm's event bus.
     * No-op if no form is currently connected.
     *
     * @param event - A FormEvent instance. Use the `arrayEvent()` builder for array operations.
     */
    dispatch(event: FormEvent): void;
    /** @internal - Called by DynamicForm on init */
    connect(bus: EventBus): void;
    /** @internal - Called by DynamicForm on destroy */
    disconnect(): void;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<EventDispatcher, never>;
    static ɵprov: _angular_core.ɵɵInjectableDeclaration<EventDispatcher>;
}

/**
 * Base interface for dynamic form features.
 * Features are configuration options that can be passed to provideDynamicForm
 * alongside field type definitions.
 *
 * Uses Angular-style internal marker (ɵkind) to distinguish from field types.
 */
interface DynamicFormFeature<TKind extends string = string> {
    /** Internal marker to identify this as a feature, not a field type */
    ɵkind: TKind;
    /** Providers to register for this feature */
    ɵproviders: Provider[];
}

interface FieldOption<T = unknown> {
    label: DynamicText;
    value: T;
    disabled?: boolean;
    [key: string]: unknown;
}

/**
 * Injection token for form-level default wrappers.
 *
 * Provides a Signal of the `defaultWrappers` array from FormConfig. Consumed by
 * `DfFieldOutlet` / `ContainerFieldComponent` to merge into each field's
 * effective wrapper chain (lowest priority after auto-associations, higher
 * than field-level `wrappers`).
 *
 * Provided once at the DynamicForm level and inherited via Angular's
 * hierarchical injector.
 */
declare const DEFAULT_WRAPPERS: InjectionToken<Signal<readonly WrapperConfig[] | undefined>>;
/**
 * Injection token for providing field signal context to mappers and components.
 *
 * The field signal context is the "nervous system" of the dynamic form library,
 * providing access to:
 * - The form instance and structure
 * - Current form values (as signals)
 * - Default values
 * - Validation messages
 * - The injector for creating components
 *
 * This token is provided by the DynamicForm component and can be scoped
 * for nested forms (Groups, Arrays) via child injectors.
 *
 * @example
 * ```typescript
 * // In a mapper function
 * export function mapValueField(fieldDef: BaseValueField<any, any>): Binding[] {
 *   const context = inject(FIELD_SIGNAL_CONTEXT);
 *   const form = context.form();
 *   // ... use context
 * }
 *
 * // In a component
 * export class MyFieldComponent {
 *   private context = inject(FIELD_SIGNAL_CONTEXT);
 * }
 * ```
 */
declare const FIELD_SIGNAL_CONTEXT: InjectionToken<FieldSignalContext<Record<string, unknown>>>;
/**
 * Injection token for providing array context metadata to mappers and components.
 *
 * This token is optionally provided by ArrayFieldComponent when creating injectors
 * for array items. It contains metadata about the array item's position and parent.
 *
 * Mappers can inject this token with {optional: true} to access array context:
 *
 * @example
 * ```typescript
 * // In a mapper function
 * export function buttonMapper(fieldDef: FieldDef<any>): Binding[] {
 *   const arrayContext = inject(ARRAY_CONTEXT, { optional: true });
 *   if (arrayContext) {
 *     // Use arrayContext.index, arrayContext.arrayKey, etc.
 *   }
 * }
 * ```
 */
declare const ARRAY_CONTEXT: InjectionToken<ArrayContext>;
/**
 * Injection token for form-level default props.
 *
 * Default props are form-wide property defaults that are merged with field-level props.
 * Field props take precedence over default props.
 *
 * Unlike FIELD_SIGNAL_CONTEXT which is re-provided by container components (Group, Array),
 * DEFAULT_PROPS is provided ONCE at the DynamicForm level and inherited by all children
 * via Angular's hierarchical injector.
 *
 * The token provides a Signal to enable reactivity - when config changes, mappers
 * that read the signal inside their computed() will automatically update.
 *
 * @example
 * ```typescript
 * // In a mapper function
 * const defaultPropsSignal = inject(DEFAULT_PROPS);
 *
 * return computed(() => {
 *   const defaultProps = defaultPropsSignal?.();  // Read inside computed for reactivity
 *   const baseInputs = buildBaseInputs(fieldDef, defaultProps);
 *   // ...
 * });
 * ```
 */
declare const DEFAULT_PROPS: InjectionToken<Signal<Record<string, unknown> | undefined>>;
/**
 * Injection token for form-level default validation messages.
 *
 * Default validation messages act as fallbacks when fields have validation
 * errors but no field-level `validationMessages` defined.
 *
 * Like DEFAULT_PROPS, this token is provided ONCE at the DynamicForm level
 * and inherited by all children via Angular's hierarchical injector.
 *
 * The token provides a Signal to enable reactivity - when config changes, mappers
 * that read the signal inside their computed() will automatically update.
 *
 * @example
 * ```typescript
 * // In a mapper or component
 * const defaultMessagesSignal = inject(DEFAULT_VALIDATION_MESSAGES);
 *
 * return computed(() => {
 *   const defaultMessages = defaultMessagesSignal?.();  // Read inside computed for reactivity
 *   const message = defaultMessages?.required ?? 'Field is required';
 *   // ...
 * });
 * ```
 */
declare const DEFAULT_VALIDATION_MESSAGES: InjectionToken<Signal<ValidationMessages | undefined>>;
/**
 * Injection token for form-level options.
 *
 * Form options control form-wide behavior including button disabled states.
 * Used by button mappers to determine default disabled behavior.
 *
 * Like DEFAULT_PROPS, this token is provided ONCE at the DynamicForm level
 * and inherited by all children via Angular's hierarchical injector.
 *
 * The token provides a Signal to enable reactivity - when config changes, mappers
 * that read the signal inside their computed() will automatically update.
 *
 * @example
 * ```typescript
 * // In a button mapper
 * const formOptionsSignal = inject(FORM_OPTIONS);
 *
 * return computed(() => {
 *   const formOptions = formOptionsSignal?.();  // Read inside computed for reactivity
 *   const disableWhenInvalid = formOptions?.submitButton?.disableWhenInvalid ?? true;
 *   // ...
 * });
 * ```
 */
declare const FORM_OPTIONS: InjectionToken<Signal<FormOptions | undefined>>;

/**
 * Type guard to check if a field is a container field (page, row, group, or array)
 * Container fields have a 'fields' property and don't contribute values directly.
 * This overload works with RegisteredFieldTypes for full type narrowing.
 */
declare function isContainerField(field: RegisteredFieldTypes): field is ContainerFieldTypes;
/**
 * Type guard to check if a field is a container field (page, row, group, or array).
 * This overload works with any FieldDef for looser type checking.
 */
declare function isContainerField(field: FieldDef<unknown>): boolean;
/**
 * Type guard to check if a field is a leaf field (value or display field)
 * Leaf fields don't have children and either contribute values or display content
 */
declare function isLeafField(field: RegisteredFieldTypes): field is LeafFieldTypes;
/**
 * Type guard to check if a field has a value property (value-bearing field)
 * These fields contribute to the form value output
 * Note: Using `unknown` in the Extract condition to match any value type
 */
declare function isValueBearingField(field: RegisteredFieldTypes): field is Extract<RegisteredFieldTypes, {
    value: unknown;
}>;
/**
 * Type guard to check if a field is excluded from form values (display-only field)
 * Currently this includes text fields and any other fields without a value property
 */
declare function isDisplayOnlyField(field: RegisteredFieldTypes): boolean;

/**
 * Helper types for creating type-safe field configurations with proper nesting constraints
 */

/**
 * Type helper for accessing nested field paths safely
 * This allows accessing child paths while maintaining some type safety
 */
type FieldPathAccess<TValue> = {
    [K in keyof TValue]: SchemaPath<TValue[K]> | SchemaPathTree<TValue[K]>;
};

/**
 * User-facing wrapper registration shape used with `createWrappers(...)`.
 *
 * Extends `WrapperTypeDefinition` with an optional `props` field that
 * carries the wrapper's config type (via `wrapperProps`) for later
 * inference by `InferWrapperRegistry`.
 */
interface WrapperRegistration<TName extends string = string, TConfig = unknown> {
    /** Unique identifier for the wrapper type */
    readonly wrapperName: TName;
    /** Lazy-loader for the wrapper component */
    readonly loadComponent: LazyComponentLoader;
    /** Field types this wrapper auto-applies to (merged lowest-priority during wrapper resolution) */
    readonly types?: readonly string[];
    /**
     * Type carrier only — runtime value is always `undefined`.
     * Use `wrapperProps<YourConfig>()` to thread the config type.
     */
    readonly props?: TConfig;
}
/**
 * Branded bundle returned by `createWrappers(...)`.
 *
 * Carries:
 * - `ɵkind: 'wrappers'` — discriminant recognised by `provideDynamicForm(...)`
 * - `ɵregistrations` — the original registrations (type-level use for `InferWrapperRegistry`)
 * - `ɵdefinitions` — the `WrapperTypeDefinition[]` extracted for `WRAPPER_REGISTRY`
 */
interface WrappersBundle<T extends readonly WrapperRegistration[] = readonly WrapperRegistration[]> {
    readonly ɵkind: 'wrappers';
    readonly ɵregistrations: T;
    readonly ɵdefinitions: readonly WrapperTypeDefinition[];
}
/**
 * Bundle wrapper registrations into a single object that can be passed to
 * `provideDynamicForm(...)`.
 *
 * @example
 * ```typescript
 * const appWrappers = createWrappers(
 *   {
 *     wrapperName: 'section',
 *     loadComponent: () => import('./section-wrapper'),
 *     props: wrapperProps<SectionWrapper>(),
 *   },
 *   {
 *     wrapperName: 'highlight',
 *     loadComponent: () => import('./highlight-wrapper'),
 *     types: ['input', 'select'],
 *     props: wrapperProps<HighlightWrapper>(),
 *   },
 * );
 *
 * declare module '@ng-forge/dynamic-forms' {
 *   interface FieldRegistryWrappers extends InferWrapperRegistry<typeof appWrappers> {}
 * }
 *
 * bootstrapApplication(AppComponent, {
 *   providers: [provideDynamicForm(appWrappers)],
 * });
 * ```
 */
declare function createWrappers<const T extends readonly WrapperRegistration[]>(...registrations: T): WrappersBundle<T>;
/** Type guard for a `WrappersBundle`. */
declare function isWrappersBundle(value: unknown): value is WrappersBundle;
/**
 * Derive the `FieldRegistryWrappers` augmentation shape from a wrapper bundle.
 *
 * Maps each registration's `wrapperName` to its `props` type (the config carried
 * by `wrapperProps<T>()`). If a registration has no `props`, falls back to the
 * minimal discriminant shape `{ readonly type: wrapperName }`.
 *
 * @example
 * ```typescript
 * declare module '@ng-forge/dynamic-forms' {
 *   interface FieldRegistryWrappers extends InferWrapperRegistry<typeof appWrappers> {}
 * }
 * ```
 */
type InferWrapperRegistry<T> = T extends WrappersBundle<infer R> ? {
    [Reg in R[number] as Reg['wrapperName']]: Reg extends {
        props: infer P;
    } ? Exclude<P, undefined> : {
        readonly type: Reg['wrapperName'];
    };
} : never;

/**
 * Extract FieldDef type from FieldTypeDefinition
 */
type ExtractFieldDef<T> = T extends FieldTypeDefinition<infer F> ? F : never;
/**
 * Union of all FieldDef types from provided field types
 */
type FieldDefUnion<T extends FieldTypeDefinition[]> = ExtractFieldDef<T[number]>;
/**
 * Infer form value type from field definitions using the real inference type.
 */
type InferFormValue<TFieldDefs extends FieldDef<unknown>[]> = InferFormValue$1<TFieldDefs>;
/**
 * Provider result with type inference
 */
type ProvideDynamicFormResult<T extends FieldTypeDefinition[]> = EnvironmentProviders & {
    __fieldDefs?: FieldDefUnion<T>;
    __formValue?: InferFormValue<FieldDefUnion<T>[]>;
};
/**
 * Union type for items that can be passed to provideDynamicForm
 */
type FieldTypeOrFeature = FieldTypeDefinition | WrapperTypeDefinition | WrappersBundle | DynamicFormFeature;
/**
 * Extract only FieldTypeDefinition items from a tuple type
 */
type ExtractFieldTypes<T extends FieldTypeOrFeature[]> = {
    [K in keyof T]: T[K] extends FieldTypeDefinition ? T[K] : never;
}[number] extends infer U ? U extends FieldTypeDefinition ? U[] : never : never;
/**
 * Provider function to configure the dynamic form system with field types and options.
 *
 * This function creates environment providers that can be used at application or route level
 * to register field types. It provides type-safe field registration with automatic type inference.
 *
 * @param items - Field type definitions and/or features (like withLoggerConfig)
 * @returns Environment providers for dependency injection with type inference
 *
 * @example
 * ```typescript
 * // Application-level setup
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideDynamicForm(...withMaterialFields())
 *   ]
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Disable logging
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideDynamicForm(
 *       ...withMaterialFields(),
 *       withLoggerConfig(false)
 *     )
 *   ]
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Custom field types with type inference
 * import { CustomFieldType, AnotherFieldType } from './custom-fields';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideDynamicForm(CustomFieldType, AnotherFieldType)
 *   ]
 * };
 * ```
 *
 * @typeParam T - Array of field type definitions for type inference
 *
 * @public
 */
declare function provideDynamicForm<const T extends FieldTypeOrFeature[]>(...items: T): ProvideDynamicFormResult<ExtractFieldTypes<T> extends FieldTypeDefinition[] ? ExtractFieldTypes<T> : FieldTypeDefinition[]>;
/**
 * Extract FieldDef types from provider result
 */
type ExtractFieldDefs<T> = T extends {
    __fieldDefs?: infer F;
} ? F : never;
/**
 * Extract form value type from provider result
 */
type ExtractFormValue<T> = T extends {
    __formValue?: infer V;
} ? V : never;

/**
 * Built-in field types provided by the dynamic form library.
 *
 * Each field type is validated at compile time using satisfies, ensuring
 * type safety of the mapper function while allowing the array to be typed
 * as FieldTypeDefinition[] for consumer flexibility.
 */
declare const BUILT_IN_FIELDS: FieldTypeDefinition[];

/**
 * Configuration options for the logger feature.
 *
 * @public
 */
interface LoggerConfigOptions {
    /**
     * Whether general logging is enabled.
     *
     * @default true
     */
    enabled?: boolean;
    /**
     * Derivation logging level.
     *
     * - `'none'`: No derivation debug logging (default)
     * - `'summary'`: Log cycle completion with counts
     * - `'verbose'`: Log individual derivation evaluations with details
     *
     * @default 'none'
     */
    derivations?: DerivationLogLevel;
}
/**
 * Configure logging for dynamic forms.
 *
 * By default, general logging is enabled (ConsoleLogger) and derivation
 * logging is disabled ('none'). Use this feature to enable derivation debugging.
 *
 * @example
 * ```typescript
 * // Disable all logging
 * provideDynamicForm(
 *   ...withMaterialFields(),
 *   withLoggerConfig(false)
 * )
 *
 * // Enable verbose derivation logging
 * provideDynamicForm(
 *   ...withMaterialFields(),
 *   withLoggerConfig({ derivations: 'verbose' })
 * )
 *
 * // Disable derivation logging but keep general logging
 * provideDynamicForm(
 *   ...withMaterialFields(),
 *   withLoggerConfig({ derivations: 'none' })
 * )
 *
 * // Conditional logging (e.g., only in dev mode)
 * provideDynamicForm(
 *   ...withMaterialFields(),
 *   withLoggerConfig(() => isDevMode())
 * )
 * ```
 *
 * @param config - Boolean to enable/disable logging, a function returning boolean, or a config object
 * @returns A DynamicFormFeature that configures logging
 *
 * @public
 */
declare function withLoggerConfig(config?: boolean | (() => boolean) | LoggerConfigOptions): DynamicFormFeature<'logger'>;

/**
 * Injection token for the dynamic forms logger.
 *
 * Provided by provideDynamicForm() with ConsoleLogger as default.
 * Override with withLoggerConfig(false) to disable logging.
 */
declare const DynamicFormLogger: InjectionToken<Logger>;

/**
 * Console-based logger implementation.
 */
declare class ConsoleLogger implements Logger {
    private readonly prefix;
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

/**
 * No-operation logger implementation.
 * All methods are no-ops - used in production by default.
 */
declare class NoopLogger implements Logger {
    debug(): void;
    info(): void;
    warn(): void;
    error(): void;
}

/**
 * Enables automatic form value attachment to all events dispatched through the EventBus.
 *
 * When this feature is enabled, events dispatched via `eventBus.dispatch()` will include
 * the current form value in the `formValue` property. This is useful for event handlers
 * that need access to the complete form state at the time of the event.
 *
 * @example Global opt-in
 * ```typescript
 * provideDynamicForm(
 *   ...withMaterialFields(),
 *   withEventFormValue()
 * )
 * ```
 *
 * @example Consumer usage
 * ```typescript
 * eventBus.on<SubmitEvent>('submit').subscribe(event => {
 *   if (hasFormValue(event)) {
 *     console.log('Form value:', event.formValue);
 *   }
 * });
 * ```
 *
 * @example Per-form disable (when globally enabled)
 * ```typescript
 * const config: FormConfig = {
 *   fields: [...],
 *   options: { emitFormValueOnEvents: false }
 * };
 * ```
 *
 * @remarks
 * **Precedence rules:**
 * 1. Per-form `false` - Disables for this form, regardless of global setting
 * 2. Per-form `true` - Enables for this form, regardless of global setting
 * 3. Per-form `undefined` - Uses global setting
 * 4. Global `withEventFormValue()` - Enables globally
 * 5. No global feature - Disabled globally (default)
 *
 * @returns A DynamicFormFeature that enables form value attachment to events
 *
 * @public
 */
declare function withEventFormValue(): DynamicFormFeature<'event-form-value'>;

/**
 * Configuration for excluding field values from form submission output
 * based on their reactive state (hidden, disabled, readonly).
 *
 * Supports a 3-tier configuration hierarchy: Field > Form > Global.
 * The most specific level wins for each property.
 *
 * @public
 */
interface ValueExclusionConfig {
    /**
     * Whether to exclude the value of hidden fields from submission output.
     *
     * When `true`, fields whose `hidden()` state is `true` will have their
     * values omitted from the submitted form value.
     *
     * @remarks
     * This does NOT affect HiddenField (`type: 'hidden'`) — those fields
     * store values without UI and their `hidden()` state is always `false`.
     */
    readonly excludeValueIfHidden?: boolean;
    /**
     * Whether to exclude the value of disabled fields from submission output.
     *
     * When `true`, fields whose `disabled()` state is `true` will have their
     * values omitted from the submitted form value.
     */
    readonly excludeValueIfDisabled?: boolean;
    /**
     * Whether to exclude the value of readonly fields from submission output.
     *
     * When `true`, fields whose `readonly()` state is `true` will have their
     * values omitted from the submitted form value.
     */
    readonly excludeValueIfReadonly?: boolean;
}
/**
 * Fully resolved exclusion config with all properties required.
 * Produced by the 3-tier resolution: `field ?? form ?? global`.
 *
 * @public
 */
type ResolvedValueExclusionConfig = Required<ValueExclusionConfig>;

/**
 * Configures global value exclusion defaults for form submission output.
 *
 * Value exclusion is **enabled by default** — field values are excluded from the
 * `(submitted)` output based on their reactive state. Use this feature to
 * override those defaults. This does NOT affect two-way binding (`value` model /
 * `entity`) — fields retain their values internally.
 *
 * @example Default behavior (all exclusions enabled)
 * ```typescript
 * provideDynamicForm(
 *   ...withMaterialFields(),
 *   withValueExclusionDefaults()
 * )
 * ```
 *
 * @example Disable specific exclusions
 * ```typescript
 * provideDynamicForm(
 *   ...withMaterialFields(),
 *   withValueExclusionDefaults({ excludeValueIfReadonly: false })
 * )
 * ```
 *
 * @example Disable all exclusions (restore pre-v1 behavior)
 * ```typescript
 * provideDynamicForm(
 *   ...withMaterialFields(),
 *   withValueExclusionDefaults({
 *     excludeValueIfHidden: false,
 *     excludeValueIfDisabled: false,
 *     excludeValueIfReadonly: false,
 *   })
 * )
 * ```
 *
 * @remarks
 * **Precedence rules:**
 * 1. Per-field `excludeValueIf*` on `FieldDef` — wins for that field
 * 2. Per-form `excludeValueIf*` on `FormOptions` — wins for all fields in that form
 * 3. Global `withValueExclusionDefaults()` — baseline default
 * 4. No global feature — uses token default (all enabled)
 *
 * @param config - Partial override of exclusion rules. Unspecified properties default to `true`.
 * @returns A DynamicFormFeature that configures value exclusion defaults
 *
 * @public
 */
declare function withValueExclusionDefaults(config?: Partial<ValueExclusionConfig>): DynamicFormFeature<'value-exclusion'>;

/**
 * Zero-cost type carrier used in wrapper registrations.
 *
 * Returns `undefined` at runtime but is typed as `T`, so TypeScript can
 * thread a wrapper's config type through `createWrappers(...)` into the
 * `InferWrapperRegistry<typeof ...>` utility without requiring users to
 * hand-write the augmentation shape.
 *
 * @example
 * ```typescript
 * const wrappers = createWrappers(
 *   {
 *     wrapperName: 'section',
 *     loadComponent: () => import('./section-wrapper'),
 *     props: wrapperProps<SectionWrapper>(),
 *   },
 * );
 *
 * declare module '@ng-forge/dynamic-forms' {
 *   interface FieldRegistryWrappers extends InferWrapperRegistry<typeof wrappers> {}
 * }
 * ```
 */
declare function wrapperProps<T>(): T;

interface FieldWithValidation {
    readonly required?: boolean;
    readonly email?: boolean;
    readonly min?: number;
    readonly max?: number;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly pattern?: string | RegExp;
    readonly validators?: ValidatorConfig[];
    readonly validationMessages?: ValidationMessages;
    readonly logic?: LogicConfig[];
    /**
     * Shorthand for simple computed/derived fields.
     *
     * The expression is evaluated whenever its dependencies change,
     * and the result is set as this field's value.
     *
     * Has access to `formValue` object containing all form values.
     * Uses the same secure AST-based parser as other expressions.
     *
     * For conditional derivations or derivations targeting other fields,
     * use the full `logic` array with `{ type: 'derivation', ... }`.
     *
     * @example
     * ```typescript
     * // Compute total from quantity and price
     * {
     *   key: 'total',
     *   type: 'number',
     *   derivation: 'formValue.quantity * formValue.unitPrice'
     * }
     *
     * // Concatenate names
     * {
     *   key: 'fullName',
     *   type: 'input',
     *   derivation: 'formValue.firstName + " " + formValue.lastName'
     * }
     *
     * // Calculate discounted price
     * {
     *   key: 'discountedPrice',
     *   type: 'number',
     *   derivation: 'formValue.price * (1 - formValue.discountPercent / 100)'
     * }
     * ```
     */
    readonly derivation?: string;
    readonly schemas?: SchemaApplicationConfig[];
}

/**
 * Supported primitive value types for form fields.
 * This type represents all possible value types that can be used in form fields.
 */
type ValueType = string | number | boolean | Date | object | unknown[];
interface BaseValueField<TProps, TValue, TMeta extends FieldMeta = FieldMeta, TNullable extends boolean = false> extends FieldDef<TProps, TMeta>, FieldWithValidation {
    value?: TNullable extends true ? TValue | null : TValue;
    /**
     * Placeholder text displayed when the field is empty.
     * Supports static strings, Observables, and Signals for dynamic content.
     *
     * Note: placeholder lives at the field level, NOT inside `props`. The integration-layer
     * `props` interfaces (InputProps, TextareaProps, SelectProps, DatepickerProps) intentionally
     * omit `placeholder` — TypeScript's excess property check rejects `props: { placeholder: ... }`
     * for any `props` literal typed against those interfaces.
     */
    placeholder?: DynamicText;
    required?: boolean;
    /**
     * Whether the field accepts `null` as a valid value.
     *
     * When `true`, `value` may be `null` and an omitted `value` resolves to `null`
     * (rather than the type-specific empty default). Orthogonal to `required`.
     *
     * Read-side caveat: a user clearing a text input reads back as `""`, not `null`
     * — this matches classic Reactive Forms and is enforced by the Web IDL contract.
     * `nullable` is a contract for accepted values, not a guarantee of emitted ones.
     *
     * @default false
     */
    nullable?: TNullable;
}
declare function isValueField<TProps, TMeta extends FieldMeta = FieldMeta>(field: FieldDef<TProps, TMeta>): field is BaseValueField<TProps, ValueType, TMeta, boolean>;
type ExcludedKeys$1 = 'type' | 'conditionals' | 'value' | 'valueType' | 'nullable' | 'disabled' | 'readonly' | 'hidden' | 'col' | 'minValue' | 'maxValue' | 'step' | 'required' | 'email' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'validators' | 'logic' | 'derivation' | 'schemas' | 'excludeValueIfHidden' | 'excludeValueIfDisabled' | 'excludeValueIfReadonly' | 'wrappers' | 'skipAutoWrappers' | 'skipDefaultWrappers';
type ValueFieldComponent<T extends BaseValueField<Record<string, unknown> | unknown, unknown, FieldMeta, boolean>> = Prettify<WithInputSignals<Omit<T, ExcludedKeys$1>>>;

interface BaseCheckedField<TProps, TMeta extends FieldMeta = FieldMeta> extends FieldDef<TProps, TMeta>, FieldWithValidation {
    value?: boolean;
    /**
     * Placeholder text displayed when the field is empty.
     * Supports static strings, Observables, and Signals for dynamic content.
     */
    placeholder?: DynamicText;
    required?: boolean;
}
declare function isCheckedField<TProps, TMeta extends FieldMeta = FieldMeta>(field: FieldDef<TProps, TMeta>): field is BaseCheckedField<TProps, TMeta>;
type ExcludedKeys = 'type' | 'conditionals' | 'value' | 'disabled' | 'readonly' | 'hidden' | 'col' | keyof FieldWithValidation | 'excludeValueIfHidden' | 'excludeValueIfDisabled' | 'excludeValueIfReadonly' | 'wrappers' | 'skipAutoWrappers' | 'skipDefaultWrappers';
type CheckedFieldComponent<T extends BaseCheckedField<Record<string, unknown> | unknown>> = Prettify<WithInputSignals<Omit<T, ExcludedKeys>>>;

declare function applyValidator(config: ValidatorConfig, fieldPath: SchemaPath<any> | SchemaPathTree<any>): void;
declare function applyValidators(configs: ValidatorConfig[], fieldPath: SchemaPath<any> | SchemaPathTree<any>): void;

declare class SubmitEvent implements FormEvent {
    readonly type: "submit";
}

declare class NextPageEvent implements FormEvent {
    readonly type: "next-page";
}

declare class PreviousPageEvent implements FormEvent {
    readonly type: "previous-page";
}

/**
 * Template type for array items used in events.
 * Canonical definition lives in {@link ArrayItemDefinition} — this alias
 * preserves the events-specific naming convention.
 */
type ArrayItemDefinitionTemplate = ArrayItemDefinition;

/**
 * Event dispatched to append a new item at the END of an array field.
 *
 * This is the most common array operation - adding items to the end.
 * For other positions, use {@link PrependArrayItemEvent} or {@link InsertArrayItemEvent}.
 *
 * @example
 * ```typescript
 * // Object item: append { name, email } object
 * eventBus.dispatch(arrayEvent('contacts').append([
 *   { key: 'name', type: 'input', label: 'Name' },
 *   { key: 'email', type: 'input', label: 'Email' }
 * ]));
 *
 * // Primitive item: append single value
 * eventBus.dispatch(arrayEvent('tags').append(
 *   { key: 'tag', type: 'input', label: 'Tag' }
 * ));
 * ```
 *
 * @typeParam TTemplate - The type of the template (single field or array of fields)
 */
declare class AppendArrayItemEvent<TTemplate extends ArrayItemDefinitionTemplate = ArrayItemDefinitionTemplate> implements FormEvent {
    /** The key of the array field to append an item to */
    readonly arrayKey: string;
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (FieldDef): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (FieldDef[]): Creates an object item (fields merged into object)
     */
    readonly template: TTemplate;
    readonly type: "append-array-item";
    constructor(
    /** The key of the array field to append an item to */
    arrayKey: string, 
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (FieldDef): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (FieldDef[]): Creates an object item (fields merged into object)
     */
    template: TTemplate);
}

/**
 * Event dispatched to prepend a new item at the BEGINNING of an array field.
 *
 * Use this when new items should appear at the start of the list.
 * For appending to the end, use {@link AppendArrayItemEvent}.
 *
 * @example
 * ```typescript
 * // Object item: prepend { name } object
 * eventBus.dispatch(arrayEvent('contacts').prepend([
 *   { key: 'name', type: 'input', label: 'Name' }
 * ]));
 *
 * // Primitive item: prepend single value
 * eventBus.dispatch(arrayEvent('tags').prepend(
 *   { key: 'tag', type: 'input', label: 'Tag' }
 * ));
 * ```
 *
 * @typeParam TTemplate - The type of the template (single field or array of fields)
 */
declare class PrependArrayItemEvent<TTemplate extends ArrayItemDefinitionTemplate = ArrayItemDefinitionTemplate> implements FormEvent {
    /** The key of the array field to prepend an item to */
    readonly arrayKey: string;
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (FieldDef): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (FieldDef[]): Creates an object item (fields merged into object)
     */
    readonly template: TTemplate;
    readonly type: "prepend-array-item";
    constructor(
    /** The key of the array field to prepend an item to */
    arrayKey: string, 
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (FieldDef): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (FieldDef[]): Creates an object item (fields merged into object)
     */
    template: TTemplate);
}

/**
 * Event dispatched to insert a new item at a SPECIFIC INDEX in an array field.
 *
 * Use this when you need precise control over where the new item appears.
 * For simpler operations, use {@link AppendArrayItemEvent} or {@link PrependArrayItemEvent}.
 *
 * @example
 * ```typescript
 * // Object item: insert { name } object at index 2
 * eventBus.dispatch(arrayEvent('contacts').insertAt(2, [
 *   { key: 'name', type: 'input', label: 'Name' }
 * ]));
 *
 * // Primitive item: insert single value at index 2
 * eventBus.dispatch(arrayEvent('tags').insertAt(2,
 *   { key: 'tag', type: 'input', label: 'Tag' }
 * ));
 * ```
 *
 * @typeParam TTemplate - The type of the template (single field or array of fields)
 */
declare class InsertArrayItemEvent<TTemplate extends ArrayItemDefinitionTemplate = ArrayItemDefinitionTemplate> implements FormEvent {
    /** The key of the array field to insert an item into */
    readonly arrayKey: string;
    /** The index at which to insert the new item */
    readonly index: number;
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (FieldDef): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (FieldDef[]): Creates an object item (fields merged into object)
     */
    readonly template: TTemplate;
    readonly type: "insert-array-item";
    constructor(
    /** The key of the array field to insert an item into */
    arrayKey: string, 
    /** The index at which to insert the new item */
    index: number, 
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (FieldDef): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (FieldDef[]): Creates an object item (fields merged into object)
     */
    template: TTemplate);
}

/**
 * Event dispatched to remove the LAST item from an array field.
 *
 * Equivalent to JavaScript's `Array.pop()` - removes from the end.
 * For removing from the beginning, use {@link ShiftArrayItemEvent}.
 * For removing at a specific index, use {@link RemoveAtIndexEvent}.
 *
 * @example
 * ```typescript
 * // Use the builder API (recommended)
 * eventBus.dispatch(arrayEvent('contacts').pop());
 *
 * // Or instantiate directly
 * eventBus.dispatch(new PopArrayItemEvent('contacts'));
 * ```
 */
declare class PopArrayItemEvent implements FormEvent {
    /** The key of the array field to remove the last item from */
    readonly arrayKey: string;
    readonly type: "pop-array-item";
    constructor(
    /** The key of the array field to remove the last item from */
    arrayKey: string);
}

/**
 * Event dispatched to remove the FIRST item from an array field.
 *
 * Equivalent to JavaScript's `Array.shift()` - removes from the beginning.
 * For removing from the end, use {@link PopArrayItemEvent}.
 * For removing at a specific index, use {@link RemoveAtIndexEvent}.
 *
 * @example
 * ```typescript
 * // Use the builder API (recommended)
 * eventBus.dispatch(arrayEvent('contacts').shift());
 *
 * // Or instantiate directly
 * eventBus.dispatch(new ShiftArrayItemEvent('contacts'));
 * ```
 */
declare class ShiftArrayItemEvent implements FormEvent {
    /** The key of the array field to remove the first item from */
    readonly arrayKey: string;
    readonly type: "shift-array-item";
    constructor(
    /** The key of the array field to remove the first item from */
    arrayKey: string);
}

/**
 * Event dispatched to move an existing item from one index to another within an array field.
 *
 * This is an atomic reorder operation — the item at `fromIndex` is removed and
 * reinserted at `toIndex`. No template is required because the existing item
 * (resolved component, form value, and stored template) is preserved.
 *
 * @example
 * ```typescript
 * // Use the builder API (recommended)
 * eventBus.dispatch(arrayEvent('contacts').move(0, 2));
 *
 * // Or instantiate directly
 * eventBus.dispatch(new MoveArrayItemEvent('contacts', 0, 2));
 * ```
 */
declare class MoveArrayItemEvent implements FormEvent {
    /** The key of the array field containing the item to move */
    readonly arrayKey: string;
    /** The current index of the item to move */
    readonly fromIndex: number;
    /** The target index to move the item to */
    readonly toIndex: number;
    readonly type: "move-array-item";
    constructor(
    /** The key of the array field containing the item to move */
    arrayKey: string, 
    /** The current index of the item to move */
    fromIndex: number, 
    /** The target index to move the item to */
    toIndex: number);
}

/**
 * Event dispatched to remove an item at a SPECIFIC INDEX from an array field.
 *
 * Use this when you need precise control over which item to remove.
 * For simpler operations, use {@link PopArrayItemEvent} or {@link ShiftArrayItemEvent}.
 *
 * @example
 * ```typescript
 * // Use the builder API (recommended)
 * eventBus.dispatch(arrayEvent('contacts').removeAt(2));
 *
 * // Or instantiate directly
 * eventBus.dispatch(new RemoveAtIndexEvent('contacts', 2));
 * ```
 */
declare class RemoveAtIndexEvent implements FormEvent {
    /** The key of the array field to remove an item from */
    readonly arrayKey: string;
    /** The index of the item to remove */
    readonly index: number;
    readonly type: "remove-at-index";
    constructor(
    /** The key of the array field to remove an item from */
    arrayKey: string, 
    /** The index of the item to remove */
    index: number);
}

/**
 * Builder for array manipulation events.
 *
 * Provides a fluent, discoverable API for array operations.
 * Type `arrayEvent('key').` in your IDE to see all available operations.
 *
 * **BREAKING CHANGE**: Template is now required for add operations.
 *
 * Supports both primitive and object array items:
 * - Primitive: Pass a single field definition → extracts field value directly
 * - Object: Pass an array of field definitions → merges fields into object
 *
 * @example
 * ```typescript
 * import { arrayEvent } from '@ng-forge/dynamic-forms';
 *
 * // Object item: append { name, email } object
 * eventBus.dispatch(arrayEvent('contacts').append([
 *   { key: 'name', type: 'input', label: 'Name' },
 *   { key: 'email', type: 'input', label: 'Email' }
 * ]));
 *
 * // Primitive item: append single value
 * eventBus.dispatch(arrayEvent('tags').append(
 *   { key: 'tag', type: 'input', label: 'Tag' }
 * ));
 *
 * // Removing items (no template needed)
 * eventBus.dispatch(arrayEvent('contacts').pop());      // Remove last
 * eventBus.dispatch(arrayEvent('contacts').shift());    // Remove first
 * eventBus.dispatch(arrayEvent('contacts').removeAt(2)); // Remove at index
 *
 * // Reordering items (no template needed, preserves item identity)
 * eventBus.dispatch(arrayEvent('contacts').move(0, 2)); // Move first to third
 * ```
 *
 * @param arrayKey - The key of the array field to operate on
 * @returns An object with methods for all 7 array operations
 */
declare function arrayEvent(arrayKey: string): {
    /**
     * Append a new item at the END of the array.
     * This is the most common operation for adding items.
     *
     * @param template - Template for the new item (REQUIRED)
     *   - Single field: Creates a primitive item (field's value is extracted directly)
     *   - Array of fields: Creates an object item (fields merged into object)
     * @returns An AppendArrayItemEvent to dispatch
     *
     * @example
     * ```typescript
     * // Object item
     * eventBus.dispatch(arrayEvent('contacts').append([
     *   { key: 'name', type: 'input', label: 'Name' }
     * ]));
     *
     * // Primitive item
     * eventBus.dispatch(arrayEvent('tags').append(
     *   { key: 'tag', type: 'input', label: 'Tag' }
     * ));
     * ```
     */
    append: <T extends ArrayItemDefinitionTemplate>(template: T) => AppendArrayItemEvent<T>;
    /**
     * Prepend a new item at the BEGINNING of the array.
     * Use when new items should appear at the start.
     *
     * @param template - Template for the new item (REQUIRED)
     *   - Single field: Creates a primitive item (field's value is extracted directly)
     *   - Array of fields: Creates an object item (fields merged into object)
     * @returns A PrependArrayItemEvent to dispatch
     *
     * @example
     * ```typescript
     * // Object item
     * eventBus.dispatch(arrayEvent('contacts').prepend([
     *   { key: 'name', type: 'input', label: 'Name' }
     * ]));
     *
     * // Primitive item
     * eventBus.dispatch(arrayEvent('tags').prepend(
     *   { key: 'tag', type: 'input', label: 'Tag' }
     * ));
     * ```
     */
    prepend: <T extends ArrayItemDefinitionTemplate>(template: T) => PrependArrayItemEvent<T>;
    /**
     * Insert a new item at a SPECIFIC INDEX in the array.
     * Use when you need precise control over item placement.
     *
     * @param index - The position at which to insert the new item
     * @param template - Template for the new item (REQUIRED)
     *   - Single field: Creates a primitive item (field's value is extracted directly)
     *   - Array of fields: Creates an object item (fields merged into object)
     * @returns An InsertArrayItemEvent to dispatch
     *
     * @example
     * ```typescript
     * // Object item at index 2
     * eventBus.dispatch(arrayEvent('contacts').insertAt(2, [
     *   { key: 'name', type: 'input', label: 'Name' }
     * ]));
     *
     * // Primitive item at index 2
     * eventBus.dispatch(arrayEvent('tags').insertAt(2,
     *   { key: 'tag', type: 'input', label: 'Tag' }
     * ));
     * ```
     */
    insertAt: <T extends ArrayItemDefinitionTemplate>(index: number, template: T) => InsertArrayItemEvent<T>;
    /**
     * Remove the LAST item from the array.
     * Equivalent to JavaScript's `Array.pop()`.
     *
     * @returns A PopArrayItemEvent to dispatch
     *
     * @example
     * ```typescript
     * eventBus.dispatch(arrayEvent('contacts').pop());
     * ```
     */
    pop: () => PopArrayItemEvent;
    /**
     * Remove the FIRST item from the array.
     * Equivalent to JavaScript's `Array.shift()`.
     *
     * @returns A ShiftArrayItemEvent to dispatch
     *
     * @example
     * ```typescript
     * eventBus.dispatch(arrayEvent('contacts').shift());
     * ```
     */
    shift: () => ShiftArrayItemEvent;
    /**
     * Remove an item at a SPECIFIC INDEX from the array.
     * Use when you need to remove a specific item by position.
     *
     * @param index - The position of the item to remove
     * @returns A RemoveAtIndexEvent to dispatch
     *
     * @example
     * ```typescript
     * eventBus.dispatch(arrayEvent('contacts').removeAt(2));
     * ```
     */
    removeAt: (index: number) => RemoveAtIndexEvent;
    /**
     * Move an existing item from one position to another within the array.
     * This is an atomic reorder — the item is NOT destroyed and recreated.
     * The resolved component, form value, and stored template are preserved.
     *
     * @param from - The current index of the item to move
     * @param to - The target index to move the item to
     * @returns A MoveArrayItemEvent to dispatch
     *
     * @example
     * ```typescript
     * // Move item from index 0 to index 2
     * eventBus.dispatch(arrayEvent('contacts').move(0, 2));
     * ```
     */
    move: (from: number, to: number) => MoveArrayItemEvent;
};

/**
 * Context for token resolution in event args
 */
interface TokenContext {
    /** Current field key */
    key?: string;
    /** Array index if field is inside an array */
    index?: number;
    /** Parent array field key if field is inside an array */
    arrayKey?: string;
    /** Current form value for complex indexing */
    formValue?: unknown;
    /** Template for array item creation */
    template?: unknown;
}
/**
 * Resolves special tokens in event arguments to their actual values
 *
 * Supported tokens:
 * - $key: The current field key
 * - $index: The array index (if inside an array field)
 * - $arrayKey: The parent array field key (if inside an array field)
 * - $template: The template for array item creation
 * - formValue: Reference to the current form value for indexing
 *
 * @param args - Array of arguments that may contain tokens
 * @param context - Context object containing token values
 * @returns Array with resolved values
 *
 * @example
 * resolveTokens(['$arrayKey', '$index'], { arrayKey: 'contacts', index: 2 })
 * // Returns: ['contacts', 2]
 *
 * @example
 * resolveTokens(['$key', 'static'], { key: 'myField' })
 * // Returns: ['myField', 'static']
 *
 * @example
 * resolveTokens(['$arrayKey', '$template'], { arrayKey: 'contacts', template: [{ key: 'name', type: 'input' }] })
 * // Returns: ['contacts', [{ key: 'name', type: 'input' }]]
 */
declare function resolveTokens(args: readonly (string | number | boolean | null | undefined)[], context: TokenContext): (string | number | boolean | null | undefined | unknown)[];

/**
 * Context object for array item operations (add/remove)
 * Provides the necessary information to resolve tokens in array item event arguments
 */
interface ArrayItemContext {
    /** The key of the field */
    key: string;
    /** Array index for the item */
    index?: number;
    /** Parent array field key */
    arrayKey?: string;
    /** Form value for token resolution */
    formValue?: unknown;
}

/**
 * Type-safe form config builder that ensures schema matches field structure.
 *
 * This helper function provides type safety when using form-level schemas by
 * automatically inferring the form value type from fields and constraining
 * the schema type parameter accordingly.
 *
 * **When to use:**
 * - When you have a form-level `schema` and want type safety between fields and schema
 * - When you prefer function syntax over `as const satisfies FormConfig`
 *
 * **Note:** This is optional. Users who don't need schema type safety can
 * continue using `as const satisfies FormConfig` directly.
 *
 * @typeParam TFields - The field definitions array (narrowed via `as const`)
 * @typeParam TProps - Optional form-level default props type
 *
 * @param config - The form configuration object
 * @returns The same configuration with proper type inference
 *
 * @example Basic usage with Zod schema
 * ```typescript
 * import { z } from 'zod';
 * import { formConfig } from '@ng-forge/dynamic-forms';
 * import { standardSchema } from '@ng-forge/dynamic-forms/schema';
 *
 * const passwordSchema = z.object({
 *   password: z.string().min(8),
 *   confirmPassword: z.string(),
 * }).refine(
 *   (data) => data.password === data.confirmPassword,
 *   { message: 'Passwords must match', path: ['confirmPassword'] }
 * );
 *
 * const config = formConfig({
 *   schema: standardSchema(passwordSchema),
 *   fields: [
 *     { key: 'password', type: 'input', label: 'Password', required: true, props: { type: 'password' } },
 *     { key: 'confirmPassword', type: 'input', label: 'Confirm', required: true, props: { type: 'password' } },
 *     { key: 'submit', type: 'submit', label: 'Register' },
 *   ] as const,
 * });
 * ```
 *
 * @example Equivalent without helper
 * ```typescript
 * const config = {
 *   schema: standardSchema(passwordSchema),
 *   fields: [...],
 * } as const satisfies FormConfig;
 * ```
 */
declare function formConfig<const TFields extends NarrowFields, TProps extends object = Record<string, unknown>>(config: Omit<FormConfig<TFields, InferFormValue$1<TFields>, TProps>, 'schema'> & {
    schema?: FormSchema<InferFormValue$1<TFields>>;
}): FormConfig<TFields, InferFormValue$1<TFields>, TProps>;

/**
 * Creates a typed field configuration with helpful error messages for common mistakes.
 *
 * This helper function provides early validation and clear error messages
 * for common configuration pitfalls that would otherwise cause runtime errors.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const nameField = createField('input', {
 *   key: 'name',
 *   label: 'Name',
 *   value: ''
 * });
 *
 * // With validation
 * const emailField = createField('input', {
 *   key: 'email',
 *   label: 'Email',
 *   required: true,
 *   email: true,
 *   props: { type: 'email' }
 * });
 *
 * // Select with options (at field level)
 * const countryField = createField('select', {
 *   key: 'country',
 *   label: 'Country',
 *   options: [{ label: 'USA', value: 'us' }]
 * });
 *
 * // Slider with minValue/maxValue (at field level)
 * const ratingField = createField('slider', {
 *   key: 'rating',
 *   label: 'Rating',
 *   minValue: 1,
 *   maxValue: 10,
 *   step: 1,
 *   value: 5
 * });
 * ```
 *
 * @param type - The field type (e.g., 'input', 'select', 'group')
 * @param config - The field configuration (excluding the 'type' property)
 * @returns A properly typed field configuration
 * @throws DynamicFormError if the configuration contains common mistakes
 */
declare function createField<T extends AvailableFieldTypes>(type: T, config: Omit<ExtractField<T>, 'type'>): ExtractField<T>;
/**
 * Shorthand alias for createField
 *
 * @example
 * ```typescript
 * const nameField = field('input', { key: 'name', label: 'Name', value: '' });
 * ```
 */
declare const field: typeof createField;

/**
 * Base error class for all Dynamic Forms errors.
 *
 * This class centralizes the `[Dynamic Forms]` prefix, ensuring consistent
 * error messaging across the library without requiring each error site to
 * manually include the prefix.
 */
declare class DynamicFormError extends Error {
    private static readonly PREFIX;
    constructor(message: string);
}

/**
 * Builds base input properties from a field definition.
 *
 * This is a helper function that extracts common field properties.
 * Used by mappers to build the inputs record.
 *
 * @param fieldDef The field definition to extract properties from
 * @param defaultProps Optional form-level default props to merge with field props
 * @returns Record of input names to values
 */
declare function buildBaseInputs(fieldDef: FieldDef<unknown>, defaultProps?: Record<string, unknown>): Record<string, unknown>;
/**
 * Base field mapper that extracts common field properties into component inputs.
 *
 * Returns a Signal containing the Record of input names to values that will be
 * passed to ngComponentOutlet. The signal enables reactive updates.
 *
 * @param fieldDef The field definition to map
 * @returns Signal containing Record of input names to values
 */
declare function baseFieldMapper(fieldDef: FieldDef<unknown>): Signal<Record<string, unknown>>;

/**
 * Maps a row field definition to container component inputs.
 *
 * `row` is a virtual field type: it resolves to `ContainerFieldComponent` with a
 * synthesized `{ type: 'row' }` wrapper, so the user-facing config stays
 * `{ type: 'row', fields: [...] }` while the runtime uses the container +
 * wrapper pipeline.
 *
 * Supports hidden state resolution via `logic` array or static `hidden` property.
 */
declare function rowFieldMapper(fieldDef: RowField): Signal<Record<string, unknown>>;

/**
 * Maps a group field definition to component inputs.
 *
 * Group components create nested form structures under the group's key.
 * The group component will inject the parent FIELD_SIGNAL_CONTEXT and create
 * a scoped child injector for its nested fields.
 *
 * Supports hidden state resolution via `logic` array or static `hidden` property.
 *
 * @param fieldDef The group field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
declare function groupFieldMapper(fieldDef: GroupField): Signal<Record<string, unknown>>;

/**
 * Maps an array field definition to component inputs.
 *
 * Array components create nested form structures under the array's key.
 * The array component will inject the parent FIELD_SIGNAL_CONTEXT and create
 * a scoped child injector for its array item fields.
 *
 * Supports hidden state resolution via `logic` array or static `hidden` property.
 *
 * @param fieldDef The array field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
declare function arrayFieldMapper(fieldDef: ArrayField): Signal<Record<string, unknown>>;

/**
 * Maps a page field definition to component inputs.
 *
 * Page fields are layout containers that don't modify the form context.
 * The page component will inject FIELD_SIGNAL_CONTEXT directly.
 *
 * Note: Unlike other container mappers (group, row, array), the page mapper does NOT
 * resolve hidden logic here. Page visibility is managed by the {@link PageOrchestratorComponent}
 * which evaluates `ContainerLogicConfig` conditions and controls the `isVisible` input.
 *
 * @param fieldDef The page field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
declare function pageFieldMapper(fieldDef: PageField): Signal<Record<string, unknown>>;

/**
 * Maps a text field definition to component inputs.
 *
 * Text fields are display-only fields that don't participate in the form schema.
 * This mapper handles the `logic` configuration by using the non-field-hidden resolver
 * to evaluate conditions against the form value from RootFormRegistryService.
 *
 * Hidden state is resolved using the non-field-hidden resolver which considers:
 * 1. Explicit `hidden: true` on the field definition
 * 2. Field-level `logic` array with `type: 'hidden'` conditions
 *
 * Note: Text fields don't support disabled logic since they are display-only.
 *
 * @param fieldDef The text field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
declare function textFieldMapper(fieldDef: TextField): Signal<Record<string, unknown>>;

/**
 * Maps a container field definition to component inputs.
 *
 * Container components are layout containers that don't change the form shape.
 * The container component will inject FIELD_SIGNAL_CONTEXT directly.
 *
 * Supports hidden state resolution via `logic` array or static `hidden` property.
 *
 * @param fieldDef The container field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
declare function containerFieldMapper(fieldDef: ContainerField): Signal<Record<string, unknown>>;

/**
 * Converts DynamicText (string | Observable | Signal) to Observable<string>
 * Unifies all three types into a consistent Observable stream
 *
 * @param value - The dynamic text value to convert
 * @param injector - Optional injector for signal conversion
 * @returns Observable<string> - The value as an observable stream
 */
declare function dynamicTextToObservable(value: DynamicText | undefined, injector?: Injector): Observable<string>;

/**
 * Applies meta attributes to a DOM element and tracks which attributes were applied.
 *
 * This utility handles:
 * - Removing previously applied attributes that are no longer in meta
 * - Setting new attributes from meta
 * - Converting all values to strings via String()
 *
 * @param element - The DOM element to apply attributes to
 * @param meta - The meta object containing attributes to apply
 * @param previouslyApplied - Set of attribute names that were previously applied
 * @returns A new Set containing the attribute names that were applied
 *
 * @example
 * ```typescript
 * private appliedAttrs = new Set<string>();
 *
 * explicitEffect([this.meta], ([meta]) => {
 *   const input = this.el.nativeElement.querySelector('input');
 *   if (input) {
 *     this.appliedAttrs = applyMetaToElement(input, meta, this.appliedAttrs);
 *   }
 * });
 * ```
 */
declare function applyMetaToElement(element: Element, meta: FieldMeta | undefined, previouslyApplied: Set<string>): Set<string>;

/**
 * Wraps a `Resource` so that the previous resolved value is preserved while the resource
 * is loading or reloading. This prevents UI flicker when params change and a new request
 * is in-flight — the consumer sees the stale value with a `loading`/`reloading` status
 * instead of `undefined`.
 *
 * Uses Angular's `resource.snapshot` + `resourceFromSnapshots` composition pattern.
 *
 * @example
 * ```typescript
 * const user = withPreviousValue(
 *   resource({ params: () => userId(), loader: ({ params }) => fetchUser(params) })
 * );
 * // user.value() keeps the old user data during loading transitions
 * ```
 *
 * @experimental Uses Angular's experimental resource composition APIs.
 */
declare function withPreviousValue<T>(input: Resource<T>): Resource<T>;

/**
 * Pipe that handles dynamic text resolution with support for static strings,
 * Observables, and Signals.
 *
 * Supports:
 * - Static strings (pass-through)
 * - Observables (subscribed internally)
 * - Signals (converted to Observable using toObservable for reactivity)
 *
 * @example
 * ```html
 * <!-- Static string -->
 * {{ 'Hello World' | dynamicText | async }}
 *
 * <!-- Observable -->
 * {{ transloco.selectTranslate('key') | dynamicText | async }}
 *
 * <!-- Signal -->
 * {{ myTextSignal | dynamicText | async }}
 * ```
 *
 * @public
 */
declare class DynamicTextPipe implements PipeTransform {
    private readonly injector;
    /**
     * Transforms dynamic text input into a resolved string value
     *
     * @param value - The dynamic text value to resolve
     * @returns The resolved string value as an Observable
     */
    transform(value: DynamicText | undefined): Observable<string>;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<DynamicTextPipe, never>;
    static ɵpipe: _angular_core.ɵɵPipeDeclaration<DynamicTextPipe, "dynamicText", true>;
}

/**
 * Container component for rendering nested form groups.
 *
 * Creates a scoped form context with its own validation state.
 * Child fields receive a FIELD_SIGNAL_CONTEXT scoped to this group's form instance.
 * Group values are nested under the group's key in the parent form.
 */
declare class GroupFieldComponent<TModel extends Record<string, unknown> = Record<string, unknown>> {
    private readonly destroyRef;
    private readonly fieldRegistry;
    private readonly parentFieldSignalContext;
    private readonly injector;
    protected readonly environmentInjector: EnvironmentInjector;
    private readonly eventBus;
    private readonly logger;
    private readonly fieldProcessors;
    field: _angular_core.InputSignal<GroupField<readonly _ng_forge_dynamic_forms.GroupAllowedChildren[]>>;
    key: _angular_core.InputSignal<string>;
    className: _angular_core.InputSignal<string | undefined>;
    hidden: _angular_core.InputSignal<boolean>;
    readonly hostClasses: _angular_core.Signal<string>;
    private readonly rawFieldRegistry;
    private readonly formSetup;
    readonly defaultValues: _angular_core.WritableSignal<Record<string, unknown>>;
    /**
     * Entity computed from parent value, group key, and defaults.
     * Uses deep equality check to prevent unnecessary updates when
     * object spread creates new references with identical values.
     */
    private readonly entity;
    private readonly form;
    readonly formValue: _angular_core.Signal<{}>;
    readonly valid: _angular_core.Signal<boolean>;
    readonly invalid: _angular_core.Signal<boolean>;
    readonly dirty: _angular_core.Signal<boolean>;
    readonly touched: _angular_core.Signal<boolean>;
    readonly errors: _angular_core.Signal<_angular_forms_signals.ValidationError.WithFieldTree[]>;
    readonly disabled: _angular_core.Signal<boolean>;
    private readonly nestedFieldTree;
    private readonly groupFieldSignalContext;
    private readonly groupInjector;
    readonly validityChange: _angular_core.OutputRef<boolean>;
    readonly dirtyChange: _angular_core.OutputRef<boolean>;
    readonly submitted: _angular_core.OutputRef<SubmitEvent>;
    private readonly fieldsSource;
    protected readonly resolvedFields: _angular_core.Signal<ResolvedField[]>;
    constructor();
    private setupEffects;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<GroupFieldComponent<any>, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<GroupFieldComponent<any>, "fieldset[group-field]", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "hidden": { "alias": "hidden"; "required": false; "isSignal": true; }; }, { "validityChange": "validityChange"; "dirtyChange": "dirtyChange"; "submitted": "submitted"; }, never, never, true, never>;
}

/**
 * A single field within a resolved array item.
 *
 * Structurally compatible with `ResolvedField` so the same DfFieldOutlet
 * directive can render both top-level and array-item fields.
 */
interface ResolvedArrayItemField {
    /** Field key (used for tracking and test IDs). */
    key: string;
    /** Original field definition — used by DfFieldOutlet to resolve wrappers. */
    fieldDef: FieldDef<unknown>;
    /** The loaded component type. */
    component: Type<unknown>;
    /** Injector providing ARRAY_CONTEXT and FIELD_SIGNAL_CONTEXT. */
    injector: Injector;
    /** Inputs signal for DfFieldOutlet — evaluated in template for reactivity. */
    inputs: Signal<Record<string, unknown>>;
    /** Whether required mapped inputs are available for safe component instantiation. */
    renderReady: Signal<boolean>;
}
/**
 * Resolved array item ready for declarative rendering with ngComponentOutlet.
 * Each item has a stable unique ID and a linkedSignal-based index that
 * automatically updates when items are added/removed.
 * Supports multiple fields per array item (e.g., name + email without a wrapper).
 */
interface ResolvedArrayItem {
    /** Unique identifier for this item (stable across position changes). */
    id: string;
    /** All fields to render for this array item. */
    fields: ResolvedArrayItemField[];
}

/**
 * Container component for rendering dynamic arrays of fields.
 *
 * Supports add/remove/move operations via the arrayEvent() builder API.
 * Uses differential updates to optimize rendering - only recreates items when necessary.
 * Each item gets a scoped injector with ARRAY_CONTEXT for position-aware operations.
 * Supports multiple sibling fields per array item (e.g., name + email without a wrapper).
 */
declare class ArrayFieldComponent<TModel extends Record<string, unknown> = Record<string, unknown>> {
    private readonly destroyRef;
    private readonly fieldRegistry;
    private readonly parentFieldSignalContext;
    private readonly parentInjector;
    protected readonly environmentInjector: EnvironmentInjector;
    private readonly eventBus;
    private readonly logger;
    private readonly templateRegistry;
    private readonly generateItemId;
    field: _angular_core.InputSignal<ArrayField<readonly ArrayItemDefinition[]>>;
    key: _angular_core.InputSignal<string>;
    className: _angular_core.InputSignal<string | undefined>;
    hidden: _angular_core.InputSignal<boolean>;
    readonly hostClasses: Signal<string>;
    private readonly rawFieldRegistry;
    /**
     * Gets the auto-remove button FieldDef from normalization metadata.
     * Set by simplified array normalization for primitive arrays with remove buttons.
     * The button is rendered alongside each item without wrapping in a row,
     * preserving flat primitive form values.
     */
    private readonly autoRemoveButton;
    /**
     * For primitive array items, the key of the value field template (e.g., 'value').
     * Used to wrap the FormControl in the item context so getFieldTree(key) works.
     * Returns undefined for object arrays (FormGroup items have natural child navigation).
     *
     * Detection order:
     * 1. Normalization metadata (for simplified arrays — always available at normalization time)
     * 2. Existing item definitions (non-empty full-API arrays)
     * 3. Dynamically discovered key from handleAddFromEvent (empty full-API arrays)
     *
     * Uses linkedSignal: recomputes when field() changes, supports manual set()
     * for the dynamic discovery case.
     */
    private readonly primitiveFieldKey;
    /**
     * Normalized item templates WITHOUT auto-remove button appended.
     * Each element is normalized to an array: single FieldDef → [FieldDef], array stays as-is.
     *
     * Used by moveItem() to stash raw templates into the templateRegistry, preserving
     * the invariant that registry entries are pre-synthesis (withAutoRemove() adds the
     * button during resolution).
     */
    private readonly rawItemTemplates;
    /**
     * Resolves the effective fallback template for this array — used when the form
     * value contains an item with no registered template (i.e., items that were
     * neither added via event handlers nor covered by a positional entry in `fields`).
     *
     * Populated from `SimplifiedArrayField.template` via normalization metadata, so every
     * simplified array gets an automatic default. Returns undefined for full-API arrays;
     * `createResolveItemObservable` then falls back to warn-and-drop.
     *
     * Homogeneous arrays only — all fallback items receive the same template.
     */
    private readonly fallbackTemplate;
    /**
     * Gets the item templates (field definitions) for the array.
     * Each element can be either:
     * - A single FieldDef (primitive item) - normalized to [FieldDef]
     * - An array of FieldDefs (object item) - used as-is
     *
     * When auto-remove is configured, the remove button is appended to each item's
     * template list for rendering. This is purely visual — the form schema uses the
     * original primitive item definition (single FieldDef → FormControl → flat value).
     *
     * Returns normalized templates where all items are arrays for consistent handling.
     */
    private readonly itemTemplates;
    private readonly arrayFieldTrees;
    private readonly resolvedItemsSignal;
    private readonly updateVersion;
    private readonly pendingInitializationCycle;
    private readonly settledInitializationCycle;
    /**
     * Map of item IDs to their current positions. O(1) lookup vs O(n) indexOf().
     * Used by child linkedSignals to reactively track their position in the array.
     */
    private readonly itemPositionMap;
    /** Read-only view of resolved items for template consumption. */
    readonly resolvedItems: Signal<ResolvedArrayItem[]>;
    private readonly allResolvedFieldsRenderReady;
    /**
     * Whether the array has reached its configured maxLength.
     * Exposed as a public signal so add-button components can bind [disabled]="atMaxLength()".
     */
    readonly atMaxLength: Signal<boolean>;
    /**
     * Caches the result of appending the auto-remove button to template arrays.
     * Keyed by template array reference — cache hits occur during recreate/resolution
     * operations where stored template references are reused. Add operations via
     * handleAddFromEvent always create a fresh `[...template]` copy (line ~277),
     * so each add is a cache miss by design (the spread is needed for mutability).
     */
    private readonly autoRemoveCache;
    constructor();
    private setupEffects;
    private setupEventHandlers;
    /**
     * Handles add operations from events (append, prepend, insert).
     * Creates resolved items FIRST, then updates form value.
     * This ensures prepend/insert work correctly - differential update sees "none"
     * because resolved items count already matches the new array length.
     *
     * Supports both primitive (single FieldDef) and object (FieldDef[]) templates.
     */
    private handleAddFromEvent;
    private performDifferentialUpdate;
    private resolveAllItems;
    private appendItems;
    /**
     * Creates an observable that resolves a single array item.
     *
     * Template resolution order:
     * 1. Use overrideTemplate if provided (from recreate with stored templates)
     * 2. Use itemTemplates[index] if within defined templates range
     * 3. Use the simplified-array fallback template (from normalization metadata) for
     *    untracked items present in the form value (e.g., external `value.set`, parent
     *    two-way binding, initial values beyond what was declared via simplified `value`).
     *    Registers the resolved item in templateRegistry so subsequent recreates use
     *    Priority 1.
     * 4. Return undefined (item cannot be resolved without a template)
     */
    private createResolveItemObservable;
    /**
     * Appends the auto-remove button to a templates array for rendering.
     * The button is added for visual rendering only — it doesn't affect the form schema.
     * Original templates are stored in templateRegistry WITHOUT the remove button,
     * so this method is called during resolution to add it dynamically.
     *
     * Uses a WeakMap cache keyed by template array reference. Cache hits occur
     * during recreate/resolution paths where stored templates are reused.
     * Add operations always pass a fresh `[...template]` copy, so they miss
     * the cache intentionally (the copy is needed for mutable item construction).
     */
    private withAutoRemove;
    /**
     * Handles move operations — reorders an existing item without destroying it.
     * Updates resolvedItems and form value atomically. Since the array length
     * doesn't change, `determineDifferentialOperation` returns 'none' and no
     * recreate is triggered. The `@for` loop tracks by `item.id`, so Angular
     * moves the DOM node instead of destroying/recreating. The `itemPositionMap`
     * computed auto-recomputes, propagating new indices to child linkedSignals.
     */
    private moveItem;
    /**
     * Handles remove operations from events (pop, shift, removeAt).
     * Updates resolvedItems FIRST, then form value - this ensures differential
     * update sees "none" (lengths match) and avoids unnecessary recreates.
     * Remaining items' linkedSignal indices auto-update via itemPositionMap.
     */
    private removeItem;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<ArrayFieldComponent<any>, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<ArrayFieldComponent<any>, "array-field", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "hidden": { "alias": "hidden"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

/**
 * Layout container that wraps child fields with UI chrome.
 *
 * Resolves children like a row, then chains wrapper components around them
 * using imperative `ViewContainerRef.createComponent()` — each wrapper's
 * `#fieldComponent` slot hosts the next wrapper or the children template.
 *
 * Does not create a new form context - fields share the parent's context.
 * Field values are flattened into the parent form (no nesting under container key).
 * Purely a visual/layout container with no impact on form structure.
 */
declare class ContainerFieldComponent {
    private readonly destroyRef;
    private readonly fieldRegistry;
    private readonly injector;
    protected readonly environmentInjector: EnvironmentInjector;
    private readonly eventBus;
    private readonly logger;
    private readonly wrapperAutoAssociations;
    private readonly defaultWrappersSignal;
    private readonly childrenTpl;
    private readonly wrapperContainer;
    field: _angular_core.InputSignal<ContainerField<readonly _ng_forge_dynamic_forms.ContainerAllowedChildren[], readonly _ng_forge_dynamic_forms.WrapperConfig[]>>;
    key: _angular_core.InputSignal<string>;
    className: _angular_core.InputSignal<string | undefined>;
    hidden: _angular_core.InputSignal<boolean>;
    readonly hostClasses: _angular_core.Signal<string>;
    readonly disabled: _angular_core.Signal<boolean>;
    private readonly rawFieldRegistry;
    private readonly fieldsSource;
    protected readonly resolvedFields: _angular_core.Signal<ResolvedField[]>;
    private readonly wrappers;
    constructor();
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<ContainerFieldComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<ContainerFieldComponent, "div[container-field]", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "hidden": { "alias": "hidden"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

/**
 * Type representing a FieldTree for an array.
 * Extends FieldTree to add numeric indexing for accessing item FieldTrees.
 */
type ArrayFieldTree<T> = FieldTree<T[]> & {
    readonly [index: number]: FieldTree<T> | undefined;
};
/**
 * Get the length of an array FieldTree.
 */
declare function getArrayLength<T>(arrayFieldTree: ArrayFieldTree<T>): number;
/**
 * Read-only view of a single field's observable state.
 *
 * Whitelisted read signals copied from Angular Signal Forms' `FieldState` so wrappers
 * can observe a field without being able to mutate it. New write-capable members
 * added in future Angular versions are excluded by default (the `Pick` list stays
 * the source of truth).
 *
 * `value` is narrowed from `WritableSignal<TValue>` to `Signal<TValue>` so consumers
 * cannot write through it.
 */
interface ReadonlyFieldTree<TValue = unknown> {
    readonly value: Signal<TValue>;
    readonly valid: Signal<boolean>;
    readonly invalid: Signal<boolean>;
    readonly touched: Signal<boolean>;
    readonly dirty: Signal<boolean>;
    readonly required: Signal<boolean>;
    readonly disabled: Signal<boolean>;
    readonly hidden: Signal<boolean>;
    readonly errors: Signal<readonly unknown[]>;
}
/**
 * Build a `ReadonlyFieldTree` by extracting the whitelisted read signals from a
 * Signal Forms `FieldTree`. Returns a fresh plain object — no casting, no proxying,
 * so consumers only see the narrow surface and Angular's `WritableSignal` capability
 * on `value` is hidden.
 */
declare function toReadonlyFieldTree<TValue>(field: FieldTree<TValue>): ReadonlyFieldTree<TValue>;

/**
 * Input shape passed to a wrapper component via the `fieldInputs` input.
 *
 * Carries the wrapped field's mapper outputs plus an optional `field`
 * read-only view. Wrappers reached through a container path (which has
 * no FieldTree of its own) receive `fieldInputs === undefined`, so any
 * wrapper that reads `fieldInputs.field` must guard for it.
 *
 * Mappers must emit new rawInputs objects per tick rather than mutating
 * the previous one — this bag is a shallow spread, so mutations to shared
 * nested values leak to downstream wrappers.
 */
interface WrapperFieldInputs {
    readonly key: string;
    readonly label?: string;
    readonly placeholder?: string;
    readonly className?: string;
    readonly props?: Record<string, unknown>;
    readonly validationMessages?: Record<string, string>;
    readonly defaultValidationMessages?: Record<string, string>;
    readonly field?: ReadonlyFieldTree;
    readonly [key: string]: unknown;
}

/**
 * Native JavaScript utility functions to replace lodash-es
 * These are simple implementations for common object manipulation patterns
 */
/**
 * Performs a deep equality comparison between two values.
 *
 * Handles:
 * - Primitives (including NaN via Object.is)
 * - Dates (by timestamp)
 * - Arrays (deep element comparison)
 * - Plain objects (deep property comparison)
 * - RegExp (by source and flags)
 * - Map and Set (by entries)
 * - Circular references (via WeakMap tracking)
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if values are deeply equal
 *
 * @example
 * ```typescript
 * isEqual({ a: 1 }, { a: 1 }); // true
 * isEqual([1, 2], [1, 2]); // true
 * isEqual({ a: 1 }, { a: 2 }); // false
 * isEqual(new Date('2024-01-01'), new Date('2024-01-01')); // true
 * isEqual(/abc/gi, /abc/gi); // true
 * ```
 */
declare function isEqual(a: unknown, b: unknown): boolean;
/**
 * Creates a new object without the specified keys
 * Native replacement for lodash omit()
 *
 * @param obj - Source object
 * @param keys - Keys to omit
 * @returns New object without specified keys
 *
 * @example
 * ```typescript
 * const obj = { a: 1, b: 2, c: 3 };
 * omit(obj, ['b']); // { a: 1, c: 3 }
 * ```
 */
declare function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;

/**
 * Interpolates {{param}} placeholders in message with error values
 *
 * @param message - Message template with {{param}} placeholders
 * @param error - Validation error containing parameter values
 * @returns Message with interpolated parameters
 *
 * @example
 * interpolateParams("Min value is {{min}}", { kind: 'min', min: 5 })
 * // Returns: "Min value is 5"
 */
declare function interpolateParams(message: string, error: ValidationError): string;

/**
 * Registry service that provides access to the root form and its values.
 *
 * Constructed via factory in `provideDynamicFormDI` with signals from
 * `FormStateManager` — no DI injection, no Maps, no lifecycle.
 */
declare class RootFormRegistryService {
    readonly formValue: Signal<Record<string, unknown>>;
    readonly rootForm: Signal<FieldTree<Record<string, unknown>> | undefined>;
    constructor(formValue: Signal<Record<string, unknown>>, rootForm: Signal<FieldTree<Record<string, unknown>> | undefined>);
}

/**
 * Injection token for configuring the initialization timeout in milliseconds.
 * Defaults to 10 seconds. When the timeout is reached, a warning is logged
 * and (initialized) emits true as a best-effort fallback.
 */
declare const INITIALIZATION_TIMEOUT_MS: InjectionToken<number>;

export { ARRAY_CONTEXT, AppendArrayItemEvent, ArrayFieldComponent, BUILT_IN_FIELDS, ConsoleLogger, ContainerFieldComponent, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES, DEFAULT_WRAPPERS, DynamicForm, DynamicFormError, DynamicFormLogger, DynamicTextPipe, EventBus, EventDispatcher, FIELD_REGISTRY, FIELD_SIGNAL_CONTEXT, FORM_OPTIONS, FormClearEvent, FormResetEvent, GroupFieldComponent, INITIALIZATION_TIMEOUT_MS, InsertArrayItemEvent, MoveArrayItemEvent, NextPageEvent, NoopLogger, PageChangeEvent, PopArrayItemEvent, PrependArrayItemEvent, PreviousPageEvent, RemoveAtIndexEvent, RootFormRegistryService, ShiftArrayItemEvent, SubmitEvent, WRAPPER_REGISTRY, applyMetaToElement, applyValidator, applyValidators, arrayEvent, arrayFieldMapper, baseFieldMapper, buildBaseInputs, containerFieldMapper, createField, createWrappers, dynamicTextToObservable, evaluateNonFieldDisabled, evaluateNonFieldHidden, field, formConfig, getArrayLength, groupFieldMapper, hasFormValue, interpolateParams, isArrayField, isCheckedField, isContainerField, isContainerTypedField, isDisplayOnlyField, isEqual, isFormStateCondition, isGroupField, isLeafField, isPageField, isRowField, isSimplifiedArrayField, isValueBearingField, isValueField, isWrapperTypeDefinition, isWrappersBundle, omit, pageFieldMapper, provideDynamicForm, resolveNextButtonDisabled, resolveNonFieldDisabled, resolveNonFieldHidden, resolveSubmitButtonDisabled, resolveTokens, rowFieldMapper, textFieldMapper, toReadonlyFieldTree, withEventFormValue, withLoggerConfig, withPreviousValue, withValueExclusionDefaults, wrapperProps };
export type { ArrayAllowedChildren, ArrayButtonConfig, ArrayContext, ArrayField, ArrayFieldTree, ArrayItemContext, ArrayItemDefinitionTemplate, ArrayItemTemplate, AsyncCondition, AsyncConditionFunction, AsyncCustomValidator, AsyncDerivationFunction, AsyncValidatorConfig, AvailableFieldTypes, BaseCheckedField, BaseValidatorConfig, BaseValueField, BuiltInValidatorConfig, ButtonLogicContext, CheckedFieldComponent, ConditionalExpression, ContainerAllowedChildren, ContainerField, ContainerFieldTypes, CssWrapper, CustomFnConfig, CustomValidator, CustomValidatorConfig, DeclarativeHttpValidatorConfig, DynamicFormFieldRegistry, DynamicText, EvaluationContext, ExtractField, ExtractFieldDefs, ExtractFormValue, FieldComponent, FieldDef, FieldMeta, FieldOption, FieldPathAccess, FieldRegistryContainers, FieldRegistryLeaves, FieldRegistryWrappers, FieldScope, FieldSignalContext, FieldStateContext, FieldStateInfo, FieldTypeDefinition, FieldWithValidation, FieldWrapperContract, FormConfig, FormEvent, FormEventConstructor, FormFieldStateMap, FormMode, FormModeDetectionResult, FormOptions, FormStateCondition, GroupAllowedChildren, GroupField, HttpCondition, HttpCustomValidator, HttpRequestConfig, HttpResourceRequest, HttpValidationResponseMapping, InferFormValue$1 as InferFormValue, InferWrapperRegistry, LeafFieldTypes, Logger, LogicConfig, MapperFn, NarrowField, NarrowFields, NextButtonOptions, NonFieldLogicConfig, NonFieldLogicContext, NonFieldLogicType, PageAllowedChildren, PageField, Prettify, ReadonlyFieldTree, RegisteredFieldTypes, ResolvedValueExclusionConfig, RowAllowedChildren, RowField, SchemaApplicationConfig, SchemaDefinition, SimplifiedArrayField, StateLogicConfig, SubmissionActionResult, SubmissionConfig, SubmitButtonOptions, TextElementType, TextField, TextProps, TokenContext, ValidationError, ValidationMessages, ValidatorConfig, ValueExclusionConfig, ValueFieldComponent, ValueHandlingMode, ValueType, WithInputSignals, WrapperConfig, WrapperFieldInputs, WrapperRegistration, WrapperTypeDefinition, WrappersBundle };
