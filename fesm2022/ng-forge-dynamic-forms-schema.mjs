/**
 * Internal marker symbol to identify StandardSchemaMarker instances.
 * Uses ɵ prefix following Angular's convention for internal APIs.
 */
const STANDARD_SCHEMA_KIND = 'standardSchema';
/**
 * Wraps a Standard Schema compliant schema for use with dynamic forms.
 *
 * This function creates a marker wrapper around schemas that implement the
 * Standard Schema spec (Zod, Valibot, ArkType, etc.), allowing the dynamic
 * forms system to identify and use them for validation.
 *
 * @typeParam T - The inferred type that the schema validates to
 * @param schema - A schema implementing the Standard Schema V1 spec
 * @returns A wrapped schema marker that can be passed to dynamic form configuration
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { standardSchema } from '@ng-forge/dynamic-forms/schema';
 *
 * const loginSchema = z.object({
 *   email: z.string().email('Invalid email format'),
 *   password: z.string().min(8, 'Password must be at least 8 characters'),
 * });
 *
 * // Wrap for use with dynamic forms
 * const formSchema = standardSchema(loginSchema);
 *
 * // Use in form configuration
 * const formConfig = {
 *   schema: formSchema,
 *   fields: [
 *     input({ key: 'email', label: 'Email' }),
 *     input({ key: 'password', label: 'Password', props: { type: 'password' } }),
 *   ],
 * };
 * ```
 */
function standardSchema(schema) {
    return {
        ɵkind: STANDARD_SCHEMA_KIND,
        schema,
    };
}
/**
 * Type guard to check if a value is a StandardSchemaMarker.
 *
 * This is useful when processing form configuration to determine if a schema
 * has been provided and should be used for validation.
 *
 * @param value - The value to check
 * @returns True if the value is a StandardSchemaMarker, false otherwise
 *
 * @example
 * ```typescript
 * import { isStandardSchemaMarker } from '@ng-forge/dynamic-forms/schema';
 *
 * function processFormConfig(config: FormConfig) {
 *   if (config.schema && isStandardSchemaMarker(config.schema)) {
 *     // Use the schema for validation
 *     const result = config.schema.schema['~standard'].validate(formValue);
 *   }
 * }
 * ```
 */
function isStandardSchemaMarker(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'ɵkind' in value &&
        value.ɵkind === STANDARD_SCHEMA_KIND &&
        'schema' in value);
}

/**
 * @ng-forge/dynamic-forms/schema
 *
 * Schema integration API for using Standard Schema compliant validation libraries
 * (Zod, Valibot, ArkType, etc.) with dynamic forms.
 *
 * This entrypoint provides:
 * - `standardSchema()` - Wrapper function to mark schemas for use with forms
 * - `isStandardSchemaMarker()` - Type guard for schema detection
 * - Type definitions for form schema configuration
 */

/**
 * Generated bundle index. Do not edit.
 */

export { isStandardSchemaMarker, standardSchema };
//# sourceMappingURL=ng-forge-dynamic-forms-schema.mjs.map
