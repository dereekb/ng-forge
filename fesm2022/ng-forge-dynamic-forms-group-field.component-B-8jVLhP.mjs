import * as i0 from '@angular/core';
import { inject, DestroyRef, Injector, EnvironmentInjector, input, computed, linkedSignal, runInInjectionContext, untracked, ChangeDetectionStrategy, Component } from '@angular/core';
import { i as injectFieldRegistry, F as FIELD_SIGNAL_CONTEXT, E as EventBus, D as DynamicFormLogger, C as CONTAINER_FIELD_PROCESSORS, g as isEqual, h as createSchemaFromFields, d as derivedFromDeferred, c as createFieldResolutionPipe, f as DfFieldOutlet } from './ng-forge-dynamic-forms-ng-forge-dynamic-forms-BjZM7I4E.mjs';
import { outputFromObservable, toObservable } from '@angular/core/rxjs-interop';
import { explicitEffect } from 'ngxtension/explicit-effect';
import { c as computeContainerHostClasses, s as setupContainerInitEffect } from './ng-forge-dynamic-forms-container-utils-D2HOGGct.mjs';
import { form } from '@angular/forms/signals';

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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.8", ngImport: i0, type: GroupFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.8", type: GroupFieldComponent, isStandalone: true, selector: "fieldset[group-field]", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, hidden: { classPropertyName: "hidden", publicName: "hidden", isSignal: true, isRequired: false, transformFunction: null } }, outputs: { validityChange: "validityChange", dirtyChange: "dirtyChange", submitted: "submitted" }, host: { attributes: { "role": "group" }, properties: { "class": "hostClasses()", "class.disabled": "disabled()", "class.df-container-hidden": "hidden()", "attr.aria-hidden": "hidden() || null", "id": "`${key()}`", "attr.data-testid": "key()" } }, ngImport: i0, template: `
    @for (field of resolvedFields(); track field.key) {
      <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
    }
  `, isInline: true, styles: [":host,.df-form{--df-grid-columns: 12;--df-grid-gap: .5rem;--df-grid-row-gap: .5rem;--df-breakpoint-sm: 576px;--df-breakpoint-md: 768px;--df-breakpoint-lg: 992px;--df-breakpoint-xl: 1200px;--df-grid-gap-sm: .5rem;--df-grid-gap-md: .5rem;--df-grid-gap-lg: .5rem;--df-grid-gap-xl: .5rem;--df-grid-row-gap-sm: .5rem;--df-grid-row-gap-md: .5rem;--df-grid-row-gap-lg: .5rem;--df-grid-row-gap-xl: .5rem;--df-array-item-gap: var(--df-grid-row-gap);--df-group-gap: var(--df-grid-gap);--df-group-padding: var(--df-grid-gap)}.df-form{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}.df-form>*{grid-column:1/-1}.df-row{display:grid;grid-template-columns:repeat(var(--df-grid-columns, 12),1fr);gap:var(--df-grid-gap);align-items:start;width:100%}.df-row>*:not([class*=df-col-]){grid-column:1/-1}.df-col-1{grid-column:span 1}.df-col-2{grid-column:span 2}.df-col-3{grid-column:span 3}.df-col-4{grid-column:span 4}.df-col-5{grid-column:span 5}.df-col-6{grid-column:span 6}.df-col-7{grid-column:span 7}.df-col-8{grid-column:span 8}.df-col-9{grid-column:span 9}.df-col-10{grid-column:span 10}.df-col-11{grid-column:span 11}.df-col-12{grid-column:span 12}.df-col-auto{grid-column:span auto;width:auto}.df-col-full{grid-column:1/-1}.df-col-start-1{grid-column-start:1}.df-col-start-2{grid-column-start:2}.df-col-start-3{grid-column-start:3}.df-col-start-4{grid-column-start:4}.df-col-start-5{grid-column-start:5}.df-col-start-6{grid-column-start:6}.df-col-start-7{grid-column-start:7}.df-col-start-8{grid-column-start:8}.df-col-start-9{grid-column-start:9}.df-col-start-10{grid-column-start:10}.df-col-start-11{grid-column-start:11}.df-col-start-12{grid-column-start:12}.df-col-end-1{grid-column-end:1}.df-col-end-2{grid-column-end:2}.df-col-end-3{grid-column-end:3}.df-col-end-4{grid-column-end:4}.df-col-end-5{grid-column-end:5}.df-col-end-6{grid-column-end:6}.df-col-end-7{grid-column-end:7}.df-col-end-8{grid-column-end:8}.df-col-end-9{grid-column-end:9}.df-col-end-10{grid-column-end:10}.df-col-end-11{grid-column-end:11}.df-col-end-12{grid-column-end:12}.df-col-end-13{grid-column-end:13}@media(max-width:576px){.df-form{--df-grid-gap: var(--df-grid-gap-sm);--df-grid-row-gap: var(--df-grid-row-gap-sm)}.df-row{grid-template-columns:1fr}.df-row>*{grid-column:1/-1!important}.df-row.df-row-mobile-keep-cols{grid-template-columns:repeat(var(--df-grid-columns),1fr)}.df-row.df-row-mobile-keep-cols>*{grid-column:revert!important}}@media(min-width:577px)and (max-width:768px){.df-form{--df-grid-gap: var(--df-grid-gap-md);--df-grid-row-gap: var(--df-grid-row-gap-md)}.df-row{--df-grid-columns: 6}.df-col-sm-1{grid-column:span 1}.df-col-sm-2{grid-column:span 2}.df-col-sm-3{grid-column:span 3}.df-col-sm-4{grid-column:span 4}.df-col-sm-5{grid-column:span 5}.df-col-sm-6{grid-column:span 6}.df-col-sm-full{grid-column:1/-1}}@media(min-width:769px)and (max-width:992px){.df-form{--df-grid-gap: var(--df-grid-gap-lg);--df-grid-row-gap: var(--df-grid-row-gap-lg)}.df-col-md-1{grid-column:span 1}.df-col-md-2{grid-column:span 2}.df-col-md-3{grid-column:span 3}.df-col-md-4{grid-column:span 4}.df-col-md-5{grid-column:span 5}.df-col-md-6{grid-column:span 6}.df-col-md-7{grid-column:span 7}.df-col-md-8{grid-column:span 8}.df-col-md-9{grid-column:span 9}.df-col-md-10{grid-column:span 10}.df-col-md-11{grid-column:span 11}.df-col-md-12{grid-column:span 12}.df-col-md-full{grid-column:1/-1}}@media(min-width:993px){.df-form{--df-grid-gap: var(--df-grid-gap-xl);--df-grid-row-gap: var(--df-grid-row-gap-xl)}.df-col-lg-1{grid-column:span 1}.df-col-lg-2{grid-column:span 2}.df-col-lg-3{grid-column:span 3}.df-col-lg-4{grid-column:span 4}.df-col-lg-5{grid-column:span 5}.df-col-lg-6{grid-column:span 6}.df-col-lg-7{grid-column:span 7}.df-col-lg-8{grid-column:span 8}.df-col-lg-9{grid-column:span 9}.df-col-lg-10{grid-column:span 10}.df-col-lg-11{grid-column:span 11}.df-col-lg-12{grid-column:span 12}.df-col-lg-full{grid-column:1/-1}}.df-gap-none{--df-grid-gap: 0}.df-gap-xs{--df-grid-gap: .25rem}.df-gap-sm{--df-grid-gap: .5rem}.df-gap-md{--df-grid-gap: 1rem}.df-gap-lg{--df-grid-gap: 1.5rem}.df-gap-xl{--df-grid-gap: 2rem}.df-row-gap-none{--df-grid-row-gap: 0}.df-row-gap-xs{--df-grid-row-gap: .25rem}.df-row-gap-sm{--df-grid-row-gap: .5rem}.df-row-gap-md{--df-grid-row-gap: 1rem}.df-row-gap-lg{--df-grid-row-gap: 1.5rem}.df-row-gap-xl{--df-grid-row-gap: 2rem}.df-field{display:block;width:100%;min-width:0;overflow:hidden;margin:0}.df-group,.df-page{display:block;width:100%}.df-form.disabled,.df-row.disabled,.df-field.disabled{opacity:.6;pointer-events:none}.df-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-sr-only-focusable:focus,.df-sr-only-focusable:active{position:static;width:auto;height:auto;padding:inherit;margin:inherit;overflow:visible;clip:auto;white-space:normal}.df-live-region{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-form :focus-visible{outline:2px solid var(--df-focus-color, #005fcc);outline-offset:2px}.df-group:focus-within{outline:1px dashed var(--df-focus-color, #005fcc);outline-offset:4px}:host{border:none;margin:0;padding:0;min-width:0;display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap, .5rem);width:100%}:host>*{grid-column:1/-1}:host.df-container-hidden{display:none}\n"], dependencies: [{ kind: "directive", type: DfFieldOutlet, selector: "[dfFieldOutlet]", inputs: ["dfFieldOutlet", "dfFieldOutletEnvironmentInjector"] }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.8", ngImport: i0, type: GroupFieldComponent, decorators: [{
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

export { GroupFieldComponent, GroupFieldComponent as default };
//# sourceMappingURL=ng-forge-dynamic-forms-group-field.component-B-8jVLhP.mjs.map
