import * as i0 from '@angular/core';
import { InjectionToken, reflectComponentType, Injector, inject, EnvironmentInjector, DestroyRef, computed, input, ViewContainerRef, signal, Directive, Injectable, isSignal, untracked, isWritableSignal, isDevMode, linkedSignal, ChangeDetectionStrategy, Component, resourceFromSnapshots, runInInjectionContext, afterNextRender, model, makeEnvironmentProviders, Pipe, viewChild, TemplateRef } from '@angular/core';
import { explicitEffect } from 'ngxtension/explicit-effect';
import { of, forkJoin, from, catchError, map, switchMap, isObservable, firstValueFrom, exhaustMap, EMPTY, Subject, filter, TimeoutError, throwError, debounceTime, distinctUntilChanged, tap, take as take$1, startWith, pairwise, Observable, takeUntil, combineLatestWith, auditTime, scheduled, queueScheduler, merge, timer, defer, combineLatest, pipe, scan as scan$1, concatMap } from 'rxjs';
import { takeUntilDestroyed, toObservable, toSignal, rxResource, outputFromObservable } from '@angular/core/rxjs-interop';
import { submit, email, min, max, minLength, maxLength, pattern, required, validate, validateAsync, validateHttp, disabled, readonly, hidden, applyEach, applyWhenValue, applyWhen, apply, schema, validateStandardSchema, validateTree, form, provideSignalFormsConfig } from '@angular/forms/signals';
import { scan, map as map$1, filter as filter$1, take, switchMap as switchMap$1, timeout, catchError as catchError$1, shareReplay } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { isStandardSchemaMarker } from '@ng-forge/dynamic-forms/schema';
import { NG_STATUS_CLASSES } from '@angular/forms/signals/compat';

/**
 * Type guard for WrapperTypeDefinition.
 *
 * Discriminates via `wrapperName` — field types use `name`, wrapper types use `wrapperName`.
 */
function isWrapperTypeDefinition(value) {
    return typeof value === 'object' && value !== null && 'wrapperName' in value;
}
/**
 * Injection token for the wrapper type registry.
 *
 * Provides access to the map of registered wrapper types. The registry is
 * populated via `provideDynamicForm()` and used by `ContainerFieldComponent` to
 * resolve wrapper types to their component implementations.
 */
const WRAPPER_REGISTRY = new InjectionToken('WRAPPER_REGISTRY', {
    providedIn: 'root',
    factory: () => new Map(),
});
/**
 * Component cache for loaded wrapper components.
 *
 * Caches resolved wrapper component classes for instant re-resolution.
 * SSR-safe because it's DI-scoped, not module-scoped.
 *
 * NOTE: The cache grows across the application lifetime. It's bounded by the
 * number of wrapper types registered (typically small), so this is not a leak;
 * the COMPONENT_CACHE for field types has the same shape.
 */
const WRAPPER_COMPONENT_CACHE = new InjectionToken('WRAPPER_COMPONENT_CACHE', {
    providedIn: 'root',
    factory: () => new Map(),
});
/**
 * Pre-computed reverse index: `fieldType → WrapperConfig[]` for every
 * registered `WrapperTypeDefinition.types` entry. Built once in the
 * `provideDynamicForm(...)` factory so `resolveWrappers` can look up
 * auto-associations in O(1) per field instead of scanning the full
 * wrapper registry on every render.
 */
const WRAPPER_AUTO_ASSOCIATIONS = new InjectionToken('WRAPPER_AUTO_ASSOCIATIONS', {
    providedIn: 'root',
    factory: () => new Map(),
});

/**
 * Base error class for all Dynamic Forms errors.
 *
 * This class centralizes the `[Dynamic Forms]` prefix, ensuring consistent
 * error messaging across the library without requiring each error site to
 * manually include the prefix.
 */
class DynamicFormError extends Error {
    static PREFIX = '[Dynamic Forms]';
    constructor(message) {
        super(`${DynamicFormError.PREFIX} ${message}`);
        this.name = 'DynamicFormError';
    }
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
const DEFAULT_WRAPPERS = new InjectionToken('DEFAULT_WRAPPERS');
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
const FIELD_SIGNAL_CONTEXT = new InjectionToken('FIELD_SIGNAL_CONTEXT', {
    providedIn: null, // Not provided at root - must be provided by DynamicForm
    factory: () => {
        throw new DynamicFormError('FIELD_SIGNAL_CONTEXT was not provided. ' +
            'This token must be provided by DynamicFormComponent or a container field component. ' +
            'If you are calling a mapper function directly, ensure it runs within runInInjectionContext() ' +
            'with an injector that provides FIELD_SIGNAL_CONTEXT.');
    },
});
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
const ARRAY_CONTEXT = new InjectionToken('ARRAY_CONTEXT');
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
const DEFAULT_PROPS = new InjectionToken('DEFAULT_PROPS');
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
const DEFAULT_VALIDATION_MESSAGES = new InjectionToken('DEFAULT_VALIDATION_MESSAGES');
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
const FORM_OPTIONS = new InjectionToken('FORM_OPTIONS');
/**
 * Injection token for form-level external data.
 *
 * Provides a Signal of the external data record from the form config.
 * Used by `FieldContextRegistryService` to resolve external data for expression evaluation
 * without coupling to `FormStateManager` directly.
 *
 * Like DEFAULT_PROPS, this token is provided ONCE at the DynamicForm level
 * and inherited by all children via Angular's hierarchical injector.
 */
const EXTERNAL_DATA = new InjectionToken('EXTERNAL_DATA');
/**
 * Injection token for array-level template registry.
 *
 * This registry tracks which template was used to create each array item,
 * keyed by the item's unique ID. This is essential for "recreate" operations
 * (e.g., after removing items from the middle) where we need to re-resolve
 * items using their original templates, not a fallback.
 *
 * The token is provided by ArrayFieldComponent at its level and shared
 * across all items in that array. Each nested array gets its own registry.
 *
 * @example
 * ```typescript
 * // In ArrayFieldComponent
 * providers: [
 *   { provide: ARRAY_TEMPLATE_REGISTRY, useValue: new Map() }
 * ]
 *
 * // When adding items
 * const registry = inject(ARRAY_TEMPLATE_REGISTRY);
 * registry.set(itemId, templates);
 *
 * // During recreate, look up original template
 * const originalTemplate = registry.get(existingItemId);
 * ```
 */
const ARRAY_TEMPLATE_REGISTRY = new InjectionToken('ARRAY_TEMPLATE_REGISTRY');
/**
 * Injection token for array-level item ID generator.
 *
 * Provides a function that generates unique IDs for array items. Each array
 * component instance gets its own generator (via useFactory), ensuring:
 * - SSR hydration compatibility (server and client generate same IDs for same array)
 * - No global state pollution between form instances
 * - Deterministic IDs within each array's lifecycle
 *
 * The token is provided by ArrayFieldComponent at its level with a factory
 * that creates a fresh counter for each array instance.
 *
 * @example
 * ```typescript
 * // In ArrayFieldComponent
 * providers: [
 *   { provide: ARRAY_ITEM_ID_GENERATOR, useFactory: createArrayItemIdGenerator }
 * ]
 *
 * // Usage
 * const generateId = inject(ARRAY_ITEM_ID_GENERATOR);
 * const itemId = generateId(); // 'item-0', 'item-1', etc.
 * ```
 */
const ARRAY_ITEM_ID_GENERATOR = new InjectionToken('ARRAY_ITEM_ID_GENERATOR');
/**
 * Factory function that creates a new array item ID generator.
 * Each invocation creates an independent counter starting at 0.
 */
function createArrayItemIdGenerator() {
    let counter = 0;
    return () => `item-${counter++}`;
}

/**
 * Module-level cache keyed by component class. `reflectComponentType` returns
 * immutable metadata per class, so we probe it once and reuse the resulting
 * `Set<templateName>` for every `setInputIfDeclared` call afterwards.
 *
 * We cache `templateName` (the public input name, aka alias) rather than
 * `propName` (the class field name) because `ComponentRef.setInput()` keys by
 * the public name — that's also the name wrapper configs use. An aliased
 * input declared as `input(..., { alias: 'header' })` with class field
 * `headerText` must be addressed as `'header'`; caching `propName` would
 * leave the alias out of the declared set and silently drop config values.
 *
 * SSR-safe: the WeakMap is keyed by the component class object — classes are
 * created per Angular application bootstrap and GC'd with it, so this does not
 * leak state between server renders.
 */
const inputNamesCache = new WeakMap();
function getDeclaredInputs(componentType) {
    let inputs = inputNamesCache.get(componentType);
    if (!inputs) {
        const meta = reflectComponentType(componentType);
        inputs = new Set(meta?.inputs.map((i) => i.templateName) ?? []);
        inputNamesCache.set(componentType, inputs);
    }
    return inputs;
}
/**
 * Set an input on a ComponentRef only when the target component actually declares it.
 *
 * Angular's `ComponentRef.setInput()` throws NG0303 when the input is missing.
 * For config keys driven by user data (e.g. a wrapper config containing a prop
 * the wrapper doesn't care about) that would surface as a noisy runtime error.
 * We probe the component's metadata via `reflectComponentType` (public API),
 * cached per component class — called once per input key per emission, so
 * avoiding the reflection scan on each call is meaningful under heavy typing.
 */
function setInputIfDeclared(ref, inputName, value) {
    const declared = getDeclaredInputs(ref.componentType);
    if (declared.has(inputName)) {
        ref.setInput(inputName, value);
    }
}
/**
 * Narrows an ES-module-with-default-export from a bare component class.
 * Lazy component loaders may return either shape depending on how the user
 * wrote the import expression (`import('./x')` vs `import('./x').then(m => m.Foo)`).
 */
function hasDefaultExport(value) {
    return typeof value === 'object' && value !== null && 'default' in value && !!value.default;
}
/**
 * Pick the component class out of whatever a lazy loader returned.
 */
function resolveDefaultExport(result) {
    return hasDefaultExport(result) ? result.default : result;
}
/**
 * Resolve a wrapper type name to its component class, with DI-scoped caching.
 */
async function loadWrapperComponent(type, registry, cache) {
    const cached = cache.get(type);
    if (cached)
        return cached;
    const definition = registry.get(type);
    if (!definition)
        return undefined;
    const component = resolveDefaultExport(await definition.loadComponent());
    if (component)
        cache.set(type, component);
    return component;
}
/**
 * Load every wrapper for a chain, all-or-nothing. A single failed load
 * aborts the whole chain (emits `[]`) so the field renders bare rather
 * than in a partially-wrapped, visually-misleading state. Each failure
 * is logged; field-type resolution still throws — this isn't silent.
 */
function loadWrapperComponents(configs, registry, cache, logger) {
    if (configs.length === 0)
        return of([]);
    return forkJoin(configs.map((config) => from(loadWrapperComponent(config.type, registry, cache)).pipe(catchError(() => of(undefined)), map((component) => {
        if (!component) {
            logger.error(`Wrapper type '${config.type}' could not be loaded. Ensure it is registered via provideDynamicForm().`);
            return null;
        }
        return { config, component };
    })))).pipe(map((results) => (results.some((r) => r === null) ? [] : results)));
}
/**
 * Recursively create each wrapper component, threading the next one (or the
 * innermost content) into its `#fieldComponent` slot.
 *
 * Each wrapper receives:
 * - Each of its config properties (minus `type`) as an individual Angular input
 * - `fieldInputs` as a single input, if provided
 *
 * Returns the list of wrapper `ComponentRef`s — callers retain them for later
 * cleanup and for re-setting `fieldInputs` when the mapper signal emits.
 */
function renderWrapperChain(options) {
    const refs = [];
    renderStep(options.outerContainer, options.loadedWrappers, options, refs);
    return refs;
}
function renderStep(slot, remaining, options, refs) {
    if (remaining.length === 0) {
        options.renderInnermost(slot);
        return;
    }
    const [wrapper, ...rest] = remaining;
    // `slot.injector` is the element injector seen from inside the current slot —
    // for nested slots that includes the outer wrapper's component, enabling
    // `inject(OuterWrapper)`. When a field injector is provided we merge it in
    // front so tokens like `ARRAY_CONTEXT` also resolve.
    const wrapperInjector = options.fieldInjector ? createWrapperAwareInjector(options.fieldInjector, slot.injector) : slot.injector;
    const ref = slot.createComponent(wrapper.component, {
        environmentInjector: options.environmentInjector,
        injector: wrapperInjector,
    });
    refs.push(ref);
    for (const [key, value] of Object.entries(wrapper.config)) {
        // `type` is the registry discriminant; `fieldInputs` is set explicitly
        // below. Don't let a stray config key override either.
        if (key === 'type' || key === 'fieldInputs')
            continue;
        setInputIfDeclared(ref, key, value);
    }
    if (options.fieldInputs !== undefined) {
        setInputIfDeclared(ref, 'fieldInputs', options.fieldInputs);
    }
    // Required to resolve `viewChild.required('fieldComponent')` before we
    // recurse into the slot. O(chain length) CD passes per rebuild — acceptable
    // for typical chains (≤3); refactor to a template-based render if it bites.
    ref.changeDetectorRef.detectChanges();
    const inner = resolveInnerSlot(ref);
    if (!inner) {
        options.logger.error(`Wrapper component for type '${wrapper.config.type}' does not provide a 'fieldComponent' ViewContainerRef. ` +
            `Ensure the wrapper component has a viewChild('fieldComponent', { read: ViewContainerRef }) query ` +
            `and that #fieldComponent is not inside a conditional (@if, @defer).`);
        // Unwind: destroy every wrapper built so far, including this one, so the
        // caller doesn't end up with a partial chain left in the DOM.
        while (refs.length)
            refs.pop().destroy();
        return;
    }
    renderStep(inner, rest, options, refs);
}
/**
 * Read a wrapper's `#fieldComponent` ViewContainerRef. `viewChild.required`
 * throws when the query can't resolve (missing template ref, or ref sitting
 * inside `@if` / `@defer` / `@for`); any throw from this pure signal read
 * means the slot is unusable, so we return undefined and let the caller log
 * the actionable "wrapper missing fieldComponent" message.
 */
function resolveInnerSlot(ref) {
    const contract = ref.instance;
    try {
        return contract.fieldComponent?.();
    }
    catch {
        return undefined;
    }
}
/**
 * Merged injector: check the field-level injector first (for tokens like
 * `ARRAY_CONTEXT` / `FIELD_SIGNAL_CONTEXT`), fall back to the element-chain
 * injector (so nested wrappers can still `inject(OuterWrapper)`).
 *
 * Precedence: a field-level token shadows a same-named token provided by an
 * outer wrapper. That matches "more specific context wins" but is worth
 * keeping in mind if a wrapper exports service tokens.
 */
function createWrapperAwareInjector(fieldInjector, elementInjector) {
    if (fieldInjector === elementInjector)
        return fieldInjector;
    return new WrapperAwareInjector(fieldInjector, elementInjector);
}
/** Sentinel — distinguishes "token not found" from a legitimate `undefined` provider value. */
const WRAPPER_NOT_FOUND = {};
class WrapperAwareInjector extends Injector {
    fieldInjector;
    elementInjector;
    constructor(fieldInjector, elementInjector) {
        super();
        this.fieldInjector = fieldInjector;
        this.elementInjector = elementInjector;
    }
    get(token, notFoundValue, options) {
        const field = this.fieldInjector.get(token, WRAPPER_NOT_FOUND, options);
        if (field !== WRAPPER_NOT_FOUND)
            return field;
        return this.elementInjector.get(token, notFoundValue, options);
    }
}

/**
 * Injection token for the dynamic forms logger.
 *
 * Provided by provideDynamicForm() with ConsoleLogger as default.
 * Override with withLoggerConfig(false) to disable logging.
 */
const DynamicFormLogger = new InjectionToken('DynamicFormLogger');

/**
 * Shared empty chain — returned when no wrappers apply so callers get a
 * stable reference. Freezing makes accidental mutation observable.
 */
const EMPTY_WRAPPERS = Object.freeze([]);
/**
 * Element-wise identity (`===`) comparator for wrapper chains. Used as the
 * `equal` option on signal memoisation so reconciled `FieldDef`s with the
 * same chain don't churn downstream — relies on `WrapperConfig` objects
 * being stable across ticks, which holds for configs declared in
 * `FormConfig` / `createWrappers(...)`.
 */
function isSameWrapperChain(a, b) {
    if (a === b)
        return true;
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
/**
 * Resolves the wrapper chain for a field.
 *
 * Merge order (outermost → innermost): auto-associations, form defaults,
 * field-level wrappers. `wrappers: null` skips all three; `skipAutoWrappers` /
 * `skipDefaultWrappers` on the field opt out of individual layers. Fresh
 * array per call — downstream memoisation is on the consuming computed.
 */
function resolveWrappers(field, defaultWrappers, autoAssociations) {
    if (field.wrappers === null) {
        return EMPTY_WRAPPERS;
    }
    const autoWrappers = field.skipAutoWrappers ? EMPTY_WRAPPERS : (autoAssociations.get(field.type) ?? EMPTY_WRAPPERS);
    const defaults = field.skipDefaultWrappers ? EMPTY_WRAPPERS : (defaultWrappers ?? EMPTY_WRAPPERS);
    const fieldLevel = field.wrappers ?? EMPTY_WRAPPERS;
    if (autoWrappers.length === 0 && defaults.length === 0 && fieldLevel.length === 0) {
        return EMPTY_WRAPPERS;
    }
    return [...autoWrappers, ...defaults, ...fieldLevel];
}

/**
 * Owns the wrapper-chain lifecycle for a field or container: async component
 * loading, switchMap-based cancellation of stale loads, flicker-tolerant
 * rebuilds (only structural changes tear down), and `fieldInputs` push-through.
 * Must be called from a DI injection context.
 */
function createWrapperChainController(opts) {
    const deps = injectChainDeps();
    const state = createStateSignal(opts);
    const mounted = { value: null };
    let refs = [];
    buildEmissionStream(state, deps)
        .pipe(takeUntilDestroyed(deps.destroyRef))
        .subscribe((emission) => {
        // Wrap the whole render path — a throw here (bad wrapper template,
        // caller's renderInnermost blew up, etc.) would otherwise terminate
        // the subscription and silently freeze subsequent chain updates.
        try {
            refs = applyEmission(emission, { opts, deps, mounted, refs });
        }
        catch (err) {
            deps.logger.error('Wrapper chain render failed; tearing down partial state.', err);
            opts.vcr().clear();
            refs = [];
            mounted.value = null;
        }
    });
    pushFieldInputsOnChange(opts, () => refs);
    deps.destroyRef.onDestroy(() => opts.vcr().clear());
}
function injectChainDeps() {
    return {
        registry: inject(WRAPPER_REGISTRY),
        cache: inject(WRAPPER_COMPONENT_CACHE),
        logger: inject(DynamicFormLogger),
        destroyRef: inject(DestroyRef),
        environmentInjector: inject(EnvironmentInjector),
    };
}
function createStateSignal(opts) {
    return computed(() => ({
        open: opts.gate?.() ?? true,
        wrappers: opts.wrappers(),
        rebuildKey: opts.rebuildKey?.(),
    }), { equal: (a, b) => a.open === b.open && a.rebuildKey === b.rebuildKey && isSameWrapperChain(a.wrappers, b.wrappers) });
}
/**
 * Resolve a `ChainState` into a `ChainEmission`. `switchMap` cancellation
 * guarantees in-flight async loads are discarded when a newer state arrives.
 */
function buildEmissionStream(state, deps) {
    return toObservable(state).pipe(switchMap((s) => resolveLoadedWrappers(s, deps)));
}
function resolveLoadedWrappers(state, deps) {
    if (!state.open) {
        return of({ state, loaded: null });
    }
    if (state.wrappers.every((w) => deps.cache.has(w.type))) {
        // Sync fast-path — the cache only holds SUCCESSFUL loads, so "every cached"
        // means every wrapper was previously resolved cleanly. No need to re-log.
        const loaded = state.wrappers.map((config) => ({ config, component: deps.cache.get(config.type) }));
        return of({ state, loaded });
    }
    return loadWrapperComponents(state.wrappers, deps.registry, deps.cache, deps.logger).pipe(map((loaded) => ({ state, loaded })));
}
/**
 * Diff what's mounted against the next state and act:
 *   - Gate-only flicker → no-op (preserve the mounted chain)
 *   - Structural change → beforeRebuild → vcr.clear → render fresh
 *   - Idempotent re-emission → no-op
 *
 * Returns the (possibly new) wrapper refs so the caller can track them for
 * `fieldInputs` push-through.
 */
function applyEmission({ state, loaded }, ctx) {
    const { opts, deps, mounted, refs } = ctx;
    const vcr = opts.vcr();
    const structurallyChanged = isStructurallyDifferent(mounted.value, state);
    // Gate-only flicker after first mount — keep the chain alive so the user's
    // focus / caret / scroll survive. The caller's rawInputs effect continues
    // to push live mapper outputs through the still-mounted innermost.
    if (!structurallyChanged && !state.open)
        return refs;
    // Real structural change — tear down. Angular cascades destroy through
    // every nested ComponentRef, so walking `refs` manually is redundant.
    // `beforeRebuild` gives the caller a chance to detach views it wants to
    // preserve (e.g. the innermost field when only wrappers changed).
    if (structurallyChanged && mounted.value !== null) {
        opts.beforeRebuild?.();
        vcr.clear();
        mounted.value = null;
    }
    if (!state.open || loaded === null)
        return [];
    // Same structure + already mounted — idempotent re-emission, nothing to do.
    if (mounted.value !== null)
        return refs;
    const newRefs = renderWrapperChain({
        outerContainer: vcr,
        loadedWrappers: loaded,
        environmentInjector: deps.environmentInjector,
        logger: deps.logger,
        fieldInputs: opts.fieldInputs?.(),
        fieldInjector: opts.fieldInjector?.(),
        renderInnermost: opts.renderInnermost,
    });
    mounted.value = { wrappers: state.wrappers, rebuildKey: state.rebuildKey };
    return newRefs;
}
function isStructurallyDifferent(mounted, next) {
    if (mounted === null)
        return true;
    if (mounted.rebuildKey !== next.rebuildKey)
        return true;
    return !isSameWrapperChain(mounted.wrappers, next.wrappers);
}
/**
 * Push the latest `fieldInputs` bag to every mounted wrapper whenever it
 * changes — without rebuilding the chain. No-op when the chain is empty
 * (gated off, or nothing rendered yet).
 */
function pushFieldInputsOnChange(opts, getRefs) {
    if (!opts.fieldInputs)
        return;
    explicitEffect([opts.fieldInputs], ([fi]) => {
        for (const ref of getRefs())
            setInputIfDeclared(ref, 'fieldInputs', fi);
    });
}

/**
 * Get the length of an array FieldTree.
 */
function getArrayLength(arrayFieldTree) {
    const value = arrayFieldTree().value();
    return Array.isArray(value) ? value.length : 0;
}
/**
 * Build a `ReadonlyFieldTree` by extracting the whitelisted read signals from a
 * Signal Forms `FieldTree`. Returns a fresh plain object — no casting, no proxying,
 * so consumers only see the narrow surface and Angular's `WritableSignal` capability
 * on `value` is hidden.
 */
function toReadonlyFieldTree(field) {
    const state = field();
    return {
        value: state.value,
        valid: state.valid,
        invalid: state.invalid,
        touched: state.touched,
        dirty: state.dirty,
        required: state.required,
        disabled: state.disabled,
        hidden: state.hidden,
        errors: state.errors,
    };
}
/**
 * DI-scoped cache for `ReadonlyFieldTree` views, keyed on the source FieldTree
 * identity. A fresh WeakMap per root injector keeps renders isolated under SSR —
 * Angular creates a new root injector per request, so there's no shared state
 * between server renders (same pattern as `COMPONENT_CACHE`).
 *
 * @internal
 */
const READONLY_FIELD_TREE_CACHE = new InjectionToken('READONLY_FIELD_TREE_CACHE', {
    providedIn: 'root',
    factory: () => new WeakMap(),
});
/**
 * Cached variant of {@link toReadonlyFieldTree}. Each FieldTree instance is a
 * stable reference for the lifetime of its form, so one `ReadonlyFieldTree`
 * view per tree is enough. Callers on hot paths (`pushInputs` on every mapper
 * emission) avoid re-allocating the nine-property view object.
 *
 * @internal
 */
function toReadonlyFieldTreeCached(cache, field) {
    const key = field;
    const cached = cache.get(key);
    if (cached)
        return cached;
    const view = toReadonlyFieldTree(field);
    cache.set(key, view);
    return view;
}

/**
 * Structural directive that renders a `ResolvedField` with its effective
 * wrapper chain.
 *
 * Replaces `*ngComponentOutlet` in field-rendering templates. When the field
 * has no wrappers, the component is created directly at the outlet position
 * (no extra DOM nesting). When wrappers apply, they chain outermost-first and
 * the field renders in the innermost slot.
 *
 * Effective wrappers are merged from (outermost → innermost):
 * 1. `WrapperTypeDefinition.types` auto-associations for the field's `type`
 * 2. `FormConfig.defaultWrappers`
 * 3. Field-level `FieldDef.wrappers` (`null` = explicit opt-out; `[]` does not
 *    opt out — auto + defaults still apply)
 *
 * Wrapper config keys (minus `type`) are pushed as individual Angular inputs;
 * every wrapper also receives `fieldInputs` — a `WrapperFieldInputs` bag that
 * includes the field's mapper outputs and a `ReadonlyFieldTree` view of its
 * form state.
 *
 * Rendering is gated by `field.renderReady()` — the directive waits until
 * the mapper produces the required inputs before instantiating the component.
 * Once rendered, a transient `renderReady → false` does *not* tear the chain
 * down; the controller keeps the mounted components alive and ignores the
 * flicker. Only a structural change (wrappers or component class) triggers
 * a rebuild.
 *
 * @example
 * ```html
 * \@for (field of resolvedFields(); track field.key) {
 *   <ng-container *dfFieldOutlet="field; environmentInjector: envInjector" />
 * }
 * ```
 */
class DfFieldOutlet {
    // Named to match the structural directive microsyntax directly
    // (`*dfFieldOutlet="field; environmentInjector: env"`) so no aliasing is needed.
    dfFieldOutlet = input.required(...(ngDevMode ? [{ debugName: "dfFieldOutlet" }] : /* istanbul ignore next */ []));
    dfFieldOutletEnvironmentInjector = input(undefined, ...(ngDevMode ? [{ debugName: "dfFieldOutletEnvironmentInjector" }] : /* istanbul ignore next */ []));
    vcrRef = inject(ViewContainerRef);
    vcr = signal(this.vcrRef).asReadonly();
    destroyRef = inject(DestroyRef);
    wrapperAutoAssociations = inject(WRAPPER_AUTO_ASSOCIATIONS);
    defaultWrappersSignal = inject(DEFAULT_WRAPPERS, { optional: true });
    readonlyFieldCache = inject(READONLY_FIELD_TREE_CACHE);
    fieldRef;
    /**
     * VCR the `fieldRef`'s host view is currently inserted into (either the outer
     * VCR when there are no wrappers, or the innermost wrapper's `#fieldComponent`
     * slot). Tracked so `beforeRebuild` can detach the view before the outer VCR
     * cascade-destroys it.
     */
    fieldSlot;
    /** Focus + caret captured during detach, replayed after re-insert. */
    focusSnapshot;
    /**
     * Last rawInputs reference pushed to the innermost field. Used to dedupe the
     * rawInputs effect when the same snapshot was already applied as part of the
     * initial render — keeps per-keystroke input updates O(changed-keys) instead
     * of re-walking the whole input bag.
     */
    lastPushedInputs;
    componentIdentity = computed(() => this.dfFieldOutlet().component, ...(ngDevMode ? [{ debugName: "componentIdentity" }] : /* istanbul ignore next */ []));
    renderReady = computed(() => this.dfFieldOutlet().renderReady(), ...(ngDevMode ? [{ debugName: "renderReady" }] : /* istanbul ignore next */ []));
    rawInputs = computed(() => this.dfFieldOutlet().inputs(), ...(ngDevMode ? [{ debugName: "rawInputs" }] : /* istanbul ignore next */ []));
    /**
     * Effective wrapper chain. Element-wise identity comparison keeps the signal
     * stable across `ResolvedField` reference changes that don't actually change
     * the chain — avoids rebuilds on reconciled fields.
     */
    wrappers = computed(() => resolveWrappers(this.dfFieldOutlet().fieldDef, this.defaultWrappersSignal?.(), this.wrapperAutoAssociations), { ...(ngDevMode ? { debugName: "wrappers" } : /* istanbul ignore next */ {}), equal: isSameWrapperChain });
    /**
     * `fieldInputs` bag handed to every wrapper in the chain. Memoised on
     * `rawInputs` identity so repeated emissions with the same underlying object
     * return the same view and don't cascade OnPush re-evaluations.
     */
    fieldInputs = computed(() => this.buildFieldInputs(this.rawInputs()), ...(ngDevMode ? [{ debugName: "fieldInputs" }] : /* istanbul ignore next */ []));
    defaultEnvInjector = inject(EnvironmentInjector);
    /** Environment injector for the innermost field component — `[environmentInjector]` input takes precedence over the directive's own DI. */
    fieldEnvInjector = computed(() => this.dfFieldOutletEnvironmentInjector() ?? this.defaultEnvInjector, ...(ngDevMode ? [{ debugName: "fieldEnvInjector" }] : /* istanbul ignore next */ []));
    /** Field-level injector (FIELD_SIGNAL_CONTEXT, ARRAY_CONTEXT, …). Threaded to the controller so wrappers can inject it too. */
    fieldInjector = computed(() => this.dfFieldOutlet().injector, ...(ngDevMode ? [{ debugName: "fieldInjector" }] : /* istanbul ignore next */ []));
    constructor() {
        createWrapperChainController({
            vcr: this.vcr,
            wrappers: this.wrappers,
            gate: this.renderReady,
            rebuildKey: this.componentIdentity,
            fieldInputs: this.fieldInputs,
            fieldInjector: this.fieldInjector,
            beforeRebuild: () => this.detachFieldRef(),
            renderInnermost: (slot) => {
                const resolved = this.dfFieldOutlet();
                if (this.fieldRef && this.fieldRef.componentType === resolved.component) {
                    // Same component class — re-insert the preserved hostView. Browser
                    // loses focus on detach, so we replay the snapshot captured in
                    // detachFieldRef. Input value persists on the DOM node itself.
                    slot.insert(this.fieldRef.hostView);
                    this.fieldSlot = slot;
                    this.pushRawInputs(this.fieldRef, this.rawInputs());
                    this.restoreFocusSnapshot();
                    return;
                }
                // Different component class — discard the old ref and create fresh.
                // Merge field + element injectors so the field can inject ancestor
                // wrappers AND form-context tokens (ARRAY_CONTEXT etc.).
                // Clear state before createComponent — if it throws (bad provider,
                // invalid class) we don't want to leak a reference to a destroyed ref
                // that the same-component branch would later try to re-insert.
                this.focusSnapshot = undefined;
                this.lastPushedInputs = undefined;
                const previousRef = this.fieldRef;
                this.fieldRef = undefined;
                this.fieldSlot = undefined;
                previousRef?.destroy();
                this.fieldRef = slot.createComponent(resolved.component, {
                    environmentInjector: this.fieldEnvInjector(),
                    injector: createWrapperAwareInjector(resolved.injector, slot.injector),
                });
                this.fieldSlot = slot;
                this.pushRawInputs(this.fieldRef, this.rawInputs());
            },
        });
        // Push rawInputs to the innermost field. Safe mid-rebuild — renderInnermost
        // re-reads rawInputs synchronously on mount, so skipping here loses nothing.
        explicitEffect([this.rawInputs], ([rawInputs]) => {
            if (!this.fieldRef)
                return;
            if (this.lastPushedInputs === rawInputs)
                return;
            this.pushRawInputs(this.fieldRef, rawInputs);
        });
        this.destroyRef.onDestroy(() => {
            // Only destroy when detached — vcr.clear() cascades otherwise.
            if (this.fieldRef && !this.fieldSlot)
                this.fieldRef.destroy();
            this.fieldRef = undefined;
            this.fieldSlot = undefined;
            this.lastPushedInputs = undefined;
        });
    }
    detachFieldRef() {
        if (!this.fieldRef)
            return;
        if (!this.fieldSlot) {
            // Stranded fieldRef — destroy to prevent a leak.
            this.fieldRef.destroy();
            this.fieldRef = undefined;
            return;
        }
        this.captureFocusSnapshot();
        const idx = this.fieldSlot.indexOf(this.fieldRef.hostView);
        if (idx >= 0)
            this.fieldSlot.detach(idx);
        this.fieldSlot = undefined;
    }
    /** Capture active element + selection before the hostView is detached from DOM. */
    captureFocusSnapshot() {
        if (!this.fieldRef)
            return;
        const hostEl = this.fieldRef.location.nativeElement;
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !hostEl.contains(active))
            return;
        const sel = active;
        this.focusSnapshot = {
            element: active,
            selectionStart: typeof sel.selectionStart === 'number' ? sel.selectionStart : null,
            selectionEnd: typeof sel.selectionEnd === 'number' ? sel.selectionEnd : null,
        };
    }
    /** Re-apply the pre-detach focus + caret after the hostView is back in the DOM. */
    restoreFocusSnapshot() {
        const snap = this.focusSnapshot;
        this.focusSnapshot = undefined;
        if (!snap || !snap.element.isConnected)
            return;
        snap.element.focus();
        if (snap.selectionStart !== null && snap.selectionEnd !== null && 'setSelectionRange' in snap.element) {
            snap.element.setSelectionRange(snap.selectionStart, snap.selectionEnd);
        }
    }
    pushRawInputs(ref, rawInputs) {
        // Ref-identity dedupe per key — mappers must emit immutable snapshots.
        const last = this.lastPushedInputs;
        for (const [key, value] of Object.entries(rawInputs)) {
            if (last && last[key] === value)
                continue;
            setInputIfDeclared(ref, key, value);
        }
        this.lastPushedInputs = rawInputs;
    }
    buildFieldInputs(rawInputs) {
        const fieldTreeCandidate = rawInputs['field'];
        // A FieldTree is a callable (() => FieldState). We expose it to wrappers via a narrow
        // read-only view; raw FieldTree is still pushed to the innermost component for writes.
        const readonlyField = fieldTreeCandidate && typeof fieldTreeCandidate === 'function'
            ? toReadonlyFieldTreeCached(this.readonlyFieldCache, fieldTreeCandidate)
            : undefined;
        // Shallow spread — relies on the mapper contract (see WrapperFieldInputs)
        // that rawInputs are emitted as fresh snapshots, not mutated in place.
        return {
            ...rawInputs,
            field: readonlyField,
        };
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: DfFieldOutlet, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "17.1.0", version: "21.2.6", type: DfFieldOutlet, isStandalone: true, selector: "[dfFieldOutlet]", inputs: { dfFieldOutlet: { classPropertyName: "dfFieldOutlet", publicName: "dfFieldOutlet", isSignal: true, isRequired: true, transformFunction: null }, dfFieldOutletEnvironmentInjector: { classPropertyName: "dfFieldOutletEnvironmentInjector", publicName: "dfFieldOutletEnvironmentInjector", isSignal: true, isRequired: false, transformFunction: null } }, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: DfFieldOutlet, decorators: [{
            type: Directive,
            args: [{
                    selector: '[dfFieldOutlet]',
                }]
        }], ctorParameters: () => [], propDecorators: { dfFieldOutlet: [{ type: i0.Input, args: [{ isSignal: true, alias: "dfFieldOutlet", required: true }] }], dfFieldOutletEnvironmentInjector: [{ type: i0.Input, args: [{ isSignal: true, alias: "dfFieldOutletEnvironmentInjector", required: false }] }] } });

/**
 * Wraps a submission action to handle both Promise and Observable returns.
 * Converts Observables to Promises for compatibility with Angular Signal Forms' submit().
 *
 * Errors are NOT caught here — they propagate so that submit() can reject its Promise,
 * allowing the caller's catchError to log and keep the submission stream alive.
 *
 * @param action - The submission action function
 * @returns A wrapped function that returns a Promise
 */
function wrapSubmissionAction(action) {
    return async (formTree) => {
        const result = action(formTree);
        // If the action returns an Observable, convert it to a Promise
        if (isObservable(result)) {
            await firstValueFrom(result);
            return;
        }
        await Promise.resolve(result);
    };
}
/**
 * Creates an Observable that handles form submission with optional submission action.
 *
 * This utility encapsulates the submission handling logic:
 * - Listens for submit events from the event bus
 * - If a submission.action is configured, wraps it and uses Angular Signal Forms' submit()
 * - Handles both Promise and Observable returns from the action
 * - Uses exhaustMap to ignore new submissions while one is in-flight (first-submit-wins)
 *
 * The returned Observable should be subscribed to with takeUntilDestroyed() in the component.
 *
 * @param options - Configuration options for the submission handler
 * @returns Observable that processes submissions (emits when submission completes)
 *
 * @example
 * ```typescript
 * // In component constructor
 * createSubmissionHandler({
 *   eventBus: this.eventBus,
 *   configSignal: this.config,
 *   formSignal: this.form,
 * })
 *   .pipe(takeUntilDestroyed())
 *   .subscribe();
 * ```
 */
function createSubmissionHandler(options) {
    const { eventBus, configSignal, formSignal, validSignal, logger } = options;
    // exhaustMap ensures first-submit-wins: a second submit event while the first
    // is in-flight is silently dropped rather than cancelling the running Promise.
    // switchMap would unsubscribe the Observable wrapper but cannot cancel the
    // underlying Promise, causing both side effects to execute.
    return eventBus.on('submit').pipe(exhaustMap(() => {
        const submissionConfig = configSignal().submission;
        // If no submission action is configured, let the submitted output handle it
        // This maintains backward compatibility for users handling submission manually
        if (!submissionConfig?.action) {
            return EMPTY;
        }
        // Guard: match the (submitted) output's safety contract — reject submission
        // when the form is invalid or has pending async validators.
        if (!validSignal()) {
            logger.debug('Submission action skipped: form is not valid (invalid or pending async validators)');
            return EMPTY;
        }
        // Type assertion needed: submission.action accepts the form tree but its signature
        // is defined broadly in FormConfig. The actual runtime type is FieldTree<TModel>.
        const wrappedAction = wrapSubmissionAction(submissionConfig.action);
        // Use Angular Signal Forms' native submit() function
        // This automatically:
        // - Sets form.submitting() to true during execution
        // - Applies server errors to form fields on completion
        // - Sets form.submitting() to false when done
        // catchError keeps the exhaustMap stream alive after action failure —
        // without it, an unhandled error would terminate all future submissions.
        return from(submit(formSignal(), wrappedAction)).pipe(catchError((error) => {
            logger.error('Submission action failed:', error);
            return EMPTY;
        }));
    }));
}

/**
 * Injection token for globally enabling form value emission on events.
 *
 * When set to `true`, all events dispatched through the EventBus will include
 * the current form value in the `formValue` property.
 *
 * This token is configured via `withEventFormValue()` feature function.
 * Per-form overrides can be set via `options.emitFormValueOnEvents` in the form config.
 *
 * @internal
 */
const EMIT_FORM_VALUE_ON_EVENTS = new InjectionToken('EMIT_FORM_VALUE_ON_EVENTS', {
    providedIn: 'root',
    factory: () => false,
});

/**
 * Registry service that provides access to the root form and its values.
 *
 * Constructed via factory in `provideDynamicFormDI` with signals from
 * `FormStateManager` — no DI injection, no Maps, no lifecycle.
 */
class RootFormRegistryService {
    formValue;
    rootForm;
    constructor(formValue, rootForm) {
        this.formValue = formValue;
        this.rootForm = rootForm;
    }
}

/**
 * No-operation logger implementation.
 * All methods are no-ops - used in production by default.
 */
class NoopLogger {
    debug() {
        // Intentionally empty
    }
    info() {
        // Intentionally empty
    }
    warn() {
        // Intentionally empty
    }
    error() {
        // Intentionally empty
    }
}

/**
 * Safely attempts to inject a dependency using an InjectionToken.
 * Returns the default value if called outside an injection context.
 */
function safeInjectToken(token, defaultValue) {
    try {
        return inject(token, { optional: true }) ?? defaultValue;
    }
    catch {
        return defaultValue;
    }
}
/**
 * Safely attempts to inject a service class.
 * Returns the default value if called outside an injection context.
 */
function safeInjectClass(token, defaultValue) {
    try {
        return inject(token, { optional: true }) ?? defaultValue;
    }
    catch {
        return defaultValue;
    }
}
/**
 * Creates a copy of an event with an additional formValue property.
 * Preserves the event's prototype chain so instanceof checks still work.
 */
function attachFormValue(event, formValue) {
    const prototype = Object.getPrototypeOf(event);
    return Object.assign(Object.create(prototype), event, { formValue });
}
/**
 * Event bus for form-wide event communication between field components.
 *
 * **Intended for use inside DynamicForm** — i.e. within custom field components,
 * field mappers, or other services that live inside the form's component injector.
 * Inject it directly to dispatch or observe events from within a field:
 *
 * ```typescript
 * // Inside a custom field component
 * export class MyFieldComponent {
 *   private readonly eventBus = inject(EventBus);
 *
 *   onAction() {
 *     this.eventBus.dispatch(arrayEvent('items').append(template));
 *   }
 * }
 * ```
 *
 * **If you are outside DynamicForm** (e.g. in a host component or a service that wraps
 * the form), use {@link EventDispatcher} instead. Injecting `EventBus` in a parent
 * component gives you a *different instance* that the form knows nothing about.
 *
 * `EventBus` is scoped to each `DynamicForm` instance via `provideDynamicFormDI()`.
 * It provides type-safe dispatching and RxJS-based subscription for all form events.
 *
 * @see EventDispatcher — for dispatching events from outside the form
 */
const FALLBACK_LOGGER = new NoopLogger();
class EventBus {
    pipeline$ = new Subject();
    globalEmitFormValue = safeInjectToken(EMIT_FORM_VALUE_ON_EVENTS, false);
    rootFormRegistry = safeInjectClass(RootFormRegistryService, null);
    formOptions = safeInjectToken(FORM_OPTIONS, null);
    logger = safeInjectToken(DynamicFormLogger, FALLBACK_LOGGER);
    events$ = this.pipeline$.asObservable();
    dispatch(eventOrConstructor, ...args) {
        if (typeof eventOrConstructor !== 'function' && 'type' in eventOrConstructor) {
            this.emit(eventOrConstructor);
        }
        else {
            this.emit(new eventOrConstructor(...args));
        }
    }
    /**
     * Dispatches a pre-created event instance directly.
     * Used internally by EventDispatcher to forward events into the bus.
     * @internal
     */
    emitInstance(event) {
        this.emit(event);
    }
    /**
     * Shared emit path for both dispatch() and emitInstance().
     * Attaches form value if configured, then pushes to the pipeline.
     */
    emit(event) {
        if (this.shouldEmitFormValue()) {
            const formValue = this.rootFormRegistry?.formValue();
            // Only attach if form value exists and has at least one field.
            // Empty objects {} are not attached - use hasFormValue() to check.
            if (formValue && Object.keys(formValue).length > 0) {
                this.safeEmit(attachFormValue(event, formValue));
                return;
            }
        }
        this.safeEmit(event);
    }
    /**
     * Emits an event through the pipeline. Catches any synchronous exception that escapes
     * RxJS's own error handling so dispatch() callers are never disrupted by a failing subscriber.
     */
    safeEmit(event) {
        try {
            this.pipeline$.next(event);
        }
        catch (err) {
            this.logger.error('[Dynamic Forms] Exception in EventBus subscriber during dispatch', err);
        }
    }
    /**
     * Determines whether form value should be attached to events.
     *
     * Precedence rules:
     * 1. Per-form setting (if defined) takes precedence
     * 2. Falls back to global setting
     */
    shouldEmitFormValue() {
        const formLevelSetting = this.formOptions?.()?.emitFormValueOnEvents;
        return formLevelSetting ?? this.globalEmitFormValue;
    }
    /**
     * Subscribes to form events with type-safe filtering.
     *
     * Provides a reactive stream of events filtered by type. Supports both single
     * event type subscriptions and multi-type subscriptions for flexible event handling.
     *
     * @param eventType - Event type string or array of event type strings to filter by
     * @returns Observable stream of filtered events
     *
     * @example
     * ```typescript
     * // Subscribe to a single event type
     * eventBus.on<SubmitEvent>('submit').subscribe(event => {
     *   console.log('Submit event received');
     * });
     *
     * // Subscribe to multiple event types
     * eventBus.on<SubmitEvent | FormResetEvent | ValidationErrorEvent>(['submit', 'form-reset', 'validation-error']).subscribe(event => {
     *   switch (event.type) {
     *     case 'submit':
     *       handleSubmit();
     *       break;
     *     case 'form-reset':
     *       handleReset();
     *       break;
     *     case 'validation-error':
     *       handleValidationError();
     *       break;
     *   }
     * });
     * ```
     */
    on(eventType) {
        if (Array.isArray(eventType)) {
            return this.pipeline$.pipe(filter((event) => eventType.includes(event.type)));
        }
        return this.pipeline$.pipe(filter((event) => event.type === eventType));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: EventBus, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: EventBus });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: EventBus, decorators: [{
            type: Injectable
        }] });

class SubmitEvent {
    type = 'submit';
}

class ComponentInitializedEvent {
    componentType;
    componentId;
    type = 'component-initialized';
    constructor(componentType, componentId) {
        this.componentType = componentType;
        this.componentId = componentId;
    }
}

/**
 * Injection token for configuring the initialization timeout in milliseconds.
 * Defaults to 10 seconds. When the timeout is reached, a warning is logged
 * and (initialized) emits true as a best-effort fallback.
 */
const INITIALIZATION_TIMEOUT_MS = new InjectionToken('INITIALIZATION_TIMEOUT_MS', {
    providedIn: 'root',
    factory: () => 10_000,
});
/**
 * Creates an observable that tracks component initialization progress.
 *
 * This function returns an observable that emits when all expected components
 * have been initialized. It uses the scan operator to accumulate initialization
 * events and emits true when the count reaches the expected total.
 *
 * @param eventBus - The event bus instance to subscribe to
 * @param expectedCount - Total number of components expected to initialize
 * @returns Observable<boolean> that emits true when all components are initialized
 *
 * @example
 * ```typescript
 * const eventBus = inject(EventBus);
 * const totalComponents = 5; // 1 dynamic-form + 2 pages + 1 row + 1 group
 *
 * const allInitialized$ = createInitializationTracker(eventBus, totalComponents);
 *
 * allInitialized$.subscribe(isComplete => {
 *   if (isComplete) {
 *     console.log('All components are initialized!');
 *   }
 * });
 * ```
 */
function createInitializationTracker(eventBus, expectedCount) {
    return eventBus.on('component-initialized').pipe(scan((count) => count + 1, 0), map$1((currentCount) => currentCount >= expectedCount), filter$1((isComplete) => isComplete));
}
/**
 * Creates an observable that tracks component initialization progress with detailed status.
 *
 * This function returns an observable that emits the current count and completion status
 * for each initialization event, providing more granular tracking capabilities.
 *
 * @param eventBus - The event bus instance to subscribe to
 * @param expectedCount - Total number of components expected to initialize
 * @returns Observable with current count, expected count, and completion status
 *
 * @example
 * ```typescript
 * const eventBus = inject(EventBus);
 * const totalComponents = 5;
 *
 * const progress$ = createDetailedInitializationTracker(eventBus, totalComponents);
 *
 * progress$.subscribe(({ currentCount, expectedCount, isComplete }) => {
 *   console.log(`Progress: ${currentCount}/${expectedCount} (${isComplete ? 'Complete' : 'In Progress'})`);
 * });
 * ```
 */
function createDetailedInitializationTracker(eventBus, expectedCount) {
    return eventBus.on('component-initialized').pipe(scan((count) => count + 1, 0), map$1((currentCount) => ({
        currentCount,
        expectedCount,
        isComplete: currentCount >= expectedCount,
    })));
}
/**
 * Creates an observable that tracks when all form components are initialized.
 * Uses shareReplay({ bufferSize: 1, refCount: false }) to ensure exactly one emission
 * that can be received by late subscribers and keeps the subscription alive.
 *
 * Includes a configurable timeout (default 10s via INITIALIZATION_TIMEOUT_MS)
 * so that (initialized) does not hang forever if a container component throws
 * before emitting its initialization event. On timeout, a warning is logged
 * and true is emitted as a best-effort fallback.
 *
 * @param options - Configuration options for initialization tracking
 * @returns Observable<boolean> that emits true when all components are initialized
 *
 * @example
 * ```typescript
 * const eventBus = inject(EventBus);
 * const totalComponents = computed(() => countContainerComponents(fields));
 *
 * readonly initialized$ = setupInitializationTracking({
 *   eventBus,
 *   totalComponentsCount: totalComponents,
 *   injector: this.injector,
 *   componentId: 'dynamic-form'
 * });
 * ```
 */
function setupInitializationTracking(options) {
    const { eventBus, totalComponentsCount, injector, componentId } = options;
    const timeoutMs = injector.get(INITIALIZATION_TIMEOUT_MS);
    const logger = injector.get(DynamicFormLogger);
    return toObservable(totalComponentsCount, { injector }).pipe(take(1), switchMap$1((count) => {
        let tracking$;
        if (count === 1) {
            // Only dynamic-form component, emit immediately when it initializes
            tracking$ = eventBus.on('component-initialized').pipe(filter$1((event) => event.componentType === 'dynamic-form' && event.componentId === componentId), map$1(() => true), take(1));
        }
        else {
            tracking$ = createInitializationTracker(eventBus, count);
        }
        // Timeout guard: emit best-effort true if a container throws before initializing
        return tracking$.pipe(timeout(timeoutMs), catchError$1((error) => {
            if (error instanceof TimeoutError) {
                logger.warn(`Initialization timed out after ${timeoutMs}ms. ` +
                    `Expected ${count} component(s) to initialize but not all reported in time. ` +
                    'This may indicate a container component threw during initialization. ' +
                    'Emitting (initialized) as best-effort.');
                // Emit true as best-effort so consumers are not stuck waiting forever
                return of(true);
            }
            return throwError(() => error);
        }));
    }), shareReplay({ bufferSize: 1, refCount: false }));
}

/**
 * Type guard to check if a field is a hidden field.
 *
 * @param field - The field to check
 * @returns True if the field is a HiddenField
 */
function isHiddenField(field) {
    return field.type === 'hidden';
}

/**
 * Type guard for GroupField with proper type narrowing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type guard must accept any field type
function isGroupField(field) {
    return field.type === 'group' && 'fields' in field;
}

/**
 * Type guard for RowField with proper type narrowing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type guard must accept any field type
function isRowField(field) {
    return field.type === 'row' && 'fields' in field && Array.isArray(field.fields);
}
/**
 * Validates that a row field doesn't contain hidden fields.
 * Hidden fields are not allowed in rows because rows are for horizontal layouts,
 * and hidden fields don't render anything.
 *
 * @param rowField The row field to validate
 * @returns true if valid (no hidden fields), false otherwise
 */
function validateRowNesting(rowField) {
    return !hasHiddenFields(rowField.fields);
}
/**
 * Recursively checks if fields contain any hidden fields
 * @param fields Array of field definitions to check
 * @returns true if hidden fields found, false otherwise
 */
function hasHiddenFields(fields) {
    for (const field of fields) {
        if (isHiddenField(field)) {
            return true;
        }
        // Check group fields for nested hidden fields
        if (isGroupField(field)) {
            if (hasHiddenFields(field.fields)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Type guard for PageField with proper type narrowing
 */
function isPageField(field) {
    return field.type === 'page' && 'fields' in field && Array.isArray(field.fields);
}
/**
 * Validates that a page field doesn't contain nested page fields
 * @param pageField The page field to validate
 * @returns true if valid (no nested pages), false otherwise
 */
function validatePageNesting(pageField) {
    return !hasNestedPages(pageField.fields);
}
/**
 * Type guard to check if a field is a container with fields property
 */
function isContainerWithFields$1(field) {
    return (isRowField(field) || isGroupField(field)) && 'fields' in field && Array.isArray(field.fields);
}
/**
 * Recursively checks if fields contain any nested page fields
 * @param fields Array of field definitions to check
 * @returns true if nested pages found, false otherwise
 */
function hasNestedPages(fields) {
    for (const field of fields) {
        if (isPageField(field)) {
            return true;
        }
        // Check row and group fields for nested pages
        if (isContainerWithFields$1(field)) {
            if (hasNestedPages(field.fields)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Type guard for ArrayField with proper type narrowing.
 * Validates that the field is an array type with a fields property that is an array.
 * Fields can contain either single FieldDefs (primitive items) or arrays of FieldDefs (object items).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type guard must accept any field type
function isArrayField(field) {
    return field.type === 'array' && 'fields' in field && Array.isArray(field.fields);
}
/**
 * Type guard for SimplifiedArrayField.
 * Checks for `type: 'array'` with a `template` property (discriminant from full ArrayField).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type guard must accept any field type
function isSimplifiedArrayField(field) {
    return field.type === 'array' && 'template' in field;
}

/**
 * Type guard for ContainerField with proper type narrowing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type guard must accept any field type
function isContainerTypedField(field) {
    return field.type === 'container' && 'fields' in field && 'wrappers' in field;
}

/**
 * Type guard to check if a field definition has child fields.
 * This is a looser check that works with FieldDef<unknown> without requiring RegisteredFieldTypes.
 */
function hasChildFields(field) {
    return 'fields' in field && field.fields != null;
}
/** Container field type names */
const CONTAINER_TYPES$1 = new Set(['page', 'row', 'group', 'array', 'container']);
function isContainerField(field) {
    return CONTAINER_TYPES$1.has(field.type);
}
/**
 * Type guard to check if a field is a leaf field (value or display field)
 * Leaf fields don't have children and either contribute values or display content
 */
function isLeafField(field) {
    return !isContainerField(field);
}
/**
 * Type guard to check if a field has a value property (value-bearing field)
 * These fields contribute to the form value output
 * Note: Using `unknown` in the Extract condition to match any value type
 */
function isValueBearingField(field) {
    return 'value' in field;
}
/**
 * Type guard to check if a field is excluded from form values (display-only field)
 * Currently this includes text fields and any other fields without a value property
 */
function isDisplayOnlyField(field) {
    return field.type === 'text' || isContainerField(field);
}

/**
 * Default debounce duration in milliseconds.
 */
const DEFAULT_DEBOUNCE_MS = 500;
/**
 * Creates a debounced effect that triggers a callback after a signal's value
 * has stabilized for the specified duration.
 *
 * Uses Angular's `toObservable` and `toSignal` with RxJS `debounceTime` for proper debouncing.
 * This approach is cleaner than manual setTimeout management and integrates
 * well with Angular's signal-based reactivity.
 *
 * @param source - The source signal to watch for changes
 * @param callback - Function to call with the debounced value
 * @param options - Configuration options
 * @param options.ms - Debounce duration in milliseconds (default: 500)
 * @param options.injector - Angular injector for the effect context
 *
 * @returns A signal that emits the debounced value (can be ignored if only side effects are needed)
 *
 * @example
 * ```typescript
 * // In a component or service
 * const searchInput = signal('');
 *
 * createDebouncedEffect(
 *   searchInput,
 *   (value) => console.log('Debounced search:', value),
 *   { ms: 300, injector: this.injector }
 * );
 * ```
 *
 * @public
 */
function createDebouncedEffect(source, callback, options) {
    const { ms = DEFAULT_DEBOUNCE_MS, injector } = options;
    const source$ = toObservable(source, { injector }).pipe(debounceTime(ms), distinctUntilChanged(), tap((value) => callback(value)));
    return toSignal(source$, { injector });
}
/**
 * Creates a debounced signal that emits values from the source signal
 * only after the value has stabilized for the specified duration.
 *
 * Unlike `createDebouncedEffect`, this doesn't execute a side effect callback.
 * Use this when you just need a debounced version of a signal.
 *
 * @param source - The source signal to debounce
 * @param options - Configuration options
 * @param options.ms - Debounce duration in milliseconds (default: 500)
 * @param options.injector - Angular injector for the effect context
 *
 * @returns A signal that emits the debounced value
 *
 * @example
 * ```typescript
 * const input = signal('');
 * const debouncedInput = createDebouncedSignal(input, { ms: 300, injector });
 *
 * effect(() => {
 *   console.log('Debounced value:', debouncedInput());
 * });
 * ```
 *
 * @public
 */
function createDebouncedSignal(source, options) {
    const { ms = DEFAULT_DEBOUNCE_MS, injector } = options;
    const source$ = toObservable(source, { injector }).pipe(debounceTime(ms), distinctUntilChanged());
    return toSignal(source$, { injector });
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
function isEqual(a, b) {
    return isEqualInternal(a, b, new WeakMap(), new WeakMap());
}
/**
 * Internal implementation with circular reference tracking.
 * @internal
 */
function isEqualInternal(a, b, seenA, seenB) {
    // Same reference or both null/undefined
    if (a === b)
        return true;
    // Handle NaN (NaN === NaN is false, but we want it to be equal)
    if (typeof a === 'number' && typeof b === 'number') {
        return Object.is(a, b);
    }
    // One is null/undefined but not both
    if (a == null || b == null)
        return false;
    // Different types
    if (typeof a !== typeof b)
        return false;
    // Non-object primitives (strings, booleans, symbols, bigints)
    if (typeof a !== 'object') {
        return Object.is(a, b);
    }
    // At this point, both a and b are objects (typeof a === 'object')
    const objA = a;
    const objB = b;
    // Check for circular references
    if (seenA.has(objA) || seenB.has(objB)) {
        // If we've seen these objects before, check if they were paired together
        return seenA.get(objA) === objB && seenB.get(objB) === objA;
    }
    // Mark these objects as seen (paired together)
    seenA.set(objA, objB);
    seenB.set(objB, objA);
    // Different constructors means different types (e.g., Date vs Object)
    if (objA.constructor !== objB.constructor)
        return false;
    // Handle dates
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }
    // Handle RegExp
    if (a instanceof RegExp && b instanceof RegExp) {
        return a.source === b.source && a.flags === b.flags;
    }
    // Handle Map
    if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size)
            return false;
        for (const [key, value] of a) {
            if (!b.has(key) || !isEqualInternal(value, b.get(key), seenA, seenB)) {
                return false;
            }
        }
        return true;
    }
    // Handle Set
    if (a instanceof Set && b instanceof Set) {
        if (a.size !== b.size)
            return false;
        for (const value of a) {
            if (!b.has(value)) {
                // For non-primitive values in Sets, we need deep comparison
                // This is O(n^2) but Sets rarely contain objects
                if (typeof value === 'object' && value !== null) {
                    let found = false;
                    for (const bValue of b) {
                        if (typeof bValue === 'object' && bValue !== null && isEqualInternal(value, bValue, seenA, seenB)) {
                            found = true;
                            break;
                        }
                    }
                    if (!found)
                        return false;
                }
                else {
                    return false;
                }
            }
        }
        return true;
    }
    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length)
            return false;
        return a.every((item, index) => isEqualInternal(item, b[index], seenA, seenB));
    }
    // Handle plain objects
    const recordA = a;
    const recordB = b;
    // Get both string and symbol keys
    const keysA = [...Object.keys(recordA), ...Object.getOwnPropertySymbols(recordA)];
    const keysB = [...Object.keys(recordB), ...Object.getOwnPropertySymbols(recordB)];
    if (keysA.length !== keysB.length)
        return false;
    // Create a Set for O(1) lookup
    const keySetB = new Set(keysB);
    return keysA.every((key) => keySetB.has(key) && isEqualInternal(recordA[key], recordB[key], seenA, seenB));
}
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
function omit(obj, keys) {
    const result = { ...obj };
    keys.forEach((key) => delete result[key]);
    return result;
}
/**
 * Creates an object from an array, keyed by a specified property
 * Native replacement for lodash keyBy()
 *
 * @param array - Source array
 * @param key - Property to use as key
 * @returns Object keyed by the specified property
 *
 * @example
 * ```typescript
 * const users = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];
 * keyBy(users, 'id'); // { a: { id: 'a', name: 'Alice' }, b: { id: 'b', name: 'Bob' } }
 * ```
 */
function keyBy(array, key) {
    return array.reduce((acc, item) => {
        acc[String(item[key])] = item;
        return acc;
    }, {});
}
/**
 * Maps object values through a transformation function
 * Native replacement for lodash mapValues()
 *
 * @param obj - Source object
 * @param fn - Transformation function
 * @returns New object with transformed values
 *
 * @example
 * ```typescript
 * const obj = { a: 1, b: 2 };
 * mapValues(obj, (v) => v * 2); // { a: 2, b: 4 }
 * ```
 */
function mapValues(obj, fn) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
        acc[key] = fn(value, key);
        return acc;
    }, {});
}
/**
 * Options for memoize function
 */
/** Default maximum cache size for memoized functions */
const DEFAULT_MEMOIZE_MAX_SIZE = 100;
/**
 * Memoizes a function with LRU cache eviction and optional custom cache key resolver.
 *
 * @param fn - Function to memoize
 * @param resolverOrOptions - Optional key resolver function or options object
 * @returns Memoized function
 *
 * @example
 * ```typescript
 * const expensive = (a: number, b: number) => a + b;
 * const memoized = memoize(expensive); // Uses default maxSize of 100
 *
 * // With custom resolver
 * const withResolver = memoize(expensive, (a, b) => `${a}-${b}`);
 *
 * // With custom maxSize
 * const small = memoize(expensive, { maxSize: 10 });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function memoize(fn, resolverOrOptions) {
    const options = typeof resolverOrOptions === 'function' ? { resolver: resolverOrOptions } : (resolverOrOptions ?? {});
    const { resolver, maxSize = DEFAULT_MEMOIZE_MAX_SIZE } = options;
    const cache = new Map();
    return ((...args) => {
        const key = resolver ? resolver(...args) : JSON.stringify(args);
        const cachedValue = cache.get(key);
        if (cachedValue !== undefined) {
            cache.delete(key);
            cache.set(key, cachedValue);
            return cachedValue;
        }
        const result = fn(...args);
        if (cache.size >= maxSize) {
            const oldestKey = cache.keys().next().value;
            if (oldestKey !== undefined) {
                cache.delete(oldestKey);
            }
        }
        cache.set(key, result);
        return result;
    });
}
/**
 * Normalizes a fields collection to an array.
 * Handles both array format and object format (keyed by field key).
 *
 * @param fields - Fields as array or object
 * @returns Fields as array
 */
function normalizeFieldsArray(fields) {
    return Array.isArray(fields) ? [...fields] : Object.values(fields);
}
/**
 * Gets the keys that differ between two objects.
 *
 * Compares top-level keys and returns those whose values are different.
 * Uses deep equality comparison for nested values.
 *
 * @param previous - Previous object state
 * @param current - Current object state
 * @returns Set of keys that have different values
 *
 * @example
 * ```typescript
 * const prev = { a: 1, b: 2, c: 3 };
 * const curr = { a: 1, b: 5, d: 4 };
 * getChangedKeys(prev, curr); // Set { 'b', 'c', 'd' }
 * ```
 */
function getChangedKeys(previous, current) {
    const changedKeys = new Set();
    // Handle null/undefined cases
    if (!previous && !current)
        return changedKeys;
    if (!previous) {
        return new Set(Object.keys(current ?? {}));
    }
    if (!current) {
        return new Set(Object.keys(previous));
    }
    // Collect all keys from both objects
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    // Check each key for differences
    for (const key of allKeys) {
        const prevValue = previous[key];
        const currValue = current[key];
        // Key added or removed
        if (!(key in previous) || !(key in current)) {
            changedKeys.add(key);
            continue;
        }
        // Value changed
        if (!isEqual(prevValue, currValue)) {
            changedKeys.add(key);
        }
    }
    return changedKeys;
}
/**
 * Fast 32-bit FNV-1a hash for strings.
 * Used as a cache key to avoid expensive string concatenation in memoize resolvers.
 *
 * @param str - String to hash
 * @returns 32-bit integer hash
 */
function simpleStringHash(str) {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) | 0; // FNV prime, keep as 32-bit int
    }
    return hash;
}
/**
 * Compile-time exhaustiveness check for discriminated unions.
 *
 * Place in the `default` branch of a `switch` over a union's discriminant.
 * TypeScript narrows the value to `never` only when every member is handled;
 * adding a new member without a matching `case` produces a type error here.
 *
 * At runtime, throws if somehow reached (defensive guard).
 *
 * @example
 * ```ts
 * switch (action.type) {
 *   case 'a': return handleA(action);
 *   case 'b': return handleB(action);
 *   default:  return assertNever(action);
 * }
 * ```
 */
function assertNever(value) {
    throw new DynamicFormError(`Unexpected value: ${JSON.stringify(value)}`);
}

/**
 * Registry service for custom functions and validators
 *
 * This service maintains six separate registries:
 *
 * 1. **Custom Functions** - For conditional expressions (when/readonly/disabled)
 *    - Used in: when conditions, readonly logic, disabled logic
 *    - Return type: any value (typically boolean)
 *    - Example: `isAdult: (ctx) => ctx.age >= 18`
 *
 * 2. **Custom Validators** - For synchronous validation using Angular's public FieldContext API
 *    - Used in: validators array on fields
 *    - Return type: ValidationError | ValidationError[] | null
 *    - Example: `noSpaces: (ctx) => ctx.value().includes(' ') ? { kind: 'noSpaces' } : null`
 *
 * 3. **Async Validators** - For asynchronous validation (debouncing, database lookups, etc.)
 *    - Used in: validators array on fields with type 'async'
 *    - Return type: Observable<ValidationError | ValidationError[] | null>
 *    - Example: `checkUsername: (ctx) => userService.checkAvailability(ctx.value())`
 *
 * 4. **HTTP Validators** - For HTTP-based validation with automatic request cancellation
 *    - Used in: validators array on fields with type 'http'
 *    - Configuration object with url, method, mapResponse, etc.
 *    - Example: `{ url: '/api/check', method: 'GET', mapResponse: ... }`
 *
 * 5. **Async Derivation Functions** - For asynchronous value derivation via Promise/Observable
 *    - Used in: derivation config with `asyncFunctionName`
 *    - Return type: Promise<unknown> | Observable<unknown>
 *    - Example: `fetchPrice: (ctx) => priceService.get(ctx.formValue.productId)`
 *
 * 6. **Async Condition Functions** - For asynchronous boolean conditions via Promise/Observable
 *    - Used in: condition config with `type: 'async'` and `asyncFunctionName`
 *    - Return type: Promise<boolean> | Observable<boolean>
 *    - Example: `checkAdmin: (ctx) => authService.hasRole(ctx.formValue.userId, 'admin')`
 *
 * @example
 * ```typescript
 * // Register a custom function for expressions
 * registry.registerCustomFunction('isAdult', (ctx) => ctx.age >= 18);
 *
 * // Use in field configuration
 * {
 *   key: 'alcoholPreference',
 *   when: { function: 'isAdult' }
 * }
 *
 * // Register a custom validator
 * registry.registerValidator('noSpaces', (ctx) => {
 *   const value = ctx.value();
 *   return typeof value === 'string' && value.includes(' ')
 *     ? { kind: 'noSpaces' }
 *     : null;
 * });
 *
 * // Use in field configuration
 * {
 *   key: 'username',
 *   validators: [{ type: 'custom', functionName: 'noSpaces' }],
 *   validationMessages: {
 *     noSpaces: 'Spaces are not allowed'
 *   }
 * }
 * ```
 */
class FunctionRegistryService {
    customFunctions = new Map();
    customFunctionScopes = new Map();
    derivationFunctions = new Map();
    asyncDerivationFunctions = new Map();
    asyncConditionFunctions = new Map();
    validators = new Map();
    asyncValidators = new Map();
    httpValidators = new Map();
    /**
     * Register a custom function for conditional expressions
     *
     * Custom functions are used for control flow logic (when/readonly/disabled),
     * NOT for validation. They return any value, typically boolean.
     *
     * @param name - Unique identifier for the function
     * @param fn - Function that receives EvaluationContext and returns any value
     * @param options - Optional configuration for the function
     *
     * @example
     * ```typescript
     * // Form-level function (default) - may access other fields
     * registry.registerCustomFunction('isAdult', (ctx) => ctx.formValue.age >= 18);
     *
     * // Field-level function - only uses current field value (performance optimization)
     * registry.registerCustomFunction('isEmpty', (ctx) => !ctx.fieldValue, { scope: 'field' });
     * ```
     */
    registerCustomFunction(name, fn, options) {
        this.customFunctions.set(name, fn);
        // Store scope (default to 'form' for conservative cross-field detection)
        this.customFunctionScopes.set(name, options?.scope ?? 'form');
    }
    /**
     * Get the scope of a registered custom function.
     *
     * @param name - The function name
     * @returns The function scope, or undefined if not registered
     */
    getCustomFunctionScope(name) {
        return this.customFunctionScopes.get(name);
    }
    /**
     * Check if a custom function is field-scoped (no cross-field dependencies).
     *
     * @param name - The function name
     * @returns true if the function is field-scoped, false if form-scoped or not registered
     */
    isFieldScopedFunction(name) {
        return this.customFunctionScopes.get(name) === 'field';
    }
    /**
     * Get all custom functions as an object
     */
    getCustomFunctions() {
        return Object.fromEntries(this.customFunctions);
    }
    /**
     * Clear all custom functions and their scopes
     */
    clearCustomFunctions() {
        this.customFunctions.clear();
        this.customFunctionScopes.clear();
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Derivation Functions
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Register a derivation function for value derivation logic.
     *
     * Derivation functions compute derived values and are called when a
     * `DerivationLogicConfig` references them by `functionName`.
     *
     * @param name - Unique identifier for the function
     * @param fn - Function that receives EvaluationContext and returns the derived value
     *
     * @example
     * ```typescript
     * registry.registerDerivationFunction('getCurrencyForCountry', (ctx) => {
     *   const countryToCurrency = { 'USA': 'USD', 'Germany': 'EUR', 'UK': 'GBP' };
     *   return countryToCurrency[ctx.formValue.country] ?? 'USD';
     * });
     * ```
     */
    registerDerivationFunction(name, fn) {
        this.derivationFunctions.set(name, fn);
    }
    /**
     * Get a derivation function by name
     */
    getDerivationFunction(name) {
        return this.derivationFunctions.get(name);
    }
    /**
     * Get all derivation functions as an object
     */
    getDerivationFunctions() {
        return Object.fromEntries(this.derivationFunctions);
    }
    /**
     * Set derivation functions from a config object.
     * Only updates functions if their references have changed.
     *
     * @param derivations - Object mapping function names to derivation functions
     */
    setDerivationFunctions(derivations) {
        this.setRegistryIfChanged(this.derivationFunctions, derivations);
    }
    /**
     * Clear all derivation functions
     */
    clearDerivationFunctions() {
        this.derivationFunctions.clear();
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Async Derivation Functions
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Register an async derivation function.
     *
     * Async derivation functions perform asynchronous operations (service calls,
     * complex pipelines) and return the derived value via a Promise or Observable.
     *
     * @param name - Unique identifier for the function
     * @param fn - Function that receives EvaluationContext and returns Promise/Observable
     */
    registerAsyncDerivationFunction(name, fn) {
        this.asyncDerivationFunctions.set(name, fn);
    }
    /**
     * Get an async derivation function by name
     */
    getAsyncDerivationFunction(name) {
        return this.asyncDerivationFunctions.get(name);
    }
    /**
     * Get all async derivation functions as an object
     */
    getAsyncDerivationFunctions() {
        return Object.fromEntries(this.asyncDerivationFunctions);
    }
    /**
     * Set async derivation functions from a config object.
     * Only updates functions if their references have changed.
     *
     * @param fns - Object mapping function names to async derivation functions
     */
    setAsyncDerivationFunctions(fns) {
        this.setRegistryIfChanged(this.asyncDerivationFunctions, fns);
    }
    /**
     * Clear all async derivation functions
     */
    clearAsyncDerivationFunctions() {
        this.asyncDerivationFunctions.clear();
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Async Condition Functions
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Register an async condition function.
     *
     * Async condition functions perform asynchronous operations and return a boolean.
     *
     * @param name - Unique identifier for the function
     * @param fn - Function that receives EvaluationContext and returns Promise/Observable of boolean
     */
    registerAsyncConditionFunction(name, fn) {
        this.asyncConditionFunctions.set(name, fn);
    }
    /**
     * Get an async condition function by name
     */
    getAsyncConditionFunction(name) {
        return this.asyncConditionFunctions.get(name);
    }
    /**
     * Get all async condition functions as an object
     */
    getAsyncConditionFunctions() {
        return Object.fromEntries(this.asyncConditionFunctions);
    }
    /**
     * Set async condition functions from a config object.
     * Only updates functions if their references have changed.
     *
     * @param fns - Object mapping function names to async condition functions
     */
    setAsyncConditionFunctions(fns) {
        this.setRegistryIfChanged(this.asyncConditionFunctions, fns);
    }
    /**
     * Clear all async condition functions
     */
    clearAsyncConditionFunctions() {
        this.asyncConditionFunctions.clear();
    }
    /**
     * Register a custom validator using Angular's public FieldContext API
     *
     * Validators receive the full FieldContext, allowing access to:
     * - Current field value: `ctx.value()`
     * - Field state: `ctx.state` (errors, touched, dirty, etc.)
     * - Other field values: `ctx.valueOf(path)` (public API!)
     * - Other field states: `ctx.stateOf(path)`
     * - Parameters from JSON configuration via second argument
     *
     * @param name - Unique identifier for the validator
     * @param fn - Validator function (ctx, params?) => ValidationError | ValidationError[] | null
     *
     * @example Single Field Validation
     * ```typescript
     * registry.registerValidator('noSpaces', (ctx) => {
     *   const value = ctx.value();
     *   if (typeof value === 'string' && value.includes(' ')) {
     *     return { kind: 'noSpaces' };
     *   }
     *   return null;
     * });
     * ```
     *
     * @example Cross-Field Validation (Public API)
     * ```typescript
     * registry.registerValidator('lessThan', (ctx, params) => {
     *   const value = ctx.value();
     *   const compareToPath = params?.field as string;
     *
     *   // Use valueOf() to access other fields - public API!
     *   const otherValue = ctx.valueOf(compareToPath as any);
     *
     *   if (otherValue !== undefined && value >= otherValue) {
     *     return { kind: 'notLessThan' };
     *   }
     *   return null;
     * });
     * ```
     *
     * @example Multiple Errors (Cross-Field Validation)
     * ```typescript
     * registry.registerValidator('validateDateRange', (ctx) => {
     *   const errors: ValidationError[] = [];
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
     * });
     * ```
     */
    registerValidator(name, fn) {
        this.validators.set(name, fn);
    }
    /**
     * Get a validator by name
     */
    getValidator(name) {
        return this.validators.get(name);
    }
    /**
     * Clear all validators
     */
    clearValidators() {
        this.validators.clear();
    }
    /**
     * Register an async validator using Angular's public validateAsync() API
     *
     * Async validators return Observables for asynchronous validation logic.
     * Use for debouncing, database lookups, or complex async business logic.
     *
     * @param name - Unique identifier for the async validator
     * @param fn - Async validator function (ctx, params?) => Observable<ValidationError | ValidationError[] | null>
     *
     * @example Debounced Username Check
     * ```typescript
     * registry.registerAsyncValidator('checkUsernameAvailable', (ctx) => {
     *   const username = ctx.value();
     *   return of(username).pipe(
     *     debounceTime(300),
     *     switchMap(name => userService.checkAvailability(name)),
     *     map(available => available ? null : { kind: 'usernameTaken' })
     *   );
     * });
     * ```
     *
     * @example Async Cross-Field Validation
     * ```typescript
     * registry.registerAsyncValidator('validatePasswordStrength', (ctx) => {
     *   const password = ctx.value();
     *   const email = ctx.valueOf('email' as any);
     *   return passwordService.checkStrength(password, email).pipe(
     *     map(result => result.strong ? null : { kind: 'weakPassword' })
     *   );
     * });
     * ```
     */
    registerAsyncValidator(name, fn) {
        this.asyncValidators.set(name, fn);
    }
    /**
     * Get an async validator by name
     */
    getAsyncValidator(name) {
        return this.asyncValidators.get(name);
    }
    /**
     * Clear all async validators
     */
    clearAsyncValidators() {
        this.asyncValidators.clear();
    }
    /**
     * Register an HTTP validator configuration using Angular's public validateHttp() API
     *
     * HTTP validators provide optimized HTTP validation with automatic request cancellation,
     * caching, and debouncing. Preferred over AsyncCustomValidator for HTTP requests.
     *
     * @param name - Unique identifier for the HTTP validator
     * @param config - HTTP validator configuration object
     *
     * @example Username Availability Check
     * ```typescript
     * registry.registerHttpValidator('checkUsername', {
     *   url: (ctx) => `/api/users/check-username?username=${encodeURIComponent(ctx.value())}`,
     *   method: 'GET',
     *   mapResponse: (response, ctx) => {
     *     return response.available ? null : { kind: 'usernameTaken' };
     *   }
     * });
     * ```
     *
     * @example POST Request with Body
     * ```typescript
     * registry.registerHttpValidator('validateAddress', {
     *   url: '/api/validate-address',
     *   method: 'POST',
     *   body: (ctx) => ({
     *     street: ctx.valueOf('street' as any),
     *     city: ctx.valueOf('city' as any),
     *     zipCode: ctx.value()
     *   }),
     *   mapResponse: (response) => {
     *     return response.valid ? null : { kind: 'invalidAddress' };
     *   },
     *   debounceTime: 500
     * });
     * ```
     */
    registerHttpValidator(name, config) {
        this.httpValidators.set(name, config);
    }
    /**
     * Get an HTTP validator by name
     */
    getHttpValidator(name) {
        return this.httpValidators.get(name);
    }
    /**
     * Clear all HTTP validators
     */
    clearHttpValidators() {
        this.httpValidators.clear();
    }
    /**
     * Generic helper to set registry values only if they have changed
     * @param registry - The Map to update
     * @param values - Object mapping keys to values
     */
    setRegistryIfChanged(registry, values) {
        if (!values)
            return;
        const entries = Object.entries(values);
        const hasChanges = entries.some(([name, value]) => registry.get(name) !== value);
        if (hasChanges) {
            entries.forEach(([name, value]) => registry.set(name, value));
        }
    }
    /**
     * Set validators from a config object
     * Only updates validators if their references have changed
     *
     * @param validators - Object mapping validator names to validator functions
     */
    setValidators(validators) {
        this.setRegistryIfChanged(this.validators, validators);
    }
    /**
     * Set async validators from a config object
     * Only updates validators if their references have changed
     *
     * @param asyncValidators - Object mapping validator names to async validator configs
     */
    setAsyncValidators(asyncValidators) {
        this.setRegistryIfChanged(this.asyncValidators, asyncValidators);
    }
    /**
     * Set HTTP validators from a config object
     * Only updates validators if their references have changed
     *
     * @param httpValidators - Object mapping validator names to HTTP validator configs
     */
    setHttpValidators(httpValidators) {
        this.setRegistryIfChanged(this.httpValidators, httpValidators);
    }
    /**
     * Clear everything (functions and all validators)
     */
    clearAll() {
        this.clearCustomFunctions();
        this.clearDerivationFunctions();
        this.clearAsyncDerivationFunctions();
        this.clearAsyncConditionFunctions();
        this.clearValidators();
        this.clearAsyncValidators();
        this.clearHttpValidators();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: FunctionRegistryService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: FunctionRegistryService });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: FunctionRegistryService, decorators: [{
            type: Injectable
        }] });

class SchemaRegistryService {
    registeredSchemas = new Map();
    /**
     * Register a reusable schema
     */
    registerSchema(schema) {
        this.registeredSchemas.set(schema.name, schema);
    }
    /**
     * Get registered schema by name
     */
    getSchema(name) {
        return this.registeredSchemas.get(name);
    }
    /**
     * Get all registered schemas
     */
    getAllSchemas() {
        return new Map(this.registeredSchemas);
    }
    /**
     * Clear all registered schemas
     */
    clearSchemas() {
        this.registeredSchemas.clear();
    }
    /**
     * Resolve schema from string reference or direct definition
     */
    resolveSchema(schema) {
        if (typeof schema === 'string') {
            return this.getSchema(schema) || null;
        }
        return schema;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: SchemaRegistryService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: SchemaRegistryService });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: SchemaRegistryService, decorators: [{
            type: Injectable
        }] });

/**
 * Injection token for the deprecation warning tracker.
 * Provided at form component level for instance-scoped tracking.
 *
 * @public
 */
const DEPRECATION_WARNING_TRACKER = new InjectionToken('DeprecationWarningTracker');
/**
 * Creates a fresh deprecation warning tracker instance.
 *
 * @returns A new DeprecationWarningTracker with an empty warnedKeys Set
 *
 * @public
 */
function createDeprecationWarningTracker() {
    return { warnedKeys: new Set() };
}

/**
 * Compares two values using the specified comparison operator.
 *
 * Supports various comparison types including equality, numerical comparisons,
 * string operations, and regular expression matching. Type coercion is applied
 * for numerical and string operations as needed.
 *
 * @param actual - The value to compare
 * @param expected - The value to compare against
 * @param operator - Comparison operator to use
 * @returns True if the comparison succeeds, false otherwise
 *
 * @example
 * ```typescript
 * // Equality checks
 * compareValues(10, 10, 'equals')        // true
 * compareValues('test', 'other', 'notEquals') // true
 *
 * // Numerical comparisons
 * compareValues(15, 10, 'greater')       // true
 * compareValues('5', 3, 'greaterOrEqual') // true (coerced to numbers)
 *
 * // String operations
 * compareValues('hello world', 'world', 'contains')   // true
 * compareValues('prefix-test', 'prefix', 'startsWith') // true
 * compareValues('test.jpg', '.jpg', 'endsWith')       // true
 *
 * // Regular expression matching
 * compareValues('test123', '^test\\d+$', 'matches')    // true
 * compareValues('invalid', '[invalid', 'matches')      // false (invalid regex)
 * ```
 */
function compareValues(actual, expected, operator) {
    switch (operator) {
        case 'equals':
            return actual === expected;
        case 'notEquals':
            return actual !== expected;
        case 'greater':
            return Number(actual) > Number(expected);
        case 'less':
            return Number(actual) < Number(expected);
        case 'greaterOrEqual':
            return Number(actual) >= Number(expected);
        case 'lessOrEqual':
            return Number(actual) <= Number(expected);
        case 'contains':
            return String(actual).includes(String(expected));
        case 'startsWith':
            return String(actual).startsWith(String(expected));
        case 'endsWith':
            return String(actual).endsWith(String(expected));
        case 'matches':
            try {
                return new RegExp(String(expected)).test(String(actual));
            }
            catch {
                return false;
            }
        default:
            return false;
    }
}
/**
 * Retrieves a nested value from an object using dot notation path.
 *
 * Safely traverses object properties using a dot-separated path string.
 * Returns undefined if any part of the path is missing or if the traversal
 * encounters a non-object value.
 *
 * @param obj - The object to traverse
 * @param path - Dot-separated path to the desired property
 * @returns The value at the specified path, or undefined if not found
 *
 * @example
 * ```typescript
 * const data = {
 *   user: {
 *     profile: {
 *       name: 'John',
 *       age: 30
 *     },
 *     settings: { theme: 'dark' }
 *   }
 * };
 *
 * getNestedValue(data, 'user.profile.name')  // 'John'
 * getNestedValue(data, 'user.settings.theme') // 'dark'
 * getNestedValue(data, 'user.profile.email')  // undefined
 * getNestedValue(data, 'nonexistent.path')    // undefined
 * getNestedValue(null, 'any.path')            // undefined
 * ```
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
}
/**
 * Checks whether a nested property exists in an object using dot notation path.
 *
 * Unlike `getNestedValue`, this distinguishes between a property that exists
 * with value `undefined` and a property path that doesn't exist at all.
 *
 * @param obj - The object to check
 * @param path - Dot-separated path to the property
 * @returns True if the property exists (even if its value is undefined)
 */
function hasNestedProperty(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current || typeof current !== 'object')
            return false;
        current = current[keys[i]];
    }
    if (!current || typeof current !== 'object')
        return false;
    return keys[keys.length - 1] in current;
}

/**
 * Known state properties on an Angular Signal Forms FieldState.
 * Each is a Signal<boolean> on the FieldState interface.
 */
const STATE_PROPERTIES = ['touched', 'dirty', 'valid', 'invalid', 'pending', 'hidden', 'readonly', 'disabled'];
/**
 * Reads a boolean signal from a FieldState, respecting the reactive flag.
 *
 * @internal
 */
function readStateSignal(fieldState, prop, reactive) {
    const signalFn = fieldState[prop];
    if (!signalFn || !isSignal(signalFn))
        return false;
    return reactive ? !!signalFn() : !!untracked(signalFn);
}
/**
 * Resolves a field source (FieldTree or FieldState) to its FieldState.
 *
 * Accepts either:
 * - A FieldTree (signal or callable Proxy from form tree) — called to get the FieldState
 * - A direct FieldState object (from FieldContext) — used directly
 *
 * FieldTree accessors may be Angular signals (pass `isSignal()`) or Proxy-wrapped
 * callables (fail `isSignal()` but pass `typeof === 'function'`). Both are handled
 * by the callable check.
 *
 * @internal
 */
function resolveFieldState(fieldSource, reactive) {
    if (!fieldSource)
        return undefined;
    // FieldTree: signal or callable Proxy — invoke to get the FieldState
    if (typeof fieldSource === 'function') {
        return reactive ? fieldSource() : untracked(fieldSource);
    }
    // Direct FieldState object (from FieldContext)
    if (typeof fieldSource === 'object') {
        return fieldSource;
    }
    return undefined;
}
/**
 * Creates a lazy FieldStateInfo that only reads state properties when accessed.
 *
 * This prevents reactive cycles when fieldState/formFieldState is used inside
 * logic conditions (readonly, hidden, disabled). Eagerly reading all properties
 * (e.g., `valid`, `readonly`) would create circular dependencies when the
 * logic condition itself controls one of those properties.
 *
 * Accepts either:
 * - A FieldTree (signal accessor from form tree) — called to get the FieldState
 * - A direct FieldState object (from FieldContext) — used directly
 *
 * @param fieldSource - A FieldTree or direct FieldState instance
 * @param reactive - If true, reads signals reactively (creates dependencies).
 *                   If false, reads signals with `untracked()` (no dependencies).
 * @returns A FieldStateInfo proxy with lazy property access, or undefined if the source is invalid
 *
 * @internal
 */
function readFieldStateInfo(fieldSource, reactive) {
    const state = resolveFieldState(fieldSource, reactive);
    if (!state || typeof state !== 'object')
        return undefined;
    const knownProperties = new Set([...STATE_PROPERTIES, 'pristine']);
    return new Proxy({}, {
        get(_target, prop) {
            if (prop === 'pristine') {
                return !readStateSignal(state, 'dirty', reactive);
            }
            if (STATE_PROPERTIES.includes(prop)) {
                return readStateSignal(state, prop, reactive);
            }
            return false;
        },
        has(_target, prop) {
            return knownProperties.has(prop);
        },
    });
}
/**
 * Creates a Proxy-based FormFieldStateMap for accessing any field's state by key.
 *
 * Property access like `[key]` navigates to `rootForm[key]` and returns
 * a FieldStateInfo snapshot for that field.
 *
 * Uses an internal Map cache for identity stability within a single
 * access chain (avoids redundant snapshot allocations).
 *
 * @param rootForm - The root FieldTree of the form
 * @param reactive - If true, reads signals reactively (creates dependencies).
 *                   If false, reads signals with `untracked()` (no dependencies).
 * @returns A FormFieldStateMap proxy
 *
 * @internal
 */
function createFormFieldStateMap(rootForm, reactive) {
    const cache = new Map();
    return new Proxy({}, {
        get(_target, key) {
            if (cache.has(key)) {
                return cache.get(key);
            }
            const fieldAccessor = navigateToFieldAccessor(rootForm, key);
            const snapshot = readFieldStateInfo(fieldAccessor, reactive);
            cache.set(key, snapshot);
            return snapshot;
        },
        has(_target, key) {
            return navigateToFieldAccessor(rootForm, key) !== undefined;
        },
    });
}
/**
 * Navigates the form tree to find a field accessor (FieldTree) for the given key path.
 *
 * Supports dot-notation for nested paths (e.g., 'address.city').
 * Follows the same bracket-notation navigation pattern as `applyValueToForm`
 * in `derivation-applicator.ts`.
 *
 * @internal
 */
function navigateToFieldAccessor(rootForm, keyPath) {
    if (!keyPath)
        return undefined;
    const parts = keyPath.split('.');
    // FieldTree<T> = (() => FieldState<T>) & Subfields<T>, so sub-fields
    // are directly on the FieldTree — no need to call it during navigation
    let current = rootForm;
    for (let i = 0; i < parts.length - 1; i++) {
        const next = current[parts[i]];
        if (!next)
            return undefined;
        current = next;
    }
    return current[parts[parts.length - 1]];
}

/**
 * Safely reads `pathKeys` from a FieldContext.
 * Returns an empty array if `pathKeys` is not available (e.g., in tests or older Angular versions).
 *
 * Always reads with `untracked()` because `pathKeys` is stable for the lifetime of a field —
 * array items don't change index after creation, so there's no need to establish a reactive
 * dependency on this signal.
 */
function safeReadPathKeys(fieldContext) {
    if (!('pathKeys' in fieldContext) || typeof fieldContext.pathKeys !== 'function') {
        return [];
    }
    return untracked(() => fieldContext.pathKeys());
}

function isChildFieldContext(context) {
    return 'key' in context && isSignal(context.key);
}
/**
 * Extracts the FieldState from a FieldContext using the public `.state` property.
 *
 * FieldContext.state is a FieldState object that has all signal properties
 * (dirty, touched, valid, etc.) needed for field state snapshots.
 *
 * IMPORTANT: Always reads with `untracked()` because accessing `.state` on a
 * FieldContext can trigger reactive reads inside Angular's internal computation
 * graph. Without `untracked()`, validators would cycle (validator → state → valid
 * → validator) and logic conditions like `hidden()` would cycle (hidden → state →
 * hidden). The FieldState object reference is stable — individual signal properties
 * within it are read reactively or untracked by the Proxy as needed.
 */
function extractFieldState(fieldContext) {
    return untracked(() => {
        if (!fieldContext || !('state' in fieldContext))
            return undefined;
        return fieldContext.state;
    });
}
/**
 * Detects whether a field lives inside an array by examining its `pathKeys`.
 *
 * Array item fields have paths like `['addresses', '0', 'street']` where
 * a numeric segment indicates an array index. Returns the array key and
 * numeric index when detected, or `undefined` for non-array fields.
 *
 * For nested arrays (e.g., `['orders', '0', 'items', '1', 'name']`), walks backwards
 * to find the innermost array context — scoping `formValue` to that item.
 * `localKey` is always the last segment (the field's own key within its parent item).
 */
function detectArrayScope(pathKeys) {
    // Need at least 3 segments: arrayKey, index, fieldKey
    if (pathKeys.length < 3)
        return undefined;
    // Walk from the end to find the nearest array context.
    // pathKeys looks like ['addresses', '0', 'street'] or
    // ['nested', 'addresses', '1', 'city']
    for (let i = pathKeys.length - 2; i >= 1; i--) {
        const maybeIndex = Number(pathKeys[i]);
        if (Number.isInteger(maybeIndex) && maybeIndex >= 0) {
            return {
                arrayKey: pathKeys.slice(0, i).join('.'),
                index: maybeIndex,
                localKey: pathKeys[pathKeys.length - 1],
            };
        }
    }
    return undefined;
}
/**
 * Service that provides field evaluation context by combining
 * field context with root form registry information.
 *
 * This service should be provided at the component level to ensure proper
 * isolation between different form instances.
 */
class FieldContextRegistryService {
    rootFormRegistry = inject(RootFormRegistryService);
    logger = inject(DynamicFormLogger);
    deprecationTracker = inject(DEPRECATION_WARNING_TRACKER, { optional: true });
    externalDataSignal = inject(EXTERNAL_DATA, { optional: true });
    /**
     * Creates an evaluation context for a field by combining:
     * - The field's current value
     * - The root form value from the registry
     * - The field path (if available from form context)
     * - Custom functions (if provided)
     */
    createEvaluationContext(fieldContext, customFunctions) {
        // Use untracked() to read the field value WITHOUT creating a reactive dependency.
        // This prevents infinite loops when logic functions are evaluated inside computed signals.
        const fieldValue = untracked(() => fieldContext.value());
        // Get form value wrapped in untracked() to prevent reactive dependencies.
        // This allows validators and dynamic values to access form values without
        // causing infinite loops.
        const rootFormValue = untracked(() => this.rootFormRegistry.formValue());
        const localKey = this.extractFieldPath(fieldContext);
        const pathKeys = safeReadPathKeys(fieldContext);
        const arrayScope = detectArrayScope(pathKeys);
        if (arrayScope) {
            return this.buildArrayScopedContext(rootFormValue, arrayScope, fieldValue, customFunctions, false, fieldContext);
        }
        // Use getters for fieldState/formFieldState to defer signal reads until
        // the expression actually accesses them. Validators that only use fieldValue
        // will never trigger these getters, avoiding reactive cycles in Angular's
        // internal signal graph (validator → state → valid → validator).
        const rootFormSignal = this.rootFormRegistry.rootForm;
        return {
            fieldValue,
            formValue: rootFormValue,
            fieldPath: localKey,
            customFunctions: customFunctions || {},
            externalData: this.resolveExternalData(false),
            logger: this.logger,
            deprecationTracker: this.deprecationTracker ?? undefined,
            get fieldState() {
                return readFieldStateInfo(extractFieldState(fieldContext), false);
            },
            get formFieldState() {
                return createFormFieldStateMap(untracked(rootFormSignal), false);
            },
        };
    }
    /**
     * Extracts the field path (key) for a given field context.
     */
    extractFieldPath(fieldContext) {
        if (isChildFieldContext(fieldContext)) {
            try {
                return String(fieldContext.key());
            }
            catch (error) {
                this.logger.warn('Unable to extract field key:', error);
            }
        }
        // For root fields or when key is not available
        return '';
    }
    /**
     * Builds an evaluation context scoped to a specific array item.
     *
     * When a field lives inside an array (e.g., `addresses.0.street`), its logic conditions
     * need `formValue` scoped to the array item so that `fieldValue` lookups like
     * `hasApartment` resolve against the item rather than the root form.
     *
     * Falls back to root form behavior when the array data is missing or the index is
     * out of bounds.
     */
    buildArrayScopedContext(rootFormValue, arrayScope, fieldValue, customFunctions, reactive, fieldContext) {
        const { arrayKey, index, localKey } = arrayScope;
        // Navigate to the array (supports nested paths like 'nested.addresses')
        const arrayData = getNestedValue(rootFormValue, arrayKey);
        let scopedFormValue;
        if (Array.isArray(arrayData) && index >= 0 && index < arrayData.length) {
            const item = arrayData[index];
            if (item != null && typeof item === 'object') {
                scopedFormValue = item;
            }
        }
        // Use getters to defer fieldState/formFieldState construction.
        // Same rationale as createEvaluationContext — avoids reactive cycles
        // when expressions don't actually access these properties.
        const rootFormSignal = this.rootFormRegistry.rootForm;
        const fieldStateGetter = fieldContext ? () => readFieldStateInfo(extractFieldState(fieldContext), reactive) : () => undefined;
        const formFieldStateGetter = () => createFormFieldStateMap((reactive ? rootFormSignal() : untracked(rootFormSignal)), reactive);
        // Fall back to root form value if array item lookup fails
        if (!scopedFormValue) {
            return {
                fieldValue,
                formValue: rootFormValue,
                fieldPath: localKey,
                customFunctions: customFunctions || {},
                externalData: this.resolveExternalData(reactive),
                logger: this.logger,
                deprecationTracker: this.deprecationTracker ?? undefined,
                get fieldState() {
                    return fieldStateGetter();
                },
                get formFieldState() {
                    return formFieldStateGetter();
                },
            };
        }
        return {
            fieldValue,
            formValue: scopedFormValue,
            rootFormValue,
            arrayIndex: index,
            arrayPath: arrayKey,
            fieldPath: `${arrayKey}.${index}.${localKey}`,
            customFunctions: customFunctions || {},
            externalData: this.resolveExternalData(reactive),
            logger: this.logger,
            deprecationTracker: this.deprecationTracker ?? undefined,
            get fieldState() {
                return fieldStateGetter();
            },
            get formFieldState() {
                return formFieldStateGetter();
            },
        };
    }
    /**
     * Resolves external data signals to their current values.
     *
     * @param reactive - If true, reads signals reactively (creates dependencies).
     *                   If false, reads signals with untracked() (no dependencies).
     * @returns Record of resolved external data values, or undefined if no external data.
     */
    resolveExternalData(reactive) {
        const externalDataSignal = this.externalDataSignal;
        if (!externalDataSignal)
            return undefined;
        const externalDataRecord = reactive ? externalDataSignal() : untracked(() => externalDataSignal());
        if (!externalDataRecord) {
            return undefined;
        }
        const resolved = {};
        for (const [key, value] of Object.entries(externalDataRecord)) {
            if (!isSignal(value)) {
                throw new DynamicFormError(`externalData["${key}"] must be a Signal. Got: ${typeof value}. Wrap it with signal(yourValue).`);
            }
            resolved[key] = reactive ? value() : untracked(() => value());
        }
        return resolved;
    }
    /**
     * Creates a REACTIVE evaluation context for logic functions.
     *
     * Unlike createEvaluationContext, this method does NOT use untracked(),
     * which allows logic functions (hidden, readonly, disabled, required) to
     * create reactive dependencies on form values.
     *
     * When a dependent field value changes, the logic function will be re-evaluated.
     *
     * NOTE: This should ONLY be used for logic functions, not validators.
     * Validators should use createEvaluationContext with untracked() to prevent
     * infinite reactive loops. Validators with cross-field dependencies should be
     * hoisted to form-level using validateTree.
     */
    createReactiveEvaluationContext(fieldContext, customFunctions) {
        const fieldValue = fieldContext.value();
        const rootFormValue = this.rootFormRegistry.formValue();
        const pathKeys = safeReadPathKeys(fieldContext);
        const arrayScope = detectArrayScope(pathKeys);
        if (arrayScope) {
            return this.buildArrayScopedContext(rootFormValue, arrayScope, fieldValue, customFunctions, true, fieldContext);
        }
        const localKey = this.extractFieldPath(fieldContext);
        const rootFormSignal = this.rootFormRegistry.rootForm;
        return {
            fieldValue,
            formValue: rootFormValue,
            fieldPath: localKey,
            customFunctions: customFunctions || {},
            externalData: this.resolveExternalData(true),
            logger: this.logger,
            deprecationTracker: this.deprecationTracker ?? undefined,
            get fieldState() {
                return readFieldStateInfo(extractFieldState(fieldContext), true);
            },
            get formFieldState() {
                return createFormFieldStateMap(rootFormSignal(), true);
            },
        };
    }
    /**
     * Creates an evaluation context for display-only components (text fields, pages)
     * that don't have their own FieldContext.
     *
     * This is useful for:
     * - Text fields (display-only, not part of form schema)
     * - Pages (containers that need to evaluate visibility logic)
     *
     * Uses reactive form value access to allow logic re-evaluation when form values change.
     *
     * NOTE: This method does NOT support array-scoped context because display-only
     * components don't have a FieldContext (and therefore no `pathKeys` signal to
     * detect array scope from). If display-only components are placed inside arrays,
     * their logic conditions will evaluate against the root form value.
     *
     * @param fieldPath - The key/path of the display-only component
     * @param customFunctions - Optional custom functions for expression evaluation
     */
    createDisplayOnlyContext(fieldPath, customFunctions) {
        const formValue = this.rootFormRegistry.formValue();
        const rootFormSignal = this.rootFormRegistry.rootForm;
        return {
            fieldValue: undefined,
            formValue,
            fieldPath,
            customFunctions: customFunctions || {},
            externalData: this.resolveExternalData(true),
            logger: this.logger,
            deprecationTracker: this.deprecationTracker ?? undefined,
            get formFieldState() {
                return createFormFieldStateMap(rootFormSignal(), true);
            },
        };
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: FieldContextRegistryService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: FieldContextRegistryService });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: FieldContextRegistryService, decorators: [{
            type: Injectable
        }] });

/**
 * Utilities for parsing and manipulating field paths in dynamic forms.
 *
 * Field paths follow these formats:
 * - Simple: "fieldName"
 * - Nested: "parent.child.grandchild"
 * - Array indexed: "items.0.quantity" or "items[0].quantity"
 * - Array placeholder: "items.$.quantity" ($ = any index)
 *
 * @module path-utils
 */
/**
 * Parses an array derivation path into its components.
 *
 * Array paths use the `$` placeholder to represent "any index".
 * Format: "arrayPath.$.relativePath"
 *
 * @param path - The path to parse (e.g., "items.$.quantity")
 * @returns Parsed path info with arrayPath and relativePath
 *
 * @example
 * ```typescript
 * parseArrayPath('items.$.quantity')
 * // { arrayPath: 'items', relativePath: 'quantity', isArrayPath: true }
 *
 * parseArrayPath('orders.lineItems.$.total')
 * // { arrayPath: 'orders.lineItems', relativePath: 'total', isArrayPath: true }
 *
 * parseArrayPath('simpleField')
 * // { arrayPath: '', relativePath: '', isArrayPath: false }
 * ```
 *
 * @public
 */
function parseArrayPath(path) {
    const ARRAY_PLACEHOLDER = '.$.';
    const placeholderIndex = path.indexOf(ARRAY_PLACEHOLDER);
    if (placeholderIndex === -1) {
        return {
            arrayPath: '',
            relativePath: '',
            isArrayPath: false,
        };
    }
    return {
        arrayPath: path.substring(0, placeholderIndex),
        relativePath: path.substring(placeholderIndex + ARRAY_PLACEHOLDER.length),
        isArrayPath: true,
    };
}
/**
 * Resolves an array placeholder path to a concrete indexed path.
 *
 * @param path - The path with $ placeholder (e.g., "items.$.quantity")
 * @param index - The array index to substitute
 * @returns Resolved path with index (e.g., "items.0.quantity")
 *
 * @example
 * ```typescript
 * resolveArrayPath('items.$.quantity', 2)
 * // 'items.2.quantity'
 *
 * resolveArrayPath('orders.lineItems.$.total', 0)
 * // 'orders.lineItems.0.total'
 * ```
 *
 * @public
 */
function resolveArrayPath(path, index) {
    const info = parseArrayPath(path);
    if (!info.isArrayPath) {
        return path;
    }
    return `${info.arrayPath}.${index}.${info.relativePath}`;
}
/**
 * Checks if a path contains an array placeholder.
 *
 * @param path - The path to check
 * @returns True if the path contains .$.
 *
 * @public
 */
function isArrayPlaceholderPath(path) {
    return path.includes('.$.');
}
/**
 * Extracts the array path from a path that may contain an array placeholder.
 *
 * @param path - The path to extract from
 * @returns The array path, or empty string if not an array path
 *
 * @example
 * ```typescript
 * extractArrayPath('items.$.quantity')
 * // 'items'
 *
 * extractArrayPath('orders.lineItems.$.total')
 * // 'orders.lineItems'
 *
 * extractArrayPath('simpleField')
 * // ''
 * ```
 *
 * @public
 */
function extractArrayPath(path) {
    return parseArrayPath(path).arrayPath;
}
/**
 * Splits a path into segments, supporting both dot notation and bracket notation.
 *
 * Handles:
 * - Dot notation: `parent.child.grandchild`
 * - Bracket notation: `items[0].quantity`
 * - Mixed notation: `items[0].address.city`
 *
 * @param path - The path to split
 * @returns Array of path segments
 *
 * @example
 * ```typescript
 * splitPath('parent.child.grandchild')
 * // ['parent', 'child', 'grandchild']
 *
 * splitPath('items.0.quantity')
 * // ['items', '0', 'quantity']
 *
 * splitPath('items[0].quantity')
 * // ['items', '0', 'quantity']
 *
 * splitPath('a[0][1].b')
 * // ['a', '0', '1', 'b']
 * ```
 *
 * @public
 */
function splitPath(path) {
    if (!path)
        return [];
    // Convert bracket notation [n] to .n, then split by dots
    // Filter out empty segments from leading/trailing/consecutive dots
    return path
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter(Boolean);
}
/**
 * Joins path segments into a dot-separated path.
 *
 * @param segments - The path segments to join
 * @returns Joined path string
 *
 * @public
 */
function joinPath(segments) {
    return segments.join('.');
}
/**
 * Gets the parent path from a nested path.
 *
 * @param path - The path to get parent from
 * @returns The parent path, or empty string if no parent
 *
 * @example
 * ```typescript
 * getParentPath('parent.child.grandchild')
 * // 'parent.child'
 *
 * getParentPath('topLevel')
 * // ''
 * ```
 *
 * @public
 */
function getParentPath(path) {
    const segments = splitPath(path);
    if (segments.length <= 1)
        return '';
    return joinPath(segments.slice(0, -1));
}
/**
 * Gets the last segment (leaf) from a path.
 *
 * @param path - The path to get leaf from
 * @returns The last segment
 *
 * @example
 * ```typescript
 * getLeafPath('parent.child.grandchild')
 * // 'grandchild'
 *
 * getLeafPath('topLevel')
 * // 'topLevel'
 * ```
 *
 * @public
 */
function getLeafPath(path) {
    const segments = splitPath(path);
    return segments[segments.length - 1] ?? '';
}
/**
 * Parses a path that may contain multiple array placeholders.
 *
 * This supports deeply nested array structures like `orders.$.items.$.quantity`
 * where multiple levels of arrays need to be traversed.
 *
 * @param path - Path with zero or more $ placeholders
 * @returns Parsed path information
 *
 * @example
 * ```typescript
 * parseMultiArrayPath('orders.$.items.$.quantity')
 * // {
 * //   isArrayPath: true,
 * //   placeholderCount: 2,
 * //   segments: ['orders', 'items', 'quantity'],
 * //   placeholderPositions: [1, 3]
 * // }
 *
 * parseMultiArrayPath('items.$.name')
 * // {
 * //   isArrayPath: true,
 * //   placeholderCount: 1,
 * //   segments: ['items', 'name'],
 * //   placeholderPositions: [1]
 * // }
 *
 * parseMultiArrayPath('simpleField')
 * // {
 * //   isArrayPath: false,
 * //   placeholderCount: 0,
 * //   segments: ['simpleField'],
 * //   placeholderPositions: []
 * // }
 * ```
 *
 * @public
 */
function parseMultiArrayPath(path) {
    const parts = path.split('.');
    const segments = [];
    const placeholderPositions = [];
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '$') {
            placeholderPositions.push(i);
        }
        else {
            segments.push(parts[i]);
        }
    }
    return {
        isArrayPath: placeholderPositions.length > 0,
        placeholderCount: placeholderPositions.length,
        segments,
        placeholderPositions,
    };
}
/**
 * Resolves a path with multiple array placeholders using provided indices.
 *
 * Each `$` placeholder is replaced with the corresponding index from the
 * indices array, in order.
 *
 * @param path - Path with $ placeholders (e.g., 'orders.$.items.$.quantity')
 * @param indices - Array of indices to substitute (e.g., [0, 2])
 * @returns Resolved path (e.g., 'orders.0.items.2.quantity')
 *
 * @throws Error if number of indices doesn't match number of placeholders
 *
 * @example
 * ```typescript
 * resolveMultiArrayPath('orders.$.items.$.quantity', [0, 2])
 * // 'orders.0.items.2.quantity'
 *
 * resolveMultiArrayPath('items.$.name', [5])
 * // 'items.5.name'
 * ```
 *
 * @public
 */
function resolveMultiArrayPath(path, indices) {
    const parts = path.split('.');
    let indexPointer = 0;
    const resolved = parts.map((part) => {
        if (part === '$') {
            if (indexPointer >= indices.length) {
                throw new Error(`Not enough indices provided for path '${path}'. ` +
                    `Expected ${parts.filter((p) => p === '$').length} indices, got ${indices.length}.`);
            }
            return String(indices[indexPointer++]);
        }
        return part;
    });
    if (indexPointer < indices.length) {
        throw new Error(`Too many indices provided for path '${path}'. ` + `Expected ${indexPointer} indices, got ${indices.length}.`);
    }
    return resolved.join('.');
}
/**
 * Counts the number of array placeholders in a path.
 *
 * @param path - The path to analyze
 * @returns Number of $ placeholders in the path
 *
 * @example
 * ```typescript
 * countArrayPlaceholders('orders.$.items.$.quantity')
 * // 2
 *
 * countArrayPlaceholders('items.$.name')
 * // 1
 *
 * countArrayPlaceholders('simpleField')
 * // 0
 * ```
 *
 * @public
 */
function countArrayPlaceholders(path) {
    return path.split('.').filter((part) => part === '$').length;
}

/**
 * Token types for expression parsing
 */
var TokenType;
(function (TokenType) {
    // Literals
    TokenType["NUMBER"] = "NUMBER";
    TokenType["STRING"] = "STRING";
    TokenType["TRUE"] = "TRUE";
    TokenType["FALSE"] = "FALSE";
    TokenType["NULL"] = "NULL";
    TokenType["UNDEFINED"] = "UNDEFINED";
    // Identifiers
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    // Operators
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["MULTIPLY"] = "MULTIPLY";
    TokenType["DIVIDE"] = "DIVIDE";
    TokenType["MODULO"] = "MODULO";
    // Comparison
    TokenType["EQUAL"] = "EQUAL";
    TokenType["NOT_EQUAL"] = "NOT_EQUAL";
    TokenType["GREATER"] = "GREATER";
    TokenType["LESS"] = "LESS";
    TokenType["GREATER_EQUAL"] = "GREATER_EQUAL";
    TokenType["LESS_EQUAL"] = "LESS_EQUAL";
    // Logical
    TokenType["AND"] = "AND";
    TokenType["OR"] = "OR";
    TokenType["NOT"] = "NOT";
    // Punctuation
    TokenType["DOT"] = "DOT";
    TokenType["COMMA"] = "COMMA";
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["LBRACKET"] = "LBRACKET";
    TokenType["RBRACKET"] = "RBRACKET";
    // Special
    TokenType["EOF"] = "EOF";
})(TokenType || (TokenType = {}));
/**
 * Parser error with position information
 */
class ExpressionParserError extends DynamicFormError {
    position;
    expression;
    constructor(message, position, expression) {
        super(`${message} at position ${position} in expression: ${expression}`);
        this.position = position;
        this.expression = expression;
        this.name = 'ExpressionParserError';
    }
}

/**
 * Tokenizes an expression string into tokens
 */
class Tokenizer {
    position = 0;
    expression;
    constructor(expression) {
        this.expression = expression;
    }
    /**
     * Tokenize the entire expression
     */
    tokenize() {
        const tokens = [];
        while (this.position < this.expression.length) {
            this.skipWhitespace();
            if (this.position >= this.expression.length) {
                break;
            }
            const token = this.nextToken();
            tokens.push(token);
        }
        tokens.push({ type: TokenType.EOF, value: '', position: this.position });
        return tokens;
    }
    skipWhitespace() {
        while (this.position < this.expression.length && /\s/.test(this.expression[this.position])) {
            this.position++;
        }
    }
    nextToken() {
        const char = this.expression[this.position];
        // String literals
        if (char === '"' || char === "'") {
            return this.readString(char);
        }
        // Numbers
        if (/[0-9]/.test(char)) {
            return this.readNumber();
        }
        // Identifiers and keywords
        if (/[a-zA-Z_$]/.test(char)) {
            return this.readIdentifierOrKeyword();
        }
        // Operators and punctuation
        return this.readOperatorOrPunctuation();
    }
    readString(quote) {
        const start = this.position;
        this.position++; // Skip opening quote
        let value = '';
        while (this.position < this.expression.length) {
            const char = this.expression[this.position];
            if (char === quote) {
                this.position++; // Skip closing quote
                return { type: TokenType.STRING, value, position: start };
            }
            if (char === '\\' && this.position + 1 < this.expression.length) {
                // Handle escape sequences
                this.position++;
                const nextChar = this.expression[this.position];
                switch (nextChar) {
                    case 'n':
                        value += '\n';
                        break;
                    case 't':
                        value += '\t';
                        break;
                    case 'r':
                        value += '\r';
                        break;
                    case '\\':
                        value += '\\';
                        break;
                    case quote:
                        value += quote;
                        break;
                    default:
                        value += nextChar;
                }
                this.position++;
            }
            else {
                value += char;
                this.position++;
            }
        }
        throw new ExpressionParserError('Unterminated string literal', start, this.expression);
    }
    readNumber() {
        const start = this.position;
        let value = '';
        while (this.position < this.expression.length && /[0-9.]/.test(this.expression[this.position])) {
            value += this.expression[this.position];
            this.position++;
        }
        if (!/^\d+(\.\d+)?$/.test(value)) {
            throw new ExpressionParserError(`Invalid number: ${value}`, start, this.expression);
        }
        return { type: TokenType.NUMBER, value, position: start };
    }
    readIdentifierOrKeyword() {
        const start = this.position;
        let value = '';
        while (this.position < this.expression.length && /[a-zA-Z0-9_$]/.test(this.expression[this.position])) {
            value += this.expression[this.position];
            this.position++;
        }
        // Check for keywords
        const type = this.getKeywordType(value);
        return { type, value, position: start };
    }
    getKeywordType(value) {
        switch (value) {
            case 'true':
                return TokenType.TRUE;
            case 'false':
                return TokenType.FALSE;
            case 'null':
                return TokenType.NULL;
            case 'undefined':
                return TokenType.UNDEFINED;
            default:
                return TokenType.IDENTIFIER;
        }
    }
    readOperatorOrPunctuation() {
        const start = this.position;
        const char = this.expression[this.position];
        const nextChar = this.position + 1 < this.expression.length ? this.expression[this.position + 1] : '';
        const thirdChar = this.position + 2 < this.expression.length ? this.expression[this.position + 2] : '';
        // Three-character operators - check these first!
        const threeChar = char + nextChar + thirdChar;
        if (threeChar === '===') {
            this.position += 3;
            return { type: TokenType.EQUAL, value: '===', position: start };
        }
        if (threeChar === '!==') {
            this.position += 3;
            return { type: TokenType.NOT_EQUAL, value: '!==', position: start };
        }
        // Two-character operators
        const twoChar = char + nextChar;
        switch (twoChar) {
            case '==':
                this.position += 2;
                return { type: TokenType.EQUAL, value: '==', position: start };
            case '!=':
                this.position += 2;
                return { type: TokenType.NOT_EQUAL, value: '!=', position: start };
            case '>=':
                this.position += 2;
                return { type: TokenType.GREATER_EQUAL, value: '>=', position: start };
            case '<=':
                this.position += 2;
                return { type: TokenType.LESS_EQUAL, value: '<=', position: start };
            case '&&':
                this.position += 2;
                return { type: TokenType.AND, value: '&&', position: start };
            case '||':
                this.position += 2;
                return { type: TokenType.OR, value: '||', position: start };
        }
        // Single-character operators and punctuation
        this.position++;
        switch (char) {
            case '+':
                return { type: TokenType.PLUS, value: '+', position: start };
            case '-':
                return { type: TokenType.MINUS, value: '-', position: start };
            case '*':
                return { type: TokenType.MULTIPLY, value: '*', position: start };
            case '/':
                return { type: TokenType.DIVIDE, value: '/', position: start };
            case '%':
                return { type: TokenType.MODULO, value: '%', position: start };
            case '>':
                return { type: TokenType.GREATER, value: '>', position: start };
            case '<':
                return { type: TokenType.LESS, value: '<', position: start };
            case '!':
                return { type: TokenType.NOT, value: '!', position: start };
            case '.':
                return { type: TokenType.DOT, value: '.', position: start };
            case ',':
                return { type: TokenType.COMMA, value: ',', position: start };
            case '(':
                return { type: TokenType.LPAREN, value: '(', position: start };
            case ')':
                return { type: TokenType.RPAREN, value: ')', position: start };
            case '[':
                return { type: TokenType.LBRACKET, value: '[', position: start };
            case ']':
                return { type: TokenType.RBRACKET, value: ']', position: start };
            default:
                throw new ExpressionParserError(`Unexpected character: ${char}`, start, this.expression);
        }
    }
}

/**
 * Parses tokens into an Abstract Syntax Tree (AST)
 * Uses recursive descent parsing with operator precedence
 */
class Parser {
    tokens = [];
    current = 0;
    expression;
    constructor(expression) {
        this.expression = expression;
    }
    /**
     * Parse the expression into an AST
     */
    parse() {
        const tokenizer = new Tokenizer(this.expression);
        this.tokens = tokenizer.tokenize();
        this.current = 0;
        if (this.isAtEnd()) {
            throw new ExpressionParserError('Empty expression', 0, this.expression);
        }
        const result = this.parseExpression();
        if (!this.isAtEnd()) {
            const token = this.peek();
            throw new ExpressionParserError(`Unexpected token '${token.value}' at position ${token.position} — expression has trailing content`, token.position, this.expression);
        }
        return result;
    }
    parseExpression() {
        return this.parseLogicalOr();
    }
    parseLogicalOr() {
        let node = this.parseLogicalAnd();
        while (this.match(TokenType.OR)) {
            const operator = this.previous().value;
            const right = this.parseLogicalAnd();
            node = { type: 'BinaryOp', operator, left: node, right };
        }
        return node;
    }
    parseLogicalAnd() {
        let node = this.parseEquality();
        while (this.match(TokenType.AND)) {
            const operator = this.previous().value;
            const right = this.parseEquality();
            node = { type: 'BinaryOp', operator, left: node, right };
        }
        return node;
    }
    parseEquality() {
        let node = this.parseComparison();
        while (this.match(TokenType.EQUAL, TokenType.NOT_EQUAL)) {
            const operator = this.previous().value;
            const right = this.parseComparison();
            node = { type: 'BinaryOp', operator, left: node, right };
        }
        return node;
    }
    parseComparison() {
        let node = this.parseAddition();
        while (this.match(TokenType.GREATER, TokenType.GREATER_EQUAL, TokenType.LESS, TokenType.LESS_EQUAL)) {
            const operator = this.previous().value;
            const right = this.parseAddition();
            node = { type: 'BinaryOp', operator, left: node, right };
        }
        return node;
    }
    parseAddition() {
        let node = this.parseMultiplication();
        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const operator = this.previous().value;
            const right = this.parseMultiplication();
            node = { type: 'BinaryOp', operator, left: node, right };
        }
        return node;
    }
    parseMultiplication() {
        let node = this.parseUnary();
        while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MODULO)) {
            const operator = this.previous().value;
            const right = this.parseUnary();
            node = { type: 'BinaryOp', operator, left: node, right };
        }
        return node;
    }
    parseUnary() {
        if (this.match(TokenType.NOT, TokenType.MINUS, TokenType.PLUS)) {
            const operator = this.previous().value;
            const operand = this.parseUnary();
            return { type: 'UnaryOp', operator, operand };
        }
        return this.parsePostfix();
    }
    parsePostfix() {
        let node = this.parsePrimary();
        while (true) {
            if (this.match(TokenType.DOT)) {
                // Member access: obj.property
                if (!this.check(TokenType.IDENTIFIER)) {
                    throw new ExpressionParserError('Expected property name after "."', this.peek().position, this.expression);
                }
                const property = this.advance().value;
                node = { type: 'MemberAccess', object: node, property };
            }
            else if (this.match(TokenType.LPAREN)) {
                // Function call: func()
                const args = this.parseArgumentList();
                this.consume(TokenType.RPAREN, 'Expected ")" after arguments');
                node = { type: 'CallExpression', callee: node, arguments: args };
            }
            else {
                break;
            }
        }
        return node;
    }
    parsePrimary() {
        // Literals
        if (this.match(TokenType.TRUE)) {
            return { type: 'Literal', value: true };
        }
        if (this.match(TokenType.FALSE)) {
            return { type: 'Literal', value: false };
        }
        if (this.match(TokenType.NULL)) {
            return { type: 'Literal', value: null };
        }
        if (this.match(TokenType.UNDEFINED)) {
            return { type: 'Literal', value: undefined };
        }
        if (this.match(TokenType.NUMBER)) {
            return { type: 'Literal', value: parseFloat(this.previous().value) };
        }
        if (this.match(TokenType.STRING)) {
            return { type: 'Literal', value: this.previous().value };
        }
        // Array literal
        if (this.match(TokenType.LBRACKET)) {
            const elements = this.parseArrayElements();
            this.consume(TokenType.RBRACKET, 'Expected "]" after array elements');
            return { type: 'ArrayLiteral', elements };
        }
        // Identifier
        if (this.match(TokenType.IDENTIFIER)) {
            return { type: 'Identifier', name: this.previous().value };
        }
        // Grouped expression
        if (this.match(TokenType.LPAREN)) {
            const expr = this.parseExpression();
            this.consume(TokenType.RPAREN, 'Expected ")" after expression');
            return expr;
        }
        throw new ExpressionParserError(`Unexpected token: ${this.peek().value}`, this.peek().position, this.expression);
    }
    parseArgumentList() {
        const args = [];
        if (!this.check(TokenType.RPAREN)) {
            do {
                args.push(this.parseExpression());
            } while (this.match(TokenType.COMMA));
        }
        return args;
    }
    parseArrayElements() {
        const elements = [];
        if (!this.check(TokenType.RBRACKET)) {
            do {
                elements.push(this.parseExpression());
            } while (this.match(TokenType.COMMA));
        }
        return elements;
    }
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
    }
    advance() {
        if (!this.isAtEnd())
            this.current++;
        return this.previous();
    }
    isAtEnd() {
        return this.peek().type === TokenType.EOF;
    }
    peek() {
        return this.tokens[this.current];
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        throw new ExpressionParserError(message, this.peek().position, this.expression);
    }
}

/**
 * Security Model: Whitelist-only approach for method calls
 *
 * A method is considered SAFE if it meets ALL criteria:
 * 1. Pure data access/transformation (no side effects)
 * 2. No code execution capabilities
 * 3. No global state modification
 * 4. No prototype chain modification
 * 5. No information disclosure about system internals
 *
 * Methods NOT included (unsafe):
 * - constructor: Could enable code execution via Function constructor
 * - valueOf: Could enable type confusion attacks
 * - __proto__, __defineGetter__, etc: Direct prototype manipulation
 * - hasOwnProperty, isPrototypeOf, propertyIsEnumerable: Leak object structure
 * - toLocaleString: Could expose locale/system information
 */
/**
 * Type-safe method whitelists derived from TypeScript primitive types
 * Only methods explicitly listed here are allowed - this is a whitelist-only approach
 */
const STRING_SAFE_METHODS = [
    'charAt',
    'charCodeAt',
    'concat',
    'endsWith',
    'includes',
    'indexOf',
    'lastIndexOf',
    'match',
    'padEnd',
    'padStart',
    'repeat',
    'replace',
    'search',
    'slice',
    'split',
    'startsWith',
    'substring',
    'toLowerCase',
    'toUpperCase',
    'trim',
    'trimEnd',
    'trimStart',
    'toString',
];
const NUMBER_SAFE_METHODS = ['toExponential', 'toFixed', 'toPrecision', 'toString'];
const ARRAY_SAFE_METHODS = [
    'concat',
    'every',
    'filter',
    'find',
    'findIndex',
    'flat',
    'flatMap',
    'includes',
    'indexOf',
    'join',
    'lastIndexOf',
    'map',
    'reduce',
    'reduceRight',
    'slice',
    'some',
    'toString',
    'entries',
    'keys',
    'values',
];
const DATE_SAFE_METHODS = [
    'getDate',
    'getDay',
    'getFullYear',
    'getHours',
    'getMilliseconds',
    'getMinutes',
    'getMonth',
    'getSeconds',
    'getTime',
    'getTimezoneOffset',
    'getUTCDate',
    'getUTCDay',
    'getUTCFullYear',
    'getUTCHours',
    'getUTCMilliseconds',
    'getUTCMinutes',
    'getUTCMonth',
    'getUTCSeconds',
    'toDateString',
    'toISOString',
    'toJSON',
    'toString',
    'toTimeString',
    'toUTCString',
];
/**
 * Whitelist of safe methods that can be called on values
 * Using Set for O(1) lookup performance
 */
const SAFE_METHODS = {
    string: new Set(STRING_SAFE_METHODS),
    number: new Set(NUMBER_SAFE_METHODS),
    array: new Set(ARRAY_SAFE_METHODS),
    date: new Set(DATE_SAFE_METHODS),
};
/**
 * Blacklist of property names that should not be accessible
 * These properties can leak information about object structure or enable attacks
 */
const BLOCKED_PROPERTIES = new Set([
    'constructor',
    '__proto__',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
]);
/**
 * Safely evaluates an AST node with a given context
 */
class Evaluator {
    scope;
    expression;
    constructor(scope, expression) {
        this.scope = scope;
        this.expression = expression;
    }
    /**
     * Evaluate an AST node
     */
    evaluate(node) {
        switch (node.type) {
            case 'Literal':
                return node.value;
            case 'Identifier':
                return this.evaluateIdentifier(node.name);
            case 'MemberAccess':
                return this.evaluateMemberAccess(node);
            case 'BinaryOp':
                return this.evaluateBinaryOp(node);
            case 'UnaryOp':
                return this.evaluateUnaryOp(node);
            case 'CallExpression':
                return this.evaluateCallExpression(node);
            case 'ArrayLiteral':
                return this.evaluateArrayLiteral(node);
            default:
                throw new ExpressionParserError(`Unknown node type: ${node.type}`, 0, this.expression);
        }
    }
    evaluateIdentifier(name) {
        if (name in this.scope) {
            return this.scope[name];
        }
        return undefined;
    }
    evaluateMemberAccess(node) {
        const obj = this.evaluate(node.object);
        if (obj === null || obj === undefined) {
            return undefined;
        }
        // Block access to dangerous properties that could leak information or enable attacks
        if (BLOCKED_PROPERTIES.has(node.property)) {
            throw new ExpressionParserError(`Property "${node.property}" is not accessible for security reasons`, 0, this.expression);
        }
        // Allow property access on plain objects and primitives
        if (typeof obj === 'object' || typeof obj === 'string' || typeof obj === 'number') {
            return obj[node.property];
        }
        return undefined;
    }
    evaluateBinaryOp(node) {
        // Handle short-circuit evaluation for logical operators
        if (node.operator === '&&') {
            const left = this.evaluate(node.left);
            return left ? this.evaluate(node.right) : left;
        }
        if (node.operator === '||') {
            const left = this.evaluate(node.left);
            return left ? left : this.evaluate(node.right);
        }
        // For all other operators, evaluate both sides
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);
        switch (node.operator) {
            // Arithmetic
            case '+':
                return left + right;
            case '-':
                return left - right;
            case '*':
                return left * right;
            case '/':
                if (right === 0)
                    return null;
                return left / right;
            case '%':
                if (right === 0)
                    return null;
                return left % right;
            // Comparison - using == and != intentionally for loose equality
            case '==':
                return left == right;
            case '===':
                return left === right;
            case '!=':
                return left != right;
            case '!==':
                return left !== right;
            case '>':
                return left > right;
            case '<':
                return left < right;
            case '>=':
                return left >= right;
            case '<=':
                return left <= right;
            default:
                throw new ExpressionParserError(`Unknown binary operator: ${node.operator}`, 0, this.expression);
        }
    }
    evaluateUnaryOp(node) {
        const operand = this.evaluate(node.operand);
        switch (node.operator) {
            case '!':
                return !operand;
            case '-':
                return -operand;
            case '+':
                return +operand;
            default:
                throw new ExpressionParserError(`Unknown unary operator: ${node.operator}`, 0, this.expression);
        }
    }
    evaluateCallExpression(node) {
        // Only allow method calls (member access), not arbitrary function calls
        if (node.callee.type !== 'MemberAccess') {
            throw new ExpressionParserError('Only method calls are allowed, not arbitrary function calls', 0, this.expression);
        }
        const obj = this.evaluate(node.callee.object);
        const methodName = node.callee.property;
        // Block access to dangerous properties (must check before method call)
        if (BLOCKED_PROPERTIES.has(methodName)) {
            throw new ExpressionParserError(`Property "${methodName}" is not accessible for security reasons`, 0, this.expression);
        }
        // Check if the method is in the instance method whitelist
        if (!this.isMethodSafe(obj, methodName)) {
            throw new ExpressionParserError(`Method "${methodName}" is not allowed for security reasons`, 0, this.expression);
        }
        // Evaluate arguments
        const args = node.arguments.map((arg) => this.evaluate(arg));
        // Call the method with proper `this` binding
        const method = obj[methodName];
        if (typeof method === 'function') {
            // Use .call() to properly bind `this` context
            return method.call(obj, ...args);
        }
        return undefined;
    }
    evaluateArrayLiteral(node) {
        return node.elements.map((element) => this.evaluate(element));
    }
    isMethodSafe(obj, methodName) {
        if (obj === null || obj === undefined) {
            return false;
        }
        const type = Array.isArray(obj) ? 'array' : obj instanceof Date ? 'date' : typeof obj;
        const safeMethods = SAFE_METHODS[type];
        if (!safeMethods) {
            return false;
        }
        return safeMethods.has(methodName);
    }
}

/**
 * Maximum cache size to prevent memory issues
 */
const MAX_AST_CACHE_SIZE$1 = 1000;
/**
 * LRU Cache implementation for AST nodes
 * Tracks access order to evict least-recently-used entries
 */
class LRUCache {
    cache = new Map();
    maxSize;
    constructor(maxSize) {
        this.maxSize = maxSize;
    }
    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }
    set(key, value) {
        // Delete if exists to update position
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // Add to end (most recently used)
        this.cache.set(key, value);
        // Evict least recently used if over limit
        if (this.cache.size > this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
    }
    clear() {
        this.cache.clear();
    }
    get size() {
        return this.cache.size;
    }
}
/**
 * Cache for parsed AST nodes to improve performance
 */
const astCache = new LRUCache(MAX_AST_CACHE_SIZE$1);
/**
 * Secure expression parser that uses AST-based evaluation
 *
 * This parser provides:
 * - Security: No arbitrary code execution, only whitelisted operations
 * - Performance: AST caching for repeated expressions
 * - Better errors: Clear error messages with position information
 * - Type safety: Strongly typed AST and evaluation
 */
class ExpressionParser {
    /**
     * Parse an expression string into an AST
     * Results are cached for performance using LRU eviction
     */
    static parse(expression) {
        // Check cache first
        const cached = astCache.get(expression);
        if (cached) {
            return cached;
        }
        // Parse the expression
        const parser = new Parser(expression);
        const ast = parser.parse();
        // Cache the result (LRU cache handles eviction automatically)
        astCache.set(expression, ast);
        return ast;
    }
    /**
     * Evaluate an expression with a given scope
     */
    static evaluate(expression, scope) {
        try {
            const ast = this.parse(expression);
            const evaluator = new Evaluator(scope, expression);
            return evaluator.evaluate(ast);
        }
        catch (error) {
            if (error instanceof ExpressionParserError) {
                throw error;
            }
            // Wrap other errors for consistency
            throw new ExpressionParserError(`Error evaluating expression: ${error instanceof Error ? error.message : String(error)}`, 0, expression);
        }
    }
    /**
     * Clear the AST cache
     */
    static clearCache() {
        astCache.clear();
    }
    /**
     * Get cache statistics
     */
    static getCacheStats() {
        return {
            size: astCache.size,
            maxSize: MAX_AST_CACHE_SIZE$1,
        };
    }
}

/**
 * Evaluate conditional expression
 * Uses secure AST-based parsing for JavaScript expressions
 */
function evaluateCondition(expression, context) {
    switch (expression.type) {
        case 'fieldValue':
            return evaluateFieldValueCondition(expression, context);
        case 'javascript':
            return evaluateJavaScriptExpression(expression, context);
        case 'custom': {
            const customFn = context.customFunctions?.[expression.functionName];
            if (!customFn) {
                context.logger.error('Custom function not found:', expression.functionName);
                return false;
            }
            try {
                return !!customFn(context);
            }
            catch (error) {
                context.logger.error('Error executing custom function:', expression.functionName, error);
                return false;
            }
        }
        case 'and':
            return evaluateAndCondition(expression, context);
        case 'or':
            return evaluateOrCondition(expression, context);
        case 'http':
            context.logger.warn('[Dynamic Forms] HTTP conditions are resolved asynchronously via createHttpConditionLogicFunction(). ' +
                'When used inside and/or composites, the HTTP result is not available synchronously. Returning false.');
            return false;
        case 'async':
            context.logger.warn('Async Condition - resolved asynchronously via createAsyncConditionLogicFunction(). ' +
                'When used inside and/or composites, the async result is not available synchronously. Returning false.');
            return false;
        default:
            return false;
    }
}
function evaluateFieldValueCondition(expression, context) {
    // Guard against missing fieldPath — invalid config, return false
    if (!expression.fieldPath)
        return false;
    // Try scoped formValue first (handles sibling field lookups within array items).
    // Fall back to rootFormValue for fields outside the current array scope.
    // Use hasNestedProperty to distinguish "field exists with value undefined"
    // from "field path doesn't exist" — prevents incorrect fallback when an
    // optional array item field is intentionally undefined.
    const fieldValue = hasNestedProperty(context.formValue, expression.fieldPath)
        ? getNestedValue(context.formValue, expression.fieldPath)
        : context.rootFormValue
            ? getNestedValue(context.rootFormValue, expression.fieldPath)
            : undefined;
    return compareValues(fieldValue, expression.value, expression.operator);
}
function evaluateJavaScriptExpression(expression, context) {
    try {
        // Use secure AST-based expression parser instead of dynamic code execution
        const result = ExpressionParser.evaluate(expression.expression, context);
        return !!result;
    }
    catch (error) {
        context.logger.error('Error evaluating JavaScript expression:', expression.expression, error);
        return false;
    }
}
function evaluateAndCondition(expression, context) {
    if (expression.conditions.length === 0)
        return false;
    // All conditions must be true for AND logic
    return expression.conditions.every((condition) => evaluateCondition(condition, context));
}
function evaluateOrCondition(expression, context) {
    if (expression.conditions.length === 0)
        return false;
    // At least one condition must be true for OR logic
    return expression.conditions.some((condition) => evaluateCondition(condition, context));
}

/**
 * Creates an empty derivation collection.
 *
 * @returns Empty collection ready for population
 *
 * @internal
 */
function createEmptyDerivationCollection() {
    return { entries: [] };
}
/**
 * Creates a new derivation chain context for tracking applied derivations.
 *
 * @returns Fresh context for a new derivation cycle
 *
 * @internal
 */
function createDerivationChainContext() {
    return {
        appliedDerivations: new Set(),
        iteration: 0,
    };
}
/**
 * Creates a unique key for a derivation entry.
 *
 * Since derivations are self-targeting, the key is simply the field key.
 * This function exists for semantic clarity and to provide a single point
 * of change if the key format needs to be extended in the future.
 *
 * Note: For array derivations, callers must resolve placeholders
 * (e.g., 'items.$.lineTotal' -> 'items.0.lineTotal') before calling this.
 *
 * @param fieldKey - The field key (with array index already resolved)
 * @returns Unique key for the derivation
 *
 * @internal
 */
function createDerivationKey(fieldKey) {
    return fieldKey;
}
/**
 * Parses a derivation key back into field key.
 *
 * @param key - The derivation key to parse
 * @returns Object containing the field key
 *
 * @internal
 */
function parseDerivationKey(key) {
    return { fieldKey: key };
}

/**
 * Centralized constants for the derivation system.
 *
 * These constants configure the behavior of derivation processing,
 * caching, and path handling. Centralizing them enables:
 * - Easy configuration changes
 * - Consistent values across all derivation modules
 * - Clear documentation of magic numbers
 *
 * @module
 */
/**
 * Maximum number of derivation iterations before stopping to prevent infinite loops.
 *
 * The value of 10 is chosen based on:
 * - Most derivation chains are 2-3 levels deep (A→B→C)
 * - Complex forms with conditional cascades rarely exceed 5-6 levels
 * - 10 provides headroom for bidirectional sync patterns (A↔B) which may need
 *   2 iterations per pair to stabilize
 * - Higher values delay detection of actual infinite loops
 * - Lower values risk false positives on legitimate deep chains
 *
 * If you hit this limit legitimately, consider:
 * 1. Restructuring derivations to reduce chain depth
 * 2. Using explicit `dependsOn` to control evaluation order
 * 3. Breaking complex derivations into computed signals outside the form
 */
const MAX_DERIVATION_ITERATIONS = 10;
/**
 * Placeholder string for array index in derivation paths.
 *
 * Used in paths like `items.$.quantity` to represent "each item in the array".
 * The `$` is resolved to actual indices at runtime during array derivation processing.
 */
const ARRAY_PLACEHOLDER = '.$.';
/**
 * Maximum size of the expression AST cache.
 *
 * Expressions are parsed into Abstract Syntax Trees (AST) once and cached
 * to avoid re-parsing on each evaluation. The cache uses LRU eviction.
 *
 * 1000 entries handles:
 * - Large forms with many derivation expressions
 * - Multiple form instances with different expressions
 * - Memory efficiency (AST nodes are relatively small)
 */
const MAX_AST_CACHE_SIZE = 1000;
/**
 * Delimiter used to create unique derivation keys from source and target field keys.
 *
 * Uses null character (\x00) which is extremely unlikely to appear in field names,
 * avoiding collision issues that could occur with common delimiters like ':'.
 */
const DERIVATION_KEY_DELIMITER = '\x00';

/**
 * Error message prefix for derivation-related errors.
 * @internal
 */
const ERROR_PREFIX$2 = '[Derivation]';
/**
 * Navigates the form tree to resolve a field instance at the given path.
 *
 * Walks the tree following the same pattern as `setFieldValue`:
 * each segment is looked up on the current node, and signal accessors
 * are called to get the next level.
 *
 * @returns The field instance object, or `undefined` if the path is invalid
 *
 * @internal
 */
function resolveFieldInstance(rootForm, fieldPath) {
    const parts = fieldPath.split('.');
    let current = rootForm;
    for (let i = 0; i < parts.length - 1; i++) {
        const next = current[parts[i]];
        if (!next)
            return undefined;
        current = next;
    }
    const fieldAccessor = current[parts[parts.length - 1]];
    if (!fieldAccessor)
        return undefined;
    return untracked(fieldAccessor);
}
/**
 * Reads the dirty() signal from a field at the given path.
 *
 * Returns `true` if the field is dirty, `false` if pristine,
 * or `undefined` if the field cannot be found.
 *
 * @internal
 */
function readFieldDirty(rootForm, fieldPath) {
    const fieldInstance = resolveFieldInstance(rootForm, fieldPath);
    if (!fieldInstance)
        return undefined;
    return untracked(fieldInstance.dirty);
}
/**
 * Resets a field's dirty/touched state at the given path.
 *
 * Used for re-engagement: when a dependency changes, clear the user override
 * so the derivation can re-apply.
 *
 * Uses the public `reset()` API on FieldState, which clears both
 * dirty and touched without changing the field's value.
 *
 * @internal
 */
function resetFieldState(rootForm, fieldPath) {
    const fieldInstance = resolveFieldInstance(rootForm, fieldPath);
    if (!fieldInstance)
        return;
    fieldInstance.reset();
}
/**
 * Applies a value to the form at the specified path.
 *
 * Uses bracket notation to access child FieldTrees, following the same pattern
 * as group-field and array-field components. Fields are accessed as signals
 * and their value is set via the `.value.set()` method.
 *
 * Handles nested paths and array paths with '$' placeholder.
 *
 * @internal
 */
function applyValueToForm(targetPath, value, rootForm, logger, warningTracker) {
    // Handle simple top-level fields
    if (!targetPath.includes('.')) {
        return setFieldValue(rootForm, targetPath, value, logger, warningTracker);
    }
    // Handle nested paths (e.g., 'address.city' or 'items.$.quantity')
    const parts = targetPath.split('.');
    let current = rootForm;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        // Handle array index placeholder '$'
        if (part === '$') {
            // This case should be resolved at collection time
            // If we still have '$', we need to skip for now
            return false;
        }
        // Navigate to the next level using bracket notation
        const next = current[part];
        if (!next) {
            warnMissingField(targetPath, logger, warningTracker);
            return false; // Path doesn't exist
        }
        current = next;
    }
    // Set the final value
    const finalPart = parts[parts.length - 1];
    return setFieldValue(current, finalPart, value, logger, warningTracker);
}
/**
 * Sets a field value using the Angular Signal Forms pattern.
 *
 * Accesses the child field via bracket notation, drills down to find
 * the WritableSignal, and uses isWritableSignal for type-safe signal detection.
 *
 * Angular Signal Forms structure:
 * - form[key] is a callable function (field accessor)
 * - form[key]() returns the field instance with { value: WritableSignal<T> }
 * - form[key]().value.set(newValue) sets the value
 *
 * @returns true if the value was successfully set, false if field not found
 *
 * @internal
 */
function setFieldValue(parent, fieldKey, value, logger, warningTracker) {
    const fieldAccessor = parent[fieldKey];
    if (!fieldAccessor) {
        warnMissingField(fieldKey, logger, warningTracker);
        return false;
    }
    // Call the FieldTree to get the FieldState
    const fieldInstance = untracked(fieldAccessor);
    if (!fieldInstance || typeof fieldInstance !== 'object') {
        warnMissingField(fieldKey, logger, warningTracker);
        return false;
    }
    // Get the value signal and verify it's a WritableSignal
    const valueSignal = fieldInstance.value;
    if (isWritableSignal(valueSignal)) {
        // Writing directly to value.set() does NOT trigger markAsDirty() —
        // only user interaction through setControlValue() does. So derivation-applied
        // values leave the field pristine, and dirty() reliably indicates user edits.
        valueSignal.set(value);
        return true;
    }
    else {
        warnMissingField(fieldKey, logger, warningTracker);
        return false;
    }
}
/**
 * Logs a warning for a missing target field (once per field per form instance).
 *
 * Uses the provided warning tracker to avoid log spam. If no tracker is provided,
 * the warning will be logged every time.
 *
 * @internal
 */
function warnMissingField(fieldKey, logger, warningTracker) {
    // If tracker is provided, check if we've already warned about this field
    if (warningTracker) {
        if (warningTracker.warnedFields.has(fieldKey)) {
            return;
        }
        warningTracker.warnedFields.add(fieldKey);
    }
    logger?.warn(`${ERROR_PREFIX$2} Target field '${fieldKey}' not found in form. ` +
        `Ensure the field is defined in your form configuration. ` +
        `This warning is shown once per field.`);
}

/**
 * Applies all pending derivations from a collection.
 *
 * This function processes derivations in order, evaluating conditions
 * and computing values. It handles loop prevention through:
 * 1. Chain tracking (prevents same derivation from running twice in one cycle)
 * 2. Value equality checks (skips if target already has computed value)
 * 3. Max iteration limit (safety fallback)
 *
 * @param collection - The collected derivation entries
 * @param context - Context for applying derivations
 * @param changedFields - Set of field keys that changed (for filtering)
 * @returns Result of the derivation processing
 *
 * @example
 * ```typescript
 * const result = applyDerivations(collection, {
 *   formValue: formValueSignal,
 *   rootForm: form(),
 *   derivationFunctions: customFnConfig?.derivations,
 *   logger: inject(DynamicFormLogger),
 * });
 *
 * if (result.maxIterationsReached) {
 *   console.warn('Possible derivation loop detected');
 * }
 * ```
 *
 * @public
 */
function applyDerivations(collection, context, changedFields) {
    const chainContext = createDerivationChainContext();
    chainContext.changedFields = changedFields;
    // Cache formFieldState map per cycle to avoid allocating a new Proxy + Map per entry
    chainContext.formFieldState = createFormFieldStateMap(context.rootForm, false);
    const { derivationLogger } = context;
    const maxIterations = context.maxIterations ?? MAX_DERIVATION_ITERATIONS;
    let appliedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let warnCount = 0;
    // Filter entries based on changed fields
    const entriesToProcess = changedFields ? getEntriesForChangedFields$1(collection.entries, changedFields) : collection.entries;
    // Log cycle start in verbose mode
    derivationLogger.cycleStart('onChange', entriesToProcess.length);
    // Process derivations iteratively until no more changes
    let hasChanges = true;
    while (hasChanges && chainContext.iteration < maxIterations) {
        chainContext.iteration++;
        hasChanges = false;
        // Log iteration in verbose mode
        derivationLogger.iteration(chainContext.iteration);
        for (const entry of entriesToProcess) {
            const result = tryApplyDerivation(entry, context, chainContext);
            if (result.applied) {
                appliedCount++;
                hasChanges = true;
            }
            else if (result.error) {
                errorCount++;
            }
            else if (result.warning) {
                warnCount++;
                skippedCount++;
            }
            else {
                skippedCount++;
            }
        }
    }
    // Build result
    const processingResult = {
        appliedCount,
        skippedCount,
        errorCount,
        warnCount,
        iterations: chainContext.iteration,
        maxIterationsReached: chainContext.iteration >= maxIterations,
    };
    if (processingResult.maxIterationsReached) {
        derivationLogger.maxIterationsReached(processingResult, 'onChange');
    }
    // Log summary
    derivationLogger.summary(processingResult, 'onChange');
    return processingResult;
}
/**
 * Gets entries that should be processed based on changed fields.
 *
 * Filters entries by checking if any of their dependencies are in the changed fields set.
 * Also includes all wildcard (*) entries since they depend on any form change.
 *
 * **Parent-key matching:** Since `changedFields` contains root-level keys (e.g., `'address'`),
 * but derivation entries may target or depend on nested paths (e.g., `'address.city'`),
 * this function checks `startsWith(changed + '.')` to include entries whose field or
 * dependencies live under a changed parent. This is intentionally broad — false positives
 * are acceptable for filtering because entries are still guarded by value-equality checks
 * (`isEqual`) in `tryApplyDerivation` and will be skipped if the value hasn't changed.
 *
 * Note: Performance is O(n) where n = total entries. For large forms with many
 * derivations, consider optimizing with indexed lookup maps.
 *
 * @internal
 */
function getEntriesForChangedFields$1(entries, changedFields) {
    return entries.filter((entry) => {
        // Entries with no dependencies or wildcard dependencies always run
        if (entry.dependsOn.length === 0 || entry.dependsOn.includes('*')) {
            return true;
        }
        // Check if any dependency matches a changed field directly
        if (entry.dependsOn.some((dep) => changedFields.has(dep))) {
            return true;
        }
        // For array entries (fieldKey contains '$'), check if the entry's parent
        // array key changed. Array derivations have relative dependencies
        // (e.g., 'quantity') but changedFields contains root keys (e.g., 'lineItems').
        for (const changed of changedFields) {
            // Check if this entry lives under a changed parent (array or nested)
            if (entry.fieldKey.startsWith(changed + '.'))
                return true;
            // Check if a dependency is nested under a changed parent
            if (entry.dependsOn.some((dep) => dep.startsWith(changed + '.')))
                return true;
        }
        return false;
    });
}
/**
 * Attempts to apply a single derivation.
 *
 * **Important:** When a derivation's condition evaluates to `false`, the previously
 * derived value is NOT automatically cleared. If you need to reset a field when a
 * condition becomes false, use a separate derivation with an inverted condition
 * that sets the desired fallback value.
 *
 * @example
 * ```typescript
 * // Two derivations for conditional value with cleanup:
 * // When country is USA, set phonePrefix to '+1'
 * { key: 'phonePrefix', logic: [{ type: 'derivation', condition: { field: 'country', operator: '==', value: 'USA' }, value: '+1' }] }
 * // When country is NOT USA, clear phonePrefix
 * { key: 'phonePrefix', logic: [{ type: 'derivation', condition: { field: 'country', operator: '!=', value: 'USA' }, value: '' }] }
 * ```
 *
 * @internal
 */
function tryApplyDerivation(entry, context, chainContext) {
    const { derivationLogger } = context;
    // HTTP and async entries are processed asynchronously in their own streams — skip in sync loop
    if (entry.http || entry.asyncFunctionName) {
        return { applied: false, fieldKey: entry.fieldKey };
    }
    // Check if this is an array field derivation (has '$' placeholder)
    if (isArrayPlaceholderPath(entry.fieldKey)) {
        return tryApplyArrayDerivation(entry, context, chainContext);
    }
    const derivationKey = createDerivationKey(entry.fieldKey);
    // Check if already applied in this cycle
    if (chainContext.appliedDerivations.has(derivationKey)) {
        derivationLogger.evaluation({
            debugName: entry.debugName,
            fieldKey: entry.fieldKey,
            result: 'skipped',
            skipReason: 'already-applied',
        });
        return { applied: false, fieldKey: entry.fieldKey };
    }
    // Check stopOnUserOverride — skip if the user has manually edited the target field
    if (shouldSkipForUserOverride(entry, entry.fieldKey, context, chainContext)) {
        derivationLogger.evaluation({
            debugName: entry.debugName,
            fieldKey: entry.fieldKey,
            result: 'skipped',
            skipReason: 'user-override',
        });
        return { applied: false, fieldKey: entry.fieldKey };
    }
    // Create evaluation context
    const formValue = untracked(() => context.formValue());
    const evalContext = createEvaluationContext$1(entry, formValue, context, chainContext);
    // Evaluate condition
    if (!evaluateDerivationCondition(entry.condition, evalContext)) {
        derivationLogger.evaluation({
            debugName: entry.debugName,
            fieldKey: entry.fieldKey,
            result: 'skipped',
            skipReason: 'condition-false',
        });
        return { applied: false, fieldKey: entry.fieldKey };
    }
    // Compute derived value
    let newValue;
    try {
        newValue = computeDerivedValue(entry, evalContext, context);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        context.logger.error(formatDerivationError(entry, 'compute', errorMessage));
        derivationLogger.evaluation({
            debugName: entry.debugName,
            fieldKey: entry.fieldKey,
            result: 'error',
            error: errorMessage,
        });
        return {
            applied: false,
            fieldKey: entry.fieldKey,
            error: errorMessage,
        };
    }
    // Check if value actually changed using exact equality.
    // Note: This uses isEqual which performs deep comparison with exact IEEE 754
    // equality for numbers. Bidirectional derivations with floating-point math
    // may oscillate due to rounding errors. Use explicit rounding in expressions
    // or integer arithmetic to avoid this issue.
    const currentValue = getNestedValue(formValue, entry.fieldKey);
    if (isEqual(currentValue, newValue)) {
        derivationLogger.evaluation({
            debugName: entry.debugName,
            fieldKey: entry.fieldKey,
            result: 'skipped',
            skipReason: 'value-unchanged',
        });
        return { applied: false, fieldKey: entry.fieldKey };
    }
    // Apply the value
    try {
        const wasApplied = applyValueToForm(entry.fieldKey, newValue, context.rootForm, context.logger, context.warningTracker);
        if (wasApplied) {
            chainContext.appliedDerivations.add(derivationKey);
            derivationLogger.evaluation({
                debugName: entry.debugName,
                fieldKey: entry.fieldKey,
                result: 'applied',
                previousValue: currentValue,
                newValue,
            });
            return { applied: true, fieldKey: entry.fieldKey, newValue };
        }
        else {
            // Field not found - this is a warning, not an error
            // The warning was already logged by warnMissingField
            derivationLogger.evaluation({
                debugName: entry.debugName,
                fieldKey: entry.fieldKey,
                result: 'skipped',
                skipReason: 'target-not-found',
            });
            return {
                applied: false,
                fieldKey: entry.fieldKey,
                warning: `Field '${entry.fieldKey}' not found`,
            };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        context.logger.error(formatDerivationError(entry, 'apply', errorMessage));
        derivationLogger.evaluation({
            debugName: entry.debugName,
            fieldKey: entry.fieldKey,
            result: 'error',
            error: errorMessage,
        });
        return {
            applied: false,
            fieldKey: entry.fieldKey,
            error: errorMessage,
        };
    }
}
/**
 * Handles array field derivations with '$' placeholder.
 *
 * Iterates over all array items and applies the derivation for each,
 * resolving '$' to the actual index and creating scoped evaluation contexts.
 *
 * @internal
 */
function tryApplyArrayDerivation(entry, context, chainContext) {
    const formValue = untracked(() => context.formValue());
    // Parse the field path using path utilities
    const pathInfo = parseArrayPath(entry.fieldKey);
    if (!pathInfo.isArrayPath) {
        return { applied: false, fieldKey: entry.fieldKey, error: 'Invalid array derivation path' };
    }
    const { arrayPath } = pathInfo;
    // Get the array from form values
    const arrayValue = getNestedValue(formValue, arrayPath);
    if (!Array.isArray(arrayValue)) {
        return { applied: false, fieldKey: entry.fieldKey };
    }
    let appliedAny = false;
    // Process each array item
    for (let i = 0; i < arrayValue.length; i++) {
        const resolvedPath = resolveArrayPath(entry.fieldKey, i);
        const derivationKey = createDerivationKey(resolvedPath);
        // Skip if already applied in this cycle
        if (chainContext.appliedDerivations.has(derivationKey)) {
            continue;
        }
        // Check stopOnUserOverride for array items using dirty() signal
        if (shouldSkipForUserOverride(entry, resolvedPath, context, chainContext)) {
            context.derivationLogger.evaluation({
                debugName: entry.debugName,
                fieldKey: resolvedPath,
                result: 'skipped',
                skipReason: 'user-override',
            });
            continue;
        }
        // Create evaluation context scoped to this array item
        const arrayItem = arrayValue[i];
        const evalContext = createArrayItemEvaluationContext$1(entry, arrayItem, formValue, i, arrayPath, context, chainContext);
        // Evaluate condition
        if (!evaluateDerivationCondition(entry.condition, evalContext)) {
            continue;
        }
        // Compute derived value
        let newValue;
        try {
            newValue = computeDerivedValue(entry, evalContext, context);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.logger.error(formatDerivationError(entry, 'compute', `[index ${i}] ${errorMessage}`));
            continue;
        }
        // Check if value actually changed
        const currentValue = getNestedValue(formValue, resolvedPath);
        if (isEqual(currentValue, newValue)) {
            continue;
        }
        // Apply the value
        try {
            applyValueToForm(resolvedPath, newValue, context.rootForm, context.logger, context.warningTracker);
            chainContext.appliedDerivations.add(derivationKey);
            appliedAny = true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.logger.error(formatDerivationError(entry, 'apply', `[index ${i}] ${errorMessage}`));
        }
    }
    return { applied: appliedAny, fieldKey: entry.fieldKey };
}
/**
 * Creates an evaluation context for derivation processing.
 *
 * @internal
 */
function createEvaluationContext$1(entry, formValue, context, chainContext) {
    const fieldValue = getNestedValue(formValue, entry.fieldKey);
    // Create field state snapshot for this specific field (non-reactive)
    const fieldAccessor = context.rootForm[entry.fieldKey];
    const fieldState = fieldAccessor ? readFieldStateInfo(fieldAccessor, false) : undefined;
    return {
        fieldValue,
        formValue,
        fieldPath: entry.fieldKey,
        customFunctions: context.customFunctions,
        externalData: context.externalData,
        logger: context.logger,
        fieldState,
        formFieldState: chainContext.formFieldState,
    };
}
/**
 * Creates an evaluation context scoped to a specific array item.
 *
 * For array derivations, `formValue` in the expression should reference
 * the current array item's values, not the root form values.
 *
 * @internal
 */
function createArrayItemEvaluationContext$1(entry, arrayItem, rootFormValue, itemIndex, arrayPath, context, chainContext) {
    // For array item expressions, formValue should be the array item
    // This allows expressions like 'formValue.quantity * formValue.unitPrice'
    // to work within the context of each array item
    // Create field state snapshot for the specific array item field
    // Navigate: rootForm[arrayPath][index][fieldKey]
    const pathInfo = parseArrayPath(entry.fieldKey);
    let fieldState;
    if (pathInfo.isArrayPath && pathInfo.relativePath) {
        const rootFormRecord = context.rootForm;
        const arrayAccessor = rootFormRecord[arrayPath];
        if (arrayAccessor) {
            const arrayItems = arrayAccessor;
            const itemAccessor = arrayItems[String(itemIndex)];
            if (itemAccessor) {
                const itemFields = itemAccessor;
                const fieldAccessor = itemFields[pathInfo.relativePath];
                if (fieldAccessor) {
                    fieldState = readFieldStateInfo(fieldAccessor, false);
                }
            }
        }
    }
    return {
        fieldValue: arrayItem,
        formValue: arrayItem,
        fieldPath: `${arrayPath}.${itemIndex}`,
        customFunctions: context.customFunctions,
        externalData: context.externalData,
        logger: context.logger,
        // Provide access to root form value for cross-scope references
        rootFormValue,
        arrayIndex: itemIndex,
        arrayPath,
        fieldState,
        formFieldState: chainContext.formFieldState,
    };
}
/**
 * Evaluates the derivation condition.
 *
 * @internal
 */
function evaluateDerivationCondition(condition, context) {
    if (typeof condition === 'boolean') {
        return condition;
    }
    return evaluateCondition(condition, context);
}
/**
 * Computes the derived value based on the entry configuration.
 *
 * @internal
 */
function computeDerivedValue(entry, evalContext, applicatorContext) {
    // Static value
    if (entry.value !== undefined) {
        return entry.value;
    }
    // Expression
    if (entry.expression) {
        return ExpressionParser.evaluate(entry.expression, evalContext);
    }
    // Custom function
    if (entry.functionName) {
        const fn = applicatorContext.derivationFunctions?.[entry.functionName];
        if (!fn) {
            throw new Error(`Derivation function '${entry.functionName}' not found in customFnConfig.derivations`);
        }
        return fn(evalContext);
    }
    // No value source specified
    throw new Error(`Derivation for ${entry.fieldKey} has no value source. ` + `Specify 'value', 'expression', or 'functionName'.`);
}
/**
 * Error message prefix for derivation-related errors.
 * @internal
 */
const ERROR_PREFIX$1 = '[Derivation]';
/**
 * Creates a standardized error message for derivation errors.
 * @internal
 */
function formatDerivationError(entry, phase, message) {
    const source = entry.expression
        ? `expression: "${entry.expression.substring(0, 50)}${entry.expression.length > 50 ? '...' : ''}"`
        : entry.functionName
            ? `function: "${entry.functionName}"`
            : entry.value !== undefined
                ? 'static value'
                : 'unknown source';
    return `${ERROR_PREFIX$1} Failed to ${phase} derivation (field: ${entry.fieldKey}, ${source}): ${message}`;
}
/**
 * Checks whether any of the entry's dependencies appear in the changed fields set.
 *
 * **Known limitation for array derivations:** `changedFields` contains root-level keys
 * (e.g., `'lineItems'`) produced by `getChangedKeys()`, but array derivation dependencies
 * use relative names (e.g., `['quantity', 'unitPrice']`). This means `reEngageOnDependencyChange`
 * only fires for root-level dependencies (e.g., `'discountRate'`) — NOT for intra-item
 * dependencies like `'quantity'` within the same array item.
 *
 * Adding parent-key matching (checking if `entry.fieldKey.startsWith(changed + '.')`)
 * was attempted but causes false positives: editing the TARGET field also triggers
 * `changedFields = {'lineItems'}`, which would reset dirty immediately and break
 * `stopOnUserOverride`. Fixing this requires per-field change tracking instead of
 * per-root-key tracking — a more significant architectural change.
 *
 * @internal
 */
function hasDependencyChanged(entry, changedFields) {
    return entry.dependsOn.some((dep) => dep === '*' || changedFields.has(dep));
}
/**
 * Checks whether a derivation should be skipped due to the user having manually
 * edited the target field. Handles re-engagement when `reEngageOnDependencyChange`
 * is set and a dependency has changed.
 *
 * @returns `true` if the derivation should be skipped, `false` otherwise
 *
 * @internal
 */
function shouldSkipForUserOverride(entry, resolvedFieldKey, context, chainContext) {
    if (!entry.stopOnUserOverride)
        return false;
    const isDirty = readFieldDirty(context.rootForm, resolvedFieldKey) ?? false;
    // If the field isn't dirty, no override to skip — and no re-engagement needed.
    // This also avoids wasteful resetFieldState calls on initial form render where
    // changedFields contains all keys (from startWith(null) + pairwise()) but fields
    // are all pristine.
    if (!isDirty)
        return false;
    // Re-engagement: reset dirty state if a dependency changed, allowing re-derivation
    if (entry.reEngageOnDependencyChange && chainContext.changedFields) {
        if (hasDependencyChanged(entry, chainContext.changedFields)) {
            resetFieldState(context.rootForm, resolvedFieldKey);
            // Re-read after reset — field is now pristine, so derivation proceeds
            return false;
        }
    }
    // Field is dirty and no re-engagement triggered — skip derivation
    return true;
}
/**
 * Processes derivations for a specific trigger type.
 *
 * Filters entries by trigger type and applies them.
 *
 * @param collection - The collected derivation entries
 * @param trigger - The trigger type to filter by
 * @param context - Context for applying derivations
 * @param changedFields - Set of field keys that changed (for filtering)
 * @returns Result of the derivation processing
 *
 * @public
 */
function applyDerivationsForTrigger(collection, trigger, context, changedFields) {
    // Filter entries by trigger type, excluding HTTP and async entries (processed in async streams)
    const filteredEntries = collection.entries.filter((entry) => {
        if (entry.http || entry.asyncFunctionName)
            return false;
        if (trigger === 'onChange') {
            return !entry.trigger || entry.trigger === 'onChange';
        }
        return entry.trigger === trigger;
    });
    // Create a minimal collection with filtered entries
    const filteredCollection = {
        entries: filteredEntries,
    };
    return applyDerivations(filteredCollection, context, changedFields);
}
/**
 * Gets all debounced derivation entries from a collection.
 *
 * Use this to extract debounced entries for separate processing with debounce timers.
 *
 * @param collection - The collected derivation entries
 * @returns Array of debounced derivation entries
 *
 * @public
 */
function getDebouncedDerivationEntries(collection) {
    return collection.entries.filter((entry) => entry.trigger === 'debounced');
}

/**
 * Creates the default derivation log configuration.
 *
 * Defaults to 'none' (silent). Users can enable logging via `withLoggerConfig`.
 *
 * @returns Default DerivationLogConfig
 *
 * @public
 */
function createDefaultDerivationLogConfig() {
    return {
        level: 'none',
    };
}
/**
 * Checks if logging should occur at the specified level.
 *
 * @param config - Current log configuration
 * @param minLevel - Minimum level required for logging
 * @returns True if logging should occur
 *
 * @public
 */
function shouldLog(config, minLevel) {
    if (config.level === 'none')
        return false;
    if (minLevel === 'summary')
        return config.level === 'summary' || config.level === 'verbose';
    return config.level === 'verbose';
}
/**
 * Type guard to check if a condition is a FormStateCondition.
 *
 * @param condition - The condition to check
 * @returns true if the condition is a FormStateCondition
 *
 * @public
 */
function isFormStateCondition(condition) {
    return typeof condition === 'string' && ['formInvalid', 'formSubmitting', 'pageInvalid'].includes(condition);
}
/**
 * Type guard to check if a logic config is a StateLogicConfig.
 *
 * @param config - The logic config to check
 * @returns true if the config is for field state logic
 *
 * @public
 */
function isStateLogicConfig(config) {
    return config.type === 'hidden' || config.type === 'readonly' || config.type === 'disabled' || config.type === 'required';
}
/**
 * Type guard to check if a logic config is a DerivationLogicConfig.
 *
 * @param config - The logic config to check
 * @returns true if the config is for value derivation
 *
 * @public
 */
function isDerivationLogicConfig(config) {
    return config.type === 'derivation';
}
/**
 * Type guard to check if a derivation config targets a property rather than the field value.
 *
 * When `targetProperty` is present on a `type: 'derivation'` config, it is routed
 * to the property derivation pipeline instead of the value derivation pipeline.
 *
 * @param config - The derivation logic config to check
 * @returns true if the config has a targetProperty (property derivation)
 *
 * @public
 */
function hasTargetProperty(config) {
    return 'targetProperty' in config && typeof config.targetProperty === 'string' && config.targetProperty.length > 0;
}

/**
 * Regular expression to detect formValue property access in expressions.
 * Matches patterns like: formValue.fieldName, formValue['fieldName'], formValue["fieldName"]
 */
const FORM_VALUE_ACCESS_PATTERN = /\bformValue\s*(?:\.|\[)/;
/**
 * Regular expressions to extract field paths from formValue expressions.
 *
 * Enhanced to capture full nested paths including dot notation chains:
 * - formValue.fieldName → captures 'fieldName'
 * - formValue.parent.child.grandchild → captures 'parent.child.grandchild'
 * - formValue['field-name'] → captures 'field-name'
 * - formValue["field.with.dots"] → captures 'field.with.dots'
 *
 * Note: Computed property access (formValue[variableName]) is NOT supported
 * and must use explicit dependsOn configuration.
 */
const FORM_VALUE_DOT_PATTERN = /\bformValue\.([\w.]+)/g;
const FORM_VALUE_BRACKET_SINGLE_PATTERN = /\bformValue\s*\[\s*'([\w.-]+)'\s*\]/g;
const FORM_VALUE_BRACKET_DOUBLE_PATTERN = /\bformValue\s*\[\s*"([\w.-]+)"\s*\]/g;
/**
 * Detects if a ConditionalExpression references other fields (cross-field).
 *
 * This is the core detection function that handles ALL expression types:
 * - `fieldValue` with `fieldPath` → Always cross-field
 * - `formValue` → Always cross-field
 * - `javascript` with `formValue.*` in expression → Cross-field
 * - `custom` → Checks registered function scope, defaults to cross-field if unknown
 * - `and`/`or` → Recursively check nested conditions
 *
 * @param expr The conditional expression to analyze
 * @param context Optional context providing function scope lookup
 * @returns true if the expression references other fields
 */
function isCrossFieldExpression(expr, context) {
    // Boolean, undefined, or FormStateCondition (form-level state checks) are not cross-field
    if (expr === undefined || typeof expr === 'boolean' || isFormStateCondition(expr)) {
        return false;
    }
    switch (expr.type) {
        case 'fieldValue':
            // fieldPath means it references another field's value
            return !!expr.fieldPath;
        case 'javascript':
            // Check for formValue.* patterns in the expression string
            return FORM_VALUE_ACCESS_PATTERN.test(expr.expression || '');
        case 'custom': {
            // For custom functions, determine scope from registry or default to cross-field.
            // Look up function scope from registry if context is provided
            const functionName = expr.functionName;
            if (context?.getFunctionScope && functionName) {
                const scope = context.getFunctionScope(functionName);
                if (scope === 'field') {
                    // Function is explicitly marked as field-scoped (no cross-field deps)
                    return false;
                }
                // 'form' scope or undefined → treat as cross-field
            }
            // Default: conservative approach - assume cross-field
            return true;
        }
        case 'async':
            // Async conditions create their own toObservable → toSignal pipeline
            // and manage reactivity independently — not cross-field in the sync graph
            return false;
        case 'and':
        case 'or':
            // Recursively check nested conditions, passing context through
            return (expr.conditions || []).some((c) => isCrossFieldExpression(c, context));
        default:
            return false;
    }
}
/**
 * Extracts field dependencies from a ConditionalExpression.
 *
 * Returns an array of field keys that the expression depends on.
 * For `formValue` type without specific field, returns ['*'] to indicate
 * dependency on the entire form.
 *
 * @param expr The conditional expression to analyze
 * @returns Array of field keys that this expression depends on
 */
function extractExpressionDependencies(expr) {
    if (expr === undefined || typeof expr === 'boolean') {
        return [];
    }
    const deps = new Set();
    switch (expr.type) {
        case 'fieldValue':
            if (expr.fieldPath) {
                // Extract root field name (before any dots for nested paths)
                deps.add(expr.fieldPath.split('.')[0]);
            }
            break;
        case 'javascript':
            // Extract from formValue.* patterns in expression
            extractFromExpressionString(expr.expression || '', deps);
            break;
        case 'custom':
            // Custom functions have full form access - conservative approach
            deps.add('*');
            break;
        case 'async':
            // Async conditions manage their own reactivity — no auto-extractable dependencies
            break;
        case 'and':
        case 'or':
            // Recursively extract from nested conditions
            for (const condition of expr.conditions || []) {
                extractExpressionDependencies(condition).forEach((d) => deps.add(d));
            }
            break;
    }
    return Array.from(deps);
}
/**
 * Extracts field names from a JavaScript expression string.
 * Handles both dot notation (formValue.field) and bracket notation (formValue['field']).
 */
function extractStringDependencies(expression) {
    const deps = new Set();
    extractFromExpressionString(expression, deps);
    return Array.from(deps);
}
/**
 * Internal helper that populates a Set with dependencies from an expression string.
 *
 * Extracts both root fields and full nested paths for precise dependency tracking:
 * - 'formValue.parent.child' → adds 'parent' (root) and 'parent.child' (full path)
 * - 'formValue.simple' → adds 'simple'
 */
function extractFromExpressionString(expression, deps) {
    // Extract from dot notation: formValue.fieldName or formValue.parent.child.grandchild
    const dotMatches = expression.matchAll(FORM_VALUE_DOT_PATTERN);
    for (const match of dotMatches) {
        const fullPath = match[1];
        // Always add the root field (first segment) as the primary dependency
        const rootField = fullPath.split('.')[0];
        deps.add(rootField);
        // Also add the full path for more precise dependency tracking if nested
        if (fullPath.includes('.')) {
            deps.add(fullPath);
        }
    }
    // Extract from bracket notation with single quotes: formValue['fieldName']
    const bracketSingleMatches = expression.matchAll(FORM_VALUE_BRACKET_SINGLE_PATTERN);
    for (const match of bracketSingleMatches) {
        const fullPath = match[1];
        const rootField = fullPath.split('.')[0];
        deps.add(rootField);
        if (fullPath.includes('.')) {
            deps.add(fullPath);
        }
    }
    // Extract from bracket notation with double quotes: formValue["fieldName"]
    const bracketDoubleMatches = expression.matchAll(FORM_VALUE_BRACKET_DOUBLE_PATTERN);
    for (const match of bracketDoubleMatches) {
        const fullPath = match[1];
        const rootField = fullPath.split('.')[0];
        deps.add(rootField);
        if (fullPath.includes('.')) {
            deps.add(fullPath);
        }
    }
}
// ============================================================================
// Validator Detection
// ============================================================================
/**
 * Detects if a custom validator configuration references formValue (cross-field validation).
 *
 * @param config The custom validator configuration to check
 * @returns true if the validator references formValue
 */
function isCrossFieldValidator(config) {
    if (!config.expression) {
        return false;
    }
    return FORM_VALUE_ACCESS_PATTERN.test(config.expression);
}
/**
 * Detects if a built-in validator has a dynamic expression that references formValue.
 *
 * Built-in validators (min, max, pattern, etc.) can have dynamic expressions
 * like `{ type: 'min', expression: 'formValue.minAge' }`.
 *
 * @param config The validator configuration to check
 * @returns true if the validator has a cross-field dynamic expression
 */
function isCrossFieldBuiltInValidator(config) {
    if (config.type === 'custom') {
        return false; // Custom validators handled separately
    }
    // Check if expression property references formValue
    if ('expression' in config && typeof config.expression === 'string') {
        return FORM_VALUE_ACCESS_PATTERN.test(config.expression);
    }
    return false;
}
/**
 * Checks if a validator uses Angular's resource API (validateHttp / validateAsync).
 *
 * Resource-based validators handle cross-field when-conditions internally
 * via their request/params callbacks returning `undefined`. They must NOT
 * be skipped by the cross-field early-return guard in `applyValidator`,
 * because they require field-level registration.
 */
function isResourceBasedValidator(config) {
    return config.type === 'async' || config.type === 'http';
}
/**
 * Detects if a validator's `when` condition is cross-field.
 *
 * @param config The validator configuration to check
 * @param context Optional context providing function scope lookup
 * @returns true if the when condition references other fields
 */
function hasCrossFieldWhenCondition(config, context) {
    if (!('when' in config) || !config.when) {
        return false;
    }
    return isCrossFieldExpression(config.when, context);
}
// ============================================================================
// Logic Detection
// ============================================================================
/**
 * Detects if a StateLogicConfig has a cross-field condition.
 *
 * Note: This function only handles state logic (hidden, readonly, disabled, required).
 * Derivation logic is handled separately by the derivation system.
 *
 * @param config The state logic configuration to check
 * @param context Optional context providing function scope lookup
 * @returns true if the logic condition references other fields
 */
function isCrossFieldStateLogic(config, context) {
    return isCrossFieldExpression(config.condition, context);
}
// ============================================================================
// Schema Detection
// ============================================================================
/**
 * Detects if a SchemaApplicationConfig has a cross-field condition.
 *
 * @param config The schema application configuration to check
 * @param context Optional context providing function scope lookup
 * @returns true if the schema condition references other fields
 */
function isCrossFieldSchema(config, context) {
    if (config.type !== 'applyWhen' || !config.condition) {
        return false;
    }
    return isCrossFieldExpression(config.condition, context);
}

/**
 * Sorts derivation entries in topological order based on their dependencies.
 *
 * This ensures that derivations are processed in the correct order:
 * if derivation B depends on field A, and derivation A->A' modifies A,
 * then A->A' is processed before B.
 *
 * Uses Kahn's algorithm for topological sorting, which also provides
 * natural handling of entries with no dependencies (they come first).
 *
 * @param entries - The derivation entries to sort
 * @returns A new array of entries in topological order
 *
 * @example
 * ```typescript
 * // Given derivations:
 * // 1. quantity -> lineTotal (depends on quantity, unitPrice)
 * // 2. unitPrice -> lineTotal (depends on quantity, unitPrice)
 * // 3. lineTotal -> grandTotal (depends on lineTotal)
 * //
 * // Topological sort ensures lineTotal is computed before grandTotal
 * const sorted = topologicalSort(entries);
 * // Result: [1, 2, 3] - derivations that produce lineTotal come before
 * // those that consume it
 * ```
 *
 * @public
 */
function topologicalSort(entries) {
    if (entries.length <= 1) {
        return [...entries];
    }
    // Build adjacency list and in-degree count
    // An edge A -> B exists if B depends on the target of A
    const graph = new Map();
    const inDegree = new Map();
    // Initialize
    for (const entry of entries) {
        graph.set(entry, new Set());
        inDegree.set(entry, 0);
    }
    // Pre-build index: field key -> entries that produce/target it
    // This enables O(1) lookup instead of O(n) scanning
    const derivationsByField = new Map();
    for (const entry of entries) {
        // Index by exact field key
        const fieldEntries = derivationsByField.get(entry.fieldKey) ?? [];
        fieldEntries.push(entry);
        derivationsByField.set(entry.fieldKey, fieldEntries);
        // Also index array field relative paths for array derivations
        // If entry targets 'items.$.lineTotal', index under 'lineTotal' too
        if (entry.fieldKey.includes('.$.')) {
            const relativePath = entry.fieldKey.split('.$.')[1];
            if (relativePath) {
                const relativeEntries = derivationsByField.get(relativePath) ?? [];
                relativeEntries.push(entry);
                derivationsByField.set(relativePath, relativeEntries);
            }
        }
    }
    // Collect entries with wildcard dependencies (need special handling)
    const wildcardDependents = [];
    for (const entry of entries) {
        if (entry.dependsOn.includes('*')) {
            wildcardDependents.push(entry);
        }
    }
    // Build edges using pre-computed index
    // For each entry B, find all entries A whose field is in B's dependencies
    // If B depends on field X, and A produces X, then A must run before B
    for (const entryB of entries) {
        for (const dep of entryB.dependsOn) {
            // Skip wildcards here - handled separately below
            if (dep === '*')
                continue;
            // O(1) lookup: find all derivations that produce this dependency
            const producers = derivationsByField.get(dep);
            if (producers) {
                for (const entryA of producers) {
                    const entryAEdges = graph.get(entryA);
                    if (entryA !== entryB && entryAEdges && !entryAEdges.has(entryB)) {
                        entryAEdges.add(entryB);
                        inDegree.set(entryB, (inDegree.get(entryB) ?? 0) + 1);
                    }
                }
            }
        }
    }
    // Handle wildcard dependencies: they depend on ALL producers
    for (const entryB of wildcardDependents) {
        for (const entryA of entries) {
            const entryAEdges = graph.get(entryA);
            if (entryA !== entryB && entryAEdges && !entryAEdges.has(entryB)) {
                entryAEdges.add(entryB);
                inDegree.set(entryB, (inDegree.get(entryB) ?? 0) + 1);
            }
        }
    }
    // Kahn's algorithm: process nodes with in-degree 0
    const queue = [];
    const sorted = [];
    // Start with entries that have no dependencies on other derivation outputs
    for (const entry of entries) {
        if (inDegree.get(entry) === 0) {
            queue.push(entry);
        }
    }
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current)
            break; // TypeScript guard (shouldn't happen due to while condition)
        sorted.push(current);
        // Reduce in-degree for all neighbors
        const neighbors = graph.get(current) ?? new Set();
        for (const neighbor of neighbors) {
            const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
            inDegree.set(neighbor, newDegree);
            if (newDegree === 0) {
                queue.push(neighbor);
            }
        }
    }
    // If we couldn't sort all entries, there's a cycle
    // (but cycles should be caught by cycle-detector, so this is defensive)
    if (sorted.length !== entries.length) {
        // Return original order for entries in cycles
        const sortedSet = new Set(sorted);
        for (const entry of entries) {
            if (!sortedSet.has(entry)) {
                sorted.push(entry);
            }
        }
    }
    return sorted;
}

/**
 * Collects all derivation entries from field definitions.
 *
 * This function traverses the field definition tree and extracts:
 * - Shorthand `derivation` properties on fields
 * - Full `logic` array entries with `type: 'derivation'`
 *
 * The collected entries include dependency information for cycle detection
 * and reactive evaluation. Entries are sorted topologically so derivations
 * are processed in dependency order.
 *
 * Lookup maps (byTarget, byDependency, etc.) are NOT built here to
 * reduce the size of the returned collection.
 *
 * @param fields - Array of field definitions to traverse
 * @returns Collection containing sorted derivation entries
 *
 * @example
 * ```typescript
 * const fields = [
 *   { key: 'quantity', type: 'number' },
 *   { key: 'unitPrice', type: 'number' },
 *   {
 *     key: 'total',
 *     type: 'number',
 *     derivation: 'formValue.quantity * formValue.unitPrice',
 *   },
 * ];
 *
 * const collection = collectDerivations(fields);
 * // collection.entries has 1 entry for the 'total' field derivation
 * ```
 *
 * @public
 */
function collectDerivations(fields) {
    const entries = [];
    const context = {};
    traverseFields$2(fields, entries, context);
    // Sort entries in topological order for efficient processing.
    // This ensures derivations are processed in dependency order,
    // reducing the number of iterations needed in the applicator.
    const sortedEntries = topologicalSort(entries);
    return { entries: sortedEntries };
}
/**
 * Recursively traverses field definitions to collect derivations.
 *
 * @internal
 */
function traverseFields$2(fields, entries, context) {
    for (const field of fields) {
        collectFromField$2(field, entries, context);
        // Recursively process container fields (page, row, group, array)
        if (hasChildFields(field)) {
            const childContext = { ...context };
            // Update array path context if this is an array field
            if (field.type === 'array') {
                childContext.arrayPath = field.key;
                // Array fields have items that can be either FieldDef (primitive) or FieldDef[] (object).
                // Normalize all items to arrays and flatten for traversal.
                const arrayItems = normalizeFieldsArray(field.fields);
                const normalizedChildren = [];
                for (const item of arrayItems) {
                    if (Array.isArray(item)) {
                        // Object item: FieldDef[] - add each field
                        normalizedChildren.push(...item);
                    }
                    else {
                        // Primitive item: single FieldDef - add directly
                        normalizedChildren.push(item);
                    }
                }
                traverseFields$2(normalizedChildren, entries, childContext);
            }
            else {
                traverseFields$2(normalizeFieldsArray(field.fields), entries, childContext);
            }
        }
    }
}
/**
 * Collects derivation entries from a single field.
 *
 * @internal
 */
function collectFromField$2(field, entries, context) {
    const fieldKey = field.key;
    if (!fieldKey)
        return;
    const validationField = field;
    // Collect shorthand derivation property
    if (validationField.derivation) {
        const entry = createShorthandEntry(fieldKey, validationField.derivation, context);
        entries.push(entry);
    }
    // Collect logic array derivations
    if (validationField.logic) {
        for (const logicConfig of validationField.logic) {
            if (isDerivationLogicConfig(logicConfig)) {
                if (hasTargetProperty(logicConfig))
                    continue;
                const entry = createLogicEntry(fieldKey, logicConfig, context);
                entries.push(entry);
            }
        }
    }
}
/**
 * Creates a derivation entry from the shorthand `derivation` property.
 *
 * Shorthand derivations:
 * - Target the same field they're defined on (self-targeting)
 * - Always apply (condition defaults to true)
 * - Always trigger on change
 *
 * @internal
 */
function createShorthandEntry(fieldKey, expression, context) {
    // Build the effective field key, including array path if in array context
    const effectiveFieldKey = context.arrayPath ? `${context.arrayPath}.$.${fieldKey}` : fieldKey;
    return {
        fieldKey: effectiveFieldKey,
        dependsOn: extractStringDependencies(expression),
        condition: true,
        expression,
        trigger: 'onChange',
        isShorthand: true,
    };
}
/**
 * Creates a derivation entry from a full `DerivationLogicConfig`.
 *
 * All derivations are self-targeting: the derivation is defined on and targets
 * the same field (fieldKey). For array fields, the context is used to build
 * the array placeholder path.
 *
 * Handles:
 * - Condition extraction and dependency analysis
 * - Array field context for placeholder paths
 * - Multiple value source types (static, expression, function)
 * - Trigger and debounce configuration
 *
 * @internal
 */
function createLogicEntry(fieldKey, config, context) {
    // Build the effective field key, including array path if in array context
    const effectiveFieldKey = context.arrayPath ? `${context.arrayPath}.$.${fieldKey}` : fieldKey;
    // Runtime guards for HTTP and async derivations.
    // Mutual exclusivity and required fields are now enforced by TypeScript (via `source` discriminant).
    // The wildcard and empty-array checks below are not expressible in the type system.
    if (config.source === 'http') {
        if (config.dependsOn.length === 0) {
            throw new DynamicFormError(`HTTP derivation for '${effectiveFieldKey}' requires explicit 'dependsOn'. ` +
                `Wildcard dependencies would trigger HTTP requests on every form change.`);
        }
        if (config.dependsOn.includes('*')) {
            throw new DynamicFormError(`HTTP derivation for '${effectiveFieldKey}' cannot use wildcard ('*') in 'dependsOn'. ` +
                `Wildcards would trigger HTTP requests on every form change. Specify explicit field dependencies instead.`);
        }
    }
    if (config.source === 'asyncFunction') {
        if (config.dependsOn.length === 0) {
            throw new DynamicFormError(`Async derivation for '${effectiveFieldKey}' requires explicit 'dependsOn'. ` +
                `Wildcard dependencies would trigger async functions on every form change.`);
        }
        if (config.dependsOn.includes('*')) {
            throw new DynamicFormError(`Async derivation for '${effectiveFieldKey}' cannot use wildcard ('*') in 'dependsOn'. ` +
                `Wildcards would trigger async functions on every form change. Specify explicit field dependencies instead.`);
        }
    }
    const dependsOn = extractDependencies$1(config);
    const condition = config.condition ?? true;
    const trigger = config.trigger ?? 'onChange';
    // Extract debounceMs from debounced configs
    // The type system ensures debounceMs is only present when trigger is 'debounced'
    const debounceMs = trigger === 'debounced' ? config.debounceMs : undefined;
    return {
        fieldKey: effectiveFieldKey,
        dependsOn,
        condition,
        value: config.value,
        expression: config.expression,
        functionName: config.functionName,
        http: config.http,
        responseExpression: config.responseExpression,
        asyncFunctionName: config.asyncFunctionName,
        trigger,
        debounceMs,
        isShorthand: false,
        originalConfig: config,
        debugName: config.debugName,
        stopOnUserOverride: config.stopOnUserOverride,
        reEngageOnDependencyChange: config.reEngageOnDependencyChange,
    };
}
/**
 * Extracts all field dependencies from a derivation config.
 *
 * Combines dependencies from:
 * - Explicit `dependsOn` array (if provided, takes precedence)
 * - Condition expression
 * - Value expression
 * - Function name (defaults to '*' if no explicit dependsOn)
 *
 * @internal
 */
function extractDependencies$1(config) {
    const deps = new Set();
    // If explicit dependsOn is provided, use it as the primary source
    // This allows users to override automatic detection and control
    // when derivations are triggered
    if (config.dependsOn && config.dependsOn.length > 0) {
        config.dependsOn.forEach((dep) => deps.add(dep));
    }
    else {
        // Extract from expression (automatic dependency detection)
        if (config.expression) {
            const exprDeps = extractStringDependencies(config.expression);
            exprDeps.forEach((dep) => deps.add(dep));
        }
        // Custom functions assume full form access if no explicit dependsOn
        if (config.functionName) {
            deps.add('*');
        }
    }
    // Always extract from condition (these are additional runtime guards)
    if (config.condition && config.condition !== true) {
        const conditionDeps = extractExpressionDependencies(config.condition);
        conditionDeps.forEach((dep) => deps.add(dep));
    }
    return Array.from(deps);
}

/**
 * Detects cycles in the derivation dependency graph.
 *
 * Uses Kahn's algorithm variant with DFS to detect cycles.
 * Bidirectional sync patterns (A→B→A) are allowed because they stabilize
 * via the equality check at runtime.
 *
 * @param collection - The collected derivation entries
 * @returns Result indicating whether a cycle exists and details if found
 *
 * @example
 * ```typescript
 * const collection = collectDerivations(fields);
 * const result = detectCycles(collection);
 *
 * if (result.hasCycle) {
 *   console.error(`Cycle detected: ${result.cyclePath?.join(' -> ')}`);
 *   throw new Error(result.errorMessage);
 * }
 * ```
 *
 * @public
 */
function detectCycles(collection) {
    // Build directed graph from derivation entries
    const graph = buildDependencyGraph(collection);
    // No entries means no cycles
    if (graph.size === 0) {
        return { hasCycle: false };
    }
    // Build bidirectional pairs set for cycle exemption
    const bidirectionalPairs = detectBidirectionalPairs(collection);
    // Run DFS to detect cycles
    const result = detectCyclesWithDFS(graph, bidirectionalPairs);
    // Include bidirectional pairs in result for warnings
    if (bidirectionalPairs.size > 0) {
        result.bidirectionalPairs = Array.from(bidirectionalPairs);
    }
    return result;
}
/**
 * Detects bidirectional derivation pairs (A↔B patterns).
 *
 * These patterns are allowed because they stabilize via equality checks.
 * Example: USD/EUR conversion where both fields derive from each other.
 *
 * A bidirectional pair exists when:
 * - Field A derives its value from field B (A depends on B)
 * - Field B derives its value from field A (B depends on A)
 *
 * ## Floating-Point Precision Note
 *
 * Bidirectional derivations stabilize via equality checks using exact IEEE 754
 * comparison with no tolerance. This means:
 *
 * - **Integer math**: Safe (e.g., `A = B * 2`, `B = A / 2` where A is even)
 * - **Floating-point math**: May oscillate due to rounding errors
 *
 * For currency conversions or other floating-point operations, consider:
 * 1. Rounding values in your expression (e.g., `Math.round(value * 100) / 100`)
 * 2. Using integer cents instead of decimal dollars
 * 3. Using one-way derivation instead of bidirectional
 *
 * @example
 * ```typescript
 * // Bidirectional currency conversion
 * { key: 'amountUSD', derivation: 'formValue.amountEUR * 1.1' }
 * { key: 'amountEUR', derivation: 'formValue.amountUSD / 1.1' }
 * ```
 *
 * @internal
 */
function detectBidirectionalPairs(collection) {
    const pairs = new Set();
    // Build a map of fieldKey -> dependencies (other fields this derivation reads from)
    const dependencyMap = new Map();
    for (const entry of collection.entries) {
        const deps = dependencyMap.get(entry.fieldKey) ?? new Set();
        for (const dep of entry.dependsOn) {
            if (dep !== '*' && dep !== entry.fieldKey) {
                deps.add(dep);
            }
        }
        dependencyMap.set(entry.fieldKey, deps);
    }
    // Find bidirectional pairs: A depends on B AND B depends on A
    for (const [fieldA, depsA] of dependencyMap) {
        for (const fieldB of depsA) {
            const depsB = dependencyMap.get(fieldB);
            if (depsB?.has(fieldA)) {
                // Normalize pair key (alphabetically sorted)
                const pairKey = fieldA < fieldB ? `${fieldA}↔${fieldB}` : `${fieldB}↔${fieldA}`;
                pairs.add(pairKey);
            }
        }
    }
    return pairs;
}
/**
 * Checks if a cycle path represents a bidirectional pair.
 *
 * @internal
 */
function isBidirectionalCycle(cyclePath, bidirectionalPairs) {
    // Bidirectional cycles are exactly: [A, B, A] (length 3 with first=last)
    if (cyclePath.length !== 3) {
        return false;
    }
    const [first, second, third] = cyclePath;
    if (first !== third) {
        return false;
    }
    // Check if this pair is in our bidirectional set
    const pairKey = first < second ? `${first}↔${second}` : `${second}↔${first}`;
    return bidirectionalPairs.has(pairKey);
}
/**
 * Builds a dependency graph from derivation entries.
 *
 * Creates nodes for each field involved in derivations and
 * edges representing the derivation dependencies.
 *
 * Edge direction is based on dependencies:
 * - If field A's derivation depends on field B, then B -> A (changing B triggers A)
 * - A cycle exists if: A -> B -> C -> A (circular dependency chain)
 *
 * @internal
 */
function buildDependencyGraph(collection) {
    const graph = new Map();
    // Helper to ensure a node exists
    const ensureNode = (fieldKey) => {
        let node = graph.get(fieldKey);
        if (!node) {
            node = {
                fieldKey,
                dependsOn: new Set(),
                dependedOnBy: new Set(),
            };
            graph.set(fieldKey, node);
        }
        return node;
    };
    for (const entry of collection.entries) {
        const fieldNode = ensureNode(entry.fieldKey);
        // Track dependencies from the derivation expression/condition.
        // For cycle detection, edges go from dependency -> field:
        // If field A depends on field B, then when B changes, A gets updated.
        // A cycle exists when there's a circular chain of such dependencies.
        for (const dep of entry.dependsOn) {
            // Skip wildcard dependencies and self-references
            if (dep !== '*' && dep !== entry.fieldKey) {
                const depNode = ensureNode(dep);
                // The field depends on 'dep'
                fieldNode.dependsOn.add(dep);
                // 'dep' is depended on by the field
                depNode.dependedOnBy.add(entry.fieldKey);
            }
        }
    }
    return graph;
}
/**
 * Detects cycles using depth-first search.
 *
 * Uses three-color marking:
 * - Unvisited (white): Not yet processed
 * - InProgress (gray): Currently in the DFS stack
 * - Completed (black): Fully processed
 *
 * A cycle is detected when we visit a node that's InProgress,
 * unless it's a bidirectional sync pattern (allowed).
 *
 * @internal
 */
function detectCyclesWithDFS(graph, bidirectionalPairs) {
    const visitState = new Map();
    const parent = new Map();
    // Initialize all nodes as unvisited
    for (const fieldKey of graph.keys()) {
        visitState.set(fieldKey, 0 /* VisitState.Unvisited */);
    }
    // Process each unvisited node
    for (const fieldKey of graph.keys()) {
        if (visitState.get(fieldKey) === 0 /* VisitState.Unvisited */) {
            const cycleResult = dfsVisit(fieldKey, graph, visitState, parent, [], bidirectionalPairs);
            if (cycleResult) {
                return cycleResult;
            }
        }
    }
    return { hasCycle: false };
}
/**
 * DFS visit function that detects back edges (cycles).
 *
 * @internal
 */
function dfsVisit(fieldKey, graph, visitState, parent, path, bidirectionalPairs) {
    visitState.set(fieldKey, 1 /* VisitState.InProgress */);
    path.push(fieldKey);
    const node = graph.get(fieldKey);
    if (!node) {
        visitState.set(fieldKey, 2 /* VisitState.Completed */);
        path.pop();
        return null;
    }
    // Check all nodes that this field's changes would trigger
    for (const targetFieldKey of node.dependedOnBy) {
        const targetState = visitState.get(targetFieldKey);
        if (targetState === 1 /* VisitState.InProgress */) {
            // Back edge found - potential cycle
            const cyclePath = extractCyclePath(path, targetFieldKey);
            // Allow bidirectional sync patterns (A→B→A)
            // These stabilize via equality checks at runtime
            if (isBidirectionalCycle(cyclePath, bidirectionalPairs)) {
                // Continue DFS without reporting this as a cycle
                continue;
            }
            return {
                hasCycle: true,
                cyclePath,
                errorMessage: formatCycleError(cyclePath),
            };
        }
        if (targetState === 0 /* VisitState.Unvisited */) {
            parent.set(targetFieldKey, fieldKey);
            const result = dfsVisit(targetFieldKey, graph, visitState, parent, path, bidirectionalPairs);
            if (result) {
                return result;
            }
        }
    }
    visitState.set(fieldKey, 2 /* VisitState.Completed */);
    path.pop();
    return null;
}
/**
 * Extracts the cycle path from the DFS path.
 *
 * @internal
 */
function extractCyclePath(path, cycleStart) {
    const cycleStartIndex = path.indexOf(cycleStart);
    if (cycleStartIndex === -1) {
        // Shouldn't happen, but handle gracefully
        return [...path, cycleStart];
    }
    // Extract from cycle start to current position, then back to start
    const cyclePath = path.slice(cycleStartIndex);
    cyclePath.push(cycleStart); // Close the cycle
    return cyclePath;
}
/**
 * Formats a human-readable error message for a detected cycle.
 *
 * @internal
 */
function formatCycleError(cyclePath) {
    const pathStr = cyclePath.join(' -> ');
    return (`Derivation cycle detected: ${pathStr}\n` +
        `This would cause an infinite loop at runtime. ` +
        `Remove one of the derivations to break the cycle.`);
}
/**
 * Validates a derivation collection and throws if cycles are detected.
 *
 * This is the main entry point for cycle validation during form initialization.
 * Should be called after collecting derivations and before setting up effects.
 *
 * In dev mode, logs a warning when bidirectional derivation pairs are detected.
 * These patterns are allowed but may oscillate with floating-point values.
 *
 * @param collection - The collected derivation entries to validate
 * @param logger - Optional logger for dev-mode warnings
 * @throws Error if a cycle is detected, with details about the cycle
 *
 * @example
 * ```typescript
 * const collection = collectDerivations(fields);
 *
 * // This will throw if cycles exist
 * validateNoCycles(collection, logger);
 *
 * // Safe to set up derivation effects now
 * setupDerivationEffects(collection);
 * ```
 *
 * @public
 */
function validateNoCycles(collection, logger) {
    const result = detectCycles(collection);
    if (result.hasCycle) {
        throw new Error(result.errorMessage);
    }
    // Warn about bidirectional patterns in dev mode
    if (isDevMode() && result.bidirectionalPairs && result.bidirectionalPairs.length > 0 && logger) {
        logger.warn('[Derivation] Bidirectional derivation patterns detected. ' +
            'These patterns stabilize via equality checks, but may oscillate with floating-point values ' +
            '(e.g., currency conversions with rounding). ' +
            'Consider adding tolerance-based comparisons for numeric values.', result.bidirectionalPairs);
    }
}

/**
 * Injection token for the derivation warning tracker.
 * Provided at form component level for instance-scoped tracking.
 *
 * @public
 */
const DERIVATION_WARNING_TRACKER = new InjectionToken('DerivationWarningTracker', {
    providedIn: null,
    factory: () => ({ warnedFields: new Set() }),
});
/**
 * Creates a fresh warning tracker instance.
 *
 * @returns A new DerivationWarningTracker with an empty warnedFields Set
 *
 * @public
 */
function createDerivationWarningTracker() {
    return { warnedFields: new Set() };
}

/**
 * Resolves an `HttpRequestConfig` into an `HttpResourceRequest` by evaluating
 * expression-based query params and (optionally) body values.
 *
 * Returns `null` if any path parameter resolves to `undefined` or `null`,
 * signaling that the request should be suppressed (the URL would be malformed).
 *
 * `debounceMs` is intentionally ignored — it's used by HTTP derivations/conditions (PRs 3-4),
 * not by validators.
 */
function resolveHttpRequest(config, context) {
    let url = config.url;
    if (config.params) {
        for (const [key, expression] of Object.entries(config.params)) {
            const value = ExpressionParser.evaluate(expression, context);
            if (value == null) {
                context.logger.debug(`HTTP request suppressed: path param '${key}' resolved to ${String(value)} ` +
                    `(expression: '${expression}'). The request will not be sent.`);
                return null;
            }
            url = url.replace(`:${key}`, encodeURIComponent(String(value)));
        }
    }
    if (config.queryParams) {
        const params = new URLSearchParams();
        for (const [key, expression] of Object.entries(config.queryParams)) {
            const value = ExpressionParser.evaluate(expression, context);
            params.set(key, value != null ? String(value) : '');
        }
        const queryString = params.toString();
        if (queryString) {
            url += (url.includes('?') ? '&' : '?') + queryString;
        }
    }
    const request = {
        url,
        method: config.method,
    };
    if (config.body) {
        if (config.evaluateBodyExpressions) {
            const resolvedBody = {};
            for (const [key, value] of Object.entries(config.body)) {
                if (typeof value === 'string') {
                    resolvedBody[key] = ExpressionParser.evaluate(value, context);
                }
                else {
                    resolvedBody[key] = value;
                }
            }
            request.body = resolvedBody;
        }
        else {
            request.body = config.body;
        }
    }
    if (config.headers) {
        request.headers = config.headers;
    }
    return request;
}

/**
 * Creates a staleness guard for HTTP/async derivation streams.
 *
 * - Call `invalidate()` when tearing down the current generation of streams.
 * - Pipe HTTP requests through `takeUntil(guard$)` to automatically discard
 *   in-flight responses that arrive after the generation has been invalidated.
 */
function createStreamGuard() {
    const subject = new Subject();
    return {
        invalidate: () => subject.next(),
        guard$: subject.asObservable().pipe(take$1(1)),
    };
}
const LOG_PREFIX$1 = 'HTTP Derivation -';
const DEFAULT_HTTP_DEBOUNCE_MS = 300;
/**
 * Creates an RxJS Observable stream that processes an HTTP derivation entry.
 *
 * Each HTTP derivation gets its own stream with:
 * - `debounceTime` to batch rapid changes
 * - `switchMap` to auto-cancel in-flight requests
 * - `catchError` inside the switchMap projection to prevent stream termination
 *
 * **Note:** The stream uses `startWith(null) → pairwise()` to detect changed fields.
 * This means the first form value emission (initial load) will fire an HTTP request
 * for all `dependsOn` fields, since every field appears "changed" relative to `null`.
 * This is intentional — it ensures derived values are populated on initial form load.
 *
 * @param entry - The derivation entry with HTTP configuration
 * @param formValue$ - Observable of form value changes
 * @param context - Context with HttpClient, logger, etc.
 * @returns Observable that applies HTTP-derived values to the form
 *
 * @internal
 */
function createHttpDerivationStream(entry, formValue$, context) {
    // Guard: no array support for HTTP derivations
    if (isArrayPlaceholderPath(entry.fieldKey)) {
        context.logger.warn(`${LOG_PREFIX$1} HTTP derivation for array field '${entry.fieldKey}' is not supported. ` +
            `Array HTTP derivations will be supported in a future release.`);
        return EMPTY;
    }
    if (!entry.http || !entry.responseExpression) {
        return EMPTY;
    }
    // Capture after the guard — TS narrows this to `string` here
    const responseExpression = entry.responseExpression;
    const debounceMs = entry.debounceMs ?? DEFAULT_HTTP_DEBOUNCE_MS;
    return formValue$.pipe(startWith(null), pairwise(), map(([previous, current]) => ({
        current: current,
        changedFields: getChangedKeys(previous, current),
    })), 
    // Only proceed when a dependency in entry.dependsOn changed
    filter(({ changedFields }) => {
        if (changedFields.size === 0)
            return false;
        return entry.dependsOn.some((dep) => changedFields.has(dep));
    }), debounceTime(debounceMs), switchMap(({ current, changedFields }) => {
        return new Observable((subscriber) => {
            const formAccessor = untracked(() => context.form());
            // Check stopOnUserOverride — skip if the user has manually edited the target field
            if (entry.stopOnUserOverride) {
                const isDirty = readFieldDirty(formAccessor, entry.fieldKey);
                if (isDirty) {
                    // Re-engage: if a dependency changed, clear dirty state so derivation resumes
                    if (entry.reEngageOnDependencyChange && changedFields.size > 0) {
                        if (entry.dependsOn.some((dep) => changedFields.has(dep))) {
                            resetFieldState(formAccessor, entry.fieldKey);
                            // Fall through — proceed with the HTTP request
                        }
                        else {
                            // Dependency didn't change, still skip
                            const derivationLogger = untracked(() => context.derivationLogger());
                            derivationLogger.evaluation({
                                debugName: entry.debugName,
                                fieldKey: entry.fieldKey,
                                result: 'skipped',
                                skipReason: 'user-override',
                            });
                            subscriber.complete();
                            return;
                        }
                    }
                    else {
                        const derivationLogger = untracked(() => context.derivationLogger());
                        derivationLogger.evaluation({
                            debugName: entry.debugName,
                            fieldKey: entry.fieldKey,
                            result: 'skipped',
                            skipReason: 'user-override',
                        });
                        subscriber.complete();
                        return;
                    }
                }
            }
            // Resolve lazy context values per-emission
            const customFunctions = context.customFunctions?.();
            const externalData = context.externalData?.();
            // Build evaluation context for condition check and request resolution
            const fieldValue = getNestedValue(current, entry.fieldKey);
            const fieldAccessor = formAccessor[entry.fieldKey];
            const fieldState = fieldAccessor ? readFieldStateInfo(fieldAccessor, false) : undefined;
            const evalContext = {
                fieldValue,
                formValue: current,
                fieldPath: entry.fieldKey,
                customFunctions,
                externalData,
                logger: context.logger,
                fieldState,
                formFieldState: createFormFieldStateMap(formAccessor, false),
            };
            // Evaluate condition — skip if false
            if (entry.condition !== true) {
                const conditionMet = typeof entry.condition === 'boolean' ? entry.condition : evaluateCondition(entry.condition, evalContext);
                if (!conditionMet) {
                    const derivationLogger = untracked(() => context.derivationLogger());
                    derivationLogger.evaluation({
                        debugName: entry.debugName,
                        fieldKey: entry.fieldKey,
                        result: 'skipped',
                        skipReason: 'condition-false',
                    });
                    subscriber.complete();
                    return;
                }
            }
            // Returns null when a path param is undefined — suppress the request
            const resolvedRequest = resolveHttpRequest(entry.http, evalContext);
            if (!resolvedRequest) {
                const derivationLogger = untracked(() => context.derivationLogger());
                derivationLogger.evaluation({
                    debugName: entry.debugName,
                    fieldKey: entry.fieldKey,
                    result: 'skipped',
                    skipReason: 'condition-false',
                });
                subscriber.complete();
                return;
            }
            // Make the HTTP request. takeUntil(guard$) automatically discards responses
            // that arrive after the config has changed and the guard has been invalidated.
            const method = (resolvedRequest.method ?? 'GET').toUpperCase();
            const httpSub = context.httpClient
                .request(method, resolvedRequest.url, {
                body: resolvedRequest.body,
                headers: resolvedRequest.headers,
            })
                .pipe(takeUntil(context.guard$))
                .subscribe({
                next: (response) => {
                    try {
                        // Extract value from response using responseExpression
                        const newValue = ExpressionParser.evaluate(responseExpression, { response });
                        // Compare with current value — skip if unchanged
                        const currentFormValue = untracked(() => context.formValue());
                        const currentValue = getNestedValue(currentFormValue, entry.fieldKey);
                        if (isEqual(currentValue, newValue)) {
                            const derivationLogger = untracked(() => context.derivationLogger());
                            derivationLogger.evaluation({
                                debugName: entry.debugName,
                                fieldKey: entry.fieldKey,
                                result: 'skipped',
                                skipReason: 'value-unchanged',
                            });
                            subscriber.complete();
                            return;
                        }
                        // Apply the value to the form
                        const currentForm = untracked(() => context.form());
                        applyValueToForm(entry.fieldKey, newValue, currentForm, context.logger, context.warningTracker);
                        const derivationLogger = untracked(() => context.derivationLogger());
                        derivationLogger.evaluation({
                            debugName: entry.debugName,
                            fieldKey: entry.fieldKey,
                            result: 'applied',
                            previousValue: currentValue,
                            newValue,
                        });
                        subscriber.complete();
                    }
                    catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        context.logger.warn(`${LOG_PREFIX$1} Failed to process response for '${entry.fieldKey}': ${message}`);
                        subscriber.complete();
                    }
                },
                error: (error) => {
                    const message = error instanceof Error ? error.message : String(error);
                    context.logger.warn(`${LOG_PREFIX$1} HTTP request failed for '${entry.fieldKey}': ${message}`);
                    subscriber.complete();
                },
            });
            // Cleanup: RxJS unsubscription cancels the in-flight HTTP request.
            // Angular's HttpClient uses an internal AbortController when operating with
            // the fetch backend, so unsubscribing is sufficient for network cancellation.
            return () => {
                httpSub.unsubscribe();
            };
        });
    }), catchError$1((error) => {
        // Safety net — should not normally be reached since inner errors are caught
        const message = error instanceof Error ? error.message : String(error);
        context.logger.warn(`${LOG_PREFIX$1} Unexpected stream error for '${entry.fieldKey}': ${message}`);
        return EMPTY;
    }));
}

const LOG_PREFIX = 'Async Derivation -';
const DEFAULT_ASYNC_DEBOUNCE_MS = 300;
/**
 * Creates an RxJS Observable stream that processes an async derivation entry.
 *
 * Each async derivation gets its own stream with:
 * - `debounceTime` to batch rapid changes
 * - `switchMap` to auto-cancel in-flight async operations
 * - `catchError` inside the switchMap projection to prevent stream termination
 *
 * @param entry - The derivation entry with asyncFunctionName
 * @param formValue$ - Observable of form value changes
 * @param context - Context with logger, etc.
 * @returns Observable that applies async-derived values to the form
 *
 * @internal
 */
function createAsyncDerivationStream(entry, formValue$, context) {
    // Guard: no array support for async derivations
    if (isArrayPlaceholderPath(entry.fieldKey)) {
        context.logger.warn(`${LOG_PREFIX} Async derivation for array field '${entry.fieldKey}' is not supported. ` +
            `Array async derivations will be supported in a future release.`);
        return EMPTY;
    }
    if (!entry.asyncFunctionName) {
        return EMPTY;
    }
    const asyncFunctionName = entry.asyncFunctionName;
    const debounceMs = entry.debounceMs ?? DEFAULT_ASYNC_DEBOUNCE_MS;
    // startWith(null) → pairwise() causes all fields to appear "changed" on the
    // first emission (null vs actual form value), so every dependsOn field matches.
    // This intentionally fires the async derivation on initial form load — same
    // pattern as http-derivation-stream.ts.
    return formValue$.pipe(startWith(null), pairwise(), map(([previous, current]) => ({
        current: current,
        changedFields: getChangedKeys(previous, current),
    })), 
    // Only proceed when a dependency in entry.dependsOn changed
    filter(({ changedFields }) => {
        if (changedFields.size === 0)
            return false;
        return entry.dependsOn.some((dep) => changedFields.has(dep));
    }), debounceTime(debounceMs), switchMap(({ current, changedFields }) => {
        return new Observable((subscriber) => {
            const formAccessor = untracked(() => context.form());
            // Check stopOnUserOverride — skip if the user has manually edited the target field
            if (entry.stopOnUserOverride) {
                const isDirty = readFieldDirty(formAccessor, entry.fieldKey);
                if (isDirty) {
                    // Re-engage: the outer filter already guarantees changedFields is non-empty
                    // and that a dependsOn field changed, so only check reEngageOnDependencyChange.
                    if (entry.reEngageOnDependencyChange) {
                        resetFieldState(formAccessor, entry.fieldKey);
                        // Fall through — proceed with the async call
                    }
                    else {
                        const derivationLogger = untracked(() => context.derivationLogger());
                        derivationLogger.evaluation({
                            debugName: entry.debugName,
                            fieldKey: entry.fieldKey,
                            result: 'skipped',
                            skipReason: 'user-override',
                        });
                        subscriber.complete();
                        return;
                    }
                }
            }
            // Resolve lazy context values per-emission
            const customFunctions = context.customFunctions?.();
            const asyncDerivationFunctions = context.asyncDerivationFunctions?.();
            const externalData = context.externalData?.();
            // Look up the async function
            const asyncFn = asyncDerivationFunctions?.[asyncFunctionName];
            if (!asyncFn) {
                context.logger.warn(`${LOG_PREFIX} Async derivation function '${asyncFunctionName}' not found for field '${entry.fieldKey}'. ` +
                    `Register it in customFnConfig.asyncDerivations.`);
                subscriber.complete();
                return;
            }
            // Build evaluation context for condition check
            const fieldValue = getNestedValue(current, entry.fieldKey);
            const fieldAccessor = formAccessor[entry.fieldKey];
            const fieldState = fieldAccessor ? readFieldStateInfo(fieldAccessor, false) : undefined;
            const evalContext = {
                fieldValue,
                formValue: current,
                fieldPath: entry.fieldKey,
                customFunctions,
                externalData,
                logger: context.logger,
                fieldState,
                formFieldState: createFormFieldStateMap(formAccessor, false),
            };
            // Evaluate condition — skip if false
            if (entry.condition !== true) {
                const conditionMet = typeof entry.condition === 'boolean' ? entry.condition : evaluateCondition(entry.condition, evalContext);
                if (!conditionMet) {
                    const derivationLogger = untracked(() => context.derivationLogger());
                    derivationLogger.evaluation({
                        debugName: entry.debugName,
                        fieldKey: entry.fieldKey,
                        result: 'skipped',
                        skipReason: 'condition-false',
                    });
                    subscriber.complete();
                    return;
                }
            }
            // Call the async function (normalize Promise → Observable)
            const result$ = from(asyncFn(evalContext));
            const asyncSub = result$.subscribe({
                next: (newValue) => {
                    try {
                        // Compare with current value — skip if unchanged
                        const currentFormValue = untracked(() => context.formValue());
                        const currentValue = getNestedValue(currentFormValue, entry.fieldKey);
                        if (isEqual(currentValue, newValue)) {
                            const derivationLogger = untracked(() => context.derivationLogger());
                            derivationLogger.evaluation({
                                debugName: entry.debugName,
                                fieldKey: entry.fieldKey,
                                result: 'skipped',
                                skipReason: 'value-unchanged',
                            });
                            subscriber.complete();
                            return;
                        }
                        // Apply the value to the form
                        const currentForm = untracked(() => context.form());
                        applyValueToForm(entry.fieldKey, newValue, currentForm, context.logger, context.warningTracker);
                        const derivationLogger = untracked(() => context.derivationLogger());
                        derivationLogger.evaluation({
                            debugName: entry.debugName,
                            fieldKey: entry.fieldKey,
                            result: 'applied',
                            previousValue: currentValue,
                            newValue,
                        });
                        subscriber.complete();
                    }
                    catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        context.logger.warn(`${LOG_PREFIX} Failed to process result for '${entry.fieldKey}': ${message}`);
                        subscriber.complete();
                    }
                },
                error: (error) => {
                    const message = error instanceof Error ? error.message : String(error);
                    context.logger.warn(`${LOG_PREFIX} Async function failed for '${entry.fieldKey}': ${message}`);
                    subscriber.complete();
                },
                complete: () => {
                    // Handles Observables that complete without emitting (e.g. EMPTY),
                    // preventing the inner Observable from staying open indefinitely.
                    subscriber.complete();
                },
            });
            // Cleanup subscription on unsubscribe (switchMap cancellation)
            return () => {
                asyncSub.unsubscribe();
            };
        });
    }), catchError$1((error) => {
        // Safety net — should not normally be reached since inner errors are caught
        const message = error instanceof Error ? error.message : String(error);
        context.logger.warn(`${LOG_PREFIX} Unexpected stream error for '${entry.fieldKey}': ${message}`);
        return EMPTY;
    }));
}

/**
 * Orchestrates derivation processing for a dynamic form.
 *
 * Uses RxJS streams for reactive derivation processing:
 * - `exhaustMap` prevents re-entry during onChange derivation application
 * - `pairwise` tracks value changes without mutable state
 * - `takeUntilDestroyed` handles automatic cleanup
 *
 * Injects common services directly, requiring only form-specific signals in config.
 *
 * @public
 */
class DerivationOrchestrator {
    config;
    injector = inject(Injector);
    destroyRef = inject(DestroyRef);
    logger = inject(DynamicFormLogger);
    warningTracker = inject(DERIVATION_WARNING_TRACKER);
    functionRegistry = inject(FunctionRegistryService);
    formOptions = inject(FORM_OPTIONS);
    httpClient = inject(HttpClient, { optional: true });
    /** Active HTTP derivation stream subscriptions */
    httpSubscriptions = [];
    /** Identity keys of current HTTP entries for smart teardown comparison */
    lastHttpEntryKeys = null;
    /** Active async function derivation stream subscriptions */
    asyncFunctionSubscriptions = [];
    /** Identity keys of current async entries for smart teardown comparison */
    lastAsyncEntryKeys = null;
    /**
     * Guard for detecting stale HTTP responses. Call `invalidate()` on teardown to cancel
     * in-flight requests from the previous generation. Each HTTP stream subscribes via
     * `takeUntil(guard$)` — when `invalidate()` fires, all in-flight requests are discarded.
     */
    streamGuard = createStreamGuard();
    /**
     * Computed signal containing the collected and validated derivations.
     * Returns null if no derivations are defined.
     */
    derivationCollection;
    constructor(config) {
        this.config = config;
        this.derivationCollection = computed(() => {
            const fields = config.schemaFields();
            if (!fields || fields.length === 0) {
                return null;
            }
            const collection = collectDerivations(fields);
            if (collection.entries.length === 0) {
                return null;
            }
            validateNoCycles(collection, this.logger);
            this.warnAboutWildcardDependencies(collection.entries, fields.length);
            this.warnAboutMisconfiguredReEngagement(collection.entries);
            return collection;
        }, ...(ngDevMode ? [{ debugName: "derivationCollection" }] : /* istanbul ignore next */ []));
        this.setupOnChangeStream();
        this.setupDebouncedStream();
        this.setupHttpStreams();
        this.setupAsyncFunctionStreams();
    }
    setupOnChangeStream() {
        const collection$ = toObservable(this.derivationCollection, { injector: this.injector });
        const formValue$ = toObservable(this.config.formValue, { injector: this.injector });
        const form$ = toObservable(this.config.form, { injector: this.injector });
        collection$
            .pipe(filter((collection) => collection !== null), combineLatestWith(formValue$, form$), 
        // auditTime(0): Batch synchronous emissions from Angular's change detection.
        // When a single user action triggers multiple signal updates, this ensures
        // we only process derivations once after all updates complete (microtask timing).
        auditTime(0), 
        // startWith + pairwise: Track previous and current values to detect changed fields.
        // This enables reEngageOnDependencyChange for onChange derivations.
        startWith(null), pairwise(), filter((pair) => pair[1] !== null), map(([previous, current]) => ({
            collection: current[0],
            formAccessor: current[2],
            changedFields: getChangedKeys(previous?.[1] ?? null, current[1]),
        })), 
        // exhaustMap: Prevents re-entry while processing derivations.
        // If form value changes DURING derivation processing (from our own setValue calls),
        // we ignore those emissions and complete the current cycle first.
        // switchMap would cancel mid-processing, causing incomplete derivation chains.
        exhaustMap(({ collection, formAccessor, changedFields }) => {
            this.applyOnChangeDerivations(collection, formAccessor, changedFields);
            // scheduled with queueScheduler: Ensures the observable completes
            // in the next microtask, allowing exhaustMap to accept new emissions.
            // Without this, exhaustMap would block indefinitely.
            return scheduled([null], queueScheduler);
        }), takeUntilDestroyed(this.destroyRef))
            .subscribe({
            error: (err) => this.logger.error('Derivation onChange stream error', err),
        });
    }
    setupDebouncedStream() {
        toObservable(this.config.formValue, { injector: this.injector })
            .pipe(
        // debounceTime: Wait for value to stabilize before detecting changes.
        // Uses DEFAULT_DEBOUNCE_MS as the minimum debounce period.
        debounceTime(DEFAULT_DEBOUNCE_MS), 
        // startWith + pairwise: Track previous and current values to detect changes.
        // startWith(null) ensures pairwise has an initial value to pair with.
        startWith(null), pairwise(), filter((pair) => pair[1] !== null), map(([previous, current]) => ({
            current,
            changedFields: getChangedKeys(previous, current),
        })), filter(({ changedFields }) => changedFields.size > 0), 
        // switchMap: For debounced derivations, it's OK to cancel pending work
        // if new changes come in - we want the latest debounced values.
        // (Unlike onChange which uses exhaustMap to prevent cancellation)
        switchMap(({ changedFields }) => {
            const collection = untracked(() => this.derivationCollection());
            const formAccessor = untracked(() => this.config.form());
            if (!collection || !formAccessor)
                return of(null);
            // Get unique debounce periods from entries with trigger 'debounced'
            const debouncePeriods = this.getDebouncePeriods(collection.entries);
            if (debouncePeriods.length === 0)
                return of(null);
            // merge: Process multiple debounce periods concurrently.
            // Each period stream handles its own timing independently.
            const periodStreams = debouncePeriods.map((debounceMs) => this.createPeriodStream(debounceMs, collection, formAccessor, changedFields));
            return merge(...periodStreams);
        }), takeUntilDestroyed(this.destroyRef))
            .subscribe({
            error: (err) => this.logger.error('Derivation debounced stream error', err),
        });
    }
    createPeriodStream(debounceMs, collection, formAccessor, changedFields) {
        const additionalWait = Math.max(0, debounceMs - DEFAULT_DEBOUNCE_MS);
        if (additionalWait === 0) {
            return of(null).pipe(map(() => {
                this.applyDebouncedEntriesForPeriod(debounceMs, collection, formAccessor, changedFields);
            }));
        }
        return timer(additionalWait).pipe(map(() => {
            const currentCollection = untracked(() => this.derivationCollection());
            const currentFormAccessor = untracked(() => this.config.form());
            if (currentCollection && currentFormAccessor) {
                this.applyDebouncedEntriesForPeriod(debounceMs, currentCollection, currentFormAccessor, changedFields);
            }
        }));
    }
    applyOnChangeDerivations(collection, formAccessor, changedFields) {
        const applicatorContext = {
            formValue: this.config.formValue,
            rootForm: formAccessor,
            derivationFunctions: this.functionRegistry.getDerivationFunctions(),
            customFunctions: this.functionRegistry.getCustomFunctions(),
            externalData: this.resolveExternalData(),
            logger: this.logger,
            warningTracker: this.warningTracker,
            derivationLogger: untracked(() => this.config.derivationLogger()),
            maxIterations: untracked(() => this.formOptions()?.maxDerivationIterations),
        };
        const result = applyDerivationsForTrigger(collection, 'onChange', applicatorContext, changedFields);
        if (result.maxIterationsReached) {
            this.logger.warn(`Derivation processing reached max iterations. ` +
                `This may indicate a loop in derivation logic that wasn't caught at build time. ` +
                `Applied: ${result.appliedCount}, Skipped: ${result.skippedCount}, Errors: ${result.errorCount}`);
        }
    }
    applyDebouncedEntriesForPeriod(debounceMs, collection, formAccessor, changedFields) {
        // Filter entries to just those with the specific debounce period
        const debouncedEntries = collection.entries.filter((entry) => entry.trigger === 'debounced' && (entry.debounceMs ?? DEFAULT_DEBOUNCE_MS) === debounceMs);
        if (debouncedEntries.length === 0) {
            return;
        }
        // Create a minimal collection with filtered entries
        const filteredCollection = {
            entries: debouncedEntries,
        };
        const applicatorContext = {
            formValue: this.config.formValue,
            rootForm: formAccessor,
            derivationFunctions: this.functionRegistry.getDerivationFunctions(),
            customFunctions: this.functionRegistry.getCustomFunctions(),
            externalData: this.resolveExternalData(),
            logger: this.logger,
            warningTracker: this.warningTracker,
            derivationLogger: untracked(() => this.config.derivationLogger()),
            maxIterations: untracked(() => this.formOptions()?.maxDerivationIterations),
        };
        const result = applyDerivationsForTrigger(filteredCollection, 'debounced', applicatorContext, changedFields);
        if (result.maxIterationsReached) {
            this.logger.warn(`Debounced derivation processing reached max iterations (${debounceMs}ms). ` +
                `Applied: ${result.appliedCount}, Skipped: ${result.skippedCount}, Errors: ${result.errorCount}`);
        }
    }
    /**
     * Sets up reactive HTTP derivation streams that react to collection changes.
     *
     * Subscribes to derivationCollection changes and creates per-entry HTTP streams.
     * Uses smart teardown: only recreates streams when HTTP entries actually change.
     */
    setupHttpStreams() {
        toObservable(this.derivationCollection, { injector: this.injector })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((collection) => {
            const httpEntries = collection?.entries.filter((entry) => entry.http) ?? [];
            if (httpEntries.length === 0) {
                this.teardownHttpStreams();
                this.lastHttpEntryKeys = null;
                return;
            }
            // Smart teardown: compare entry identity keys to avoid redundant stream recreation
            const newKeys = this.computeHttpEntryKeys(httpEntries);
            if (this.lastHttpEntryKeys && this.setsEqual(this.lastHttpEntryKeys, newKeys)) {
                return; // No change in HTTP entries — keep existing streams
            }
            // Validate HttpClient availability
            if (!this.httpClient) {
                this.logger.error('HTTP Derivation - HttpClient is not available. ' + 'Ensure provideHttpClient() is included in your application providers.');
                return;
            }
            // Tear down previous streams and create new ones
            this.teardownHttpStreams();
            this.lastHttpEntryKeys = newKeys;
            const formValue$ = toObservable(this.config.formValue, { injector: this.injector });
            for (const entry of httpEntries) {
                const context = {
                    formValue: this.config.formValue,
                    form: this.config.form,
                    httpClient: this.httpClient,
                    logger: this.logger,
                    derivationLogger: this.config.derivationLogger,
                    customFunctions: () => this.functionRegistry.getCustomFunctions(),
                    externalData: () => this.resolveExternalData(),
                    warningTracker: this.warningTracker,
                    guard$: this.streamGuard.guard$,
                };
                const stream = createHttpDerivationStream(entry, formValue$, context).pipe(takeUntilDestroyed(this.destroyRef));
                this.httpSubscriptions.push(stream.subscribe({
                    error: (err) => this.logger.error(`HTTP Derivation - Stream error for '${entry.fieldKey}'`, err),
                }));
            }
        });
    }
    /**
     * Tears down all active HTTP derivation streams. Invalidating the stream guard
     * cancels any in-flight HTTP responses from the old generation via `takeUntil`.
     */
    teardownHttpStreams() {
        this.streamGuard.invalidate();
        for (const sub of this.httpSubscriptions) {
            sub.unsubscribe();
        }
        this.httpSubscriptions = [];
    }
    /**
     * Computes a set of identity keys for HTTP entries.
     * Used for smart teardown comparison.
     */
    computeHttpEntryKeys(entries) {
        return new Set(entries.map((entry) => `${entry.fieldKey}:${JSON.stringify(entry.http, Object.keys(entry.http ?? {}).sort())}`));
    }
    /**
     * Compares two sets for equality.
     */
    setsEqual(a, b) {
        if (a.size !== b.size)
            return false;
        for (const item of a) {
            if (!b.has(item))
                return false;
        }
        return true;
    }
    /**
     * Sets up reactive async function derivation streams that react to collection changes.
     *
     * Subscribes to derivationCollection changes and creates per-entry async streams.
     * Uses smart teardown: only recreates streams when async entries actually change.
     */
    setupAsyncFunctionStreams() {
        toObservable(this.derivationCollection, { injector: this.injector })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((collection) => {
            const asyncEntries = collection?.entries.filter((entry) => entry.asyncFunctionName) ?? [];
            if (asyncEntries.length === 0) {
                this.teardownAsyncFunctionStreams();
                this.lastAsyncEntryKeys = null;
                return;
            }
            // Smart teardown: compare entry identity keys to avoid redundant stream recreation
            const newKeys = this.computeAsyncEntryKeys(asyncEntries);
            if (this.lastAsyncEntryKeys && this.setsEqual(this.lastAsyncEntryKeys, newKeys)) {
                return; // No change in async entries — keep existing streams
            }
            // Tear down previous streams and create new ones
            this.teardownAsyncFunctionStreams();
            this.lastAsyncEntryKeys = newKeys;
            const formValue$ = toObservable(this.config.formValue, { injector: this.injector });
            for (const entry of asyncEntries) {
                const context = {
                    formValue: this.config.formValue,
                    form: this.config.form,
                    logger: this.logger,
                    derivationLogger: this.config.derivationLogger,
                    customFunctions: () => this.functionRegistry.getCustomFunctions(),
                    asyncDerivationFunctions: () => this.functionRegistry.getAsyncDerivationFunctions(),
                    externalData: () => this.resolveExternalData(),
                    warningTracker: this.warningTracker,
                };
                const stream = createAsyncDerivationStream(entry, formValue$, context).pipe(takeUntilDestroyed(this.destroyRef));
                this.asyncFunctionSubscriptions.push(stream.subscribe({
                    error: (err) => this.logger.error(`Async Derivation - Stream error for '${entry.fieldKey}'`, err),
                }));
            }
        });
    }
    /**
     * Tears down all active async function derivation streams.
     */
    teardownAsyncFunctionStreams() {
        for (const sub of this.asyncFunctionSubscriptions) {
            sub.unsubscribe();
        }
        this.asyncFunctionSubscriptions = [];
    }
    /**
     * Computes a set of identity keys for async entries.
     * Used for smart teardown comparison.
     */
    computeAsyncEntryKeys(entries) {
        return new Set(entries.map((entry) => {
            const config = {
                asyncFunctionName: entry.asyncFunctionName,
                dependsOn: entry.dependsOn,
                debounceMs: entry.debounceMs,
                stopOnUserOverride: entry.stopOnUserOverride,
                reEngageOnDependencyChange: entry.reEngageOnDependencyChange,
            };
            return `${entry.fieldKey}:${JSON.stringify(config, Object.keys(config).sort())}`;
        }));
    }
    /**
     * Gets all unique debounce periods from entries with trigger 'debounced'.
     */
    getDebouncePeriods(entries) {
        const periods = new Set();
        for (const entry of entries) {
            if (entry.trigger === 'debounced') {
                periods.add(entry.debounceMs ?? DEFAULT_DEBOUNCE_MS);
            }
        }
        return Array.from(periods);
    }
    warnAboutWildcardDependencies(entries, fieldCount) {
        if (!isDevMode())
            return;
        // Find entries with wildcard dependency
        const wildcardEntries = entries.filter((entry) => entry.dependsOn.includes('*'));
        if (wildcardEntries.length === 0)
            return;
        // Find implicit wildcards (custom functions without explicit dependsOn)
        // HTTP and async entries are excluded because they require explicit dependsOn (validated at collection time)
        const implicitWildcards = wildcardEntries.filter((entry) => !entry.http &&
            !entry.asyncFunctionName &&
            entry.functionName &&
            (!entry.originalConfig?.dependsOn || entry.originalConfig.dependsOn.length === 0));
        if (implicitWildcards.length > 0) {
            const derivationDescs = implicitWildcards.map((e) => `${e.fieldKey} (${e.functionName})`);
            this.logger.warn('[Derivation] Derivations using custom functions without explicit dependsOn detected. ' +
                `These run on EVERY form change, which may impact performance (form has ${fieldCount} fields). ` +
                'Consider specifying explicit dependsOn arrays for better performance.', derivationDescs);
        }
    }
    /**
     * Warns about derivations with `reEngageOnDependencyChange: true` but without
     * `stopOnUserOverride: true`. The re-engagement flag only has an effect when
     * `stopOnUserOverride` is enabled — without it, `reEngageOnDependencyChange` is a no-op.
     */
    warnAboutMisconfiguredReEngagement(entries) {
        if (!isDevMode())
            return;
        const misconfigured = entries.filter((entry) => entry.reEngageOnDependencyChange && !entry.stopOnUserOverride);
        if (misconfigured.length === 0)
            return;
        const fieldKeys = misconfigured.map((e) => e.debugName ?? e.fieldKey);
        this.logger.warn('[Derivation] Derivations with reEngageOnDependencyChange but without stopOnUserOverride detected. ' +
            'reEngageOnDependencyChange only takes effect when stopOnUserOverride is true. ' +
            'Either add stopOnUserOverride: true or remove reEngageOnDependencyChange.', fieldKeys);
    }
    /**
     * Resolves external data signals to their current values without creating dependencies.
     *
     * Uses `untracked()` to read signals without establishing reactive dependencies,
     * which is important for derivations that shouldn't re-trigger on every external data change.
     *
     * @returns Record of resolved external data values, or undefined if no external data.
     */
    resolveExternalData() {
        const externalDataRecord = untracked(() => this.config.externalData?.());
        if (!externalDataRecord) {
            return undefined;
        }
        const resolved = {};
        for (const [key, signal] of Object.entries(externalDataRecord)) {
            if (isSignal(signal)) {
                resolved[key] = untracked(() => signal());
            }
            else {
                resolved[key] = signal;
            }
        }
        return resolved;
    }
}
/**
 * Creates a DerivationOrchestrator for a dynamic form.
 * Must be called within an injection context.
 *
 * @param config - Form-specific signals configuration
 * @returns The created DerivationOrchestrator
 *
 * @public
 */
function createDerivationOrchestrator(config) {
    return new DerivationOrchestrator(config);
}
/**
 * Injection token for the DerivationOrchestrator.
 *
 * @public
 */
const DERIVATION_ORCHESTRATOR = new InjectionToken('DERIVATION_ORCHESTRATOR');
/**
 * Injects the DerivationOrchestrator from the current injection context.
 *
 * @returns The DerivationOrchestrator instance
 * @throws Error if called outside of an injection context or if orchestrator is not provided
 *
 * @public
 */
function injectDerivationOrchestrator() {
    return inject(DERIVATION_ORCHESTRATOR);
}

/** @internal */
const ERROR_PREFIX = '[PropertyDerivation]';
/**
 * Applies all property derivation entries from a collection.
 *
 * Single-pass processing — property derivations read formValue and write to the
 * property override store. No iterative refinement needed because property
 * derivations don't chain among themselves.
 *
 * @param collection - The collected property derivation entries
 * @param context - Context for applying property derivations
 * @param changedFields - Optional set of changed field keys for filtering
 * @returns Result of the processing
 *
 * @public
 */
function applyPropertyDerivations(collection, context, changedFields) {
    let appliedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const entriesToProcess = changedFields ? getEntriesForChangedFields(collection.entries, changedFields) : collection.entries;
    for (const entry of entriesToProcess) {
        try {
            const applied = tryApplyPropertyDerivation(entry, context);
            if (applied) {
                appliedCount++;
            }
            else {
                skippedCount++;
            }
        }
        catch (error) {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.logger.error(`${ERROR_PREFIX} Failed to process property derivation (field: ${entry.fieldKey}, property: ${entry.targetProperty}): ${errorMessage}`);
        }
    }
    return { appliedCount, skippedCount, errorCount };
}
/**
 * Applies property derivations filtered by trigger type.
 *
 * @param collection - The collected property derivation entries
 * @param trigger - The trigger type to filter by
 * @param context - Context for applying property derivations
 * @param changedFields - Optional set of changed field keys for filtering
 * @returns Result of the processing
 *
 * @public
 */
function applyPropertyDerivationsForTrigger(collection, trigger, context, changedFields) {
    const filteredEntries = collection.entries.filter((entry) => {
        if (trigger === 'onChange') {
            return !entry.trigger || entry.trigger === 'onChange';
        }
        return entry.trigger === trigger;
    });
    const filteredCollection = { entries: filteredEntries };
    return applyPropertyDerivations(filteredCollection, context, changedFields);
}
/**
 * Filters entries based on changed fields.
 *
 * @internal
 */
function getEntriesForChangedFields(entries, changedFields) {
    return entries.filter((entry) => {
        if (entry.dependsOn.includes('*'))
            return true;
        return entry.dependsOn.some((dep) => changedFields.has(dep));
    });
}
/**
 * Attempts to apply a single property derivation entry.
 *
 * @returns true if the override was applied, false if skipped
 *
 * @internal
 */
function tryApplyPropertyDerivation(entry, context) {
    // Handle array field derivations
    if (isArrayPlaceholderPath(entry.fieldKey)) {
        return tryApplyArrayPropertyDerivation(entry, context);
    }
    const formValue = untracked(() => context.formValue());
    const evalContext = createEvaluationContext(entry, formValue, context);
    // Evaluate condition
    if (!evaluatePropertyCondition(entry.condition, evalContext)) {
        return false;
    }
    // Compute the derived property value
    const newValue = computePropertyValue(entry, evalContext, context);
    // Write to the store
    context.store.setOverride(entry.fieldKey, entry.targetProperty, newValue);
    return true;
}
/**
 * Handles array field property derivations with '$' placeholder.
 *
 * @internal
 */
function tryApplyArrayPropertyDerivation(entry, context) {
    const formValue = untracked(() => context.formValue());
    const pathInfo = parseArrayPath(entry.fieldKey);
    if (!pathInfo.isArrayPath) {
        return false;
    }
    const { arrayPath } = pathInfo;
    const arrayValue = getNestedValue(formValue, arrayPath);
    if (!Array.isArray(arrayValue)) {
        return false;
    }
    let appliedAny = false;
    for (let i = 0; i < arrayValue.length; i++) {
        const resolvedPath = resolveArrayPath(entry.fieldKey, i);
        const arrayItem = arrayValue[i];
        const evalContext = createArrayItemEvaluationContext(entry, arrayItem, formValue, i, arrayPath, context);
        if (!evaluatePropertyCondition(entry.condition, evalContext)) {
            continue;
        }
        try {
            const newValue = computePropertyValue(entry, evalContext, context);
            context.store.setOverride(resolvedPath, entry.targetProperty, newValue);
            appliedAny = true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.logger.error(`${ERROR_PREFIX} Failed to compute property derivation (field: ${entry.fieldKey}, property: ${entry.targetProperty}, index: ${i}): ${errorMessage}`);
        }
    }
    return appliedAny;
}
/**
 * Creates an evaluation context for property derivation processing.
 *
 * @internal
 */
function createEvaluationContext(entry, formValue, context) {
    const fieldValue = getNestedValue(formValue, entry.fieldKey);
    return {
        fieldValue,
        formValue,
        fieldPath: entry.fieldKey,
        customFunctions: context.customFunctions,
        externalData: context.externalData,
        logger: context.logger,
    };
}
/**
 * Creates an evaluation context scoped to a specific array item.
 *
 * @internal
 */
function createArrayItemEvaluationContext(entry, arrayItem, rootFormValue, itemIndex, arrayPath, context) {
    return {
        fieldValue: arrayItem,
        formValue: arrayItem,
        fieldPath: `${arrayPath}.${itemIndex}`,
        customFunctions: context.customFunctions,
        externalData: context.externalData,
        logger: context.logger,
        rootFormValue,
        arrayIndex: itemIndex,
        arrayPath,
    };
}
/**
 * Evaluates the property derivation condition.
 *
 * @internal
 */
function evaluatePropertyCondition(condition, context) {
    if (typeof condition === 'boolean') {
        return condition;
    }
    return evaluateCondition(condition, context);
}
/**
 * Computes the derived property value based on the entry configuration.
 *
 * @internal
 */
function computePropertyValue(entry, evalContext, applicatorContext) {
    // Static value
    if (entry.value !== undefined) {
        return entry.value;
    }
    // Expression
    if (entry.expression) {
        return ExpressionParser.evaluate(entry.expression, evalContext);
    }
    // Custom function
    if (entry.functionName) {
        const fn = applicatorContext.derivationFunctions?.[entry.functionName];
        if (!fn) {
            throw new DynamicFormError(`Property derivation function '${entry.functionName}' not found in customFnConfig.derivations`);
        }
        return fn(evalContext);
    }
    throw new DynamicFormError(`Property derivation for ${entry.fieldKey}.${entry.targetProperty} has no value source. ` +
        `Specify 'value', 'expression', or 'functionName'.`);
}

/**
 * Sentinel value for the `$` placeholder index used in registration keys.
 *
 * The property derivation system uses two key formats for array fields:
 * - **Placeholder format** (`items.$.email`) — used by the collector/orchestrator to register
 *   derivations and by the fast-path `hasField()` check. The `$` acts as a wildcard
 *   representing "any index".
 * - **Concrete format** (`items.0.email`) — used at render time to look up overrides
 *   for a specific array item.
 *
 * Pass `PLACEHOLDER_INDEX` as the `index` parameter to produce the placeholder format.
 *
 * @public
 */
const PLACEHOLDER_INDEX = '$';
/**
 * Builds a property override store key for a field.
 *
 * For non-array fields, the key is just the field's key.
 * For array item fields, the key includes the array path and either a concrete
 * index (e.g., `contacts.0.email`) or the `$` placeholder (e.g., `contacts.$.email`).
 *
 * @param arrayKey - The array field key (e.g., 'contacts'), or undefined for non-array fields
 * @param index - The array item index, `PLACEHOLDER_INDEX` for the wildcard format, or undefined for non-array fields
 * @param fieldKey - The leaf field key (e.g., 'email')
 * @returns The store key (e.g., 'email', 'contacts.0.email', or 'contacts.$.email')
 *
 * @public
 */
function buildPropertyOverrideKey(arrayKey, index, fieldKey) {
    if (arrayKey != null && index != null) {
        return `${arrayKey}.${index}.${fieldKey}`;
    }
    return fieldKey;
}

/**
 * Collects all property derivation entries from field definitions.
 *
 * Traverses the field definition tree and extracts `type: 'derivation'` with `targetProperty`
 * entries from each field's `logic` array.
 *
 * No topological sort is needed because property derivations don't chain —
 * they read formValue and write to the property override store.
 *
 * @param fields - Array of field definitions to traverse
 * @returns Collection containing property derivation entries
 *
 * @public
 */
function collectPropertyDerivations(fields, logger, tracker) {
    const entries = [];
    const context = { logger, tracker };
    traverseFields$1(fields, entries, context);
    return { entries };
}
/**
 * Recursively traverses field definitions to collect property derivations.
 *
 * @internal
 */
function traverseFields$1(fields, entries, context) {
    for (const field of fields) {
        collectFromField$1(field, entries, context);
        // Recursively process container fields (page, row, group, array)
        if (hasChildFields(field)) {
            const childContext = { ...context };
            if (field.type === 'array') {
                childContext.arrayPath = field.key;
                const arrayItems = normalizeFieldsArray(field.fields);
                const normalizedChildren = [];
                for (const item of arrayItems) {
                    if (Array.isArray(item)) {
                        normalizedChildren.push(...item);
                    }
                    else {
                        normalizedChildren.push(item);
                    }
                }
                traverseFields$1(normalizedChildren, entries, childContext);
            }
            else {
                traverseFields$1(normalizeFieldsArray(field.fields), entries, childContext);
            }
        }
    }
}
/**
 * Collects property derivation entries from a single field.
 *
 * @internal
 */
function collectFromField$1(field, entries, context) {
    const fieldKey = field.key;
    if (!fieldKey)
        return;
    const validationField = field;
    if (validationField.logic) {
        for (const logicConfig of validationField.logic) {
            if (isDerivationLogicConfig(logicConfig) && hasTargetProperty(logicConfig)) {
                const entry = createPropertyDerivationEntryFromDerivation(fieldKey, logicConfig, context);
                entries.push(entry);
            }
        }
    }
}
/**
 * Creates a property derivation entry from a `DerivationLogicConfig` that has `targetProperty`.
 *
 * This handles the new unified path where `type: 'derivation'` configs with `targetProperty`
 * are routed to the property derivation pipeline.
 *
 * @internal
 */
function createPropertyDerivationEntryFromDerivation(fieldKey, config, context) {
    const effectiveFieldKey = buildPropertyOverrideKey(context.arrayPath, context.arrayPath ? PLACEHOLDER_INDEX : undefined, fieldKey);
    const dependsOn = extractDependencies(config);
    const condition = config.condition ?? true;
    const trigger = config.trigger ?? 'onChange';
    const debounceMs = trigger === 'debounced' ? config.debounceMs : undefined;
    return {
        fieldKey: effectiveFieldKey,
        targetProperty: config.targetProperty,
        dependsOn,
        condition,
        value: config.value,
        expression: config.expression,
        functionName: config.functionName,
        trigger,
        debounceMs,
        debugName: config.debugName,
        originalConfig: config,
    };
}
/**
 * Extracts all field dependencies from a property derivation config.
 *
 * @internal
 */
function extractDependencies(config) {
    const deps = new Set();
    if (config.dependsOn && config.dependsOn.length > 0) {
        config.dependsOn.forEach((dep) => deps.add(dep));
    }
    else {
        if (config.expression) {
            const exprDeps = extractStringDependencies(config.expression);
            exprDeps.forEach((dep) => deps.add(dep));
        }
        if (config.functionName) {
            deps.add('*');
        }
    }
    // Always extract from condition
    if (config.condition && config.condition !== true) {
        const conditionDeps = extractExpressionDependencies(config.condition);
        conditionDeps.forEach((dep) => deps.add(dep));
    }
    return Array.from(deps);
}

/**
 * Orchestrates property derivation processing for a dynamic form.
 *
 * Uses the same reactive stream pattern as DerivationOrchestrator:
 * - `exhaustMap` prevents re-entry during onChange processing
 * - `pairwise` tracks value changes without mutable state
 * - `takeUntilDestroyed` handles automatic cleanup
 *
 * @public
 */
class PropertyDerivationOrchestrator {
    config;
    injector = inject(Injector);
    destroyRef = inject(DestroyRef);
    logger = inject(DynamicFormLogger);
    warningTracker = inject(DERIVATION_WARNING_TRACKER);
    deprecationTracker = inject(DEPRECATION_WARNING_TRACKER);
    functionRegistry = inject(FunctionRegistryService);
    formOptions = inject(FORM_OPTIONS);
    /**
     * Computed signal containing the collected property derivations.
     * Returns null if no property derivations are defined.
     */
    propertyDerivationCollection;
    constructor(config) {
        this.config = config;
        // Pure computed — no side effects. Just derives the collection from schema fields.
        this.propertyDerivationCollection = computed(() => {
            const fields = config.schemaFields();
            if (!fields || fields.length === 0) {
                return null;
            }
            const collection = collectPropertyDerivations(fields, this.logger, this.deprecationTracker);
            if (collection.entries.length === 0) {
                return null;
            }
            return collection;
        }, ...(ngDevMode ? [{ debugName: "propertyDerivationCollection" }] : /* istanbul ignore next */ []));
        // Side effects react to collection changes: clear the store, register fields, warn.
        // schemaFields is included in the dependency array to ensure the field count is always
        // in sync with the collection (avoids reading a stale value via untracked).
        explicitEffect([this.propertyDerivationCollection, this.config.schemaFields], ([collection, fields]) => {
            config.store.clear();
            if (!collection)
                return;
            for (const entry of collection.entries) {
                config.store.registerField(entry.fieldKey);
            }
            this.warnAboutWildcardDependencies(collection.entries, fields?.length ?? 0);
        });
        this.setupOnChangeStream();
        this.setupDebouncedStream();
    }
    setupOnChangeStream() {
        const collection$ = toObservable(this.propertyDerivationCollection, { injector: this.injector });
        const formValue$ = toObservable(this.config.formValue, { injector: this.injector });
        collection$
            .pipe(filter((collection) => collection !== null), combineLatestWith(formValue$), auditTime(0), exhaustMap(([collection]) => {
            this.applyOnChangePropertyDerivations(collection);
            return scheduled([null], queueScheduler);
        }), takeUntilDestroyed(this.destroyRef))
            .subscribe({
            error: (err) => this.logger.error('Property derivation onChange stream error', err),
        });
    }
    setupDebouncedStream() {
        toObservable(this.config.formValue, { injector: this.injector })
            .pipe(debounceTime(DEFAULT_DEBOUNCE_MS), startWith(null), pairwise(), filter((pair) => pair[1] !== null), map(([previous, current]) => ({
            current,
            changedFields: getChangedKeys(previous, current),
        })), filter(({ changedFields }) => changedFields.size > 0), switchMap(({ changedFields }) => {
            const collection = untracked(() => this.propertyDerivationCollection());
            if (!collection)
                return of(null);
            const debouncePeriods = this.getDebouncePeriods(collection.entries);
            if (debouncePeriods.length === 0)
                return of(null);
            const periodStreams = debouncePeriods.map((debounceMs) => this.createPeriodStream(debounceMs, collection, changedFields));
            return merge(...periodStreams);
        }), takeUntilDestroyed(this.destroyRef))
            .subscribe({
            error: (err) => this.logger.error('Property derivation debounced stream error', err),
        });
    }
    createPeriodStream(debounceMs, collection, changedFields) {
        const additionalWait = Math.max(0, debounceMs - DEFAULT_DEBOUNCE_MS);
        return timer(additionalWait).pipe(map(() => {
            // For periods beyond DEFAULT_DEBOUNCE_MS, re-read collection as it may have changed during the wait.
            // For zero-wait periods, use the original collection directly since no time has elapsed.
            const currentCollection = additionalWait > 0 ? (untracked(() => this.propertyDerivationCollection()) ?? collection) : collection;
            this.applyDebouncedEntriesForPeriod(debounceMs, currentCollection, changedFields);
        }));
    }
    applyOnChangePropertyDerivations(collection) {
        const applicatorContext = {
            formValue: this.config.formValue,
            store: this.config.store,
            derivationFunctions: this.functionRegistry.getDerivationFunctions(),
            customFunctions: this.functionRegistry.getCustomFunctions(),
            externalData: this.resolveExternalData(),
            logger: this.logger,
            warningTracker: this.warningTracker,
        };
        applyPropertyDerivationsForTrigger(collection, 'onChange', applicatorContext);
    }
    applyDebouncedEntriesForPeriod(debounceMs, collection, changedFields) {
        const debouncedEntries = collection.entries.filter((entry) => entry.trigger === 'debounced' && (entry.debounceMs ?? DEFAULT_DEBOUNCE_MS) === debounceMs);
        if (debouncedEntries.length === 0)
            return;
        const filteredCollection = { entries: debouncedEntries };
        const applicatorContext = {
            formValue: this.config.formValue,
            store: this.config.store,
            derivationFunctions: this.functionRegistry.getDerivationFunctions(),
            customFunctions: this.functionRegistry.getCustomFunctions(),
            externalData: this.resolveExternalData(),
            logger: this.logger,
            warningTracker: this.warningTracker,
        };
        applyPropertyDerivationsForTrigger(filteredCollection, 'debounced', applicatorContext, changedFields);
    }
    getDebouncePeriods(entries) {
        const periods = new Set();
        for (const entry of entries) {
            if (entry.trigger === 'debounced') {
                periods.add(entry.debounceMs ?? DEFAULT_DEBOUNCE_MS);
            }
        }
        return Array.from(periods);
    }
    warnAboutWildcardDependencies(entries, fieldCount) {
        if (!isDevMode())
            return;
        const implicitWildcards = entries.filter((entry) => entry.dependsOn.includes('*') &&
            entry.functionName &&
            (!entry.originalConfig?.dependsOn || entry.originalConfig.dependsOn.length === 0));
        if (implicitWildcards.length > 0) {
            const derivationDescs = implicitWildcards.map((e) => `${e.fieldKey}.${e.targetProperty} (${e.functionName})`);
            this.logger.warn('[PropertyDerivation] Property derivations using custom functions without explicit dependsOn detected. ' +
                `These run on EVERY form change, which may impact performance (form has ${fieldCount} fields). ` +
                'Consider specifying explicit dependsOn arrays for better performance.', derivationDescs);
        }
    }
    /**
     * Resolves external data signals to their current values.
     *
     * Called on every onChange and debounced application. Each call iterates all
     * external data entries and resolves signals via untracked(). For forms with
     * many external data entries, this could be optimized by caching the resolved
     * record and only invalidating when external data signal values change.
     * In practice, external data entries are few, so the linear scan is acceptable.
     */
    resolveExternalData() {
        const externalDataRecord = untracked(() => this.config.externalData?.());
        if (!externalDataRecord)
            return undefined;
        const resolved = {};
        for (const [key, signalValue] of Object.entries(externalDataRecord)) {
            if (isSignal(signalValue)) {
                resolved[key] = untracked(() => signalValue());
            }
            else {
                resolved[key] = signalValue;
            }
        }
        return resolved;
    }
}
/**
 * Creates a PropertyDerivationOrchestrator for a dynamic form.
 * Must be called within an injection context.
 *
 * @param config - Form-specific signals configuration
 * @returns The created PropertyDerivationOrchestrator
 *
 * @public
 */
function createPropertyDerivationOrchestrator(config) {
    return new PropertyDerivationOrchestrator(config);
}
/**
 * Injection token for the PropertyDerivationOrchestrator.
 *
 * @public
 */
const PROPERTY_DERIVATION_ORCHESTRATOR = new InjectionToken('PROPERTY_DERIVATION_ORCHESTRATOR');

class NextPageEvent {
    type = 'next-page';
}

class PageChangeEvent {
    currentPageIndex;
    totalPages;
    previousPageIndex;
    type = 'page-change';
    constructor(
    /** The current page index (0-based) */
    currentPageIndex, 
    /** Total number of pages */
    totalPages, 
    /** Previous page index (0-based), undefined if first navigation */
    previousPageIndex) {
        this.currentPageIndex = currentPageIndex;
        this.totalPages = totalPages;
        this.previousPageIndex = previousPageIndex;
    }
}

class PreviousPageEvent {
    type = 'previous-page';
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
class FormResetEvent {
    type = 'form-reset';
}

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
class FormClearEvent {
    type = 'form-clear';
}

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
class AppendArrayItemEvent {
    arrayKey;
    template;
    type = 'append-array-item';
    constructor(
    /** The key of the array field to append an item to */
    arrayKey, 
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (FieldDef): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (FieldDef[]): Creates an object item (fields merged into object)
     */
    template) {
        this.arrayKey = arrayKey;
        this.template = template;
    }
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
class PrependArrayItemEvent {
    arrayKey;
    template;
    type = 'prepend-array-item';
    constructor(
    /** The key of the array field to prepend an item to */
    arrayKey, 
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (FieldDef): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (FieldDef[]): Creates an object item (fields merged into object)
     */
    template) {
        this.arrayKey = arrayKey;
        this.template = template;
    }
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
class InsertArrayItemEvent {
    arrayKey;
    index;
    template;
    type = 'insert-array-item';
    constructor(
    /** The key of the array field to insert an item into */
    arrayKey, 
    /** The index at which to insert the new item */
    index, 
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (FieldDef): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (FieldDef[]): Creates an object item (fields merged into object)
     */
    template) {
        this.arrayKey = arrayKey;
        this.index = index;
        this.template = template;
    }
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
class PopArrayItemEvent {
    arrayKey;
    type = 'pop-array-item';
    constructor(
    /** The key of the array field to remove the last item from */
    arrayKey) {
        this.arrayKey = arrayKey;
    }
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
class ShiftArrayItemEvent {
    arrayKey;
    type = 'shift-array-item';
    constructor(
    /** The key of the array field to remove the first item from */
    arrayKey) {
        this.arrayKey = arrayKey;
    }
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
class MoveArrayItemEvent {
    arrayKey;
    fromIndex;
    toIndex;
    type = 'move-array-item';
    constructor(
    /** The key of the array field containing the item to move */
    arrayKey, 
    /** The current index of the item to move */
    fromIndex, 
    /** The target index to move the item to */
    toIndex) {
        this.arrayKey = arrayKey;
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
    }
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
class RemoveAtIndexEvent {
    arrayKey;
    index;
    type = 'remove-at-index';
    constructor(
    /** The key of the array field to remove an item from */
    arrayKey, 
    /** The index of the item to remove */
    index) {
        this.arrayKey = arrayKey;
        this.index = index;
    }
}

class PageNavigationStateChangeEvent {
    state;
    type = 'page-navigation-state-change';
    constructor(state) {
        this.state = state;
    }
}

/**
 * PageOrchestrator manages page navigation and visibility for paged forms.
 * It acts as an intermediary between the DynamicForm component and PageField components,
 * handling page state management and navigation events without interfering with form data.
 *
 * This component uses declarative rendering with @defer blocks for optimal performance,
 * ensuring that non-visible pages are lazily loaded only when needed.
 *
 * Key responsibilities:
 * - Manage current page index state
 * - Handle navigation events (next/previous)
 * - Declaratively render pages with deferred loading
 * - Emit page change events
 * - Validate navigation boundaries
 *
 * @example
 * ```html
 * <div page-orchestrator
 *   [pageFields]="pageFields"
 *   [form]="form"
 *   [fieldSignalContext]="fieldSignalContext"
 *   [config]="orchestratorConfig"
 *   (pageChanged)="onPageChanged($event)"
 *   (navigationStateChanged)="onNavigationStateChanged($event)">
 * </div>
 * ```
 */
class PageOrchestratorComponent {
    eventBus = inject(EventBus);
    fieldContextRegistry = inject(FieldContextRegistryService);
    functionRegistry = inject(FunctionRegistryService);
    formOptions = inject(FORM_OPTIONS, { optional: true });
    /**
     * Array of page field definitions to render
     */
    pageFields = input.required(...(ngDevMode ? [{ debugName: "pageFields" }] : /* istanbul ignore next */ []));
    /**
     * Root form instance from parent DynamicForm.
     * Uses FieldTree<unknown> to accept any form type.
     */
    form = input.required(...(ngDevMode ? [{ debugName: "form" }] : /* istanbul ignore next */ []));
    /**
     * Field signal context for child fields
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FieldSignalContext is contravariant in TModel, using any allows accepting any form type
    fieldSignalContext = input.required(...(ngDevMode ? [{ debugName: "fieldSignalContext" }] : /* istanbul ignore next */ []));
    /**
     * Computed signal that tracks which pages are hidden.
     * Returns an array of booleans where true means the page is hidden.
     * This signal is reactive and will re-evaluate when form values change.
     */
    pageHiddenStates = computed(() => {
        const pages = this.pageFields();
        return pages.map((page) => this.evaluatePageHidden(page));
    }, ...(ngDevMode ? [{ debugName: "pageHiddenStates" }] : /* istanbul ignore next */ []));
    /**
     * Computed signal that returns indices of visible (non-hidden) pages.
     * This is used for navigation to skip hidden pages.
     */
    visiblePageIndices = computed(() => {
        const hiddenStates = this.pageHiddenStates();
        return hiddenStates
            .map((hidden, index) => ({ index, hidden }))
            .filter((item) => !item.hidden)
            .map((item) => item.index);
    }, ...(ngDevMode ? [{ debugName: "visiblePageIndices" }] : /* istanbul ignore next */ []));
    /**
     * Internal signal for current page index that tracks with page fields.
     * This tracks the actual page index, not the visible page index.
     *
     * Note: We only track pageFields().length to handle page additions/removals.
     * The hidden state changes should NOT reset the current page index -
     * that would cause unwanted navigation when form values change.
     */
    currentPageIndex = linkedSignal(() => {
        const totalPages = this.pageFields().length;
        if (totalPages === 0)
            return 0;
        // Start on page 0 (will be adjusted if page 0 is hidden by initial navigation)
        return 0;
    }, ...(ngDevMode ? [{ debugName: "currentPageIndex" }] : /* istanbul ignore next */ []));
    /**
     * Computed state for the orchestrator
     */
    state = computed(() => {
        const currentIndex = this.currentPageIndex();
        const totalPages = this.pageFields().length;
        const visibleIndices = this.visiblePageIndices();
        // Find where the current index is in the visible pages list
        const currentVisiblePosition = visibleIndices.indexOf(currentIndex);
        const isFirstVisiblePage = currentVisiblePosition === 0 || currentVisiblePosition === -1;
        const isLastVisiblePage = currentVisiblePosition >= visibleIndices.length - 1;
        return {
            currentPageIndex: currentIndex,
            totalPages,
            isFirstPage: isFirstVisiblePage,
            isLastPage: isLastVisiblePage,
            navigationDisabled: false,
        };
    }, ...(ngDevMode ? [{ debugName: "state" }] : /* istanbul ignore next */ []));
    /**
     * Signal indicating whether all fields on the current page are valid.
     *
     * This is used by next page buttons to determine their disabled state.
     * Returns `true` if all fields on the current page pass validation,
     * `false` otherwise.
     *
     * @returns `true` if current page is valid, `false` otherwise
     */
    currentPageValid = computed(() => {
        const currentIndex = this.currentPageIndex();
        const pages = this.pageFields();
        const form = this.form();
        // No pages or invalid index
        if (pages.length === 0 || currentIndex >= pages.length) {
            return true;
        }
        const currentPage = pages[currentIndex];
        const pageFields = currentPage.fields || [];
        // Collect all leaf field keys, recursively traversing group/row containers
        const leafKeys = collectLeafFieldKeys(pageFields);
        // Check validity of each leaf field on the current page
        // Fields are stored at root level in the form (pages don't add nesting)
        for (const fieldKey of leafKeys) {
            const field = form[fieldKey];
            if (field && typeof field === 'function') {
                const fieldState = field();
                if (fieldState && typeof fieldState.valid === 'function' && !fieldState.valid()) {
                    return false;
                }
            }
        }
        return true;
    }, ...(ngDevMode ? [{ debugName: "currentPageValid" }] : /* istanbul ignore next */ []));
    /**
     * Extended field signal context that includes currentPageValid.
     *
     * This extends the parent context from DynamicForm with page-specific
     * information needed by button mappers (e.g., next button needs to know
     * if the current page is valid).
     */
    extendedFieldSignalContext = computed(() => ({
        ...this.fieldSignalContext(),
        currentPageValid: this.currentPageValid,
    }), ...(ngDevMode ? [{ debugName: "extendedFieldSignalContext" }] : /* istanbul ignore next */ []));
    constructor() {
        // Setup event listeners for navigation
        this.setupEventListeners();
        // B15: Auto-navigate away when current page becomes hidden
        explicitEffect([this.state, this.visiblePageIndices], ([state, visibleIndices]) => {
            const currentVisiblePosition = visibleIndices.indexOf(state.currentPageIndex);
            if (currentVisiblePosition === -1 && visibleIndices.length > 0) {
                // Current page is hidden — navigate to the nearest visible page
                const nearest = this.findNearestVisiblePage(state.currentPageIndex, visibleIndices);
                if (nearest !== -1) {
                    this.navigateToPage(nearest);
                }
            }
        });
    }
    /**
     * Navigate to the next visible page, skipping hidden pages.
     * @returns Navigation result
     */
    navigateToNextPage() {
        // Guard: do not advance if current page has invalid fields.
        // Respects disableWhenPageInvalid option (defaults to true).
        const disableWhenPageInvalid = this.formOptions?.()?.nextButton?.disableWhenPageInvalid ?? true;
        if (disableWhenPageInvalid && !this.currentPageValid()) {
            return {
                success: false,
                newPageIndex: this.state().currentPageIndex,
                error: 'Current page has invalid fields',
            };
        }
        const currentState = this.state();
        const visibleIndices = this.visiblePageIndices();
        if (currentState.isLastPage) {
            return {
                success: false,
                newPageIndex: currentState.currentPageIndex,
                error: 'Already on the last visible page',
            };
        }
        if (currentState.navigationDisabled) {
            return {
                success: false,
                newPageIndex: currentState.currentPageIndex,
                error: 'Navigation is currently disabled',
            };
        }
        // Find the next visible page after the current index
        const currentVisiblePosition = visibleIndices.indexOf(currentState.currentPageIndex);
        if (currentVisiblePosition === -1 || currentVisiblePosition >= visibleIndices.length - 1) {
            return {
                success: false,
                newPageIndex: currentState.currentPageIndex,
                error: 'No next visible page available',
            };
        }
        const nextVisiblePageIndex = visibleIndices[currentVisiblePosition + 1];
        return this.navigateToPage(nextVisiblePageIndex);
    }
    /**
     * Navigate to the previous visible page, skipping hidden pages.
     * @returns Navigation result
     */
    navigateToPreviousPage() {
        const currentState = this.state();
        const visibleIndices = this.visiblePageIndices();
        if (currentState.isFirstPage) {
            return {
                success: false,
                newPageIndex: currentState.currentPageIndex,
                error: 'Already on the first visible page',
            };
        }
        if (currentState.navigationDisabled) {
            return {
                success: false,
                newPageIndex: currentState.currentPageIndex,
                error: 'Navigation is currently disabled',
            };
        }
        // Find the previous visible page before the current index
        const currentVisiblePosition = visibleIndices.indexOf(currentState.currentPageIndex);
        if (currentVisiblePosition <= 0) {
            return {
                success: false,
                newPageIndex: currentState.currentPageIndex,
                error: 'No previous visible page available',
            };
        }
        const prevVisiblePageIndex = visibleIndices[currentVisiblePosition - 1];
        return this.navigateToPage(prevVisiblePageIndex);
    }
    /**
     * Navigate to a specific page index
     * @param pageIndex The target page index (0-based)
     * @returns Navigation result
     */
    navigateToPage(pageIndex) {
        const currentState = this.state();
        const totalPages = currentState.totalPages;
        // Validate page index bounds
        if (pageIndex < 0 || pageIndex >= totalPages) {
            return {
                success: false,
                newPageIndex: currentState.currentPageIndex,
                error: `Invalid page index: ${pageIndex}. Valid range is 0 to ${totalPages - 1}`,
            };
        }
        // Validate target page is visible
        const visibleIndices = this.visiblePageIndices();
        if (!visibleIndices.includes(pageIndex)) {
            return {
                success: false,
                newPageIndex: currentState.currentPageIndex,
                error: `Cannot navigate to hidden page at index ${pageIndex}. Visible pages: [${visibleIndices.join(', ')}]`,
            };
        }
        // Check if already on target page
        if (pageIndex === currentState.currentPageIndex) {
            return {
                success: true,
                newPageIndex: pageIndex,
            };
        }
        // Perform navigation
        const previousIndex = currentState.currentPageIndex;
        this.currentPageIndex.set(pageIndex);
        // Emit page change event
        this.eventBus.dispatch(PageChangeEvent, pageIndex, totalPages, previousIndex);
        return {
            success: true,
            newPageIndex: pageIndex,
        };
    }
    /**
     * Finds the nearest visible page index to the given index.
     * Prefers the forward (higher index) page when equidistant.
     */
    findNearestVisiblePage(currentIndex, visibleIndices) {
        let nearest = -1;
        let minDistance = Infinity;
        for (const idx of visibleIndices) {
            const distance = Math.abs(idx - currentIndex);
            // Prefer forward (higher index) when tied
            if (distance < minDistance || (distance === minDistance && idx > nearest)) {
                minDistance = distance;
                nearest = idx;
            }
        }
        return nearest;
    }
    /**
     * Set up event listeners for navigation events
     */
    setupEventListeners() {
        // Listen for next page events
        this.eventBus
            .on('next-page')
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
            this.navigateToNextPage();
        });
        // Listen for previous page events
        this.eventBus
            .on('previous-page')
            .pipe(takeUntilDestroyed())
            .subscribe(() => {
            this.navigateToPreviousPage();
        });
        explicitEffect([this.state], ([state]) => this.eventBus.dispatch(PageNavigationStateChangeEvent, state));
    }
    /**
     * Evaluates whether a page should be hidden based on its logic configuration.
     * A page is hidden if ANY of its hidden logic conditions evaluate to true.
     *
     * @param page The page field to evaluate
     * @returns true if the page should be hidden, false otherwise
     */
    evaluatePageHidden(page) {
        // If no logic defined, page is visible
        if (!page.logic || page.logic.length === 0) {
            return false;
        }
        // Filter to only hidden logic (pages only support hidden type)
        const hiddenLogic = page.logic.filter((l) => l.type === 'hidden');
        // If no hidden logic, page is visible
        if (hiddenLogic.length === 0) {
            return false;
        }
        // Check each hidden logic - if ANY condition is true, the page is hidden
        for (const logic of hiddenLogic) {
            // Handle static boolean conditions (fast path)
            if (typeof logic.condition === 'boolean') {
                if (logic.condition) {
                    return true;
                }
                continue;
            }
            // Evaluate conditional expression using centralized context creation
            const condition = logic.condition;
            const context = this.fieldContextRegistry.createDisplayOnlyContext(page.key || '', this.functionRegistry.getCustomFunctions());
            if (evaluateCondition(condition, context)) {
                return true;
            }
        }
        return false;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: PageOrchestratorComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: PageOrchestratorComponent, isStandalone: true, selector: "div[page-orchestrator]", inputs: { pageFields: { classPropertyName: "pageFields", publicName: "pageFields", isSignal: true, isRequired: true, transformFunction: null }, form: { classPropertyName: "form", publicName: "form", isSignal: true, isRequired: true, transformFunction: null }, fieldSignalContext: { classPropertyName: "fieldSignalContext", publicName: "fieldSignalContext", isSignal: true, isRequired: true, transformFunction: null } }, host: { properties: { "attr.data-current-page": "state().currentPageIndex", "attr.data-total-pages": "state().totalPages" }, classAttribute: "df-page-orchestrator" }, providers: [
            {
                provide: FIELD_SIGNAL_CONTEXT,
                useFactory: (orchestrator) => orchestrator.extendedFieldSignalContext(),
                deps: [PageOrchestratorComponent],
            },
        ], ngImport: i0, template: `
    @for (pageField of pageFields(); track pageField.key; let i = $index) {
      @if (i === state().currentPageIndex || i === state().currentPageIndex + 1 || i === state().currentPageIndex - 1) {
        <!-- Current and adjacent pages (±1): render immediately for flicker-free navigation -->
        @defer (on immediate) {
          <section
            page-field
            [field]="pageField"
            [key]="pageField.key"
            [pageIndex]="i"
            [isVisible]="i === state().currentPageIndex"
          ></section>
        } @placeholder {
          <div class="df-page-placeholder" [attr.data-page-index]="i" [attr.data-page-key]="pageField.key"></div>
        }
      } @else {
        <!-- Distant pages: defer until browser is idle for memory savings -->
        @defer (on idle) {
          <section page-field [field]="pageField" [key]="pageField.key" [pageIndex]="i" [isVisible]="false"></section>
        } @placeholder {
          <div class="df-page-placeholder" [attr.data-page-index]="i" [attr.data-page-key]="pageField.key"></div>
        }
      }
    }
  `, isInline: true, styles: [":host{display:block;position:relative;width:100%}\n"], changeDetection: i0.ChangeDetectionStrategy.OnPush, deferBlockDependencies: [() => [import('./ng-forge-dynamic-forms-page-field.component-DBAfZgLg.mjs').then(m => m.default)], () => [import('./ng-forge-dynamic-forms-page-field.component-DBAfZgLg.mjs').then(m => m.default)]] });
}
i0.ɵɵngDeclareClassMetadataAsync({ minVersion: "18.0.0", version: "21.2.6", ngImport: i0, type: PageOrchestratorComponent, resolveDeferredDeps: () => [import('./ng-forge-dynamic-forms-page-field.component-DBAfZgLg.mjs').then(m => m.default)], resolveMetadata: PageFieldComponent => ({ decorators: [{
                type: Component,
                args: [{ selector: 'div[page-orchestrator]', imports: [PageFieldComponent], template: `
    @for (pageField of pageFields(); track pageField.key; let i = $index) {
      @if (i === state().currentPageIndex || i === state().currentPageIndex + 1 || i === state().currentPageIndex - 1) {
        <!-- Current and adjacent pages (±1): render immediately for flicker-free navigation -->
        @defer (on immediate) {
          <section
            page-field
            [field]="pageField"
            [key]="pageField.key"
            [pageIndex]="i"
            [isVisible]="i === state().currentPageIndex"
          ></section>
        } @placeholder {
          <div class="df-page-placeholder" [attr.data-page-index]="i" [attr.data-page-key]="pageField.key"></div>
        }
      } @else {
        <!-- Distant pages: defer until browser is idle for memory savings -->
        @defer (on idle) {
          <section page-field [field]="pageField" [key]="pageField.key" [pageIndex]="i" [isVisible]="false"></section>
        } @placeholder {
          <div class="df-page-placeholder" [attr.data-page-index]="i" [attr.data-page-key]="pageField.key"></div>
        }
      }
    }
  `, host: {
                            class: 'df-page-orchestrator',
                            '[attr.data-current-page]': 'state().currentPageIndex',
                            '[attr.data-total-pages]': 'state().totalPages',
                        }, providers: [
                            {
                                provide: FIELD_SIGNAL_CONTEXT,
                                useFactory: (orchestrator) => orchestrator.extendedFieldSignalContext(),
                                deps: [PageOrchestratorComponent],
                            },
                        ], changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host{display:block;position:relative;width:100%}\n"] }]
            }], ctorParameters: () => [], propDecorators: { pageFields: [{ type: i0.Input, args: [{ isSignal: true, alias: "pageFields", required: true }] }], form: [{ type: i0.Input, args: [{ isSignal: true, alias: "form", required: true }] }], fieldSignalContext: [{ type: i0.Input, args: [{ isSignal: true, alias: "fieldSignalContext", required: true }] }] } }) });
/**
 * Recursively collects form-tree keys for all value-bearing nodes on a page.
 *
 * Row fields are layout-only containers whose children are flattened to the
 * parent level in the form tree, so we recurse through them transparently.
 *
 * Group fields create a nested sub-tree in the form (form['address']['street']).
 * Their group-level FieldTree node aggregates child validity, so we use the
 * group's own key — not the individual child keys — to check validity.
 *
 * Array fields are also accessed by their own key; the ArrayFieldTree node
 * covers minLength/maxLength and any item-level validators.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts any field shape for recursive traversal
function collectLeafFieldKeys(fields) {
    const keys = [];
    for (const field of fields) {
        if (isRowField(field)) {
            // Row children are at the same form-tree level as the row itself
            keys.push(...collectLeafFieldKeys(field.fields));
        }
        else if (field.key) {
            keys.push(field.key);
        }
    }
    return keys;
}

/**
 * Symbol key for storing normalization metadata on array field objects.
 * Using a Symbol ensures no collision with user-defined properties and
 * the property is excluded from JSON serialization and enumeration.
 */
const NORMALIZED_ARRAY_METADATA = Symbol('normalizedArrayMetadata');
/**
 * Associates normalization metadata with an array field object.
 * Called during simplified array expansion.
 */
function setNormalizedArrayMetadata(arrayField, metadata) {
    arrayField[NORMALIZED_ARRAY_METADATA] = metadata;
}
/**
 * Retrieves normalization metadata for an array field, if any.
 * Returns undefined for full-API arrays that were not normalized from a simplified definition.
 */
function getNormalizedArrayMetadata(arrayField) {
    return arrayField[NORMALIZED_ARRAY_METADATA];
}

/**
 * Normalizes simplified array fields into full array field definitions.
 *
 * Walks the field tree and expands any `SimplifiedArrayField` (those with a `template` property)
 * into a standard `ArrayField` with proper item definitions and add/remove button fields.
 *
 * This is a pure function with no DI dependencies. It is idempotent — calling it on
 * already-normalized output produces the same result.
 */
function normalizeSimplifiedArrays(fields) {
    return fields.flatMap((field) => {
        // Recurse into non-array containers (page, group, row) that have child fields
        if (isContainerField(field) && !isArrayField(field) && hasChildFields(field)) {
            return [{ ...field, fields: normalizeSimplifiedArrays(field.fields) }];
        }
        // Full-API arrays may have simplified arrays nested inside their item templates
        if (isArrayField(field) && !isSimplifiedArrayField(field)) {
            const normalizedItems = field.fields.map((item) => Array.isArray(item) ? normalizeSimplifiedArrays(item) : item);
            return [{ ...field, fields: normalizedItems }];
        }
        // Expand simplified array fields
        if (isSimplifiedArrayField(field)) {
            const { arrayField, addButton } = expandSimplifiedArray(field);
            return addButton ? [arrayField, addButton] : [arrayField];
        }
        // Pass through all other fields unchanged
        return [field];
    });
}
/**
 * Invalid field types that are not allowed as array children.
 * TypeScript enforces this via ArrayAllowedChildren at compile time,
 * but runtime validation is needed for JavaScript users and dynamic configs.
 */
const INVALID_ARRAY_CHILD_TYPES = new Set(['page', 'array']);
/**
 * Validates a simplified array field's template configuration.
 * Throws DynamicFormError for invalid configurations that would silently produce broken output.
 */
function validateSimplifiedTemplate(field) {
    const { template, key } = field;
    const isObjectTemplate = Array.isArray(template);
    if (isObjectTemplate) {
        const templateFields = template;
        for (const tmpl of templateFields) {
            // Cast to FieldDef for runtime check — TypeScript prevents this statically,
            // but dynamic configs (e.g., from JSON) may violate the constraint.
            if (INVALID_ARRAY_CHILD_TYPES.has(tmpl.type)) {
                throw new DynamicFormError(`Simplified array "${key}" template contains a '${tmpl.type}' field (key: '${tmpl.key}'). ` +
                    `Only leaf fields, rows, and groups are allowed as array children.`);
            }
        }
    }
    else {
        const singleTemplate = template;
        if (INVALID_ARRAY_CHILD_TYPES.has(singleTemplate.type)) {
            throw new DynamicFormError(`Simplified array "${key}" template has type '${singleTemplate.type}'. ` +
                `Only leaf fields, rows, and groups are allowed as array children.`);
        }
    }
}
/**
 * Expands a simplified array field into a full ArrayField + optional add button.
 */
function expandSimplifiedArray(field) {
    const { template, value = [], addButton, removeButton, key, logic, minLength, maxLength, wrappers, skipAutoWrappers, skipDefaultWrappers, } = field;
    const isObjectTemplate = Array.isArray(template);
    const values = value;
    // Validate template before expansion
    validateSimplifiedTemplate(field);
    // Build items from values
    const items = values.map((v) => {
        if (isObjectTemplate) {
            return buildObjectItem(template, v, removeButton);
        }
        return buildPrimitiveItem(template, v);
    });
    // Build the add button template (item structure without values)
    // For primitive arrays, the add template is a single field (not wrapped in array)
    // so that handleAddFromEvent treats it as a primitive item
    const addTemplate = isObjectTemplate
        ? buildObjectItemTemplate(template, removeButton)
        : template;
    // For primitive arrays with remove buttons, store the remove button config
    // via Symbol metadata. The array component renders remove buttons alongside
    // each item without wrapping in a row, preserving flat primitive form values.
    const hasAutoRemove = !isObjectTemplate && removeButton !== false;
    // Construct the full ArrayField
    const arrayFieldObj = {
        key,
        type: 'array',
        fields: items,
    };
    if (logic) {
        arrayFieldObj['logic'] = logic;
    }
    if (minLength !== undefined) {
        arrayFieldObj['minLength'] = minLength;
    }
    if (maxLength !== undefined) {
        arrayFieldObj['maxLength'] = maxLength;
    }
    if (wrappers !== undefined) {
        arrayFieldObj['wrappers'] = wrappers;
    }
    if (skipAutoWrappers !== undefined) {
        arrayFieldObj['skipAutoWrappers'] = skipAutoWrappers;
    }
    if (skipDefaultWrappers !== undefined) {
        arrayFieldObj['skipDefaultWrappers'] = skipDefaultWrappers;
    }
    // Safe cast: we're constructing a valid ArrayField shape with key, type, and fields
    const arrayField = arrayFieldObj;
    // Store normalization metadata via Symbol property instead of a runtime property.
    // `restoreTemplate` always gets populated so the array component can resolve untracked
    // items (e.g., from external form-value updates).
    //
    // For object templates, we must include the auto-generated remove button in the stored
    // restoreTemplate because object arrays embed the button inside each item's fields (via
    // buildObjectItem) rather than via the `autoRemoveButton` metadata. Without this, restored
    // items would render without the remove button that originally-declared items have.
    // Primitive templates keep the button as separate metadata and pass the raw template
    // through — withAutoRemove() appends the button at resolution time from autoRemoveButton.
    const primitiveFieldKey = !isObjectTemplate ? template.key : undefined;
    const restoreTemplate = isObjectTemplate ? buildObjectItemTemplate(template, removeButton) : template;
    setNormalizedArrayMetadata(arrayFieldObj, {
        ...(hasAutoRemove && { autoRemoveButton: buildRemoveButton(removeButton) }),
        ...(primitiveFieldKey && { primitiveFieldKey }),
        restoreTemplate,
    });
    // Construct the add button (sibling, placed after the array)
    let addButtonField;
    if (addButton !== false) {
        const buttonConfig = (typeof addButton === 'object' ? addButton : {});
        // Safe cast: we're constructing a valid addArrayItem field shape
        addButtonField = {
            key: `${key}__add`,
            type: 'addArrayItem',
            label: buttonConfig.label ?? 'Add',
            arrayKey: key,
            template: addTemplate,
            ...(buttonConfig.props && { props: buttonConfig.props }),
            // Logic is intentionally shared with the array field so the add button
            // hides/shows together with the array (e.g., when a hidden condition applies).
            ...(logic && { logic }),
        };
    }
    return { arrayField, addButton: addButtonField };
}
/**
 * Builds a primitive array item as a single FieldDef (not wrapped in array).
 *
 * This ensures the form schema creates FormControls (not FormGroups) for each item,
 * producing flat primitive values like `['angular', 'typescript']` instead of
 * `[{ value: 'angular' }, { value: 'typescript' }]`.
 *
 * Remove buttons are handled separately via Symbol metadata on the array field,
 * which the array component renders alongside each item without affecting form values.
 */
function buildPrimitiveItem(template, value) {
    return { ...template, value };
}
/**
 * Builds an object array item: template fields with values merged + optional remove button.
 */
function buildObjectItem(template, valueObj, removeButton) {
    const fieldsWithValues = template.map((templateField) => ({
        ...templateField,
        ...(Object.hasOwn(valueObj, templateField.key) && { value: valueObj[templateField.key] }),
    }));
    if (removeButton === false) {
        return fieldsWithValues;
    }
    return [...fieldsWithValues, buildRemoveButton(removeButton)];
}
/**
 * Builds the add button template for object items (template fields without values + remove button).
 */
function buildObjectItemTemplate(template, removeButton) {
    if (removeButton === false) {
        return template;
    }
    return [...template, buildRemoveButton(removeButton)];
}
/**
 * Builds a remove button field definition.
 */
function buildRemoveButton(config) {
    const buttonConfig = (typeof config === 'object' ? config : {});
    // Safe cast: removeArrayItem fields are valid ArrayAllowedChildren but not in the static union
    return {
        key: '__remove',
        type: 'removeArrayItem',
        label: buttonConfig.label ?? 'Remove',
        ...(buttonConfig.props && { props: buttonConfig.props }),
    };
}

/**
 * Type guard to check if a field is a container with fields
 */
function isContainerWithFields(field) {
    return ((field.type === 'row' || field.type === 'group' || field.type === 'page' || field.type === 'container') &&
        'fields' in field &&
        Array.isArray(field.fields));
}
/**
 * Type guard for paged form configurations
 * A paged form has ALL root-level fields of type 'page'
 */
function isPagedForm(fields) {
    if (!fields || fields.length === 0) {
        return false;
    }
    return fields.every((field) => isPageField(field));
}
/**
 * Type guard for non-paged form configurations
 * A non-paged form has NO page fields at any level
 */
function isNonPagedForm(fields) {
    if (!fields || fields.length === 0) {
        return true; // Empty form is considered non-paged
    }
    return !hasAnyPageFields(fields);
}
/**
 * Detects the form mode and validates the configuration
 * @param fields The form field definitions
 * @returns Detection result with mode and validation status
 */
function detectFormMode(fields) {
    if (!fields || fields.length === 0) {
        return {
            mode: 'non-paged',
            isValid: true,
            errors: [],
        };
    }
    const hasPageFields = fields.some((field) => isPageField(field));
    const allPagesAtRoot = fields.every((field) => isPageField(field));
    const hasNestedPages = hasNestedPageFields(fields);
    // Determine mode and validate
    if (hasPageFields) {
        const errors = [];
        // For paged forms, ALL root fields must be pages
        if (!allPagesAtRoot) {
            errors.push('Mixed page and non-page fields at root level. In paged forms, ALL root-level fields must be of type "page".');
        }
        // Check for nested pages in any page field
        if (hasNestedPages) {
            errors.push('Page fields cannot contain nested page fields at any level.');
        }
        return {
            mode: 'paged',
            isValid: errors.length === 0,
            errors,
        };
    }
    else {
        // Non-paged form
        const errors = [];
        // Non-paged forms cannot have page fields anywhere
        if (hasAnyPageFields(fields)) {
            errors.push('Page fields are not allowed in non-paged forms.');
        }
        return {
            mode: 'non-paged',
            isValid: errors.length === 0,
            errors,
        };
    }
}
/**
 * Recursively checks if any field definition is a page field
 * @param fields Array of field definitions to check
 * @returns true if any page field is found at any level
 */
function hasAnyPageFields(fields) {
    for (const field of fields) {
        if (isPageField(field)) {
            return true;
        }
        // Check nested fields in container types
        if (isContainerWithFields(field) && (field.type === 'row' || field.type === 'group')) {
            if (hasAnyPageFields(field.fields)) {
                return true;
            }
        }
    }
    return false;
}
/**
 * Checks if fields contain nested page fields within their children
 * (This is different from hasAnyPageFields as it checks NESTED pages, not root pages)
 * @param fields Array of field definitions to check
 * @returns true if nested page fields found
 */
function hasNestedPageFields(fields) {
    for (const field of fields) {
        // If this is a page field, check if its children contain pages
        if (isPageField(field) && isContainerWithFields(field)) {
            if (hasAnyPageFields(field.fields)) {
                return true;
            }
        }
        // Check other container types for nested pages
        if (isContainerWithFields(field) && (field.type === 'row' || field.type === 'group')) {
            if (hasNestedPageFields(field.fields)) {
                return true;
            }
        }
    }
    return false;
}
/**
 * Type predicate for valid paged form configurations
 */
function isValidPagedForm(fields) {
    const result = detectFormMode(fields);
    return result.mode === 'paged' && result.isValid;
}
/**
 * Type predicate for valid non-paged form configurations
 */
function isValidNonPagedForm(fields) {
    const result = detectFormMode(fields);
    return result.mode === 'non-paged' && result.isValid;
}

/**
 * Type guard to distinguish function-based HTTP validators from declarative ones.
 *
 * Both use `type: 'http'`, so `switch (config.type)` cannot narrow between them.
 * Use this guard when you need type-safe access to `FunctionHttpValidatorConfig` properties.
 */
function isFunctionHttpValidator(config) {
    return 'functionName' in config && !!config.functionName;
}

/**
 * Evaluates an HTTP response against a `HttpValidationResponseMapping` to produce a validation result.
 *
 * - `validWhen` === `true` → `null` (valid, no error)
 * - `validWhen` !== `true` → `{ kind: errorKind, ...evaluatedErrorParams }`
 * - Expression error → logs warning, returns `{ kind: errorKind }` (fail-closed)
 *
 * Expressions are evaluated with scope `{ response }` only.
 */
function evaluateHttpValidationResponse(response, mapping, logger) {
    const scope = { response };
    try {
        const result = ExpressionParser.evaluate(mapping.validWhen, scope);
        if (typeof result !== 'boolean') {
            logger.warn(`validWhen expression "${mapping.validWhen}" returned non-boolean value:`, result, 'Expected true or false.');
        }
        if (result === true) {
            return null;
        }
        const error = { kind: mapping.errorKind };
        if (mapping.errorParams) {
            for (const [key, expression] of Object.entries(mapping.errorParams)) {
                try {
                    error[key] = ExpressionParser.evaluate(expression, scope);
                }
                catch (err) {
                    logger.warn(`Error evaluating errorParam "${key}":`, expression, err);
                }
            }
        }
        return error;
    }
    catch (err) {
        logger.warn('Error evaluating validWhen expression:', mapping.validWhen, err);
        return { kind: mapping.errorKind };
    }
}

/**
 * Serializes a value to a deterministic string for cache key generation.
 * Unlike JSON.stringify, this sorts object keys to ensure consistent output
 * regardless of property insertion order.
 */
function stableStringify(value) {
    if (value === null || value === undefined) {
        return String(value);
    }
    if (typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }
    const obj = value;
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map((key) => JSON.stringify(key) + ':' + stableStringify(obj[key]));
    return '{' + pairs.join(',') + '}';
}

/**
 * TTL cache for HTTP condition responses with max entries eviction.
 *
 * Keyed by serialized resolved request (the `HttpResourceRequest` after expression evaluation).
 * Two different form states producing the same resolved URL+body hit the same cache entry.
 *
 * When `maxEntries` is exceeded, the oldest entry (by insertion order) is evicted.
 *
 * Provided via DI (scoped to DynamicForm component) for SSR safety.
 */
class HttpConditionCache {
    cache = new Map();
    maxEntries;
    constructor(maxEntries = 100) {
        this.maxEntries = Math.max(1, maxEntries);
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return undefined;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.value;
    }
    set(key, value, ttlMs) {
        // Evict oldest entries if at capacity (Map preserves insertion order)
        while (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    clear() {
        this.cache.clear();
    }
}
/** @internal */
const HTTP_CONDITION_CACHE = new InjectionToken('HttpConditionCache');

/**
 * DI-scoped cache for HTTP condition logic functions.
 *
 * Replaces module-scoped WeakMaps to ensure SSR safety.
 * Scoped to the DynamicForm component via `provideDynamicFormDI()`.
 *
 * Note: Per-field signal stores are closure-scoped per LogicFn, not shared here,
 * because multiple HTTP conditions on the same field share the same FieldContext
 * reference and would collide in a shared WeakMap.
 */
class HttpConditionFunctionCacheService {
    /** Cache for HTTP condition logic functions, keyed by serialized condition. */
    httpConditionFunctionCache = new Map();
}

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
function withPreviousValue(input) {
    const derived = linkedSignal({ ...(ngDevMode ? { debugName: "derived" } : /* istanbul ignore next */ {}), source: input.snapshot,
        computation: (snapshot, previous) => {
            // During loading/reloading, keep the previous resolved value if available.
            // Don't preserve values from error states — those aren't useful to show.
            if ((snapshot.status === 'loading' || snapshot.status === 'reloading') &&
                previous !== undefined &&
                previous.value.status !== 'error') {
                return { status: snapshot.status, value: previous.value.value };
            }
            return snapshot;
        } });
    return resourceFromSnapshots(derived);
}

/**
 * Type guard to check if a value is an array of Signals.
 * @internal
 */
function isSignalArray(value) {
    return Array.isArray(value) && value.every((item) => isSignal(item));
}
/**
 * Type guard to check if a value is a record (object) of Signals.
 * @internal
 */
function isSignalRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every((item) => isSignal(item));
}
// Implementation
function derivedFromDeferred(source, operator, options) {
    const deferred$ = defer(() => {
        // Handle single signal
        if (isSignal(source)) {
            return toObservable(source, { injector: options.injector });
        }
        // Handle array of signals
        if (isSignalArray(source)) {
            const observables = source.map((s) => toObservable(s, { injector: options.injector }));
            return combineLatest(observables);
        }
        // Handle object of signals
        if (isSignalRecord(source)) {
            const keys = Object.keys(source);
            const observables = keys.map((key) => toObservable(source[key], { injector: options.injector }));
            return combineLatest(observables, (...values) => {
                const result = {};
                keys.forEach((key, index) => {
                    result[key] = values[index];
                });
                return result;
            });
        }
        // Fallback - should not happen with proper typing
        throw new Error('Invalid source type. Expected a Signal, array of Signals, or object of Signals.');
    }).pipe(operator);
    return toSignal(deferred$, { initialValue: options.initialValue, injector: options.injector });
}

/**
 * Extracts a boolean from an HTTP response using an optional expression.
 * When `responseExpression` is provided, evaluates it with `{ response }` scope.
 * Truthy values are treated as `true` — non-boolean results trigger a warning to encourage explicit boolean expressions.
 * Otherwise, coerces the response to boolean.
 */
function extractBoolean(response, responseExpression, pendingValue, logger) {
    if (responseExpression) {
        try {
            const result = ExpressionParser.evaluate(responseExpression, { response });
            if (typeof result !== 'boolean') {
                logger.warn(`responseExpression "${responseExpression}" returned non-boolean value:`, result, 'Consider returning a boolean explicitly.');
            }
            return !!result;
        }
        catch (error) {
            logger.warn(`Failed to evaluate responseExpression '${responseExpression}':`, error);
            return pendingValue;
        }
    }
    return !!response;
}
/**
 * Creates a logic function for an HTTP condition.
 *
 * Uses Angular's `rxResource()` API with snapshot composition for async resolution:
 * the LogicFn updates a `resolvedRequest` signal, a debounced version feeds into
 * an `rxResource()` that manages the HTTP lifecycle, and `withPreviousValue()` preserves
 * the last resolved boolean during re-fetching to prevent UI flicker.
 *
 * Must be called in injection context (same as `createLogicFunction`).
 */
function createHttpConditionLogicFunction(condition) {
    const httpClient = inject(HttpClient, { optional: true });
    if (!httpClient) {
        throw new DynamicFormError('HttpClient is required for HTTP conditions. Add provideHttpClient() to your providers.');
    }
    const fieldContextRegistry = inject(FieldContextRegistryService);
    const functionRegistry = inject(FunctionRegistryService);
    const injector = inject(Injector);
    const cache = inject(HTTP_CONDITION_CACHE);
    const logger = inject(DynamicFormLogger);
    const cacheService = inject(HttpConditionFunctionCacheService);
    const pendingValue = condition.pendingValue ?? false;
    const cacheDurationMs = condition.cacheDurationMs ?? 30000;
    const debounceMs = condition.debounceMs ?? 300;
    // Check function cache
    const cacheKey = stableStringify(condition);
    const cached = cacheService.httpConditionFunctionCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    // Each condition needs its own per-field signal store. A shared store would collide
    // when multiple HTTP conditions exist on the same field (same FieldContext / path).
    const perFunctionSignalStore = new Map();
    const fn = (ctx) => {
        const contextKey = safeReadPathKeys(ctx).join('.');
        let signalPair = perFunctionSignalStore.get(contextKey);
        if (!signalPair) {
            const resolvedRequest = signal(undefined, ...(ngDevMode ? [{ debugName: "resolvedRequest" }] : /* istanbul ignore next */ []));
            // Wrap in untracked() to avoid NG0602: resource() internally creates effects,
            // which cannot be created inside a reactive context (computed). The LogicFn runs
            // inside Angular Signal Forms' BooleanOrLogic.compute (a computed), so we must
            // clear the active reactive consumer before creating the resource pipeline.
            const resultResource = untracked(() => {
                // Create a debounced, stabilized version of the request signal.
                // This prevents rapid re-fetches when form values change quickly.
                const debouncedRequest = derivedFromDeferred(resolvedRequest, pipe(debounceTime(debounceMs), distinctUntilChanged((prev, curr) => stableStringify(prev) === stableStringify(curr))), { initialValue: undefined, injector });
                // rxResource() manages the HTTP lifecycle natively with Observables:
                // auto-cancellation via unsubscription, loading/resolved/error status tracking,
                // and signal-based reactivity.
                const httpResource = rxResource({
                    params: () => debouncedRequest() ?? undefined,
                    // When params() returns undefined, rxResource() enters idle state and skips the stream.
                    stream: ({ params: request }) => {
                        const method = request.method ?? 'GET';
                        const options = {};
                        if (request.body)
                            options['body'] = request.body;
                        if (request.headers)
                            options['headers'] = request.headers;
                        return httpClient.request(method, request.url, options).pipe(map((response) => extractBoolean(response, condition.responseExpression, pendingValue, logger)), tap((value) => {
                            const requestKey = stableStringify(request);
                            cache.set(requestKey, value, cacheDurationMs);
                        }), catchError((error) => {
                            logger.warn('HTTP condition request failed:', error);
                            return of(pendingValue);
                        }));
                    },
                    defaultValue: pendingValue,
                    injector,
                });
                // Snapshot composition: preserve the previous boolean result during re-fetching.
                // Without this, the condition would briefly flash to pendingValue when params change,
                // causing visible UI flicker (e.g., a conditionally visible field briefly disappearing).
                return withPreviousValue(httpResource);
            });
            signalPair = { resolvedRequest, resultResource };
            perFunctionSignalStore.set(contextKey, signalPair);
        }
        // Build reactive evaluation context (creates signal dependencies on form values)
        const evaluationContext = fieldContextRegistry.createReactiveEvaluationContext(ctx, functionRegistry.getCustomFunctions());
        // Returns null when a path param is undefined — skip the request and return pending value
        const resolved = resolveHttpRequest(condition.http, evaluationContext);
        if (!resolved) {
            return signalPair.resultResource.value();
        }
        const requestKey = stableStringify(resolved);
        // Check response cache first
        const cachedResult = cache.get(requestKey);
        if (cachedResult !== undefined) {
            return cachedResult;
        }
        // Update the resolved request signal (triggers resource if request changed)
        const { resolvedRequest, resultResource } = signalPair;
        untracked(() => {
            const current = resolvedRequest();
            if (stableStringify(current) !== requestKey) {
                resolvedRequest.set(resolved);
            }
        });
        return resultResource.value();
    };
    cacheService.httpConditionFunctionCache.set(cacheKey, fn);
    return fn;
}

/**
 * DI-scoped cache for async condition logic functions.
 *
 * Replaces module-scoped WeakMaps to ensure SSR safety.
 * Scoped to the DynamicForm component via `provideDynamicFormDI()`.
 *
 * Note: Per-field signal stores are closure-scoped per LogicFn, not shared here,
 * because multiple async conditions on the same field share the same FieldContext
 * reference and would collide in a shared WeakMap.
 */
class AsyncConditionFunctionCacheService {
    /** Cache for async condition logic functions, keyed by serialized condition. */
    asyncConditionFunctionCache = new Map();
}

/**
 * Creates a logic function for an async condition.
 *
 * Uses Angular's `rxResource()` API with snapshot composition for async resolution:
 * the LogicFn updates a `trigger` signal (serialized evaluation context), a debounced
 * version feeds into an `rxResource()` that manages the async function lifecycle, and
 * `withPreviousValue()` preserves the last resolved boolean during re-evaluation
 * to prevent UI flicker.
 *
 * Must be called in injection context (same as `createLogicFunction`).
 */
function createAsyncConditionLogicFunction(condition) {
    const fieldContextRegistry = inject(FieldContextRegistryService);
    const functionRegistry = inject(FunctionRegistryService);
    const injector = inject(Injector);
    const logger = inject(DynamicFormLogger);
    const cacheService = inject(AsyncConditionFunctionCacheService);
    const pendingValue = condition.pendingValue ?? false;
    const debounceMs = condition.debounceMs ?? 300;
    // Check function cache
    const cacheKey = stableStringify(condition);
    const cached = cacheService.asyncConditionFunctionCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    // Each condition needs its own per-field signal store.
    const perFunctionSignalStore = new Map();
    const fn = (ctx) => {
        const contextKey = safeReadPathKeys(ctx).join('.');
        let signalPair = perFunctionSignalStore.get(contextKey);
        if (!signalPair) {
            const trigger = signal(undefined, ...(ngDevMode ? [{ debugName: "trigger" }] : /* istanbul ignore next */ []));
            const ctxByTrigger = new Map();
            // Wrap in untracked() to avoid NG0602: resource() internally creates effects,
            // which cannot be created inside a reactive context (computed). The LogicFn runs
            // inside Angular Signal Forms' BooleanOrLogic.compute (a computed), so we must
            // clear the active reactive consumer before creating the resource pipeline.
            const resultResource = untracked(() => {
                // Debounce the trigger to batch rapid form value changes.
                const debouncedTrigger = derivedFromDeferred(trigger, pipe(debounceTime(debounceMs), distinctUntilChanged()), {
                    initialValue: undefined,
                    injector,
                });
                // rxResource() manages the async function lifecycle natively with Observables:
                // auto-cancellation via unsubscription and signal-based reactivity.
                const asyncResource = rxResource({
                    params: () => debouncedTrigger() ?? undefined,
                    stream: ({ params: triggerKey }) => {
                        // Look up the async function at call time (fresh reference)
                        const asyncFn = functionRegistry.getAsyncConditionFunction(condition.asyncFunctionName);
                        if (!asyncFn) {
                            logger.warn(`Async Condition - function '${condition.asyncFunctionName}' not found. ` +
                                `Register it in customFnConfig.asyncConditions.`);
                            return of(pendingValue);
                        }
                        // Retrieve the FieldContext that was captured when this trigger key was set.
                        // This avoids a race condition where a mutable ref could be overwritten by
                        // a later LogicFn call before the loader finishes executing.
                        const capturedCtx = ctxByTrigger.get(triggerKey);
                        if (!capturedCtx)
                            return of(pendingValue);
                        const evaluationContext = untracked(() => fieldContextRegistry.createReactiveEvaluationContext(capturedCtx, functionRegistry.getCustomFunctions()));
                        // asyncFn may return Promise<boolean> or Observable<boolean>.
                        // from() normalizes both to Observable.
                        return from(asyncFn(evaluationContext)).pipe(map((result) => !!result), catchError((error) => {
                            logger.warn('Async Condition - function failed:', error);
                            return of(pendingValue);
                        }));
                    },
                    defaultValue: pendingValue,
                    injector,
                });
                // Snapshot composition: preserve the previous boolean result during re-evaluation.
                // Without this, the condition would briefly flash to pendingValue when the async
                // function is re-invoked, causing visible UI flicker.
                return withPreviousValue(asyncResource);
            });
            signalPair = { trigger, resultResource, ctxByTrigger };
            perFunctionSignalStore.set(contextKey, signalPair);
        }
        // Build reactive evaluation context (creates signal dependencies on form values)
        const evaluationContext = fieldContextRegistry.createReactiveEvaluationContext(ctx, functionRegistry.getCustomFunctions());
        // Serialize evaluation context to detect changes
        const contextSnapshot = stableStringify({
            formValue: evaluationContext.formValue,
            fieldValue: evaluationContext.fieldValue,
            externalData: evaluationContext.externalData,
        });
        // Capture the FieldContext for this trigger key so the loader can retrieve it.
        // Only keep the latest — previous entries are stale once the trigger changes.
        const { trigger: triggerSignal, resultResource, ctxByTrigger } = signalPair;
        ctxByTrigger.clear();
        ctxByTrigger.set(contextSnapshot, ctx);
        untracked(() => {
            const current = triggerSignal();
            if (current !== contextSnapshot) {
                triggerSignal.set(contextSnapshot);
            }
        });
        return resultResource.value();
    };
    cacheService.asyncConditionFunctionCache.set(cacheKey, fn);
    return fn;
}

/**
 * DI-scoped cache for logic functions and debounced signals.
 *
 * Replaces module-scoped WeakMaps to ensure SSR safety.
 * Scoped to the DynamicForm component via `provideDynamicFormDI()`.
 */
class LogicFunctionCacheService {
    /** Cache for memoized logic functions, keyed by serialized expression. */
    logicFunctionCache = new Map();
    /** Cache for debounced logic functions, keyed by serialized expression + debounceMs. */
    debouncedLogicFunctionCache = new Map();
    /** Per-field signal store for debounced logic, keyed by field path. */
    debouncedSignalStore = new Map();
}

/**
 * Recursively validates that HTTP/async conditions are not nested inside and/or composites.
 * These conditions require async resolution and cannot be evaluated synchronously
 * inside composite conditions.
 */
function validateNoNestedHttpConditions(expression) {
    if (expression.type === 'and' || expression.type === 'or') {
        for (const sub of expression.conditions) {
            if (sub.type === 'http' || sub.type === 'async') {
                const label = sub.type === 'http' ? 'HTTP' : 'Async';
                throw new DynamicFormError(`${label} conditions cannot be nested inside '${expression.type}' composites. ` +
                    `Move the ${label} condition to a separate logic entry on the field.`);
            }
            validateNoNestedHttpConditions(sub);
        }
    }
}
/**
 * Create a logic function from a conditional expression.
 *
 * This function is used for creating logic functions for hidden, readonly, disabled, and required.
 * It uses the REACTIVE evaluation context, which allows the logic function to create
 * reactive dependencies on form values. When dependent fields change, the logic function
 * will be automatically re-evaluated.
 *
 * NOTE: For validators, use createEvaluationContext directly (with untracked) to prevent
 * infinite reactive loops. Validators with cross-field dependencies should be hoisted
 * to form-level using validateTree.
 *
 * @param expression The conditional expression to evaluate
 * @returns A LogicFn that evaluates the condition in the context of a field
 */
function createLogicFunction(expression) {
    // Async conditions handle their own debouncing and async resolution
    if (expression?.type === 'async') {
        return createAsyncConditionLogicFunction(expression);
    }
    // HTTP conditions handle their own debouncing and async resolution
    if (expression?.type === 'http') {
        return createHttpConditionLogicFunction(expression);
    }
    // Validate that HTTP conditions aren't nested inside and/or composites
    if (expression) {
        validateNoNestedHttpConditions(expression);
    }
    // Inject services during factory creation, not during execution
    const functionRegistry = inject(FunctionRegistryService);
    const fieldContextRegistry = inject(FieldContextRegistryService);
    const cacheService = inject(LogicFunctionCacheService);
    // Generate cache key from serialized expression
    const cacheKey = stableStringify(expression);
    // Check cache first
    const cached = cacheService.logicFunctionCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const fn = (ctx) => {
        // Create REACTIVE evaluation context for logic functions
        // This allows logic to re-evaluate when dependent fields change
        const evaluationContext = fieldContextRegistry.createReactiveEvaluationContext(ctx, functionRegistry.getCustomFunctions());
        return evaluateCondition(expression, evaluationContext);
    };
    // Cache the function
    cacheService.logicFunctionCache.set(cacheKey, fn);
    return fn;
}
/**
 * Create a debounced logic function from a conditional expression.
 *
 * This function wraps the condition evaluation in a debounce mechanism,
 * so state changes only take effect after the specified delay.
 * Useful for avoiding UI flicker during rapid typing.
 *
 * @param expression The conditional expression to evaluate
 * @param debounceMs The debounce duration in milliseconds
 * @returns A LogicFn that evaluates the condition with debouncing
 */
function createDebouncedLogicFunction(expression, debounceMs) {
    // Async conditions handle their own debouncing via condition.debounceMs
    if (expression?.type === 'async') {
        return createAsyncConditionLogicFunction(expression);
    }
    // HTTP conditions handle their own debouncing via condition.http.debounceMs
    if (expression?.type === 'http') {
        return createHttpConditionLogicFunction(expression);
    }
    // Validate that HTTP conditions aren't nested inside and/or composites
    if (expression) {
        validateNoNestedHttpConditions(expression);
    }
    // Inject services during factory creation, not during execution
    const functionRegistry = inject(FunctionRegistryService);
    const fieldContextRegistry = inject(FieldContextRegistryService);
    const injector = inject(Injector);
    const cacheService = inject(LogicFunctionCacheService);
    // Generate cache key including debounceMs
    const cacheKey = `${stableStringify(expression)}:${debounceMs}`;
    // Check cache first
    const cached = cacheService.debouncedLogicFunctionCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const fn = (ctx) => {
        const contextKey = safeReadPathKeys(ctx).join('.');
        let signalPair = cacheService.debouncedSignalStore.get(contextKey);
        if (!signalPair) {
            // Create a signal to hold the immediate evaluation result
            const immediateValue = signal(false, ...(ngDevMode ? [{ debugName: "immediateValue" }] : /* istanbul ignore next */ []));
            // Wrap in untracked() to avoid NG0602: toObservable() internally calls effect(),
            // which cannot be created inside a reactive context (computed). The LogicFn runs
            // inside Angular Signal Forms' BooleanOrLogic.compute (a computed).
            const debouncedValue = untracked(() => {
                const immediateValue$ = toObservable(immediateValue, { injector }).pipe(debounceTime(debounceMs), distinctUntilChanged(), startWith(false));
                return toSignal(immediateValue$, { injector, initialValue: false });
            });
            signalPair = { immediateValue, debouncedValue };
            cacheService.debouncedSignalStore.set(contextKey, signalPair);
        }
        // Create REACTIVE evaluation context for logic functions
        const evaluationContext = fieldContextRegistry.createReactiveEvaluationContext(ctx, functionRegistry.getCustomFunctions());
        // Evaluate the condition and update the immediate signal
        const result = evaluateCondition(expression, evaluationContext);
        // Update immediate value (this triggers the debounce chain)
        // signalPair is guaranteed to exist here due to the initialization above
        const { immediateValue, debouncedValue } = signalPair;
        untracked(() => {
            if (immediateValue() !== result) {
                immediateValue.set(result);
            }
        });
        // Return the debounced value
        return debouncedValue() ?? false;
    };
    // Cache the function
    cacheService.debouncedLogicFunctionCache.set(cacheKey, fn);
    return fn;
}

/**
 * DI-scoped cache for dynamic value functions.
 *
 * Replaces module-scoped WeakMap to ensure SSR safety.
 * Scoped to the DynamicForm component via `provideDynamicFormDI()`.
 */
class DynamicValueFunctionCacheService {
    /** Cache for memoized dynamic value functions, keyed by expression string. */
    dynamicValueFunctionCache = new Map();
}

/**
 * Create a dynamic value function from an expression string.
 * Uses secure AST-based parsing.
 *
 * @param expression The expression string to evaluate
 * @returns A LogicFn that evaluates the expression in the context of a field
 */
function createDynamicValueFunction(expression) {
    // Inject services during factory creation, not during execution
    // This captures the service instance in the closure
    const fieldContextRegistry = inject(FieldContextRegistryService);
    const logger = inject(DynamicFormLogger);
    const cacheService = inject(DynamicValueFunctionCacheService);
    // Check cache first
    const cached = cacheService.dynamicValueFunctionCache.get(expression);
    if (cached) {
        return cached;
    }
    const fn = (ctx) => {
        // Create evaluation context using the registry-based approach
        const evaluationContext = fieldContextRegistry.createEvaluationContext(ctx);
        try {
            // Use secure AST-based expression parser (already has LRU cache)
            return ExpressionParser.evaluate(expression, evaluationContext);
        }
        catch (error) {
            logger.error('Error evaluating dynamic expression:', expression, error);
            return undefined;
        }
    };
    // Cache the function
    cacheService.dynamicValueFunctionCache.set(expression, fn);
    return fn;
}

function applyEmailValidator(path) {
    email(path);
}
function applyMinValidator(path, value, expression) {
    if (expression) {
        min(path, createDynamicValueFunction(expression));
    }
    else {
        min(path, value);
    }
}
function applyMaxValidator(path, value, expression) {
    if (expression) {
        max(path, createDynamicValueFunction(expression));
    }
    else {
        max(path, value);
    }
}
function applyMinLengthValidator(path, value, expression) {
    if (expression) {
        minLength(path, createDynamicValueFunction(expression));
    }
    else {
        minLength(path, value);
    }
}
function applyMaxLengthValidator(path, value, expression) {
    if (expression) {
        maxLength(path, createDynamicValueFunction(expression));
    }
    else {
        maxLength(path, value);
    }
}
function applyPatternValidator(path, value, expression) {
    if (expression) {
        pattern(path, createDynamicValueFunction(expression));
    }
    else {
        pattern(path, value);
    }
}
function createConditionalLogic(when) {
    return when ? createLogicFunction(when) : undefined;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic forms require any at the Angular API boundary
function applyValidator(config, fieldPath) {
    const path = fieldPath;
    if (!isResourceBasedValidator(config) && (isCrossFieldBuiltInValidator(config) || hasCrossFieldWhenCondition(config))) {
        return;
    }
    switch (config.type) {
        case 'required':
            if (config.when) {
                required(path, { when: createLogicFunction(config.when) });
            }
            else {
                required(path);
            }
            break;
        case 'email':
            applyEmailValidator(fieldPath);
            break;
        case 'min':
            if (typeof config.value === 'number') {
                applyMinValidator(fieldPath, config.value, config.expression);
            }
            break;
        case 'max':
            if (typeof config.value === 'number') {
                applyMaxValidator(fieldPath, config.value, config.expression);
            }
            break;
        case 'minLength':
            if (typeof config.value === 'number') {
                applyMinLengthValidator(fieldPath, config.value, config.expression);
            }
            break;
        case 'maxLength':
            if (typeof config.value === 'number') {
                applyMaxLengthValidator(fieldPath, config.value, config.expression);
            }
            break;
        case 'pattern':
            if (config.value instanceof RegExp || typeof config.value === 'string') {
                let regexPattern;
                if (typeof config.value === 'string') {
                    try {
                        regexPattern = new RegExp(config.value);
                    }
                    catch (e) {
                        throw new DynamicFormError(`Invalid regex pattern in validator: '${config.value}' — ${e instanceof Error ? e.message : String(e)}`);
                    }
                }
                else {
                    regexPattern = config.value;
                }
                applyPatternValidator(fieldPath, regexPattern, config.expression);
            }
            break;
        case 'custom':
            applyCustomValidator(config, path);
            break;
        case 'async':
            applyAsyncValidator(config, path);
            break;
        case 'http':
            applyUnifiedHttpValidator(config, path);
            break;
    }
}
function applyCustomValidator(config, fieldPath) {
    if (isCrossFieldValidator(config)) {
        return;
    }
    let validatorFn;
    if (config.expression) {
        validatorFn = createExpressionValidator(config);
    }
    else if (config.functionName) {
        validatorFn = createFunctionValidator(config);
    }
    else {
        const logger = inject(DynamicFormLogger);
        logger.warn('Custom validator must have either "expression" or "functionName"');
        return;
    }
    const whenLogic = createConditionalLogic(config.when);
    validate(fieldPath, (ctx) => {
        if (whenLogic && !whenLogic(ctx))
            return null;
        return validatorFn(ctx);
    });
}
function createFunctionValidator(config) {
    const logger = inject(DynamicFormLogger);
    const functionName = config.functionName;
    if (!functionName) {
        logger.warn('Custom validator missing functionName');
        return () => null;
    }
    const registry = inject(FunctionRegistryService);
    const validatorFn = registry.getValidator(functionName);
    if (!validatorFn) {
        throw new DynamicFormError(`Custom validator "${functionName}" not found. Register it with customFnConfig.validators.`);
    }
    return (ctx) => validatorFn(ctx, config.params);
}
function createExpressionValidator(config) {
    const logger = inject(DynamicFormLogger);
    const expression = config.expression;
    if (!expression) {
        logger.warn('Custom validator missing expression');
        return () => null;
    }
    const fieldContextRegistry = inject(FieldContextRegistryService);
    const functionRegistry = inject(FunctionRegistryService);
    return (ctx) => {
        try {
            const evaluationContext = fieldContextRegistry.createEvaluationContext(ctx, functionRegistry.getCustomFunctions());
            const result = ExpressionParser.evaluate(expression, evaluationContext);
            if (result) {
                return null;
            }
            const kind = config.kind || 'custom';
            const validationError = { kind };
            if (config.errorParams) {
                Object.entries(config.errorParams).forEach(([key, expression]) => {
                    try {
                        validationError[key] = ExpressionParser.evaluate(expression, evaluationContext);
                    }
                    catch (err) {
                        logger.warn(`Error evaluating errorParam "${key}":`, expression, err);
                    }
                });
            }
            return validationError;
        }
        catch (error) {
            // Gracefully degrade on errors (e.g., typos in field names, undefined functions)
            // Log for debugging while keeping form functional
            logger.error('Error evaluating custom validator expression:', expression, error);
            return { kind: config.kind || 'custom' };
        }
    };
}
/**
 * Apply async validator to field path using Angular's public validateAsync() API
 *
 * Angular's validateAsync uses the resource API, which requires:
 * - params: Function that computes params from field context
 * - factory: Function that creates ResourceRef from params signal
 * - onSuccess: Maps resource result to validation errors
 * - onError: Optional handler for resource errors
 */
function applyAsyncValidator(config, fieldPath) {
    const registry = inject(FunctionRegistryService);
    const validatorConfig = registry.getAsyncValidator(config.functionName);
    if (!validatorConfig) {
        throw new DynamicFormError(`Async validator "${config.functionName}" not found. Register it with customFnConfig.asyncValidators.`);
    }
    const whenLogic = createConditionalLogic(config.when);
    const asyncOptions = {
        params: (ctx) => {
            if (whenLogic && !whenLogic(ctx))
                return undefined;
            return validatorConfig.params(ctx, config.params);
        },
        factory: validatorConfig.factory,
        onSuccess: validatorConfig.onSuccess,
        onError: validatorConfig.onError,
    };
    validateAsync(fieldPath, asyncOptions);
}
/**
 * Unified handler for `type: 'http'` — discriminates between function-based and declarative
 * based on property presence.
 */
function applyUnifiedHttpValidator(config, fieldPath) {
    if (isFunctionHttpValidator(config)) {
        applyFunctionHttpValidator(config, fieldPath);
    }
    else {
        applyDeclarativeHttpValidator(config, fieldPath);
    }
}
/**
 * Apply function-based HTTP validator to field path using Angular's public validateHttp() API.
 *
 * Angular's validateHttp requires:
 * - request: Function that returns URL string or HttpResourceRequest
 * - onSuccess: Maps HTTP response to validation errors (inverted logic!)
 * - onError: Optional handler for HTTP errors
 */
function applyFunctionHttpValidator(config, fieldPath) {
    const registry = inject(FunctionRegistryService);
    const httpValidatorConfig = registry.getHttpValidator(config.functionName);
    if (!httpValidatorConfig) {
        throw new DynamicFormError(`HTTP validator "${config.functionName}" not found. Register it with customFnConfig.httpValidators.`);
    }
    const whenLogic = createConditionalLogic(config.when);
    const httpOptions = {
        request: (ctx) => {
            if (whenLogic && !whenLogic(ctx))
                return undefined;
            return httpValidatorConfig.request(ctx, config.params);
        },
        onSuccess: httpValidatorConfig.onSuccess,
        onError: httpValidatorConfig.onError,
    };
    validateHttp(fieldPath, httpOptions);
}
/**
 * Apply declarative HTTP validator — fully JSON-serializable, no function registration needed.
 *
 * Uses `resolveHttpRequest` to build the request from expressions and `evaluateHttpValidationResponse`
 * to map the HTTP response to a validation result.
 */
function applyDeclarativeHttpValidator(config, fieldPath) {
    const fieldContextRegistry = inject(FieldContextRegistryService);
    const functionRegistry = inject(FunctionRegistryService);
    const logger = inject(DynamicFormLogger);
    const whenLogic = createConditionalLogic(config.when);
    validateHttp(fieldPath, {
        request: (ctx) => {
            if (whenLogic && !whenLogic(ctx))
                return undefined;
            // Use createReactiveEvaluationContext (not createEvaluationContext) because
            // validateHttp's request runs inside Angular's resource API — it NEEDS reactive
            // dependencies to re-trigger when the field value changes.
            const evalCtx = fieldContextRegistry.createReactiveEvaluationContext(ctx, functionRegistry.getCustomFunctions());
            // resolveHttpRequest returns null when a path param is undefined — convert to undefined to skip validation
            return resolveHttpRequest(config.http, evalCtx) ?? undefined;
        },
        onSuccess: (response) => {
            return evaluateHttpValidationResponse(response, config.responseMapping, logger);
        },
        onError: (error) => {
            logger.warn('HTTP validator request failed:', error);
            return { kind: config.responseMapping.errorKind };
        },
    });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic forms require any at the Angular API boundary
function applyValidators(configs, fieldPath) {
    configs.forEach((config) => applyValidator(config, fieldPath));
}

/**
 * Extracts the trigger from a StateLogicConfig, handling the discriminated union.
 */
function getConfigTrigger(config) {
    if (!isStateLogicConfig(config)) {
        return 'onChange';
    }
    return config.trigger ?? 'onChange';
}
/**
 * Extracts debounceMs from a StateLogicConfig if trigger is 'debounced'.
 */
function getConfigDebounceMs(config) {
    if (!isStateLogicConfig(config)) {
        return undefined;
    }
    // Type narrowing: debounceMs only exists when trigger is 'debounced'
    if (config.trigger === 'debounced') {
        return config.debounceMs;
    }
    return undefined;
}
function applyLogic(config, fieldPath) {
    // Value derivations (including property derivations via targetProperty) are handled by their orchestrators — skip them.
    if (isDerivationLogicConfig(config))
        return;
    // Guard against unrecognized logic types that may be added in the future.
    if (!isStateLogicConfig(config)) {
        if (isDevMode()) {
            console.warn(`[Dynamic Forms] Unrecognized logic config type '${config.type}' in applyLogic. ` +
                'This config will be ignored. If this is a new logic type, ensure it is handled explicitly.');
        }
        return;
    }
    const path = fieldPath;
    const trigger = getConfigTrigger(config);
    const debounceMs = getConfigDebounceMs(config) ?? DEFAULT_DEBOUNCE_MS;
    if (typeof config.condition === 'boolean') {
        applyLogicFn(config.type, path, () => config.condition);
        return;
    }
    // Create appropriate logic function based on trigger
    const logicFn = trigger === 'debounced'
        ? createDebouncedLogicFunction(config.condition, debounceMs)
        : createLogicFunction(config.condition);
    applyLogicFn(config.type, path, logicFn);
}
function applyLogicFn(type, path, logicFn) {
    switch (type) {
        case 'hidden':
            hidden(path, logicFn);
            break;
        case 'readonly':
            readonly(path, logicFn);
            break;
        case 'disabled':
            disabled(path, logicFn);
            break;
        case 'required':
            required(path, { when: logicFn });
            break;
        default: {
            const _exhaustive = type;
            throw new DynamicFormError(`Unhandled state logic type: ${_exhaustive}`);
        }
    }
}
function applyMultipleLogic(configs, fieldPath) {
    configs.forEach((config) => applyLogic(config, fieldPath));
}

/**
 * Create a type predicate function from a predicate string.
 *
 * Uses the secure ExpressionParser with whitelist-based evaluation instead of
 * dynamic code execution. This provides security through:
 * - AST-based parsing (no code execution)
 * - Whitelisted operators only
 * - Whitelisted methods only (Array.isArray, typeof, instanceof, etc.)
 * - No access to global scope beyond whitelisted constructors
 *
 * @param predicate - A JavaScript expression that evaluates to boolean. The value to check is available as `value`.
 * @param logger - Logger for error reporting
 * @returns A type predicate function
 *
 * @example
 * createTypePredicateFunction('typeof value === "string"')
 * createTypePredicateFunction('Array.isArray(value)')
 * createTypePredicateFunction('value instanceof Date')
 */
function createTypePredicateFunction(predicate, logger) {
    return (value) => {
        try {
            // Evaluate using secure AST-based parser with value in scope
            const result = ExpressionParser.evaluate(predicate, { value });
            return Boolean(result);
        }
        catch (error) {
            logger.error('Error evaluating type predicate:', predicate, error);
            return false;
        }
    };
}

/**
 * Apply schema configuration.
 * Accepts both SchemaPath and SchemaPathTree for flexibility.
 *
 * Note: We cast fieldPath to suppress TypeScript's union type errors. This is safe because:
 * 1. We only use signal forms (not AbstractControl), so SchemaPathTree is always the supported branch
 * 2. The Angular apply functions accept SchemaPath with any value type
 * 3. The actual schema application happens at runtime via the schema function
 */
function applySchema(config, fieldPath) {
    const logger = inject(DynamicFormLogger);
    const schemaRegistry = inject(SchemaRegistryService);
    const schema = schemaRegistry.resolveSchema(config.schema);
    if (!schema) {
        const availableSchemas = Array.from(schemaRegistry.getAllSchemas().keys()).join(', ') || '<none>';
        logger.error(`Schema not found: '${config.schema}'. ` +
            `Available schemas: ${availableSchemas}. ` +
            `Ensure the schema is registered in your schema registry.`);
        return;
    }
    const schemaFn = createSchemaFunction(schema);
    // Cast to suppress union type errors - safe because we only use signal forms (see function docs)
    const path = fieldPath;
    switch (config.type) {
        case 'apply':
            apply(path, schemaFn);
            break;
        case 'applyWhen':
            if (config.condition) {
                const conditionFn = createLogicFunction(config.condition);
                applyWhen(path, conditionFn, schemaFn);
            }
            break;
        case 'applyWhenValue':
            if (config.typePredicate) {
                const predicate = createTypePredicateFunction(config.typePredicate, logger);
                applyWhenValue(path, predicate, schemaFn);
            }
            break;
        case 'applyEach':
            applyEach(path, schemaFn);
            break;
    }
}
/**
 * Create a schema function from schema definition.
 *
 * Schema functions receive SchemaPathTree which includes both the base SchemaPath
 * and nested child access properties. The validator/logic/schema application functions
 * accept SchemaPath | SchemaPathTree, so we can pass the path directly.
 */
function createSchemaFunction(schema) {
    return (path) => {
        // Apply validators - path is SchemaPathTree which is accepted by applyValidator
        schema.validators?.forEach((validatorConfig) => {
            applyValidator(validatorConfig, path);
        });
        // Apply logic - path is SchemaPathTree which is accepted by applyLogic
        schema.logic?.forEach((logicConfig) => {
            applyLogic(logicConfig, path);
        });
        // Apply sub-schemas - path is SchemaPathTree which is accepted by applySchema
        schema.subSchemas?.forEach((subSchemaConfig) => {
            applySchema(subSchemaConfig, path);
        });
    };
}

/**
 * Applies string-specific validators to a schema path.
 * This function is properly typed - no casts needed internally.
 */
function applyStringValidators(path, config) {
    if (config.email) {
        email(path);
    }
    if (config.minLength !== undefined) {
        minLength(path, config.minLength);
    }
    if (config.maxLength !== undefined) {
        maxLength(path, config.maxLength);
    }
    if (config.pattern) {
        let regex;
        if (typeof config.pattern === 'string') {
            try {
                regex = new RegExp(config.pattern);
            }
            catch (e) {
                throw new DynamicFormError(`Invalid regex pattern: '${config.pattern}' — ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        else {
            regex = config.pattern;
        }
        pattern(path, regex);
    }
}
/**
 * Applies number-specific validators to a schema path.
 * This function is properly typed - no casts needed internally.
 */
function applyNumberValidators(path, config) {
    if (config.min !== undefined) {
        min(path, config.min);
    }
    if (config.max !== undefined) {
        max(path, config.max);
    }
}
/**
 * Extracts string validation config from a field definition.
 * Returns undefined if no string validators are configured.
 */
function getStringValidationConfig(fieldDef) {
    if (!fieldDef.email && fieldDef.minLength === undefined && fieldDef.maxLength === undefined && !fieldDef.pattern) {
        return undefined;
    }
    return {
        email: fieldDef.email,
        minLength: fieldDef.minLength,
        maxLength: fieldDef.maxLength,
        pattern: fieldDef.pattern,
    };
}
/**
 * Extracts number validation config from a field definition.
 * Handles both 'min'/'max' (standard) and 'minValue'/'maxValue' (SliderField).
 * Returns undefined if no number validators are configured.
 */
function getNumberValidationConfig(fieldDef) {
    const minVal = fieldDef.min ?? fieldDef.minValue;
    const maxVal = fieldDef.max ?? fieldDef.maxValue;
    if (minVal === undefined && maxVal === undefined) {
        return undefined;
    }
    return { min: minVal, max: maxVal };
}
/**
 * Maps a field definition to the Angular Signal Forms schema.
 *
 * This is the main entry point that should be called from the dynamic form component.
 * It handles all field types: leaf fields, containers (page, row, group), and arrays.
 *
 * Cross-field logic (formValue.*) is handled automatically by createLogicFunction
 * which uses RootFormRegistryService.
 *
 * Cross-field validators are skipped at field level and applied at form level via validateTree.
 */
function mapFieldToForm(fieldDef, fieldPath) {
    // Layout containers (page, row, container) - flatten children to current level
    if (isPageField(fieldDef) || isRowField(fieldDef) || isContainerTypedField(fieldDef)) {
        mapContainerChildren(fieldDef.fields, fieldPath);
        return;
    }
    // Group fields - map children under the group's path
    if (isGroupField(fieldDef)) {
        mapContainerChildren(fieldDef.fields, fieldPath);
        return;
    }
    // Array fields - use applyEach for item schema
    if (isArrayField(fieldDef)) {
        mapArrayFieldToForm(fieldDef, fieldPath);
        return;
    }
    // Leaf field - apply validation, logic, and configuration
    mapLeafField(fieldDef, fieldPath);
}
/**
 * Maps children of a container field (page, row, group) to the form schema.
 */
function mapContainerChildren(fields, parentPath) {
    if (!fields)
        return;
    const pathRecord = parentPath;
    for (const field of fields) {
        if (!field.key)
            continue;
        const childPath = pathRecord[field.key];
        if (childPath) {
            mapFieldToForm(field, childPath);
        }
    }
}
/**
 * Maps a leaf field (value-bearing field) to the form schema.
 */
function mapLeafField(fieldDef, fieldPath) {
    const validationField = fieldDef;
    const path = fieldPath;
    // Apply simple validation rules from field properties
    applySimpleValidationRules(validationField, path);
    if (validationField.validators) {
        for (const config of validationField.validators) {
            applyValidator(config, fieldPath);
        }
    }
    // Apply logic rules
    if (validationField.logic) {
        for (const config of validationField.logic) {
            applyLogic(config, fieldPath);
        }
    }
    // Apply schemas
    if (validationField.schemas) {
        for (const config of validationField.schemas) {
            applySchema(config, fieldPath);
        }
    }
    // Apply field state configuration
    applyFieldState(fieldDef, path);
}
/**
 * Applies simple validation rules from field properties.
 * Casts are isolated to the boundary between untyped field definitions and typed validator functions.
 */
function applySimpleValidationRules(fieldDef, path) {
    if (fieldDef.required) {
        required(path);
    }
    // String validators - single cast at boundary
    const stringConfig = getStringValidationConfig(fieldDef);
    if (stringConfig) {
        applyStringValidators(path, stringConfig);
    }
    // Number validators - single cast at boundary
    const numberConfig = getNumberValidationConfig(fieldDef);
    if (numberConfig) {
        applyNumberValidators(path, numberConfig);
    }
}
/**
 * Applies field state configuration (disabled, readonly, hidden).
 */
function applyFieldState(fieldDef, path) {
    if (fieldDef.disabled) {
        disabled(path);
    }
    if (fieldDef.readonly) {
        readonly(path);
    }
    if (fieldDef.hidden) {
        hidden(path, () => true);
    }
}
/**
 * Maps an array field to the form schema using applyEach.
 *
 * Supports two item formats:
 * - Primitive items: single FieldDef (not wrapped in array) → primitive value schema
 * - Object items: FieldDef[] (array of fields) → object schema with field keys
 *
 * Supports:
 * - Empty arrays (fields: []) - no initial items, add via buttons
 * - Primitive arrays - simple value lists like ['tag1', 'tag2']
 * - Object arrays - structured items like [{ name: 'Alice', email: '...' }]
 * - Heterogeneous arrays - mixed primitives and objects
 * - Container templates (row, group, page) that wrap children
 */
function mapArrayFieldToForm(arrayField, fieldPath) {
    if (!isArrayField(arrayField)) {
        return;
    }
    // Apply array-level length validation
    if (arrayField.minLength !== undefined) {
        minLength(fieldPath, arrayField.minLength);
    }
    if (arrayField.maxLength !== undefined) {
        maxLength(fieldPath, arrayField.maxLength);
    }
    // Fields can be either FieldDef (primitive) or FieldDef[] (object)
    const itemDefinitions = arrayField.fields;
    // Empty array is valid - items will be added via buttons with their own templates
    // Create a minimal schema that just accepts any value
    if (!itemDefinitions || itemDefinitions.length === 0) {
        const emptyItemSchema = schema(() => {
            // No fields to map - items will be added dynamically via buttons
        });
        applyEach(fieldPath, emptyItemSchema);
        return;
    }
    // Analyze item definitions to determine schema type
    let hasPrimitiveItems = false;
    const allObjectFields = [];
    for (const itemDef of itemDefinitions) {
        if (!Array.isArray(itemDef)) {
            // Primitive item: single FieldDef
            hasPrimitiveItems = true;
        }
        else {
            // Object item: collect fields for superset schema
            collectFieldsFromObjectItem(itemDef, allObjectFields);
        }
    }
    // For pure primitive arrays, use a simple schema
    if (hasPrimitiveItems && allObjectFields.length === 0) {
        const primitiveItemSchema = schema(() => {
            // Primitive items don't need field mapping - just accept any value
        });
        applyEach(fieldPath, primitiveItemSchema);
        return;
    }
    // For object or mixed arrays, use object schema with optional fields
    // Mixed arrays use the superset of all object fields (primitive items are just values)
    const itemSchema = schema((itemPath) => {
        const pathRecord = itemPath;
        // Map ALL unique template fields from all object items
        for (const templateField of allObjectFields) {
            if (isRowField(templateField) || isPageField(templateField) || isContainerTypedField(templateField)) {
                // Row/page/container templates flatten their children
                mapContainerChildren(templateField.fields, itemPath);
            }
            else if (isGroupField(templateField)) {
                // Group template - access group's path first
                const groupKey = templateField.key;
                if (groupKey) {
                    const groupPath = pathRecord[groupKey];
                    if (groupPath) {
                        mapContainerChildren(templateField.fields, groupPath);
                    }
                }
                else {
                    // No group key - apply children directly (edge case)
                    mapContainerChildren(templateField.fields, itemPath);
                }
            }
            else {
                // Simple field template - get the specific field's path
                const fieldKey = templateField.key;
                if (fieldKey) {
                    const fieldPathForKey = pathRecord[fieldKey];
                    if (fieldPathForKey) {
                        mapFieldToForm(templateField, fieldPathForKey);
                    }
                }
            }
        }
    });
    applyEach(fieldPath, itemSchema);
}
/**
 * Collects unique field definitions from an object item template.
 * Uses field key as the uniqueness identifier.
 * When the same key appears in multiple templates, uses the first occurrence.
 */
function collectFieldsFromObjectItem(itemFields, allFields) {
    const seenKeys = new Set(allFields.map((f) => f.key).filter(Boolean));
    for (const field of itemFields) {
        // For row/page/container fields, we need to collect their children's keys
        if (isRowField(field) || isPageField(field) || isContainerTypedField(field)) {
            // Use a synthetic key for container fields to dedupe them
            const containerKey = `__container_${field.type}_${JSON.stringify(field.fields?.map((f) => f.key))}`;
            if (!seenKeys.has(containerKey)) {
                seenKeys.add(containerKey);
                allFields.push(field);
            }
        }
        else {
            const key = field.key;
            if (key && !seenKeys.has(key)) {
                seenKeys.add(key);
                allFields.push(field);
            }
        }
    }
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
const FIELD_REGISTRY = new InjectionToken('FIELD_REGISTRY', {
    providedIn: 'root',
    factory: () => new Map(),
});
/**
 * Gets the value handling mode for a specific field type from the registry.
 *
 * @param fieldType - The field type identifier
 * @param registry - The field type registry
 * @returns The value handling mode ('include' is the default if not specified)
 */
function getFieldValueHandling(fieldType, registry) {
    const definition = registry.get(fieldType);
    return definition?.valueHandling ?? 'include';
}

/**
 * Generates appropriate default values for different field types in dynamic forms.
 *
 * Uses registry configuration to determine how each field type should handle values.
 * Supports exclude/flatten/include modes based on field type registration.
 *
 * @param field - Field definition to generate default value for
 * @param registry - Field type registry for value handling configuration
 * @returns Appropriate default value based on field type and configuration
 *
 * @example
 * ```typescript
 * // Basic input field defaults to empty string
 * getFieldDefaultValue({ type: 'input', key: 'email' }, registry); // ''
 *
 * // Excluded fields (like text/row) return undefined
 * getFieldDefaultValue({ type: 'text', key: 'label' }, registry); // undefined
 *
 * // Group field returns object with child defaults
 * getFieldDefaultValue({
 *   type: 'group',
 *   key: 'address',
 *   fields: [
 *     { type: 'input', key: 'street' },
 *     { type: 'input', key: 'city', value: 'New York' }
 *   ]
 * }, registry); // { street: '', city: 'New York' }
 * ```
 */
function getFieldDefaultValue(field, registry) {
    const valueHandling = getFieldValueHandling(field.type, registry);
    // Fields with 'exclude' handling don't contribute values
    if (valueHandling === 'exclude') {
        return undefined;
    }
    // Flatten fields (row/page) return flattened object of children's values
    // This is used by array fields to get the template structure
    // Note: fieldsToDefaultValues will skip these at top-level since they have keys and return objects
    if (valueHandling === 'flatten' && 'fields' in field && field.fields) {
        const childFields = field.fields;
        // Collect only fields that contribute values (exclude buttons, text, etc.)
        const flattenedValues = {};
        for (const childField of childFields) {
            if ('key' in childField && childField.key) {
                const childValue = getFieldDefaultValue(childField, registry);
                if (childValue !== undefined) {
                    flattenedValues[childField.key] = childValue;
                }
            }
        }
        // Return flattened object if there are any values, otherwise undefined
        return Object.keys(flattenedValues).length > 0 ? flattenedValues : undefined;
    }
    // Group fields with 'include' handling create nested objects
    if (field.type === 'group' && 'fields' in field) {
        const fields = field.fields;
        if (!fields || fields.length === 0) {
            return undefined;
        }
        const groupDefaults = {};
        for (const childField of fields) {
            const childValueHandling = getFieldValueHandling(childField.type, registry);
            // Flatten row/page fields into the group (they are presentational containers)
            if (childValueHandling === 'flatten' && 'fields' in childField && childField.fields) {
                const nestedFields = childField.fields;
                for (const nestedField of nestedFields) {
                    if ('key' in nestedField && nestedField.key) {
                        const nestedValue = getFieldDefaultValue(nestedField, registry);
                        if (nestedValue !== undefined) {
                            groupDefaults[nestedField.key] = nestedValue;
                        }
                    }
                }
            }
            else if ('key' in childField && childField.key) {
                const childValue = getFieldDefaultValue(childField, registry);
                if (childValue !== undefined) {
                    groupDefaults[childField.key] = childValue;
                }
            }
        }
        return groupDefaults;
    }
    // Use explicit value if provided, with type-specific handling for null
    if ('value' in field) {
        // If value is explicitly set (even to null/undefined), respect it
        if (field.value !== null && field.value !== undefined) {
            return field.value;
        }
        // Handle explicit null: use type-specific default
        if (field.value === null) {
            return field.type === 'checkbox' ? false : '';
        }
        // Handle explicit undefined: fall through to type-specific defaults
    }
    // Type-specific defaults when no value is specified
    if (field.type === 'checkbox') {
        return false;
    }
    if (field.type === 'array') {
        // Array field supports two item formats:
        // - Primitive items: single FieldDef (not wrapped in array) → extracts field value directly
        // - Object items: FieldDef[] (array of fields) → merges fields into object
        const arrayField = field;
        const itemDefinitions = arrayField.fields;
        if (!itemDefinitions || itemDefinitions.length === 0) {
            return [];
        }
        // Process each item definition
        return itemDefinitions.map((itemDef) => {
            // Primitive item: single FieldDef (not wrapped in array)
            // Extract field value directly - key is for internal tracking only
            if (!Array.isArray(itemDef)) {
                return getFieldDefaultValue(itemDef, registry);
            }
            // Object item: FieldDef[] - merge fields into object
            const itemFields = itemDef;
            let itemValue = {};
            for (const templateField of itemFields) {
                const fieldValue = getFieldDefaultValue(templateField, registry);
                const fieldValueHandling = getFieldValueHandling(templateField.type, registry);
                if (templateField.type === 'group' && 'key' in templateField && templateField.key) {
                    // Groups wrap their value under the group key
                    itemValue[templateField.key] = fieldValue;
                }
                else if (templateField.type === 'row' || templateField.type === 'container') {
                    // Rows and containers flatten their fields directly
                    if (fieldValue && typeof fieldValue === 'object') {
                        itemValue = { ...itemValue, ...fieldValue };
                    }
                }
                else if (fieldValueHandling === 'include' && 'key' in templateField && templateField.key) {
                    itemValue[templateField.key] = fieldValue;
                }
            }
            return itemValue;
        });
    }
    // Number inputs need a number type default for Angular signal forms
    // to use valueAsNumber for coercion. NaN is ideal because:
    // - typeof NaN === 'number' (triggers Angular's valueAsNumber path)
    // - NaN displays as empty in number inputs
    // - valueAsNumber returns NaN when input is cleared
    if (field.type === 'input' && 'props' in field) {
        const props = field.props;
        if (props?.type === 'number') {
            return NaN;
        }
    }
    return '';
}

/**
 * Applies a form-level schema validation to a schema path.
 * Supports both Standard Schema (Zod, Valibot, ArkType) and raw Angular schema callbacks.
 *
 * This is a helper function used internally by `createSchemaFromFields`
 * to apply form-level validation after field-level validation.
 *
 * @typeParam TModel - The form value type
 * @param path - The schema path to validate (from Angular's schema callback)
 * @param formLevelSchema - Form-level schema (Standard Schema marker or Angular callback)
 *
 * @remarks
 * Type assertions are required due to Angular's complex generic constraints:
 * - `validateStandardSchema` uses `IgnoreUnknownProperties<TSchema>` to accommodate Zod's strict types
 * - `SchemaPathTree` includes `SchemaPath` via conditional types that TypeScript can't narrow
 * These assertions are safe because the path originates from Angular's schema() function.
 *
 * @internal
 */
function applyFormLevelSchema(path, formLevelSchema) {
    if (isStandardSchemaMarker(formLevelSchema)) {
        // Standard Schema (Zod, Valibot, ArkType, etc.)
        // Cast via Parameters: validateStandardSchema's IgnoreUnknownProperties<TSchema> creates type incompatibility
        // that TypeScript cannot resolve. The cast is safe as path comes from Angular's schema() callback.
        validateStandardSchema(path, formLevelSchema.schema);
    }
    else if (typeof formLevelSchema === 'function') {
        // Angular schema callback - execute directly with the path
        // Cast via Function: AngularSchemaCallback expects intersection type SchemaPath & SchemaPathTree.
        // SchemaPathTree structurally includes SchemaPath, so this is safe at runtime.
        formLevelSchema(path);
    }
}
/**
 * Creates a schema from only form-level schema (when no field-level schema exists).
 *
 * Use this when the form has fields without validation rules but still
 * needs form-level validation via a Standard Schema.
 *
 * @typeParam TModel - The form value type
 * @param formLevelSchema - Form-level Standard Schema
 * @returns Schema that applies form-level validation
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { standardSchema } from '@ng-forge/dynamic-forms/schema';
 *
 * const FormSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * });
 *
 * // Create schema from form-level schema only
 * const formSchema = createFormLevelSchema(standardSchema(FormSchema));
 * ```
 */
function createFormLevelSchema(formLevelSchema) {
    return schema((path) => {
        applyFormLevelSchema(path, formLevelSchema);
    });
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * Gets a FieldTree by key, supporting nested paths with dot notation.
 *
 * @example
 * getFieldTreeByKey(ctx, 'address.street') // Returns FieldTree for nested 'street' field
 */
function getFieldTreeByKey(ctx, key) {
    // Simple case - no nesting
    if (!key.includes('.')) {
        return ctx.fieldTree[key];
    }
    // Nested path - traverse through the structure
    const parts = key.split('.');
    let current = ctx.fieldTree;
    for (const part of parts) {
        // FieldTree is callable (function), so typeof returns 'function' not 'object'.
        // Accept both to correctly traverse group sub-fields.
        if (!current || (typeof current !== 'object' && typeof current !== 'function')) {
            return undefined;
        }
        current = current[part];
    }
    return current;
}
/**
 * Creates an Angular signal forms schema from field definitions
 * This is the single entry point at dynamic form level that replaces createSchemaFromFields
 * Uses the new modular signal forms adapter structure
 *
 * Cross-field logic (formValue.*) is handled automatically by createLogicFunction
 * which uses RootFormRegistryService. No special context needed.
 *
 * Cross-field validators are passed directly and applied at form level using validateTree.
 *
 * @param fields Field definitions to create schema from
 * @param registry Field type registry
 * @param optionsOrValidators Optional configuration object or array of cross-field validators (for backwards compatibility)
 */
function createSchemaFromFields(fields, registry, optionsOrValidators) {
    // Inject services for cross-field validation
    // These will be available because createSchemaFromFields is called within runInInjectionContext
    const functionRegistry = inject(FunctionRegistryService);
    const logger = inject(DynamicFormLogger);
    // Normalize options - support both old array signature and new options object
    const options = Array.isArray(optionsOrValidators)
        ? { crossFieldValidators: optionsOrValidators }
        : (optionsOrValidators ?? {});
    const { crossFieldValidators, formLevelSchema } = options;
    return schema((path) => {
        for (const fieldDef of fields) {
            const valueHandling = getFieldValueHandling(fieldDef.type, registry);
            // Handle different value handling modes
            if (valueHandling === 'exclude') {
                // Skip fields that don't contribute to form values
                continue;
            }
            if (valueHandling === 'flatten' && hasChildFields(fieldDef)) {
                for (const childField of normalizeFieldsArray(fieldDef.fields)) {
                    if (!childField.key)
                        continue;
                    const childPath = path[childField.key];
                    if (childPath) {
                        mapFieldToForm(childField, childPath);
                    }
                }
                continue;
            }
            // Regular field processing for 'include' fields
            const fieldPath = path[fieldDef.key];
            if (!fieldPath) {
                continue;
            }
            // Use the new modular form mapping function
            // This will progressively apply validators, logic, and schemas
            // Cross-field logic is handled automatically via RootFormRegistryService
            mapFieldToForm(fieldDef, fieldPath);
        }
        // Apply cross-field validators using validateTree
        if (crossFieldValidators && crossFieldValidators.length > 0) {
            applyCrossFieldTreeValidator(path, crossFieldValidators, functionRegistry, logger);
        }
        // Apply form-level Standard Schema validation
        if (formLevelSchema) {
            applyFormLevelSchema(path, formLevelSchema);
        }
    });
}
/**
 * Applies cross-field validators using Angular's validateTree API.
 *
 * This is the key integration point that routes cross-field validation errors
 * to the appropriate target fields via Angular's form state system.
 *
 * The validateTree function allows returning errors with a `fieldTree` property
 * that targets specific fields, which Angular automatically routes to those
 * fields' errors() signal.
 *
 * Supports two types of hoisted validators:
 * 1. Custom validators with cross-field expressions (e.g., `formValue.password === formValue.confirmPassword`)
 * 2. Built-in validators with cross-field `when` conditions (e.g., `required` when `country === 'USA'`)
 *
 * @param rootPath The root schema path tree
 * @param validators Array of collected cross-field validators
 * @param functionRegistry Registry containing custom functions for expression evaluation
 * @param logger Logger for error reporting
 */
function applyCrossFieldTreeValidator(rootPath, validators, functionRegistry, logger) {
    // Get custom functions for expression evaluation
    const customFunctions = functionRegistry.getCustomFunctions();
    validateTree(rootPath, (ctx) => {
        if (validators.length === 0) {
            return null; // ValidationSuccess - no errors
        }
        // Read form value reactively - don't wrap in untracked() so Angular can track dependencies
        const formValue = ctx.value();
        const errors = [];
        for (const entry of validators) {
            const { sourceFieldKey, config } = entry;
            try {
                const error = evaluateCrossFieldValidator(entry, formValue, sourceFieldKey, ctx, customFunctions, logger);
                if (error) {
                    errors.push(error);
                }
            }
            catch (err) {
                logger.error(`Error evaluating cross-field validator for ${sourceFieldKey}:`, err);
                // On error, add a validation error to indicate the failure
                const targetField = getFieldTreeByKey(ctx, sourceFieldKey);
                if (targetField) {
                    const customConfig = config;
                    errors.push({
                        kind: customConfig.kind || config.type || 'custom',
                        fieldTree: targetField,
                    });
                }
            }
        }
        return errors.length > 0 ? errors : null;
    });
}
/**
 * Evaluates a single cross-field validator entry and returns an error if validation fails.
 */
function evaluateCrossFieldValidator(entry, formValue, sourceFieldKey, ctx, customFunctions, logger) {
    const { config } = entry;
    const fieldValue = getNestedValue(formValue, sourceFieldKey);
    // Create evaluation context for condition/expression evaluation
    const evaluationContext = {
        fieldValue,
        formValue,
        fieldPath: sourceFieldKey,
        customFunctions,
        logger,
    };
    // Check if this is a custom validator (with expression) or a built-in validator (with when condition)
    if (config.type === 'custom') {
        return evaluateCustomCrossFieldValidator(config, evaluationContext, sourceFieldKey, ctx);
    }
    else {
        // Built-in validator with cross-field when condition
        return evaluateBuiltInCrossFieldValidator(config, evaluationContext, sourceFieldKey, ctx);
    }
}
/**
 * Evaluates a custom cross-field validator with an expression.
 */
function evaluateCustomCrossFieldValidator(config, evaluationContext, sourceFieldKey, ctx) {
    if (!config.expression) {
        return null;
    }
    const { fieldValue, formValue, logger, customFunctions } = evaluationContext;
    // First, evaluate the when condition if present
    // If the condition is false, the validator doesn't apply (validation passes)
    if (config.when) {
        const conditionMet = evaluateCondition(config.when, {
            fieldValue,
            formValue,
            fieldPath: sourceFieldKey,
            customFunctions: customFunctions || {},
            logger,
        });
        if (!conditionMet) {
            return null; // Condition not met, skip validation
        }
    }
    // Evaluate expression using the secure AST parser
    const result = ExpressionParser.evaluate(config.expression, evaluationContext);
    // If expression returns truthy, validation passes (no error)
    if (result) {
        return null;
    }
    // Validation failed - create error targeting the source field
    const targetField = getFieldTreeByKey(ctx, sourceFieldKey);
    if (!targetField) {
        evaluationContext.logger.warn(`Cross-field validator references non-existent field "${sourceFieldKey}"`);
        return null;
    }
    const errorObj = {
        kind: config.kind || 'custom',
        fieldTree: targetField,
    };
    // Evaluate and include errorParams for message interpolation
    if (config.errorParams) {
        for (const [key, expression] of Object.entries(config.errorParams)) {
            try {
                errorObj[key] = ExpressionParser.evaluate(expression, evaluationContext);
            }
            catch (error) {
                evaluationContext.logger.warn(`Failed to evaluate error param expression "${key}": ${expression}`, error);
            }
        }
    }
    return errorObj;
}
/**
 * Evaluates a built-in validator with a cross-field when condition.
 * First checks the when condition, then applies the built-in validation logic.
 */
function evaluateBuiltInCrossFieldValidator(config, evaluationContext, sourceFieldKey, ctx) {
    const { fieldValue, formValue, logger, customFunctions } = evaluationContext;
    // First, evaluate the when condition
    // If the condition is false, the validator doesn't apply (validation passes)
    if (config.when) {
        const conditionMet = evaluateCondition(config.when, {
            fieldValue,
            formValue,
            fieldPath: sourceFieldKey,
            customFunctions: customFunctions || {},
            logger,
        });
        if (!conditionMet) {
            return null; // Condition not met, skip validation
        }
    }
    // Now apply the built-in validation logic based on the validator type
    const isValid = applyBuiltInValidationLogic(config, fieldValue);
    if (isValid) {
        return null; // Validation passed
    }
    // Validation failed - create error targeting the source field
    const targetField = getFieldTreeByKey(ctx, sourceFieldKey);
    if (!targetField) {
        logger.warn(`Cross-field validator references non-existent field "${sourceFieldKey}"`);
        return null;
    }
    return {
        kind: config.type,
        fieldTree: targetField,
    };
}
/**
 * Applies built-in validation logic based on the validator type.
 * Returns true if validation passes, false if it fails.
 */
function applyBuiltInValidationLogic(config, fieldValue) {
    switch (config.type) {
        case 'required':
            // Required: value must be non-null, non-undefined, and non-empty string
            if (fieldValue === null || fieldValue === undefined) {
                return false;
            }
            if (typeof fieldValue === 'string' && fieldValue.trim() === '') {
                return false;
            }
            return true;
        case 'min':
            // Min: numeric value must be >= min
            if (fieldValue === null || fieldValue === undefined) {
                return true; // Empty values pass min validation (use required for emptiness)
            }
            if ('value' in config && typeof config.value === 'number') {
                return fieldValue >= config.value;
            }
            return true;
        case 'max':
            // Max: numeric value must be <= max
            if (fieldValue === null || fieldValue === undefined) {
                return true;
            }
            if ('value' in config && typeof config.value === 'number') {
                return fieldValue <= config.value;
            }
            return true;
        case 'minLength':
            // MinLength: string length must be >= minLength
            if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
                return true;
            }
            if ('value' in config && typeof config.value === 'number') {
                return String(fieldValue).length >= config.value;
            }
            return true;
        case 'maxLength':
            // MaxLength: string length must be <= maxLength
            if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
                return true;
            }
            if ('value' in config && typeof config.value === 'number') {
                return String(fieldValue).length <= config.value;
            }
            return true;
        case 'email':
            // Email: must match email pattern
            if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
                return true;
            }
            return emailPattern.test(String(fieldValue));
        case 'pattern':
            // Pattern: must match regex pattern
            if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
                return true;
            }
            if ('value' in config && config.value) {
                const regex = config.value instanceof RegExp ? config.value : new RegExp(String(config.value));
                return regex.test(String(fieldValue));
            }
            return true;
        default:
            // Unknown validator type, consider valid
            return true;
    }
}
/**
 * Utility to convert field definitions to default values object
 */
function fieldsToDefaultValues(fields, registry) {
    const defaultValues = {};
    for (const field of fields) {
        if (!field.key)
            continue;
        // Skip flatten fields (row/page) at top level - they are presentational containers
        const valueHandling = getFieldValueHandling(field.type, registry);
        if (valueHandling === 'flatten') {
            continue;
        }
        const value = getFieldDefaultValue(field, registry);
        if (value !== undefined) {
            defaultValues[field.key] = value;
        }
    }
    return defaultValues;
}

/** Creates an empty cross-field collection. */
function createEmptyCollection() {
    return {
        validators: [],
        logic: [],
        schemas: [],
    };
}
/** Traverses field definitions and collects cross-field entries (validators, logic, schemas). */
function collectCrossFieldEntries(fields) {
    const collection = createEmptyCollection();
    traverseFields(fields, collection, '');
    return collection;
}
function traverseFields(fields, collection, pathPrefix) {
    for (const field of fields) {
        collectFromField(field, collection, pathPrefix);
        // Recursively process container fields (page, row, group, array)
        if (hasChildFields(field)) {
            // Groups add their key to the path prefix; page/row/array are transparent —
            // their children are still traversed, but those containers don't contribute a
            // key segment. Arrays are transparent rather than skipped because array items
            // use dynamic indices that aren't statically knowable, so no path prefix can
            // be built for them.
            const groupKey = isGroupField(field) ? field.key : undefined;
            const childPrefix = groupKey ? (pathPrefix ? `${pathPrefix}.${groupKey}` : groupKey) : pathPrefix;
            traverseFields(normalizeFieldsArray(field.fields), collection, childPrefix);
        }
    }
}
function collectFromField(field, collection, pathPrefix) {
    const fieldKey = field.key;
    if (!fieldKey)
        return;
    const fullKey = pathPrefix ? `${pathPrefix}.${fieldKey}` : fieldKey;
    const validationField = field;
    // Collect cross-field validators
    if (validationField.validators) {
        for (const config of validationField.validators) {
            const entry = tryCreateValidatorEntry(fullKey, config);
            if (entry) {
                collection.validators.push(entry);
            }
        }
    }
    // Collect cross-field logic
    if (validationField.logic) {
        for (const config of validationField.logic) {
            const entry = tryCreateLogicEntry(fullKey, config);
            if (entry) {
                collection.logic.push(entry);
            }
        }
    }
    // Collect cross-field schemas
    if (validationField.schemas) {
        for (const config of validationField.schemas) {
            const entry = tryCreateSchemaEntry(fullKey, config);
            if (entry) {
                collection.schemas.push(entry);
            }
        }
    }
}
/** Returns a validator entry if cross-field, null otherwise. */
function tryCreateValidatorEntry(fieldKey, config) {
    // Check for custom validators with cross-field expressions
    if (config.type === 'custom') {
        const customConfig = config;
        if (isCrossFieldValidator(customConfig)) {
            return {
                sourceFieldKey: fieldKey,
                config,
                dependsOn: extractStringDependencies(customConfig.expression || ''),
                category: 'validator',
            };
        }
    }
    // Check for built-in validators with cross-field dynamic expressions
    if (isCrossFieldBuiltInValidator(config)) {
        const builtInConfig = config;
        return {
            sourceFieldKey: fieldKey,
            config: convertBuiltInToCustomValidator(builtInConfig),
            validatorType: config.type,
            dependsOn: extractStringDependencies(builtInConfig.expression || ''),
            category: 'validator',
        };
    }
    // Check for validators with cross-field when conditions
    if (hasCrossFieldWhenCondition(config)) {
        const whenCondition = config.when;
        return {
            sourceFieldKey: fieldKey,
            config,
            validatorType: config.type,
            dependsOn: extractExpressionDependencies(whenCondition),
            category: 'validator',
        };
    }
    return null;
}
/**
 * Returns a logic entry if cross-field state logic, null otherwise.
 *
 * Note: Derivation logic is handled separately by the derivation system
 * and is not collected here.
 */
function tryCreateLogicEntry(fieldKey, config) {
    // Only process state logic (hidden, readonly, disabled, required)
    // Derivation logic is handled by the derivation collector
    if (!isStateLogicConfig(config)) {
        return null;
    }
    if (!isCrossFieldStateLogic(config)) {
        return null;
    }
    const condition = config.condition;
    return {
        sourceFieldKey: fieldKey,
        logicType: config.type,
        condition,
        config: config,
        dependsOn: extractExpressionDependencies(condition),
        category: 'logic',
    };
}
/** Returns a schema entry if cross-field, null otherwise. */
function tryCreateSchemaEntry(fieldKey, config) {
    if (!isCrossFieldSchema(config)) {
        return null;
    }
    const condition = config.condition;
    return {
        sourceFieldKey: fieldKey,
        config,
        condition,
        dependsOn: extractExpressionDependencies(condition),
        category: 'schema',
    };
}
/** Converts a built-in validator with cross-field expression to a custom validator. */
function convertBuiltInToCustomValidator(config) {
    const expression = config.expression;
    if (!expression) {
        throw new DynamicFormError(`Built-in validator ${config.type} missing required expression for cross-field conversion`);
    }
    let validationExpression;
    switch (config.type) {
        case 'min':
            validationExpression = `fieldValue == null || fieldValue >= (${expression})`;
            break;
        case 'max':
            validationExpression = `fieldValue == null || fieldValue <= (${expression})`;
            break;
        case 'minLength':
            validationExpression = `fieldValue == null || (typeof fieldValue !== 'string' && !Array.isArray(fieldValue)) || fieldValue.length >= (${expression})`;
            break;
        case 'maxLength':
            validationExpression = `fieldValue == null || (typeof fieldValue !== 'string' && !Array.isArray(fieldValue)) || fieldValue.length <= (${expression})`;
            break;
        case 'pattern':
            // Validate regex pattern before injection to prevent runtime errors
            try {
                new RegExp(expression);
            }
            catch (e) {
                throw new DynamicFormError(`Invalid regex pattern in cross-field validator: '${expression}' — ${e instanceof Error ? e.message : String(e)}`);
            }
            validationExpression = `fieldValue == null || new RegExp(${JSON.stringify(expression)}).test(fieldValue)`;
            break;
        default:
            throw new DynamicFormError(`Cannot convert ${config.type} validator to custom validator`);
    }
    return {
        type: 'custom',
        expression: validationExpression,
        kind: config.type,
        when: config.when,
        errorParams: {
            [config.type]: expression,
        },
    };
}

/**
 * Flattens a hierarchical field structure into a linear array for form processing.
 *
 * Handles different field types with specific flattening strategies:
 * - **Page fields**: Children are flattened and merged into the result (no wrapper)
 * - **Row fields**: Children are flattened and merged into the result (no wrapper), unless preserveRows=true
 * - **Group fields**: Maintains group structure with flattened children nested under the group key
 * - **Array fields**: Maintains array structure with flattened children nested under the array key
 * - **Other fields**: Pass through unchanged with guaranteed key generation
 *
 * Auto-generates keys for fields missing the key property to ensure form binding works correctly.
 *
 * @param fields - Array of field definitions that may contain nested structures
 * @param registry - Field type registry for determining value handling behavior
 * @param options - Configuration options for flattening behavior
 * @param options.preserveRows - When true, keep row fields in structure for DOM rendering (grid layout)
 * @returns Flattened array of field definitions with guaranteed keys
 *
 * @example
 * ```typescript
 * const hierarchicalFields = [
 *   {
 *     type: 'row',
 *     fields: [
 *       { type: 'input', key: 'firstName' },
 *       { type: 'input', key: 'lastName' }
 *     ]
 *   },
 *   {
 *     type: 'group',
 *     key: 'address',
 *     fields: [
 *       { type: 'input', key: 'street' },
 *       { type: 'input', key: 'city' }
 *     ]
 *   }
 * ];
 *
 * const flattened = flattenFields(hierarchicalFields, registry);
 * // Result: [
 * //   { type: 'input', key: 'firstName' },
 * //   { type: 'input', key: 'lastName' },
 * //   { type: 'group', key: 'address', fields: [...] }
 * // ]
 * ```
 *
 * @example
 * ```typescript
 * // Auto-key generation for fields without keys
 * const fieldsWithoutKeys = [
 *   { type: 'input', label: 'Name' },
 *   { type: 'button', label: 'Submit' }
 * ];
 *
 * const flattened = flattenFields(fieldsWithoutKeys, registry);
 * // Result: [
 * //   { type: 'input', label: 'Name', key: 'auto_field_0' },
 * //   { type: 'button', label: 'Submit', key: 'auto_field_1' }
 * // ]
 * ```
 *
 * @public
 */
function flattenFields(fields, registry, options = {}) {
    const result = [];
    let autoKeyCounter = 0;
    // Process each field using appropriate strategy based on field type and configuration
    for (const field of fields) {
        // Step 1: Determine how this field type should handle its value in the form
        // valueHandling can be: 'include', 'exclude', or 'flatten'
        const valueHandling = getFieldValueHandling(field.type, registry);
        // Step 2: Check if this is a row or container field that should be preserved for DOM rendering
        // Row fields need to render their container element for grid layouts to work
        // Container fields need to render their container for the wrapper chain
        if (options.preserveRows && (isRowField(field) || isContainerTypedField(field))) {
            if (field.fields) {
                // Recursively flatten children while preserving row structure
                const flattenedChildren = flattenFields(normalizeFieldsArray(field.fields), registry, options);
                // Keep the row/container field in the result with its flattened children
                // This allows the container component to render while children are flattened
                const autoPrefix = isRowField(field) ? 'auto_row' : 'auto_container';
                result.push({
                    ...field,
                    fields: flattenedChildren,
                    key: field.key || `${autoPrefix}_${autoKeyCounter++}`,
                });
            }
        }
        else if (valueHandling === 'flatten' && 'fields' in field) {
            // Step 3: Handle fields with 'flatten' value handling (typically page/row fields)
            // These fields are pure containers - merge their children directly into the parent level
            if (field.fields) {
                const fields = field.fields;
                const flattenedChildren = flattenFields(normalizeFieldsArray(fields), registry, options);
                // Spread children directly into result - the container field itself is discarded
                // This is used for page fields (form structure) and row fields (form values)
                result.push(...flattenedChildren);
            }
        }
        else if (isGroupField(field)) {
            // Step 4: Handle group fields - preserve structure for nested form values
            // Group fields create a nested object in the form value: { groupKey: { field1: value1, ... } }
            const childFieldsArray = Object.values(field.fields);
            const flattenedChildren = flattenFields(childFieldsArray, registry, options);
            // Keep the group field with its recursively flattened children nested under its key
            result.push({
                ...field,
                fields: flattenedChildren,
                key: field.key || `auto_group_${autoKeyCounter++}`,
            });
        }
        else if (isArrayField(field)) {
            // Step 5: Handle array fields - preserve structure for array form values
            // Array fields create an array in the form value: { arrayKey: [item1, item2, ...] }
            // field.fields is ArrayItemDefinition[] — each item is either:
            // - ArrayAllowedChildren (primitive item) → preserved as single FlattenedField
            // - ArrayItemTemplate (readonly ArrayAllowedChildren[]) → flattened as FlattenedField[]
            //
            // IMPORTANT: Preserve the primitive/object distinction so getFieldDefaultValue
            // can produce flat values (['angular']) vs nested values ([{value: 'angular'}]).
            const flattenedItemTemplates = field.fields.map((itemDef) => {
                if (!Array.isArray(itemDef)) {
                    // Primitive item: single ArrayAllowedChildren → flatten, preserve non-array structure
                    const flattened = flattenFields([itemDef], registry, options);
                    return flattened[0];
                }
                // Object item: ArrayItemTemplate (field[]) → flatten all fields as array
                return flattenFields([...itemDef], registry, options);
            });
            // Keep the array field with its flattened item templates nested under its key
            result.push({
                ...field,
                fields: flattenedItemTemplates,
                key: field.key || `auto_array_${autoKeyCounter++}`,
            });
        }
        else {
            // Step 6: Handle all other fields (inputs, buttons, etc.) - pass through unchanged
            // These fields are leaf nodes that don't contain children and map directly to form controls
            const key = field.key || `auto_field_${autoKeyCounter++}`;
            result.push({
                ...field,
                key,
            });
        }
    }
    return result;
}

/**
 * Creates memoized field processing functions shared across container components.
 *
 * These functions are used by both `FormStateManager` and `GroupFieldComponent`
 * to compute flattened fields, field lookups, and default values from field definitions.
 *
 * @returns Object containing memoized processing functions
 */
function createContainerFieldProcessors() {
    const createFieldsResolver = (preserveRows = false) => (fields, registry) => {
        let key = '';
        for (const f of fields) {
            key += (f.key ?? '') + ':' + (f.type ?? '') + '|';
        }
        return key + registry.size + '|' + preserveRows;
    };
    const memoizedFlattenFields = memoize((fields, registry) => flattenFields([...fields], registry), {
        // registry.size is a valid cache key proxy because the field registry is populated
        // once at bootstrap and never mutated at runtime. If the registry were mutable,
        // we would need a content-based hash instead.
        resolver: createFieldsResolver(),
        maxSize: 10,
    });
    const memoizedFlattenFieldsForRendering = memoize((fields, registry) => flattenFields([...fields], registry, { preserveRows: true }), {
        // registry.size is a valid cache key proxy because the field registry is populated
        // once at bootstrap and never mutated at runtime. If the registry were mutable,
        // we would need a content-based hash instead.
        resolver: createFieldsResolver(true),
        maxSize: 10,
    });
    const memoizedKeyBy = memoize((fields) => keyBy(fields, 'key'), {
        resolver: (fields) => {
            let key = '';
            for (const f of fields) {
                key += f.key + '|';
            }
            return key;
        },
        maxSize: 10,
    });
    const memoizedDefaultValues = memoize((fieldsById, registry) => mapValues(fieldsById, (field) => getFieldDefaultValue(field, registry)), {
        // registry.size is a valid cache key proxy because the field registry is populated
        // once at bootstrap and never mutated at runtime.
        resolver: (fieldsById, registry) => {
            const keys = Object.keys(fieldsById).sort();
            return keys.join('|') + '|' + registry.size;
        },
        maxSize: 10,
    });
    return { memoizedFlattenFields, memoizedFlattenFieldsForRendering, memoizedKeyBy, memoizedDefaultValues };
}
/**
 * Shared container field processors injection token.
 *
 * Provided at the DynamicForm component level via `provideDynamicFormDI()` so one
 * form + all its nested groups share a single memoize cache, while different form
 * instances stay isolated.
 *
 * The `providedIn: 'root'` factory is a fallback only — it ensures tests and
 * standalone containers (e.g. a bare GroupFieldComponent in a unit test) can
 * resolve the token without an explicit provider. In a running application, the
 * component-level provider from `provideDynamicFormDI()` always shadows this root
 * instance, so each form gets its own isolated cache.
 *
 * @internal
 */
const CONTAINER_FIELD_PROCESSORS = new InjectionToken('CONTAINER_FIELD_PROCESSORS', {
    providedIn: 'root',
    factory: () => createContainerFieldProcessors(),
});

/**
 * Generates CSS class string for responsive grid layout based on field column configuration.
 *
 * Creates Bootstrap-style column classes for implementing responsive form layouts.
 * Validates column values to ensure they fall within the standard 12-column grid system.
 *
 * @param fieldDef - Field definition containing column configuration
 * @returns CSS class string for grid layout, empty if no valid column configuration
 *
 * @example
 * ```typescript
 * // Full width field
 * const fullWidth = getGridClassString({ type: 'input', key: 'name', col: 12 });
 * // Returns: 'df-col-12'
 *
 * // Half width field
 * const halfWidth = getGridClassString({ type: 'input', key: 'email', col: 6 });
 * // Returns: 'df-col-6'
 *
 * // Invalid column value
 * const invalid = getGridClassString({ type: 'input', key: 'phone', col: 15 });
 * // Returns: ''
 * ```
 *
 * @public
 */
function getGridClassString(fieldDef) {
    const col = fieldDef.col;
    if (typeof col === 'number' && Number.isInteger(col) && col > 0 && col <= 12) {
        return `df-col-${col}`;
    }
    return '';
}
/**
 * Builds a combined className string from a field definition.
 *
 * Combines user-provided className with generated grid classes into a single string.
 * Returns undefined if no classes are present (allowing conditional spreading in objects).
 *
 * @param fieldDef - Field definition containing className and col properties
 * @returns Combined class string, or undefined if no classes
 *
 * @example
 * ```typescript
 * // With both className and col
 * buildClassName({ key: 'test', type: 'group', className: 'my-class', col: 6 });
 * // Returns: 'df-col-6 my-class'
 *
 * // With only className
 * buildClassName({ key: 'test', type: 'group', className: 'my-class' });
 * // Returns: 'my-class'
 *
 * // With only col
 * buildClassName({ key: 'test', type: 'group', col: 6 });
 * // Returns: 'df-col-6'
 *
 * // With neither
 * buildClassName({ key: 'test', type: 'group' });
 * // Returns: undefined
 * ```
 *
 * @public
 */
function buildClassName(fieldDef) {
    const gridClass = getGridClassString(fieldDef);
    const userClass = fieldDef.className;
    const classes = [];
    if (gridClass) {
        classes.push(gridClass);
    }
    if (userClass) {
        classes.push(userClass);
    }
    return classes.length > 0 ? classes.join(' ') : undefined;
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
function buildBaseInputs(fieldDef, defaultProps) {
    const { key, label, className, tabIndex, props, meta } = fieldDef;
    const inputs = {};
    // Always include key - required by components for accessibility and identification
    inputs['key'] = key;
    if (label !== undefined) {
        inputs['label'] = label;
    }
    // Combine user className with generated grid classes
    const gridClassString = getGridClassString(fieldDef);
    const allClasses = [];
    if (gridClassString) {
        allClasses.push(gridClassString);
    }
    if (className) {
        allClasses.push(className);
    }
    if (allClasses.length > 0) {
        inputs['className'] = allClasses.join(' ');
    }
    if (tabIndex !== undefined) {
        inputs['tabIndex'] = tabIndex;
    }
    // Merge props: form-level defaultProps as base, field-level props override
    // Cast props to Record since it's typed as unknown but always represents an object at runtime
    const fieldProps = props;
    const mergedProps = fieldProps !== undefined || defaultProps !== undefined ? { ...(defaultProps ?? {}), ...(fieldProps ?? {}) } : undefined;
    if (mergedProps !== undefined) {
        inputs['props'] = mergedProps;
    }
    if (meta !== undefined) {
        inputs['meta'] = meta;
    }
    return inputs;
}
/**
 * Base field mapper that extracts common field properties into component inputs.
 *
 * Returns a Signal containing the Record of input names to values that will be
 * passed to ngComponentOutlet. The signal enables reactive updates.
 *
 * @param fieldDef The field definition to map
 * @returns Signal containing Record of input names to values
 */
function baseFieldMapper(fieldDef) {
    // For base mapper, inputs are static (no reactive dependencies)
    // Wrap in computed for consistency with the MapperFn type
    return computed(() => buildBaseInputs(fieldDef));
}

const EMPTY_OVERRIDES = Object.freeze({});
/**
 * Creates a new PropertyOverrideStore instance.
 *
 * @returns A fresh PropertyOverrideStore
 *
 * @public
 */
function createPropertyOverrideStore() {
    const store = new Map();
    const registeredFields = new Set();
    function getOrCreateSignal(fieldKey) {
        let existing = store.get(fieldKey);
        if (!existing) {
            existing = signal(EMPTY_OVERRIDES);
            store.set(fieldKey, existing);
        }
        return existing;
    }
    return {
        getOverrides(fieldKey) {
            return getOrCreateSignal(fieldKey);
        },
        setOverride(fieldKey, targetProperty, value) {
            const fieldSignal = getOrCreateSignal(fieldKey);
            const current = fieldSignal();
            if (value === undefined) {
                // Remove the property key
                if (!(targetProperty in current)) {
                    return; // Already absent, no-op
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { [targetProperty]: _, ...rest } = current;
                fieldSignal.set(Object.keys(rest).length === 0 ? EMPTY_OVERRIDES : rest);
            }
            else {
                // Set or update the property
                const currentValue = current[targetProperty];
                if (isEqual(currentValue, value)) {
                    return; // Value unchanged, no-op
                }
                fieldSignal.set({ ...current, [targetProperty]: value });
            }
        },
        registerField(fieldKey) {
            registeredFields.add(fieldKey);
        },
        hasField(fieldKey) {
            return registeredFields.has(fieldKey);
        },
        clear() {
            store.clear();
            registeredFields.clear();
        },
    };
}
/**
 * Injection token for the PropertyOverrideStore.
 *
 * @public
 */
const PROPERTY_OVERRIDE_STORE = new InjectionToken('PROPERTY_OVERRIDE_STORE');

/**
 * Known standard field properties where a missing key likely indicates a typo.
 * Override keys not in this set are assumed to be intentional dynamic properties
 * and will not trigger dev-mode warnings.
 */
const KNOWN_FIELD_PROPERTY_NAMES = [
    'label',
    'placeholder',
    'disabled',
    'readonly',
    'required',
    'className',
    'tabIndex',
    'validationMessages',
    'options',
    'props',
    'hint',
    'tooltip',
    'prefix',
    'suffix',
    'min',
    'max',
    'minLength',
    'maxLength',
    'step',
    'pattern',
    'rows',
    'cols',
    'multiple',
    'appearance',
];
const KNOWN_FIELD_PROPERTIES = new Set(KNOWN_FIELD_PROPERTY_NAMES);
/**
 * Applies property overrides to a field's input record.
 *
 * Supports dot-notation for nested properties (max 2 levels):
 * - Simple: `overrides['minDate']` → `inputs['minDate'] = value`
 * - Nested (1 dot): `overrides['props.appearance']` → `inputs.props.appearance = value`
 * - Deeper paths (2+ dots): throws DynamicFormError
 *
 * **Important:** Only simple (e.g., `'minDate'`) and single-nested (e.g., `'props.appearance'`)
 * paths are supported. Paths with 2+ dots will throw a `DynamicFormError` at runtime.
 * This is an architectural constraint — deeper nesting would require recursive cloning
 * and complicate the override merging strategy.
 *
 * Array-valued overrides replace wholesale (no merging).
 * Returns `inputs` unchanged if overrides is empty (no clone).
 *
 * In dev mode, warns when a known standard field property override key doesn't match
 * any existing input property, which may indicate a typo in the `targetProperty`
 * configuration. Dynamic/custom property keys are silently accepted.
 *
 * @param inputs - The current field inputs record
 * @param overrides - Record of property names to override values
 * @returns Updated inputs record with overrides applied
 *
 * @public
 */
function applyPropertyOverrides(inputs, overrides) {
    const keys = Object.keys(overrides);
    if (keys.length === 0) {
        return inputs;
    }
    const result = { ...inputs };
    for (const key of keys) {
        const value = overrides[key];
        const dotIndex = key.indexOf('.');
        // Dev-mode check: warn only when a known standard field property is missing from inputs,
        // which likely indicates a typo. Dynamic/custom keys are intentionally skipped to avoid
        // false positives for properties added by derivations that aren't in the initial config.
        if (isDevMode()) {
            const topLevelKey = dotIndex === -1 ? key : key.substring(0, dotIndex);
            if (KNOWN_FIELD_PROPERTIES.has(topLevelKey) && !(topLevelKey in inputs)) {
                console.warn(`[Dynamic Forms] Property override '${key}' does not match any existing input property. ` +
                    'This may indicate a typo in the targetProperty configuration. ' +
                    `Available properties: ${Object.keys(inputs).join(', ')}`);
            }
        }
        if (dotIndex === -1) {
            // Simple property: direct assignment
            result[key] = value;
        }
        else {
            // Nested property — split at first dot only
            const parentKey = key.substring(0, dotIndex);
            const childKey = key.substring(dotIndex + 1);
            // Validate max 2 levels (1 dot)
            if (childKey.includes('.')) {
                throw new DynamicFormError(`Property override path '${key}' exceeds maximum depth of 2 levels. ` +
                    `Only simple ('minDate') and single-nested ('props.appearance') paths are supported.`);
            }
            // Shallow-clone the parent object and set the child property
            const parentValue = result[parentKey];
            const clonedParent = parentValue && typeof parentValue === 'object' ? { ...parentValue } : {};
            clonedParent[childKey] = value;
            result[parentKey] = clonedParent;
        }
    }
    return result;
}

/**
 * Merges forwarded props into meta, with meta taking precedence.
 *
 * @param inputs The current inputs record
 * @param propsToMeta Array of prop keys to forward to meta
 * @returns Updated inputs record with merged meta
 */
function mergeForwardedPropsToMeta(inputs, propsToMeta) {
    const props = inputs['props'];
    if (!props || propsToMeta.length === 0) {
        return inputs;
    }
    // Extract values to forward from props
    // Values are typed as FieldMeta-compatible since they're forwarded attributes (type, rows, cols, etc.)
    const forwardedValues = {};
    for (const key of propsToMeta) {
        const value = props[key];
        if (value !== undefined && value !== null) {
            // Props being forwarded are known HTML attributes (string, number, boolean)
            forwardedValues[key] = value;
        }
    }
    // If nothing to forward, return inputs unchanged
    if (Object.keys(forwardedValues).length === 0) {
        return inputs;
    }
    // Merge: forwarded props first, then meta (meta wins)
    const existingMeta = inputs['meta'];
    const mergedMeta = {
        ...forwardedValues,
        ...existingMeta,
    };
    return {
        ...inputs,
        meta: mergedMeta,
    };
}
/**
 * Applies index suffix to the key property for array items.
 * This ensures unique DOM IDs while keeping form schema keys clean.
 *
 * @param inputs The current inputs record
 * @param index The array item index
 * @returns Updated inputs record with suffixed key
 */
function applyIndexSuffix(inputs, index) {
    const key = inputs['key'];
    if (typeof key !== 'string') {
        return inputs;
    }
    return {
        ...inputs,
        key: `${key}_${index}`,
    };
}
/**
 * Main field mapper function that uses the field registry to get the appropriate mapper
 * based on the field's type property.
 *
 * This function must be called within an injection context where FIELD_SIGNAL_CONTEXT
 * is provided, as mappers inject the context to access form state.
 *
 * For componentless fields (no loadComponent and no mapper), returns undefined
 * since there's no component to bind inputs to. Callers should check for undefined
 * and skip rendering logic for such fields.
 *
 * If the field type definition specifies `propsToMeta`, the specified props
 * will be merged into the meta object (with meta taking precedence).
 *
 * When running inside an array item context (ARRAY_CONTEXT is provided), the key
 * is automatically suffixed with the item index to ensure unique DOM IDs. The form
 * schema keys remain clean (unsuffixed) so derivations and validations work correctly.
 *
 * Property overrides from the PropertyOverrideStore are applied AFTER all static
 * mapper logic, so they always take precedence. Only fields with registered property
 * derivations incur the overhead of reading from the store.
 *
 * @param fieldDef The field definition to map
 * @param fieldRegistry The registry of field type definitions
 * @returns Signal containing Record of input names to values, or undefined for componentless fields
 */
function mapFieldToInputs(fieldDef, fieldRegistry) {
    // Get the field type definition from registry
    const fieldType = fieldRegistry.get(fieldDef.type);
    // Componentless field (no mapper and no loadComponent) - nothing to map
    if (fieldType && !fieldType.loadComponent && !fieldType.mapper) {
        return undefined;
    }
    // Check if we're inside an array item context - if so, we need to suffix keys
    // Optional because ARRAY_CONTEXT is only provided inside array item injectors
    const arrayContext = inject(ARRAY_CONTEXT, { optional: true });
    // Inject the property override store for property derivation overrides
    // Always available — provided at the DynamicForm component level via provideDynamicFormDI
    const store = inject(PROPERTY_OVERRIDE_STORE);
    // Get the base mapper result
    const mapperResult = fieldType?.mapper ? fieldType.mapper(fieldDef) : baseFieldMapper(fieldDef);
    const propsToMeta = fieldType?.propsToMeta;
    const hasPropsForwarding = propsToMeta && propsToMeta.length > 0;
    // Check that arrayContext exists and has a valid index signal (guards against mock injectors)
    const indexSignal = arrayContext?.index;
    const hasArrayContext = indexSignal !== undefined && isSignal(indexSignal);
    // Fast-path check for property overrides: only fields with registered derivations
    // enter the computed() wrapper for overrides. hasField() is a non-reactive Map.has() — O(1).
    // Uses PLACEHOLDER_INDEX to produce the wildcard format (e.g., 'items.$.endDate') matching
    // what the collector/orchestrator registers. The computed block below uses a concrete index instead.
    const hasOverrides = store?.hasField(buildPropertyOverrideKey(arrayContext?.arrayKey, arrayContext ? PLACEHOLDER_INDEX : undefined, fieldDef.key)) ?? false;
    // Fast path: no transformations needed
    if (!hasPropsForwarding && !hasArrayContext && !hasOverrides) {
        return mapperResult;
    }
    // Wrap in computed to apply transformations
    return computed(() => {
        let inputs = mapperResult();
        // Apply props forwarding if configured
        if (hasPropsForwarding) {
            inputs = mergeForwardedPropsToMeta(inputs, propsToMeta);
        }
        // Apply index suffix for array items
        if (hasArrayContext) {
            const index = indexSignal();
            inputs = applyIndexSuffix(inputs, index);
        }
        // Apply property overrides from the store (AFTER all static transformations)
        if (hasOverrides) {
            // Build the store key inside computed() so index signal read establishes reactive dependency
            // Safe to access arrayContext/indexSignal directly — hasArrayContext already confirmed they exist
            const key = hasArrayContext
                ? buildPropertyOverrideKey(arrayContext.arrayKey, indexSignal(), fieldDef.key)
                : fieldDef.key;
            const overrides = store.getOverrides(key)();
            inputs = applyPropertyOverrides(inputs, overrides);
        }
        return inputs;
    });
}

function createRenderReadySignal(inputs, definition) {
    const explicitRenderReadyWhen = definition?.renderReadyWhen;
    const requiredInputs = definition?.mapper && explicitRenderReadyWhen === undefined ? ['field'] : (explicitRenderReadyWhen ?? []);
    if (requiredInputs.length === 0) {
        return computed(() => true);
    }
    return computed(() => {
        const currentInputs = inputs();
        return requiredInputs.every((inputName) => currentInputs[inputName] !== undefined);
    });
}
/**
 * Resolves a single field definition to a ResolvedField using RxJS.
 * Loads the component asynchronously and maps inputs in the injection context.
 *
 * For componentless fields (e.g., hidden fields), returns undefined since
 * there's nothing to render. These fields still contribute to form values
 * through the form schema.
 *
 * @param fieldDef - The field definition to resolve
 * @param context - The context containing dependencies for resolution
 * @returns Observable that emits ResolvedField or undefined (for componentless fields or on error)
 */
function resolveField(fieldDef, context) {
    return from(context.loadTypeComponent(fieldDef.type)).pipe(map((component) => {
        // Check if component is destroyed before proceeding
        if (context.destroyRef.destroyed) {
            return undefined;
        }
        // Componentless fields (e.g., hidden) return undefined - nothing to render
        if (!component) {
            return undefined;
        }
        // Run mapper in injection context
        const inputs = runInInjectionContext(context.injector, () => mapFieldToInputs(fieldDef, context.registry));
        const definition = context.registry.get(fieldDef.type);
        // Fields with components should always have inputs (componentless fields are handled above)
        if (!inputs) {
            return undefined;
        }
        return {
            key: fieldDef.key,
            fieldDef,
            component,
            injector: context.injector,
            inputs,
            renderReady: createRenderReadySignal(inputs, definition),
        };
    }), catchError((error) => {
        // Only call onError if component is not destroyed to avoid accessing cleaned-up state
        if (!context.destroyRef.destroyed) {
            context.onError?.(fieldDef, error);
        }
        return of(undefined);
    }));
}
/**
 * Synchronously resolves a field definition to a ResolvedField using cached components.
 *
 * This is the fast path for fields whose components have already been loaded.
 * Returns undefined for componentless fields (e.g., hidden fields).
 *
 * @param fieldDef - The field definition to resolve
 * @param context - The context containing cached components and dependencies
 * @returns ResolvedField or undefined (for componentless fields)
 */
function resolveFieldSync(fieldDef, context) {
    const component = context.getLoadedComponent(fieldDef.type);
    if (!component) {
        return undefined;
    }
    const inputs = runInInjectionContext(context.injector, () => mapFieldToInputs(fieldDef, context.registry));
    const definition = context.registry.get(fieldDef.type);
    if (!inputs) {
        return undefined;
    }
    return {
        key: fieldDef.key,
        fieldDef,
        component,
        injector: context.injector,
        inputs,
        renderReady: createRenderReadySignal(inputs, definition),
    };
}
/**
 * Reconciles previous and current resolved fields to preserve injector instances
 * for fields that haven't changed type, preventing unnecessary component recreation.
 *
 * @param prev - Previous resolved fields array
 * @param curr - Current resolved fields array
 * @returns Reconciled fields with preserved injectors where applicable
 */
function reconcileFields(prev, curr) {
    const prevMap = new Map(prev.map((f) => [f.key, f]));
    return curr.map((field) => {
        const existing = prevMap.get(field.key);
        if (existing && existing.component === field.component && existing.injector === field.injector) {
            // Truly unchanged - preserve object identity for signal stability
            return existing;
        }
        // New field, type changed, or context changed (new injector) - use new field
        return field;
    });
}
/**
 * Creates an RxJS pipe for resolving field definitions to rendered components.
 * Used by container components (page, group) to resolve their child fields.
 */
function createFieldResolutionPipe(getContext) {
    return pipe(switchMap((fields) => {
        if (!fields || fields.length === 0) {
            return of([]);
        }
        const context = getContext();
        return forkJoin(fields.map((f) => resolveField(f, context)));
    }), map((fields) => fields.filter((f) => f !== undefined)), scan$1(reconcileFields, []));
}

/**
 * Comprehensive form configuration validator that checks:
 * 1. Form mode consistency (paged vs non-paged)
 * 2. Page nesting rules
 * 3. Row nesting rules (no hidden fields in rows)
 * 4. Field placement constraints
 */
class FormModeValidator {
    /**
     * Validates a form configuration and returns detailed validation results
     * @param fields The form field definitions to validate
     * @returns Validation result with mode detection and error details
     */
    static validateFormConfiguration(fields) {
        const modeDetection = detectFormMode(fields);
        const additionalErrors = [];
        // Additional validation for paged forms
        if (modeDetection.mode === 'paged' && modeDetection.isValid) {
            // Validate each page field individually
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                if (isPageField(field)) {
                    if (!validatePageNesting(field)) {
                        additionalErrors.push(`Page field at index ${i} (key: "${field.key || 'unknown'}") contains nested page fields, which is not allowed.`);
                    }
                }
            }
        }
        const allErrors = [...modeDetection.errors, ...additionalErrors];
        const isFullyValid = modeDetection.isValid && additionalErrors.length === 0;
        return {
            mode: modeDetection.mode,
            isValid: isFullyValid,
            errors: allErrors,
            warnings: this.generateWarnings(fields, modeDetection),
        };
    }
    /**
     * Validates form configuration and throws an error if invalid
     * @param fields The form field definitions to validate
     * @throws Error with detailed validation messages if form is invalid
     */
    static validateFormConfigurationOrThrow(fields) {
        const result = this.validateFormConfiguration(fields);
        if (!result.isValid) {
            const errorMessage = [`Invalid form configuration (${result.mode} mode):`, ...result.errors.map((error) => `  - ${error}`)].join('\n');
            throw new DynamicFormError(errorMessage);
        }
    }
    /**
     * Generates helpful warnings for form configurations
     * @param fields The form field definitions
     * @param modeDetection The mode detection result
     * @returns Array of warning messages
     */
    static generateWarnings(fields, modeDetection) {
        const warnings = [];
        // Warn about single page forms
        if (modeDetection.mode === 'paged' && fields.length === 1) {
            warnings.push('Single page form detected. Consider using non-paged mode for better performance if page navigation is not needed.');
        }
        // Warn about empty pages
        if (modeDetection.mode === 'paged') {
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                if (isPageField(field)) {
                    if (!field.fields || field.fields.length === 0) {
                        warnings.push(`Page field at index ${i} (key: "${field.key || 'unknown'}") contains no fields and will render as empty.`);
                    }
                }
            }
        }
        // Warn about hidden fields in rows (they work but don't render, which may be confusing)
        const rowWarnings = this.collectRowHiddenFieldWarnings(fields);
        warnings.push(...rowWarnings);
        return warnings;
    }
    /**
     * Recursively collects warnings for hidden fields inside rows
     * @param fields The form field definitions to check
     * @param path Current path for warning messages
     * @returns Array of warning messages
     */
    static collectRowHiddenFieldWarnings(fields, path = '') {
        if (!fields) {
            return [];
        }
        const warnings = [];
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            const fieldPath = path ? `${path}.fields[${i}]` : `fields[${i}]`;
            const fieldKey = field.key || 'unknown';
            if (isRowField(field)) {
                if (!validateRowNesting(field)) {
                    warnings.push(`Row field at ${fieldPath} (key: "${fieldKey}") contains hidden fields. ` +
                        `Hidden fields in rows don't render anything - consider placing them outside the row.`);
                }
                // Continue checking nested rows within the row's children
                warnings.push(...this.collectRowHiddenFieldWarnings(field.fields, fieldPath));
            }
            else if (isPageField(field)) {
                // Check rows within pages
                warnings.push(...this.collectRowHiddenFieldWarnings(field.fields, fieldPath));
            }
            else if (isGroupField(field)) {
                // Check rows within groups
                warnings.push(...this.collectRowHiddenFieldWarnings(field.fields, fieldPath));
            }
            else if (isSimplifiedArrayField(field)) {
                // Simplified arrays are normalized later; check template fields if present
                const templateFields = Array.isArray(field.template) ? [...field.template] : [field.template];
                warnings.push(...this.collectRowHiddenFieldWarnings(templateFields, fieldPath));
            }
            else if (isArrayField(field)) {
                // Check rows within array templates — items may be single FieldDef (primitive) or FieldDef[] (object)
                const itemTemplates = field.fields;
                for (let j = 0; j < itemTemplates.length; j++) {
                    const itemFields = itemTemplates[j];
                    const fieldsArray = Array.isArray(itemFields) ? [...itemFields] : [itemFields];
                    warnings.push(...this.collectRowHiddenFieldWarnings(fieldsArray, `${fieldPath}.fields[${j}]`));
                }
            }
        }
        return warnings;
    }
}
/**
 * Convenience function for quick form mode validation
 * @param fields The form field definitions to validate
 * @returns True if form configuration is valid, false otherwise
 */
function isValidFormConfiguration(fields) {
    return FormModeValidator.validateFormConfiguration(fields).isValid;
}

/**
 * Cache for resolved field type components.
 *
 * Using an InjectionToken with `providedIn: 'root'` ensures:
 * - SSR safety: Angular creates a fresh root injector per SSR request,
 *   so the cache is properly isolated and garbage-collected
 * - Shared across all `injectFieldRegistry()` calls within the same app/request
 *
 * @internal
 */
const COMPONENT_CACHE = new InjectionToken('COMPONENT_CACHE', {
    providedIn: 'root',
    factory: () => new Map(),
});
/**
 * Injection function for accessing the dynamic form field registry.
 *
 * Provides a convenient API for interacting with registered field types,
 * including type checking, component loading, and registration management.
 * Must be called within an injection context.
 *
 * @returns Object with methods for field registry interaction
 *
 * @example
 * ```typescript
 * @Component({...})
 * export class MyComponent {
 *   private fieldRegistry = injectFieldRegistry();
 *
 *   async loadCustomField() {
 *     if (this.fieldRegistry.hasType('custom-input')) {
 *       const component = await this.fieldRegistry.loadTypeComponent('custom-input');
 *       // Use component...
 *     }
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In a service
 * @Injectable()
 * export class FormBuilderService {
 *   private fieldRegistry = injectFieldRegistry();
 *
 *   getAvailableFieldTypes(): string[] {
 *     return this.fieldRegistry.getTypes().map(type => type.name);
 *   }
 * }
 * ```
 *
 * @public
 */
function injectFieldRegistry() {
    const registry = inject(FIELD_REGISTRY);
    const componentCache = inject(COMPONENT_CACHE);
    return {
        /**
         * Retrieves a field type definition by its registered name.
         *
         * @param name - The registered name of the field type
         * @returns The field type definition if found, undefined otherwise
         *
         * @example
         * ```typescript
         * const inputType = fieldRegistry.getType('input');
         * if (inputType) {
         *   console.log('Input field type found:', inputType.name);
         * }
         * ```
         */
        getType(name) {
            return registry.get(name);
        },
        /**
         * Checks if a field type is registered in the registry.
         *
         * @param name - The name of the field type to check
         * @returns True if the field type exists, false otherwise
         *
         * @example
         * ```typescript
         * if (fieldRegistry.hasType('custom-input')) {
         *   // Safe to use custom-input field type
         *   const component = await fieldRegistry.loadTypeComponent('custom-input');
         * }
         * ```
         */
        hasType(name) {
            return registry.has(name);
        },
        /**
         * Loads a field type component with support for lazy loading.
         *
         * Handles both synchronous component references and asynchronous
         * dynamic imports. Automatically extracts default exports from ES modules.
         *
         * Returns `undefined` for componentless field types (e.g., hidden fields)
         * that only contribute to form values without rendering UI.
         *
         * @param name - The name of the field type to load
         * @returns Promise resolving to the component constructor, or undefined for componentless fields
         * @throws {Error} When field type is not registered or loading fails
         *
         * @example
         * ```typescript
         * const component = await fieldRegistry.loadTypeComponent('input');
         * if (component) {
         *   const componentRef = vcr.createComponent(component);
         * }
         * // For componentless fields like 'hidden', component will be undefined
         * ```
         */
        async loadTypeComponent(name) {
            const fieldType = registry.get(name);
            if (!fieldType) {
                throw new DynamicFormError(`Field type "${name}" is not registered`);
            }
            // Componentless field types (e.g., hidden) don't have loadComponent
            if (!fieldType.loadComponent) {
                return undefined;
            }
            // Check cache first for instant resolution
            const cached = componentCache.get(name);
            if (cached) {
                return cached;
            }
            try {
                const component = resolveDefaultExport(await fieldType.loadComponent());
                if (component) {
                    componentCache.set(name, component);
                }
                return component;
            }
            catch (error) {
                throw new DynamicFormError(`Failed to load component for field type "${name}": ${error}`);
            }
        },
        /**
         * Returns a previously loaded component from cache, or undefined if not yet loaded.
         *
         * This enables synchronous field resolution for components that have already
         * been loaded (e.g., after first render). Returns undefined for:
         * - Components not yet loaded (first render)
         * - Componentless field types (e.g., hidden)
         * - Unregistered field types
         *
         * @param name - The name of the field type
         * @returns The cached component constructor, or undefined
         */
        getLoadedComponent(name) {
            return componentCache.get(name);
        },
        /**
         * Gets all registered field type definitions.
         *
         * @returns Array of all field type definitions in the registry
         *
         * @example
         * ```typescript
         * const allTypes = fieldRegistry.getTypes();
         * const typeNames = allTypes.map(type => type.name);
         * console.log('Available field types:', typeNames);
         * ```
         */
        getTypes() {
            return Array.from(registry.values());
        },
        /**
         * Registers multiple field types at once.
         *
         * Useful for bulk registration of custom field types. Overwrites
         * existing registrations with the same name.
         *
         * @param types - Array of field type definitions to register
         *
         * @example
         * ```typescript
         * fieldRegistry.registerTypes([
         *   CustomInputType,
         *   CustomSelectType,
         *   CustomDatePickerType
         * ]);
         * ```
         */
        registerTypes(types) {
            types.forEach((type) => {
                registry.set(type.name, type);
            });
        },
        /**
         * Provides direct access to the underlying registry Map.
         *
         * Use with caution - direct modification can affect form behavior.
         * Primarily intended for advanced use cases and debugging.
         *
         * @returns The raw Map containing field type registrations
         *
         * @example
         * ```typescript
         * const rawRegistry = fieldRegistry.raw;
         * console.log('Registry size:', rawRegistry.size);
         * ```
         */
        get raw() {
            return registry;
        },
    };
}

/**
 * Collects all field keys, types, and validates regex patterns from a field tree
 * by recursively traversing containers (page, row, group, array).
 *
 * @param collectKeys - Whether to add field keys to data.keys for duplicate detection.
 *   Set to false when inside an array container: array item fields share template keys
 *   across items by design (e.g. every item has 'name', 'email'), so they must not
 *   participate in global duplicate-key checking.
 */
function collectFieldData(fields, data, collectKeys = true) {
    for (const field of fields) {
        if (collectKeys && field.key) {
            data.keys.push(field.key);
        }
        if (field.type) {
            data.types.add(field.type);
        }
        const fieldWithValidation = field;
        if ('pattern' in field && typeof fieldWithValidation.pattern === 'string') {
            validateRegexPattern(fieldWithValidation.pattern, field.key || '<unknown>', data.regexErrors);
        }
        if ('validators' in field && fieldWithValidation.validators) {
            for (const validator of fieldWithValidation.validators) {
                if (validator.type === 'pattern' && 'value' in validator && typeof validator.value === 'string') {
                    validateRegexPattern(validator.value, field.key || '<unknown>', data.regexErrors);
                }
            }
        }
        if (hasChildFields(field)) {
            // Array item fields share template keys across items by design — stop collecting keys
            // once inside an array. Types and regex patterns are still validated.
            const childCollectKeys = collectKeys && field.type !== 'array';
            const children = normalizeFieldsArray(field.fields);
            for (const child of children) {
                if (Array.isArray(child)) {
                    collectFieldData(child, data, childCollectKeys);
                }
                else {
                    collectFieldData([child], data, childCollectKeys);
                }
            }
        }
    }
}
/**
 * Validates a single regex pattern string, collecting errors rather than throwing.
 */
function validateRegexPattern(pattern, fieldKey, errors) {
    try {
        new RegExp(pattern);
    }
    catch (e) {
        errors.push(`Invalid regex pattern in validator for field '${fieldKey}': '${pattern}' — ${e instanceof Error ? e.message : String(e)}`);
    }
}
/**
 * Validates that no duplicate field keys exist in the config.
 * Throws a DynamicFormError listing all duplicates if any are found.
 *
 * @throws {DynamicFormError} When duplicate keys are detected
 */
function validateNoDuplicateKeys(allKeys) {
    const seen = new Set();
    const duplicates = new Set();
    for (const key of allKeys) {
        if (seen.has(key)) {
            duplicates.add(key);
        }
        seen.add(key);
    }
    if (duplicates.size > 0) {
        const duplicateList = Array.from(duplicates)
            .map((k) => `'${k}'`)
            .join(', ');
        throw new DynamicFormError(`Duplicate field keys detected: ${duplicateList}. Each field key must be unique within a form config.`);
    }
}
/**
 * Validates that every field type referenced in the config exists in the registry.
 * Logs a warning for unregistered types — unknown fields are skipped during rendering
 * rather than blocking the whole form (graceful degradation).
 *
 * Skips validation when the registry is empty (no UI adapter has been registered),
 * since the core library tests operate without a field registry.
 */
function validateFieldTypesRegistered(allTypes, registry, logger) {
    if (registry.size === 0)
        return;
    const unregistered = [];
    for (const type of allTypes) {
        if (!registry.has(type)) {
            unregistered.push(type);
        }
    }
    if (unregistered.length > 0) {
        const typeList = unregistered.map((t) => `'${t}'`).join(', ');
        logger.warn(`Unknown field type(s): ${typeList}. Register them via provideDynamicForm(...withXxxFields()) or a custom registry entry. These fields will be skipped during rendering.`);
    }
}
/**
 * Validates a form config at bootstrap time, checking for:
 * - Duplicate field keys (throws — this is always a developer error)
 * - Unregistered field types (warns — form degrades gracefully, skipping unknown fields)
 * - Invalid regex patterns in validators (throws — invalid regex will cause runtime errors)
 *
 * Should be called once during form setup, before fields are processed.
 *
 * @throws {DynamicFormError} When duplicate keys or invalid regex patterns are detected
 */
function validateFormConfig(fields, registry, logger) {
    const data = {
        keys: [],
        types: new Set(),
        regexErrors: [],
    };
    collectFieldData(fields, data);
    validateNoDuplicateKeys(data.keys);
    validateFieldTypesRegistered(data.types, registry, logger);
    if (data.regexErrors.length > 0) {
        throw new DynamicFormError(data.regexErrors.length === 1
            ? data.regexErrors[0]
            : `Invalid regex pattern(s) found:\n${data.regexErrors.map((e) => `  - ${e}`).join('\n')}`);
    }
}

/**
 * Injection token for global value exclusion defaults.
 *
 * Controls which field values are excluded from form submission output
 * based on their reactive state (hidden, disabled, readonly).
 *
 * By default, all three exclusion rules are enabled:
 * - Hidden fields are excluded from submission
 * - Disabled fields are excluded from submission
 * - Readonly fields are excluded from submission
 *
 * This token is configured via `withValueExclusionDefaults()` feature function.
 * Per-form overrides can be set via `FormOptions`.
 * Per-field overrides can be set on individual `FieldDef` entries.
 *
 * **Resolution order:** Field > Form > Global (most specific wins).
 *
 * @internal
 */
const VALUE_EXCLUSION_DEFAULTS = new InjectionToken('VALUE_EXCLUSION_DEFAULTS', {
    providedIn: 'root',
    factory: () => ({
        excludeValueIfHidden: true,
        excludeValueIfDisabled: true,
        excludeValueIfReadonly: true,
    }),
});

/**
 * Resolves the effective exclusion config for a field using the 3-tier hierarchy:
 * Field > Form > Global. For each property, the most specific defined value wins.
 *
 * @param global - Global defaults from VALUE_EXCLUSION_DEFAULTS token
 * @param form - Form-level overrides from FormOptions (may be undefined per property)
 * @param field - Field-level overrides from FieldDef (may be undefined per property)
 * @returns Fully resolved config with all properties defined
 */
function resolveExclusionConfig(global, form, field) {
    return {
        excludeValueIfHidden: field?.excludeValueIfHidden ?? form?.excludeValueIfHidden ?? global.excludeValueIfHidden,
        excludeValueIfDisabled: field?.excludeValueIfDisabled ?? form?.excludeValueIfDisabled ?? global.excludeValueIfDisabled,
        excludeValueIfReadonly: field?.excludeValueIfReadonly ?? form?.excludeValueIfReadonly ?? global.excludeValueIfReadonly,
    };
}
/**
 * Determines whether a field's value should be excluded based on its reactive state
 * and the resolved exclusion config.
 */
function shouldExcludeField(fieldState, config) {
    const state = fieldState();
    if (config.excludeValueIfHidden && state.hidden()) {
        return true;
    }
    if (config.excludeValueIfDisabled && state.disabled()) {
        return true;
    }
    if (config.excludeValueIfReadonly && state.readonly()) {
        return true;
    }
    return false;
}
/**
 * Filters form values based on field reactive state (hidden, disabled, readonly)
 * and the 3-tier exclusion config hierarchy.
 *
 * Only affects submission output — internal form state and two-way binding are unaffected.
 *
 * @param rawValue - The unfiltered form value object
 * @param schemaFields - Flattened schema fields from FormSetup (groups/arrays preserved, pages/rows unwrapped)
 * @param formTree - The Angular Signal Forms FieldTree, accessed as `formInstance[key]`
 * @param registry - Field type registry for valueHandling mode lookup
 * @param globalDefaults - Global exclusion defaults from VALUE_EXCLUSION_DEFAULTS
 * @param formOptions - Form-level exclusion overrides from FormOptions
 * @returns Filtered value with excluded field values omitted
 */
function filterFormValue(rawValue, schemaFields, formTree, registry, globalDefaults, formOptions) {
    const result = {};
    for (const field of schemaFields) {
        const key = field.key;
        if (!key)
            continue;
        // Skip fields that don't contribute to form values
        const valueHandling = getFieldValueHandling(field.type, registry);
        if (valueHandling === 'exclude' || valueHandling === 'flatten')
            continue;
        // If the key doesn't exist in the raw value, skip
        if (!(key in rawValue))
            continue;
        // Try to access the field state from the form tree
        const fieldState = formTree[key];
        // If no field state is available (e.g., componentless hidden fields),
        // include the value as-is since we can't determine reactive state
        if (!fieldState || typeof fieldState !== 'function') {
            result[key] = rawValue[key];
            continue;
        }
        // Resolve per-field exclusion config
        const fieldExclusion = {
            excludeValueIfHidden: field.excludeValueIfHidden,
            excludeValueIfDisabled: field.excludeValueIfDisabled,
            excludeValueIfReadonly: field.excludeValueIfReadonly,
        };
        const resolvedConfig = resolveExclusionConfig(globalDefaults, formOptions, fieldExclusion);
        // Check if this field should be excluded based on its state
        if (shouldExcludeField(fieldState, resolvedConfig)) {
            continue;
        }
        // Handle group fields: recurse into nested structure
        if (isGroupField(field) && field.fields) {
            const groupValue = rawValue[key];
            if (groupValue && typeof groupValue === 'object') {
                const childFields = Object.values(field.fields);
                const nestedTree = fieldState;
                result[key] = filterFormValue(groupValue, childFields, nestedTree, registry, globalDefaults, formOptions);
            }
            else {
                result[key] = groupValue;
            }
            continue;
        }
        // Handle array fields: if not excluded at array level, include entire array value
        // (v1: no per-item filtering)
        if (isArrayField(field)) {
            result[key] = rawValue[key];
            continue;
        }
        // Leaf field: include value
        result[key] = rawValue[key];
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Discriminant constants
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Lifecycle state discriminants.
 * @internal
 */
const LifecycleState = {
    Uninitialized: 'uninitialized',
    Initializing: 'initializing',
    Ready: 'ready',
    Transitioning: 'transitioning',
    Destroyed: 'destroyed',
};
/**
 * Transition phase discriminants.
 * @internal
 */
const Phase = {
    Teardown: 'teardown',
    Applying: 'applying',
    Restoring: 'restoring',
};
/**
 * Action type discriminants.
 * @internal
 */
const Action = {
    Initialize: 'initialize',
    ConfigChange: 'config-change',
    SetupComplete: 'setup-complete',
    ValueCaptured: 'value-captured',
    TeardownComplete: 'teardown-complete',
    ApplyComplete: 'apply-complete',
    RestoreComplete: 'restore-complete',
    Destroy: 'destroy',
};
/**
 * Side effect type discriminants.
 * @internal
 */
const Effect = {
    CaptureValue: 'capture-value',
    WaitFrameBoundary: 'wait-frame-boundary',
    CreateForm: 'create-form',
    RestoreValues: 'restore-values',
};
/** @internal */
function isReadyState(state) {
    return state.type === LifecycleState.Ready;
}
/** @internal */
function isTransitioningState(state) {
    return state.type === LifecycleState.Transitioning;
}
/** @internal */
function createUninitializedState() {
    return { type: LifecycleState.Uninitialized };
}
/** @internal */
function createInitializingState(config) {
    return { type: LifecycleState.Initializing, config };
}
/** @internal */
function createReadyState(config, formSetup) {
    return { type: LifecycleState.Ready, config, formSetup };
}
/** @internal */
function createTransitioningState(phase, currentConfig, pendingConfig, currentFormSetup, preservedValue, pendingFormSetup) {
    return { type: LifecycleState.Transitioning, phase, currentConfig, pendingConfig, currentFormSetup, preservedValue, pendingFormSetup };
}
/** @internal */
function createDestroyedState() {
    return { type: LifecycleState.Destroyed };
}

/**
 * Scheduler for managing side effect timing in the state machine.
 * Provides blocking, frame-boundary (rAF), and after-render timing.
 *
 * @internal
 */
class SideEffectScheduler {
    injector;
    abortController = new AbortController();
    /** Aborted when the owning component is destroyed. */
    get destroyed() {
        return this.abortController.signal.aborted;
    }
    constructor(options) {
        this.injector = options.injector;
        options.destroyRef.onDestroy(() => {
            this.abortController.abort();
        });
    }
    /** Executes a synchronous blocking effect. */
    executeBlocking(effect) {
        return new Observable((subscriber) => {
            if (this.destroyed) {
                subscriber.complete();
                return;
            }
            try {
                const result = effect();
                subscriber.next(result);
                subscriber.complete();
            }
            catch (error) {
                subscriber.error(error);
            }
        });
    }
    /**
     * Defers effect to next rAF (~16ms), giving CD and the async field resolution
     * pipeline time to settle before the state machine continues.
     *
     * When `options.skipIf` returns `true`, the effect executes synchronously
     * (like `executeBlocking`), eliminating ~16ms of unnecessary delay when
     * the field pipeline has already settled (e.g. all components cached).
     */
    executeAtFrameBoundary(effect, options) {
        if (options?.skipIf?.()) {
            return this.executeBlocking(effect);
        }
        return new Observable((subscriber) => {
            if (this.destroyed) {
                subscriber.complete();
                return;
            }
            const frameId = requestAnimationFrame(() => {
                if (this.destroyed) {
                    subscriber.complete();
                    return;
                }
                try {
                    const result = effect();
                    subscriber.next(result);
                    subscriber.complete();
                }
                catch (error) {
                    subscriber.error(error);
                }
            });
            // Cleanup on unsubscribe
            return () => {
                cancelAnimationFrame(frameId);
            };
        });
    }
    /** Executes effect after Angular's next render cycle via `afterNextRender`. */
    executeAfterRender(effect) {
        return new Observable((subscriber) => {
            if (this.destroyed) {
                subscriber.complete();
                return;
            }
            const local = new AbortController();
            afterNextRender(() => {
                if (local.signal.aborted || this.destroyed) {
                    subscriber.complete();
                    return;
                }
                try {
                    const result = effect();
                    subscriber.next(result);
                    subscriber.complete();
                }
                catch (error) {
                    subscriber.error(error);
                }
            }, { injector: this.injector });
            // afterNextRender can't be deregistered — AbortSignal makes the callback no-op
            return () => {
                local.abort();
            };
        });
    }
}
/** @internal */
function createSideEffectScheduler(injector) {
    const destroyRef = injector.get(DestroyRef);
    return new SideEffectScheduler({ injector, destroyRef });
}

/**
 * RxJS-based state machine for form lifecycle management.
 * Uses `concatMap` for sequential action processing.
 *
 * Flow: uninitialized → initializing → ready ⇄ transitioning (teardown → applying → restoring)
 *
 * @internal
 */
class FormStateMachine {
    config;
    actions$ = new Subject();
    _state;
    /** Signal of current state - use this for deriving computed signals */
    state;
    /** Observable of current state - for RxJS interop */
    state$;
    /** Current state value (synchronous read) */
    get currentState() {
        return this._state();
    }
    constructor(config) {
        this.config = config;
        this._state = signal(createUninitializedState(), ...(ngDevMode ? [{ debugName: "_state" }] : /* istanbul ignore next */ []));
        this.state = this._state.asReadonly();
        this.state$ = toObservable(this._state, { injector: config.injector });
        this.setupActionProcessing();
    }
    /** Dispatches an action. Processed sequentially via `concatMap`. */
    dispatch(action) {
        this.actions$.next(action);
    }
    /** Sets up sequential action processing via `concatMap`. */
    setupActionProcessing() {
        this.actions$
            .pipe(concatMap((action) => this.processAction(action).pipe(catchError((error) => {
            this.config.logger.error(`Action '${action.type}' failed:`, error);
            this.recoverFromError(error, action);
            return EMPTY;
        }))), takeUntilDestroyed(this.config.destroyRef))
            .subscribe();
    }
    /**
     * Processes a single action: computes next state (pure), updates `_state`,
     * then executes side effects. Effects may dispatch follow-up actions that
     * are queued via `concatMap` and go through the same transition pipeline.
     */
    processAction(action) {
        const currentState = this._state();
        const result = this.computeTransition(currentState, action);
        this.config.onTransition?.({
            from: currentState,
            to: result.state,
            action,
            timestamp: Date.now(),
        });
        this._state.set(result.state);
        return this.executeSideEffects(result.sideEffects);
    }
    /**
     * Recovers from a failed action by reverting to the last stable state.
     * Initializing → Uninitialized, Transitioning → Ready (using current setup).
     */
    recoverFromError(error, action) {
        const state = this._state();
        if (state.type === LifecycleState.Initializing) {
            this._state.set(createUninitializedState());
        }
        else if (isTransitioningState(state)) {
            this._state.set(createReadyState(state.currentConfig, state.currentFormSetup));
        }
        this.config.onError?.(error, action);
    }
    /** Pure transition: current state + action → next state + side effects. */
    computeTransition(state, action) {
        switch (action.type) {
            case Action.Initialize:
                return this.handleInitialize(state, action.config);
            case Action.ConfigChange:
                return this.handleConfigChange(state, action.config);
            case Action.SetupComplete:
                return this.handleSetupComplete(state, action.formSetup);
            case Action.ValueCaptured:
                return this.handleValueCaptured(state, action.value);
            case Action.TeardownComplete:
                return this.handleTeardownComplete(state);
            case Action.ApplyComplete:
                return this.handleApplyComplete(state, action.formSetup);
            case Action.RestoreComplete:
                return this.handleRestoreComplete(state);
            case Action.Destroy:
                return this.handleDestroy();
            default:
                return assertNever(action);
        }
    }
    handleInitialize(state, config) {
        if (state.type !== LifecycleState.Uninitialized) {
            return { state, sideEffects: [] };
        }
        return {
            state: createInitializingState(config),
            sideEffects: [{ type: Effect.CreateForm }],
        };
    }
    handleConfigChange(state, config) {
        if (state.type === LifecycleState.Uninitialized) {
            return {
                state: createInitializingState(config),
                sideEffects: [{ type: Effect.CreateForm }],
            };
        }
        if (state.type === LifecycleState.Initializing) {
            return {
                state: createInitializingState(config),
                sideEffects: [{ type: Effect.CreateForm }],
            };
        }
        // Guard: reject config changes during active submission to prevent races
        // between the in-flight action Promise and form teardown/rebuild.
        if (this.config.isSubmitting?.()) {
            this.config.logger.warn('Config changed during active submission; ignoring. Apply config changes after submission completes.');
            return { state, sideEffects: [] };
        }
        if (isReadyState(state)) {
            return {
                state: createTransitioningState(Phase.Teardown, state.config, config, state.formSetup),
                sideEffects: [{ type: Effect.CaptureValue }, { type: Effect.WaitFrameBoundary }],
            };
        }
        if (isTransitioningState(state)) {
            // Already transitioning — update pending config (latest wins)
            return {
                state: createTransitioningState(state.phase, state.currentConfig, config, state.currentFormSetup, state.preservedValue, state.pendingFormSetup),
                sideEffects: [],
            };
        }
        return { state, sideEffects: [] };
    }
    handleSetupComplete(state, formSetup) {
        if (state.type === LifecycleState.Initializing) {
            return {
                state: createReadyState(state.config, formSetup),
                sideEffects: [],
            };
        }
        return { state, sideEffects: [] };
    }
    handleValueCaptured(state, value) {
        if (!isTransitioningState(state)) {
            return { state, sideEffects: [] };
        }
        return {
            state: createTransitioningState(state.phase, state.currentConfig, state.pendingConfig, state.currentFormSetup, value, state.pendingFormSetup),
            sideEffects: [],
        };
    }
    handleTeardownComplete(state) {
        if (!isTransitioningState(state) || state.phase !== Phase.Teardown) {
            return { state, sideEffects: [] };
        }
        return {
            state: createTransitioningState(Phase.Applying, state.currentConfig, state.pendingConfig, state.currentFormSetup, state.preservedValue),
            sideEffects: [{ type: Effect.CreateForm }],
        };
    }
    handleApplyComplete(state, formSetup) {
        if (!isTransitioningState(state) || state.phase !== Phase.Applying) {
            return { state, sideEffects: [] };
        }
        if (state.preservedValue && Object.keys(state.preservedValue).length > 0) {
            return {
                state: createTransitioningState(Phase.Restoring, state.currentConfig, state.pendingConfig, state.currentFormSetup, state.preservedValue, formSetup),
                sideEffects: [{ type: Effect.RestoreValues, values: state.preservedValue }],
            };
        }
        return {
            state: createReadyState(state.pendingConfig, formSetup),
            sideEffects: [],
        };
    }
    handleRestoreComplete(state) {
        if (!isTransitioningState(state) || state.phase !== Phase.Restoring) {
            return { state, sideEffects: [] };
        }
        if (!state.pendingFormSetup) {
            this.config.logger.warn('handleRestoreComplete: pendingFormSetup was not set — falling back to recomputing. ' +
                'This indicates a bug in the transition flow.');
        }
        const formSetup = state.pendingFormSetup ?? this.config.createFormSetup(state.pendingConfig);
        return {
            state: createReadyState(state.pendingConfig, formSetup),
            sideEffects: [],
        };
    }
    handleDestroy() {
        return {
            state: createDestroyedState(),
            sideEffects: [],
        };
    }
    /**
     * Executes side effects in sequence. Effects may call `this.dispatch()` internally,
     * queuing follow-up actions into the same `concatMap` pipeline.
     */
    executeSideEffects(effects) {
        if (effects.length === 0) {
            return of(undefined);
        }
        return effects.reduce((chain$, effect) => chain$.pipe(concatMap(() => this.executeSideEffect(effect))), of(undefined));
    }
    executeSideEffect(effect) {
        const { scheduler } = this.config;
        switch (effect.type) {
            case Effect.CaptureValue: {
                return scheduler.executeBlocking(() => {
                    const value = this.config.captureValue();
                    this.dispatch({ type: Action.ValueCaptured, value });
                });
            }
            case Effect.WaitFrameBoundary: {
                return scheduler.executeAtFrameBoundary(() => {
                    this.dispatch({ type: Action.TeardownComplete });
                }, { skipIf: this.config.isFieldPipelineSettled });
            }
            case Effect.CreateForm: {
                return scheduler.executeBlocking(() => {
                    const state = untracked(() => this._state());
                    let config;
                    if (state.type === LifecycleState.Initializing) {
                        config = state.config;
                    }
                    else if (isTransitioningState(state) && state.phase === Phase.Applying) {
                        config = state.pendingConfig;
                    }
                    if (!config)
                        return;
                    const formSetup = this.config.createFormSetup(config);
                    this.config.onFormCreated?.(formSetup);
                    if (state.type === LifecycleState.Initializing) {
                        this.dispatch({ type: Action.SetupComplete, formSetup });
                    }
                    else if (isTransitioningState(state) && state.phase === Phase.Applying) {
                        this.dispatch({ type: Action.ApplyComplete, formSetup });
                    }
                });
            }
            case Effect.RestoreValues: {
                return scheduler.executeAfterRender(() => {
                    const state = untracked(() => this._state());
                    if (!isTransitioningState(state) || state.phase !== Phase.Restoring)
                        return;
                    if (!state.pendingFormSetup) {
                        this.config.logger.warn('RestoreValues effect: pendingFormSetup was not set — falling back to recomputing.');
                    }
                    const formSetup = state.pendingFormSetup ?? this.config.createFormSetup(state.pendingConfig);
                    const validKeys = new Set(formSetup.schemaFields.map((f) => f.key).filter((key) => key !== undefined));
                    this.config.restoreValue(effect.values, validKeys);
                    this.dispatch({ type: Action.RestoreComplete });
                });
            }
            default:
                return assertNever(effect);
        }
    }
}
/** @internal */
function createFormStateMachine(config) {
    return new FormStateMachine(config);
}

/** @internal */
const FORM_STATE_DEPS = new InjectionToken('FORM_STATE_DEPS');
/**
 * Casts a FieldTree to a record of per-key sub-trees.
 *
 * FieldTree<TModel> is structurally a callable that exposes per-key child trees
 * via bracket access (e.g., `tree['fieldKey']`), but TypeScript's FieldTree type
 * doesn't surface this as an index signature. This helper makes the cast explicit
 * and centralizes it to a single location.
 */
function asFieldTreeRecord(tree) {
    return tree;
}
/**
 * Central service that manages all form state and coordinates the form lifecycle.
 * Single source of truth for lifecycle state, field resolution, form signals, and events.
 *
 * @internal
 */
class FormStateManager {
    // ─────────────────────────────────────────────────────────────────────────────
    // Dependencies (injected)
    // ─────────────────────────────────────────────────────────────────────────────
    injector = inject(Injector);
    destroyRef = inject(DestroyRef);
    logger = inject(DynamicFormLogger);
    eventBus = inject(EventBus);
    functionRegistry = inject(FunctionRegistryService);
    schemaRegistry = inject(SchemaRegistryService);
    /** Host component dependencies (config, formOptions, value). */
    deps = (() => {
        const raw = inject(FORM_STATE_DEPS);
        if (!raw.config || !raw.formOptions || !raw.value) {
            throw new DynamicFormError('FormStateDeps must be connected before FormStateManager is created. ' +
                'Ensure DynamicForm assigns its input signals to FORM_STATE_DEPS.');
        }
        // Safe cast: DynamicForm populates FormStateDeps with its concrete signals.
        return raw;
    })();
    /** Global value exclusion defaults. */
    valueExclusionDefaults = inject(VALUE_EXCLUSION_DEFAULTS);
    /** Field registry for loading components. */
    fieldRegistry = injectFieldRegistry();
    // ─────────────────────────────────────────────────────────────────────────────
    // State Machine
    // ─────────────────────────────────────────────────────────────────────────────
    scheduler = createSideEffectScheduler(this.injector);
    machine;
    // ─────────────────────────────────────────────────────────────────────────────
    // Memoized Functions
    // ─────────────────────────────────────────────────────────────────────────────
    fieldProcessors = inject(CONTAINER_FIELD_PROCESSORS);
    // ─────────────────────────────────────────────────────────────────────────────
    // Internal State Signals
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Field loading errors accumulated during resolution.
     */
    fieldLoadingErrors = signal([], ...(ngDevMode ? [{ debugName: "fieldLoadingErrors" }] : /* istanbul ignore next */ []));
    /**
     * Class-level form cache for the "hold until settled" pattern.
     * MUST be class-level — a local variable in the computed would reset on re-evaluation.
     * Mutable ref avoids a reactive cycle (form → isSettled → resolvedFields → form).
     */
    _formCache = { current: undefined };
    // ─────────────────────────────────────────────────────────────────────────────
    // Computed Signals - Derived from State Machine
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * The currently active config used for form rendering.
     * Teardown/Applying → old config, Restoring → new config.
     * Returns deps.config() in uninitialized state so the form schema is
     * available before the state machine dispatches 'initialize'.
     */
    activeConfig = computed(() => {
        const state = this.machine.state();
        if (state.type === LifecycleState.Uninitialized) {
            return this.deps.config();
        }
        if (isReadyState(state))
            return state.config;
        if (isTransitioningState(state)) {
            if (state.phase === Phase.Teardown || state.phase === Phase.Applying)
                return state.currentConfig;
            return state.pendingConfig;
        }
        if (state.type === LifecycleState.Initializing)
            return state.config;
        return undefined;
    }, ...(ngDevMode ? [{ debugName: "activeConfig" }] : /* istanbul ignore next */ []));
    /**
     * Current render phase: 'render' = showing form, 'teardown' = hiding old components.
     */
    renderPhase = computed(() => {
        const state = this.machine.state();
        if (isTransitioningState(state) && state.phase === Phase.Teardown)
            return Phase.Teardown;
        return 'render';
    }, ...(ngDevMode ? [{ debugName: "renderPhase" }] : /* istanbul ignore next */ []));
    /** Whether to render the form template. */
    shouldRender = computed(() => this.activeConfig() !== undefined, ...(ngDevMode ? [{ debugName: "shouldRender" }] : /* istanbul ignore next */ []));
    /**
     * Computed form mode detection with validation.
     */
    formModeDetection = computed(() => {
        const config = this.activeConfig();
        if (!config) {
            return { mode: 'non-paged', isValid: true, errors: [] };
        }
        return detectFormMode(config.fields || []);
    }, ...(ngDevMode ? [{ debugName: "formModeDetection" }] : /* istanbul ignore next */ []));
    /** Validation result for the current form configuration. */
    formConfigValidation = computed(() => {
        const config = this.activeConfig();
        if (!config)
            return { isValid: true, errors: [], warnings: [] };
        return FormModeValidator.validateFormConfiguration(config.fields || []);
    }, ...(ngDevMode ? [{ debugName: "formConfigValidation" }] : /* istanbul ignore next */ []));
    /**
     * Effective form options (merged from config and input).
     */
    effectiveFormOptions = computed(() => {
        const config = this.activeConfig();
        const configOptions = config?.options || {};
        const inputOptions = this.deps.formOptions() ?? undefined;
        return { ...configOptions, ...inputOptions };
    }, ...(ngDevMode ? [{ debugName: "effectiveFormOptions" }] : /* istanbul ignore next */ []));
    /**
     * Page field definitions (for paged forms).
     */
    pageFieldDefinitions = computed(() => {
        const config = this.activeConfig();
        const mode = this.formModeDetection().mode;
        if (mode === 'paged' && config?.fields) {
            return config.fields.filter(isPageField);
        }
        return [];
    }, ...(ngDevMode ? [{ debugName: "pageFieldDefinitions" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Computed Signals - Form Setup
    // ─────────────────────────────────────────────────────────────────────────────
    rawFieldRegistry = computed(() => this.fieldRegistry.raw, ...(ngDevMode ? [{ debugName: "rawFieldRegistry" }] : /* istanbul ignore next */ []));
    /** Computed form setup — reads from the state machine, computed from config on bootstrap. */
    formSetup = computed(() => {
        const registry = this.rawFieldRegistry();
        const state = this.machine.state();
        if (isReadyState(state)) {
            return state.formSetup;
        }
        if (isTransitioningState(state)) {
            if (state.phase === Phase.Restoring && state.pendingFormSetup) {
                return state.pendingFormSetup;
            }
            return state.currentFormSetup;
        }
        // Bootstrap path: compute form setup before the state machine dispatches 'initialize'.
        // Register validators/schemas here so they are available before the first form is built.
        // This is a controlled side effect: registerValidatorsFromConfig is idempotent and only
        // mutates external registries (SchemaRegistry, FunctionRegistry), not reactive state.
        // The state machine's createFormSetup callback handles registration for subsequent configs.
        const config = this.activeConfig();
        if (config) {
            this.registerValidatorsFromConfig(config);
        }
        if (!config) {
            return this.createEmptyFormSetup(registry);
        }
        if (config.fields && config.fields.length > 0) {
            const modeDetection = this.formModeDetection();
            return this.createFormSetupFromConfig(config.fields, modeDetection.mode, registry);
        }
        return this.createEmptyFormSetup(registry);
    }, ...(ngDevMode ? [{ debugName: "formSetup" }] : /* istanbul ignore next */ []));
    /**
     * Default values computed from field definitions.
     */
    defaultValues = linkedSignal(() => this.formSetup().defaultValues, ...(ngDevMode ? [{ debugName: "defaultValues" }] : /* istanbul ignore next */ []));
    /** Valid field keys — memoized separately so the Set isn't rebuilt on every keystroke. */
    validKeys = computed(() => {
        const schemaFields = this.formSetup().schemaFields;
        if (!schemaFields || schemaFields.length === 0)
            return undefined;
        return new Set(schemaFields.map((f) => f.key).filter((key) => key !== undefined));
    }, ...(ngDevMode ? [{ debugName: "validKeys" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Computed Signals - Entity & Form
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Entity (form value merged with defaults).
     *
     * Bidirectional sync with `deps.value`:
     *
     * 1. **Inward** (deps.value → entity): When the host component sets `value` externally
     *    (e.g. two-way binding), this `linkedSignal` source recomputes, merging the new
     *    input with field defaults and filtering to valid keys.
     *
     * 2. **Outward** (entity → deps.value): An `explicitEffect` in `setupEffects()` watches
     *    `entity` and writes changes back to `deps.value`, keeping the host's model signal
     *    in sync with internal form state (e.g. after derivations or reset).
     *
     * The `isEqual` guard on the effect prevents infinite ping-pong: if entity already
     * matches deps.value, the write-back is skipped.
     */
    entity = linkedSignal(() => {
        const inputValue = this.deps.value();
        const defaults = this.defaultValues();
        const keys = this.validKeys();
        const combined = { ...defaults, ...inputValue };
        if (keys) {
            const filtered = {};
            for (const key of Object.keys(combined)) {
                if (keys.has(key)) {
                    filtered[key] = combined[key];
                }
            }
            return filtered;
        }
        return combined;
    }, {
        debugName: 'FormStateManager.entity',
        equal: isEqual,
    });
    /**
     * Schema derived from the current form config and field setup.
     * Separated from `form` so schema construction is memoized independently.
     * Requires `runInInjectionContext` because `createSchemaFromFields` calls `inject()` internally.
     */
    formSchema = computed(() => runInInjectionContext(this.injector, () => {
        const setup = this.formSetup();
        const config = this.activeConfig();
        if (!config)
            return undefined;
        if (setup.schemaFields?.length) {
            const crossFieldCollection = collectCrossFieldEntries(setup.schemaFields);
            return createSchemaFromFields(setup.schemaFields, setup.registry, {
                crossFieldValidators: crossFieldCollection.validators,
                formLevelSchema: config.schema,
            });
        }
        if (config.schema) {
            return createFormLevelSchema(config.schema);
        }
        return undefined;
    }), ...(ngDevMode ? [{ debugName: "formSchema" }] : /* istanbul ignore next */ []));
    /**
     * The Angular Signal Form instance.
     */
    form = computed(() => {
        const schema = this.formSchema();
        const injector = this.injector;
        return untracked(() => (schema ? form(this.entity, schema, { injector }) : form(this.entity, { injector })));
    }, ...(ngDevMode ? [{ debugName: "form" }] : /* istanbul ignore next */ []));
    /** Whether resolvedFields has caught up with fieldsSource (set in constructor). */
    isFieldPipelineSettled;
    /**
     * Field signal context injected into child components.
     * The `form` getter uses a "hold until settled" pattern: returns the cached
     * (old) form while resolvedFields != fieldsSource, preventing stale components
     * from accessing missing FieldTree references.
     */
    fieldSignalContext = computed(() => {
        const formSignal = this.form;
        const isSettled = () => this.isFieldPipelineSettled();
        const formCache = this._formCache;
        return {
            injector: this.injector,
            value: this.deps.value,
            defaultValues: this.defaultValues,
            get form() {
                const currentForm = formSignal();
                const settled = isSettled();
                if (!settled && formCache.current) {
                    return formCache.current;
                }
                formCache.current = currentForm;
                return currentForm;
            },
        };
    }, ...(ngDevMode ? [{ debugName: "fieldSignalContext" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Computed Signals - Form State
    // ─────────────────────────────────────────────────────────────────────────────
    /** Intermediate computed that unwraps the double-signal (form()()) once. */
    formInstance = computed(() => this.form()(), ...(ngDevMode ? [{ debugName: "formInstance" }] : /* istanbul ignore next */ []));
    /** Current form values (reactive). */
    formValue = computed(() => this.formInstance().value(), ...(ngDevMode ? [{ debugName: "formValue" }] : /* istanbul ignore next */ []));
    /**
     * Form values filtered by value exclusion rules.
     *
     * Excludes field values from the output based on their reactive state
     * (hidden, disabled, readonly) and the 3-tier exclusion config
     * (Field > Form > Global). Only affects submission output — internal
     * form state and two-way binding are unaffected.
     */
    filteredFormValue = computed(() => {
        const rawValue = this.formValue();
        const setup = this.formSetup();
        const options = this.effectiveFormOptions();
        if (!setup.schemaFields || setup.schemaFields.length === 0) {
            return rawValue;
        }
        // form() returns the FieldTree<TModel> — a callable with per-key sub-trees.
        // formInstance() returns form()() — the FieldState. We need the FieldTree for
        // per-field state access (e.g., formTree[key]() gives FieldState with hidden/disabled/readonly).
        const formTree = this.form();
        const formOptions = {
            excludeValueIfHidden: options.excludeValueIfHidden,
            excludeValueIfDisabled: options.excludeValueIfDisabled,
            excludeValueIfReadonly: options.excludeValueIfReadonly,
        };
        // FieldTree<TModel> is structurally a callable that also exposes per-key sub-trees
        // via bracket access (e.g., formTree['fieldKey']). TypeScript's nominal typing for
        // FieldTree doesn't expose this index signature, so we use a helper cast.
        const fieldTreeRecord = asFieldTreeRecord(formTree);
        return filterFormValue(rawValue, setup.schemaFields, fieldTreeRecord, setup.registry, this.valueExclusionDefaults, formOptions);
    }, ...(ngDevMode ? [{ debugName: "filteredFormValue" }] : /* istanbul ignore next */ []));
    /** Whether the form is currently valid. */
    valid = computed(() => this.formInstance().valid(), ...(ngDevMode ? [{ debugName: "valid" }] : /* istanbul ignore next */ []));
    /** Whether the form is currently invalid. */
    invalid = computed(() => this.formInstance().invalid(), ...(ngDevMode ? [{ debugName: "invalid" }] : /* istanbul ignore next */ []));
    /** Whether any form field has been modified. */
    dirty = computed(() => this.formInstance().dirty(), ...(ngDevMode ? [{ debugName: "dirty" }] : /* istanbul ignore next */ []));
    /** Whether any form field has been touched (blurred). */
    touched = computed(() => this.formInstance().touched(), ...(ngDevMode ? [{ debugName: "touched" }] : /* istanbul ignore next */ []));
    /** Current validation errors from all fields. */
    errors = computed(() => this.formInstance().errors(), ...(ngDevMode ? [{ debugName: "errors" }] : /* istanbul ignore next */ []));
    /** Whether the form is disabled (from options or form state). */
    disabled = computed(() => {
        const optionsDisabled = this.effectiveFormOptions().disabled;
        const formDisabled = this.formInstance().disabled();
        return optionsDisabled ?? formDisabled;
    }, ...(ngDevMode ? [{ debugName: "disabled" }] : /* istanbul ignore next */ []));
    /** Whether the form is currently submitting. */
    submitting = computed(() => this.formInstance().submitting(), ...(ngDevMode ? [{ debugName: "submitting" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Field Resolution
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Phase-aware field source that coordinates component lifecycle with form updates.
     * Teardown/Applying → intersection of old/new fields; Restoring → all new fields.
     * Uses key+type equality to avoid spurious emissions during rapid transitions.
     */
    fieldsSource = computed(() => {
        const state = this.machine.state();
        if (isTransitioningState(state)) {
            const oldFields = state.currentConfig.fields ?? [];
            const newFields = state.pendingConfig.fields ?? [];
            const newKeys = new Set(newFields.map((f) => f.key));
            if (state.phase === Phase.Teardown || state.phase === Phase.Applying) {
                return oldFields.filter((f) => newKeys.has(f.key));
            }
            if (state.phase === Phase.Restoring) {
                return state.pendingFormSetup?.fields ?? this.formSetup().fields;
            }
        }
        return this.formSetup().fields;
    }, { ...(ngDevMode ? { debugName: "fieldsSource" } : /* istanbul ignore next */ {}), equal: (a, b) => {
            if (a === b)
                return true;
            if (a.length !== b.length)
                return false;
            return a.every((field, i) => field.key === b[i].key && field.type === b[i].type);
        } });
    /**
     * Injector for field components with FIELD_SIGNAL_CONTEXT.
     *
     * Recreates the Injector on every `fieldSignalContext` change. This is intentional:
     * `reconcileFields()` compares the injector reference to detect context changes
     * (e.g. after a config transition). A new injector reference signals that
     * `NgComponentOutlet` should pick up the updated context, while an unchanged
     * reference preserves object identity to avoid unnecessary re-renders.
     */
    fieldInjector = computed(() => Injector.create({
        parent: this.injector,
        providers: [{ provide: FIELD_SIGNAL_CONTEXT, useValue: this.fieldSignalContext() }],
    }), ...(ngDevMode ? [{ debugName: "fieldInjector" }] : /* istanbul ignore next */ []));
    /** Resolved fields ready for rendering. */
    resolvedFields;
    // ─────────────────────────────────────────────────────────────────────────────
    // Event Streams (for outputs)
    // ─────────────────────────────────────────────────────────────────────────────
    /** Stream of submit events when form is valid. */
    submitted$;
    /** Stream of reset events. */
    reset$;
    /** Stream of clear events. */
    cleared$;
    /** Emits once when the state machine reaches 'ready'. Useful for tests. */
    get ready$() {
        return this.machine.state$.pipe(filter(isReadyState), take$1(1), map(() => undefined));
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────────
    constructor() {
        this.resolvedFields = derivedFromDeferred(this.fieldsSource, pipe(switchMap((fields) => {
            if (!fields || fields.length === 0) {
                return of([]);
            }
            const registry = this.rawFieldRegistry();
            const injector = this.fieldInjector();
            const syncContext = {
                getLoadedComponent: (type) => this.fieldRegistry.getLoadedComponent(type),
                registry,
                injector,
            };
            // Hybrid: resolve cached fields sync, only await uncached ones
            const results = new Array(fields.length);
            const asyncIndexes = [];
            const asyncObs = [];
            const onError = (fieldDef, error) => {
                const fieldKey = fieldDef.key || '<no key>';
                this.fieldLoadingErrors.update((errors) => [
                    ...errors,
                    {
                        fieldType: fieldDef.type,
                        fieldKey,
                        error: error instanceof Error ? error : new Error(String(error)),
                    },
                ]);
                this.logger.error(`Failed to load component for field type '${fieldDef.type}' (key: ${fieldKey}). ` +
                    `Ensure the field type is registered in your field registry.`, error);
            };
            for (let i = 0; i < fields.length; i++) {
                const f = fields[i];
                const def = this.fieldRegistry.getType(f.type);
                const isCached = !def?.loadComponent || this.fieldRegistry.getLoadedComponent(f.type);
                if (isCached) {
                    results[i] = resolveFieldSync(f, syncContext);
                }
                else {
                    asyncIndexes.push(i);
                    asyncObs.push(resolveField(f, {
                        loadTypeComponent: (type) => this.fieldRegistry.loadTypeComponent(type),
                        registry,
                        injector,
                        destroyRef: this.destroyRef,
                        onError,
                    }));
                }
            }
            if (asyncObs.length === 0) {
                return of(results);
            }
            return forkJoin(asyncObs).pipe(map((asyncResults) => {
                for (let j = 0; j < asyncResults.length; j++) {
                    results[asyncIndexes[j]] = asyncResults[j];
                }
                return results;
            }));
        }), map((fields) => fields.filter((f) => f !== undefined)), scan$1(reconcileFields, [])), { initialValue: [], injector: this.injector });
        // Length comparison works because reconcileFields preserves ordering and
        // fieldsSource changes atomically during transitions (lengths won't match until settled).
        this.isFieldPipelineSettled = computed(() => {
            return this.fieldsSource().length === this.resolvedFields().length;
        }, ...(ngDevMode ? [{ debugName: "isFieldPipelineSettled" }] : /* istanbul ignore next */ []));
        this.submitted$ = this.eventBus.on('submit').pipe(filter(() => {
            if (!this.valid()) {
                this.logger.debug('Form submitted while invalid, not emitting to (submitted) output');
                return false;
            }
            return true;
        }), 
        // switchMap is intentional here: mapping is synchronous (reads signals, no async Promise).
        // The exhaustMap concern in createSubmissionHandler does not apply to this path.
        switchMap(() => {
            const config = this.activeConfig();
            const submissionConfig = config?.submission;
            if (submissionConfig?.action) {
                this.logger.warn('Both `submission.action` and `(submitted)` output are configured. ' +
                    'When using `submission.action`, the `(submitted)` output will not emit. ' +
                    'Use either `submission.action` OR `(submitted)`, not both.');
                return EMPTY;
            }
            return of(this.filteredFormValue());
        }), takeUntilDestroyed(this.destroyRef));
        this.reset$ = this.eventBus.on('form-reset').pipe(map(() => undefined), takeUntilDestroyed(this.destroyRef));
        this.cleared$ = this.eventBus.on('form-clear').pipe(map(() => undefined), takeUntilDestroyed(this.destroyRef));
        // Create the state machine eagerly
        this.machine = createFormStateMachine({
            injector: this.injector,
            destroyRef: this.destroyRef,
            scheduler: this.scheduler,
            logger: this.logger,
            createFormSetup: (config) => {
                this.registerValidatorsFromConfig(config);
                return this.createFormSetupFromConfig(config.fields ?? [], detectFormMode(config.fields ?? []).mode, this.rawFieldRegistry());
            },
            captureValue: () => this.formValue(),
            isSubmitting: this.submitting,
            isFieldPipelineSettled: () => this.isFieldPipelineSettled(),
            restoreValue: (values, validKeys) => {
                const filtered = {};
                for (const [key, val] of Object.entries(values)) {
                    if (validKeys.has(key)) {
                        filtered[key] = val;
                    }
                }
                if (Object.keys(filtered).length > 0) {
                    this.deps.value.update((current) => ({ ...current, ...filtered }));
                }
            },
            onTransition: (transition) => {
                this.logger.debug('State transition:', transition.from.type, '→', transition.to.type, transition.action.type);
            },
            onError: (error, action) => {
                this.logger.error(`State machine error recovery triggered for action '${action.type}':`, error);
            },
        });
        runInInjectionContext(this.injector, () => {
            this.setupEffects();
            this.setupEventHandlers();
        });
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Public Methods
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Updates the form value model.
     */
    updateValue(value) {
        this.deps.value.set(value);
    }
    /**
     * Resets the form to default values.
     */
    reset() {
        const defaults = this.defaultValues();
        this.form()().value.set(defaults);
        this.deps.value.set(defaults);
    }
    /**
     * Clears the form to empty state.
     */
    clear() {
        const emptyValue = {};
        this.form()().value.set(emptyValue);
        this.deps.value.set(emptyValue);
    }
    /**
     * Triggers form submission.
     */
    submit() {
        this.eventBus.dispatch(SubmitEvent);
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Private Methods - Setup
    // ─────────────────────────────────────────────────────────────────────────────
    setupEffects() {
        explicitEffect([this.deps.config], ([config]) => {
            this.fieldLoadingErrors.set([]);
            const state = this.machine.currentState;
            if (state.type === LifecycleState.Uninitialized) {
                this.machine.dispatch({ type: Action.Initialize, config });
            }
            else {
                this.machine.dispatch({ type: Action.ConfigChange, config });
            }
        });
        // Outward sync: write entity changes back to deps.value (see entity JSDoc for full explanation).
        // The isEqual guard prevents infinite ping-pong between this effect and the linkedSignal source.
        explicitEffect([this.entity], ([currentEntity]) => {
            const currentValue = this.deps.value();
            if (!isEqual(currentEntity, currentValue)) {
                this.deps.value.set(currentEntity);
            }
        });
        explicitEffect([this.formConfigValidation], ([validation]) => {
            if (!validation.isValid) {
                this.logger.error('Invalid form configuration:', validation.errors);
            }
            if (validation.warnings.length > 0) {
                this.logger.warn('Form configuration warnings:', validation.warnings);
            }
        });
    }
    setupEventHandlers() {
        this.eventBus
            .on('form-reset')
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.reset());
        this.eventBus
            .on('form-clear')
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.clear());
    }
    registerValidatorsFromConfig({ customFnConfig, schemas }) {
        if (schemas) {
            schemas.forEach((schema) => {
                this.schemaRegistry.registerSchema(schema);
            });
        }
        if (!customFnConfig) {
            return;
        }
        if (customFnConfig.customFunctions) {
            Object.entries(customFnConfig.customFunctions).forEach(([name, fn]) => {
                this.functionRegistry.registerCustomFunction(name, fn);
            });
        }
        if (customFnConfig.derivations) {
            this.functionRegistry.setDerivationFunctions(customFnConfig.derivations);
        }
        if (customFnConfig.asyncDerivations) {
            this.functionRegistry.setAsyncDerivationFunctions(customFnConfig.asyncDerivations);
        }
        if (customFnConfig.asyncConditions) {
            this.functionRegistry.setAsyncConditionFunctions(customFnConfig.asyncConditions);
        }
        this.functionRegistry.setValidators(customFnConfig.validators);
        this.functionRegistry.setAsyncValidators(customFnConfig.asyncValidators);
        this.functionRegistry.setHttpValidators(customFnConfig.httpValidators);
    }
    createFormSetupFromConfig(fields, mode, registry) {
        const normalizedFields = normalizeSimplifiedArrays(fields);
        // Validate after normalization so simplified array templates are already expanded
        // into full ArrayField.fields and are reachable during traversal.
        validateFormConfig(normalizedFields, registry, this.logger);
        const flattenedFields = this.fieldProcessors.memoizedFlattenFields(normalizedFields, registry);
        const flattenedFieldsForRendering = this.fieldProcessors.memoizedFlattenFieldsForRendering(normalizedFields, registry);
        const fieldsById = this.fieldProcessors.memoizedKeyBy(flattenedFields);
        const defaultValues = this.fieldProcessors.memoizedDefaultValues(fieldsById, registry);
        const fieldsToRender = mode === 'paged' ? [] : flattenedFieldsForRendering;
        return {
            fields: fieldsToRender,
            schemaFields: flattenedFields,
            originalFields: fields,
            defaultValues,
            mode,
            registry,
        };
    }
    createEmptyFormSetup(registry) {
        return {
            fields: [],
            schemaFields: [],
            defaultValues: {},
            mode: 'non-paged',
            registry,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────────
    ngOnDestroy() {
        this.machine.dispatch({ type: Action.Destroy });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: FormStateManager, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: FormStateManager });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: FormStateManager, decorators: [{
            type: Injectable
        }], ctorParameters: () => [] });

/**
 * Active implementation of DerivationLogger that performs actual logging.
 *
 * @internal
 */
class ActiveDerivationLogger {
    logger;
    config = createDefaultDerivationLogConfig();
    /**
     * Updates the log configuration.
     */
    setConfig(config) {
        this.config = config;
    }
    cycleStart(trigger, entryCount) {
        if (!shouldLog(this.config, 'verbose'))
            return;
        this.logger.debug(`Derivation - Starting cycle (${trigger}) with ${entryCount} derivation(s)`);
    }
    iteration(iterationNumber) {
        if (!shouldLog(this.config, 'verbose'))
            return;
        this.logger.debug(`Derivation - Iteration ${iterationNumber}`);
    }
    evaluation(entry) {
        if (!shouldLog(this.config, 'verbose'))
            return;
        const name = entry.debugName ? `"${entry.debugName}"` : entry.fieldKey;
        switch (entry.result) {
            case 'applied':
                this.logger.debug(`Derivation - Applied ${name}`, {
                    field: entry.fieldKey,
                    previousValue: entry.previousValue,
                    newValue: entry.newValue,
                    ...(entry.durationMs !== undefined && { durationMs: entry.durationMs }),
                });
                break;
            case 'skipped':
                this.logger.debug(`Derivation - Skipped ${name} (${this.formatSkipReason(entry.skipReason)})`, {
                    field: entry.fieldKey,
                    reason: entry.skipReason,
                });
                break;
            case 'error':
                this.logger.debug(`Derivation - Error ${name}`, {
                    field: entry.fieldKey,
                    error: entry.error,
                });
                break;
        }
    }
    summary(result, trigger) {
        if (!shouldLog(this.config, 'summary'))
            return;
        // Only log if something interesting happened
        if (result.appliedCount === 0 && result.errorCount === 0)
            return;
        this.logger.debug(`Derivation - Cycle complete (${trigger})`, {
            applied: result.appliedCount,
            skipped: result.skippedCount,
            errors: result.errorCount,
            iterations: result.iterations,
        });
    }
    maxIterationsReached(result, trigger) {
        this.logger.warn(`Derivation - Max iterations reached (${trigger}). ` +
            `This may indicate a loop in derivation logic. ` +
            `Applied: ${result.appliedCount}, Skipped: ${result.skippedCount}, Errors: ${result.errorCount}`);
    }
    formatSkipReason(reason) {
        switch (reason) {
            case 'condition-false':
                return 'condition not met';
            case 'value-unchanged':
                return 'value unchanged';
            case 'already-applied':
                return 'already applied this cycle';
            case 'user-override':
                return 'user override active';
            case 'target-not-found':
                return 'target not found';
            default:
                return 'unknown';
        }
    }
}
/**
 * No-op implementation of DerivationLogger.
 * All methods are empty - no logging overhead when disabled.
 *
 * @internal
 */
class NoopDerivationLogger {
    cycleStart() {
        /* no-op */
    }
    iteration() {
        /* no-op */
    }
    evaluation() {
        /* no-op */
    }
    summary() {
        /* no-op */
    }
    maxIterationsReached() {
        /* no-op */
    }
}
/** Singleton no-op instance to avoid creating new objects */
const NOOP_INSTANCE = new NoopDerivationLogger();
/**
 * Factory function to create a DerivationLogger.
 *
 * Returns a no-op implementation if config level is 'none',
 * otherwise returns an active logger with the given config.
 *
 * @param config - The derivation log configuration
 * @param logger - The underlying logger instance
 * @returns A DerivationLogger instance
 *
 * @public
 */
function createDerivationLogger(config, logger) {
    const effectiveConfig = config ?? createDefaultDerivationLogConfig();
    // Return no-op if logging is completely disabled
    if (effectiveConfig.level === 'none') {
        return NOOP_INSTANCE;
    }
    // Create active logger with config
    const service = new ActiveDerivationLogger();
    service.logger = logger;
    service.setConfig(effectiveConfig);
    return service;
}

/**
 * Type guard to check if a value is a DynamicFormFeature
 */
function isDynamicFormFeature(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'ɵkind' in value &&
        typeof value.ɵkind === 'string' &&
        'ɵproviders' in value &&
        Array.isArray(value.ɵproviders));
}
/**
 * Helper to create a feature with proper typing
 */
function createFeature(kind, providers) {
    return {
        ɵkind: kind,
        ɵproviders: providers,
    };
}

/**
 * Console-based logger implementation.
 */
class ConsoleLogger {
    prefix = '[Dynamic Forms]';
    debug(message, ...args) {
        console.debug(this.prefix, message, ...args);
    }
    info(message, ...args) {
        console.info(this.prefix, message, ...args);
    }
    warn(message, ...args) {
        console.warn(this.prefix, message, ...args);
    }
    error(message, ...args) {
        console.error(this.prefix, message, ...args);
    }
}

/**
 * Injection token for derivation logging configuration.
 *
 * @internal
 */
const DERIVATION_LOG_CONFIG = new InjectionToken('DERIVATION_LOG_CONFIG', {
    providedIn: 'root',
    factory: createDefaultDerivationLogConfig,
});
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
function withLoggerConfig(config = true) {
    // Handle boolean or function
    if (typeof config === 'boolean' || typeof config === 'function') {
        const isEnabled = typeof config === 'function' ? config() : config;
        const logger = isEnabled ? new ConsoleLogger() : new NoopLogger();
        return createFeature('logger', [{ provide: DynamicFormLogger, useValue: logger }]);
    }
    // Handle config object
    const isEnabled = config.enabled !== false;
    const logger = isEnabled ? new ConsoleLogger() : new NoopLogger();
    const providers = [{ provide: DynamicFormLogger, useValue: logger }];
    // Add derivation log config if specified
    if (config.derivations !== undefined) {
        providers.push({
            provide: DERIVATION_LOG_CONFIG,
            useValue: { level: config.derivations },
        });
    }
    return createFeature('logger', providers);
}

/** @internal */
function provideDynamicFormDI() {
    return [
        EventBus,
        { provide: CONTAINER_FIELD_PROCESSORS, useFactory: createContainerFieldProcessors },
        SchemaRegistryService,
        FunctionRegistryService,
        {
            provide: FORM_STATE_DEPS,
            useFactory: () => ({ config: null, formOptions: null, value: null }),
        },
        FormStateManager,
        {
            provide: RootFormRegistryService,
            useFactory: (stateManager) => new RootFormRegistryService(stateManager.formValue, computed(() => stateManager.form())),
            deps: [FormStateManager],
        },
        FieldContextRegistryService,
        {
            provide: DEFAULT_PROPS,
            useFactory: (stateManager) => computed(() => stateManager.activeConfig()?.defaultProps),
            deps: [FormStateManager],
        },
        {
            provide: DEFAULT_WRAPPERS,
            useFactory: (stateManager) => computed(() => stateManager.activeConfig()?.defaultWrappers),
            deps: [FormStateManager],
        },
        {
            provide: DEFAULT_VALIDATION_MESSAGES,
            useFactory: (stateManager) => computed(() => stateManager.activeConfig()?.defaultValidationMessages),
            deps: [FormStateManager],
        },
        {
            provide: FORM_OPTIONS,
            useFactory: (stateManager) => stateManager.effectiveFormOptions,
            deps: [FormStateManager],
        },
        {
            provide: EXTERNAL_DATA,
            useFactory: (stateManager) => computed(() => stateManager.activeConfig()?.externalData),
            deps: [FormStateManager],
        },
        { provide: DERIVATION_WARNING_TRACKER, useFactory: createDerivationWarningTracker },
        { provide: DEPRECATION_WARNING_TRACKER, useFactory: createDeprecationWarningTracker },
        {
            provide: DERIVATION_ORCHESTRATOR,
            useFactory: (stateManager, logger, logConfig, externalData) => {
                // FormStateManager is injected without type parameters, so its generic defaults
                // to Record<string, unknown>. The casts widen the type to match DerivationOrchestratorConfig
                // which uses unknown — safe because the orchestrator only reads values.
                const config = {
                    schemaFields: computed(() => stateManager.formSetup()?.schemaFields),
                    formValue: stateManager.formValue,
                    form: computed(() => stateManager.form()),
                    derivationLogger: computed(() => createDerivationLogger(logConfig, logger)),
                    externalData,
                };
                return createDerivationOrchestrator(config);
            },
            deps: [FormStateManager, DynamicFormLogger, DERIVATION_LOG_CONFIG, EXTERNAL_DATA],
        },
        { provide: HTTP_CONDITION_CACHE, useFactory: () => new HttpConditionCache(100) },
        LogicFunctionCacheService,
        HttpConditionFunctionCacheService,
        AsyncConditionFunctionCacheService,
        DynamicValueFunctionCacheService,
        { provide: PROPERTY_OVERRIDE_STORE, useFactory: createPropertyOverrideStore },
        {
            provide: PROPERTY_DERIVATION_ORCHESTRATOR,
            useFactory: (stateManager, externalData, store) => {
                const config = {
                    schemaFields: computed(() => stateManager.formSetup()?.schemaFields),
                    formValue: stateManager.formValue,
                    store,
                    externalData,
                };
                return createPropertyDerivationOrchestrator(config);
            },
            deps: [FormStateManager, EXTERNAL_DATA, PROPERTY_OVERRIDE_STORE],
        },
    ];
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
class EventDispatcher {
    bus;
    /**
     * Dispatches a form event into the connected DynamicForm's event bus.
     * No-op if no form is currently connected.
     *
     * @param event - A FormEvent instance. Use the `arrayEvent()` builder for array operations.
     */
    dispatch(event) {
        this.bus?.emitInstance(event);
    }
    /** @internal - Called by DynamicForm on init */
    connect(bus) {
        this.bus = bus;
    }
    /** @internal - Called by DynamicForm on destroy */
    disconnect() {
        this.bus = undefined;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: EventDispatcher, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: EventDispatcher });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: EventDispatcher, decorators: [{
            type: Injectable
        }] });

/**
 * Dynamic form component — renders a form based on configuration.
 * Delegates state management to `FormStateManager`.
 *
 * @example
 *```html
 * <form [dynamic-form]="formConfig" [(value)]="formData" (submitted)="handleSubmit($event)"></form>
 * ```
 */
class DynamicForm {
    // ─────────────────────────────────────────────────────────────────────────────
    // Inputs (must be declared BEFORE deps connection and stateManager injection)
    // ─────────────────────────────────────────────────────────────────────────────
    /** Form configuration defining the structure, validation, and behavior. */
    config = input.required({ ...(ngDevMode ? { debugName: "config" } : /* istanbul ignore next */ {}), alias: 'dynamic-form' });
    /** Runtime form options that override config options when provided. */
    formOptions = input(undefined, ...(ngDevMode ? [{ debugName: "formOptions" }] : /* istanbul ignore next */ []));
    /** Form values for two-way data binding. */
    value = model(undefined, ...(ngDevMode ? [{ debugName: "value" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Dependencies
    // ─────────────────────────────────────────────────────────────────────────────
    destroyRef = inject(DestroyRef);
    injector = inject(Injector);
    environmentInjector = inject(EnvironmentInjector);
    eventBus = inject(EventBus);
    logger = inject(DynamicFormLogger);
    dispatcher = inject(EventDispatcher, { optional: true });
    /** State manager that owns all form state. Initialized via connectDeps() to guarantee
     * FORM_STATE_DEPS is populated before FormStateManager is injected. */
    stateManager = this.connectDeps();
    // ─────────────────────────────────────────────────────────────────────────────
    // Private State
    // ─────────────────────────────────────────────────────────────────────────────
    componentId = 'dynamic-form';
    // ─────────────────────────────────────────────────────────────────────────────
    // Signals - Direct pass-through from state manager
    // ─────────────────────────────────────────────────────────────────────────────
    /** The currently active config used for form rendering */
    activeConfig = this.stateManager.activeConfig;
    /** Current render phase: 'render' = showing form, 'teardown' = hiding old components */
    renderPhase = this.stateManager.renderPhase;
    /** Computed form mode detection with validation */
    formModeDetection = this.stateManager.formModeDetection;
    /** Page field definitions for paged forms */
    pageFieldDefinitions = this.stateManager.pageFieldDefinitions;
    /** Effective form options (merged from config and input) */
    effectiveFormOptions = this.stateManager.effectiveFormOptions;
    /** Field signal context for injection into child components */
    fieldSignalContext = this.stateManager.fieldSignalContext;
    /** Default values computed from field definitions */
    defaultValues = this.stateManager.defaultValues;
    /** The Angular Signal Form instance */
    form = this.stateManager.form;
    /** Current form values (reactive) */
    formValue = this.stateManager.formValue;
    /** Whether the form is currently valid */
    valid = this.stateManager.valid;
    /** Whether the form is currently invalid */
    invalid = this.stateManager.invalid;
    /** Whether any form field has been modified */
    dirty = this.stateManager.dirty;
    /** Whether any form field has been touched (blurred) */
    touched = this.stateManager.touched;
    /** Current validation errors from all fields */
    errors = this.stateManager.errors;
    /** Whether the form is disabled (from options or form state) */
    disabled = this.stateManager.disabled;
    /** Whether the form is currently submitting */
    submitting = this.stateManager.submitting;
    /** Collects errors from async field component loading for error boundary patterns */
    fieldLoadingErrors = this.stateManager.fieldLoadingErrors;
    /** Whether to render the form template */
    shouldRender = this.stateManager.shouldRender;
    /** Resolved fields ready for rendering */
    resolvedFields = this.stateManager.resolvedFields;
    // ─────────────────────────────────────────────────────────────────────────────
    // Computed Signals - Internal
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Recursively counts container components that will emit ComponentInitializedEvent.
     * Includes the dynamic-form component itself (+1).
     *
     * Recurses into all container children, including those nested inside array
     * item templates, to avoid a premature (initialized) emission.
     */
    totalComponentsCount = computed(() => {
        const fields = this.stateManager.formSetup()?.fields ?? [];
        return countContainersRecursive(fields) + 1;
    }, ...(ngDevMode ? [{ debugName: "totalComponentsCount" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────────────────────
    initialized$ = setupInitializationTracking({
        eventBus: this.eventBus,
        totalComponentsCount: this.totalComponentsCount,
        injector: this.injector,
        componentId: this.componentId,
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // Outputs
    // ─────────────────────────────────────────────────────────────────────────────
    /** Emits when form validity changes. */
    validityChange = outputFromObservable(toObservable(this.valid));
    /** Emits when form dirty state changes. */
    dirtyChange = outputFromObservable(toObservable(this.dirty));
    /**
     * Emits form values when submitted (via SubmitEvent) and form is valid.
     *
     * **Important:** This output only emits when the form is valid. If you need to
     * handle submit events regardless of validity, use the `(events)` output and
     * filter for `'submit'` events.
     *
     * Note: Does not emit when `submission.action` is configured - use one or the other.
     */
    submitted = outputFromObservable(this.stateManager.submitted$);
    /** Emits when form is reset to default values. */
    reset = outputFromObservable(this.eventBus.on('form-reset'));
    /** Emits when form is cleared to empty state. */
    cleared = outputFromObservable(this.eventBus.on('form-clear'));
    /** Emits all form events for custom event handling. */
    events = outputFromObservable(this.eventBus.events$);
    /**
     * Emits when all form components are initialized and ready for interaction.
     * Useful for E2E testing to ensure the form is fully rendered before interaction.
     */
    initialized = outputFromObservable(this.initialized$);
    /** Emits when the current page changes in paged forms. */
    onPageChange = outputFromObservable(this.eventBus.on('page-change'));
    /** Emits when page navigation state changes (canGoNext, canGoPrevious, etc.). */
    onPageNavigationStateChange = outputFromObservable(this.eventBus.on('page-navigation-state-change'));
    // ─────────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────────
    constructor() {
        this.dispatcher?.connect(this.eventBus);
        this.destroyRef.onDestroy(() => this.dispatcher?.disconnect());
        // Inject orchestrators eagerly so derivation streams are set up before the first
        // render cycle. Previously afterNextRender() deferred injection, causing
        // (initialized) to fire before derivations ran. The circular dependency that
        // originally motivated the deferral is resolved via dynamic-form-di.ts.
        this.injector.get(DERIVATION_ORCHESTRATOR);
        this.injector.get(PROPERTY_DERIVATION_ORCHESTRATOR);
        this.setupEffects();
        this.setupEventHandlers();
    }
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
    onNativeSubmit(event) {
        event.preventDefault();
        this.eventBus.dispatch(SubmitEvent);
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Private Methods
    // ─────────────────────────────────────────────────────────────────────────────
    setupEffects() {
        // Emit initialization event for paged forms
        explicitEffect([this.formModeDetection, this.pageFieldDefinitions], ([{ mode }, pages]) => {
            if (mode === 'paged' && pages.length > 0) {
                this.eventBus.dispatch(ComponentInitializedEvent, 'dynamic-form', this.componentId);
            }
        });
        // Emit initialization event for non-paged forms
        explicitEffect([this.resolvedFields, this.formModeDetection], ([fields, { mode }]) => {
            if (mode === 'non-paged' && fields.length > 0) {
                afterNextRender(() => {
                    this.eventBus.dispatch(ComponentInitializedEvent, 'dynamic-form', this.componentId);
                }, { injector: this.injector });
            }
        });
    }
    /**
     * Populates FORM_STATE_DEPS with this component's input signals, then injects
     * FormStateManager. Must be called as a field initializer (after the input signals
     * are declared) so that FormStateManager reads populated deps when it is constructed.
     * inject() is valid here because field initializers run inside the injection context.
     */
    connectDeps() {
        const deps = inject(FORM_STATE_DEPS);
        deps.config = this.config;
        deps.formOptions = this.formOptions;
        deps.value = this.value;
        return inject((FormStateManager));
    }
    setupEventHandlers() {
        createSubmissionHandler({
            eventBus: this.eventBus,
            configSignal: this.config,
            formSignal: this.form,
            validSignal: this.valid,
            logger: this.logger,
        })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
            error: (err) => this.logger.error('Submission handler error', err),
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: DynamicForm, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: DynamicForm, isStandalone: true, selector: "form[dynamic-form]", inputs: { config: { classPropertyName: "config", publicName: "dynamic-form", isSignal: true, isRequired: true, transformFunction: null }, formOptions: { classPropertyName: "formOptions", publicName: "formOptions", isSignal: true, isRequired: false, transformFunction: null }, value: { classPropertyName: "value", publicName: "value", isSignal: true, isRequired: false, transformFunction: null } }, outputs: { value: "valueChange", validityChange: "validityChange", dirtyChange: "dirtyChange", submitted: "submitted", reset: "reset", cleared: "cleared", events: "events", initialized: "initialized", onPageChange: "onPageChange", onPageNavigationStateChange: "onPageNavigationStateChange" }, host: { attributes: { "novalidate": "" }, listeners: { "submit": "onNativeSubmit($event)" }, properties: { "class.disabled": "disabled()", "class.df-form-paged": "formModeDetection().mode === \"paged\"", "class.df-form-non-paged": "formModeDetection().mode === \"non-paged\"", "attr.data-form-mode": "formModeDetection().mode" }, classAttribute: "df-dynamic-form df-form" }, providers: [provideDynamicFormDI()], ngImport: i0, template: `
    @if (shouldRender()) {
      @switch (formModeDetection().mode) {
        @case ('paged') {
          <div page-orchestrator [pageFields]="pageFieldDefinitions()" [form]="form()" [fieldSignalContext]="fieldSignalContext()"></div>
        }
        @case ('non-paged') {
          @for (field of resolvedFields(); track field.key) {
            <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
          }
        }
        @default {
          never;
        }
      }
    }
  `, isInline: true, styles: [":host,.df-form{--df-grid-columns: 12;--df-grid-gap: .5rem;--df-grid-row-gap: .5rem;--df-breakpoint-sm: 576px;--df-breakpoint-md: 768px;--df-breakpoint-lg: 992px;--df-breakpoint-xl: 1200px;--df-grid-gap-sm: .5rem;--df-grid-gap-md: .5rem;--df-grid-gap-lg: .5rem;--df-grid-gap-xl: .5rem;--df-grid-row-gap-sm: .5rem;--df-grid-row-gap-md: .5rem;--df-grid-row-gap-lg: .5rem;--df-grid-row-gap-xl: .5rem;--df-array-item-gap: var(--df-grid-row-gap);--df-group-gap: var(--df-grid-gap);--df-group-padding: var(--df-grid-gap)}.df-form{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}.df-form>*{grid-column:1/-1}.df-row{display:grid;grid-template-columns:repeat(var(--df-grid-columns, 12),1fr);gap:var(--df-grid-gap);align-items:start;width:100%}.df-row>*:not([class*=df-col-]){grid-column:1/-1}.df-col-1{grid-column:span 1}.df-col-2{grid-column:span 2}.df-col-3{grid-column:span 3}.df-col-4{grid-column:span 4}.df-col-5{grid-column:span 5}.df-col-6{grid-column:span 6}.df-col-7{grid-column:span 7}.df-col-8{grid-column:span 8}.df-col-9{grid-column:span 9}.df-col-10{grid-column:span 10}.df-col-11{grid-column:span 11}.df-col-12{grid-column:span 12}.df-col-auto{grid-column:span auto;width:auto}.df-col-full{grid-column:1/-1}.df-col-start-1{grid-column-start:1}.df-col-start-2{grid-column-start:2}.df-col-start-3{grid-column-start:3}.df-col-start-4{grid-column-start:4}.df-col-start-5{grid-column-start:5}.df-col-start-6{grid-column-start:6}.df-col-start-7{grid-column-start:7}.df-col-start-8{grid-column-start:8}.df-col-start-9{grid-column-start:9}.df-col-start-10{grid-column-start:10}.df-col-start-11{grid-column-start:11}.df-col-start-12{grid-column-start:12}.df-col-end-1{grid-column-end:1}.df-col-end-2{grid-column-end:2}.df-col-end-3{grid-column-end:3}.df-col-end-4{grid-column-end:4}.df-col-end-5{grid-column-end:5}.df-col-end-6{grid-column-end:6}.df-col-end-7{grid-column-end:7}.df-col-end-8{grid-column-end:8}.df-col-end-9{grid-column-end:9}.df-col-end-10{grid-column-end:10}.df-col-end-11{grid-column-end:11}.df-col-end-12{grid-column-end:12}.df-col-end-13{grid-column-end:13}@media(max-width:576px){.df-form{--df-grid-gap: var(--df-grid-gap-sm);--df-grid-row-gap: var(--df-grid-row-gap-sm)}.df-row{grid-template-columns:1fr}.df-row>*{grid-column:1/-1!important}.df-row.df-row-mobile-keep-cols{grid-template-columns:repeat(var(--df-grid-columns),1fr)}.df-row.df-row-mobile-keep-cols>*{grid-column:revert!important}}@media(min-width:577px)and (max-width:768px){.df-form{--df-grid-gap: var(--df-grid-gap-md);--df-grid-row-gap: var(--df-grid-row-gap-md)}.df-row{--df-grid-columns: 6}.df-col-sm-1{grid-column:span 1}.df-col-sm-2{grid-column:span 2}.df-col-sm-3{grid-column:span 3}.df-col-sm-4{grid-column:span 4}.df-col-sm-5{grid-column:span 5}.df-col-sm-6{grid-column:span 6}.df-col-sm-full{grid-column:1/-1}}@media(min-width:769px)and (max-width:992px){.df-form{--df-grid-gap: var(--df-grid-gap-lg);--df-grid-row-gap: var(--df-grid-row-gap-lg)}.df-col-md-1{grid-column:span 1}.df-col-md-2{grid-column:span 2}.df-col-md-3{grid-column:span 3}.df-col-md-4{grid-column:span 4}.df-col-md-5{grid-column:span 5}.df-col-md-6{grid-column:span 6}.df-col-md-7{grid-column:span 7}.df-col-md-8{grid-column:span 8}.df-col-md-9{grid-column:span 9}.df-col-md-10{grid-column:span 10}.df-col-md-11{grid-column:span 11}.df-col-md-12{grid-column:span 12}.df-col-md-full{grid-column:1/-1}}@media(min-width:993px){.df-form{--df-grid-gap: var(--df-grid-gap-xl);--df-grid-row-gap: var(--df-grid-row-gap-xl)}.df-col-lg-1{grid-column:span 1}.df-col-lg-2{grid-column:span 2}.df-col-lg-3{grid-column:span 3}.df-col-lg-4{grid-column:span 4}.df-col-lg-5{grid-column:span 5}.df-col-lg-6{grid-column:span 6}.df-col-lg-7{grid-column:span 7}.df-col-lg-8{grid-column:span 8}.df-col-lg-9{grid-column:span 9}.df-col-lg-10{grid-column:span 10}.df-col-lg-11{grid-column:span 11}.df-col-lg-12{grid-column:span 12}.df-col-lg-full{grid-column:1/-1}}.df-gap-none{--df-grid-gap: 0}.df-gap-xs{--df-grid-gap: .25rem}.df-gap-sm{--df-grid-gap: .5rem}.df-gap-md{--df-grid-gap: 1rem}.df-gap-lg{--df-grid-gap: 1.5rem}.df-gap-xl{--df-grid-gap: 2rem}.df-row-gap-none{--df-grid-row-gap: 0}.df-row-gap-xs{--df-grid-row-gap: .25rem}.df-row-gap-sm{--df-grid-row-gap: .5rem}.df-row-gap-md{--df-grid-row-gap: 1rem}.df-row-gap-lg{--df-grid-row-gap: 1.5rem}.df-row-gap-xl{--df-grid-row-gap: 2rem}.df-field{display:block;width:100%;min-width:0;overflow:hidden;margin:0}.df-group,.df-page{display:block;width:100%}.df-form.disabled,.df-row.disabled,.df-field.disabled{opacity:.6;pointer-events:none}.df-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-sr-only-focusable:focus,.df-sr-only-focusable:active{position:static;width:auto;height:auto;padding:inherit;margin:inherit;overflow:visible;clip:auto;white-space:normal}.df-live-region{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-form :focus-visible{outline:2px solid var(--df-focus-color, #005fcc);outline-offset:2px}.df-group:focus-within{outline:1px dashed var(--df-focus-color, #005fcc);outline-offset:4px}:host{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}:host>*{grid-column:1/-1}:host.df-form-spacing-custom{--df-grid-row-gap: var(--form-custom-spacing, 1.5rem)}:host.df-form-gap-none{--df-grid-row-gap: 0}:host.df-form-gap-xs{--df-grid-row-gap: .25rem}:host.df-form-gap-sm{--df-grid-row-gap: .5rem}:host.df-form-gap-md{--df-grid-row-gap: 1rem}:host.df-form-gap-lg{--df-grid-row-gap: 1.5rem}:host.df-form-gap-xl{--df-grid-row-gap: 2rem}:host.df-form-paged{--df-grid-row-gap: 0}\n"], dependencies: [{ kind: "directive", type: DfFieldOutlet, selector: "[dfFieldOutlet]", inputs: ["dfFieldOutlet", "dfFieldOutletEnvironmentInjector"] }, { kind: "component", type: PageOrchestratorComponent, selector: "div[page-orchestrator]", inputs: ["pageFields", "form", "fieldSignalContext"] }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: DynamicForm, decorators: [{
            type: Component,
            args: [{ selector: 'form[dynamic-form]', imports: [DfFieldOutlet, PageOrchestratorComponent], template: `
    @if (shouldRender()) {
      @switch (formModeDetection().mode) {
        @case ('paged') {
          <div page-orchestrator [pageFields]="pageFieldDefinitions()" [form]="form()" [fieldSignalContext]="fieldSignalContext()"></div>
        }
        @case ('non-paged') {
          @for (field of resolvedFields(); track field.key) {
            <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
          }
        }
        @default {
          never;
        }
      }
    }
  `, providers: [provideDynamicFormDI()], host: {
                        class: 'df-dynamic-form df-form',
                        novalidate: '', // Disable browser validation - Angular Signal Forms handles validation
                        '[class.disabled]': 'disabled()',
                        '[class.df-form-paged]': 'formModeDetection().mode === "paged"',
                        '[class.df-form-non-paged]': 'formModeDetection().mode === "non-paged"',
                        '[attr.data-form-mode]': 'formModeDetection().mode',
                        '(submit)': 'onNativeSubmit($event)',
                    }, changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host,.df-form{--df-grid-columns: 12;--df-grid-gap: .5rem;--df-grid-row-gap: .5rem;--df-breakpoint-sm: 576px;--df-breakpoint-md: 768px;--df-breakpoint-lg: 992px;--df-breakpoint-xl: 1200px;--df-grid-gap-sm: .5rem;--df-grid-gap-md: .5rem;--df-grid-gap-lg: .5rem;--df-grid-gap-xl: .5rem;--df-grid-row-gap-sm: .5rem;--df-grid-row-gap-md: .5rem;--df-grid-row-gap-lg: .5rem;--df-grid-row-gap-xl: .5rem;--df-array-item-gap: var(--df-grid-row-gap);--df-group-gap: var(--df-grid-gap);--df-group-padding: var(--df-grid-gap)}.df-form{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}.df-form>*{grid-column:1/-1}.df-row{display:grid;grid-template-columns:repeat(var(--df-grid-columns, 12),1fr);gap:var(--df-grid-gap);align-items:start;width:100%}.df-row>*:not([class*=df-col-]){grid-column:1/-1}.df-col-1{grid-column:span 1}.df-col-2{grid-column:span 2}.df-col-3{grid-column:span 3}.df-col-4{grid-column:span 4}.df-col-5{grid-column:span 5}.df-col-6{grid-column:span 6}.df-col-7{grid-column:span 7}.df-col-8{grid-column:span 8}.df-col-9{grid-column:span 9}.df-col-10{grid-column:span 10}.df-col-11{grid-column:span 11}.df-col-12{grid-column:span 12}.df-col-auto{grid-column:span auto;width:auto}.df-col-full{grid-column:1/-1}.df-col-start-1{grid-column-start:1}.df-col-start-2{grid-column-start:2}.df-col-start-3{grid-column-start:3}.df-col-start-4{grid-column-start:4}.df-col-start-5{grid-column-start:5}.df-col-start-6{grid-column-start:6}.df-col-start-7{grid-column-start:7}.df-col-start-8{grid-column-start:8}.df-col-start-9{grid-column-start:9}.df-col-start-10{grid-column-start:10}.df-col-start-11{grid-column-start:11}.df-col-start-12{grid-column-start:12}.df-col-end-1{grid-column-end:1}.df-col-end-2{grid-column-end:2}.df-col-end-3{grid-column-end:3}.df-col-end-4{grid-column-end:4}.df-col-end-5{grid-column-end:5}.df-col-end-6{grid-column-end:6}.df-col-end-7{grid-column-end:7}.df-col-end-8{grid-column-end:8}.df-col-end-9{grid-column-end:9}.df-col-end-10{grid-column-end:10}.df-col-end-11{grid-column-end:11}.df-col-end-12{grid-column-end:12}.df-col-end-13{grid-column-end:13}@media(max-width:576px){.df-form{--df-grid-gap: var(--df-grid-gap-sm);--df-grid-row-gap: var(--df-grid-row-gap-sm)}.df-row{grid-template-columns:1fr}.df-row>*{grid-column:1/-1!important}.df-row.df-row-mobile-keep-cols{grid-template-columns:repeat(var(--df-grid-columns),1fr)}.df-row.df-row-mobile-keep-cols>*{grid-column:revert!important}}@media(min-width:577px)and (max-width:768px){.df-form{--df-grid-gap: var(--df-grid-gap-md);--df-grid-row-gap: var(--df-grid-row-gap-md)}.df-row{--df-grid-columns: 6}.df-col-sm-1{grid-column:span 1}.df-col-sm-2{grid-column:span 2}.df-col-sm-3{grid-column:span 3}.df-col-sm-4{grid-column:span 4}.df-col-sm-5{grid-column:span 5}.df-col-sm-6{grid-column:span 6}.df-col-sm-full{grid-column:1/-1}}@media(min-width:769px)and (max-width:992px){.df-form{--df-grid-gap: var(--df-grid-gap-lg);--df-grid-row-gap: var(--df-grid-row-gap-lg)}.df-col-md-1{grid-column:span 1}.df-col-md-2{grid-column:span 2}.df-col-md-3{grid-column:span 3}.df-col-md-4{grid-column:span 4}.df-col-md-5{grid-column:span 5}.df-col-md-6{grid-column:span 6}.df-col-md-7{grid-column:span 7}.df-col-md-8{grid-column:span 8}.df-col-md-9{grid-column:span 9}.df-col-md-10{grid-column:span 10}.df-col-md-11{grid-column:span 11}.df-col-md-12{grid-column:span 12}.df-col-md-full{grid-column:1/-1}}@media(min-width:993px){.df-form{--df-grid-gap: var(--df-grid-gap-xl);--df-grid-row-gap: var(--df-grid-row-gap-xl)}.df-col-lg-1{grid-column:span 1}.df-col-lg-2{grid-column:span 2}.df-col-lg-3{grid-column:span 3}.df-col-lg-4{grid-column:span 4}.df-col-lg-5{grid-column:span 5}.df-col-lg-6{grid-column:span 6}.df-col-lg-7{grid-column:span 7}.df-col-lg-8{grid-column:span 8}.df-col-lg-9{grid-column:span 9}.df-col-lg-10{grid-column:span 10}.df-col-lg-11{grid-column:span 11}.df-col-lg-12{grid-column:span 12}.df-col-lg-full{grid-column:1/-1}}.df-gap-none{--df-grid-gap: 0}.df-gap-xs{--df-grid-gap: .25rem}.df-gap-sm{--df-grid-gap: .5rem}.df-gap-md{--df-grid-gap: 1rem}.df-gap-lg{--df-grid-gap: 1.5rem}.df-gap-xl{--df-grid-gap: 2rem}.df-row-gap-none{--df-grid-row-gap: 0}.df-row-gap-xs{--df-grid-row-gap: .25rem}.df-row-gap-sm{--df-grid-row-gap: .5rem}.df-row-gap-md{--df-grid-row-gap: 1rem}.df-row-gap-lg{--df-grid-row-gap: 1.5rem}.df-row-gap-xl{--df-grid-row-gap: 2rem}.df-field{display:block;width:100%;min-width:0;overflow:hidden;margin:0}.df-group,.df-page{display:block;width:100%}.df-form.disabled,.df-row.disabled,.df-field.disabled{opacity:.6;pointer-events:none}.df-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-sr-only-focusable:focus,.df-sr-only-focusable:active{position:static;width:auto;height:auto;padding:inherit;margin:inherit;overflow:visible;clip:auto;white-space:normal}.df-live-region{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-form :focus-visible{outline:2px solid var(--df-focus-color, #005fcc);outline-offset:2px}.df-group:focus-within{outline:1px dashed var(--df-focus-color, #005fcc);outline-offset:4px}:host{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}:host>*{grid-column:1/-1}:host.df-form-spacing-custom{--df-grid-row-gap: var(--form-custom-spacing, 1.5rem)}:host.df-form-gap-none{--df-grid-row-gap: 0}:host.df-form-gap-xs{--df-grid-row-gap: .25rem}:host.df-form-gap-sm{--df-grid-row-gap: .5rem}:host.df-form-gap-md{--df-grid-row-gap: 1rem}:host.df-form-gap-lg{--df-grid-row-gap: 1.5rem}:host.df-form-gap-xl{--df-grid-row-gap: 2rem}:host.df-form-paged{--df-grid-row-gap: 0}\n"] }]
        }], ctorParameters: () => [], propDecorators: { config: [{ type: i0.Input, args: [{ isSignal: true, alias: "dynamic-form", required: true }] }], formOptions: [{ type: i0.Input, args: [{ isSignal: true, alias: "formOptions", required: false }] }], value: [{ type: i0.Input, args: [{ isSignal: true, alias: "value", required: false }] }, { type: i0.Output, args: ["valueChange"] }], validityChange: [{ type: i0.Output, args: ["validityChange"] }], dirtyChange: [{ type: i0.Output, args: ["dirtyChange"] }], submitted: [{ type: i0.Output, args: ["submitted"] }], reset: [{ type: i0.Output, args: ["reset"] }], cleared: [{ type: i0.Output, args: ["cleared"] }], events: [{ type: i0.Output, args: ["events"] }], initialized: [{ type: i0.Output, args: ["initialized"] }], onPageChange: [{ type: i0.Output, args: ["onPageChange"] }], onPageNavigationStateChange: [{ type: i0.Output, args: ["onPageNavigationStateChange"] }] } });
/**
 * Recursively counts container fields (page, row, group, array, wrapper) in a field tree.
 * Descends into container children including array item templates to ensure
 * nested containers are counted for accurate initialization tracking.
 */
function countContainersRecursive(fields) {
    let count = 0;
    for (const field of fields) {
        if (isContainerField(field)) {
            count += 1;
            if (hasChildFields(field)) {
                const children = field.fields;
                if (Array.isArray(children)) {
                    for (const child of children) {
                        if (Array.isArray(child)) {
                            // Array item template: FieldDef[] (object items)
                            count += countContainersRecursive(child);
                        }
                        else if (child != null && isContainerField(child)) {
                            count += countContainersRecursive([child]);
                        }
                    }
                }
            }
        }
    }
    return count;
}

/**
 * No-op logger for when no logger is provided.
 * Used as fallback in button logic evaluation to avoid breaking downstream packages.
 */
const noOpLogger = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    debug: () => { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    info: () => { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    warn: () => { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    error: () => { },
};
/**
 * Default options for submit button disabled behavior.
 */
const DEFAULT_SUBMIT_BUTTON_OPTIONS = {
    disableWhenInvalid: true,
    disableWhileSubmitting: true,
};
/**
 * Default options for next button disabled behavior.
 */
const DEFAULT_NEXT_BUTTON_OPTIONS = {
    disableWhenPageInvalid: true,
    disableWhileSubmitting: true,
};
/**
 * Evaluates a FormStateCondition against the current form/page state.
 *
 * @param condition - The form state condition to evaluate
 * @param ctx - The button logic context
 * @returns true if the condition is met (button should be disabled)
 */
function evaluateFormStateCondition(condition, ctx) {
    const form = ctx.form();
    switch (condition) {
        case 'formInvalid':
            return !form.valid();
        case 'formSubmitting':
            return form.submitting();
        case 'pageInvalid':
            return ctx.currentPageValid ? !ctx.currentPageValid() : false;
        default:
            return false;
    }
}
/**
 * Evaluates a single logic condition (boolean, FormStateCondition, or ConditionalExpression).
 *
 * @param condition - The condition to evaluate
 * @param ctx - The button logic context
 * @returns true if the condition is met
 */
function evaluateLogicCondition(condition, ctx) {
    // Boolean condition
    if (typeof condition === 'boolean') {
        return condition;
    }
    // FormStateCondition (string)
    if (isFormStateCondition(condition)) {
        return evaluateFormStateCondition(condition, ctx);
    }
    // ConditionalExpression
    const formValue = (ctx.formValue ?? ctx.form().value());
    const evaluationContext = {
        fieldValue: undefined,
        formValue,
        fieldPath: '',
        logger: ctx.logger ?? noOpLogger,
    };
    return evaluateCondition(condition, evaluationContext);
}
/**
 * Checks if any disabled logic condition is met in the field's logic array.
 *
 * @param fieldLogic - Array of logic configurations
 * @param ctx - The button logic context
 * @returns true if any disabled condition is met
 */
function hasFieldLevelDisabledCondition(fieldLogic, ctx) {
    if (!fieldLogic || fieldLogic.length === 0) {
        return false;
    }
    return fieldLogic.filter((logic) => logic.type === 'disabled').some((logic) => evaluateLogicCondition(logic.condition, ctx));
}
/**
 * Checks if the field has custom logic of a specific type.
 *
 * @param fieldLogic - Array of logic configurations
 * @param logicType - The type of logic to check for ('hidden', 'disabled', 'readonly', 'required')
 * @returns true if field has logic of the specified type
 */
function hasCustomLogicOfType(fieldLogic, logicType) {
    if (!fieldLogic || fieldLogic.length === 0) {
        return false;
    }
    return fieldLogic.some((logic) => logic.type === logicType);
}
/**
 * Evaluates all logic conditions of a specific type and returns true if any condition is met.
 *
 * @param fieldLogic - Array of logic configurations
 * @param logicType - The type of logic to evaluate ('hidden', 'disabled', 'readonly', 'required')
 * @param ctx - Context containing form and formValue for evaluation
 * @returns true if any condition of the specified type is met
 */
function evaluateLogicOfType(fieldLogic, logicType, ctx) {
    if (!fieldLogic || fieldLogic.length === 0) {
        return false;
    }
    const buttonCtx = {
        form: ctx.form,
        formValue: ctx.formValue,
        logger: ctx.logger,
    };
    return fieldLogic.filter((logic) => logic.type === logicType).some((logic) => evaluateLogicCondition(logic.condition, buttonCtx));
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
function resolveSubmitButtonDisabled(ctx) {
    return computed(() => {
        // 1. Explicit disabled always wins
        if (ctx.explicitlyDisabled) {
            return true;
        }
        // 2. If field has custom disabled logic, use it exclusively
        if (hasCustomLogicOfType(ctx.fieldLogic, 'disabled')) {
            return hasFieldLevelDisabledCondition(ctx.fieldLogic, ctx);
        }
        // 3. Apply form-level defaults
        const options = {
            ...DEFAULT_SUBMIT_BUTTON_OPTIONS,
            ...ctx.formOptions?.submitButton,
        };
        const form = ctx.form();
        if (options.disableWhenInvalid && !form.valid()) {
            return true;
        }
        if (options.disableWhileSubmitting && form.submitting()) {
            return true;
        }
        return false;
    });
}
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
function resolveNextButtonDisabled(ctx) {
    return computed(() => {
        // 1. Explicit disabled always wins
        if (ctx.explicitlyDisabled) {
            return true;
        }
        // 2. If field has custom disabled logic, use it exclusively
        if (hasCustomLogicOfType(ctx.fieldLogic, 'disabled')) {
            return hasFieldLevelDisabledCondition(ctx.fieldLogic, ctx);
        }
        // 3. Apply form-level defaults
        const options = {
            ...DEFAULT_NEXT_BUTTON_OPTIONS,
            ...ctx.formOptions?.nextButton,
        };
        const form = ctx.form();
        if (options.disableWhenPageInvalid && ctx.currentPageValid && !ctx.currentPageValid()) {
            return true;
        }
        if (options.disableWhileSubmitting && form.submitting()) {
            return true;
        }
        return false;
    });
}
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
function evaluateNonFieldHidden(ctx) {
    // 1. Explicit hidden always wins
    if (ctx.explicitValue) {
        return true;
    }
    // 2. Evaluate hidden logic conditions
    if (hasCustomLogicOfType(ctx.fieldLogic, 'hidden')) {
        return evaluateLogicOfType(ctx.fieldLogic, 'hidden', {
            form: ctx.form,
            formValue: ctx.formValue,
            logger: ctx.logger,
        });
    }
    // 3. No hidden conditions - element is visible
    return false;
}
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
function resolveNonFieldHidden(ctx) {
    return computed(() => evaluateNonFieldHidden(ctx));
}
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
function evaluateNonFieldDisabled(ctx) {
    // 1. Explicit disabled always wins
    if (ctx.explicitValue) {
        return true;
    }
    // 2. Evaluate disabled logic conditions
    if (hasCustomLogicOfType(ctx.fieldLogic, 'disabled')) {
        return evaluateLogicOfType(ctx.fieldLogic, 'disabled', {
            form: ctx.form,
            formValue: ctx.formValue,
            logger: ctx.logger,
        });
    }
    // 3. No disabled conditions - element is enabled
    return false;
}
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
function resolveNonFieldDisabled(ctx) {
    return computed(() => evaluateNonFieldDisabled(ctx));
}

/**
 * Applies hidden logic to a mapper's input record.
 *
 * Evaluates the field's `hidden` property and `logic` array to determine
 * if the component should be hidden. Only runs evaluation when there's
 * actually something to evaluate (explicit `hidden: true` or logic with type 'hidden').
 *
 * @param inputs The mutable input record to potentially add `hidden` to
 * @param fieldDef The field definition containing `hidden` and `logic`
 * @param rootFormRegistry The root form registry for accessing form state
 */
function applyHiddenLogic(inputs, fieldDef, rootFormRegistry) {
    const rootForm = rootFormRegistry.rootForm();
    if (rootForm && (fieldDef.hidden === true || fieldDef.logic?.some((l) => l.type === 'hidden'))) {
        // Cast is safe: evaluateNonFieldHidden only reads the array, never mutates it.
        // The readonly + union type from container/leaf field definitions is compatible at runtime.
        inputs['hidden'] = evaluateNonFieldHidden({
            form: rootForm,
            fieldLogic: fieldDef.logic,
            explicitValue: fieldDef.hidden,
            formValue: rootFormRegistry.formValue(),
        });
    }
}

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
function arrayFieldMapper(fieldDef) {
    const rootFormRegistry = inject(RootFormRegistryService);
    const className = buildClassName(fieldDef);
    return computed(() => {
        const inputs = {
            key: fieldDef.key,
            field: fieldDef,
            ...(className !== undefined && { className }),
        };
        applyHiddenLogic(inputs, fieldDef, rootFormRegistry);
        return inputs;
    });
}

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
function groupFieldMapper(fieldDef) {
    const rootFormRegistry = inject(RootFormRegistryService);
    const className = buildClassName(fieldDef);
    return computed(() => {
        const inputs = {
            key: fieldDef.key,
            field: fieldDef,
            ...(className !== undefined && { className }),
        };
        applyHiddenLogic(inputs, fieldDef, rootFormRegistry);
        return inputs;
    });
}

const ROW_WRAPPERS = [{ type: 'row' }];
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
function rowFieldMapper(fieldDef) {
    const rootFormRegistry = inject(RootFormRegistryService);
    const className = buildClassName(fieldDef);
    return computed(() => {
        // Rebuilt each emission so logic-driven updates to fieldDef (e.g. `disabled`)
        // flow through. Shallow spread is safe while RowField has no nested
        // mutable props; add a deep-clone if that stops being true.
        const containerField = { ...fieldDef, wrappers: ROW_WRAPPERS };
        const inputs = {
            key: fieldDef.key,
            field: containerField,
            ...(className !== undefined && { className }),
        };
        applyHiddenLogic(inputs, fieldDef, rootFormRegistry);
        return inputs;
    });
}

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
function pageFieldMapper(fieldDef) {
    const className = buildClassName(fieldDef);
    // Page inputs are static (no reactive dependencies)
    return computed(() => ({
        key: fieldDef.key,
        field: fieldDef,
        ...(className !== undefined && { className }),
    }));
}

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
function textFieldMapper(fieldDef) {
    const rootFormRegistry = inject(RootFormRegistryService);
    const defaultProps = inject(DEFAULT_PROPS);
    // Return computed signal for reactive updates
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps());
        const inputs = { ...baseInputs };
        applyHiddenLogic(inputs, fieldDef, rootFormRegistry);
        return inputs;
    });
}

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
function containerFieldMapper(fieldDef) {
    const rootFormRegistry = inject(RootFormRegistryService);
    const className = buildClassName(fieldDef);
    return computed(() => {
        // Nullify wrapper-related props on the field passed to the container
        // component — DfFieldOutlet handles field-level wrappers at the outlet
        // level. Passing them here would cause double-wrapping since the
        // container's internal wrapper chain also resolves from `this.field()`.
        // We set wrappers to undefined (not stripped) so the object identity
        // stays close to the original fieldDef shape.
        const containerField = { ...fieldDef, wrappers: undefined, skipAutoWrappers: undefined, skipDefaultWrappers: undefined };
        const inputs = {
            key: fieldDef.key,
            field: containerField,
            ...(className !== undefined && { className }),
        };
        applyHiddenLogic(inputs, fieldDef, rootFormRegistry);
        return inputs;
    });
}

/**
 * Built-in field types provided by the dynamic form library.
 *
 * These core field types handle form structure and layout. They are automatically
 * registered when using provideDynamicForm() and form the foundation for building
 * complex form layouts with nested fields and multi-step flows.
 *
 * @example
 * ```typescript
 * // Row field for horizontal layout
 * { type: 'row', fields: [
 *   { type: 'input', key: 'firstName' },
 *   { type: 'input', key: 'lastName' }
 * ]}
 *
 * // Group field for nested form sections
 * { type: 'group', key: 'address', fields: [
 *   { type: 'input', key: 'street' },
 *   { type: 'input', key: 'city' }
 * ]}
 *
 * // Array field for array-based form sections
 * { type: 'array', key: 'items', fields: [
 *   { type: 'input', key: 'name' },
 *   { type: 'input', key: 'quantity' }
 * ]}
 *
 * // Page field for multi-step forms
 * { type: 'page', key: 'step1', fields: [...] }
 * ```
 */
/**
 * Base field type definitions for fields that don't use the `field` input.
 * Used by display-only fields like `text` that render immediately without
 * waiting for form value integration.
 */
const DISPLAY_FIELD_TYPES_BASE = {
    renderReadyWhen: [],
};
/**
 * Built-in field types provided by the dynamic form library.
 *
 * Each field type is validated at compile time using satisfies, ensuring
 * type safety of the mapper function while allowing the array to be typed
 * as FieldTypeDefinition[] for consumer flexibility.
 */
const BUILT_IN_FIELDS = [
    {
        name: 'row',
        // `row` is a virtual field type: it maps to ContainerFieldComponent, and
        // the rowFieldMapper injects a `{ type: 'row' }` wrapper so the container
        // renders the flex/grid layout via RowWrapperComponent.
        loadComponent: () => Promise.resolve().then(function () { return containerField_component; }),
        mapper: rowFieldMapper,
        valueHandling: 'flatten',
    },
    {
        name: 'group',
        loadComponent: () => Promise.resolve().then(function () { return groupField_component; }),
        mapper: groupFieldMapper,
        valueHandling: 'include',
    },
    {
        name: 'array',
        loadComponent: () => Promise.resolve().then(function () { return arrayField_component; }),
        mapper: arrayFieldMapper,
        valueHandling: 'include',
    },
    {
        name: 'page',
        loadComponent: () => import('./ng-forge-dynamic-forms-page-field.component-DBAfZgLg.mjs'),
        mapper: pageFieldMapper,
        valueHandling: 'flatten',
    },
    {
        name: 'text',
        loadComponent: () => import('./ng-forge-dynamic-forms-text-field.component-DhiJolcc.mjs'),
        mapper: textFieldMapper,
        valueHandling: 'exclude',
        ...DISPLAY_FIELD_TYPES_BASE,
    },
    {
        name: 'hidden',
        // Componentless field - no loadComponent or mapper needed
        valueHandling: 'include',
    },
    {
        name: 'container',
        loadComponent: () => Promise.resolve().then(function () { return containerField_component; }),
        mapper: containerFieldMapper,
        valueHandling: 'flatten',
    },
];
const BUILT_IN_WRAPPERS = [
    {
        wrapperName: 'css',
        loadComponent: () => import('./ng-forge-dynamic-forms-css-wrapper.component-Du7Eem4x.mjs'),
    },
    {
        wrapperName: 'row',
        loadComponent: () => import('./ng-forge-dynamic-forms-row-wrapper.component-CfrTITlr.mjs'),
    },
];

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
function createWrappers(...registrations) {
    return {
        ɵkind: 'wrappers',
        ɵregistrations: registrations,
        ɵdefinitions: registrations.map(({ wrapperName, loadComponent, types }) => ({
            wrapperName,
            loadComponent,
            types,
        })),
    };
}
/** Type guard for a `WrappersBundle`. */
function isWrappersBundle(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'ɵkind' in value &&
        value.ɵkind === 'wrappers' &&
        'ɵdefinitions' in value &&
        Array.isArray(value.ɵdefinitions));
}

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
function provideDynamicForm(...items) {
    // Separate field types, wrapper types, wrapper bundles, and features
    const fieldTypes = items.filter((item) => !isDynamicFormFeature(item) && !isWrapperTypeDefinition(item) && !isWrappersBundle(item));
    const wrapperTypes = items.filter(isWrapperTypeDefinition);
    const wrapperBundles = items.filter(isWrappersBundle);
    const features = items.filter(isDynamicFormFeature);
    const fields = [...BUILT_IN_FIELDS, ...fieldTypes];
    const wrappers = [...BUILT_IN_WRAPPERS, ...wrapperTypes, ...wrapperBundles.flatMap((bundle) => bundle.ɵdefinitions)];
    // Extract config providers from field type arrays
    const configProviders = [];
    fieldTypes.forEach((fieldTypeArray) => {
        const fieldTypeWithConfig = fieldTypeArray;
        if (fieldTypeWithConfig.__configProviders) {
            configProviders.push(...fieldTypeWithConfig.__configProviders);
        }
    });
    // Extract providers from features
    const featureProviders = [];
    const hasLoggerFeature = features.some((feature) => feature.ɵkind === 'logger');
    features.forEach((feature) => {
        featureProviders.push(...feature.ɵproviders);
    });
    // Default logger provider (ConsoleLogger) if no logger feature was provided
    const defaultLoggerProvider = hasLoggerFeature ? [] : [{ provide: DynamicFormLogger, useValue: new ConsoleLogger() }];
    return makeEnvironmentProviders([
        ...defaultLoggerProvider,
        // Always provide default Signal Forms classes (ng-touched, ng-invalid, etc.)
        provideSignalFormsConfig({ classes: NG_STATUS_CLASSES }),
        {
            provide: FIELD_REGISTRY,
            useFactory: () => {
                const logger = inject(DynamicFormLogger);
                const registry = new Map();
                // Add custom field types
                fields.forEach((fieldType) => {
                    if (registry.has(fieldType.name)) {
                        logger.warn(`Field type "${fieldType.name}" is already registered. Overwriting.`);
                    }
                    registry.set(fieldType.name, fieldType);
                });
                return registry;
            },
        },
        // Always provide default Wrapper classes
        {
            provide: WRAPPER_REGISTRY,
            useFactory: () => {
                const logger = inject(DynamicFormLogger);
                const registry = new Map();
                // Add custom wrapper types
                wrappers.forEach((wrapperType) => {
                    if (registry.has(wrapperType.wrapperName)) {
                        logger.warn(`Wrapper type "${wrapperType.wrapperName}" is already registered. Overwriting.`);
                    }
                    registry.set(wrapperType.wrapperName, wrapperType);
                });
                return registry;
            },
        },
        // Pre-computed reverse index for auto-association lookup — built once so
        // resolveWrappers is O(1) per field render instead of scanning every
        // registered wrapper.
        {
            provide: WRAPPER_AUTO_ASSOCIATIONS,
            useFactory: () => {
                const autoMap = new Map();
                for (const wrapperType of wrappers) {
                    if (!wrapperType.types)
                        continue;
                    for (const fieldType of wrapperType.types) {
                        const existing = autoMap.get(fieldType) ?? [];
                        existing.push({ type: wrapperType.wrapperName });
                        autoMap.set(fieldType, existing);
                    }
                }
                return autoMap;
            },
        },
        ...configProviders,
        ...featureProviders,
    ]);
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
function withEventFormValue() {
    return createFeature('event-form-value', [{ provide: EMIT_FORM_VALUE_ON_EVENTS, useValue: true }]);
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
function hasFormValue(event) {
    return 'formValue' in event && event.formValue !== undefined;
}

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
function withValueExclusionDefaults(config) {
    const resolved = {
        excludeValueIfHidden: config?.excludeValueIfHidden ?? true,
        excludeValueIfDisabled: config?.excludeValueIfDisabled ?? true,
        excludeValueIfReadonly: config?.excludeValueIfReadonly ?? true,
    };
    return createFeature('value-exclusion', [{ provide: VALUE_EXCLUSION_DEFAULTS, useValue: resolved }]);
}

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
function wrapperProps() {
    return undefined;
}

function isValueField(field) {
    return 'value' in field;
}

function isCheckedField(field) {
    return field.type === 'checkbox';
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
function arrayEvent(arrayKey) {
    return {
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
        append: (template) => new AppendArrayItemEvent(arrayKey, template),
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
        prepend: (template) => new PrependArrayItemEvent(arrayKey, template),
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
        insertAt: (index, template) => new InsertArrayItemEvent(arrayKey, index, template),
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
        pop: () => new PopArrayItemEvent(arrayKey),
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
        shift: () => new ShiftArrayItemEvent(arrayKey),
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
        removeAt: (index) => new RemoveAtIndexEvent(arrayKey, index),
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
        move: (from, to) => new MoveArrayItemEvent(arrayKey, from, to),
    };
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
function resolveTokens(args, context) {
    return args.map((arg) => {
        // Only process string tokens
        if (typeof arg !== 'string') {
            return arg;
        }
        // Check for token patterns
        switch (arg) {
            case '$key':
                return context.key;
            case '$index':
                return context.index;
            case '$arrayKey':
                return context.arrayKey;
            case '$template':
                return context.template;
            case 'formValue':
                return context.formValue;
            default:
                // Return as-is if not a recognized token
                return arg;
        }
    });
}

// Event classes (from constants)

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
function formConfig(config) {
    return config;
}

/**
 * Container field types that do NOT support labels
 */
const CONTAINER_TYPES = ['group', 'row', 'array', 'container'];
/**
 * Container and page field types that only support 'hidden' logic
 */
const HIDDEN_ONLY_LOGIC_TYPES = ['group', 'row', 'array', 'container', 'page'];
/**
 * Field types that support options at the field level
 */
const OPTION_FIELD_TYPES = ['select', 'radio', 'multi-checkbox'];
/**
 * Field type that uses minValue/maxValue instead of min/max in props
 */
const SLIDER_TYPE = 'slider';
/**
 * Hidden field type - no logic, no validators, no label
 */
const HIDDEN_TYPE = 'hidden';
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
function createField(type, config) {
    const configWithProps = config;
    // Validate key is present
    if (!configWithProps['key']) {
        throw new DynamicFormError(`createField('${type}'): 'key' property is required`);
    }
    // Container validation: no label allowed
    if (CONTAINER_TYPES.includes(type)) {
        if ('label' in configWithProps && configWithProps['label'] !== undefined) {
            throw new DynamicFormError(`createField('${type}'): Container fields (${CONTAINER_TYPES.join(', ')}) do NOT support 'label'. ` +
                `Labels go on the child fields inside the container.`);
        }
    }
    // Container + page validation: only hidden logic allowed
    if (HIDDEN_ONLY_LOGIC_TYPES.includes(type)) {
        if ('logic' in configWithProps && configWithProps['logic'] !== undefined) {
            const logic = configWithProps['logic'];
            if (Array.isArray(logic)) {
                const nonHiddenLogic = logic.filter((l) => l.type !== 'hidden');
                if (nonHiddenLogic.length > 0) {
                    throw new DynamicFormError(`createField('${type}'): Only 'hidden' logic type is supported. ` +
                        `Found unsupported logic types: ${nonHiddenLogic.map((l) => l.type).join(', ')}. ` +
                        `For other logic types, apply them to child fields instead.`);
                }
            }
        }
    }
    // Options placement validation
    if (OPTION_FIELD_TYPES.includes(type)) {
        const props = configWithProps['props'];
        if (props && 'options' in props) {
            throw new DynamicFormError(`createField('${type}'): 'options' must be at FIELD level, NOT inside 'props'. ` +
                `Move 'options' from props to the field root: { type: '${type}', key: '...', options: [...] }`);
        }
    }
    // Slider props validation
    if (type === SLIDER_TYPE) {
        const props = configWithProps['props'];
        if (props) {
            if ('min' in props || 'max' in props) {
                throw new DynamicFormError(`createField('slider'): Use 'minValue' and 'maxValue' at FIELD level, NOT 'min'/'max' in props. ` +
                    `Example: { type: 'slider', key: '...', minValue: 0, maxValue: 100, step: 1 }`);
            }
            if ('step' in props) {
                throw new DynamicFormError(`createField('slider'): Use 'step' at FIELD level, NOT in props. ` +
                    `Example: { type: 'slider', key: '...', minValue: 0, maxValue: 100, step: 1 }`);
            }
        }
    }
    // Hidden field validation
    if (type === HIDDEN_TYPE) {
        if ('logic' in configWithProps && configWithProps['logic'] !== undefined) {
            throw new DynamicFormError(`createField('hidden'): Hidden fields do NOT support 'logic'. ` + `Hidden fields are purely for passing values through the form.`);
        }
        if ('validators' in configWithProps && configWithProps['validators'] !== undefined) {
            throw new DynamicFormError(`createField('hidden'): Hidden fields do NOT support 'validators'. ` +
                `Hidden fields are purely for passing values through the form.`);
        }
        if ('required' in configWithProps && configWithProps['required']) {
            throw new DynamicFormError(`createField('hidden'): Hidden fields do NOT support 'required' validation. ` +
                `Hidden fields are purely for passing values through the form.`);
        }
        if ('label' in configWithProps && configWithProps['label'] !== undefined) {
            throw new DynamicFormError(`createField('hidden'): Hidden fields do NOT support 'label'. ` +
                `Hidden fields are not rendered and have no visual representation.`);
        }
    }
    // Array field validation
    if (type === 'array') {
        if ('template' in configWithProps) {
            throw new DynamicFormError(`createField('array'): Use 'fields' (NOT 'template') to define the array item structure. ` +
                `Example: { type: 'array', key: '...', fields: [{ type: 'group', key: 'item', fields: [...] }] }`);
        }
    }
    // Generic button validation
    if (type === 'button') {
        if (!('event' in configWithProps) || configWithProps['event'] === undefined) {
            throw new DynamicFormError(`createField('button'): Generic buttons REQUIRE the 'event' property with a FormEventConstructor. ` +
                `For common actions, use 'submit', 'next', or 'previous' instead which don't require event configuration. ` +
                `Example: { type: 'submit', key: 'submit', label: 'Submit' }`);
        }
    }
    return { type, ...config };
}
/**
 * Shorthand alias for createField
 *
 * @example
 * ```typescript
 * const nameField = field('input', { key: 'name', label: 'Name', value: '' });
 * ```
 */
const field = createField;

/**
 * Converts DynamicText (string | Observable | Signal) to Observable<string>
 * Unifies all three types into a consistent Observable stream
 *
 * @param value - The dynamic text value to convert
 * @param injector - Optional injector for signal conversion
 * @returns Observable<string> - The value as an observable stream
 */
function dynamicTextToObservable(value, injector) {
    if (value === undefined) {
        return of('');
    }
    if (isObservable(value)) {
        return value;
    }
    if (isSignal(value)) {
        return toObservable(value, { injector });
    }
    return of(String(value));
}

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
function applyMetaToElement(element, meta, previouslyApplied) {
    const newApplied = new Set();
    // Remove old attributes no longer in meta
    for (const attr of previouslyApplied) {
        if (!meta || !(attr in meta) || meta[attr] === undefined) {
            element.removeAttribute(attr);
        }
    }
    if (!meta)
        return newApplied;
    // Apply new attributes
    for (const [key, value] of Object.entries(meta)) {
        if (value === undefined || value === null)
            continue;
        element.setAttribute(key, String(value));
        newApplied.add(key);
    }
    return newApplied;
}

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
class DynamicTextPipe {
    injector = inject(Injector);
    /**
     * Transforms dynamic text input into a resolved string value
     *
     * @param value - The dynamic text value to resolve
     * @returns The resolved string value as an Observable
     */
    transform(value) {
        if (isObservable(value)) {
            return value;
        }
        if (isSignal(value)) {
            return toObservable(value, { injector: this.injector });
        }
        return of(value || '');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: DynamicTextPipe, deps: [], target: i0.ɵɵFactoryTarget.Pipe });
    static ɵpipe = i0.ɵɵngDeclarePipe({ minVersion: "14.0.0", version: "21.2.6", ngImport: i0, type: DynamicTextPipe, isStandalone: true, name: "dynamicText" });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: DynamicTextPipe, decorators: [{
            type: Pipe,
            args: [{
                    name: 'dynamicText',
                }]
        }] });

/**
 * Emits a component initialization event after the next render cycle.
 *
 * This utility is used by container components (group, row, page, array) to signal
 * that their child fields have been resolved and rendered. The event is dispatched
 * through the EventBus and is used by the initialization tracking system.
 *
 * @param eventBus - The EventBus instance to dispatch the event on
 * @param componentType - The type of component being initialized
 * @param componentKey - The unique key/id of the component
 * @param injector - The injector to use for afterNextRender scheduling
 */
function emitComponentInitialized(eventBus, componentType, componentKey, injector) {
    const logger = injector.get(DynamicFormLogger);
    afterNextRender(() => {
        try {
            eventBus.dispatch(ComponentInitializedEvent, componentType, componentKey);
        }
        catch (error) {
            logger.error(`Failed to emit initialization event for ${componentType} '${componentKey}'`, error);
        }
    }, { injector });
}

/**
 * Computes the host class string for a container component.
 *
 * All containers follow the pattern: `df-field df-{type}` + optional custom class.
 *
 * @param containerType - The CSS class suffix (e.g., 'group', 'row', 'page-field')
 * @param className - Optional custom class name to append
 * @returns The computed host class string
 */
function computeContainerHostClasses(containerType, className) {
    const base = `df-field df-${containerType}`;
    return className ? `${base} ${className}` : base;
}
/**
 * Sets up the initialization effect common to all container components.
 *
 * When resolved fields become non-empty, emits a ComponentInitializedEvent
 * via afterNextRender to signal the container is ready.
 *
 * `componentType` may be a static value or a lazy getter — the latter lets
 * virtual field types (e.g. `row`, which renders via ContainerFieldComponent)
 * preserve their original type on the emitted event instead of collapsing to
 * the host component's type.
 *
 * @param resolvedFields - Signal of resolved fields
 * @param eventBus - EventBus for dispatching initialization events
 * @param componentType - Static type, or a getter evaluated at emission time
 * @param fieldKeyFn - Function returning the field's key
 * @param injector - Injector for afterNextRender scheduling
 */
function setupContainerInitEffect(resolvedFields, eventBus, componentType, fieldKeyFn, injector) {
    const allReady = computed(() => {
        const fields = resolvedFields();
        return fields.length > 0 && fields.every((field) => field.renderReady());
    }, ...(ngDevMode ? [{ debugName: "allReady" }] : /* istanbul ignore next */ []));
    explicitEffect([allReady], ([ready]) => {
        if (ready) {
            const type = typeof componentType === 'function' ? componentType() : componentType;
            emitComponentInitialized(eventBus, type, fieldKeyFn(), injector);
        }
    });
}

/**
 * Container component for rendering nested form groups.
 *
 * Creates a scoped form context with its own validation state.
 * Child fields receive a FIELD_SIGNAL_CONTEXT scoped to this group's form instance.
 * Group values are nested under the group's key in the parent form.
 */
class GroupFieldComponent {
    // ─────────────────────────────────────────────────────────────────────────────
    // Dependencies
    // ─────────────────────────────────────────────────────────────────────────────
    destroyRef = inject(DestroyRef);
    fieldRegistry = injectFieldRegistry();
    parentFieldSignalContext = inject(FIELD_SIGNAL_CONTEXT);
    injector = inject(Injector);
    environmentInjector = inject(EnvironmentInjector);
    eventBus = inject(EventBus);
    logger = inject(DynamicFormLogger);
    // ─────────────────────────────────────────────────────────────────────────────
    // Memoized Functions
    // ─────────────────────────────────────────────────────────────────────────────
    fieldProcessors = inject(CONTAINER_FIELD_PROCESSORS);
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
    hostClasses = computed(() => computeContainerHostClasses('group', this.className()), ...(ngDevMode ? [{ debugName: "hostClasses" }] : /* istanbul ignore next */ []));
    rawFieldRegistry = computed(() => this.fieldRegistry.raw, ...(ngDevMode ? [{ debugName: "rawFieldRegistry" }] : /* istanbul ignore next */ []));
    formSetup = computed(() => {
        const groupField = this.field();
        const registry = this.rawFieldRegistry();
        if (groupField.fields && groupField.fields.length > 0) {
            const flattenedFields = this.fieldProcessors.memoizedFlattenFields(groupField.fields, registry);
            const flattenedFieldsForRendering = this.fieldProcessors.memoizedFlattenFieldsForRendering(groupField.fields, registry);
            const fieldsById = this.fieldProcessors.memoizedKeyBy(flattenedFields);
            const defaultValues = this.fieldProcessors.memoizedDefaultValues(fieldsById, registry);
            return {
                fields: flattenedFieldsForRendering,
                schemaFields: flattenedFields,
                originalFields: groupField.fields,
                defaultValues,
                registry,
            };
        }
        return {
            fields: [],
            schemaFields: [],
            originalFields: [],
            defaultValues: {},
            registry,
        };
    }, ...(ngDevMode ? [{ debugName: "formSetup" }] : /* istanbul ignore next */ []));
    defaultValues = linkedSignal(() => this.formSetup().defaultValues, ...(ngDevMode ? [{ debugName: "defaultValues" }] : /* istanbul ignore next */ []));
    /**
     * Entity computed from parent value, group key, and defaults.
     * Uses deep equality check to prevent unnecessary updates when
     * object spread creates new references with identical values.
     */
    entity = linkedSignal(() => {
        const parentValue = this.parentFieldSignalContext.value();
        const groupKey = this.field().key;
        const defaults = this.defaultValues();
        const groupValue = parentValue?.[groupKey] || {};
        return { ...defaults, ...groupValue };
    }, {
        debugName: 'GroupFieldComponent.entity',
        equal: isEqual,
    });
    form = computed(() => {
        return runInInjectionContext(this.injector, () => {
            const setup = this.formSetup();
            if (setup.schemaFields.length > 0) {
                const schema = createSchemaFromFields(setup.schemaFields, setup.registry);
                return untracked(() => form(this.entity, schema));
            }
            return untracked(() => form(this.entity));
        });
    }, ...(ngDevMode ? [{ debugName: "form" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Public State Signals
    // ─────────────────────────────────────────────────────────────────────────────
    formValue = computed(() => this.entity(), ...(ngDevMode ? [{ debugName: "formValue" }] : /* istanbul ignore next */ []));
    valid = computed(() => this.form()().valid(), ...(ngDevMode ? [{ debugName: "valid" }] : /* istanbul ignore next */ []));
    invalid = computed(() => this.form()().invalid(), ...(ngDevMode ? [{ debugName: "invalid" }] : /* istanbul ignore next */ []));
    dirty = computed(() => this.form()().dirty(), ...(ngDevMode ? [{ debugName: "dirty" }] : /* istanbul ignore next */ []));
    touched = computed(() => this.form()().touched(), ...(ngDevMode ? [{ debugName: "touched" }] : /* istanbul ignore next */ []));
    errors = computed(() => this.form()().errors(), ...(ngDevMode ? [{ debugName: "errors" }] : /* istanbul ignore next */ []));
    disabled = computed(() => this.form()().disabled(), ...(ngDevMode ? [{ debugName: "disabled" }] : /* istanbul ignore next */ []));
    nestedFieldTree = computed(() => {
        const parentForm = this.parentFieldSignalContext.form;
        const groupKey = this.field().key;
        return parentForm[groupKey];
    }, ...(ngDevMode ? [{ debugName: "nestedFieldTree" }] : /* istanbul ignore next */ []));
    groupFieldSignalContext = (() => {
        const nestedFieldTree = this.nestedFieldTree;
        return {
            injector: this.injector,
            value: this.parentFieldSignalContext.value,
            defaultValues: this.defaultValues,
            get form() {
                return nestedFieldTree() ?? {};
            },
        };
    })();
    groupInjector = Injector.create({
        parent: this.injector,
        providers: [{ provide: FIELD_SIGNAL_CONTEXT, useValue: this.groupFieldSignalContext }],
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // Outputs
    // ─────────────────────────────────────────────────────────────────────────────
    validityChange = outputFromObservable(toObservable(this.valid));
    dirtyChange = outputFromObservable(toObservable(this.dirty));
    submitted = outputFromObservable(this.eventBus.on('submit'));
    // ─────────────────────────────────────────────────────────────────────────────
    // Field Resolution
    // ─────────────────────────────────────────────────────────────────────────────
    fieldsSource = computed(() => this.formSetup().fields, ...(ngDevMode ? [{ debugName: "fieldsSource" }] : /* istanbul ignore next */ []));
    resolvedFields = derivedFromDeferred(this.fieldsSource, createFieldResolutionPipe(() => ({
        loadTypeComponent: (type) => this.fieldRegistry.loadTypeComponent(type),
        registry: this.rawFieldRegistry(),
        injector: this.groupInjector,
        destroyRef: this.destroyRef,
        onError: (fieldDef, error) => {
            const fieldKey = fieldDef.key || '<no key>';
            this.logger.error(`Failed to load component for field type '${fieldDef.type}' (key: ${fieldKey}) ` +
                `within group '${this.field().key}'. Ensure the field type is registered in your field registry.`, error);
        },
    })), { initialValue: [], injector: this.injector });
    // ─────────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────────
    constructor() {
        this.setupEffects();
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Private Methods
    // ─────────────────────────────────────────────────────────────────────────────
    setupEffects() {
        setupContainerInitEffect(this.resolvedFields, this.eventBus, 'group', () => this.field().key, this.injector);
        explicitEffect([this.nestedFieldTree, this.field], ([tree, field]) => {
            if (!tree) {
                this.logger.warn(`Group field "${field.key}" not found in parent form. ` + `Ensure the parent form schema includes this group field.`);
            }
        }, { defer: true });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: GroupFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: GroupFieldComponent, isStandalone: true, selector: "fieldset[group-field]", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, hidden: { classPropertyName: "hidden", publicName: "hidden", isSignal: true, isRequired: false, transformFunction: null } }, outputs: { validityChange: "validityChange", dirtyChange: "dirtyChange", submitted: "submitted" }, host: { attributes: { "role": "group" }, properties: { "class": "hostClasses()", "class.disabled": "disabled()", "class.df-container-hidden": "hidden()", "attr.aria-hidden": "hidden() || null", "id": "`${key()}`", "attr.data-testid": "key()" } }, ngImport: i0, template: `
    @for (field of resolvedFields(); track field.key) {
      <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
    }
  `, isInline: true, styles: [":host,.df-form{--df-grid-columns: 12;--df-grid-gap: .5rem;--df-grid-row-gap: .5rem;--df-breakpoint-sm: 576px;--df-breakpoint-md: 768px;--df-breakpoint-lg: 992px;--df-breakpoint-xl: 1200px;--df-grid-gap-sm: .5rem;--df-grid-gap-md: .5rem;--df-grid-gap-lg: .5rem;--df-grid-gap-xl: .5rem;--df-grid-row-gap-sm: .5rem;--df-grid-row-gap-md: .5rem;--df-grid-row-gap-lg: .5rem;--df-grid-row-gap-xl: .5rem;--df-array-item-gap: var(--df-grid-row-gap);--df-group-gap: var(--df-grid-gap);--df-group-padding: var(--df-grid-gap)}.df-form{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}.df-form>*{grid-column:1/-1}.df-row{display:grid;grid-template-columns:repeat(var(--df-grid-columns, 12),1fr);gap:var(--df-grid-gap);align-items:start;width:100%}.df-row>*:not([class*=df-col-]){grid-column:1/-1}.df-col-1{grid-column:span 1}.df-col-2{grid-column:span 2}.df-col-3{grid-column:span 3}.df-col-4{grid-column:span 4}.df-col-5{grid-column:span 5}.df-col-6{grid-column:span 6}.df-col-7{grid-column:span 7}.df-col-8{grid-column:span 8}.df-col-9{grid-column:span 9}.df-col-10{grid-column:span 10}.df-col-11{grid-column:span 11}.df-col-12{grid-column:span 12}.df-col-auto{grid-column:span auto;width:auto}.df-col-full{grid-column:1/-1}.df-col-start-1{grid-column-start:1}.df-col-start-2{grid-column-start:2}.df-col-start-3{grid-column-start:3}.df-col-start-4{grid-column-start:4}.df-col-start-5{grid-column-start:5}.df-col-start-6{grid-column-start:6}.df-col-start-7{grid-column-start:7}.df-col-start-8{grid-column-start:8}.df-col-start-9{grid-column-start:9}.df-col-start-10{grid-column-start:10}.df-col-start-11{grid-column-start:11}.df-col-start-12{grid-column-start:12}.df-col-end-1{grid-column-end:1}.df-col-end-2{grid-column-end:2}.df-col-end-3{grid-column-end:3}.df-col-end-4{grid-column-end:4}.df-col-end-5{grid-column-end:5}.df-col-end-6{grid-column-end:6}.df-col-end-7{grid-column-end:7}.df-col-end-8{grid-column-end:8}.df-col-end-9{grid-column-end:9}.df-col-end-10{grid-column-end:10}.df-col-end-11{grid-column-end:11}.df-col-end-12{grid-column-end:12}.df-col-end-13{grid-column-end:13}@media(max-width:576px){.df-form{--df-grid-gap: var(--df-grid-gap-sm);--df-grid-row-gap: var(--df-grid-row-gap-sm)}.df-row{grid-template-columns:1fr}.df-row>*{grid-column:1/-1!important}.df-row.df-row-mobile-keep-cols{grid-template-columns:repeat(var(--df-grid-columns),1fr)}.df-row.df-row-mobile-keep-cols>*{grid-column:revert!important}}@media(min-width:577px)and (max-width:768px){.df-form{--df-grid-gap: var(--df-grid-gap-md);--df-grid-row-gap: var(--df-grid-row-gap-md)}.df-row{--df-grid-columns: 6}.df-col-sm-1{grid-column:span 1}.df-col-sm-2{grid-column:span 2}.df-col-sm-3{grid-column:span 3}.df-col-sm-4{grid-column:span 4}.df-col-sm-5{grid-column:span 5}.df-col-sm-6{grid-column:span 6}.df-col-sm-full{grid-column:1/-1}}@media(min-width:769px)and (max-width:992px){.df-form{--df-grid-gap: var(--df-grid-gap-lg);--df-grid-row-gap: var(--df-grid-row-gap-lg)}.df-col-md-1{grid-column:span 1}.df-col-md-2{grid-column:span 2}.df-col-md-3{grid-column:span 3}.df-col-md-4{grid-column:span 4}.df-col-md-5{grid-column:span 5}.df-col-md-6{grid-column:span 6}.df-col-md-7{grid-column:span 7}.df-col-md-8{grid-column:span 8}.df-col-md-9{grid-column:span 9}.df-col-md-10{grid-column:span 10}.df-col-md-11{grid-column:span 11}.df-col-md-12{grid-column:span 12}.df-col-md-full{grid-column:1/-1}}@media(min-width:993px){.df-form{--df-grid-gap: var(--df-grid-gap-xl);--df-grid-row-gap: var(--df-grid-row-gap-xl)}.df-col-lg-1{grid-column:span 1}.df-col-lg-2{grid-column:span 2}.df-col-lg-3{grid-column:span 3}.df-col-lg-4{grid-column:span 4}.df-col-lg-5{grid-column:span 5}.df-col-lg-6{grid-column:span 6}.df-col-lg-7{grid-column:span 7}.df-col-lg-8{grid-column:span 8}.df-col-lg-9{grid-column:span 9}.df-col-lg-10{grid-column:span 10}.df-col-lg-11{grid-column:span 11}.df-col-lg-12{grid-column:span 12}.df-col-lg-full{grid-column:1/-1}}.df-gap-none{--df-grid-gap: 0}.df-gap-xs{--df-grid-gap: .25rem}.df-gap-sm{--df-grid-gap: .5rem}.df-gap-md{--df-grid-gap: 1rem}.df-gap-lg{--df-grid-gap: 1.5rem}.df-gap-xl{--df-grid-gap: 2rem}.df-row-gap-none{--df-grid-row-gap: 0}.df-row-gap-xs{--df-grid-row-gap: .25rem}.df-row-gap-sm{--df-grid-row-gap: .5rem}.df-row-gap-md{--df-grid-row-gap: 1rem}.df-row-gap-lg{--df-grid-row-gap: 1.5rem}.df-row-gap-xl{--df-grid-row-gap: 2rem}.df-field{display:block;width:100%;min-width:0;overflow:hidden;margin:0}.df-group,.df-page{display:block;width:100%}.df-form.disabled,.df-row.disabled,.df-field.disabled{opacity:.6;pointer-events:none}.df-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-sr-only-focusable:focus,.df-sr-only-focusable:active{position:static;width:auto;height:auto;padding:inherit;margin:inherit;overflow:visible;clip:auto;white-space:normal}.df-live-region{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-form :focus-visible{outline:2px solid var(--df-focus-color, #005fcc);outline-offset:2px}.df-group:focus-within{outline:1px dashed var(--df-focus-color, #005fcc);outline-offset:4px}:host{border:none;margin:0;padding:0;min-width:0;display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap, .5rem);width:100%}:host>*{grid-column:1/-1}:host.df-container-hidden{display:none}\n"], dependencies: [{ kind: "directive", type: DfFieldOutlet, selector: "[dfFieldOutlet]", inputs: ["dfFieldOutlet", "dfFieldOutletEnvironmentInjector"] }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: GroupFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'fieldset[group-field]', imports: [DfFieldOutlet], template: `
    @for (field of resolvedFields(); track field.key) {
      <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
    }
  `, host: {
                        '[class]': 'hostClasses()',
                        role: 'group',
                        '[class.disabled]': 'disabled()',
                        '[class.df-container-hidden]': 'hidden()',
                        '[attr.aria-hidden]': 'hidden() || null',
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                    }, changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host,.df-form{--df-grid-columns: 12;--df-grid-gap: .5rem;--df-grid-row-gap: .5rem;--df-breakpoint-sm: 576px;--df-breakpoint-md: 768px;--df-breakpoint-lg: 992px;--df-breakpoint-xl: 1200px;--df-grid-gap-sm: .5rem;--df-grid-gap-md: .5rem;--df-grid-gap-lg: .5rem;--df-grid-gap-xl: .5rem;--df-grid-row-gap-sm: .5rem;--df-grid-row-gap-md: .5rem;--df-grid-row-gap-lg: .5rem;--df-grid-row-gap-xl: .5rem;--df-array-item-gap: var(--df-grid-row-gap);--df-group-gap: var(--df-grid-gap);--df-group-padding: var(--df-grid-gap)}.df-form{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}.df-form>*{grid-column:1/-1}.df-row{display:grid;grid-template-columns:repeat(var(--df-grid-columns, 12),1fr);gap:var(--df-grid-gap);align-items:start;width:100%}.df-row>*:not([class*=df-col-]){grid-column:1/-1}.df-col-1{grid-column:span 1}.df-col-2{grid-column:span 2}.df-col-3{grid-column:span 3}.df-col-4{grid-column:span 4}.df-col-5{grid-column:span 5}.df-col-6{grid-column:span 6}.df-col-7{grid-column:span 7}.df-col-8{grid-column:span 8}.df-col-9{grid-column:span 9}.df-col-10{grid-column:span 10}.df-col-11{grid-column:span 11}.df-col-12{grid-column:span 12}.df-col-auto{grid-column:span auto;width:auto}.df-col-full{grid-column:1/-1}.df-col-start-1{grid-column-start:1}.df-col-start-2{grid-column-start:2}.df-col-start-3{grid-column-start:3}.df-col-start-4{grid-column-start:4}.df-col-start-5{grid-column-start:5}.df-col-start-6{grid-column-start:6}.df-col-start-7{grid-column-start:7}.df-col-start-8{grid-column-start:8}.df-col-start-9{grid-column-start:9}.df-col-start-10{grid-column-start:10}.df-col-start-11{grid-column-start:11}.df-col-start-12{grid-column-start:12}.df-col-end-1{grid-column-end:1}.df-col-end-2{grid-column-end:2}.df-col-end-3{grid-column-end:3}.df-col-end-4{grid-column-end:4}.df-col-end-5{grid-column-end:5}.df-col-end-6{grid-column-end:6}.df-col-end-7{grid-column-end:7}.df-col-end-8{grid-column-end:8}.df-col-end-9{grid-column-end:9}.df-col-end-10{grid-column-end:10}.df-col-end-11{grid-column-end:11}.df-col-end-12{grid-column-end:12}.df-col-end-13{grid-column-end:13}@media(max-width:576px){.df-form{--df-grid-gap: var(--df-grid-gap-sm);--df-grid-row-gap: var(--df-grid-row-gap-sm)}.df-row{grid-template-columns:1fr}.df-row>*{grid-column:1/-1!important}.df-row.df-row-mobile-keep-cols{grid-template-columns:repeat(var(--df-grid-columns),1fr)}.df-row.df-row-mobile-keep-cols>*{grid-column:revert!important}}@media(min-width:577px)and (max-width:768px){.df-form{--df-grid-gap: var(--df-grid-gap-md);--df-grid-row-gap: var(--df-grid-row-gap-md)}.df-row{--df-grid-columns: 6}.df-col-sm-1{grid-column:span 1}.df-col-sm-2{grid-column:span 2}.df-col-sm-3{grid-column:span 3}.df-col-sm-4{grid-column:span 4}.df-col-sm-5{grid-column:span 5}.df-col-sm-6{grid-column:span 6}.df-col-sm-full{grid-column:1/-1}}@media(min-width:769px)and (max-width:992px){.df-form{--df-grid-gap: var(--df-grid-gap-lg);--df-grid-row-gap: var(--df-grid-row-gap-lg)}.df-col-md-1{grid-column:span 1}.df-col-md-2{grid-column:span 2}.df-col-md-3{grid-column:span 3}.df-col-md-4{grid-column:span 4}.df-col-md-5{grid-column:span 5}.df-col-md-6{grid-column:span 6}.df-col-md-7{grid-column:span 7}.df-col-md-8{grid-column:span 8}.df-col-md-9{grid-column:span 9}.df-col-md-10{grid-column:span 10}.df-col-md-11{grid-column:span 11}.df-col-md-12{grid-column:span 12}.df-col-md-full{grid-column:1/-1}}@media(min-width:993px){.df-form{--df-grid-gap: var(--df-grid-gap-xl);--df-grid-row-gap: var(--df-grid-row-gap-xl)}.df-col-lg-1{grid-column:span 1}.df-col-lg-2{grid-column:span 2}.df-col-lg-3{grid-column:span 3}.df-col-lg-4{grid-column:span 4}.df-col-lg-5{grid-column:span 5}.df-col-lg-6{grid-column:span 6}.df-col-lg-7{grid-column:span 7}.df-col-lg-8{grid-column:span 8}.df-col-lg-9{grid-column:span 9}.df-col-lg-10{grid-column:span 10}.df-col-lg-11{grid-column:span 11}.df-col-lg-12{grid-column:span 12}.df-col-lg-full{grid-column:1/-1}}.df-gap-none{--df-grid-gap: 0}.df-gap-xs{--df-grid-gap: .25rem}.df-gap-sm{--df-grid-gap: .5rem}.df-gap-md{--df-grid-gap: 1rem}.df-gap-lg{--df-grid-gap: 1.5rem}.df-gap-xl{--df-grid-gap: 2rem}.df-row-gap-none{--df-grid-row-gap: 0}.df-row-gap-xs{--df-grid-row-gap: .25rem}.df-row-gap-sm{--df-grid-row-gap: .5rem}.df-row-gap-md{--df-grid-row-gap: 1rem}.df-row-gap-lg{--df-grid-row-gap: 1.5rem}.df-row-gap-xl{--df-grid-row-gap: 2rem}.df-field{display:block;width:100%;min-width:0;overflow:hidden;margin:0}.df-group,.df-page{display:block;width:100%}.df-form.disabled,.df-row.disabled,.df-field.disabled{opacity:.6;pointer-events:none}.df-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-sr-only-focusable:focus,.df-sr-only-focusable:active{position:static;width:auto;height:auto;padding:inherit;margin:inherit;overflow:visible;clip:auto;white-space:normal}.df-live-region{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-form :focus-visible{outline:2px solid var(--df-focus-color, #005fcc);outline-offset:2px}.df-group:focus-within{outline:1px dashed var(--df-focus-color, #005fcc);outline-offset:4px}:host{border:none;margin:0;padding:0;min-width:0;display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap, .5rem);width:100%}:host>*{grid-column:1/-1}:host.df-container-hidden{display:none}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], hidden: [{ type: i0.Input, args: [{ isSignal: true, alias: "hidden", required: false }] }], validityChange: [{ type: i0.Output, args: ["validityChange"] }], dirtyChange: [{ type: i0.Output, args: ["dirtyChange"] }], submitted: [{ type: i0.Output, args: ["submitted"] }] } });

var groupField_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    GroupFieldComponent: GroupFieldComponent,
    default: GroupFieldComponent
});

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
     * 3. Single-field restoreTemplate (full-API arrays restored from external values)
     * 4. Dynamically discovered key from handleAddFromEvent (empty full-API arrays)
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
        // Priority 3: Single-field restoreTemplate (full-API arrays restored from external values).
        // Mirrors handleAddFromEvent's primitive detection — a single non-flatten FieldDef is a
        // primitive item, so its key wraps the FormControl in the item context.
        const restoreTemplate = this.field().restoreTemplate ?? metadata?.restoreTemplate;
        if (restoreTemplate && !Array.isArray(restoreTemplate)) {
            const template = restoreTemplate;
            if (getFieldValueHandling(template.type, this.rawFieldRegistry()) !== 'flatten') {
                return template.key;
            }
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
     * Resolves the effective restore template for this array — the fallback used when
     * the form value contains an item with no registered template (i.e., items that
     * were neither added via event handlers nor covered by a positional entry in `fields`).
     *
     * Precedence:
     * 1. Author-supplied `restoreTemplate` on the full `ArrayField`.
     * 2. Normalization metadata — populated from `SimplifiedArrayField.template`
     *    so every simplified array gets an automatic default.
     *
     * Returns undefined when neither is configured; `createResolveItemObservable` then
     * falls back to warn-and-drop, preserving today's behavior for full-API arrays
     * that don't opt in.
     *
     * Homogeneous arrays only — all restored items receive the same template.
     */
    restoreTemplate = computed(() => {
        const metadata = getNormalizedArrayMetadata(this.field());
        const raw = this.field().restoreTemplate ?? metadata?.restoreTemplate;
        if (!raw)
            return undefined;
        return (Array.isArray(raw) ? [...raw] : [raw]);
    }, ...(ngDevMode ? [{ debugName: "restoreTemplate" }] : /* istanbul ignore next */ []));
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
     * 3. Use restoreTemplate for untracked items present in the form value
     *    (e.g., external `value.set`, parent two-way binding, initial values on a
     *    `fields: []` array). Registers the resolved item in templateRegistry so
     *    subsequent recreates use the fast Priority 1 path.
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
        // Priority 3: Use restoreTemplate fallback for untracked items in the form value.
        // Homogeneous only — every restored item receives the same template regardless of value shape.
        const restore = this.restoreTemplate();
        if (restore && restore.length > 0) {
            return resolveArrayItem({
                index,
                templates: this.withAutoRemove(restore),
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
                // Register restored template against the generated item id so subsequent
                // recreates hit Priority 1 instead of re-resolving via this branch.
                if (item)
                    this.templateRegistry.set(item.id, restore);
            }));
        }
        // Priority 4: no template available. For full-API arrays without restoreTemplate,
        // this is the intended signal that an untracked item cannot be rendered.
        this.logger.warn(`No template found for array item at index ${index}. ` +
            'Add a restoreTemplate on the ArrayField (or use the simplified array API) ' +
            'to resolve items introduced by external form-value updates.');
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: ArrayFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: ArrayFieldComponent, isStandalone: true, selector: "array-field", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, hidden: { classPropertyName: "hidden", publicName: "hidden", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "hostClasses()", "class.df-container-hidden": "hidden()", "attr.aria-hidden": "hidden() || null", "id": "`${key()}`", "attr.data-testid": "key()" } }, providers: [
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
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: ArrayFieldComponent, decorators: [{
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

var arrayField_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ArrayFieldComponent: ArrayFieldComponent,
    default: ArrayFieldComponent
});

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
class ContainerFieldComponent {
    destroyRef = inject(DestroyRef);
    fieldRegistry = injectFieldRegistry();
    injector = inject(Injector);
    environmentInjector = inject(EnvironmentInjector);
    eventBus = inject(EventBus);
    logger = inject(DynamicFormLogger);
    wrapperAutoAssociations = inject(WRAPPER_AUTO_ASSOCIATIONS);
    defaultWrappersSignal = inject(DEFAULT_WRAPPERS, { optional: true });
    childrenTpl = viewChild.required('childrenTpl', { read: TemplateRef });
    wrapperContainer = viewChild.required('wrapperContainer', { read: ViewContainerRef });
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    className = input(...(ngDevMode ? [undefined, { debugName: "className" }] : /* istanbul ignore next */ []));
    hidden = input(false, ...(ngDevMode ? [{ debugName: "hidden" }] : /* istanbul ignore next */ []));
    hostClasses = computed(() => computeContainerHostClasses('container', this.className()), ...(ngDevMode ? [{ debugName: "hostClasses" }] : /* istanbul ignore next */ []));
    disabled = computed(() => this.field().disabled || false, ...(ngDevMode ? [{ debugName: "disabled" }] : /* istanbul ignore next */ []));
    rawFieldRegistry = computed(() => this.fieldRegistry.raw, ...(ngDevMode ? [{ debugName: "rawFieldRegistry" }] : /* istanbul ignore next */ []));
    fieldsSource = computed(() => (this.field().fields || []), ...(ngDevMode ? [{ debugName: "fieldsSource" }] : /* istanbul ignore next */ []));
    resolvedFields = derivedFromDeferred(this.fieldsSource, createFieldResolutionPipe(() => ({
        loadTypeComponent: (type) => this.fieldRegistry.loadTypeComponent(type),
        registry: this.rawFieldRegistry(),
        injector: this.injector,
        destroyRef: this.destroyRef,
        onError: (fieldDef, error) => {
            const fieldKey = fieldDef.key || '<no key>';
            const containerKey = this.field().key || '<no key>';
            this.logger.error(`Failed to load component for field type '${fieldDef.type}' (key: ${fieldKey}) ` +
                `within container '${containerKey}'. Ensure the field type is registered in your field registry.`, error);
        },
    })), { initialValue: [], injector: this.injector });
    wrappers = computed(() => resolveWrappers(this.field(), this.defaultWrappersSignal?.(), this.wrapperAutoAssociations), { ...(ngDevMode ? { debugName: "wrappers" } : /* istanbul ignore next */ {}), equal: isSameWrapperChain });
    constructor() {
        // `row` is a virtual field type backed by ContainerFieldComponent — at
        // runtime the spread in rowFieldMapper preserves `type: 'row'` on the
        // field input, even though the declared type is `ContainerField`. Widen
        // here so `(events)` consumers filtering by `componentType === 'row'`
        // keep receiving emissions.
        setupContainerInitEffect(this.resolvedFields, this.eventBus, () => (this.field().type === 'row' ? 'row' : 'container'), () => this.field().key, this.injector);
        createWrapperChainController({
            vcr: this.wrapperContainer,
            wrappers: this.wrappers,
            renderInnermost: (slot) => slot.createEmbeddedView(this.childrenTpl()),
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: ContainerFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: ContainerFieldComponent, isStandalone: true, selector: "div[container-field]", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, hidden: { classPropertyName: "hidden", publicName: "hidden", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "hostClasses()", "class.disabled": "disabled()", "class.df-container-hidden": "hidden()", "attr.aria-hidden": "hidden() || null", "id": "`${key()}`", "attr.data-testid": "key()" } }, viewQueries: [{ propertyName: "childrenTpl", first: true, predicate: ["childrenTpl"], descendants: true, read: TemplateRef, isSignal: true }, { propertyName: "wrapperContainer", first: true, predicate: ["wrapperContainer"], descendants: true, read: ViewContainerRef, isSignal: true }], ngImport: i0, template: `
    <ng-template #childrenTpl>
      @for (field of resolvedFields(); track field.key) {
        <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
      }
    </ng-template>
    <ng-container #wrapperContainer></ng-container>
  `, isInline: true, styles: [":host{display:block;width:100%}:host.df-container-hidden{display:none}\n"], dependencies: [{ kind: "directive", type: DfFieldOutlet, selector: "[dfFieldOutlet]", inputs: ["dfFieldOutlet", "dfFieldOutletEnvironmentInjector"] }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: ContainerFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'div[container-field]', imports: [DfFieldOutlet], template: `
    <ng-template #childrenTpl>
      @for (field of resolvedFields(); track field.key) {
        <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
      }
    </ng-template>
    <ng-container #wrapperContainer></ng-container>
  `, host: {
                        '[class]': 'hostClasses()',
                        '[class.disabled]': 'disabled()',
                        '[class.df-container-hidden]': 'hidden()',
                        '[attr.aria-hidden]': 'hidden() || null',
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                    }, changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host{display:block;width:100%}:host.df-container-hidden{display:none}\n"] }]
        }], ctorParameters: () => [], propDecorators: { childrenTpl: [{ type: i0.ViewChild, args: ['childrenTpl', { ...{ read: TemplateRef }, isSignal: true }] }], wrapperContainer: [{ type: i0.ViewChild, args: ['wrapperContainer', { ...{ read: ViewContainerRef }, isSignal: true }] }], field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], hidden: [{ type: i0.Input, args: [{ isSignal: true, alias: "hidden", required: false }] }] } });

var containerField_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ContainerFieldComponent: ContainerFieldComponent,
    default: ContainerFieldComponent
});

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
function interpolateParams(message, error) {
    let result = message;
    const params = extractErrorParams(error);
    Object.entries(params).forEach(([key, value]) => {
        const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(placeholder, safeToString(value));
    });
    return result;
}
/**
 * Safely converts a value to a string, handling complex objects
 * @internal
 */
function safeToString(value) {
    if (value === null || value === undefined) {
        return '';
    }
    // Handle primitives directly
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    // Handle RegExp (has its own toString)
    if (value instanceof RegExp) {
        return value.toString();
    }
    // Handle Date
    if (value instanceof Date) {
        return value.toISOString();
    }
    // Handle arrays
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    // For objects, try JSON.stringify first, fall back to empty string
    try {
        // Check if object has a custom toString that's not Object.prototype.toString
        if (typeof value === 'object' && value.toString !== Object.prototype.toString) {
            return value.toString();
        }
        // Otherwise use JSON representation
        return JSON.stringify(value);
    }
    catch {
        // If JSON.stringify fails (circular reference, etc.), return empty string
        return '[object]';
    }
}
/**
 * Extracts parameter values from validation error
 * @internal
 */
function extractErrorParams(error) {
    const params = {};
    // Common validation error parameters
    if ('min' in error)
        params.min = error.min;
    if ('max' in error)
        params.max = error.max;
    if ('pattern' in error)
        params.pattern = error.pattern;
    if ('actual' in error)
        params.actual = error.actual;
    if ('expected' in error)
        params.expected = error.expected;
    // Handle length validation parameters
    // Angular Signal Forms uses 'minLength'/'maxLength' properties
    // Angular Classic Forms uses 'requiredLength'/'actualLength' properties
    // We support both formats and normalize to 'requiredLength' for message templates
    if ('requiredLength' in error) {
        params.requiredLength = error.requiredLength;
    }
    else if ('minLength' in error) {
        // Angular Signal Forms: minLength property maps to requiredLength for templates
        params.requiredLength = error.minLength;
        params.minLength = error.minLength;
    }
    else if ('maxLength' in error) {
        // Angular Signal Forms: maxLength property maps to requiredLength for templates
        params.requiredLength = error.maxLength;
        params.maxLength = error.maxLength;
    }
    if ('actualLength' in error)
        params.actualLength = error.actualLength;
    // Include all custom properties from error object (for custom validators)
    // Skip 'kind' as it's the error type identifier, not a parameter
    Object.keys(error).forEach((key) => {
        if (key !== 'kind' && !(key in params)) {
            params[key] = error[key];
        }
    });
    return params;
}

/**
 * @ng-forge/dynamic-forms
 *
 * Dynamic forms library for Angular applications.
 *
 * ## Public API (for end users)
 * - DynamicForm component
 * - provideDynamicForm() for configuration
 * - FormConfig and field definition types
 * - Event classes (SubmitEvent, PageChangeEvent, etc.)
 *
 * ## Integration API (for UI library authors)
 * Import from '@ng-forge/dynamic-forms/integration' for:
 * - Specific field types (InputField, SelectField, etc.)
 * - Field mappers (valueFieldMapper, checkboxFieldMapper, etc.)
 * - Error utilities (createResolvedErrorsSignal, shouldShowErrors)
 *
 */
// ============================================================
// PUBLIC API - For end users
// ============================================================
// Core Component

/**
 * Generated bundle index. Do not edit.
 */

export { evaluateNonFieldDisabled as $, ARRAY_CONTEXT as A, BUILT_IN_FIELDS as B, ConsoleLogger as C, DynamicFormLogger as D, EventBus as E, FIELD_REGISTRY as F, GroupFieldComponent as G, PreviousPageEvent as H, INITIALIZATION_TIMEOUT_MS as I, RootFormRegistryService as J, SubmitEvent as K, applyMetaToElement as L, MoveArrayItemEvent as M, NextPageEvent as N, applyValidator as O, PageChangeEvent as P, applyValidators as Q, RemoveAtIndexEvent as R, ShiftArrayItemEvent as S, arrayEvent as T, arrayFieldMapper as U, baseFieldMapper as V, WRAPPER_REGISTRY as W, buildBaseInputs as X, containerFieldMapper as Y, createField as Z, createWrappers as _, createFieldResolutionPipe as a, evaluateNonFieldHidden as a0, field as a1, formConfig as a2, getArrayLength as a3, groupFieldMapper as a4, hasFormValue as a5, interpolateParams as a6, isArrayField as a7, isCheckedField as a8, isContainerField as a9, withPreviousValue as aA, withValueExclusionDefaults as aB, wrapperProps as aC, isContainerTypedField as aa, isDisplayOnlyField as ab, isEqual as ac, isFormStateCondition as ad, isGroupField as ae, isLeafField as af, isPageField as ag, isRowField as ah, isSimplifiedArrayField as ai, isValueBearingField as aj, isValueField as ak, isWrapperTypeDefinition as al, isWrappersBundle as am, omit as an, pageFieldMapper as ao, provideDynamicForm as ap, resolveNextButtonDisabled as aq, resolveNonFieldDisabled as ar, resolveNonFieldHidden as as, resolveSubmitButtonDisabled as at, resolveTokens as au, rowFieldMapper as av, textFieldMapper as aw, toReadonlyFieldTree as ax, withEventFormValue as ay, withLoggerConfig as az, DfFieldOutlet as b, computeContainerHostClasses as c, derivedFromDeferred as d, DynamicTextPipe as e, dynamicTextToObservable as f, AppendArrayItemEvent as g, ArrayFieldComponent as h, injectFieldRegistry as i, ContainerFieldComponent as j, DEFAULT_PROPS as k, DEFAULT_VALIDATION_MESSAGES as l, DEFAULT_WRAPPERS as m, DynamicForm as n, DynamicFormError as o, EventDispatcher as p, FIELD_SIGNAL_CONTEXT as q, FORM_OPTIONS as r, setupContainerInitEffect as s, FormClearEvent as t, FormResetEvent as u, validatePageNesting as v, InsertArrayItemEvent as w, NoopLogger as x, PopArrayItemEvent as y, PrependArrayItemEvent as z };
//# sourceMappingURL=ng-forge-dynamic-forms-ng-forge-dynamic-forms-CWkjy84k.mjs.map
