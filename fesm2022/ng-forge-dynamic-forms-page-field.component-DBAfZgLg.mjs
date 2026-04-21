import * as i0 from '@angular/core';
import { inject, DestroyRef, Injector, EnvironmentInjector, input, computed, ChangeDetectionStrategy, Component } from '@angular/core';
import { i as injectFieldRegistry, E as EventBus, D as DynamicFormLogger, c as computeContainerHostClasses, v as validatePageNesting, d as derivedFromDeferred, a as createFieldResolutionPipe, s as setupContainerInitEffect, b as DfFieldOutlet } from './ng-forge-dynamic-forms-ng-forge-dynamic-forms-CWkjy84k.mjs';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { explicitEffect } from 'ngxtension/explicit-effect';

/**
 * Renders a single page in multi-page (wizard) forms.
 *
 * Visibility is controlled by the PageOrchestrator via the isVisible input.
 * Pages cannot be nested within other pages - validation prevents this.
 * Field values are flattened into the parent form (no nesting under page key).
 */
class PageFieldComponent {
    // ─────────────────────────────────────────────────────────────────────────────
    // Dependencies
    // ─────────────────────────────────────────────────────────────────────────────
    destroyRef = inject(DestroyRef);
    fieldRegistry = injectFieldRegistry();
    injector = inject(Injector);
    environmentInjector = inject(EnvironmentInjector);
    eventBus = inject(EventBus);
    logger = inject(DynamicFormLogger);
    // ─────────────────────────────────────────────────────────────────────────────
    // Inputs
    // ─────────────────────────────────────────────────────────────────────────────
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    className = input(...(ngDevMode ? [undefined, { debugName: "className" }] : /* istanbul ignore next */ []));
    pageIndex = input.required(...(ngDevMode ? [{ debugName: "pageIndex" }] : /* istanbul ignore next */ []));
    isVisible = input.required(...(ngDevMode ? [{ debugName: "isVisible" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Computed Signals
    // ─────────────────────────────────────────────────────────────────────────────
    hostClasses = computed(() => computeContainerHostClasses('page-field', this.className()), ...(ngDevMode ? [{ debugName: "hostClasses" }] : /* istanbul ignore next */ []));
    disabled = computed(() => this.field().disabled || false, ...(ngDevMode ? [{ debugName: "disabled" }] : /* istanbul ignore next */ []));
    isValid = computed(() => validatePageNesting(this.field()), ...(ngDevMode ? [{ debugName: "isValid" }] : /* istanbul ignore next */ []));
    rawFieldRegistry = computed(() => this.fieldRegistry.raw, ...(ngDevMode ? [{ debugName: "rawFieldRegistry" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Outputs
    // ─────────────────────────────────────────────────────────────────────────────
    nextPage = outputFromObservable(this.eventBus.on('next-page'));
    previousPage = outputFromObservable(this.eventBus.on('previous-page'));
    pageChange = outputFromObservable(this.eventBus.on('page-change'));
    // ─────────────────────────────────────────────────────────────────────────────
    // Field Resolution
    // ─────────────────────────────────────────────────────────────────────────────
    fieldsSource = computed(() => {
        if (!this.isValid()) {
            return [];
        }
        return this.field().fields || [];
    }, ...(ngDevMode ? [{ debugName: "fieldsSource" }] : /* istanbul ignore next */ []));
    resolvedFields = derivedFromDeferred(this.fieldsSource, createFieldResolutionPipe(() => ({
        loadTypeComponent: (type) => this.fieldRegistry.loadTypeComponent(type),
        registry: this.rawFieldRegistry(),
        injector: this.injector,
        destroyRef: this.destroyRef,
        onError: (fieldDef, error) => {
            const fieldKey = fieldDef.key || '<no key>';
            this.logger.error(`Failed to load component for field type '${fieldDef.type}' (key: ${fieldKey}) ` +
                `within page '${this.field().key}'. Ensure the field type is registered in your field registry.`, error);
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
        setupContainerInitEffect(this.resolvedFields, this.eventBus, 'page', () => this.field().key, this.injector);
        explicitEffect([this.isValid, this.field], ([valid, pageField]) => {
            if (!valid) {
                this.logger.error(`Invalid configuration: Page '${pageField.key}' contains nested page fields. ` +
                    `Pages cannot contain other pages. Consider using groups or rows for nested structure.`, pageField);
            }
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: PageFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: PageFieldComponent, isStandalone: true, selector: "section[page-field]", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, pageIndex: { classPropertyName: "pageIndex", publicName: "pageIndex", isSignal: true, isRequired: true, transformFunction: null }, isVisible: { classPropertyName: "isVisible", publicName: "isVisible", isSignal: true, isRequired: true, transformFunction: null } }, outputs: { nextPage: "nextPage", previousPage: "previousPage", pageChange: "pageChange" }, host: { properties: { "class": "hostClasses()", "class.disabled": "disabled()", "class.df-page-visible": "isVisible()", "class.df-page-hidden": "!isVisible()", "attr.aria-hidden": "!isVisible()", "attr.data-page-index": "pageIndex()", "id": "`${key()}`", "attr.data-testid": "key()" } }, ngImport: i0, template: `
    @for (field of resolvedFields(); track field.key) {
      <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
    }
  `, isInline: true, styles: [":host,.df-form{--df-grid-columns: 12;--df-grid-gap: .5rem;--df-grid-row-gap: .5rem;--df-breakpoint-sm: 576px;--df-breakpoint-md: 768px;--df-breakpoint-lg: 992px;--df-breakpoint-xl: 1200px;--df-grid-gap-sm: .5rem;--df-grid-gap-md: .5rem;--df-grid-gap-lg: .5rem;--df-grid-gap-xl: .5rem;--df-grid-row-gap-sm: .5rem;--df-grid-row-gap-md: .5rem;--df-grid-row-gap-lg: .5rem;--df-grid-row-gap-xl: .5rem;--df-array-item-gap: var(--df-grid-row-gap);--df-group-gap: var(--df-grid-gap);--df-group-padding: var(--df-grid-gap)}.df-form{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}.df-form>*{grid-column:1/-1}.df-row{display:grid;grid-template-columns:repeat(var(--df-grid-columns, 12),1fr);gap:var(--df-grid-gap);align-items:start;width:100%}.df-row>*:not([class*=df-col-]){grid-column:1/-1}.df-col-1{grid-column:span 1}.df-col-2{grid-column:span 2}.df-col-3{grid-column:span 3}.df-col-4{grid-column:span 4}.df-col-5{grid-column:span 5}.df-col-6{grid-column:span 6}.df-col-7{grid-column:span 7}.df-col-8{grid-column:span 8}.df-col-9{grid-column:span 9}.df-col-10{grid-column:span 10}.df-col-11{grid-column:span 11}.df-col-12{grid-column:span 12}.df-col-auto{grid-column:span auto;width:auto}.df-col-full{grid-column:1/-1}.df-col-start-1{grid-column-start:1}.df-col-start-2{grid-column-start:2}.df-col-start-3{grid-column-start:3}.df-col-start-4{grid-column-start:4}.df-col-start-5{grid-column-start:5}.df-col-start-6{grid-column-start:6}.df-col-start-7{grid-column-start:7}.df-col-start-8{grid-column-start:8}.df-col-start-9{grid-column-start:9}.df-col-start-10{grid-column-start:10}.df-col-start-11{grid-column-start:11}.df-col-start-12{grid-column-start:12}.df-col-end-1{grid-column-end:1}.df-col-end-2{grid-column-end:2}.df-col-end-3{grid-column-end:3}.df-col-end-4{grid-column-end:4}.df-col-end-5{grid-column-end:5}.df-col-end-6{grid-column-end:6}.df-col-end-7{grid-column-end:7}.df-col-end-8{grid-column-end:8}.df-col-end-9{grid-column-end:9}.df-col-end-10{grid-column-end:10}.df-col-end-11{grid-column-end:11}.df-col-end-12{grid-column-end:12}.df-col-end-13{grid-column-end:13}@media(max-width:576px){.df-form{--df-grid-gap: var(--df-grid-gap-sm);--df-grid-row-gap: var(--df-grid-row-gap-sm)}.df-row{grid-template-columns:1fr}.df-row>*{grid-column:1/-1!important}.df-row.df-row-mobile-keep-cols{grid-template-columns:repeat(var(--df-grid-columns),1fr)}.df-row.df-row-mobile-keep-cols>*{grid-column:revert!important}}@media(min-width:577px)and (max-width:768px){.df-form{--df-grid-gap: var(--df-grid-gap-md);--df-grid-row-gap: var(--df-grid-row-gap-md)}.df-row{--df-grid-columns: 6}.df-col-sm-1{grid-column:span 1}.df-col-sm-2{grid-column:span 2}.df-col-sm-3{grid-column:span 3}.df-col-sm-4{grid-column:span 4}.df-col-sm-5{grid-column:span 5}.df-col-sm-6{grid-column:span 6}.df-col-sm-full{grid-column:1/-1}}@media(min-width:769px)and (max-width:992px){.df-form{--df-grid-gap: var(--df-grid-gap-lg);--df-grid-row-gap: var(--df-grid-row-gap-lg)}.df-col-md-1{grid-column:span 1}.df-col-md-2{grid-column:span 2}.df-col-md-3{grid-column:span 3}.df-col-md-4{grid-column:span 4}.df-col-md-5{grid-column:span 5}.df-col-md-6{grid-column:span 6}.df-col-md-7{grid-column:span 7}.df-col-md-8{grid-column:span 8}.df-col-md-9{grid-column:span 9}.df-col-md-10{grid-column:span 10}.df-col-md-11{grid-column:span 11}.df-col-md-12{grid-column:span 12}.df-col-md-full{grid-column:1/-1}}@media(min-width:993px){.df-form{--df-grid-gap: var(--df-grid-gap-xl);--df-grid-row-gap: var(--df-grid-row-gap-xl)}.df-col-lg-1{grid-column:span 1}.df-col-lg-2{grid-column:span 2}.df-col-lg-3{grid-column:span 3}.df-col-lg-4{grid-column:span 4}.df-col-lg-5{grid-column:span 5}.df-col-lg-6{grid-column:span 6}.df-col-lg-7{grid-column:span 7}.df-col-lg-8{grid-column:span 8}.df-col-lg-9{grid-column:span 9}.df-col-lg-10{grid-column:span 10}.df-col-lg-11{grid-column:span 11}.df-col-lg-12{grid-column:span 12}.df-col-lg-full{grid-column:1/-1}}.df-gap-none{--df-grid-gap: 0}.df-gap-xs{--df-grid-gap: .25rem}.df-gap-sm{--df-grid-gap: .5rem}.df-gap-md{--df-grid-gap: 1rem}.df-gap-lg{--df-grid-gap: 1.5rem}.df-gap-xl{--df-grid-gap: 2rem}.df-row-gap-none{--df-grid-row-gap: 0}.df-row-gap-xs{--df-grid-row-gap: .25rem}.df-row-gap-sm{--df-grid-row-gap: .5rem}.df-row-gap-md{--df-grid-row-gap: 1rem}.df-row-gap-lg{--df-grid-row-gap: 1.5rem}.df-row-gap-xl{--df-grid-row-gap: 2rem}.df-field{display:block;width:100%;min-width:0;overflow:hidden;margin:0}.df-group,.df-page{display:block;width:100%}.df-form.disabled,.df-row.disabled,.df-field.disabled{opacity:.6;pointer-events:none}.df-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-sr-only-focusable:focus,.df-sr-only-focusable:active{position:static;width:auto;height:auto;padding:inherit;margin:inherit;overflow:visible;clip:auto;white-space:normal}.df-live-region{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-form :focus-visible{outline:2px solid var(--df-focus-color, #005fcc);outline-offset:2px}.df-group:focus-within{outline:1px dashed var(--df-focus-color, #005fcc);outline-offset:4px}:host{display:grid;grid-template-columns:1fr;width:100%;gap:var(--df-grid-row-gap);transition:opacity .2s ease-in-out}:host.df-page-spacing-custom{--df-grid-row-gap: var(--page-custom-spacing, 1.5rem)}:host.df-page-visible{opacity:1}:host.df-page-hidden{display:none;opacity:0;pointer-events:none}:host[aria-hidden=true]{pointer-events:none;visibility:hidden}@media(prefers-reduced-motion:no-preference){:host{transition:opacity .3s ease-in-out,transform .3s ease-in-out}:host.df-page-visible{transform:translate(0)}:host.df-page-hidden{transform:translate(-10px)}}@media(prefers-reduced-motion:reduce){:host{transition:none}}\n"], dependencies: [{ kind: "directive", type: DfFieldOutlet, selector: "[dfFieldOutlet]", inputs: ["dfFieldOutlet", "dfFieldOutletEnvironmentInjector"] }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: PageFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'section[page-field]', imports: [DfFieldOutlet], template: `
    @for (field of resolvedFields(); track field.key) {
      <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
    }
  `, host: {
                        '[class]': 'hostClasses()',
                        '[class.disabled]': 'disabled()',
                        '[class.df-page-visible]': 'isVisible()',
                        '[class.df-page-hidden]': '!isVisible()',
                        '[attr.aria-hidden]': '!isVisible()',
                        '[attr.data-page-index]': 'pageIndex()',
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                    }, changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host,.df-form{--df-grid-columns: 12;--df-grid-gap: .5rem;--df-grid-row-gap: .5rem;--df-breakpoint-sm: 576px;--df-breakpoint-md: 768px;--df-breakpoint-lg: 992px;--df-breakpoint-xl: 1200px;--df-grid-gap-sm: .5rem;--df-grid-gap-md: .5rem;--df-grid-gap-lg: .5rem;--df-grid-gap-xl: .5rem;--df-grid-row-gap-sm: .5rem;--df-grid-row-gap-md: .5rem;--df-grid-row-gap-lg: .5rem;--df-grid-row-gap-xl: .5rem;--df-array-item-gap: var(--df-grid-row-gap);--df-group-gap: var(--df-grid-gap);--df-group-padding: var(--df-grid-gap)}.df-form{display:grid;grid-template-columns:1fr;gap:var(--df-grid-row-gap);width:100%}.df-form>*{grid-column:1/-1}.df-row{display:grid;grid-template-columns:repeat(var(--df-grid-columns, 12),1fr);gap:var(--df-grid-gap);align-items:start;width:100%}.df-row>*:not([class*=df-col-]){grid-column:1/-1}.df-col-1{grid-column:span 1}.df-col-2{grid-column:span 2}.df-col-3{grid-column:span 3}.df-col-4{grid-column:span 4}.df-col-5{grid-column:span 5}.df-col-6{grid-column:span 6}.df-col-7{grid-column:span 7}.df-col-8{grid-column:span 8}.df-col-9{grid-column:span 9}.df-col-10{grid-column:span 10}.df-col-11{grid-column:span 11}.df-col-12{grid-column:span 12}.df-col-auto{grid-column:span auto;width:auto}.df-col-full{grid-column:1/-1}.df-col-start-1{grid-column-start:1}.df-col-start-2{grid-column-start:2}.df-col-start-3{grid-column-start:3}.df-col-start-4{grid-column-start:4}.df-col-start-5{grid-column-start:5}.df-col-start-6{grid-column-start:6}.df-col-start-7{grid-column-start:7}.df-col-start-8{grid-column-start:8}.df-col-start-9{grid-column-start:9}.df-col-start-10{grid-column-start:10}.df-col-start-11{grid-column-start:11}.df-col-start-12{grid-column-start:12}.df-col-end-1{grid-column-end:1}.df-col-end-2{grid-column-end:2}.df-col-end-3{grid-column-end:3}.df-col-end-4{grid-column-end:4}.df-col-end-5{grid-column-end:5}.df-col-end-6{grid-column-end:6}.df-col-end-7{grid-column-end:7}.df-col-end-8{grid-column-end:8}.df-col-end-9{grid-column-end:9}.df-col-end-10{grid-column-end:10}.df-col-end-11{grid-column-end:11}.df-col-end-12{grid-column-end:12}.df-col-end-13{grid-column-end:13}@media(max-width:576px){.df-form{--df-grid-gap: var(--df-grid-gap-sm);--df-grid-row-gap: var(--df-grid-row-gap-sm)}.df-row{grid-template-columns:1fr}.df-row>*{grid-column:1/-1!important}.df-row.df-row-mobile-keep-cols{grid-template-columns:repeat(var(--df-grid-columns),1fr)}.df-row.df-row-mobile-keep-cols>*{grid-column:revert!important}}@media(min-width:577px)and (max-width:768px){.df-form{--df-grid-gap: var(--df-grid-gap-md);--df-grid-row-gap: var(--df-grid-row-gap-md)}.df-row{--df-grid-columns: 6}.df-col-sm-1{grid-column:span 1}.df-col-sm-2{grid-column:span 2}.df-col-sm-3{grid-column:span 3}.df-col-sm-4{grid-column:span 4}.df-col-sm-5{grid-column:span 5}.df-col-sm-6{grid-column:span 6}.df-col-sm-full{grid-column:1/-1}}@media(min-width:769px)and (max-width:992px){.df-form{--df-grid-gap: var(--df-grid-gap-lg);--df-grid-row-gap: var(--df-grid-row-gap-lg)}.df-col-md-1{grid-column:span 1}.df-col-md-2{grid-column:span 2}.df-col-md-3{grid-column:span 3}.df-col-md-4{grid-column:span 4}.df-col-md-5{grid-column:span 5}.df-col-md-6{grid-column:span 6}.df-col-md-7{grid-column:span 7}.df-col-md-8{grid-column:span 8}.df-col-md-9{grid-column:span 9}.df-col-md-10{grid-column:span 10}.df-col-md-11{grid-column:span 11}.df-col-md-12{grid-column:span 12}.df-col-md-full{grid-column:1/-1}}@media(min-width:993px){.df-form{--df-grid-gap: var(--df-grid-gap-xl);--df-grid-row-gap: var(--df-grid-row-gap-xl)}.df-col-lg-1{grid-column:span 1}.df-col-lg-2{grid-column:span 2}.df-col-lg-3{grid-column:span 3}.df-col-lg-4{grid-column:span 4}.df-col-lg-5{grid-column:span 5}.df-col-lg-6{grid-column:span 6}.df-col-lg-7{grid-column:span 7}.df-col-lg-8{grid-column:span 8}.df-col-lg-9{grid-column:span 9}.df-col-lg-10{grid-column:span 10}.df-col-lg-11{grid-column:span 11}.df-col-lg-12{grid-column:span 12}.df-col-lg-full{grid-column:1/-1}}.df-gap-none{--df-grid-gap: 0}.df-gap-xs{--df-grid-gap: .25rem}.df-gap-sm{--df-grid-gap: .5rem}.df-gap-md{--df-grid-gap: 1rem}.df-gap-lg{--df-grid-gap: 1.5rem}.df-gap-xl{--df-grid-gap: 2rem}.df-row-gap-none{--df-grid-row-gap: 0}.df-row-gap-xs{--df-grid-row-gap: .25rem}.df-row-gap-sm{--df-grid-row-gap: .5rem}.df-row-gap-md{--df-grid-row-gap: 1rem}.df-row-gap-lg{--df-grid-row-gap: 1.5rem}.df-row-gap-xl{--df-grid-row-gap: 2rem}.df-field{display:block;width:100%;min-width:0;overflow:hidden;margin:0}.df-group,.df-page{display:block;width:100%}.df-form.disabled,.df-row.disabled,.df-field.disabled{opacity:.6;pointer-events:none}.df-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-sr-only-focusable:focus,.df-sr-only-focusable:active{position:static;width:auto;height:auto;padding:inherit;margin:inherit;overflow:visible;clip:auto;white-space:normal}.df-live-region{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.df-form :focus-visible{outline:2px solid var(--df-focus-color, #005fcc);outline-offset:2px}.df-group:focus-within{outline:1px dashed var(--df-focus-color, #005fcc);outline-offset:4px}:host{display:grid;grid-template-columns:1fr;width:100%;gap:var(--df-grid-row-gap);transition:opacity .2s ease-in-out}:host.df-page-spacing-custom{--df-grid-row-gap: var(--page-custom-spacing, 1.5rem)}:host.df-page-visible{opacity:1}:host.df-page-hidden{display:none;opacity:0;pointer-events:none}:host[aria-hidden=true]{pointer-events:none;visibility:hidden}@media(prefers-reduced-motion:no-preference){:host{transition:opacity .3s ease-in-out,transform .3s ease-in-out}:host.df-page-visible{transform:translate(0)}:host.df-page-hidden{transform:translate(-10px)}}@media(prefers-reduced-motion:reduce){:host{transition:none}}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], pageIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "pageIndex", required: true }] }], isVisible: [{ type: i0.Input, args: [{ isSignal: true, alias: "isVisible", required: true }] }], nextPage: [{ type: i0.Output, args: ["nextPage"] }], previousPage: [{ type: i0.Output, args: ["previousPage"] }], pageChange: [{ type: i0.Output, args: ["pageChange"] }] } });

export { PageFieldComponent as default };
//# sourceMappingURL=ng-forge-dynamic-forms-page-field.component-DBAfZgLg.mjs.map
