import * as i0 from '@angular/core';
import { input, computed, ChangeDetectionStrategy, Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { u as DynamicTextPipe } from './ng-forge-dynamic-forms-ng-forge-dynamic-forms-BaV56Adz.mjs';

class TextFieldComponent {
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    label = input.required(...(ngDevMode ? [{ debugName: "label" }] : /* istanbul ignore next */ []));
    className = input(...(ngDevMode ? [undefined, { debugName: "className" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    hidden = input(...(ngDevMode ? [undefined, { debugName: "hidden" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    elementType = computed(() => this.props()?.elementType || 'p', ...(ngDevMode ? [{ debugName: "elementType" }] : /* istanbul ignore next */ []));
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.8", ngImport: i0, type: TextFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.8", type: TextFieldComponent, isStandalone: true, selector: "df-text", inputs: { key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: true, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, hidden: { classPropertyName: "hidden", publicName: "hidden", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "id": "`${key()}`", "attr.data-testid": "key()", "attr.hidden": "hidden() || null" } }, ngImport: i0, template: `
    @switch (elementType()) {
      @case ('p') {
        <p class="df-text df-text-p" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </p>
      }
      @case ('h1') {
        <h1 class="df-text df-text-h1" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h1>
      }
      @case ('h2') {
        <h2 class="df-text df-text-h2" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h2>
      }
      @case ('h3') {
        <h3 class="df-text df-text-h3" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h3>
      }
      @case ('h4') {
        <h4 class="df-text df-text-h4" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h4>
      }
      @case ('h5') {
        <h5 class="df-text df-text-h5" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h5>
      }
      @case ('h6') {
        <h6 class="df-text df-text-h6" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h6>
      }
      @case ('span') {
        <span class="df-text df-text-span" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </span>
      }
      @default {
        never;
      }
    }
  `, isInline: true, styles: [":host([hidden]){display:none!important}.df-text{font-size:var(--df-text-font-size, 1rem);font-family:var(--df-text-font-family, inherit);font-weight:var(--df-text-font-weight, normal);color:var(--df-text-color, inherit);line-height:var(--df-text-line-height, 1.5);text-align:var(--df-text-text-align, inherit);letter-spacing:var(--df-text-letter-spacing, normal);text-decoration:var(--df-text-text-decoration, none);text-transform:var(--df-text-text-transform, none);margin:var(--df-text-margin, 0);padding:var(--df-text-padding, 0)}.df-text-h1{font-size:var(--df-text-h1-font-size, 2rem);font-weight:var(--df-text-h1-font-weight, bold);margin:var(--df-text-h1-margin, 0)}.df-text-h2{font-size:var(--df-text-h2-font-size, 1.75rem);font-weight:var(--df-text-h2-font-weight, bold);margin:var(--df-text-h2-margin, 0)}.df-text-h3{font-size:var(--df-text-h3-font-size, 1.5rem);font-weight:var(--df-text-h3-font-weight, bold);margin:var(--df-text-h3-margin, 0)}.df-text-h4{font-size:var(--df-text-h4-font-size, 1.25rem);font-weight:var(--df-text-h4-font-weight, bold);margin:var(--df-text-h4-margin, 0)}.df-text-h5{font-size:var(--df-text-h5-font-size, 1.125rem);font-weight:var(--df-text-h5-font-weight, bold);margin:var(--df-text-h5-margin, 0)}.df-text-h6{font-size:var(--df-text-h6-font-size, 1rem);font-weight:var(--df-text-h6-font-weight, bold);margin:var(--df-text-h6-margin, 0)}.df-text-p{font-size:var(--df-text-p-font-size, 1rem);margin:var(--df-text-p-margin, 0)}.df-text-span{display:var(--df-text-span-display, inline)}\n"], dependencies: [{ kind: "pipe", type: AsyncPipe, name: "async" }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.8", ngImport: i0, type: TextFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-text', template: `
    @switch (elementType()) {
      @case ('p') {
        <p class="df-text df-text-p" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </p>
      }
      @case ('h1') {
        <h1 class="df-text df-text-h1" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h1>
      }
      @case ('h2') {
        <h2 class="df-text df-text-h2" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h2>
      }
      @case ('h3') {
        <h3 class="df-text df-text-h3" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h3>
      }
      @case ('h4') {
        <h4 class="df-text df-text-h4" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h4>
      }
      @case ('h5') {
        <h5 class="df-text df-text-h5" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h5>
      }
      @case ('h6') {
        <h6 class="df-text df-text-h6" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </h6>
      }
      @case ('span') {
        <span class="df-text df-text-span" [class]="className() || ''">
          {{ label() | dynamicText | async }}
        </span>
      }
      @default {
        never;
      }
    }
  `, imports: [AsyncPipe, DynamicTextPipe], changeDetection: ChangeDetectionStrategy.OnPush, host: {
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                        '[attr.hidden]': 'hidden() || null',
                    }, styles: [":host([hidden]){display:none!important}.df-text{font-size:var(--df-text-font-size, 1rem);font-family:var(--df-text-font-family, inherit);font-weight:var(--df-text-font-weight, normal);color:var(--df-text-color, inherit);line-height:var(--df-text-line-height, 1.5);text-align:var(--df-text-text-align, inherit);letter-spacing:var(--df-text-letter-spacing, normal);text-decoration:var(--df-text-text-decoration, none);text-transform:var(--df-text-text-transform, none);margin:var(--df-text-margin, 0);padding:var(--df-text-padding, 0)}.df-text-h1{font-size:var(--df-text-h1-font-size, 2rem);font-weight:var(--df-text-h1-font-weight, bold);margin:var(--df-text-h1-margin, 0)}.df-text-h2{font-size:var(--df-text-h2-font-size, 1.75rem);font-weight:var(--df-text-h2-font-weight, bold);margin:var(--df-text-h2-margin, 0)}.df-text-h3{font-size:var(--df-text-h3-font-size, 1.5rem);font-weight:var(--df-text-h3-font-weight, bold);margin:var(--df-text-h3-margin, 0)}.df-text-h4{font-size:var(--df-text-h4-font-size, 1.25rem);font-weight:var(--df-text-h4-font-weight, bold);margin:var(--df-text-h4-margin, 0)}.df-text-h5{font-size:var(--df-text-h5-font-size, 1.125rem);font-weight:var(--df-text-h5-font-weight, bold);margin:var(--df-text-h5-margin, 0)}.df-text-h6{font-size:var(--df-text-h6-font-size, 1rem);font-weight:var(--df-text-h6-font-weight, bold);margin:var(--df-text-h6-margin, 0)}.df-text-p{font-size:var(--df-text-p-font-size, 1rem);margin:var(--df-text-p-margin, 0)}.df-text-span{display:var(--df-text-span-display, inline)}\n"] }]
        }], propDecorators: { key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: true }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], hidden: [{ type: i0.Input, args: [{ isSignal: true, alias: "hidden", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }] } });

export { TextFieldComponent as default };
//# sourceMappingURL=ng-forge-dynamic-forms-text-field.component-CSJ_5_Kc.mjs.map
