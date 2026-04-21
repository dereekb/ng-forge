import { FormEvent, FieldDef, FormEventConstructor, StateLogicConfig, BaseCheckedField, BaseValueField, DynamicText, FieldMeta, FieldOption, ValidationMessages, ArrayAllowedChildren, NonFieldLogicConfig, NextPageEvent, PreviousPageEvent, FieldWithValidation } from '@ng-forge/dynamic-forms';
export { NonFieldLogicConfig, NonFieldLogicContext, NonFieldLogicType, isEqual, resolveNonFieldDisabled, resolveNonFieldHidden } from '@ng-forge/dynamic-forms';
import { Signal, Injector, ElementRef } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';

/**
 * Event arguments that can contain static values or tokens to be resolved at runtime.
 * Tokens supported: $key, $index, $arrayKey, $template, formValue
 *
 * Used by the generic button type when manually configuring events.
 */
type EventArgs = readonly (string | number | boolean | null | undefined)[];
/**
 * Base interface for button fields.
 *
 * This is used by the generic 'button' type which requires explicit event configuration.
 * For specific button types (submit, next, previous, array buttons), use the
 * pre-configured types from the UI library instead.
 */
interface ButtonField<TProps, TEvent extends FormEvent> extends FieldDef<TProps> {
    type: 'button';
    event: FormEventConstructor<TEvent>;
    /**
     * Optional arguments to pass to the event constructor.
     * Can contain special tokens that will be resolved at runtime:
     * - $key: The current field key
     * - $index: The array index (if inside an array field)
     * - $arrayKey: The parent array field key (if inside an array field)
     * - $template: The template for array item creation (for array add buttons)
     * - formValue: Access to the current form value for indexing
     *
     * @example
     * eventArgs: ['$arrayKey', '$index']
     * eventArgs: ['contacts', 0]
     */
    eventArgs?: EventArgs;
    /** Logic rules for dynamic disabled state (overrides form-level defaults) */
    logic?: StateLogicConfig[];
}

interface CheckboxField<TProps> extends BaseCheckedField<TProps> {
    type: 'checkbox';
}

interface DatepickerProps {
    placeholder?: DynamicText;
}
interface DatepickerField<TProps> extends BaseValueField<TProps, Date | string> {
    type: 'datepicker';
    minDate?: Date | string | null;
    maxDate?: Date | string | null;
    startAt?: Date | null;
}

/**
 * Autocomplete values for HTML input elements.
 * Based on the WHATWG HTML specification for autofill.
 *
 * @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
 */
type AutocompleteValue = 'off' | 'on' | 'name' | 'honorific-prefix' | 'given-name' | 'additional-name' | 'family-name' | 'honorific-suffix' | 'nickname' | 'email' | 'username' | 'new-password' | 'current-password' | 'one-time-code' | 'organization-title' | 'organization' | 'street-address' | 'address-line1' | 'address-line2' | 'address-line3' | 'address-level4' | 'address-level3' | 'address-level2' | 'address-level1' | 'country' | 'country-name' | 'postal-code' | 'cc-name' | 'cc-given-name' | 'cc-additional-name' | 'cc-family-name' | 'cc-number' | 'cc-exp' | 'cc-exp-month' | 'cc-exp-year' | 'cc-csc' | 'cc-type' | 'transaction-currency' | 'transaction-amount' | 'language' | 'bday' | 'bday-day' | 'bday-month' | 'bday-year' | 'sex' | 'tel' | 'tel-country-code' | 'tel-national' | 'tel-area-code' | 'tel-local' | 'tel-extension' | 'impp' | 'url' | 'photo';
/**
 * Input mode hints for virtual keyboards on mobile devices.
 *
 * @see https://html.spec.whatwg.org/multipage/interaction.html#input-modalities:-the-inputmode-attribute
 */
type InputMode = 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
/**
 * Enter key hints for virtual keyboards.
 *
 * @see https://html.spec.whatwg.org/multipage/interaction.html#input-modalities:-the-enterkeyhint-attribute
 */
type EnterKeyHint = 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
/**
 * Autocapitalization hints for virtual keyboards.
 *
 * @see https://html.spec.whatwg.org/multipage/interaction.html#attr-autocapitalize
 */
type Autocapitalize = 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
/**
 * Meta attributes specific to HTML input elements.
 *
 * Extends FieldMeta with input-specific native attributes that can be passed through
 * to the underlying input element.
 *
 * @example
 * ```typescript
 * // Input field with meta attributes
 * {
 *   type: 'input',
 *   key: 'email',
 *   meta: {
 *     autocomplete: 'email',
 *     inputmode: 'email',
 *     enterkeyhint: 'next',
 *     spellcheck: false,
 *     'data-testid': 'email-input'
 *   }
 * }
 * ```
 *
 * @public
 */
interface InputMeta extends FieldMeta {
    /**
     * Hint for form autofill behavior.
     */
    autocomplete?: AutocompleteValue;
    /**
     * Hint for virtual keyboard type on mobile devices.
     */
    inputmode?: InputMode;
    /**
     * Hint for the enter key label on virtual keyboards.
     */
    enterkeyhint?: EnterKeyHint;
    /**
     * Whether to enable spellchecking for the input.
     */
    spellcheck?: boolean;
    /**
     * Hint for autocapitalization behavior on virtual keyboards.
     */
    autocapitalize?: Autocapitalize;
    /**
     * Pattern for client-side validation (regex).
     */
    pattern?: string;
    /**
     * Size hint for the input element (character count).
     */
    size?: number;
    /**
     * Maximum number of characters allowed.
     */
    maxlength?: number;
    /**
     * Minimum number of characters required.
     */
    minlength?: number;
}

/**
 * All valid HTML input types per MDN specification.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#input_types
 */
type HtmlInputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'datetime-local' | 'month' | 'week' | 'time' | 'color' | 'range' | 'checkbox' | 'radio' | 'file' | 'hidden' | 'button' | 'submit' | 'reset' | 'image';
/**
 * Input types supported by InputField.
 * Other HTML input types have dedicated field implementations:
 * - checkbox → CheckboxField
 * - radio → RadioField
 * - range → SliderField
 * - date/time → DatepickerField
 * - file, hidden, button, etc. → dedicated fields
 */
type InputType = Extract<HtmlInputType, 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'>;
/**
 * Infers the TypeScript value type for a given input type.
 *
 * @example
 * type NumberValue = InferInputValue<'number'>; // number
 * type TextValue = InferInputValue<'text'>; // string
 * type DateValue = InferInputValue<'date'>; // string (extended types)
 */
type InferInputValue<T extends HtmlInputType> = T extends 'number' ? number : string;
/**
 * @deprecated Use `InferInputValue` instead. Will be removed in v1.0.0.
 */
type InputTypeToValueType<T extends InputType> = InferInputValue<T>;
/**
 * Props for input fields with optional type specification.
 * Generic parameter allows extending InputType with additional HtmlInputType values.
 *
 * @example
 * // Default usage
 * interface MyProps extends InputProps { ... }
 *
 * // Extended input types (e.g., supporting date inputs)
 * type ExtendedType = InputType | 'date' | 'time';
 * interface ExtendedProps extends InputProps<ExtendedType> { ... }
 */
interface InputProps<T extends HtmlInputType = InputType> {
    /**
     * The HTML input type. Determines the value type:
     * - 'number': value will be number
     * - All other types: value will be string
     */
    type?: T;
    placeholder?: DynamicText;
}
/**
 * Input types that produce numeric values.
 * Currently only 'number' produces a numeric value in HTML inputs.
 *
 * @example
 * type Numeric = NumericInputType; // 'number'
 */
type NumericInputType<T extends HtmlInputType = InputType> = Extract<T, 'number'>;
/**
 * Input types that produce string values.
 *
 * @example
 * type Strings = StringInputType; // Exclude<InputType, 'number'>
 */
type StringInputType<T extends HtmlInputType = InputType> = Exclude<T, 'number'>;
/**
 * Number input field with strict number value type.
 * When props.type is 'number', value must be number.
 * Props is REQUIRED and must include type: 'number'.
 */
interface NumberInputField<TProps extends {
    type?: string;
} = InputProps> extends BaseValueField<TProps & {
    type: 'number';
}, number, InputMeta> {
    type: 'input';
    props: TProps & {
        type: 'number';
    };
}
/**
 * String input field with strict string value type.
 * When props.type is text/email/etc (or undefined), value must be string.
 * Props type cannot be 'number'.
 */
interface StringInputField<TProps extends {
    type?: string;
} = InputProps> extends BaseValueField<TProps & {
    type?: Exclude<TProps['type'], 'number'>;
}, string, InputMeta> {
    type: 'input';
    props?: TProps & {
        type?: Exclude<TProps['type'], 'number'>;
    };
}
/**
 * Builds discriminated union where props.type determines value type.
 * - If props.type is 'number', only NumberInputField matches (value: number)
 * - If props.type is undefined/text/email/etc, only StringInputField matches (value: string)
 */
type BuildInputFieldUnion<TProps extends {
    type?: string;
}> = NumberInputField<TProps> | StringInputField<TProps>;
/**
 * Input field with automatic type-safe value inference.
 * TypeScript automatically infers the correct value type based on props.type.
 *
 * @example
 * // Direct usage - automatic strict type safety
 * const numberField: InputField = {
 *   type: 'input',
 *   key: 'age',
 *   props: { type: 'number' },
 *   value: 25 // ✓ number only (string is type error!)
 * };
 *
 * const textField: InputField = {
 *   type: 'input',
 *   key: 'name',
 *   props: { type: 'text' },
 *   value: 'hello' // ✓ string only (number is type error!)
 * };
 *
 * @example
 * // Framework usage - extend with custom props
 * interface MatInputProps extends InputProps {
 *   appearance?: 'fill' | 'outline';
 *   hint?: string;
 * }
 * type MatInputField = InputField<MatInputProps>; // Automatically gets discriminated union
 */
type InputField<TProps extends {
    type?: string;
} = InputProps> = BuildInputFieldUnion<TProps>;

/**
 * Multi-checkbox field for selecting multiple values from a list of options.
 * The value is an array of selected option values.
 *
 * @example
 * const tagsField: MultiCheckboxField<string> = {
 *   type: 'multi-checkbox',
 *   key: 'tags',
 *   value: ['tag1', 'tag2'], // Array of selected values
 *   options: [
 *     { label: 'Tag 1', value: 'tag1' },
 *     { label: 'Tag 2', value: 'tag2' },
 *     { label: 'Tag 3', value: 'tag3' }
 *   ]
 * };
 */
interface MultiCheckboxField<TValue, TProps = object> extends BaseValueField<TProps, TValue[]> {
    type: 'multi-checkbox';
    readonly options: readonly FieldOption<TValue>[];
}

interface RadioField<T, TProps> extends BaseValueField<TProps, T> {
    type: 'radio';
    readonly options: readonly FieldOption<T>[];
}

interface SelectProps {
    placeholder?: DynamicText;
}
interface SelectField<T, TProps = SelectProps> extends BaseValueField<TProps, T> {
    type: 'select';
    readonly options: readonly FieldOption<T>[];
}

interface SliderField<TProps> extends BaseValueField<TProps, number> {
    type: 'slider';
    minValue?: number;
    maxValue?: number;
    step?: number;
}

/**
 * Text wrapping behavior for textarea elements.
 *
 * @see https://html.spec.whatwg.org/multipage/form-elements.html#attr-textarea-wrap
 */
type TextareaWrap = 'hard' | 'soft' | 'off';
/**
 * Meta attributes specific to HTML textarea elements.
 *
 * Extends FieldMeta with textarea-specific native attributes that can be passed through
 * to the underlying textarea element.
 *
 * @example
 * ```typescript
 * // Textarea field with meta attributes
 * {
 *   type: 'textarea',
 *   key: 'description',
 *   meta: {
 *     wrap: 'soft',
 *     spellcheck: true,
 *     autocomplete: 'off',
 *     'data-testid': 'description-textarea'
 *   }
 * }
 * ```
 *
 * @public
 */
interface TextareaMeta extends FieldMeta {
    /**
     * How text should wrap when submitted.
     * - 'hard': Line breaks are inserted to wrap text at cols width
     * - 'soft': Text is wrapped for display but not in submitted value
     * - 'off': No wrapping, horizontal scrolling if needed
     */
    wrap?: TextareaWrap;
    /**
     * Whether to enable spellchecking for the textarea.
     */
    spellcheck?: boolean;
    /**
     * Hint for form autofill behavior.
     */
    autocomplete?: AutocompleteValue;
    /**
     * Hint for autocapitalization behavior on virtual keyboards.
     */
    autocapitalize?: Autocapitalize;
    /**
     * Hint for the enter key label on virtual keyboards.
     */
    enterkeyhint?: EnterKeyHint;
    /**
     * Maximum number of characters allowed.
     */
    maxlength?: number;
    /**
     * Minimum number of characters required.
     */
    minlength?: number;
}

interface TextareaProps {
    placeholder?: DynamicText;
    rows?: number;
    cols?: number | undefined;
}
interface TextareaField<TProps = TextareaProps> extends BaseValueField<TProps, string, TextareaMeta> {
    type: 'textarea';
    maxLength?: number | undefined;
}

interface ToggleField<TProps> extends BaseCheckedField<TProps> {
    type: 'toggle';
}

/**
 * Context for value field mapping, containing the injected context reference.
 * Used by specialized mappers to avoid duplicate injection.
 *
 * Note: The field tree is resolved lazily via getFieldTree() to support
 * reactive form access (e.g., for array items where the form structure
 * may not exist at injection time but becomes available later).
 */
interface ValueFieldContext {
    /**
     * Gets the field tree for a given key from the form context.
     * This is reactive for array items - the form getter is evaluated each time,
     * allowing the computed to re-run when the root form structure updates.
     */
    getFieldTree: (fieldKey: string) => FieldTree<unknown> | undefined;
}
/**
 * Creates a value field context from the injected FIELD_SIGNAL_CONTEXT.
 * Must be called within an injection context.
 *
 * With direct root form binding for array items, the FIELD_SIGNAL_CONTEXT.form
 * uses a getter that evaluates reactively. This means:
 * - For regular fields: direct access to the form's FieldTree
 * - For array items: the getter resolves rootForm['arrayKey'][index] dynamically
 *
 * The returned context provides a getFieldTree function that should be called
 * inside a computed to establish proper reactive dependencies.
 *
 * @returns The value field context with reactive field tree accessor
 */
declare function resolveValueFieldContext(): ValueFieldContext;
/**
 * Builds the base inputs for a value field.
 * This is a helper function used by valueFieldMapper and specialized mappers.
 *
 * Note: This function should be called inside a computed signal to ensure
 * proper reactive dependency tracking for the field tree resolution.
 *
 * @param fieldDef The value field definition
 * @param ctx The resolved value field context
 * @param defaultProps Default props from the form configuration (may be undefined if not configured)
 * @param defaultValidationMessages Default validation messages from the form configuration (may be undefined if not configured)
 * @returns Record of input names to values
 */
declare function buildValueFieldInputs<TProps, TValue = unknown>(fieldDef: BaseValueField<TProps, TValue>, ctx: ValueFieldContext, defaultProps?: Record<string, unknown>, defaultValidationMessages?: ValidationMessages): Record<string, unknown>;
/**
 * Maps a value field definition to component inputs.
 *
 * Value fields are input fields that contribute to the form's value (text, number, etc.).
 * This mapper injects FIELD_SIGNAL_CONTEXT to access the form structure and retrieve the field proxy.
 *
 * For array items, the FIELD_SIGNAL_CONTEXT.form uses a reactive getter that resolves
 * rootForm['arrayKey'][index] dynamically. This means:
 * - Zod/StandardSchema validation errors are automatically available
 * - The field tree updates reactively when the root form structure changes
 * - Newly added array items will get their field tree once the form value updates
 *
 * For fields with specific properties (select, datepicker, textarea, slider), use the specialized mappers:
 * - selectFieldMapper: for fields with options (select, radio, multi-checkbox)
 * - datepickerFieldMapper: for fields with minDate, maxDate, startAt
 * - textareaFieldMapper: for fields with rows, cols
 * - sliderFieldMapper: for fields with minValue, maxValue, step
 *
 * @param fieldDef The value field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
declare function valueFieldMapper<TProps = unknown, TValue = unknown>(fieldDef: BaseValueField<TProps, TValue>): Signal<Record<string, unknown>>;

/**
 * Maps a checkbox/toggle field definition to component inputs.
 *
 * Checkbox fields are checked fields that contribute to the form's value as boolean.
 * This mapper injects FIELD_SIGNAL_CONTEXT to access the form structure and retrieve the field tree.
 *
 * @param fieldDef The checkbox field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
declare function checkboxFieldMapper(fieldDef: BaseCheckedField<unknown>): Signal<Record<string, unknown>>;

/**
 * Maps a datepicker field to component inputs.
 *
 * Extends the base value field mapper by adding datepicker-specific properties:
 * - minDate: Minimum selectable date
 * - maxDate: Maximum selectable date
 * - startAt: Initial date to display when opening the picker
 *
 * Date values are automatically converted from strings to Date objects
 * since UI libraries (Material, PrimeNG, etc.) expect Date objects.
 *
 * @param fieldDef The datepicker field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
declare function datepickerFieldMapper<TProps>(fieldDef: DatepickerField<TProps>): Signal<Record<string, unknown>>;

/**
 * Field types that have an options property.
 */
type FieldWithOptions<T = unknown, TProps = unknown> = SelectField<T, TProps> | RadioField<T, TProps> | MultiCheckboxField<T, TProps>;
/**
 * Maps a field with options (select, radio, multi-checkbox) to component inputs.
 *
 * Extends the base value field mapper by adding the options property.
 *
 * @param fieldDef The field definition with options
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
declare function optionsFieldMapper<T, TProps>(fieldDef: FieldWithOptions<T, TProps>): Signal<Record<string, unknown>>;

/**
 * Maps a button field to component inputs.
 *
 * Unlike value field mappers, button fields do not participate in form values
 * and do not need field tree resolution or validation messages.
 *
 * Button-specific properties:
 * - event: The FormEvent constructor to emit when clicked
 * - eventArgs: Optional arguments to pass to the event constructor
 *
 * Hidden and disabled states are resolved using non-field logic resolvers which consider:
 * 1. Explicit `hidden: true` / `disabled: true` on the field definition
 * 2. Field-level `logic` array with `type: 'hidden'` or `type: 'disabled'` conditions
 *
 * @param fieldDef The button field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
declare function buttonFieldMapper<TProps, TEvent extends FormEvent>(fieldDef: ButtonField<TProps, TEvent>): Signal<Record<string, unknown>>;

/**
 * Context for array button mapping, containing resolved array information.
 * Used by array button mappers to build event context.
 */
interface ArrayButtonContext {
    /** The target array key (from explicit arrayKey or ARRAY_CONTEXT) */
    targetArrayKey: string | undefined;
    /** Computed signal that returns the current array index (-1 if not inside array) */
    indexSignal: Signal<number>;
    /** The current form value for token resolution */
    formValue: Record<string, unknown>;
    /** Whether this button is inside an array context */
    isInsideArray: boolean;
}
/**
 * Event context passed to button components for array operations.
 */
interface ArrayButtonEventContext {
    /** The button field key */
    key: string;
    /** The current array index (-1 if outside array) */
    index: number;
    /** The target array key */
    arrayKey: string;
    /** The form value for token resolution */
    formValue: Record<string, unknown>;
    /**
     * Optional template for add operations.
     * Can be a single field (primitive item) or array of fields (object item).
     */
    template?: ArrayAllowedChildren | readonly ArrayAllowedChildren[];
}
/**
 * Resolves array button context for button mappers.
 *
 * Handles both inside-array (context from ARRAY_CONTEXT) and
 * outside-array (explicit arrayKey) placements.
 *
 * Must be called in injection context.
 *
 * @param fieldKey The button field key (for logging)
 * @param buttonType The button type name (for logging)
 * @param explicitArrayKey Optional explicit arrayKey from field definition
 * @returns The array button context with reactive index signal
 */
declare function resolveArrayButtonContext(fieldKey: string, buttonType: string, explicitArrayKey?: string): ArrayButtonContext;
/**
 * Builds the event context passed to the button component.
 *
 * Should be called inside a computed to track index signal changes.
 *
 * @param fieldKey The button field key
 * @param ctx The resolved array button context
 * @param template Optional template for add operations (single field or array of fields)
 * @returns The event context for the button component
 */
declare function buildArrayButtonEventContext(fieldKey: string, ctx: ArrayButtonContext, template?: ArrayAllowedChildren | readonly ArrayAllowedChildren[]): ArrayButtonEventContext;
/**
 * Event argument type - supports static values and tokens.
 * Tokens: $key, $index, $arrayKey, $template, formValue
 */
type EventArg = string | number | boolean | null | undefined;
/**
 * Resolves eventArgs with defaults for array buttons.
 *
 * @param fieldEventArgs The eventArgs from field definition (may be undefined)
 * @param defaultEventArgs The default eventArgs to use if not specified
 * @returns The resolved eventArgs array
 */
declare function resolveArrayButtonEventArgs(fieldEventArgs: readonly EventArg[] | undefined, defaultEventArgs?: readonly EventArg[]): readonly EventArg[];

/**
 * Base interface for array add button fields (append, prepend, insert).
 * Template is required to define the structure for new items.
 */
interface BaseArrayAddButtonField<TProps = unknown> {
    key: string;
    type: string;
    label?: string;
    disabled?: boolean;
    hidden?: boolean;
    className?: string;
    props?: TProps;
    /** Target array key (required when outside array, optional inside) */
    arrayKey?: string;
    /**
     * Template defining the field structure for new items. REQUIRED.
     * - Single field (ArrayAllowedChildren): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (ArrayAllowedChildren[]): Creates an object item (fields merged into object)
     */
    template: ArrayAllowedChildren | readonly ArrayAllowedChildren[];
    /** Optional custom eventArgs */
    eventArgs?: readonly EventArg[];
    /** Logic rules for dynamic hidden/disabled state (only hidden and disabled are supported) */
    logic?: NonFieldLogicConfig[];
}
/**
 * Base interface for array remove button fields (remove, pop, shift).
 * No template needed - removes existing items.
 */
interface BaseArrayRemoveButtonField<TProps = unknown> {
    key: string;
    type: string;
    label?: string;
    disabled?: boolean;
    hidden?: boolean;
    className?: string;
    props?: TProps;
    /** Target array key (required when outside array, optional inside) */
    arrayKey?: string;
    /** Optional custom eventArgs */
    eventArgs?: readonly EventArg[];
    /** Logic rules for dynamic hidden/disabled state (only hidden and disabled are supported) */
    logic?: NonFieldLogicConfig[];
}
/**
 * Interface for insert array item button fields.
 * Extends add button with required index.
 */
interface BaseInsertArrayItemButtonField<TProps = unknown> extends BaseArrayAddButtonField<TProps> {
    /** The index at which to insert the new item */
    index: number;
}
/**
 * Mapper for add array item button — appends new item to end of array.
 * Template is REQUIRED to define the field structure for new items.
 */
declare function addArrayItemButtonMapper<TProps>(fieldDef: BaseArrayAddButtonField<TProps>): Signal<Record<string, unknown>>;
/**
 * Mapper for prepend array item button — inserts new item at beginning of array.
 * Template is REQUIRED to define the field structure for new items.
 */
declare function prependArrayItemButtonMapper<TProps>(fieldDef: BaseArrayAddButtonField<TProps>): Signal<Record<string, unknown>>;
/**
 * Mapper for insert array item button — inserts new item at specific index.
 * Template and index are REQUIRED.
 */
declare function insertArrayItemButtonMapper<TProps>(fieldDef: BaseInsertArrayItemButtonField<TProps>): Signal<Record<string, unknown>>;
/**
 * Mapper for remove array item button.
 * Inside array: RemoveAtIndexEvent. Outside array: PopArrayItemEvent.
 */
declare function removeArrayItemButtonMapper<TProps>(fieldDef: BaseArrayRemoveButtonField<TProps>): Signal<Record<string, unknown>>;
/** Mapper for pop array item button — removes the last item from array. */
declare function popArrayItemButtonMapper<TProps>(fieldDef: BaseArrayRemoveButtonField<TProps>): Signal<Record<string, unknown>>;
/** Mapper for shift array item button — removes the first item from array. */
declare function shiftArrayItemButtonMapper<TProps>(fieldDef: BaseArrayRemoveButtonField<TProps>): Signal<Record<string, unknown>>;

/**
 * Base interface for navigation button fields (submit, next, previous).
 */
type BaseNavigationButtonField<TProps = unknown> = ButtonField<TProps, SubmitEvent | NextPageEvent | PreviousPageEvent> & {
    type: string;
    /** Logic rules for dynamic disabled state */
    logic?: FieldWithValidation['logic'];
};
/**
 * Mapper for submit button — configures native form submission via type="submit".
 * Triggers native form submission rather than dispatching events directly.
 */
declare function submitButtonFieldMapper<TProps>(fieldDef: BaseNavigationButtonField<TProps>): Signal<Record<string, unknown>>;
/** Mapper for next page button — preconfigures NextPageEvent. */
declare function nextButtonFieldMapper<TProps>(fieldDef: BaseNavigationButtonField<TProps>): Signal<Record<string, unknown>>;
/** Mapper for previous page button — preconfigures PreviousPageEvent. */
declare function previousButtonFieldMapper<TProps>(fieldDef: BaseNavigationButtonField<TProps>): Signal<Record<string, unknown>>;

/**
 * Resolved validation error with interpolated message
 */
interface ResolvedError {
    kind: string;
    message: string;
}
/**
 * Factory function that creates a signal of resolved validation errors
 * Handles async resolution of DynamicText validation messages
 *
 * @param field - Signal containing FieldTree
 * @param validationMessages - Signal containing custom field-level validation messages
 * @param defaultValidationMessages - Signal containing default validation messages (fallback)
 * @param injector - Optional injector for DynamicText resolution
 * @returns Signal<ResolvedError[]> - Reactively resolved error messages
 *
 * @example
 * ```typescript
 * readonly resolvedErrors = createResolvedErrorsSignal(
 *   this.field,
 *   this.validationMessages,
 *   this.defaultValidationMessages
 * );
 * ```
 */
declare function createResolvedErrorsSignal<T>(field: Signal<FieldTree<T>>, validationMessages: Signal<ValidationMessages | undefined>, defaultValidationMessages?: Signal<ValidationMessages | undefined>, injector?: Injector): Signal<ResolvedError[]>;

/**
 * Computed signal that determines if errors should be displayed.
 * Based on field's invalid, touched, and error count.
 *
 * @param field - Signal containing FieldTree
 * @returns Signal<boolean> - True if errors should be displayed
 */
declare function shouldShowErrors<T>(field: Signal<FieldTree<T>>): Signal<boolean>;

/**
 * Configuration options for setupMetaTracking.
 */
interface MetaTrackingOptions {
    /**
     * CSS selector for target elements within the host.
     * If not provided, meta attributes are applied directly to the host element.
     *
     * @example
     * // Apply to internal radio inputs
     * selector: 'input[type="radio"]'
     *
     * // Apply to host element (for Shadow DOM components)
     * selector: undefined
     */
    selector?: string;
    /**
     * Additional signals to track that should trigger re-application of meta.
     * Useful for components where DOM elements are dynamically created (e.g., radio options).
     *
     * @example
     * // Re-apply when options change
     * dependents: [this.options]
     */
    dependents?: Signal<unknown>[];
}
/**
 * Sets up automatic meta attribute tracking and application for wrapped components.
 *
 * This utility creates an `afterRenderEffect` that applies meta attributes to DOM elements
 * after Angular's render cycle. It efficiently tracks signal dependencies and only re-applies
 * when the meta signal or any dependent signals change.
 *
 * Use this instead of MutationObserver for better performance and integration with Angular's
 * change detection.
 *
 * @param elementRef - Reference to the host element
 * @param meta - Signal containing meta attributes to apply
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * // For a radio group with dynamic options
 * constructor() {
 *   setupMetaTracking(inject(ElementRef), this.meta, {
 *     selector: 'input[type="radio"]',
 *     dependents: [this.options]
 *   });
 * }
 *
 * // For a simple checkbox
 * constructor() {
 *   setupMetaTracking(inject(ElementRef), this.meta, {
 *     selector: 'input[type="checkbox"]'
 *   });
 * }
 *
 * // For Shadow DOM components (apply to host)
 * constructor() {
 *   setupMetaTracking(inject(ElementRef), this.meta);
 * }
 * ```
 */
declare function setupMetaTracking(elementRef: ElementRef<HTMLElement>, meta: Signal<FieldMeta | undefined>, options?: MetaTrackingOptions): void;

export { addArrayItemButtonMapper, buildArrayButtonEventContext, buildValueFieldInputs, buttonFieldMapper, checkboxFieldMapper, createResolvedErrorsSignal, datepickerFieldMapper, insertArrayItemButtonMapper, nextButtonFieldMapper, optionsFieldMapper, popArrayItemButtonMapper, prependArrayItemButtonMapper, previousButtonFieldMapper, removeArrayItemButtonMapper, resolveArrayButtonContext, resolveArrayButtonEventArgs, resolveValueFieldContext, setupMetaTracking, shiftArrayItemButtonMapper, shouldShowErrors, submitButtonFieldMapper, valueFieldMapper };
export type { ArrayButtonContext, ArrayButtonEventContext, Autocapitalize, AutocompleteValue, BaseArrayAddButtonField, BaseArrayRemoveButtonField, BaseInsertArrayItemButtonField, BaseNavigationButtonField, ButtonField, CheckboxField, DatepickerField, DatepickerProps, EnterKeyHint, EventArg, EventArgs, FieldWithOptions, HtmlInputType, InferInputValue, InputField, InputMeta, InputMode, InputProps, InputType, InputTypeToValueType, MetaTrackingOptions, MultiCheckboxField, NumericInputType, RadioField, ResolvedError, SelectField, SelectProps, SliderField, StringInputType, TextareaField, TextareaMeta, TextareaProps, TextareaWrap, ToggleField, ValueFieldContext };
