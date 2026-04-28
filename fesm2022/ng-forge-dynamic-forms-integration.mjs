import { inject, computed, signal, Injector, afterRenderEffect } from '@angular/core';
import { FIELD_SIGNAL_CONTEXT, omit, buildBaseInputs, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES, resolveNonFieldHidden, resolveNonFieldDisabled, RootFormRegistryService, ARRAY_CONTEXT, DynamicFormLogger, AppendArrayItemEvent, PrependArrayItemEvent, InsertArrayItemEvent, RemoveAtIndexEvent, PopArrayItemEvent, ShiftArrayItemEvent, FORM_OPTIONS, resolveSubmitButtonDisabled, resolveNextButtonDisabled, NextPageEvent, PreviousPageEvent, dynamicTextToObservable, interpolateParams, isEqual, applyMetaToElement } from '@ng-forge/dynamic-forms';
export { isEqual, resolveNonFieldDisabled, resolveNonFieldHidden } from '@ng-forge/dynamic-forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

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
function resolveValueFieldContext() {
    const context = inject(FIELD_SIGNAL_CONTEXT);
    return {
        getFieldTree: (fieldKey) => {
            // Access context.form here (inside a function that will be called from a computed)
            // This allows the getter to be evaluated reactively
            const formRoot = context.form;
            // Handle case where form is undefined (e.g., newly added array items before root form updates)
            if (!formRoot) {
                return undefined;
            }
            return formRoot[fieldKey];
        },
    };
}
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
function buildValueFieldInputs(fieldDef, ctx, defaultProps, defaultValidationMessages) {
    const omittedFields = omit(fieldDef, ['value']);
    const baseInputs = buildBaseInputs(omittedFields, defaultProps);
    const inputs = {
        ...baseInputs,
        validationMessages: fieldDef.validationMessages ?? {},
    };
    if (fieldDef.placeholder !== undefined) {
        inputs['placeholder'] = fieldDef.placeholder;
    }
    if (defaultValidationMessages !== undefined) {
        inputs['defaultValidationMessages'] = defaultValidationMessages;
    }
    // Resolve field tree reactively - this call is inside a computed,
    // so it establishes the reactive dependency correctly
    const fieldTree = ctx.getFieldTree(fieldDef.key);
    if (fieldTree !== undefined) {
        inputs['field'] = fieldTree;
    }
    return inputs;
}
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
 * For fields with specific properties, use the specialized mappers:
 * - optionsFieldMapper: for fields with options (select, radio, multi-checkbox)
 * - datepickerFieldMapper: for fields with minDate, maxDate, startAt
 * - checkboxFieldMapper: for boolean fields (checkbox, toggle)
 *
 * @param fieldDef The value field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
function valueFieldMapper(fieldDef) {
    // Get the context once at injection time (captures the FIELD_SIGNAL_CONTEXT reference)
    const ctx = resolveValueFieldContext();
    const defaultProps = inject(DEFAULT_PROPS);
    const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);
    // The computed calls ctx.getFieldTree(fieldDef.key) inside, which:
    // 1. Accesses context.form (triggering the getter for array items)
    // 2. Returns the field tree if available, or undefined if not yet
    // 3. Re-runs when the form structure updates (reactive dependency)
    return computed(() => {
        return buildValueFieldInputs(fieldDef, ctx, defaultProps(), defaultValidationMessages());
    });
}

/**
 * Maps a checkbox/toggle field definition to component inputs.
 *
 * Checkbox fields are checked fields that contribute to the form's value as boolean.
 * This mapper injects FIELD_SIGNAL_CONTEXT to access the form structure and retrieve the field tree.
 *
 * @param fieldDef The checkbox field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
function checkboxFieldMapper(fieldDef) {
    const context = inject(FIELD_SIGNAL_CONTEXT);
    const defaultProps = inject(DEFAULT_PROPS);
    const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);
    return computed(() => {
        const omittedFields = omit(fieldDef, ['value']);
        const baseInputs = buildBaseInputs(omittedFields, defaultProps());
        const validationMessages = defaultValidationMessages();
        const inputs = {
            ...baseInputs,
            validationMessages: fieldDef.validationMessages ?? {},
        };
        if (fieldDef.placeholder !== undefined) {
            inputs['placeholder'] = fieldDef.placeholder;
        }
        if (validationMessages !== undefined) {
            inputs['defaultValidationMessages'] = validationMessages;
        }
        // Access form inside computed for reactivity and to handle cases where
        // form may not be immediately available (e.g., during array item initialization)
        const formRoot = context.form;
        const fieldTree = formRoot?.[fieldDef.key];
        if (fieldTree !== undefined) {
            inputs['field'] = fieldTree;
        }
        return inputs;
    });
}

/**
 * Converts a date value (string, Date, or null) to a Date object or null.
 * This ensures UI libraries that expect Date objects receive the correct type.
 */
function toDate(value) {
    if (value === null || value === undefined) {
        return null;
    }
    if (value instanceof Date) {
        return value;
    }
    // Parse string to Date
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}
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
function datepickerFieldMapper(fieldDef) {
    const ctx = resolveValueFieldContext();
    const defaultProps = inject(DEFAULT_PROPS);
    const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);
    return computed(() => {
        const inputs = buildValueFieldInputs(fieldDef, ctx, defaultProps(), defaultValidationMessages());
        // Add datepicker-specific properties, converting strings to Date objects
        if (fieldDef.minDate !== undefined) {
            inputs['minDate'] = toDate(fieldDef.minDate);
        }
        if (fieldDef.maxDate !== undefined) {
            inputs['maxDate'] = toDate(fieldDef.maxDate);
        }
        if (fieldDef.startAt !== undefined) {
            inputs['startAt'] = toDate(fieldDef.startAt);
        }
        return inputs;
    });
}

/**
 * Maps a field with options (select, radio, multi-checkbox) to component inputs.
 *
 * Extends the base value field mapper by adding the options property.
 *
 * @param fieldDef The field definition with options
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
function optionsFieldMapper(fieldDef) {
    const ctx = resolveValueFieldContext();
    const defaultProps = inject(DEFAULT_PROPS);
    const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);
    return computed(() => {
        // Cast to BaseValueField - safe because all FieldWithOptions types extend BaseValueField
        const inputs = buildValueFieldInputs(fieldDef, ctx, defaultProps(), defaultValidationMessages());
        // Add options property
        inputs['options'] = fieldDef.options;
        return inputs;
    });
}

/**
 * Maps a textarea field to component inputs.
 *
 * Extends the base value field mapper by adding textarea-specific properties:
 * - rows: Number of visible text rows
 * - cols: Number of visible text columns
 * - maxLength: Maximum character length (also used for validation)
 *
 * @param fieldDef The textarea field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
function textareaFieldMapper(fieldDef) {
    const ctx = resolveValueFieldContext();
    const defaultProps = inject(DEFAULT_PROPS);
    const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);
    return computed(() => {
        const inputs = buildValueFieldInputs(fieldDef, ctx, defaultProps(), defaultValidationMessages());
        // Add textarea-specific properties from props
        const props = fieldDef.props;
        if (props && typeof props === 'object') {
            if (props['rows'] !== undefined) {
                inputs['rows'] = props['rows'];
            }
            if (props['cols'] !== undefined) {
                inputs['cols'] = props['cols'];
            }
        }
        // maxLength is at field level for validation
        if (fieldDef.maxLength !== undefined) {
            inputs['maxLength'] = fieldDef.maxLength;
        }
        return inputs;
    });
}

/**
 * Maps a slider field to component inputs.
 *
 * Extends the base value field mapper by adding slider-specific properties:
 * - minValue: Minimum slider value
 * - maxValue: Maximum slider value
 * - step: Step increment for the slider
 *
 * @param fieldDef The slider field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
function sliderFieldMapper(fieldDef) {
    const ctx = resolveValueFieldContext();
    const defaultProps = inject(DEFAULT_PROPS);
    const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);
    return computed(() => {
        const inputs = buildValueFieldInputs(fieldDef, ctx, defaultProps(), defaultValidationMessages());
        // Add slider-specific properties (these are at field level, not in props)
        if (fieldDef.minValue !== undefined) {
            inputs['minValue'] = fieldDef.minValue;
        }
        if (fieldDef.maxValue !== undefined) {
            inputs['maxValue'] = fieldDef.maxValue;
        }
        if (fieldDef.step !== undefined) {
            inputs['step'] = fieldDef.step;
        }
        return inputs;
    });
}

/**
 * Applies hidden and disabled logic to a non-form-bound field.
 * Must be called inside a computed() context (reads form signals).
 */
function applyNonFieldLogic(rootFormRegistry, fieldDef) {
    const result = {};
    const rootForm = rootFormRegistry.rootForm();
    if (rootForm) {
        if (fieldDef.hidden !== undefined || fieldDef.logic?.some((l) => l.type === 'hidden')) {
            const hiddenSignal = resolveNonFieldHidden({
                form: rootForm,
                fieldLogic: fieldDef.logic,
                explicitValue: fieldDef.hidden,
            });
            result.hidden = hiddenSignal();
        }
        // Resolve disabled state if explicitly set or has logic
        if (fieldDef.disabled !== undefined || fieldDef.logic?.some((l) => l.type === 'disabled')) {
            // Create the signal and READ IT to establish reactive dependencies
            const disabledSignal = resolveNonFieldDisabled({
                form: rootForm,
                fieldLogic: fieldDef.logic,
                explicitValue: fieldDef.disabled,
            });
            result.disabled = disabledSignal();
        }
    }
    else {
        // Fallback to static values when rootForm is not available
        if (fieldDef.hidden !== undefined) {
            result.hidden = fieldDef.hidden;
        }
        if (fieldDef.disabled !== undefined) {
            result.disabled = fieldDef.disabled;
        }
    }
    return result;
}
/**
 * Applies hidden logic to a non-form-bound field.
 *
 * This is a focused utility for fields that only need hidden state resolution.
 * Use this when you need hidden logic but handle disabled separately
 * (e.g., navigation buttons with custom disabled logic).
 *
 * NOTE: This function must be called inside a computed() context.
 *
 * @param rootForm The root form FieldTree (can be undefined)
 * @param fieldDef The field definition with optional hidden/logic
 * @returns The resolved hidden boolean value, or undefined if no hidden logic
 */
function resolveHiddenValue(rootForm, fieldDef) {
    if (!rootForm) {
        return fieldDef.hidden;
    }
    if (fieldDef.hidden !== undefined || fieldDef.logic?.some((l) => l.type === 'hidden')) {
        return resolveNonFieldHidden({
            form: rootForm,
            fieldLogic: fieldDef.logic,
            explicitValue: fieldDef.hidden,
            // formValue omitted intentionally - resolver will read form.value() reactively
        })();
    }
    return undefined;
}

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
function buttonFieldMapper(fieldDef) {
    const defaultProps = inject(DEFAULT_PROPS);
    const rootFormRegistry = inject(RootFormRegistryService);
    return computed(() => {
        const inputs = buildBaseInputs(fieldDef, defaultProps());
        // Add button-specific properties
        inputs['event'] = fieldDef.event;
        if (fieldDef.eventArgs !== undefined) {
            inputs['eventArgs'] = fieldDef.eventArgs;
        }
        // Apply hidden/disabled logic
        return {
            ...inputs,
            ...applyNonFieldLogic(rootFormRegistry, fieldDef),
        };
    });
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
function resolveArrayButtonContext(fieldKey, buttonType, explicitArrayKey) {
    const arrayContext = inject(ARRAY_CONTEXT, { optional: true });
    const logger = inject(DynamicFormLogger);
    // Priority: explicit arrayKey from fieldDef > arrayKey from context
    const targetArrayKey = explicitArrayKey ?? arrayContext?.arrayKey;
    if (!targetArrayKey) {
        logger.warn(`${buttonType} button "${fieldKey}" has no array context. ` +
            'Either place it inside an array field, or provide an explicit arrayKey property.');
    }
    // Create index signal once at injection time - computed to track arrayContext.index changes
    const indexSignal = computed(() => {
        if (!arrayContext)
            return -1;
        return arrayContext.index();
    }, ...(ngDevMode ? [{ debugName: "indexSignal" }] : /* istanbul ignore next */ []));
    return {
        targetArrayKey,
        indexSignal,
        formValue: (arrayContext?.formValue ?? {}),
        isInsideArray: arrayContext !== null,
    };
}
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
function buildArrayButtonEventContext(fieldKey, ctx, template) {
    const eventContext = {
        key: fieldKey,
        index: ctx.indexSignal(), // Evaluated inside computed
        arrayKey: ctx.targetArrayKey ?? '',
        formValue: ctx.formValue,
    };
    if (template) {
        eventContext.template = template;
    }
    return eventContext;
}
/**
 * Resolves eventArgs with defaults for array buttons.
 *
 * @param fieldEventArgs The eventArgs from field definition (may be undefined)
 * @param defaultEventArgs The default eventArgs to use if not specified
 * @returns The resolved eventArgs array
 */
function resolveArrayButtonEventArgs(fieldEventArgs, defaultEventArgs = ['$arrayKey', '$template']) {
    return fieldEventArgs ?? defaultEventArgs;
}

// =============================================================================
// Add Array Item Mappers
// =============================================================================
/**
 * Mapper for add array item button — appends new item to end of array.
 * Template is REQUIRED to define the field structure for new items.
 */
function addArrayItemButtonMapper(fieldDef) {
    const defaultProps = inject(DEFAULT_PROPS);
    const rootFormRegistry = inject(RootFormRegistryService);
    const ctx = resolveArrayButtonContext(fieldDef.key, 'addArrayItem', fieldDef.arrayKey);
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps?.());
        return {
            ...baseInputs,
            event: AppendArrayItemEvent,
            eventArgs: resolveArrayButtonEventArgs(fieldDef.eventArgs, ['$arrayKey', '$template']),
            eventContext: buildArrayButtonEventContext(fieldDef.key, ctx, fieldDef.template),
            ...applyNonFieldLogic(rootFormRegistry, fieldDef),
        };
    });
}
/**
 * Mapper for prepend array item button — inserts new item at beginning of array.
 * Template is REQUIRED to define the field structure for new items.
 */
function prependArrayItemButtonMapper(fieldDef) {
    const defaultProps = inject(DEFAULT_PROPS);
    const rootFormRegistry = inject(RootFormRegistryService);
    const ctx = resolveArrayButtonContext(fieldDef.key, 'prependArrayItem', fieldDef.arrayKey);
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps?.());
        return {
            ...baseInputs,
            event: PrependArrayItemEvent,
            eventArgs: resolveArrayButtonEventArgs(fieldDef.eventArgs, ['$arrayKey', '$template']),
            eventContext: buildArrayButtonEventContext(fieldDef.key, ctx, fieldDef.template),
            ...applyNonFieldLogic(rootFormRegistry, fieldDef),
        };
    });
}
/**
 * Mapper for insert array item button — inserts new item at specific index.
 * Template and index are REQUIRED.
 */
function insertArrayItemButtonMapper(fieldDef) {
    const defaultProps = inject(DEFAULT_PROPS);
    const rootFormRegistry = inject(RootFormRegistryService);
    const ctx = resolveArrayButtonContext(fieldDef.key, 'insertArrayItem', fieldDef.arrayKey);
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps?.());
        return {
            ...baseInputs,
            event: InsertArrayItemEvent,
            eventArgs: resolveArrayButtonEventArgs(fieldDef.eventArgs, ['$arrayKey', fieldDef.index, '$template']),
            eventContext: buildArrayButtonEventContext(fieldDef.key, ctx, fieldDef.template),
            ...applyNonFieldLogic(rootFormRegistry, fieldDef),
        };
    });
}
// =============================================================================
// Remove Array Item Mappers
// =============================================================================
/**
 * Mapper for remove array item button.
 * Inside array: RemoveAtIndexEvent. Outside array: PopArrayItemEvent.
 */
function removeArrayItemButtonMapper(fieldDef) {
    const defaultProps = inject(DEFAULT_PROPS);
    const rootFormRegistry = inject(RootFormRegistryService);
    const ctx = resolveArrayButtonContext(fieldDef.key, 'removeArrayItem', fieldDef.arrayKey);
    // Choose event type based on context:
    // - Inside array: RemoveAtIndexEvent (remove specific item)
    // - Outside array: PopArrayItemEvent (remove last item)
    const eventType = ctx.isInsideArray ? RemoveAtIndexEvent : PopArrayItemEvent;
    const defaultEventArgs = ctx.isInsideArray ? ['$arrayKey', '$index'] : ['$arrayKey'];
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps?.());
        return {
            ...baseInputs,
            event: eventType,
            eventArgs: resolveArrayButtonEventArgs(fieldDef.eventArgs, defaultEventArgs),
            eventContext: buildArrayButtonEventContext(fieldDef.key, ctx),
            ...applyNonFieldLogic(rootFormRegistry, fieldDef),
        };
    });
}
/** Mapper for pop array item button — removes the last item from array. */
function popArrayItemButtonMapper(fieldDef) {
    const defaultProps = inject(DEFAULT_PROPS);
    const rootFormRegistry = inject(RootFormRegistryService);
    const ctx = resolveArrayButtonContext(fieldDef.key, 'popArrayItem', fieldDef.arrayKey);
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps?.());
        return {
            ...baseInputs,
            event: PopArrayItemEvent,
            eventArgs: resolveArrayButtonEventArgs(fieldDef.eventArgs, ['$arrayKey']),
            eventContext: buildArrayButtonEventContext(fieldDef.key, ctx),
            ...applyNonFieldLogic(rootFormRegistry, fieldDef),
        };
    });
}
/** Mapper for shift array item button — removes the first item from array. */
function shiftArrayItemButtonMapper(fieldDef) {
    const defaultProps = inject(DEFAULT_PROPS);
    const rootFormRegistry = inject(RootFormRegistryService);
    const ctx = resolveArrayButtonContext(fieldDef.key, 'shiftArrayItem', fieldDef.arrayKey);
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps?.());
        return {
            ...baseInputs,
            event: ShiftArrayItemEvent,
            eventArgs: resolveArrayButtonEventArgs(fieldDef.eventArgs, ['$arrayKey']),
            eventContext: buildArrayButtonEventContext(fieldDef.key, ctx),
            ...applyNonFieldLogic(rootFormRegistry, fieldDef),
        };
    });
}

// =============================================================================
// Submit Button Mapper
// =============================================================================
/**
 * Mapper for submit button — configures native form submission via type="submit".
 * Triggers native form submission rather than dispatching events directly.
 */
function submitButtonFieldMapper(fieldDef) {
    const rootFormRegistry = inject(RootFormRegistryService);
    const defaultProps = inject(DEFAULT_PROPS);
    const formOptions = inject(FORM_OPTIONS);
    const fieldWithLogic = fieldDef;
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps());
        const rootForm = rootFormRegistry.rootForm();
        // Use rootForm (not fieldSignalContext.form) — submit needs root form validity (#157)
        const disabled = resolveSubmitButtonDisabled({
            form: rootForm,
            formOptions: formOptions(),
            fieldLogic: fieldWithLogic.logic,
            explicitlyDisabled: fieldDef.disabled,
        })();
        const inputs = {
            ...baseInputs,
            // type="submit" triggers native form submission (no event dispatch needed)
            props: { ...fieldDef.props, type: 'submit' },
            disabled,
        };
        const hidden = resolveHiddenValue(rootForm, fieldWithLogic);
        if (hidden !== undefined) {
            inputs['hidden'] = hidden;
        }
        return inputs;
    });
}
// =============================================================================
// Next Page Button Mapper
// =============================================================================
/** Mapper for next page button — preconfigures NextPageEvent. */
function nextButtonFieldMapper(fieldDef) {
    const fieldSignalContext = inject(FIELD_SIGNAL_CONTEXT);
    const rootFormRegistry = inject(RootFormRegistryService);
    const defaultProps = inject(DEFAULT_PROPS);
    const formOptions = inject(FORM_OPTIONS);
    const fieldWithLogic = fieldDef;
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps());
        const rootForm = rootFormRegistry.rootForm();
        const disabled = resolveNextButtonDisabled({
            form: fieldSignalContext.form,
            formOptions: formOptions(),
            fieldLogic: fieldWithLogic.logic,
            currentPageValid: fieldSignalContext.currentPageValid,
        })();
        const inputs = {
            ...baseInputs,
            event: NextPageEvent,
            disabled,
        };
        const hidden = resolveHiddenValue(rootForm, fieldWithLogic);
        if (hidden !== undefined) {
            inputs['hidden'] = hidden;
        }
        return inputs;
    });
}
// =============================================================================
// Previous Page Button Mapper
// =============================================================================
/** Mapper for previous page button — preconfigures PreviousPageEvent. */
function previousButtonFieldMapper(fieldDef) {
    const defaultProps = inject(DEFAULT_PROPS);
    const rootFormRegistry = inject(RootFormRegistryService);
    const fieldWithLogic = fieldDef;
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps());
        const rootForm = rootFormRegistry.rootForm();
        const inputs = {
            ...baseInputs,
            event: PreviousPageEvent,
        };
        // Add disabled binding only if explicitly set by user
        if (fieldDef.disabled !== undefined) {
            inputs['disabled'] = fieldDef.disabled;
        }
        const hidden = resolveHiddenValue(rootForm, fieldWithLogic);
        if (hidden !== undefined) {
            inputs['hidden'] = hidden;
        }
        return inputs;
    });
}

// Button field mapper (generic)

// UI-specific field mappers

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
function createResolvedErrorsSignal(field, validationMessages, defaultValidationMessages = signal(undefined), injector = inject(Injector)) {
    // Get logger from injector
    const logger = injector.get(DynamicFormLogger);
    // Ensure validationMessages is never undefined (mappers pass {} if not defined)
    const messages = computed(() => validationMessages() ?? {}, ...(ngDevMode ? [{ debugName: "messages" }] : /* istanbul ignore next */ []));
    const defaultMessages = computed(() => defaultValidationMessages() ?? {}, ...(ngDevMode ? [{ debugName: "defaultMessages" }] : /* istanbul ignore next */ []));
    // Create a computed signal that reads the actual errors from the field
    // This ensures the signal tracks changes to field().errors(), not just the field reference
    const errors = computed(() => {
        const control = field()();
        return control.errors();
    }, ...(ngDevMode ? [{ debugName: "errors" }] : /* istanbul ignore next */ []));
    // Convert signals to observables using toObservable with injector
    const errors$ = toObservable(errors, { injector });
    const messages$ = toObservable(messages, { injector });
    const defaultMessages$ = toObservable(defaultMessages, { injector });
    // Combine observables and process errors
    const resolvedErrors$ = combineLatest([errors$, messages$, defaultMessages$]).pipe(switchMap(([currentErrors, msgs, defaultMsgs]) => {
        // No errors - return empty array
        if (!currentErrors || currentErrors.length === 0) {
            return of([]);
        }
        // Create observable for each error's resolved message
        const errorResolvers = currentErrors.map((error) => resolveErrorMessage(error, msgs, defaultMsgs, injector, logger));
        // Combine all error message observables into single array emission, filtering out nulls
        return errorResolvers.length > 0
            ? combineLatest(errorResolvers).pipe(map((errors) => errors.filter((e) => e !== null)))
            : of([]);
    }));
    // Convert observable back to signal using toSignal with injector
    // toSignal properly handles the injection context and manages subscriptions
    return toSignal(resolvedErrors$, { initialValue: [], injector });
}
/**
 * Resolves a single error message from DynamicText sources with fallback logic
 * Priority: field-level message → default message → error.message → no message (logs warning)
 *
 * The error.message fallback enables schema validation libraries (Zod, Valibot, etc.)
 * to provide their own messages without requiring explicit validationMessages configuration.
 * Users who want translations can still override by configuring validationMessages.
 *
 * @internal
 */
function resolveErrorMessage(error, fieldMessages, defaultMessages, injector, logger) {
    // Check for field-level custom message first
    const fieldMessage = fieldMessages[error.kind];
    // Fall back to default message if no field-level message exists
    const defaultMessage = defaultMessages[error.kind];
    // Determine which message to use: field-level → default → error.message (from schema validators)
    const messageToUse = fieldMessage ?? defaultMessage ?? error.message;
    // If no message found, log warning and return null (will be filtered out)
    if (!messageToUse) {
        logger.warn(`No validation message found for error kind "${error.kind}". ` +
            `Please provide a message via field-level validationMessages or form-level defaultValidationMessages.`);
        return of(null);
    }
    // If using error.message directly (from schema validators), wrap in of() instead of dynamicTextToObservable
    // error.message is always a plain string, not DynamicText
    const isSchemaMessage = fieldMessage === undefined && defaultMessage === undefined;
    const messageObservable = isSchemaMessage
        ? of(messageToUse) // error.message is always string
        : dynamicTextToObservable(messageToUse, injector);
    // Apply parameter interpolation to support {{param}} syntax
    return messageObservable.pipe(map((msg) => ({
        kind: error.kind,
        message: interpolateParams(msg, error),
    })));
}

/**
 * Computed signal that determines if errors should be displayed.
 * Based on field's invalid, touched, and error count.
 *
 * @param field - Signal containing FieldTree
 * @returns Signal<boolean> - True if errors should be displayed
 */
function shouldShowErrors(field) {
    return computed(() => {
        const fieldTree = field();
        const control = fieldTree();
        return control.invalid() && control.touched() && control.errors().length > 0;
    });
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
function setupMetaTracking(elementRef, meta, options) {
    let appliedAttributes = new Set();
    let previousMeta;
    let previousDeps;
    afterRenderEffect({
        write: () => {
            // Read dependents to establish signal tracking and collect their values
            const currentDeps = options?.dependents?.map((dep) => dep());
            const currentMeta = meta();
            const hostElement = elementRef.nativeElement;
            // Early exit if nothing changed (using deep equality for meta)
            const metaChanged = !isEqual(currentMeta, previousMeta);
            const depsChanged = !previousDeps || currentDeps?.length !== previousDeps.length || currentDeps?.some((d, i) => d !== previousDeps[i]);
            if (!metaChanged && !depsChanged) {
                return;
            }
            previousMeta = currentMeta;
            previousDeps = currentDeps;
            if (options?.selector) {
                // Apply to elements matching selector
                const elements = hostElement.querySelectorAll(options.selector);
                const allApplied = new Set();
                elements.forEach((el) => {
                    const applied = applyMetaToElement(el, currentMeta, appliedAttributes);
                    applied.forEach((attr) => allApplied.add(attr));
                });
                appliedAttributes = allApplied;
            }
            else {
                // Apply to host element (for Shadow DOM components)
                appliedAttributes = applyMetaToElement(hostElement, currentMeta, appliedAttributes);
            }
        },
    });
}

// Error display utilities for field components

/**
 * @ng-forge/dynamic-forms/integration
 *
 * Integration API for UI library authors building field implementations
 * (Material, Bootstrap, PrimeNG, Ionic, etc.)
 *
 * This entrypoint provides:
 * - Specific field type definitions (InputField, SelectField, etc.)
 * - Field mappers for creating FieldTypeDefinition
 * - Error display utilities for field components
 */
// =============================================================================
// Field Mappers
// =============================================================================

/**
 * Generated bundle index. Do not edit.
 */

export { addArrayItemButtonMapper, buildArrayButtonEventContext, buildValueFieldInputs, buttonFieldMapper, checkboxFieldMapper, createResolvedErrorsSignal, datepickerFieldMapper, insertArrayItemButtonMapper, nextButtonFieldMapper, optionsFieldMapper, popArrayItemButtonMapper, prependArrayItemButtonMapper, previousButtonFieldMapper, removeArrayItemButtonMapper, resolveArrayButtonContext, resolveArrayButtonEventArgs, resolveValueFieldContext, setupMetaTracking, shiftArrayItemButtonMapper, shouldShowErrors, submitButtonFieldMapper, valueFieldMapper };
//# sourceMappingURL=ng-forge-dynamic-forms-integration.mjs.map
