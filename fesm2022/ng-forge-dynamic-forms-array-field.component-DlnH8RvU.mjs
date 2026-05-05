import * as i0 from '@angular/core';
import { computed, runInInjectionContext, Injector, linkedSignal, inject, DestroyRef, EnvironmentInjector, input, signal, ChangeDetectionStrategy, Component } from '@angular/core';
import { R as RootFormRegistryService, g as isEqual, m as mapFieldToInputs, F as FIELD_SIGNAL_CONTEXT, A as ARRAY_CONTEXT, j as createRenderReadySignal, D as DynamicFormLogger, i as injectFieldRegistry, E as EventBus, k as ARRAY_TEMPLATE_REGISTRY, l as ARRAY_ITEM_ID_GENERATOR, n as getNormalizedArrayMetadata, o as getFieldValueHandling, p as getFieldDefaultValue, q as isGroupField, f as DfFieldOutlet, s as createArrayItemIdGenerator } from './ng-forge-dynamic-forms-ng-forge-dynamic-forms-BaV56Adz.mjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, from, map, catchError, forkJoin, filter, firstValueFrom, tap } from 'rxjs';
import { explicitEffect } from 'ngxtension/explicit-effect';
import { e as emitComponentInitialized } from './ng-forge-dynamic-forms-emit-initialization-ulrSEvoG.mjs';

/**
 * Safely extracts an array value from a model object.
 * Returns empty array if the key doesn't exist or value isn't an array.
 */
function getArrayValue(value, key) {
    const arrayValue = value?.[key];
    return Array.isArray(arrayValue) ? arrayValue : [];
}
/**
 * Determines the optimal differential update operation based on current and new state.
 *
 * Operations:
 * - Clear all (empty array)
 * - Initial render (no existing items)
 * - Append only (items added at end)
 * - Recreate (items removed - we can't know which items, so recreate all)
 * - None (same length - items update via linkedSignal)
 *
 * Note: We always use 'recreate' for removals because we can't determine which
 * specific items were removed. Operations like shift, removeAtIndex remove from
 * the middle, not just the end. Each array item has its own local form that
 * doesn't reactively track parent changes, so we must recreate to get correct values.
 */
function determineDifferentialOperation(currentItems, newLength) {
    const currentLength = currentItems.length;
    if (newLength === 0) {
        return { type: 'clear' };
    }
    if (currentLength === 0) {
        return { type: 'initial', fieldTreesLength: newLength };
    }
    // For all length changes, we optimize by assuming existing items stay in place.
    // Items handle their own value updates via linkedSignal - no need to compare snapshots.
    // Snapshot comparison was causing false "recreate" when existing items had been edited.
    if (newLength > currentLength) {
        // Items added - append new ones, existing items stay
        return { type: 'append', startIndex: currentLength, endIndex: newLength };
    }
    if (newLength < currentLength) {
        // Items removed - must recreate because we don't know which items were removed.
        // shift() removes from index 0, removeAtIndex() removes from any position.
        // Each item's local form is initialized with its value at creation time and
        // doesn't reactively track parent array changes.
        return { type: 'recreate' };
    }
    // Same length - no structural change, items update via linkedSignal
    return { type: 'none' };
}

/**
 * Creates an injector and inputs for an array item.
 *
 * Uses direct root form binding - components bind directly to the root form's
 * FieldTree for array items (rootForm['arrayKey'][index]). This architecture:
 *
 * - Eliminates the need for local forms and bidirectional sync
 * - Allows Zod/StandardSchema validation errors to flow naturally to components
 * - Reduces complexity by having a single source of truth (the root form)
 *
 * The FieldSignalContext.form property uses a getter that evaluates a computed
 * signal, making form access reactive to index changes (when items reorder,
 * the component points to the correct array position).
 */
function createArrayItemInjectorAndInputs(options) {
    const { template, indexSignal, parentFieldSignalContext, parentInjector, registry, arrayField, primitiveFieldKey } = options;
    // Get root form registry - it's guaranteed to be available since root form
    // is registered before resolvedFields computes (dependency chain ensures this)
    const rootFormRegistry = parentInjector.get(RootFormRegistryService);
    // Create a computed that derives the array item's FieldTree from root form.
    // Uses isEqual to prevent unnecessary re-computation when index changes but value is same.
    const itemFormAccessor = computed(() => {
        const rootForm = rootFormRegistry.rootForm();
        if (!rootForm) {
            return undefined;
        }
        const index = indexSignal();
        // Navigate: rootForm['arrayKey'][index]
        const arrayFieldTree = rootForm[arrayField.key];
        if (!arrayFieldTree) {
            return undefined;
        }
        return arrayFieldTree[index];
    }, { ...(ngDevMode ? { debugName: "itemFormAccessor" } : /* istanbul ignore next */ {}), equal: isEqual });
    const injector = createItemInjector({
        itemFormAccessor,
        indexSignal,
        parentFieldSignalContext,
        parentInjector,
        arrayField,
        primitiveFieldKey,
    });
    // mapFieldToInputs automatically reads ARRAY_CONTEXT from the injector
    // and applies the index suffix to keys for unique DOM IDs
    const inputs = runInInjectionContext(injector, () => {
        return mapFieldToInputs(template, registry);
    });
    return { injector, inputs };
}
/**
 * Creates a scoped injector for an array item.
 * Provides both FIELD_SIGNAL_CONTEXT (for form access) and ARRAY_CONTEXT (for position awareness).
 *
 * The FIELD_SIGNAL_CONTEXT.form uses a getter that evaluates itemFormAccessor() on access.
 * This makes form access reactive - when mappers access context.form['fieldKey'], the getter runs,
 * evaluating the computed which tracks indexSignal as a dependency. This ensures components
 * automatically update when array items reorder.
 *
 * Uses `useFactory` with `deps: [Injector]` to provide FIELD_SIGNAL_CONTEXT. Angular resolves
 * the `Injector` dep as the child injector being created, eliminating any temporal gap.
 */
function createItemInjector(options) {
    const { itemFormAccessor, indexSignal, parentFieldSignalContext, parentInjector, arrayField, primitiveFieldKey } = options;
    // Use getter for formValue to ensure it's always current, not a stale snapshot.
    // Components accessing arrayContext.formValue will get the current value.
    const arrayContext = {
        arrayKey: arrayField.key,
        index: indexSignal,
        get formValue() {
            return parentFieldSignalContext.value();
        },
        field: arrayField,
    };
    // Cache for the primitive wrapper object — avoids creating a new { [primitiveFieldKey]: raw }
    // on every form getter access, which would defeat reference-equality checks downstream.
    let cachedPrimitiveRaw;
    let cachedPrimitiveWrapped;
    return Injector.create({
        parent: parentInjector,
        providers: [
            {
                provide: FIELD_SIGNAL_CONTEXT,
                // Angular resolves `Injector` in deps as the child injector being created,
                // so no temporal gap exists — the injector reference is immediately available.
                useFactory: (injector) => ({
                    injector,
                    value: parentFieldSignalContext.value,
                    // Array items don't propagate parent default values because each item's defaults
                    // are determined by its template fields at creation time (via getFieldDefaultValue).
                    // The parent's defaultValues contain top-level form defaults, not per-item defaults.
                    defaultValues: () => ({}),
                    get form() {
                        const raw = itemFormAccessor();
                        if (!raw) {
                            // During initialization or transitions, the FieldTree may not be available yet.
                            // This occurs in the window between item creation and Angular's form tree construction.
                            // Return an empty object so that downstream getFieldTree(key) calls return undefined
                            // rather than causing a runtime error on a truly undefined value.
                            return {};
                        }
                        // For primitive array items, the FieldTree is a FormControl (the item IS the control).
                        // Wrap it in an object so getFieldTree(primitiveFieldKey) returns the FormControl itself.
                        // Without this, getFieldTree('value') would access FormControl['value'] (the WritableSignal),
                        // not a child FieldTree, causing NG0950 errors.
                        if (primitiveFieldKey) {
                            // Cache the wrapper to preserve reference identity when raw hasn't changed
                            if (raw !== cachedPrimitiveRaw) {
                                cachedPrimitiveRaw = raw;
                                cachedPrimitiveWrapped = { [primitiveFieldKey]: raw };
                            }
                            return cachedPrimitiveWrapped;
                        }
                        return raw;
                    },
                }),
                deps: [Injector],
            },
            { provide: ARRAY_CONTEXT, useValue: arrayContext },
        ],
    });
}

/**
 * Resolves a single array item with all its fields for declarative rendering.
 *
 * Uses linkedSignal for the index, which automatically updates when itemOrderSignal changes.
 * This enables position-aware updates without recreating components when items are reordered.
 * Supports multiple sibling templates (e.g., name + email without a wrapper).
 */
function resolveArrayItem(options) {
    const { index, templates, arrayField, itemPositionMap, parentFieldSignalContext, parentInjector, registry, destroyRef, loadTypeComponent, generateItemId, primitiveFieldKey, } = options;
    if (templates.length === 0) {
        return of(undefined);
    }
    // Generate ONE id for this array item (shared by all fields for tracking)
    const itemId = generateItemId();
    // O(1) position lookup via Map instead of O(n) indexOf()
    const indexSignal = linkedSignal(() => {
        const positionMap = itemPositionMap();
        return positionMap.get(itemId) ?? index;
    }, ...(ngDevMode ? [{ debugName: "indexSignal" }] : /* istanbul ignore next */ []));
    // Resolve all templates in parallel
    const fieldObservables = templates.map((template) => from(loadTypeComponent(template.type)).pipe(map((component) => {
        if (destroyRef.destroyed) {
            return undefined;
        }
        // Componentless fields (e.g., hidden) return undefined - nothing to render
        if (!component) {
            return undefined;
        }
        const { injector, inputs } = createArrayItemInjectorAndInputs({
            template,
            indexSignal,
            parentFieldSignalContext,
            parentInjector,
            registry,
            arrayField,
            primitiveFieldKey,
        });
        // Array item templates should always have inputs (componentless fields are handled above)
        if (!inputs) {
            return undefined;
        }
        return {
            key: template.key,
            fieldDef: template,
            component,
            injector,
            inputs,
            renderReady: createRenderReadySignal(inputs, registry.get(template.type)),
        };
    }), catchError((error) => {
        if (!destroyRef.destroyed) {
            const logger = parentInjector.get(DynamicFormLogger);
            logger.error(`Failed to load component for field type '${template.type}' at index ${index} ` +
                `within array '${arrayField.key}'. Ensure the field type is registered in your field registry.`, error);
        }
        return of(undefined);
    })));
    return forkJoin(fieldObservables).pipe(map((fields) => {
        const validFields = fields.filter((f) => f !== undefined);
        // If no fields resolved, return undefined
        if (validFields.length === 0) {
            return undefined;
        }
        return {
            id: itemId,
            fields: validFields,
        };
    }));
}

/**
 * All array event type discriminants.
 */
const ARRAY_EVENT_TYPES = [
    'append-array-item',
    'prepend-array-item',
    'insert-array-item',
    'move-array-item',
    'pop-array-item',
    'shift-array-item',
    'remove-at-index',
];
/**
 * Converts an array event to a normalized action.
 * Uses a switch for full type safety with discriminated union narrowing.
 */
function toArrayAction(event) {
    switch (event.type) {
        case 'append-array-item':
            return { action: 'add', template: event.template };
        case 'prepend-array-item':
            return { action: 'add', template: event.template, index: 0 };
        case 'insert-array-item':
            return { action: 'add', template: event.template, index: event.index };
        case 'move-array-item':
            return { action: 'move', fromIndex: event.fromIndex, toIndex: event.toIndex };
        case 'pop-array-item':
            return { action: 'remove' };
        case 'shift-array-item':
            return { action: 'remove', index: 0 };
        case 'remove-at-index':
            return { action: 'remove', index: event.index };
    }
}
/**
 * Creates an observable stream of normalized array actions for a specific array key.
 *
 * @param eventBus - The event bus to subscribe to
 * @param arrayKey - Function returning the array key to filter events for
 * @returns Observable of normalized ArrayAction objects
 *
 * @example
 * ```typescript
 * observeArrayActions(this.eventBus, () => this.key())
 *   .pipe(takeUntilDestroyed())
 *   .subscribe(action => {
 *     if (action.action === 'add') {
 *       this.addItem(action.template, action.index);
 *     } else {
 *       this.removeItem(action.index);
 *     }
 *   });
 * ```
 */
function observeArrayActions(eventBus, arrayKey) {
    return eventBus.on(ARRAY_EVENT_TYPES).pipe(filter((event) => event.arrayKey === arrayKey()), map(toArrayAction));
}

/**
 * Container component for rendering dynamic arrays of fields.
 *
 * Supports add/remove/move operations via the arrayEvent() builder API.
 * Uses differential updates to optimize rendering - only recreates items when necessary.
 * Each item gets a scoped injector with ARRAY_CONTEXT for position-aware operations.
 * Supports multiple sibling fields per array item (e.g., name + email without a wrapper).
 */
class ArrayFieldComponent {
    // ─────────────────────────────────────────────────────────────────────────────
    // Dependencies
    // ─────────────────────────────────────────────────────────────────────────────
    destroyRef = inject(DestroyRef);
    fieldRegistry = injectFieldRegistry();
    parentFieldSignalContext = inject(FIELD_SIGNAL_CONTEXT);
    parentInjector = inject(Injector);
    environmentInjector = inject(EnvironmentInjector);
    eventBus = inject(EventBus);
    logger = inject(DynamicFormLogger);
    templateRegistry = inject(ARRAY_TEMPLATE_REGISTRY);
    generateItemId = inject(ARRAY_ITEM_ID_GENERATOR);
    // ─────────────────────────────────────────────────────────────────────────────
    // Inputs
    // ─────────────────────────────────────────────────────────────────────────────
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    className = input(...(ngDevMode ? [undefined, { debugName: "className" }] : /* istanbul ignore next */ []));
    hidden = input(false, ...(ngDevMode ? [{ debugName: "hidden" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Computed Signals
    // ─────────────────────────────────────────────────────────────────────────────
    hostClasses = computed(() => {
        const base = 'df-field df-array';
        const custom = this.className();
        return custom ? `${base} ${custom}` : base;
    }, ...(ngDevMode ? [{ debugName: "hostClasses" }] : /* istanbul ignore next */ []));
    rawFieldRegistry = computed(() => this.fieldRegistry.raw, ...(ngDevMode ? [{ debugName: "rawFieldRegistry" }] : /* istanbul ignore next */ []));
    /**
     * Gets the auto-remove button FieldDef from normalization metadata.
     * Set by simplified array normalization for primitive arrays with remove buttons.
     * The button is rendered alongside each item without wrapping in a row,
     * preserving flat primitive form values.
     */
    autoRemoveButton = computed(() => {
        const metadata = getNormalizedArrayMetadata(this.field());
        return metadata?.autoRemoveButton;
    }, ...(ngDevMode ? [{ debugName: "autoRemoveButton" }] : /* istanbul ignore next */ []));
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
    primitiveFieldKey = linkedSignal(() => {
        // Priority 1: Normalization metadata (simplified arrays always have this)
        const metadata = getNormalizedArrayMetadata(this.field());
        if (metadata?.primitiveFieldKey) {
            return metadata.primitiveFieldKey;
        }
        // Priority 2: Existing item definitions (full-API arrays with initial items)
        const definitions = this.field().fields || [];
        if (definitions.length > 0 && !Array.isArray(definitions[0])) {
            return definitions[0].key;
        }
        return undefined;
    }, ...(ngDevMode ? [{ debugName: "primitiveFieldKey" }] : /* istanbul ignore next */ []));
    /**
     * Normalized item templates WITHOUT auto-remove button appended.
     * Each element is normalized to an array: single FieldDef → [FieldDef], array stays as-is.
     *
     * Used by moveItem() to stash raw templates into the templateRegistry, preserving
     * the invariant that registry entries are pre-synthesis (withAutoRemove() adds the
     * button during resolution).
     */
    rawItemTemplates = computed(() => {
        const arrayField = this.field();
        const definitions = arrayField.fields || [];
        return definitions.map((def) => {
            return (Array.isArray(def) ? def : [def]);
        });
    }, ...(ngDevMode ? [{ debugName: "rawItemTemplates" }] : /* istanbul ignore next */ []));
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
    fallbackTemplate = computed(() => {
        const raw = getNormalizedArrayMetadata(this.field())?.template;
        if (!raw)
            return undefined;
        return (Array.isArray(raw) ? [...raw] : [raw]);
    }, ...(ngDevMode ? [{ debugName: "fallbackTemplate" }] : /* istanbul ignore next */ []));
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
    itemTemplates = computed(() => {
        const raw = this.rawItemTemplates();
        const removeButton = this.autoRemoveButton();
        if (!removeButton)
            return raw;
        return raw.map((normalized) => {
            return [...normalized, removeButton];
        });
    }, ...(ngDevMode ? [{ debugName: "itemTemplates" }] : /* istanbul ignore next */ []));
    arrayFieldTrees = computed(() => {
        const arrayKey = this.field().key;
        const parentForm = this.parentFieldSignalContext.form;
        const arrayValue = getArrayValue(this.parentFieldSignalContext.value(), arrayKey);
        if (arrayValue.length === 0)
            return [];
        const arrayFieldTree = parentForm[arrayKey];
        if (!arrayFieldTree)
            return arrayValue.map(() => null);
        // Access array items via bracket notation - Angular Signal Forms arrays support this
        const items = [];
        for (let i = 0; i < arrayValue.length; i++) {
            // Access item FieldTree directly via numeric indexing (ArrayFieldTree supports this)
            const itemFieldTree = arrayFieldTree[i];
            items.push(itemFieldTree ?? null);
        }
        return items;
    }, ...(ngDevMode ? [{ debugName: "arrayFieldTrees" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // State Signals
    // ─────────────────────────────────────────────────────────────────────────────
    resolvedItemsSignal = signal([], ...(ngDevMode ? [{ debugName: "resolvedItemsSignal" }] : /* istanbul ignore next */ []));
    updateVersion = signal(0, ...(ngDevMode ? [{ debugName: "updateVersion" }] : /* istanbul ignore next */ []));
    pendingInitializationCycle = signal(null, ...(ngDevMode ? [{ debugName: "pendingInitializationCycle" }] : /* istanbul ignore next */ []));
    settledInitializationCycle = signal(null, ...(ngDevMode ? [{ debugName: "settledInitializationCycle" }] : /* istanbul ignore next */ []));
    /**
     * Map of item IDs to their current positions. O(1) lookup vs O(n) indexOf().
     * Used by child linkedSignals to reactively track their position in the array.
     */
    itemPositionMap = computed(() => {
        const items = this.resolvedItemsSignal();
        return new Map(items.map((item, idx) => [item.id, idx]));
    }, ...(ngDevMode ? [{ debugName: "itemPositionMap" }] : /* istanbul ignore next */ []));
    /** Read-only view of resolved items for template consumption. */
    resolvedItems = computed(() => this.resolvedItemsSignal(), ...(ngDevMode ? [{ debugName: "resolvedItems" }] : /* istanbul ignore next */ []));
    allResolvedFieldsRenderReady = computed(() => this.resolvedItems().every((item) => item.fields.every((field) => field.renderReady())), ...(ngDevMode ? [{ debugName: "allResolvedFieldsRenderReady" }] : /* istanbul ignore next */ []));
    /**
     * Whether the array has reached its configured maxLength.
     * Exposed as a public signal so add-button components can bind [disabled]="atMaxLength()".
     */
    atMaxLength = computed(() => {
        const maxLength = this.field().maxLength;
        if (maxLength === undefined)
            return false;
        const arrayKey = this.field().key;
        const currentArray = getArrayValue(this.parentFieldSignalContext.value(), arrayKey);
        return currentArray.length >= maxLength;
    }, ...(ngDevMode ? [{ debugName: "atMaxLength" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Auto-remove Cache
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Caches the result of appending the auto-remove button to template arrays.
     * Keyed by template array reference — cache hits occur during recreate/resolution
     * operations where stored template references are reused. Add operations via
     * handleAddFromEvent always create a fresh `[...template]` copy (line ~277),
     * so each add is a cache miss by design (the spread is needed for mutability).
     */
    autoRemoveCache = new WeakMap();
    // ─────────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────────
    constructor() {
        this.setupEffects();
        this.setupEventHandlers();
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Private Methods
    // ─────────────────────────────────────────────────────────────────────────────
    setupEffects() {
        // Sync field components when array data changes
        explicitEffect([this.arrayFieldTrees], ([fieldTrees]) => {
            this.performDifferentialUpdate(fieldTrees);
        });
        explicitEffect([this.pendingInitializationCycle, this.settledInitializationCycle, this.allResolvedFieldsRenderReady], ([pending, settled, allReady]) => {
            if (pending !== null && settled === pending && allReady) {
                emitComponentInitialized(this.eventBus, 'array', this.field().key, this.parentInjector);
                this.pendingInitializationCycle.set(null);
            }
        });
    }
    setupEventHandlers() {
        observeArrayActions(this.eventBus, () => this.key())
            .pipe(takeUntilDestroyed())
            .subscribe((action) => {
            if (action.action === 'add') {
                // Template can be single FieldDef (primitive) or FieldDef[] (object)
                const templates = Array.isArray(action.template) ? action.template : action.template ? [action.template] : [];
                if (templates.length === 0) {
                    this.logger.error(`Cannot add item to array '${this.key()}': template is REQUIRED. ` +
                        'Buttons must specify an explicit template property. ' +
                        'There is no default template - each add operation must provide its own.');
                    return;
                }
                void this.handleAddFromEvent(action.template, action.index);
            }
            else if (action.action === 'move') {
                this.moveItem(action.fromIndex, action.toIndex);
            }
            else {
                this.removeItem(action.index);
            }
        });
    }
    /**
     * Handles add operations from events (append, prepend, insert).
     * Creates resolved items FIRST, then updates form value.
     * This ensures prepend/insert work correctly - differential update sees "none"
     * because resolved items count already matches the new array length.
     *
     * Supports both primitive (single FieldDef) and object (FieldDef[]) templates.
     */
    async handleAddFromEvent(template, index) {
        // Normalize template to mutable array for consistent handling.
        // A single FieldDef with valueHandling: 'flatten' (container, row) is an object item
        // whose children should be flattened — NOT a primitive item. Only true leaf fields
        // (input, checkbox, etc.) are primitive when passed as a single FieldDef.
        const templates = Array.isArray(template) ? [...template] : [template];
        const isSingleField = !Array.isArray(template);
        const isPrimitiveItem = isSingleField && getFieldValueHandling(templates[0].type, this.rawFieldRegistry()) !== 'flatten';
        // Track primitive field key for full-API arrays that start empty.
        // Simplified arrays already have this info from normalization metadata.
        if (isPrimitiveItem && templates[0].key && !this.primitiveFieldKey()) {
            this.primitiveFieldKey.set(templates[0].key);
        }
        if (templates.length === 0) {
            this.logger.error(`Cannot add item to array '${this.field().key}': no field templates provided. ` +
                'Buttons must specify an explicit template property when adding array items.');
            return;
        }
        const arrayKey = this.field().key;
        const parentForm = this.parentFieldSignalContext.form;
        const currentValue = parentForm().value();
        const currentArray = getArrayValue(currentValue, arrayKey);
        const insertIndex = index !== undefined ? Math.min(index, currentArray.length) : currentArray.length;
        // Compute default value
        let value;
        if (isPrimitiveItem) {
            // Primitive item: single field's value is extracted directly
            value = getFieldDefaultValue(templates[0], this.rawFieldRegistry());
        }
        else {
            // Object item: merge all template defaults into an object
            value = {};
            for (const templateField of templates) {
                const rawValue = getFieldDefaultValue(templateField, this.rawFieldRegistry());
                const valueHandling = getFieldValueHandling(templateField.type, this.rawFieldRegistry());
                const isContainer = templateField.type === 'group' || templateField.type === 'row' || templateField.type === 'container';
                if (isContainer) {
                    if (isGroupField(templateField)) {
                        // Groups wrap their fields under the group key
                        value = { ...value, [templateField.key]: rawValue };
                    }
                    else {
                        // Rows and containers flatten their fields directly
                        value = { ...value, ...rawValue };
                    }
                }
                else if (valueHandling === 'include' && templateField.key) {
                    value = { ...value, [templateField.key]: rawValue };
                }
            }
        }
        // Increment version and create resolved item BEFORE updating value
        this.updateVersion.update((v) => v + 1);
        const currentVersion = this.updateVersion();
        // Append auto-remove button to resolution templates (for rendering only)
        const resolveTemplates = this.withAutoRemove(templates);
        // Resolve the new item
        const resolvedItem = await firstValueFrom(resolveArrayItem({
            index: insertIndex,
            templates: resolveTemplates,
            arrayField: this.field(),
            itemPositionMap: this.itemPositionMap,
            parentFieldSignalContext: this.parentFieldSignalContext,
            parentInjector: this.parentInjector,
            registry: this.rawFieldRegistry(),
            destroyRef: this.destroyRef,
            loadTypeComponent: (type) => this.fieldRegistry.loadTypeComponent(type),
            generateItemId: this.generateItemId,
            primitiveFieldKey: isPrimitiveItem ? templates[0].key : undefined,
        }).pipe(catchError((error) => {
            this.logger.error(`Failed to resolve array item at index ${insertIndex}:`, error);
            return of(undefined);
        })));
        if (currentVersion !== this.updateVersion() || !resolvedItem) {
            return;
        }
        // Store the template used for this item so it can be re-used during recreate operations
        this.templateRegistry.set(resolvedItem.id, templates);
        // Insert resolved item at correct position
        this.resolvedItemsSignal.update((current) => {
            const newItems = [...current];
            newItems.splice(insertIndex, 0, resolvedItem);
            return newItems;
        });
        // Update form value - differential update sees "none" (lengths match)
        const newArray = [...currentArray];
        newArray.splice(insertIndex, 0, value);
        // The `as any` is required because Angular Signal Forms uses complex conditional types
        // that cannot infer the correct type when setting a dynamically-keyed property
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parentForm().value.set({ ...currentValue, [arrayKey]: newArray });
    }
    performDifferentialUpdate(fieldTrees) {
        const resolvedItems = this.resolvedItemsSignal();
        const operation = determineDifferentialOperation(resolvedItems, fieldTrees.length);
        // Only increment version for operations that do actual work.
        // "none" operations (value-only changes) should not interfere with async add operations.
        if (operation.type === 'none') {
            return;
        }
        this.updateVersion.update((v) => v + 1);
        const currentVersion = this.updateVersion();
        switch (operation.type) {
            case 'clear':
                // Clean up template registry when all items are removed
                this.templateRegistry.clear();
                this.resolvedItemsSignal.set([]);
                if (resolvedItems.length === 0 && this.pendingInitializationCycle() === null && this.settledInitializationCycle() === null) {
                    this.pendingInitializationCycle.set(currentVersion);
                    this.settledInitializationCycle.set(currentVersion);
                }
                break;
            case 'initial':
                this.pendingInitializationCycle.set(currentVersion);
                this.settledInitializationCycle.set(null);
                void this.resolveAllItems(fieldTrees, currentVersion);
                break;
            case 'append':
                void this.appendItems(fieldTrees, operation.startIndex, operation.endIndex, currentVersion);
                break;
            case 'recreate': {
                // Capture templates by item ID so each item is recreated with its original template,
                // even after move operations that change positions. Registry entries (from dynamic adds
                // or moves) take priority over positional itemTemplates lookup.
                const positionalTemplates = resolvedItems.map((item) => {
                    // Registry entries (from dynamic adds or moves) take priority;
                    // unmoved initial items return undefined → falls through to itemTemplates[idx] during resolve.
                    return this.templateRegistry.get(item.id);
                });
                this.resolvedItemsSignal.set([]);
                this.pendingInitializationCycle.set(currentVersion);
                this.settledInitializationCycle.set(null);
                void this.resolveAllItems(fieldTrees, currentVersion, positionalTemplates);
                break;
            }
        }
    }
    async resolveAllItems(fieldTrees, updateId, positionalTemplates) {
        if (fieldTrees.length === 0) {
            this.resolvedItemsSignal.set([]);
            return;
        }
        // Wrap each item observable to catch individual errors
        const safeItemObservables = fieldTrees.map((_, i) => this.createResolveItemObservable(i, positionalTemplates?.[i]).pipe(catchError((error) => {
            this.logger.error(`Failed to resolve array item at index ${i}:`, error);
            return of(undefined);
        })));
        try {
            const items = await firstValueFrom(forkJoin(safeItemObservables).pipe(map((items) => items.filter((item) => item !== undefined))));
            if (updateId === this.updateVersion()) {
                // Update template registry with new item IDs for dynamically added items
                if (positionalTemplates) {
                    // Clean up old entries and add new ones
                    const newItemIds = new Set(items.map((item) => item.id));
                    for (const existingId of this.templateRegistry.keys()) {
                        if (!newItemIds.has(existingId)) {
                            this.templateRegistry.delete(existingId);
                        }
                    }
                    items.forEach((item, idx) => {
                        const template = positionalTemplates[idx];
                        if (template) {
                            this.templateRegistry.set(item.id, template);
                        }
                    });
                }
                this.resolvedItemsSignal.set(items);
                if (this.pendingInitializationCycle() === updateId) {
                    this.settledInitializationCycle.set(updateId);
                }
            }
        }
        catch (err) {
            this.logger.error('Failed to resolve array items:', err);
            this.resolvedItemsSignal.set([]);
        }
    }
    async appendItems(fieldTrees, startIndex, endIndex, updateId) {
        const itemsToResolve = fieldTrees.slice(startIndex, endIndex);
        if (itemsToResolve.length === 0)
            return;
        // Wrap each item observable to catch individual errors
        const safeItemObservables = itemsToResolve.map((_, i) => {
            const index = startIndex + i;
            return this.createResolveItemObservable(index).pipe(catchError((error) => {
                this.logger.error(`Failed to resolve array item at index ${index}:`, error);
                return of(undefined);
            }));
        });
        try {
            const newItems = await firstValueFrom(forkJoin(safeItemObservables).pipe(map((items) => items.filter((item) => item !== undefined))));
            if (updateId === this.updateVersion()) {
                this.resolvedItemsSignal.update((current) => [...current, ...newItems]);
            }
        }
        catch (err) {
            this.logger.error('Failed to append array items:', err);
        }
    }
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
    createResolveItemObservable(index, overrideTemplate) {
        const itemTemplates = this.itemTemplates();
        const primitiveKey = this.primitiveFieldKey();
        // Priority 1: Use override template (from recreate with stored templates)
        if (overrideTemplate && overrideTemplate.length > 0) {
            return resolveArrayItem({
                index,
                templates: this.withAutoRemove(overrideTemplate),
                arrayField: this.field(),
                itemPositionMap: this.itemPositionMap,
                parentFieldSignalContext: this.parentFieldSignalContext,
                parentInjector: this.parentInjector,
                registry: this.rawFieldRegistry(),
                destroyRef: this.destroyRef,
                loadTypeComponent: (type) => this.fieldRegistry.loadTypeComponent(type),
                generateItemId: this.generateItemId,
                primitiveFieldKey: primitiveKey,
            });
        }
        // Priority 2: Use defined template at this index
        const templates = itemTemplates[index];
        if (templates && templates.length > 0) {
            return resolveArrayItem({
                index,
                templates: templates,
                arrayField: this.field(),
                itemPositionMap: this.itemPositionMap,
                parentFieldSignalContext: this.parentFieldSignalContext,
                parentInjector: this.parentInjector,
                registry: this.rawFieldRegistry(),
                destroyRef: this.destroyRef,
                loadTypeComponent: (type) => this.fieldRegistry.loadTypeComponent(type),
                generateItemId: this.generateItemId,
                primitiveFieldKey: primitiveKey,
            });
        }
        // Priority 3: Use the metadata fallback template for untracked items in the form value.
        // Homogeneous only — every fallback item receives the same template regardless of value shape.
        const fallback = this.fallbackTemplate();
        if (fallback && fallback.length > 0) {
            return resolveArrayItem({
                index,
                templates: this.withAutoRemove(fallback),
                arrayField: this.field(),
                itemPositionMap: this.itemPositionMap,
                parentFieldSignalContext: this.parentFieldSignalContext,
                parentInjector: this.parentInjector,
                registry: this.rawFieldRegistry(),
                destroyRef: this.destroyRef,
                loadTypeComponent: (type) => this.fieldRegistry.loadTypeComponent(type),
                generateItemId: this.generateItemId,
                primitiveFieldKey: primitiveKey,
            }).pipe(tap((item) => {
                // Register the fallback template against the generated item id so subsequent
                // recreates hit Priority 1 instead of re-resolving via this branch.
                if (item)
                    this.templateRegistry.set(item.id, fallback);
            }));
        }
        // Priority 4: no template available. Full-API arrays are positional by design —
        // `fields` declares one template per item, so values extending past `fields.length`
        // (e.g., from external `value.set`, parent two-way binding, or initial values on a
        // `fields: []` array) have no template to render. Use the simplified array API
        // (`template` + `value`) when you need homogeneous arrays with value-driven items.
        this.logger.warn(`No template found for array item at index ${index}. This likely occured for a Full-API array element that was created from the DynamicForm's value being set directly, which is currently not supported. Consider using the simplified array API.`);
        return of(undefined);
    }
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
    withAutoRemove(templates) {
        const removeButton = this.autoRemoveButton();
        if (!removeButton)
            return templates;
        let cached = this.autoRemoveCache.get(templates);
        if (cached)
            return cached;
        cached = [...templates, removeButton];
        this.autoRemoveCache.set(templates, cached);
        return cached;
    }
    /**
     * Handles move operations — reorders an existing item without destroying it.
     * Updates resolvedItems and form value atomically. Since the array length
     * doesn't change, `determineDifferentialOperation` returns 'none' and no
     * recreate is triggered. The `@for` loop tracks by `item.id`, so Angular
     * moves the DOM node instead of destroying/recreating. The `itemPositionMap`
     * computed auto-recomputes, propagating new indices to child linkedSignals.
     */
    moveItem(fromIndex, toIndex) {
        const arrayKey = this.field().key;
        const parentForm = this.parentFieldSignalContext.form;
        const currentValue = parentForm().value();
        const currentArray = getArrayValue(currentValue, arrayKey);
        const length = currentArray.length;
        if (fromIndex < 0 || fromIndex >= length) {
            this.logger.warn(`moveArrayItem fromIndex ${fromIndex} is out of bounds for array '${arrayKey}' with length ${length}. Operation skipped.`);
            return;
        }
        if (toIndex < 0 || toIndex >= length) {
            this.logger.warn(`moveArrayItem toIndex ${toIndex} is out of bounds for array '${arrayKey}' with length ${length}. Operation skipped.`);
            return;
        }
        if (fromIndex === toIndex)
            return;
        // Register raw (pre-auto-remove) templates for all items whose position will change.
        // Initial items use itemTemplates[currentIndex] during recreate, but after
        // a move their position no longer matches their original template. Stashing
        // the template by item ID lets the recreate path resolve the correct one.
        // We use rawItemTemplates (without auto-remove button) because the recreate path
        // calls withAutoRemove() during resolution — storing the synthesized version would
        // cause duplicate remove buttons.
        const rawTemplates = this.rawItemTemplates();
        const currentItems = this.resolvedItemsSignal();
        const lo = Math.min(fromIndex, toIndex);
        const hi = Math.max(fromIndex, toIndex);
        for (let i = lo; i <= hi; i++) {
            const item = currentItems[i];
            if (item && !this.templateRegistry.has(item.id) && i < rawTemplates.length) {
                this.templateRegistry.set(item.id, rawTemplates[i]);
            }
        }
        // Reorder resolvedItems — splice preserves object identity (no destroy/recreate)
        this.resolvedItemsSignal.update((current) => {
            const newItems = [...current];
            const [moved] = newItems.splice(fromIndex, 1);
            newItems.splice(toIndex, 0, moved);
            return newItems;
        });
        // Reorder form value array the same way
        const newArray = [...currentArray];
        const [movedValue] = newArray.splice(fromIndex, 1);
        newArray.splice(toIndex, 0, movedValue);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parentForm().value.set({ ...currentValue, [arrayKey]: newArray });
    }
    /**
     * Handles remove operations from events (pop, shift, removeAt).
     * Updates resolvedItems FIRST, then form value - this ensures differential
     * update sees "none" (lengths match) and avoids unnecessary recreates.
     * Remaining items' linkedSignal indices auto-update via itemPositionMap.
     */
    removeItem(index) {
        const arrayKey = this.field().key;
        const parentForm = this.parentFieldSignalContext.form;
        const currentValue = parentForm().value();
        const currentArray = getArrayValue(currentValue, arrayKey);
        if (currentArray.length === 0)
            return;
        // When index is undefined or -1, remove the last item.
        let removeIndex;
        if (index === undefined || index === -1) {
            removeIndex = currentArray.length - 1;
        }
        else if (index < -1 || index >= currentArray.length) {
            this.logger.warn(`removeArrayItem index ${index} is out of bounds for array '${arrayKey}' with length ${currentArray.length}. Operation skipped.`);
            return;
        }
        else {
            removeIndex = index;
        }
        // Update resolvedItems FIRST - remove the item at the specified index.
        // This ensures differential update sees "none" (lengths already match).
        // Remaining items' linkedSignal indices auto-update via itemPositionMap.
        //
        // When the item is removed from resolvedItemsSignal, the @for loop removes the DOM element
        // and NgComponentOutlet destroys the component view, triggering DestroyRef callbacks.
        // Async validators use Angular's resource API tied to the form-level schema path — when the
        // array value is updated below, the resource's params re-evaluate. If the removed item's path
        // no longer exists, params returns undefined, cancelling the pending validation automatically.
        const removedItem = this.resolvedItemsSignal()[removeIndex];
        if (removedItem) {
            this.templateRegistry.delete(removedItem.id);
        }
        this.resolvedItemsSignal.update((current) => {
            const newItems = [...current];
            newItems.splice(removeIndex, 1);
            return newItems;
        });
        // Update the parent form with the new array value
        const newArray = [...currentArray];
        newArray.splice(removeIndex, 1);
        // The `as any` is required due to Angular Signal Forms' complex conditional types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parentForm().value.set({ ...currentValue, [arrayKey]: newArray });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.8", ngImport: i0, type: ArrayFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.8", type: ArrayFieldComponent, isStandalone: true, selector: "array-field", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, hidden: { classPropertyName: "hidden", publicName: "hidden", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "hostClasses()", "class.df-container-hidden": "hidden()", "attr.aria-hidden": "hidden() || null", "id": "`${key()}`", "attr.data-testid": "key()" } }, providers: [
            // Each array gets its own template registry to track templates used for dynamically added items
            { provide: ARRAY_TEMPLATE_REGISTRY, useFactory: () => new Map() },
            // Each array gets its own ID generator for SSR hydration compatibility
            { provide: ARRAY_ITEM_ID_GENERATOR, useFactory: createArrayItemIdGenerator },
        ], ngImport: i0, template: `
    @for (item of resolvedItems(); track item.id; let i = $index) {
      <div
        class="df-array-item"
        role="group"
        [attr.aria-label]="'Item ' + (i + 1)"
        [attr.data-array-item-id]="item.id"
        [attr.data-array-item-index]="i"
      >
        @for (field of item.fields; track $index) {
          <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
        }
      </div>
    }
  `, isInline: true, styles: [":host,.df-form{--df-grid-columns: 12;--df-grid-gap: .5rem;--df-grid-row-gap: .5rem;--df-breakpoint-sm: 576px;--df-breakpoint-md: 768px;--df-breakpoint-lg: 992px;--df-breakpoint-xl: 1200px;--df-grid-gap-sm: .5rem;--df-grid-gap-md: .5rem;--df-grid-gap-lg: .5rem;--df-grid-gap-xl: .5rem;--df-grid-row-gap-sm: .5rem;--df-grid-row-gap-md: .5rem;--df-grid-row-gap-lg: .5rem;--df-grid-row-gap-xl: .5rem;--df-array-item-gap: var(--df-grid-row-gap);--df-group-gap: var(--df-grid-gap);--df-group-padding: var(--df-grid-gap)}.df-form{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}.df-form>*{grid-column:1/-1}.df-row{display:grid;grid-template-columns:repeat(var(--df-grid-columns, 12),1fr);gap:var(--df-grid-gap);align-items:start;width:100%}.df-row>*:not([class*=df-col-]){grid-column:1/-1}.df-col-1{grid-column:span 1}.df-col-2{grid-column:span 2}.df-col-3{grid-column:span 3}.df-col-4{grid-column:span 4}.df-col-5{grid-column:span 5}.df-col-6{grid-column:span 6}.df-col-7{grid-column:span 7}.df-col-8{grid-column:span 8}.df-col-9{grid-column:span 9}.df-col-10{grid-column:span 10}.df-col-11{grid-column:span 11}.df-col-12{grid-column:span 12}.df-col-auto{grid-column:span auto;width:auto}.df-col-full{grid-column:1/-1}.df-col-start-1{grid-column-start:1}.df-col-start-2{grid-column-start:2}.df-col-start-3{grid-column-start:3}.df-col-start-4{grid-column-start:4}.df-col-start-5{grid-column-start:5}.df-col-start-6{grid-column-start:6}.df-col-start-7{grid-column-start:7}.df-col-start-8{grid-column-start:8}.df-col-start-9{grid-column-start:9}.df-col-start-10{grid-column-start:10}.df-col-start-11{grid-column-start:11}.df-col-start-12{grid-column-start:12}.df-col-end-1{grid-column-end:1}.df-col-end-2{grid-column-end:2}.df-col-end-3{grid-column-end:3}.df-col-end-4{grid-column-end:4}.df-col-end-5{grid-column-end:5}.df-col-end-6{grid-column-end:6}.df-col-end-7{grid-column-end:7}.df-col-end-8{grid-column-end:8}.df-col-end-9{grid-column-end:9}.df-col-end-10{grid-column-end:10}.df-col-end-11{grid-column-end:11}.df-col-end-12{grid-column-end:12}.df-col-end-13{grid-column-end:13}@media(max-width:576px){.df-form{--df-grid-gap: var(--df-grid-gap-sm);--df-grid-row-gap: var(--df-grid-row-gap-sm)}.df-row{grid-template-columns:1fr}.df-row>*{grid-column:1/-1!important}.df-row.df-row-mobile-keep-cols{grid-template-columns:repeat(var(--df-grid-columns),1fr)}.df-row.df-row-mobile-keep-cols>*{grid-column:revert!important}}@media(min-width:577px)and (max-width:768px){.df-form{--df-grid-gap: var(--df-grid-gap-md);--df-grid-row-gap: var(--df-grid-row-gap-md)}.df-row{--df-grid-columns: 6}.df-col-sm-1{grid-column:span 1}.df-col-sm-2{grid-column:span 2}.df-col-sm-3{grid-column:span 3}.df-col-sm-4{grid-column:span 4}.df-col-sm-5{grid-column:span 5}.df-col-sm-6{grid-column:span 6}.df-col-sm-full{grid-column:1/-1}}@media(min-width:769px)and (max-width:992px){.df-form{--df-grid-gap: var(--df-grid-gap-lg);--df-grid-row-gap: var(--df-grid-row-gap-lg)}.df-col-md-1{grid-column:span 1}.df-col-md-2{grid-column:span 2}.df-col-md-3{grid-column:span 3}.df-col-md-4{grid-column:span 4}.df-col-md-5{grid-column:span 5}.df-col-md-6{grid-column:span 6}.df-col-md-7{grid-column:span 7}.df-col-md-8{grid-column:span 8}.df-col-md-9{grid-column:span 9}.df-col-md-10{grid-column:span 10}.df-col-md-11{grid-column:span 11}.df-col-md-12{grid-column:span 12}.df-col-md-full{grid-column:1/-1}}@media(min-width:993px){.df-form{--df-grid-gap: var(--df-grid-gap-xl);--df-grid-row-gap: var(--df-grid-row-gap-xl)}.df-col-lg-1{grid-column:span 1}.df-col-lg-2{grid-column:span 2}.df-col-lg-3{grid-column:span 3}.df-col-lg-4{grid-column:span 4}.df-col-lg-5{grid-column:span 5}.df-col-lg-6{grid-column:span 6}.df-col-lg-7{grid-column:span 7}.df-col-lg-8{grid-column:span 8}.df-col-lg-9{grid-column:span 9}.df-col-lg-10{grid-column:span 10}.df-col-lg-11{grid-column:span 11}.df-col-lg-12{grid-column:span 12}.df-col-lg-full{grid-column:1/-1}}.df-gap-none{--df-grid-gap: 0}.df-gap-xs{--df-grid-gap: .25rem}.df-gap-sm{--df-grid-gap: .5rem}.df-gap-md{--df-grid-gap: 1rem}.df-gap-lg{--df-grid-gap: 1.5rem}.df-gap-xl{--df-grid-gap: 2rem}.df-row-gap-none{--df-grid-row-gap: 0}.df-row-gap-xs{--df-grid-row-gap: .25rem}.df-row-gap-sm{--df-grid-row-gap: .5rem}.df-row-gap-md{--df-grid-row-gap: 1rem}.df-row-gap-lg{--df-grid-row-gap: 1.5rem}.df-row-gap-xl{--df-grid-row-gap: 2rem}.df-field{display:block;width:100%;min-width:0;overflow:hidden;margin:0}.df-group,.df-page{display:block;width:100%}.df-form.disabled,.df-row.disabled,.df-field.disabled{opacity:.6;pointer-events:none}.df-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-sr-only-focusable:focus,.df-sr-only-focusable:active{position:static;width:auto;height:auto;padding:inherit;margin:inherit;overflow:visible;clip:auto;white-space:normal}.df-live-region{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-form :focus-visible{outline:2px solid var(--df-focus-color, #005fcc);outline-offset:2px}.df-group:focus-within{outline:1px dashed var(--df-focus-color, #005fcc);outline-offset:4px}:host{display:grid;grid-template-columns:1fr;gap:var(--df-array-item-gap, var(--df-grid-row-gap, .5rem));width:100%}:host>*{grid-column:1/-1}:host.df-container-hidden{display:none}.df-array-item{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap, .5rem);width:100%}.df-array-item>*{grid-column:1/-1}\n"], dependencies: [{ kind: "directive", type: DfFieldOutlet, selector: "[dfFieldOutlet]", inputs: ["dfFieldOutlet", "dfFieldOutletEnvironmentInjector"] }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.8", ngImport: i0, type: ArrayFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'array-field', imports: [DfFieldOutlet], template: `
    @for (item of resolvedItems(); track item.id; let i = $index) {
      <div
        class="df-array-item"
        role="group"
        [attr.aria-label]="'Item ' + (i + 1)"
        [attr.data-array-item-id]="item.id"
        [attr.data-array-item-index]="i"
      >
        @for (field of item.fields; track $index) {
          <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
        }
      </div>
    }
  `, host: {
                        '[class]': 'hostClasses()',
                        '[class.df-container-hidden]': 'hidden()',
                        '[attr.aria-hidden]': 'hidden() || null',
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                    }, providers: [
                        // Each array gets its own template registry to track templates used for dynamically added items
                        { provide: ARRAY_TEMPLATE_REGISTRY, useFactory: () => new Map() },
                        // Each array gets its own ID generator for SSR hydration compatibility
                        { provide: ARRAY_ITEM_ID_GENERATOR, useFactory: createArrayItemIdGenerator },
                    ], changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host,.df-form{--df-grid-columns: 12;--df-grid-gap: .5rem;--df-grid-row-gap: .5rem;--df-breakpoint-sm: 576px;--df-breakpoint-md: 768px;--df-breakpoint-lg: 992px;--df-breakpoint-xl: 1200px;--df-grid-gap-sm: .5rem;--df-grid-gap-md: .5rem;--df-grid-gap-lg: .5rem;--df-grid-gap-xl: .5rem;--df-grid-row-gap-sm: .5rem;--df-grid-row-gap-md: .5rem;--df-grid-row-gap-lg: .5rem;--df-grid-row-gap-xl: .5rem;--df-array-item-gap: var(--df-grid-row-gap);--df-group-gap: var(--df-grid-gap);--df-group-padding: var(--df-grid-gap)}.df-form{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}.df-form>*{grid-column:1/-1}.df-row{display:grid;grid-template-columns:repeat(var(--df-grid-columns, 12),1fr);gap:var(--df-grid-gap);align-items:start;width:100%}.df-row>*:not([class*=df-col-]){grid-column:1/-1}.df-col-1{grid-column:span 1}.df-col-2{grid-column:span 2}.df-col-3{grid-column:span 3}.df-col-4{grid-column:span 4}.df-col-5{grid-column:span 5}.df-col-6{grid-column:span 6}.df-col-7{grid-column:span 7}.df-col-8{grid-column:span 8}.df-col-9{grid-column:span 9}.df-col-10{grid-column:span 10}.df-col-11{grid-column:span 11}.df-col-12{grid-column:span 12}.df-col-auto{grid-column:span auto;width:auto}.df-col-full{grid-column:1/-1}.df-col-start-1{grid-column-start:1}.df-col-start-2{grid-column-start:2}.df-col-start-3{grid-column-start:3}.df-col-start-4{grid-column-start:4}.df-col-start-5{grid-column-start:5}.df-col-start-6{grid-column-start:6}.df-col-start-7{grid-column-start:7}.df-col-start-8{grid-column-start:8}.df-col-start-9{grid-column-start:9}.df-col-start-10{grid-column-start:10}.df-col-start-11{grid-column-start:11}.df-col-start-12{grid-column-start:12}.df-col-end-1{grid-column-end:1}.df-col-end-2{grid-column-end:2}.df-col-end-3{grid-column-end:3}.df-col-end-4{grid-column-end:4}.df-col-end-5{grid-column-end:5}.df-col-end-6{grid-column-end:6}.df-col-end-7{grid-column-end:7}.df-col-end-8{grid-column-end:8}.df-col-end-9{grid-column-end:9}.df-col-end-10{grid-column-end:10}.df-col-end-11{grid-column-end:11}.df-col-end-12{grid-column-end:12}.df-col-end-13{grid-column-end:13}@media(max-width:576px){.df-form{--df-grid-gap: var(--df-grid-gap-sm);--df-grid-row-gap: var(--df-grid-row-gap-sm)}.df-row{grid-template-columns:1fr}.df-row>*{grid-column:1/-1!important}.df-row.df-row-mobile-keep-cols{grid-template-columns:repeat(var(--df-grid-columns),1fr)}.df-row.df-row-mobile-keep-cols>*{grid-column:revert!important}}@media(min-width:577px)and (max-width:768px){.df-form{--df-grid-gap: var(--df-grid-gap-md);--df-grid-row-gap: var(--df-grid-row-gap-md)}.df-row{--df-grid-columns: 6}.df-col-sm-1{grid-column:span 1}.df-col-sm-2{grid-column:span 2}.df-col-sm-3{grid-column:span 3}.df-col-sm-4{grid-column:span 4}.df-col-sm-5{grid-column:span 5}.df-col-sm-6{grid-column:span 6}.df-col-sm-full{grid-column:1/-1}}@media(min-width:769px)and (max-width:992px){.df-form{--df-grid-gap: var(--df-grid-gap-lg);--df-grid-row-gap: var(--df-grid-row-gap-lg)}.df-col-md-1{grid-column:span 1}.df-col-md-2{grid-column:span 2}.df-col-md-3{grid-column:span 3}.df-col-md-4{grid-column:span 4}.df-col-md-5{grid-column:span 5}.df-col-md-6{grid-column:span 6}.df-col-md-7{grid-column:span 7}.df-col-md-8{grid-column:span 8}.df-col-md-9{grid-column:span 9}.df-col-md-10{grid-column:span 10}.df-col-md-11{grid-column:span 11}.df-col-md-12{grid-column:span 12}.df-col-md-full{grid-column:1/-1}}@media(min-width:993px){.df-form{--df-grid-gap: var(--df-grid-gap-xl);--df-grid-row-gap: var(--df-grid-row-gap-xl)}.df-col-lg-1{grid-column:span 1}.df-col-lg-2{grid-column:span 2}.df-col-lg-3{grid-column:span 3}.df-col-lg-4{grid-column:span 4}.df-col-lg-5{grid-column:span 5}.df-col-lg-6{grid-column:span 6}.df-col-lg-7{grid-column:span 7}.df-col-lg-8{grid-column:span 8}.df-col-lg-9{grid-column:span 9}.df-col-lg-10{grid-column:span 10}.df-col-lg-11{grid-column:span 11}.df-col-lg-12{grid-column:span 12}.df-col-lg-full{grid-column:1/-1}}.df-gap-none{--df-grid-gap: 0}.df-gap-xs{--df-grid-gap: .25rem}.df-gap-sm{--df-grid-gap: .5rem}.df-gap-md{--df-grid-gap: 1rem}.df-gap-lg{--df-grid-gap: 1.5rem}.df-gap-xl{--df-grid-gap: 2rem}.df-row-gap-none{--df-grid-row-gap: 0}.df-row-gap-xs{--df-grid-row-gap: .25rem}.df-row-gap-sm{--df-grid-row-gap: .5rem}.df-row-gap-md{--df-grid-row-gap: 1rem}.df-row-gap-lg{--df-grid-row-gap: 1.5rem}.df-row-gap-xl{--df-grid-row-gap: 2rem}.df-field{display:block;width:100%;min-width:0;overflow:hidden;margin:0}.df-group,.df-page{display:block;width:100%}.df-form.disabled,.df-row.disabled,.df-field.disabled{opacity:.6;pointer-events:none}.df-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-sr-only-focusable:focus,.df-sr-only-focusable:active{position:static;width:auto;height:auto;padding:inherit;margin:inherit;overflow:visible;clip:auto;white-space:normal}.df-live-region{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-form :focus-visible{outline:2px solid var(--df-focus-color, #005fcc);outline-offset:2px}.df-group:focus-within{outline:1px dashed var(--df-focus-color, #005fcc);outline-offset:4px}:host{display:grid;grid-template-columns:1fr;gap:var(--df-array-item-gap, var(--df-grid-row-gap, .5rem));width:100%}:host>*{grid-column:1/-1}:host.df-container-hidden{display:none}.df-array-item{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap, .5rem);width:100%}.df-array-item>*{grid-column:1/-1}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], hidden: [{ type: i0.Input, args: [{ isSignal: true, alias: "hidden", required: false }] }] } });

export { ArrayFieldComponent, ArrayFieldComponent as default };
//# sourceMappingURL=ng-forge-dynamic-forms-array-field.component-DlnH8RvU.mjs.map
