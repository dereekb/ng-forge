import * as i0 from '@angular/core';
import { viewChild, ViewContainerRef, input, ChangeDetectionStrategy, Component } from '@angular/core';
import { pipe, switchMap } from 'rxjs';
import { derivedFrom } from 'ngxtension/derived-from';
import { f as dynamicTextToObservable } from './ng-forge-dynamic-forms-ng-forge-dynamic-forms-CWkjy84k.mjs';

/**
 * Built-in CSS wrapper component.
 *
 * Applies CSS classes from the `cssClasses` config property to the host element,
 * wrapping the inner content (next wrapper or children) in its ViewContainerRef slot.
 *
 * Receives `cssClasses` as an individual Angular input (set by the outlet via
 * `setInput()`). `fieldInputs` carries the wrapped field's mapper outputs +
 * a read-only view of its form state (via `ReadonlyFieldTree`).
 *
 * @example
 * ```typescript
 * {
 *   type: 'container',
 *   key: 'styled',
 *   wrappers: [{ type: 'css', cssClasses: 'card p-4' }],
 *   fields: [...]
 * }
 * ```
 */
class CssWrapperComponent {
    fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });
    cssClasses = input(...(ngDevMode ? [undefined, { debugName: "cssClasses" }] : /* istanbul ignore next */ []));
    fieldInputs = input(...(ngDevMode ? [undefined, { debugName: "fieldInputs" }] : /* istanbul ignore next */ []));
    resolvedClasses = derivedFrom([this.cssClasses], pipe(switchMap(([value]) => dynamicTextToObservable(value))), {
        initialValue: '',
    });
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: CssWrapperComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.2.0", version: "21.2.6", type: CssWrapperComponent, isStandalone: true, selector: "df-css-wrapper", inputs: { cssClasses: { classPropertyName: "cssClasses", publicName: "cssClasses", isSignal: true, isRequired: false, transformFunction: null }, fieldInputs: { classPropertyName: "fieldInputs", publicName: "fieldInputs", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "resolvedClasses()" } }, viewQueries: [{ propertyName: "fieldComponent", first: true, predicate: ["fieldComponent"], descendants: true, read: ViewContainerRef, isSignal: true }], ngImport: i0, template: `<ng-container #fieldComponent></ng-container>`, isInline: true, changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: CssWrapperComponent, decorators: [{
            type: Component,
            args: [{
                    selector: 'df-css-wrapper',
                    template: `<ng-container #fieldComponent></ng-container>`,
                    changeDetection: ChangeDetectionStrategy.OnPush,
                    host: {
                        '[class]': 'resolvedClasses()',
                    },
                }]
        }], propDecorators: { fieldComponent: [{ type: i0.ViewChild, args: ['fieldComponent', { ...{ read: ViewContainerRef }, isSignal: true }] }], cssClasses: [{ type: i0.Input, args: [{ isSignal: true, alias: "cssClasses", required: false }] }], fieldInputs: [{ type: i0.Input, args: [{ isSignal: true, alias: "fieldInputs", required: false }] }] } });

export { CssWrapperComponent, CssWrapperComponent as default };
//# sourceMappingURL=ng-forge-dynamic-forms-css-wrapper.component-Du7Eem4x.mjs.map
