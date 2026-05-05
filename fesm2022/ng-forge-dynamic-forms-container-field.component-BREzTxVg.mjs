import * as i0 from '@angular/core';
import { inject, DestroyRef, Injector, EnvironmentInjector, viewChild, TemplateRef, ViewContainerRef, input, computed, ChangeDetectionStrategy, Component } from '@angular/core';
import { i as injectFieldRegistry, E as EventBus, D as DynamicFormLogger, W as WRAPPER_AUTO_ASSOCIATIONS, a as DEFAULT_WRAPPERS, d as derivedFromDeferred, c as createFieldResolutionPipe, r as resolveWrappers, b as isSameWrapperChain, e as createWrapperChainController, f as DfFieldOutlet } from './ng-forge-dynamic-forms-ng-forge-dynamic-forms-BaV56Adz.mjs';
import { c as computeContainerHostClasses, s as setupContainerInitEffect } from './ng-forge-dynamic-forms-container-utils-DhIj8ePz.mjs';

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
        setupContainerInitEffect(this.resolvedFields, this.eventBus, 'container', () => this.field().key, this.injector);
        createWrapperChainController({
            vcr: this.wrapperContainer,
            wrappers: this.wrappers,
            renderInnermost: (slot) => slot.createEmbeddedView(this.childrenTpl()),
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.8", ngImport: i0, type: ContainerFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.8", type: ContainerFieldComponent, isStandalone: true, selector: "div[container-field]", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, hidden: { classPropertyName: "hidden", publicName: "hidden", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "hostClasses()", "class.disabled": "disabled()", "class.df-container-hidden": "hidden()", "attr.aria-hidden": "hidden() || null", "id": "`${key()}`", "attr.data-testid": "key()" } }, viewQueries: [{ propertyName: "childrenTpl", first: true, predicate: ["childrenTpl"], descendants: true, read: TemplateRef, isSignal: true }, { propertyName: "wrapperContainer", first: true, predicate: ["wrapperContainer"], descendants: true, read: ViewContainerRef, isSignal: true }], ngImport: i0, template: `
    <ng-template #childrenTpl>
      @for (field of resolvedFields(); track field.key) {
        <ng-container *dfFieldOutlet="field; environmentInjector: environmentInjector" />
      }
    </ng-template>
    <ng-container #wrapperContainer></ng-container>
  `, isInline: true, styles: [":host{display:block;width:100%}:host.df-container-hidden{display:none}\n"], dependencies: [{ kind: "directive", type: DfFieldOutlet, selector: "[dfFieldOutlet]", inputs: ["dfFieldOutlet", "dfFieldOutletEnvironmentInjector"] }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.8", ngImport: i0, type: ContainerFieldComponent, decorators: [{
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

export { ContainerFieldComponent, ContainerFieldComponent as default };
//# sourceMappingURL=ng-forge-dynamic-forms-container-field.component-BREzTxVg.mjs.map
