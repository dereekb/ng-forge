import * as i0 from '@angular/core';
import { InjectionToken, computed, inject, ElementRef, input, afterRenderEffect, ChangeDetectionStrategy, Component, viewChild, linkedSignal, isSignal } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { MatCheckbox } from '@angular/material/checkbox';
import { DynamicTextPipe, EventBus, ARRAY_CONTEXT, resolveTokens, DEFAULT_PROPS, buildBaseInputs } from '@ng-forge/dynamic-forms';
import { createResolvedErrorsSignal, shouldShowErrors, setupMetaTracking, isEqual, valueFieldMapper, optionsFieldMapper, checkboxFieldMapper, submitButtonFieldMapper, nextButtonFieldMapper, previousButtonFieldMapper, addArrayItemButtonMapper, prependArrayItemButtonMapper, insertArrayItemButtonMapper, removeArrayItemButtonMapper, popArrayItemButtonMapper, shiftArrayItemButtonMapper, datepickerFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { MatError, MatInput, MatHint } from '@angular/material/input';
import { AsyncPipe } from '@angular/common';
import { MatFormField, MatLabel, MatSuffix, MatError as MatError$1 } from '@angular/material/form-field';
import { MatDatepicker, MatDatepickerInput, MatDatepickerToggle } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { explicitEffect } from 'ngxtension/explicit-effect';
import { MatRadioGroup, MatRadioButton } from '@angular/material/radio';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';
import { MatButton } from '@angular/material/button';
import { MatSlideToggle } from '@angular/material/slide-toggle';

/**
 * Injection token for Material Design form configuration.
 * Use this to provide global configuration for Material form fields.
 *
 * @example
 * ```typescript
 * import { provideDynamicForm } from '@ng-forge/dynamic-forms';
 * import { withMaterialFields } from '@ng-forge/dynamic-forms-material';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideDynamicForm(
 *       ...withMaterialFields({
 *         appearance: 'fill',
 *         subscriptSizing: 'fixed'
 *       })
 *     )
 *   ]
 * };
 * ```
 */
const MATERIAL_CONFIG = new InjectionToken('MATERIAL_CONFIG');

/**
 * Creates a signal that computes the aria-describedby value based on errors and hint state.
 * Errors take precedence over hints - when errors are displayed, the hint is hidden.
 * Only the first error is displayed (single error ID, not indexed).
 *
 * @param errorsToDisplay Signal containing the array of errors currently being displayed
 * @param errorId Signal containing the ID for the error element (single error only)
 * @param hintId Signal containing the ID for the hint element
 * @param hasHint Function that returns true if a hint is configured
 * @returns Signal containing the aria-describedby value or null
 */
function createAriaDescribedBySignal(errorsToDisplay, errorId, hintId, hasHint) {
    return computed(() => {
        if (errorsToDisplay().length > 0) {
            return errorId();
        }
        if (hasHint()) {
            return hintId();
        }
        return null;
    });
}

class MatCheckboxFieldComponent {
    materialConfig = inject(MATERIAL_CONFIG, { optional: true });
    elementRef = inject((ElementRef));
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    // Properties
    label = input(...(ngDevMode ? [undefined, { debugName: "label" }] : /* istanbul ignore next */ []));
    placeholder = input(...(ngDevMode ? [undefined, { debugName: "placeholder" }] : /* istanbul ignore next */ []));
    className = input('', ...(ngDevMode ? [{ debugName: "className" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    meta = input(...(ngDevMode ? [undefined, { debugName: "meta" }] : /* istanbul ignore next */ []));
    validationMessages = input(...(ngDevMode ? [undefined, { debugName: "validationMessages" }] : /* istanbul ignore next */ []));
    defaultValidationMessages = input(...(ngDevMode ? [undefined, { debugName: "defaultValidationMessages" }] : /* istanbul ignore next */ []));
    effectiveDisableRipple = computed(() => this.props()?.disableRipple ?? this.materialConfig?.disableRipple ?? false, ...(ngDevMode ? [{ debugName: "effectiveDisableRipple" }] : /* istanbul ignore next */ []));
    resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
    showErrors = shouldShowErrors(this.field);
    errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []), ...(ngDevMode ? [{ debugName: "errorsToDisplay" }] : /* istanbul ignore next */ []));
    constructor() {
        // Apply meta attributes to the internal checkbox input
        setupMetaTracking(this.elementRef, this.meta, {
            selector: 'input[type="checkbox"]',
        });
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────────────────────────────────────
    /** Unique ID for the hint element, used for aria-describedby */
    hintId = computed(() => `${this.key()}-hint`, ...(ngDevMode ? [{ debugName: "hintId" }] : /* istanbul ignore next */ []));
    /** Base ID for error elements, used for aria-describedby */
    errorId = computed(() => `${this.key()}-error`, ...(ngDevMode ? [{ debugName: "errorId" }] : /* istanbul ignore next */ []));
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    ariaInvalid = computed(() => {
        const fieldState = this.field()();
        return fieldState.invalid() && fieldState.touched();
    }, ...(ngDevMode ? [{ debugName: "ariaInvalid" }] : /* istanbul ignore next */ []));
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    ariaRequired = computed(() => {
        return this.field()().required?.() === true ? true : null;
    }, ...(ngDevMode ? [{ debugName: "ariaRequired" }] : /* istanbul ignore next */ []));
    /** aria-describedby: links to hint and error messages for screen readers */
    ariaDescribedBy = createAriaDescribedBySignal(this.errorsToDisplay, this.errorId, this.hintId, () => !!this.props()?.hint);
    /**
     * Workaround: Angular Material's MatCheckbox does NOT set aria-required on its internal
     * input element when [required] is passed, even though it sets the native required attribute.
     * This effect imperatively sets/removes aria-required on the internal input.
     *
     * Bug: MatCheckbox sets `required` attribute but not `aria-required` for screen readers.
     * @see https://github.com/angular/components/issues/XXXXX (TODO: file issue)
     *
     * Uses afterRenderEffect to ensure DOM is ready before manipulating attributes.
     */
    syncAriaRequiredToDom = afterRenderEffect(() => {
        const isRequired = this.ariaRequired();
        const inputEl = this.elementRef.nativeElement.querySelector('input[type="checkbox"]');
        if (inputEl) {
            if (isRequired) {
                inputEl.setAttribute('aria-required', 'true');
            }
            else {
                inputEl.removeAttribute('aria-required');
            }
        }
    });
    /**
     * Workaround: Angular Material's MatCheckbox does NOT propagate aria-describedby to its internal
     * input element. This effect imperatively sets/removes aria-describedby on the internal input.
     *
     * Uses afterRenderEffect to ensure DOM is ready before querying internal elements.
     */
    syncAriaDescribedByToDom = afterRenderEffect(() => {
        const describedBy = this.ariaDescribedBy();
        const inputEl = this.elementRef.nativeElement.querySelector('input[type="checkbox"]');
        if (inputEl) {
            if (describedBy) {
                inputEl.setAttribute('aria-describedby', describedBy);
            }
            else {
                inputEl.removeAttribute('aria-describedby');
            }
        }
    });
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatCheckboxFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: MatCheckboxFieldComponent, isStandalone: true, selector: "df-mat-checkbox", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: false, transformFunction: null }, placeholder: { classPropertyName: "placeholder", publicName: "placeholder", isSignal: true, isRequired: false, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null }, meta: { classPropertyName: "meta", publicName: "meta", isSignal: true, isRequired: false, transformFunction: null }, validationMessages: { classPropertyName: "validationMessages", publicName: "validationMessages", isSignal: true, isRequired: false, transformFunction: null }, defaultValidationMessages: { classPropertyName: "defaultValidationMessages", publicName: "defaultValidationMessages", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "className()", "id": "`${key()}`", "attr.data-testid": "key()", "attr.hidden": "field()().hidden() || null" } }, ngImport: i0, template: `
    @let f = field();
    @let checkboxId = key() + '-checkbox';

    <mat-checkbox
      [id]="checkboxId"
      [formField]="f"
      [labelPosition]="props()?.labelPosition || 'after'"
      [indeterminate]="props()?.indeterminate || false"
      [color]="props()?.color || 'primary'"
      [disableRipple]="effectiveDisableRipple()"
      [required]="!!f().required()"
      [attr.aria-describedby]="ariaDescribedBy()"
      [attr.tabindex]="tabIndex()"
      [attr.hidden]="f().hidden() || null"
    >
      {{ label() | dynamicText | async }}
    </mat-checkbox>

    @if (errorsToDisplay()[0]; as error) {
      <mat-error [id]="errorId()" [attr.hidden]="f().hidden() || null">{{ error.message }}</mat-error>
    } @else if (props()?.hint; as hint) {
      <div class="mat-hint" [id]="hintId()" [attr.hidden]="f().hidden() || null">{{ hint | dynamicText | async }}</div>
    }
  `, isInline: true, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n"], dependencies: [{ kind: "component", type: MatCheckbox, selector: "mat-checkbox", inputs: ["aria-label", "aria-labelledby", "aria-describedby", "aria-expanded", "aria-controls", "aria-owns", "id", "required", "labelPosition", "name", "value", "disableRipple", "tabIndex", "color", "disabledInteractive", "checked", "disabled", "indeterminate"], outputs: ["change", "indeterminateChange"], exportAs: ["matCheckbox"] }, { kind: "directive", type: FormField, selector: "[formField]", inputs: ["formField"], exportAs: ["formField"] }, { kind: "directive", type: MatError, selector: "mat-error, [matError]", inputs: ["id"] }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }, { kind: "pipe", type: AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatCheckboxFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-mat-checkbox', imports: [MatCheckbox, FormField, MatError, DynamicTextPipe, AsyncPipe], template: `
    @let f = field();
    @let checkboxId = key() + '-checkbox';

    <mat-checkbox
      [id]="checkboxId"
      [formField]="f"
      [labelPosition]="props()?.labelPosition || 'after'"
      [indeterminate]="props()?.indeterminate || false"
      [color]="props()?.color || 'primary'"
      [disableRipple]="effectiveDisableRipple()"
      [required]="!!f().required()"
      [attr.aria-describedby]="ariaDescribedBy()"
      [attr.tabindex]="tabIndex()"
      [attr.hidden]="f().hidden() || null"
    >
      {{ label() | dynamicText | async }}
    </mat-checkbox>

    @if (errorsToDisplay()[0]; as error) {
      <mat-error [id]="errorId()" [attr.hidden]="f().hidden() || null">{{ error.message }}</mat-error>
    } @else if (props()?.hint; as hint) {
      <div class="mat-hint" [id]="hintId()" [attr.hidden]="f().hidden() || null">{{ hint | dynamicText | async }}</div>
    }
  `, host: {
                        '[class]': 'className()',
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                        '[attr.hidden]': 'field()().hidden() || null',
                    }, changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: false }] }], placeholder: [{ type: i0.Input, args: [{ isSignal: true, alias: "placeholder", required: false }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }], meta: [{ type: i0.Input, args: [{ isSignal: true, alias: "meta", required: false }] }], validationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "validationMessages", required: false }] }], defaultValidationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "defaultValidationMessages", required: false }] }] } });

var matCheckbox_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: MatCheckboxFieldComponent
});

class MatDatepickerFieldComponent {
    materialConfig = inject(MATERIAL_CONFIG, { optional: true });
    elementRef = inject((ElementRef));
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    constructor() {
        setupMetaTracking(this.elementRef, this.meta, { selector: 'input' });
    }
    label = input(...(ngDevMode ? [undefined, { debugName: "label" }] : /* istanbul ignore next */ []));
    placeholder = input(...(ngDevMode ? [undefined, { debugName: "placeholder" }] : /* istanbul ignore next */ []));
    className = input('', ...(ngDevMode ? [{ debugName: "className" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    minDate = input(null, ...(ngDevMode ? [{ debugName: "minDate" }] : /* istanbul ignore next */ []));
    maxDate = input(null, ...(ngDevMode ? [{ debugName: "maxDate" }] : /* istanbul ignore next */ []));
    startAt = input(null, ...(ngDevMode ? [{ debugName: "startAt" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    meta = input(...(ngDevMode ? [undefined, { debugName: "meta" }] : /* istanbul ignore next */ []));
    validationMessages = input(...(ngDevMode ? [undefined, { debugName: "validationMessages" }] : /* istanbul ignore next */ []));
    defaultValidationMessages = input(...(ngDevMode ? [undefined, { debugName: "defaultValidationMessages" }] : /* istanbul ignore next */ []));
    effectiveAppearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline', ...(ngDevMode ? [{ debugName: "effectiveAppearance" }] : /* istanbul ignore next */ []));
    effectiveSubscriptSizing = computed(() => this.props()?.subscriptSizing ?? this.materialConfig?.subscriptSizing ?? 'dynamic', ...(ngDevMode ? [{ debugName: "effectiveSubscriptSizing" }] : /* istanbul ignore next */ []));
    effectiveFloatLabel = computed(() => this.props()?.floatLabel ?? this.materialConfig?.floatLabel ?? 'auto', ...(ngDevMode ? [{ debugName: "effectiveFloatLabel" }] : /* istanbul ignore next */ []));
    effectiveHideRequiredMarker = computed(() => this.props()?.hideRequiredMarker ?? this.materialConfig?.hideRequiredMarker ?? false, ...(ngDevMode ? [{ debugName: "effectiveHideRequiredMarker" }] : /* istanbul ignore next */ []));
    resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
    showErrors = shouldShowErrors(this.field);
    errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []), ...(ngDevMode ? [{ debugName: "errorsToDisplay" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────────────────────────────────────
    /** Unique ID for the hint element, used for aria-describedby */
    hintId = computed(() => `${this.key()}-hint`, ...(ngDevMode ? [{ debugName: "hintId" }] : /* istanbul ignore next */ []));
    /** Base ID for error elements, used for aria-describedby */
    errorId = computed(() => `${this.key()}-error`, ...(ngDevMode ? [{ debugName: "errorId" }] : /* istanbul ignore next */ []));
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    ariaInvalid = computed(() => {
        const fieldState = this.field()();
        return fieldState.invalid() && fieldState.touched();
    }, ...(ngDevMode ? [{ debugName: "ariaInvalid" }] : /* istanbul ignore next */ []));
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    ariaRequired = computed(() => {
        return this.field()().required?.() === true ? true : null;
    }, ...(ngDevMode ? [{ debugName: "ariaRequired" }] : /* istanbul ignore next */ []));
    /** aria-describedby: links to hint and error messages for screen readers */
    ariaDescribedBy = createAriaDescribedBySignal(this.errorsToDisplay, this.errorId, this.hintId, () => !!this.props()?.hint);
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatDatepickerFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: MatDatepickerFieldComponent, isStandalone: true, selector: "df-mat-datepicker", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: false, transformFunction: null }, placeholder: { classPropertyName: "placeholder", publicName: "placeholder", isSignal: true, isRequired: false, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, minDate: { classPropertyName: "minDate", publicName: "minDate", isSignal: true, isRequired: false, transformFunction: null }, maxDate: { classPropertyName: "maxDate", publicName: "maxDate", isSignal: true, isRequired: false, transformFunction: null }, startAt: { classPropertyName: "startAt", publicName: "startAt", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null }, meta: { classPropertyName: "meta", publicName: "meta", isSignal: true, isRequired: false, transformFunction: null }, validationMessages: { classPropertyName: "validationMessages", publicName: "validationMessages", isSignal: true, isRequired: false, transformFunction: null }, defaultValidationMessages: { classPropertyName: "defaultValidationMessages", publicName: "defaultValidationMessages", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "id": "`${key()}`", "class": "className()", "attr.data-testid": "key()", "attr.hidden": "field()().hidden() || null" } }, providers: [provideNativeDateAdapter()], ngImport: i0, template: `
    @let f = field();
    @let inputId = key() + '-input';

    <mat-form-field
      [appearance]="effectiveAppearance()"
      [subscriptSizing]="effectiveSubscriptSizing()"
      [floatLabel]="effectiveFloatLabel()"
      [hideRequiredMarker]="effectiveHideRequiredMarker()"
    >
      @if (label(); as label) {
        <mat-label>{{ label | dynamicText | async }}</mat-label>
      }

      <input
        matInput
        [id]="inputId"
        [matDatepicker]="picker"
        [formField]="f"
        [placeholder]="(placeholder() | dynamicText | async) ?? ''"
        [attr.tabindex]="tabIndex()"
        [min]="minDate()"
        [max]="maxDate()"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.aria-required]="ariaRequired()"
        [attr.aria-describedby]="ariaDescribedBy()"
      />

      <mat-datepicker-toggle matIconSuffix [for]="picker" />
      <mat-datepicker #picker [startAt]="startAt()" [startView]="props()?.startView || 'month'" [touchUi]="props()?.touchUi ?? false" />

      @if (errorsToDisplay()[0]; as error) {
        <mat-error [id]="errorId()">{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint [id]="hintId()">{{ hint | dynamicText | async }}</mat-hint>
      }
    </mat-form-field>
  `, isInline: true, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", "mat-form-field{width:100%}\n"], dependencies: [{ kind: "component", type: MatFormField, selector: "mat-form-field", inputs: ["hideRequiredMarker", "color", "floatLabel", "appearance", "subscriptSizing", "hintLabel"], exportAs: ["matFormField"] }, { kind: "directive", type: MatLabel, selector: "mat-label" }, { kind: "directive", type: MatInput, selector: "input[matInput], textarea[matInput], select[matNativeControl],      input[matNativeControl], textarea[matNativeControl]", inputs: ["disabled", "id", "placeholder", "name", "required", "type", "errorStateMatcher", "aria-describedby", "value", "readonly", "disabledInteractive"], exportAs: ["matInput"] }, { kind: "directive", type: MatHint, selector: "mat-hint", inputs: ["align", "id"] }, { kind: "component", type: MatDatepicker, selector: "mat-datepicker", exportAs: ["matDatepicker"] }, { kind: "directive", type: MatDatepickerInput, selector: "input[matDatepicker]", inputs: ["matDatepicker", "min", "max", "matDatepickerFilter"], exportAs: ["matDatepickerInput"] }, { kind: "component", type: MatDatepickerToggle, selector: "mat-datepicker-toggle", inputs: ["for", "tabIndex", "aria-label", "disabled", "disableRipple"], exportAs: ["matDatepickerToggle"] }, { kind: "directive", type: MatSuffix, selector: "[matSuffix], [matIconSuffix], [matTextSuffix]", inputs: ["matTextSuffix"] }, { kind: "directive", type: FormField, selector: "[formField]", inputs: ["formField"], exportAs: ["formField"] }, { kind: "directive", type: MatError$1, selector: "mat-error, [matError]", inputs: ["id"] }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }, { kind: "pipe", type: AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatDatepickerFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-mat-datepicker', imports: [
                        MatFormField,
                        MatLabel,
                        MatInput,
                        MatHint,
                        MatDatepicker,
                        MatDatepickerInput,
                        MatDatepickerToggle,
                        MatSuffix,
                        FormField,
                        MatError$1,
                        DynamicTextPipe,
                        AsyncPipe,
                    ], host: {
                        '[id]': '`${key()}`',
                        '[class]': 'className()',
                        '[attr.data-testid]': 'key()',
                        '[attr.hidden]': 'field()().hidden() || null',
                    }, template: `
    @let f = field();
    @let inputId = key() + '-input';

    <mat-form-field
      [appearance]="effectiveAppearance()"
      [subscriptSizing]="effectiveSubscriptSizing()"
      [floatLabel]="effectiveFloatLabel()"
      [hideRequiredMarker]="effectiveHideRequiredMarker()"
    >
      @if (label(); as label) {
        <mat-label>{{ label | dynamicText | async }}</mat-label>
      }

      <input
        matInput
        [id]="inputId"
        [matDatepicker]="picker"
        [formField]="f"
        [placeholder]="(placeholder() | dynamicText | async) ?? ''"
        [attr.tabindex]="tabIndex()"
        [min]="minDate()"
        [max]="maxDate()"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.aria-required]="ariaRequired()"
        [attr.aria-describedby]="ariaDescribedBy()"
      />

      <mat-datepicker-toggle matIconSuffix [for]="picker" />
      <mat-datepicker #picker [startAt]="startAt()" [startView]="props()?.startView || 'month'" [touchUi]="props()?.touchUi ?? false" />

      @if (errorsToDisplay()[0]; as error) {
        <mat-error [id]="errorId()">{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint [id]="hintId()">{{ hint | dynamicText | async }}</mat-hint>
      }
    </mat-form-field>
  `, providers: [provideNativeDateAdapter()], changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", "mat-form-field{width:100%}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: false }] }], placeholder: [{ type: i0.Input, args: [{ isSignal: true, alias: "placeholder", required: false }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], minDate: [{ type: i0.Input, args: [{ isSignal: true, alias: "minDate", required: false }] }], maxDate: [{ type: i0.Input, args: [{ isSignal: true, alias: "maxDate", required: false }] }], startAt: [{ type: i0.Input, args: [{ isSignal: true, alias: "startAt", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }], meta: [{ type: i0.Input, args: [{ isSignal: true, alias: "meta", required: false }] }], validationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "validationMessages", required: false }] }], defaultValidationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "defaultValidationMessages", required: false }] }] } });

var matDatepicker_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: MatDatepickerFieldComponent
});

class MatInputFieldComponent {
    materialConfig = inject(MATERIAL_CONFIG, { optional: true });
    elementRef = inject((ElementRef));
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    label = input(...(ngDevMode ? [undefined, { debugName: "label" }] : /* istanbul ignore next */ []));
    placeholder = input(...(ngDevMode ? [undefined, { debugName: "placeholder" }] : /* istanbul ignore next */ []));
    className = input('', ...(ngDevMode ? [{ debugName: "className" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    meta = input(...(ngDevMode ? [undefined, { debugName: "meta" }] : /* istanbul ignore next */ []));
    validationMessages = input(...(ngDevMode ? [undefined, { debugName: "validationMessages" }] : /* istanbul ignore next */ []));
    defaultValidationMessages = input(...(ngDevMode ? [undefined, { debugName: "defaultValidationMessages" }] : /* istanbul ignore next */ []));
    constructor() {
        setupMetaTracking(this.elementRef, this.meta, { selector: 'input' });
    }
    /**
     * Reference to the native input element.
     * Used to imperatively sync the readonly attribute since Angular Signal Forms'
     * [field] directive doesn't sync FieldState.readonly() to the DOM.
     */
    inputRef = viewChild('inputRef', ...(ngDevMode ? [{ debugName: "inputRef" }] : /* istanbul ignore next */ []));
    /**
     * Computed signal that extracts the readonly state from the field.
     * Used by the effect to reactively sync the readonly attribute to the DOM.
     */
    isReadonly = computed(() => this.field()().readonly(), ...(ngDevMode ? [{ debugName: "isReadonly" }] : /* istanbul ignore next */ []));
    /**
     * Workaround: Angular Signal Forms' [field] directive does NOT sync the readonly
     * attribute to the DOM, even though FieldState.readonly() returns the correct value.
     * This effect imperatively sets/removes the readonly attribute on the native input
     * element whenever the readonly state changes.
     *
     * Note: We cannot use [readonly] or [attr.readonly] bindings because Angular throws
     * NG8022: "Binding to '[readonly]' is not allowed on nodes using the '[field]' directive"
     *
     * Uses afterRenderEffect to ensure DOM is ready before manipulating attributes.
     *
     * @see https://github.com/angular/angular/issues/65897
     */
    syncReadonlyToDom = afterRenderEffect({
        write: () => {
            const inputRef = this.inputRef();
            const isReadonly = this.isReadonly();
            if (inputRef?.nativeElement) {
                if (isReadonly) {
                    inputRef.nativeElement.setAttribute('readonly', '');
                }
                else {
                    inputRef.nativeElement.removeAttribute('readonly');
                }
            }
        },
    });
    effectiveAppearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline', ...(ngDevMode ? [{ debugName: "effectiveAppearance" }] : /* istanbul ignore next */ []));
    effectiveSubscriptSizing = computed(() => this.props()?.subscriptSizing ?? this.materialConfig?.subscriptSizing ?? 'dynamic', ...(ngDevMode ? [{ debugName: "effectiveSubscriptSizing" }] : /* istanbul ignore next */ []));
    effectiveFloatLabel = computed(() => this.props()?.floatLabel ?? this.materialConfig?.floatLabel ?? 'auto', ...(ngDevMode ? [{ debugName: "effectiveFloatLabel" }] : /* istanbul ignore next */ []));
    effectiveHideRequiredMarker = computed(() => this.props()?.hideRequiredMarker ?? this.materialConfig?.hideRequiredMarker ?? false, ...(ngDevMode ? [{ debugName: "effectiveHideRequiredMarker" }] : /* istanbul ignore next */ []));
    resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
    showErrors = shouldShowErrors(this.field);
    errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []), ...(ngDevMode ? [{ debugName: "errorsToDisplay" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────────────────────────────────────
    /** Unique ID for the hint element, used for aria-describedby */
    hintId = computed(() => `${this.key()}-hint`, ...(ngDevMode ? [{ debugName: "hintId" }] : /* istanbul ignore next */ []));
    /** Base ID for error elements, used for aria-describedby */
    errorId = computed(() => `${this.key()}-error`, ...(ngDevMode ? [{ debugName: "errorId" }] : /* istanbul ignore next */ []));
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    ariaInvalid = computed(() => {
        const fieldState = this.field()();
        return fieldState.invalid() && fieldState.touched();
    }, ...(ngDevMode ? [{ debugName: "ariaInvalid" }] : /* istanbul ignore next */ []));
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    ariaRequired = computed(() => {
        return this.field()().required?.() === true ? true : null;
    }, ...(ngDevMode ? [{ debugName: "ariaRequired" }] : /* istanbul ignore next */ []));
    /** aria-describedby: links to hint and error messages for screen readers */
    ariaDescribedBy = createAriaDescribedBySignal(this.errorsToDisplay, this.errorId, this.hintId, () => !!this.props()?.hint);
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatInputFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: MatInputFieldComponent, isStandalone: true, selector: "df-mat-input", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: false, transformFunction: null }, placeholder: { classPropertyName: "placeholder", publicName: "placeholder", isSignal: true, isRequired: false, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null }, meta: { classPropertyName: "meta", publicName: "meta", isSignal: true, isRequired: false, transformFunction: null }, validationMessages: { classPropertyName: "validationMessages", publicName: "validationMessages", isSignal: true, isRequired: false, transformFunction: null }, defaultValidationMessages: { classPropertyName: "defaultValidationMessages", publicName: "defaultValidationMessages", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "id": "`${key()}`", "attr.data-testid": "key()", "class": "className()", "attr.hidden": "field()().hidden() || null" } }, viewQueries: [{ propertyName: "inputRef", first: true, predicate: ["inputRef"], descendants: true, isSignal: true }], ngImport: i0, template: `
    @let f = field();
    @let inputId = key() + '-input';

    <mat-form-field
      [appearance]="effectiveAppearance()"
      [subscriptSizing]="effectiveSubscriptSizing()"
      [floatLabel]="effectiveFloatLabel()"
      [hideRequiredMarker]="effectiveHideRequiredMarker()"
    >
      @if (label()) {
        <mat-label>{{ label() | dynamicText | async }}</mat-label>
      }
      <input
        #inputRef
        matInput
        [id]="inputId"
        [formField]="f"
        [type]="props()?.type ?? 'text'"
        [placeholder]="(placeholder() | dynamicText | async) ?? ''"
        [attr.tabindex]="tabIndex()"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.aria-required]="ariaRequired()"
        [attr.aria-describedby]="ariaDescribedBy()"
      />
      @if (errorsToDisplay()[0]; as error) {
        <mat-error [id]="errorId()">{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint [id]="hintId()">{{ hint | dynamicText | async }}</mat-hint>
      }
    </mat-form-field>
  `, isInline: true, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", "mat-form-field{width:100%}\n"], dependencies: [{ kind: "component", type: MatFormField, selector: "mat-form-field", inputs: ["hideRequiredMarker", "color", "floatLabel", "appearance", "subscriptSizing", "hintLabel"], exportAs: ["matFormField"] }, { kind: "directive", type: MatLabel, selector: "mat-label" }, { kind: "directive", type: MatInput, selector: "input[matInput], textarea[matInput], select[matNativeControl],      input[matNativeControl], textarea[matNativeControl]", inputs: ["disabled", "id", "placeholder", "name", "required", "type", "errorStateMatcher", "aria-describedby", "value", "readonly", "disabledInteractive"], exportAs: ["matInput"] }, { kind: "directive", type: MatHint, selector: "mat-hint", inputs: ["align", "id"] }, { kind: "directive", type: FormField, selector: "[formField]", inputs: ["formField"], exportAs: ["formField"] }, { kind: "directive", type: MatError$1, selector: "mat-error, [matError]", inputs: ["id"] }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }, { kind: "pipe", type: AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatInputFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-mat-input', imports: [MatFormField, MatLabel, MatInput, MatHint, FormField, MatError$1, DynamicTextPipe, AsyncPipe], template: `
    @let f = field();
    @let inputId = key() + '-input';

    <mat-form-field
      [appearance]="effectiveAppearance()"
      [subscriptSizing]="effectiveSubscriptSizing()"
      [floatLabel]="effectiveFloatLabel()"
      [hideRequiredMarker]="effectiveHideRequiredMarker()"
    >
      @if (label()) {
        <mat-label>{{ label() | dynamicText | async }}</mat-label>
      }
      <input
        #inputRef
        matInput
        [id]="inputId"
        [formField]="f"
        [type]="props()?.type ?? 'text'"
        [placeholder]="(placeholder() | dynamicText | async) ?? ''"
        [attr.tabindex]="tabIndex()"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.aria-required]="ariaRequired()"
        [attr.aria-describedby]="ariaDescribedBy()"
      />
      @if (errorsToDisplay()[0]; as error) {
        <mat-error [id]="errorId()">{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint [id]="hintId()">{{ hint | dynamicText | async }}</mat-hint>
      }
    </mat-form-field>
  `, changeDetection: ChangeDetectionStrategy.OnPush, host: {
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                        '[class]': 'className()',
                        '[attr.hidden]': 'field()().hidden() || null',
                    }, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", "mat-form-field{width:100%}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: false }] }], placeholder: [{ type: i0.Input, args: [{ isSignal: true, alias: "placeholder", required: false }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }], meta: [{ type: i0.Input, args: [{ isSignal: true, alias: "meta", required: false }] }], validationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "validationMessages", required: false }] }], defaultValidationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "defaultValidationMessages", required: false }] }], inputRef: [{ type: i0.ViewChild, args: ['inputRef', { isSignal: true }] }] } });

var matInput_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: MatInputFieldComponent
});

class MatMultiCheckboxFieldComponent {
    elementRef = inject((ElementRef));
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    label = input(...(ngDevMode ? [undefined, { debugName: "label" }] : /* istanbul ignore next */ []));
    placeholder = input(...(ngDevMode ? [undefined, { debugName: "placeholder" }] : /* istanbul ignore next */ []));
    className = input('', ...(ngDevMode ? [{ debugName: "className" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    options = input([], ...(ngDevMode ? [{ debugName: "options" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    meta = input(...(ngDevMode ? [undefined, { debugName: "meta" }] : /* istanbul ignore next */ []));
    valueViewModel = linkedSignal(() => {
        const currentValues = this.field()().value();
        return this.options().filter((option) => currentValues.includes(option.value));
    }, { ...(ngDevMode ? { debugName: "valueViewModel" } : /* istanbul ignore next */ {}), equal: isEqual });
    /** Computed map of checked option values for O(1) lookup in template */
    checkedValuesMap = computed(() => {
        const map = {};
        for (const opt of this.valueViewModel()) {
            map[String(opt.value)] = true;
        }
        return map;
    }, ...(ngDevMode ? [{ debugName: "checkedValuesMap" }] : /* istanbul ignore next */ []));
    constructor() {
        // Apply meta attributes to all checkbox inputs, re-apply when options change
        setupMetaTracking(this.elementRef, this.meta, {
            selector: 'input[type="checkbox"]',
            dependents: [this.options],
        });
        explicitEffect([this.valueViewModel], ([selectedOptions]) => {
            const selectedValues = selectedOptions.map((option) => option.value);
            if (!isEqual(selectedValues, this.field()().value())) {
                this.field()().value.set(selectedValues);
            }
        });
        explicitEffect([this.options], ([options]) => {
            const values = options.map((option) => option.value);
            const uniqueValues = new Set(values);
            if (values.length !== uniqueValues.size) {
                const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
                throw new Error(`Duplicate option values detected in mat-multi-checkbox: ${duplicates.join(', ')}`);
            }
        });
    }
    onCheckboxChange(option, checked) {
        this.valueViewModel.update((currentOptions) => {
            if (checked) {
                return currentOptions.some((opt) => opt.value === option.value) ? currentOptions : [...currentOptions, option];
            }
            else {
                return currentOptions.filter((opt) => opt.value !== option.value);
            }
        });
    }
    validationMessages = input(...(ngDevMode ? [undefined, { debugName: "validationMessages" }] : /* istanbul ignore next */ []));
    defaultValidationMessages = input(...(ngDevMode ? [undefined, { debugName: "defaultValidationMessages" }] : /* istanbul ignore next */ []));
    resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
    showErrors = shouldShowErrors(this.field);
    errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []), ...(ngDevMode ? [{ debugName: "errorsToDisplay" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────────────────────────────────────
    /** Unique ID for the hint element, used for aria-describedby */
    hintId = computed(() => `${this.key()}-hint`, ...(ngDevMode ? [{ debugName: "hintId" }] : /* istanbul ignore next */ []));
    /** Base ID for error elements, used for aria-describedby */
    errorId = computed(() => `${this.key()}-error`, ...(ngDevMode ? [{ debugName: "errorId" }] : /* istanbul ignore next */ []));
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    ariaInvalid = computed(() => {
        const fieldState = this.field()();
        return fieldState.invalid() && fieldState.touched();
    }, ...(ngDevMode ? [{ debugName: "ariaInvalid" }] : /* istanbul ignore next */ []));
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    ariaRequired = computed(() => {
        return this.field()().required?.() === true ? true : null;
    }, ...(ngDevMode ? [{ debugName: "ariaRequired" }] : /* istanbul ignore next */ []));
    /** aria-describedby: links to hint and error messages for screen readers */
    ariaDescribedBy = createAriaDescribedBySignal(this.errorsToDisplay, this.errorId, this.hintId, () => !!this.props()?.hint);
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatMultiCheckboxFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: MatMultiCheckboxFieldComponent, isStandalone: true, selector: "df-mat-multi-checkbox", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: false, transformFunction: null }, placeholder: { classPropertyName: "placeholder", publicName: "placeholder", isSignal: true, isRequired: false, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, options: { classPropertyName: "options", publicName: "options", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null }, meta: { classPropertyName: "meta", publicName: "meta", isSignal: true, isRequired: false, transformFunction: null }, validationMessages: { classPropertyName: "validationMessages", publicName: "validationMessages", isSignal: true, isRequired: false, transformFunction: null }, defaultValidationMessages: { classPropertyName: "defaultValidationMessages", publicName: "defaultValidationMessages", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "className() || \"\"", "id": "`${key()}`", "attr.data-testid": "key()", "attr.hidden": "field()().hidden() || null" } }, ngImport: i0, template: `
    @let f = field();
    @let checkboxGroupId = key() + '-checkbox-group';
    @let checked = checkedValuesMap();

    @if (label(); as label) {
      <div class="checkbox-group-label">{{ label | dynamicText | async }}</div>
    }

    <div
      [id]="checkboxGroupId"
      class="checkbox-group"
      role="group"
      [attr.aria-invalid]="ariaInvalid()"
      [attr.aria-required]="ariaRequired()"
      [attr.aria-describedby]="ariaDescribedBy()"
    >
      @for (option of options(); track option.value) {
        <mat-checkbox
          [checked]="checked['' + option.value]"
          [disabled]="f().disabled() || option.disabled"
          [color]="props()?.color || 'primary'"
          [labelPosition]="props()?.labelPosition || 'after'"
          (change)="onCheckboxChange(option, $event.checked)"
        >
          {{ option.label | dynamicText | async }}
        </mat-checkbox>
      }
    </div>

    @if (errorsToDisplay()[0]; as error) {
      <mat-error [id]="errorId()">{{ error.message }}</mat-error>
    } @else if (props()?.hint; as hint) {
      <div class="mat-hint" [id]="hintId()">{{ hint | dynamicText | async }}</div>
    }
  `, isInline: true, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n"], dependencies: [{ kind: "component", type: MatCheckbox, selector: "mat-checkbox", inputs: ["aria-label", "aria-labelledby", "aria-describedby", "aria-expanded", "aria-controls", "aria-owns", "id", "required", "labelPosition", "name", "value", "disableRipple", "tabIndex", "color", "disabledInteractive", "checked", "disabled", "indeterminate"], outputs: ["change", "indeterminateChange"], exportAs: ["matCheckbox"] }, { kind: "directive", type: MatError, selector: "mat-error, [matError]", inputs: ["id"] }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }, { kind: "pipe", type: AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatMultiCheckboxFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-mat-multi-checkbox', imports: [MatCheckbox, MatError, DynamicTextPipe, AsyncPipe], template: `
    @let f = field();
    @let checkboxGroupId = key() + '-checkbox-group';
    @let checked = checkedValuesMap();

    @if (label(); as label) {
      <div class="checkbox-group-label">{{ label | dynamicText | async }}</div>
    }

    <div
      [id]="checkboxGroupId"
      class="checkbox-group"
      role="group"
      [attr.aria-invalid]="ariaInvalid()"
      [attr.aria-required]="ariaRequired()"
      [attr.aria-describedby]="ariaDescribedBy()"
    >
      @for (option of options(); track option.value) {
        <mat-checkbox
          [checked]="checked['' + option.value]"
          [disabled]="f().disabled() || option.disabled"
          [color]="props()?.color || 'primary'"
          [labelPosition]="props()?.labelPosition || 'after'"
          (change)="onCheckboxChange(option, $event.checked)"
        >
          {{ option.label | dynamicText | async }}
        </mat-checkbox>
      }
    </div>

    @if (errorsToDisplay()[0]; as error) {
      <mat-error [id]="errorId()">{{ error.message }}</mat-error>
    } @else if (props()?.hint; as hint) {
      <div class="mat-hint" [id]="hintId()">{{ hint | dynamicText | async }}</div>
    }
  `, host: {
                        '[class]': 'className() || ""',
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                        '[attr.hidden]': 'field()().hidden() || null',
                    }, changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: false }] }], placeholder: [{ type: i0.Input, args: [{ isSignal: true, alias: "placeholder", required: false }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], options: [{ type: i0.Input, args: [{ isSignal: true, alias: "options", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }], meta: [{ type: i0.Input, args: [{ isSignal: true, alias: "meta", required: false }] }], validationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "validationMessages", required: false }] }], defaultValidationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "defaultValidationMessages", required: false }] }] } });

var matMultiCheckbox_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: MatMultiCheckboxFieldComponent
});

class MatRadioFieldComponent {
    elementRef = inject((ElementRef));
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    label = input(...(ngDevMode ? [undefined, { debugName: "label" }] : /* istanbul ignore next */ []));
    placeholder = input(...(ngDevMode ? [undefined, { debugName: "placeholder" }] : /* istanbul ignore next */ []));
    className = input('', ...(ngDevMode ? [{ debugName: "className" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    options = input([], ...(ngDevMode ? [{ debugName: "options" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    meta = input(...(ngDevMode ? [undefined, { debugName: "meta" }] : /* istanbul ignore next */ []));
    validationMessages = input(...(ngDevMode ? [undefined, { debugName: "validationMessages" }] : /* istanbul ignore next */ []));
    defaultValidationMessages = input(...(ngDevMode ? [undefined, { debugName: "defaultValidationMessages" }] : /* istanbul ignore next */ []));
    resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
    showErrors = shouldShowErrors(this.field);
    errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []), ...(ngDevMode ? [{ debugName: "errorsToDisplay" }] : /* istanbul ignore next */ []));
    constructor() {
        // Apply meta attributes to all radio inputs, re-apply when options change
        setupMetaTracking(this.elementRef, this.meta, {
            selector: 'input[type="radio"]',
            dependents: [this.options],
        });
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────────────────────────────────────
    /** Unique ID for the hint element, used for aria-describedby */
    hintId = computed(() => `${this.key()}-hint`, ...(ngDevMode ? [{ debugName: "hintId" }] : /* istanbul ignore next */ []));
    /** Base ID for error elements, used for aria-describedby */
    errorId = computed(() => `${this.key()}-error`, ...(ngDevMode ? [{ debugName: "errorId" }] : /* istanbul ignore next */ []));
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    ariaInvalid = computed(() => {
        const fieldState = this.field()();
        return fieldState.invalid() && fieldState.touched();
    }, ...(ngDevMode ? [{ debugName: "ariaInvalid" }] : /* istanbul ignore next */ []));
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    ariaRequired = computed(() => {
        return this.field()().required?.() === true ? true : null;
    }, ...(ngDevMode ? [{ debugName: "ariaRequired" }] : /* istanbul ignore next */ []));
    /** aria-describedby: links to hint and error messages for screen readers */
    ariaDescribedBy = createAriaDescribedBySignal(this.errorsToDisplay, this.errorId, this.hintId, () => !!this.props()?.hint);
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatRadioFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: MatRadioFieldComponent, isStandalone: true, selector: "df-mat-radio", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: false, transformFunction: null }, placeholder: { classPropertyName: "placeholder", publicName: "placeholder", isSignal: true, isRequired: false, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, options: { classPropertyName: "options", publicName: "options", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null }, meta: { classPropertyName: "meta", publicName: "meta", isSignal: true, isRequired: false, transformFunction: null }, validationMessages: { classPropertyName: "validationMessages", publicName: "validationMessages", isSignal: true, isRequired: false, transformFunction: null }, defaultValidationMessages: { classPropertyName: "defaultValidationMessages", publicName: "defaultValidationMessages", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "className() || \"\"", "id": "`${key()}`", "attr.data-testid": "key()", "attr.hidden": "field()().hidden() || null" } }, ngImport: i0, template: `
    @let f = field();
    @let radioGroupId = key() + '-radio-group';

    @if (label()) {
      <div class="radio-label">{{ label() | dynamicText | async }}</div>
    }

    <mat-radio-group
      [id]="radioGroupId"
      [formField]="f"
      [attr.aria-invalid]="ariaInvalid()"
      [attr.aria-required]="ariaRequired()"
      [attr.aria-describedby]="ariaDescribedBy()"
    >
      @for (option of options(); track option.value) {
        <mat-radio-button
          [value]="option.value"
          [disabled]="option.disabled || false"
          [color]="props()?.color || 'primary'"
          [labelPosition]="props()?.labelPosition || 'after'"
        >
          {{ option.label | dynamicText | async }}
        </mat-radio-button>
      }
    </mat-radio-group>

    @if (errorsToDisplay()[0]; as error) {
      <mat-error [id]="errorId()">{{ error.message }}</mat-error>
    } @else if (props()?.hint; as hint) {
      <div class="mat-hint" [id]="hintId()">{{ hint | dynamicText | async }}</div>
    }
  `, isInline: true, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n"], dependencies: [{ kind: "directive", type: MatRadioGroup, selector: "mat-radio-group", inputs: ["color", "name", "labelPosition", "value", "selected", "disabled", "required", "disabledInteractive"], outputs: ["change"], exportAs: ["matRadioGroup"] }, { kind: "component", type: MatRadioButton, selector: "mat-radio-button", inputs: ["id", "name", "aria-label", "aria-labelledby", "aria-describedby", "disableRipple", "tabIndex", "checked", "value", "labelPosition", "disabled", "required", "color", "disabledInteractive"], outputs: ["change"], exportAs: ["matRadioButton"] }, { kind: "directive", type: FormField, selector: "[formField]", inputs: ["formField"], exportAs: ["formField"] }, { kind: "directive", type: MatError, selector: "mat-error, [matError]", inputs: ["id"] }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }, { kind: "pipe", type: AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatRadioFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-mat-radio', imports: [MatRadioGroup, MatRadioButton, FormField, MatError, DynamicTextPipe, AsyncPipe], template: `
    @let f = field();
    @let radioGroupId = key() + '-radio-group';

    @if (label()) {
      <div class="radio-label">{{ label() | dynamicText | async }}</div>
    }

    <mat-radio-group
      [id]="radioGroupId"
      [formField]="f"
      [attr.aria-invalid]="ariaInvalid()"
      [attr.aria-required]="ariaRequired()"
      [attr.aria-describedby]="ariaDescribedBy()"
    >
      @for (option of options(); track option.value) {
        <mat-radio-button
          [value]="option.value"
          [disabled]="option.disabled || false"
          [color]="props()?.color || 'primary'"
          [labelPosition]="props()?.labelPosition || 'after'"
        >
          {{ option.label | dynamicText | async }}
        </mat-radio-button>
      }
    </mat-radio-group>

    @if (errorsToDisplay()[0]; as error) {
      <mat-error [id]="errorId()">{{ error.message }}</mat-error>
    } @else if (props()?.hint; as hint) {
      <div class="mat-hint" [id]="hintId()">{{ hint | dynamicText | async }}</div>
    }
  `, host: {
                        '[class]': 'className() || ""',
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                        '[attr.hidden]': 'field()().hidden() || null',
                    }, changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: false }] }], placeholder: [{ type: i0.Input, args: [{ isSignal: true, alias: "placeholder", required: false }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], options: [{ type: i0.Input, args: [{ isSignal: true, alias: "options", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }], meta: [{ type: i0.Input, args: [{ isSignal: true, alias: "meta", required: false }] }], validationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "validationMessages", required: false }] }], defaultValidationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "defaultValidationMessages", required: false }] }] } });

var matRadio_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: MatRadioFieldComponent
});

class MatSelectFieldComponent {
    materialConfig = inject(MATERIAL_CONFIG, { optional: true });
    elementRef = inject((ElementRef));
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    label = input(...(ngDevMode ? [undefined, { debugName: "label" }] : /* istanbul ignore next */ []));
    placeholder = input(...(ngDevMode ? [undefined, { debugName: "placeholder" }] : /* istanbul ignore next */ []));
    className = input('', ...(ngDevMode ? [{ debugName: "className" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    options = input([], ...(ngDevMode ? [{ debugName: "options" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    meta = input(...(ngDevMode ? [undefined, { debugName: "meta" }] : /* istanbul ignore next */ []));
    validationMessages = input(...(ngDevMode ? [undefined, { debugName: "validationMessages" }] : /* istanbul ignore next */ []));
    defaultValidationMessages = input(...(ngDevMode ? [undefined, { debugName: "defaultValidationMessages" }] : /* istanbul ignore next */ []));
    effectiveAppearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline', ...(ngDevMode ? [{ debugName: "effectiveAppearance" }] : /* istanbul ignore next */ []));
    effectiveSubscriptSizing = computed(() => this.props()?.subscriptSizing ?? this.materialConfig?.subscriptSizing ?? 'dynamic', ...(ngDevMode ? [{ debugName: "effectiveSubscriptSizing" }] : /* istanbul ignore next */ []));
    effectiveFloatLabel = computed(() => this.props()?.floatLabel ?? this.materialConfig?.floatLabel ?? 'auto', ...(ngDevMode ? [{ debugName: "effectiveFloatLabel" }] : /* istanbul ignore next */ []));
    effectiveHideRequiredMarker = computed(() => this.props()?.hideRequiredMarker ?? this.materialConfig?.hideRequiredMarker ?? false, ...(ngDevMode ? [{ debugName: "effectiveHideRequiredMarker" }] : /* istanbul ignore next */ []));
    resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
    showErrors = shouldShowErrors(this.field);
    errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []), ...(ngDevMode ? [{ debugName: "errorsToDisplay" }] : /* istanbul ignore next */ []));
    defaultCompare = Object.is;
    constructor() {
        // mat-select has no native input - apply meta to mat-select element
        setupMetaTracking(this.elementRef, this.meta, {
            selector: 'mat-select',
        });
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────────────────────────────────────
    /** Unique ID for the hint element, used for aria-describedby */
    hintId = computed(() => `${this.key()}-hint`, ...(ngDevMode ? [{ debugName: "hintId" }] : /* istanbul ignore next */ []));
    /** Base ID for error elements, used for aria-describedby */
    errorId = computed(() => `${this.key()}-error`, ...(ngDevMode ? [{ debugName: "errorId" }] : /* istanbul ignore next */ []));
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    ariaInvalid = computed(() => {
        const fieldState = this.field()();
        return fieldState.invalid() && fieldState.touched();
    }, ...(ngDevMode ? [{ debugName: "ariaInvalid" }] : /* istanbul ignore next */ []));
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    ariaRequired = computed(() => {
        return this.field()().required?.() === true ? true : null;
    }, ...(ngDevMode ? [{ debugName: "ariaRequired" }] : /* istanbul ignore next */ []));
    /** aria-describedby: links to hint and error messages for screen readers */
    ariaDescribedBy = createAriaDescribedBySignal(this.errorsToDisplay, this.errorId, this.hintId, () => !!this.props()?.hint);
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatSelectFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: MatSelectFieldComponent, isStandalone: true, selector: "df-mat-select", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: false, transformFunction: null }, placeholder: { classPropertyName: "placeholder", publicName: "placeholder", isSignal: true, isRequired: false, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, options: { classPropertyName: "options", publicName: "options", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null }, meta: { classPropertyName: "meta", publicName: "meta", isSignal: true, isRequired: false, transformFunction: null }, validationMessages: { classPropertyName: "validationMessages", publicName: "validationMessages", isSignal: true, isRequired: false, transformFunction: null }, defaultValidationMessages: { classPropertyName: "defaultValidationMessages", publicName: "defaultValidationMessages", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "id": "`${key()}`", "attr.data-testid": "key()", "class": "className()", "attr.hidden": "field()().hidden() || null" } }, ngImport: i0, template: `
    @let f = field();
    @let selectId = key() + '-select';

    <mat-form-field
      [appearance]="effectiveAppearance()"
      [subscriptSizing]="effectiveSubscriptSizing()"
      [floatLabel]="effectiveFloatLabel()"
      [hideRequiredMarker]="effectiveHideRequiredMarker()"
    >
      @if (label(); as label) {
        <mat-label>{{ label | dynamicText | async }}</mat-label>
      }

      <mat-select
        [id]="selectId"
        [formField]="f"
        [placeholder]="(placeholder() | dynamicText | async) ?? ''"
        [multiple]="props()?.multiple || false"
        [compareWith]="props()?.compareWith || defaultCompare"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.aria-required]="ariaRequired()"
        [attr.aria-describedby]="ariaDescribedBy()"
      >
        @for (option of options(); track option.value) {
          <mat-option [value]="option.value" [disabled]="option.disabled || false">
            {{ option.label | dynamicText | async }}
          </mat-option>
        }
      </mat-select>

      @if (errorsToDisplay()[0]; as error) {
        <mat-error [id]="errorId()">{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint [id]="hintId()">{{ hint | dynamicText | async }}</mat-hint>
      }
    </mat-form-field>
  `, isInline: true, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", "mat-form-field{width:100%}\n"], dependencies: [{ kind: "component", type: MatFormField, selector: "mat-form-field", inputs: ["hideRequiredMarker", "color", "floatLabel", "appearance", "subscriptSizing", "hintLabel"], exportAs: ["matFormField"] }, { kind: "directive", type: MatLabel, selector: "mat-label" }, { kind: "component", type: MatSelect, selector: "mat-select", inputs: ["aria-describedby", "panelClass", "disabled", "disableRipple", "tabIndex", "hideSingleSelectionIndicator", "placeholder", "required", "multiple", "disableOptionCentering", "compareWith", "value", "aria-label", "aria-labelledby", "errorStateMatcher", "typeaheadDebounceInterval", "sortComparator", "id", "panelWidth", "canSelectNullableOptions"], outputs: ["openedChange", "opened", "closed", "selectionChange", "valueChange"], exportAs: ["matSelect"] }, { kind: "component", type: MatOption, selector: "mat-option", inputs: ["value", "id", "disabled"], outputs: ["onSelectionChange"], exportAs: ["matOption"] }, { kind: "directive", type: MatHint, selector: "mat-hint", inputs: ["align", "id"] }, { kind: "directive", type: FormField, selector: "[formField]", inputs: ["formField"], exportAs: ["formField"] }, { kind: "directive", type: MatError$1, selector: "mat-error, [matError]", inputs: ["id"] }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }, { kind: "pipe", type: AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatSelectFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-mat-select', imports: [MatFormField, MatLabel, MatSelect, MatOption, MatHint, FormField, MatError$1, DynamicTextPipe, AsyncPipe], template: `
    @let f = field();
    @let selectId = key() + '-select';

    <mat-form-field
      [appearance]="effectiveAppearance()"
      [subscriptSizing]="effectiveSubscriptSizing()"
      [floatLabel]="effectiveFloatLabel()"
      [hideRequiredMarker]="effectiveHideRequiredMarker()"
    >
      @if (label(); as label) {
        <mat-label>{{ label | dynamicText | async }}</mat-label>
      }

      <mat-select
        [id]="selectId"
        [formField]="f"
        [placeholder]="(placeholder() | dynamicText | async) ?? ''"
        [multiple]="props()?.multiple || false"
        [compareWith]="props()?.compareWith || defaultCompare"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.aria-required]="ariaRequired()"
        [attr.aria-describedby]="ariaDescribedBy()"
      >
        @for (option of options(); track option.value) {
          <mat-option [value]="option.value" [disabled]="option.disabled || false">
            {{ option.label | dynamicText | async }}
          </mat-option>
        }
      </mat-select>

      @if (errorsToDisplay()[0]; as error) {
        <mat-error [id]="errorId()">{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint [id]="hintId()">{{ hint | dynamicText | async }}</mat-hint>
      }
    </mat-form-field>
  `, changeDetection: ChangeDetectionStrategy.OnPush, host: {
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                        '[class]': 'className()',
                        '[attr.hidden]': 'field()().hidden() || null',
                    }, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", "mat-form-field{width:100%}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: false }] }], placeholder: [{ type: i0.Input, args: [{ isSignal: true, alias: "placeholder", required: false }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], options: [{ type: i0.Input, args: [{ isSignal: true, alias: "options", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }], meta: [{ type: i0.Input, args: [{ isSignal: true, alias: "meta", required: false }] }], validationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "validationMessages", required: false }] }], defaultValidationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "defaultValidationMessages", required: false }] }] } });

var matSelect_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: MatSelectFieldComponent
});

class MatSliderFieldComponent {
    elementRef = inject((ElementRef));
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    constructor() {
        setupMetaTracking(this.elementRef, this.meta, { selector: 'input' });
    }
    label = input(...(ngDevMode ? [undefined, { debugName: "label" }] : /* istanbul ignore next */ []));
    placeholder = input(...(ngDevMode ? [undefined, { debugName: "placeholder" }] : /* istanbul ignore next */ []));
    className = input('', ...(ngDevMode ? [{ debugName: "className" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    meta = input(...(ngDevMode ? [undefined, { debugName: "meta" }] : /* istanbul ignore next */ []));
    validationMessages = input(...(ngDevMode ? [undefined, { debugName: "validationMessages" }] : /* istanbul ignore next */ []));
    defaultValidationMessages = input(...(ngDevMode ? [undefined, { debugName: "defaultValidationMessages" }] : /* istanbul ignore next */ []));
    resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
    showErrors = shouldShowErrors(this.field);
    errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []), ...(ngDevMode ? [{ debugName: "errorsToDisplay" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────────────────────────────────────
    /** Unique ID for the hint element, used for aria-describedby */
    hintId = computed(() => `${this.key()}-hint`, ...(ngDevMode ? [{ debugName: "hintId" }] : /* istanbul ignore next */ []));
    /** Base ID for error elements, used for aria-describedby */
    errorId = computed(() => `${this.key()}-error`, ...(ngDevMode ? [{ debugName: "errorId" }] : /* istanbul ignore next */ []));
    /** aria-required: true when field has required validation, null otherwise */
    ariaRequired = computed(() => {
        return this.field()().required?.() === true ? true : null;
    }, ...(ngDevMode ? [{ debugName: "ariaRequired" }] : /* istanbul ignore next */ []));
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    ariaInvalid = computed(() => {
        const fieldState = this.field()();
        return fieldState.invalid() && fieldState.touched();
    }, ...(ngDevMode ? [{ debugName: "ariaInvalid" }] : /* istanbul ignore next */ []));
    /** aria-describedby: links to hint and error messages for screen readers */
    ariaDescribedBy = createAriaDescribedBySignal(this.errorsToDisplay, this.errorId, this.hintId, () => !!this.props()?.hint);
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatSliderFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: MatSliderFieldComponent, isStandalone: true, selector: "df-mat-slider", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: false, transformFunction: null }, placeholder: { classPropertyName: "placeholder", publicName: "placeholder", isSignal: true, isRequired: false, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null }, meta: { classPropertyName: "meta", publicName: "meta", isSignal: true, isRequired: false, transformFunction: null }, validationMessages: { classPropertyName: "validationMessages", publicName: "validationMessages", isSignal: true, isRequired: false, transformFunction: null }, defaultValidationMessages: { classPropertyName: "defaultValidationMessages", publicName: "defaultValidationMessages", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "className()", "id": "`${key()}`", "attr.data-testid": "key()", "attr.hidden": "field()().hidden() || null" } }, ngImport: i0, template: `
    @let f = field();
    @let inputId = key() + '-input';

    @if (label(); as label) {
      <div class="slider-label">{{ label | dynamicText | async }}</div>
    }

    <mat-slider
      [min]="f().min?.() ?? 0"
      [max]="f().max?.() ?? 100"
      [step]="props()?.step ?? 1"
      [discrete]="props()?.thumbLabel || props()?.showThumbLabel"
      [showTickMarks]="props()?.tickInterval !== undefined"
      [color]="props()?.color || 'primary'"
      class="slider-container"
    >
      <input
        matSliderThumb
        [id]="inputId"
        [formField]="f"
        [attr.tabindex]="tabIndex()"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.aria-required]="ariaRequired()"
        [attr.aria-describedby]="ariaDescribedBy()"
      />
    </mat-slider>

    @if (errorsToDisplay()[0]; as error) {
      <mat-error [id]="errorId()">{{ error.message }}</mat-error>
    } @else if (props()?.hint; as hint) {
      <div class="mat-hint" [id]="hintId()">{{ hint | dynamicText | async }}</div>
    }
  `, isInline: true, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", ".slider-container{width:100%}\n"], dependencies: [{ kind: "component", type: MatSlider, selector: "mat-slider", inputs: ["disabled", "discrete", "showTickMarks", "min", "color", "disableRipple", "max", "step", "displayWith"], exportAs: ["matSlider"] }, { kind: "directive", type: MatSliderThumb, selector: "input[matSliderThumb]", inputs: ["value"], outputs: ["valueChange", "dragStart", "dragEnd"], exportAs: ["matSliderThumb"] }, { kind: "directive", type: MatError, selector: "mat-error, [matError]", inputs: ["id"] }, { kind: "directive", type: FormField, selector: "[formField]", inputs: ["formField"], exportAs: ["formField"] }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }, { kind: "pipe", type: AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatSliderFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-mat-slider', imports: [MatSlider, MatSliderThumb, MatError, DynamicTextPipe, AsyncPipe, FormField], template: `
    @let f = field();
    @let inputId = key() + '-input';

    @if (label(); as label) {
      <div class="slider-label">{{ label | dynamicText | async }}</div>
    }

    <mat-slider
      [min]="f().min?.() ?? 0"
      [max]="f().max?.() ?? 100"
      [step]="props()?.step ?? 1"
      [discrete]="props()?.thumbLabel || props()?.showThumbLabel"
      [showTickMarks]="props()?.tickInterval !== undefined"
      [color]="props()?.color || 'primary'"
      class="slider-container"
    >
      <input
        matSliderThumb
        [id]="inputId"
        [formField]="f"
        [attr.tabindex]="tabIndex()"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.aria-required]="ariaRequired()"
        [attr.aria-describedby]="ariaDescribedBy()"
      />
    </mat-slider>

    @if (errorsToDisplay()[0]; as error) {
      <mat-error [id]="errorId()">{{ error.message }}</mat-error>
    } @else if (props()?.hint; as hint) {
      <div class="mat-hint" [id]="hintId()">{{ hint | dynamicText | async }}</div>
    }
  `, host: {
                        '[class]': 'className()',
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                        '[attr.hidden]': 'field()().hidden() || null',
                    }, changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", ".slider-container{width:100%}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: false }] }], placeholder: [{ type: i0.Input, args: [{ isSignal: true, alias: "placeholder", required: false }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }], meta: [{ type: i0.Input, args: [{ isSignal: true, alias: "meta", required: false }] }], validationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "validationMessages", required: false }] }], defaultValidationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "defaultValidationMessages", required: false }] }] } });

var matSlider_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: MatSliderFieldComponent
});

class MatButtonFieldComponent {
    eventBus = inject(EventBus);
    arrayContext = inject(ARRAY_CONTEXT, { optional: true });
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    label = input.required(...(ngDevMode ? [{ debugName: "label" }] : /* istanbul ignore next */ []));
    disabled = input(false, ...(ngDevMode ? [{ debugName: "disabled" }] : /* istanbul ignore next */ []));
    hidden = input(false, ...(ngDevMode ? [{ debugName: "hidden" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    className = input('', ...(ngDevMode ? [{ debugName: "className" }] : /* istanbul ignore next */ []));
    /** Event to dispatch on click. Optional for submit buttons (native form submit handles it). */
    event = input(...(ngDevMode ? [undefined, { debugName: "event" }] : /* istanbul ignore next */ []));
    eventArgs = input(...(ngDevMode ? [undefined, { debugName: "eventArgs" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    eventContext = input(...(ngDevMode ? [undefined, { debugName: "eventContext" }] : /* istanbul ignore next */ []));
    /** Resolved button type - defaults to 'button' if not specified in props */
    buttonType = computed(() => this.props()?.type ?? 'button', ...(ngDevMode ? [{ debugName: "buttonType" }] : /* istanbul ignore next */ []));
    buttonTestId = computed(() => `${this.buttonType()}-${this.key()}`, ...(ngDevMode ? [{ debugName: "buttonTestId" }] : /* istanbul ignore next */ []));
    /**
     * Handle button click.
     * - For submit buttons (type="submit"): do nothing, native form submit handles it
     * - For other buttons: dispatch the configured event via EventBus
     */
    onClick() {
        // Native submit buttons let the form handle submission
        if (this.buttonType() === 'submit') {
            return;
        }
        // Other buttons dispatch their event (if configured)
        const event = this.event();
        if (event) {
            this.dispatchEvent(event);
        }
    }
    dispatchEvent(event) {
        const args = this.eventArgs();
        if (args && args.length > 0) {
            // Build context from injected ARRAY_CONTEXT (with linkedSignal index) or fallback to eventContext
            const context = this.arrayContext
                ? {
                    key: this.key(),
                    // Read signal to get current index (automatically updates via linkedSignal)
                    index: this.arrayContext.index(),
                    arrayKey: this.arrayContext.arrayKey,
                    formValue: this.arrayContext.formValue,
                }
                : this.eventContext() || { key: this.key() };
            // Resolve tokens in event args using the provided context
            const resolvedArgs = resolveTokens(args, context);
            // Dispatch event with resolved args
            this.eventBus.dispatch(event, ...resolvedArgs);
        }
        else {
            // No args, dispatch event without arguments
            this.eventBus.dispatch(event);
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatButtonFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.1.0", version: "21.2.6", type: MatButtonFieldComponent, isStandalone: true, selector: "df-mat-button", inputs: { key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: true, transformFunction: null }, disabled: { classPropertyName: "disabled", publicName: "disabled", isSignal: true, isRequired: false, transformFunction: null }, hidden: { classPropertyName: "hidden", publicName: "hidden", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, event: { classPropertyName: "event", publicName: "event", isSignal: true, isRequired: false, transformFunction: null }, eventArgs: { classPropertyName: "eventArgs", publicName: "eventArgs", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null }, eventContext: { classPropertyName: "eventContext", publicName: "eventContext", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "id": "`${key()}`", "attr.data-testid": "key()", "class": "className()", "attr.hidden": "hidden() || null" } }, ngImport: i0, template: `
    @let buttonId = key() + '-button';
    <button
      mat-raised-button
      [id]="buttonId"
      [type]="buttonType()"
      [color]="props()?.color || 'primary'"
      [disabled]="disabled()"
      [attr.data-testid]="buttonTestId()"
      (click)="onClick()"
    >
      {{ label() | dynamicText | async }}
    </button>
  `, isInline: true, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", "button{min-width:fit-content}\n"], dependencies: [{ kind: "component", type: MatButton, selector: "    button[matButton], a[matButton], button[mat-button], button[mat-raised-button],    button[mat-flat-button], button[mat-stroked-button], a[mat-button], a[mat-raised-button],    a[mat-flat-button], a[mat-stroked-button]  ", inputs: ["matButton"], exportAs: ["matButton", "matAnchor"] }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }, { kind: "pipe", type: AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatButtonFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-mat-button', imports: [MatButton, DynamicTextPipe, AsyncPipe], host: {
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                        '[class]': 'className()',
                        '[attr.hidden]': 'hidden() || null',
                    }, template: `
    @let buttonId = key() + '-button';
    <button
      mat-raised-button
      [id]="buttonId"
      [type]="buttonType()"
      [color]="props()?.color || 'primary'"
      [disabled]="disabled()"
      [attr.data-testid]="buttonTestId()"
      (click)="onClick()"
    >
      {{ label() | dynamicText | async }}
    </button>
  `, changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", "button{min-width:fit-content}\n"] }]
        }], propDecorators: { key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: true }] }], disabled: [{ type: i0.Input, args: [{ isSignal: true, alias: "disabled", required: false }] }], hidden: [{ type: i0.Input, args: [{ isSignal: true, alias: "hidden", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], event: [{ type: i0.Input, args: [{ isSignal: true, alias: "event", required: false }] }], eventArgs: [{ type: i0.Input, args: [{ isSignal: true, alias: "eventArgs", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }], eventContext: [{ type: i0.Input, args: [{ isSignal: true, alias: "eventContext", required: false }] }] } });

var matButton_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: MatButtonFieldComponent
});

// Public API - component

class MatTextareaFieldComponent {
    materialConfig = inject(MATERIAL_CONFIG, { optional: true });
    elementRef = inject((ElementRef));
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    label = input(...(ngDevMode ? [undefined, { debugName: "label" }] : /* istanbul ignore next */ []));
    placeholder = input(...(ngDevMode ? [undefined, { debugName: "placeholder" }] : /* istanbul ignore next */ []));
    className = input('', ...(ngDevMode ? [{ debugName: "className" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    meta = input(...(ngDevMode ? [undefined, { debugName: "meta" }] : /* istanbul ignore next */ []));
    validationMessages = input(...(ngDevMode ? [undefined, { debugName: "validationMessages" }] : /* istanbul ignore next */ []));
    defaultValidationMessages = input(...(ngDevMode ? [undefined, { debugName: "defaultValidationMessages" }] : /* istanbul ignore next */ []));
    constructor() {
        setupMetaTracking(this.elementRef, this.meta, { selector: 'textarea' });
    }
    /**
     * Reference to the native textarea element.
     * Used to imperatively sync the readonly attribute since Angular Signal Forms'
     * [field] directive doesn't sync FieldState.readonly() to the DOM.
     */
    textareaRef = viewChild('textareaRef', ...(ngDevMode ? [{ debugName: "textareaRef" }] : /* istanbul ignore next */ []));
    /**
     * Computed signal that extracts the readonly state from the field.
     * Used by the effect to reactively sync the readonly attribute to the DOM.
     */
    isReadonly = computed(() => this.field()().readonly(), ...(ngDevMode ? [{ debugName: "isReadonly" }] : /* istanbul ignore next */ []));
    /**
     * Workaround: Angular Signal Forms' [field] directive does NOT sync the readonly
     * attribute to the DOM, even though FieldState.readonly() returns the correct value.
     * This effect imperatively sets/removes the readonly attribute on the native textarea
     * element whenever the readonly state changes.
     *
     * Note: We cannot use [readonly] or [attr.readonly] bindings because Angular throws
     * NG8022: "Binding to '[readonly]' is not allowed on nodes using the '[field]' directive"
     *
     * Uses afterRenderEffect to ensure DOM is ready before manipulating attributes.
     *
     * @see https://github.com/angular/angular/issues/65897
     */
    syncReadonlyToDom = afterRenderEffect({
        write: () => {
            const textareaRef = this.textareaRef();
            const isReadonly = this.isReadonly();
            if (textareaRef?.nativeElement) {
                if (isReadonly) {
                    textareaRef.nativeElement.setAttribute('readonly', '');
                }
                else {
                    textareaRef.nativeElement.removeAttribute('readonly');
                }
            }
        },
    });
    effectiveAppearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline', ...(ngDevMode ? [{ debugName: "effectiveAppearance" }] : /* istanbul ignore next */ []));
    effectiveSubscriptSizing = computed(() => this.props()?.subscriptSizing ?? this.materialConfig?.subscriptSizing ?? 'dynamic', ...(ngDevMode ? [{ debugName: "effectiveSubscriptSizing" }] : /* istanbul ignore next */ []));
    effectiveFloatLabel = computed(() => this.props()?.floatLabel ?? this.materialConfig?.floatLabel ?? 'auto', ...(ngDevMode ? [{ debugName: "effectiveFloatLabel" }] : /* istanbul ignore next */ []));
    effectiveHideRequiredMarker = computed(() => this.props()?.hideRequiredMarker ?? this.materialConfig?.hideRequiredMarker ?? false, ...(ngDevMode ? [{ debugName: "effectiveHideRequiredMarker" }] : /* istanbul ignore next */ []));
    resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
    showErrors = shouldShowErrors(this.field);
    errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []), ...(ngDevMode ? [{ debugName: "errorsToDisplay" }] : /* istanbul ignore next */ []));
    // ─────────────────────────────────────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────────────────────────────────────
    /** Unique ID for the hint element, used for aria-describedby */
    hintId = computed(() => `${this.key()}-hint`, ...(ngDevMode ? [{ debugName: "hintId" }] : /* istanbul ignore next */ []));
    /** Base ID for error elements, used for aria-describedby */
    errorId = computed(() => `${this.key()}-error`, ...(ngDevMode ? [{ debugName: "errorId" }] : /* istanbul ignore next */ []));
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    ariaInvalid = computed(() => {
        const fieldState = this.field()();
        return fieldState.invalid() && fieldState.touched();
    }, ...(ngDevMode ? [{ debugName: "ariaInvalid" }] : /* istanbul ignore next */ []));
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    ariaRequired = computed(() => {
        return this.field()().required?.() === true ? true : null;
    }, ...(ngDevMode ? [{ debugName: "ariaRequired" }] : /* istanbul ignore next */ []));
    /** aria-describedby: links to hint and error messages for screen readers */
    ariaDescribedBy = createAriaDescribedBySignal(this.errorsToDisplay, this.errorId, this.hintId, () => !!this.props()?.hint);
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatTextareaFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: MatTextareaFieldComponent, isStandalone: true, selector: "df-mat-textarea", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: false, transformFunction: null }, placeholder: { classPropertyName: "placeholder", publicName: "placeholder", isSignal: true, isRequired: false, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null }, meta: { classPropertyName: "meta", publicName: "meta", isSignal: true, isRequired: false, transformFunction: null }, validationMessages: { classPropertyName: "validationMessages", publicName: "validationMessages", isSignal: true, isRequired: false, transformFunction: null }, defaultValidationMessages: { classPropertyName: "defaultValidationMessages", publicName: "defaultValidationMessages", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "id": "`${key()}`", "attr.data-testid": "key()", "class": "className()", "attr.hidden": "field()().hidden() || null" } }, viewQueries: [{ propertyName: "textareaRef", first: true, predicate: ["textareaRef"], descendants: true, isSignal: true }], ngImport: i0, template: `
    @let f = field();
    @let textareaId = key() + '-textarea';

    <mat-form-field
      [appearance]="effectiveAppearance()"
      [subscriptSizing]="effectiveSubscriptSizing()"
      [floatLabel]="effectiveFloatLabel()"
      [hideRequiredMarker]="effectiveHideRequiredMarker()"
    >
      @if (label()) {
        <mat-label>{{ label() | dynamicText | async }}</mat-label>
      }

      <textarea
        #textareaRef
        matInput
        [id]="textareaId"
        [formField]="f"
        [placeholder]="(placeholder() | dynamicText | async) ?? ''"
        [attr.tabindex]="tabIndex()"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.aria-required]="ariaRequired()"
        [attr.aria-describedby]="ariaDescribedBy()"
        [style.resize]="props()?.resize || 'vertical'"
      ></textarea>

      @if (errorsToDisplay()[0]; as error) {
        <mat-error [id]="errorId()">{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint [id]="hintId()">{{ hint | dynamicText | async }}</mat-hint>
      }
    </mat-form-field>
  `, isInline: true, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", "mat-form-field{width:100%}\n"], dependencies: [{ kind: "component", type: MatFormField, selector: "mat-form-field", inputs: ["hideRequiredMarker", "color", "floatLabel", "appearance", "subscriptSizing", "hintLabel"], exportAs: ["matFormField"] }, { kind: "directive", type: MatLabel, selector: "mat-label" }, { kind: "directive", type: MatInput, selector: "input[matInput], textarea[matInput], select[matNativeControl],      input[matNativeControl], textarea[matNativeControl]", inputs: ["disabled", "id", "placeholder", "name", "required", "type", "errorStateMatcher", "aria-describedby", "value", "readonly", "disabledInteractive"], exportAs: ["matInput"] }, { kind: "directive", type: MatHint, selector: "mat-hint", inputs: ["align", "id"] }, { kind: "directive", type: FormField, selector: "[formField]", inputs: ["formField"], exportAs: ["formField"] }, { kind: "directive", type: MatError$1, selector: "mat-error, [matError]", inputs: ["id"] }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }, { kind: "pipe", type: AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatTextareaFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-mat-textarea', imports: [MatFormField, MatLabel, MatInput, MatHint, FormField, MatError$1, DynamicTextPipe, AsyncPipe], template: `
    @let f = field();
    @let textareaId = key() + '-textarea';

    <mat-form-field
      [appearance]="effectiveAppearance()"
      [subscriptSizing]="effectiveSubscriptSizing()"
      [floatLabel]="effectiveFloatLabel()"
      [hideRequiredMarker]="effectiveHideRequiredMarker()"
    >
      @if (label()) {
        <mat-label>{{ label() | dynamicText | async }}</mat-label>
      }

      <textarea
        #textareaRef
        matInput
        [id]="textareaId"
        [formField]="f"
        [placeholder]="(placeholder() | dynamicText | async) ?? ''"
        [attr.tabindex]="tabIndex()"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.aria-required]="ariaRequired()"
        [attr.aria-describedby]="ariaDescribedBy()"
        [style.resize]="props()?.resize || 'vertical'"
      ></textarea>

      @if (errorsToDisplay()[0]; as error) {
        <mat-error [id]="errorId()">{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint [id]="hintId()">{{ hint | dynamicText | async }}</mat-hint>
      }
    </mat-form-field>
  `, changeDetection: ChangeDetectionStrategy.OnPush, host: {
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                        '[class]': 'className()',
                        '[attr.hidden]': 'field()().hidden() || null',
                    }, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n", "mat-form-field{width:100%}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: false }] }], placeholder: [{ type: i0.Input, args: [{ isSignal: true, alias: "placeholder", required: false }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }], meta: [{ type: i0.Input, args: [{ isSignal: true, alias: "meta", required: false }] }], validationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "validationMessages", required: false }] }], defaultValidationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "defaultValidationMessages", required: false }] }], textareaRef: [{ type: i0.ViewChild, args: ['textareaRef', { isSignal: true }] }] } });

var matTextarea_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: MatTextareaFieldComponent
});

class MatToggleFieldComponent {
    materialConfig = inject(MATERIAL_CONFIG, { optional: true });
    elementRef = inject((ElementRef));
    field = input.required(...(ngDevMode ? [{ debugName: "field" }] : /* istanbul ignore next */ []));
    key = input.required(...(ngDevMode ? [{ debugName: "key" }] : /* istanbul ignore next */ []));
    label = input(...(ngDevMode ? [undefined, { debugName: "label" }] : /* istanbul ignore next */ []));
    placeholder = input(...(ngDevMode ? [undefined, { debugName: "placeholder" }] : /* istanbul ignore next */ []));
    className = input('', ...(ngDevMode ? [{ debugName: "className" }] : /* istanbul ignore next */ []));
    tabIndex = input(...(ngDevMode ? [undefined, { debugName: "tabIndex" }] : /* istanbul ignore next */ []));
    props = input(...(ngDevMode ? [undefined, { debugName: "props" }] : /* istanbul ignore next */ []));
    meta = input(...(ngDevMode ? [undefined, { debugName: "meta" }] : /* istanbul ignore next */ []));
    validationMessages = input(...(ngDevMode ? [undefined, { debugName: "validationMessages" }] : /* istanbul ignore next */ []));
    defaultValidationMessages = input(...(ngDevMode ? [undefined, { debugName: "defaultValidationMessages" }] : /* istanbul ignore next */ []));
    effectiveDisableRipple = computed(() => this.props()?.disableRipple ?? this.materialConfig?.disableRipple ?? false, ...(ngDevMode ? [{ debugName: "effectiveDisableRipple" }] : /* istanbul ignore next */ []));
    resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
    showErrors = shouldShowErrors(this.field);
    errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []), ...(ngDevMode ? [{ debugName: "errorsToDisplay" }] : /* istanbul ignore next */ []));
    constructor() {
        // Apply meta attributes to the internal toggle button
        // Note: mat-slide-toggle uses <button role="switch"> instead of <input type="checkbox">
        setupMetaTracking(this.elementRef, this.meta, {
            selector: 'button[role="switch"]',
        });
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Accessibility
    // ─────────────────────────────────────────────────────────────────────────────
    /** Unique ID for the hint element, used for aria-describedby */
    hintId = computed(() => `${this.key()}-hint`, ...(ngDevMode ? [{ debugName: "hintId" }] : /* istanbul ignore next */ []));
    /** Base ID for error elements, used for aria-describedby */
    errorId = computed(() => `${this.key()}-error`, ...(ngDevMode ? [{ debugName: "errorId" }] : /* istanbul ignore next */ []));
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    ariaInvalid = computed(() => {
        const fieldState = this.field()();
        return fieldState.invalid() && fieldState.touched();
    }, ...(ngDevMode ? [{ debugName: "ariaInvalid" }] : /* istanbul ignore next */ []));
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    ariaRequired = computed(() => {
        return this.field()().required?.() === true ? true : null;
    }, ...(ngDevMode ? [{ debugName: "ariaRequired" }] : /* istanbul ignore next */ []));
    /** aria-describedby: links to hint and error messages for screen readers */
    ariaDescribedBy = createAriaDescribedBySignal(this.errorsToDisplay, this.errorId, this.hintId, () => !!this.props()?.hint);
    /**
     * Workaround: Angular Material's MatSlideToggle does NOT propagate aria-required to its internal
     * button element. This effect imperatively sets/removes aria-required on the internal button.
     *
     * Uses afterRenderEffect to ensure DOM is ready before querying internal elements.
     */
    syncAriaRequiredToDom = afterRenderEffect(() => {
        const isRequired = this.ariaRequired();
        const buttonEl = this.elementRef.nativeElement.querySelector('button[role="switch"]');
        if (buttonEl) {
            if (isRequired) {
                buttonEl.setAttribute('aria-required', 'true');
            }
            else {
                buttonEl.removeAttribute('aria-required');
            }
        }
    });
    /**
     * Workaround: Angular Material's MatSlideToggle does NOT propagate aria-describedby to its internal
     * button element. This effect imperatively sets/removes aria-describedby on the internal button.
     *
     * Uses afterRenderEffect to ensure DOM is ready before querying internal elements.
     */
    syncAriaDescribedByToDom = afterRenderEffect(() => {
        const describedBy = this.ariaDescribedBy();
        const buttonEl = this.elementRef.nativeElement.querySelector('button[role="switch"]');
        if (buttonEl) {
            if (describedBy) {
                buttonEl.setAttribute('aria-describedby', describedBy);
            }
            else {
                buttonEl.removeAttribute('aria-describedby');
            }
        }
    });
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatToggleFieldComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "21.2.6", type: MatToggleFieldComponent, isStandalone: true, selector: "df-mat-toggle", inputs: { field: { classPropertyName: "field", publicName: "field", isSignal: true, isRequired: true, transformFunction: null }, key: { classPropertyName: "key", publicName: "key", isSignal: true, isRequired: true, transformFunction: null }, label: { classPropertyName: "label", publicName: "label", isSignal: true, isRequired: false, transformFunction: null }, placeholder: { classPropertyName: "placeholder", publicName: "placeholder", isSignal: true, isRequired: false, transformFunction: null }, className: { classPropertyName: "className", publicName: "className", isSignal: true, isRequired: false, transformFunction: null }, tabIndex: { classPropertyName: "tabIndex", publicName: "tabIndex", isSignal: true, isRequired: false, transformFunction: null }, props: { classPropertyName: "props", publicName: "props", isSignal: true, isRequired: false, transformFunction: null }, meta: { classPropertyName: "meta", publicName: "meta", isSignal: true, isRequired: false, transformFunction: null }, validationMessages: { classPropertyName: "validationMessages", publicName: "validationMessages", isSignal: true, isRequired: false, transformFunction: null }, defaultValidationMessages: { classPropertyName: "defaultValidationMessages", publicName: "defaultValidationMessages", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "className()", "id": "`${key()}`", "attr.data-testid": "key()", "attr.hidden": "field()().hidden() || null" } }, ngImport: i0, template: `
    @let f = field();
    @let toggleId = key() + '-toggle';

    <mat-slide-toggle
      [id]="toggleId"
      [formField]="f"
      [color]="props()?.color || 'primary'"
      [labelPosition]="props()?.labelPosition || 'after'"
      [hideIcon]="props()?.hideIcon || false"
      [disableRipple]="effectiveDisableRipple()"
      [required]="!!f().required()"
      [attr.aria-describedby]="ariaDescribedBy()"
      [attr.tabindex]="tabIndex()"
      class="toggle-container"
    >
      {{ label() | dynamicText | async }}
    </mat-slide-toggle>

    @if (errorsToDisplay()[0]; as error) {
      <mat-error [id]="errorId()">{{ error.message }}</mat-error>
    } @else if (props()?.hint; as hint) {
      <div class="mat-hint" [id]="hintId()">{{ hint | dynamicText | async }}</div>
    }
  `, isInline: true, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n"], dependencies: [{ kind: "component", type: MatSlideToggle, selector: "mat-slide-toggle", inputs: ["name", "id", "labelPosition", "aria-label", "aria-labelledby", "aria-describedby", "required", "color", "disabled", "disableRipple", "tabIndex", "checked", "hideIcon", "disabledInteractive"], outputs: ["change", "toggleChange"], exportAs: ["matSlideToggle"] }, { kind: "directive", type: FormField, selector: "[formField]", inputs: ["formField"], exportAs: ["formField"] }, { kind: "directive", type: MatError, selector: "mat-error, [matError]", inputs: ["id"] }, { kind: "pipe", type: DynamicTextPipe, name: "dynamicText" }, { kind: "pipe", type: AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.2.6", ngImport: i0, type: MatToggleFieldComponent, decorators: [{
            type: Component,
            args: [{ selector: 'df-mat-toggle', imports: [MatSlideToggle, FormField, MatError, DynamicTextPipe, AsyncPipe], template: `
    @let f = field();
    @let toggleId = key() + '-toggle';

    <mat-slide-toggle
      [id]="toggleId"
      [formField]="f"
      [color]="props()?.color || 'primary'"
      [labelPosition]="props()?.labelPosition || 'after'"
      [hideIcon]="props()?.hideIcon || false"
      [disableRipple]="effectiveDisableRipple()"
      [required]="!!f().required()"
      [attr.aria-describedby]="ariaDescribedBy()"
      [attr.tabindex]="tabIndex()"
      class="toggle-container"
    >
      {{ label() | dynamicText | async }}
    </mat-slide-toggle>

    @if (errorsToDisplay()[0]; as error) {
      <mat-error [id]="errorId()">{{ error.message }}</mat-error>
    } @else if (props()?.hint; as hint) {
      <div class="mat-hint" [id]="hintId()">{{ hint | dynamicText | async }}</div>
    }
  `, host: {
                        '[class]': 'className()',
                        '[id]': '`${key()}`',
                        '[attr.data-testid]': 'key()',
                        '[attr.hidden]': 'field()().hidden() || null',
                    }, changeDetection: ChangeDetectionStrategy.OnPush, styles: [":host{--df-field-gap: .5rem;--df-label-font-weight: 500;--df-label-color: inherit;--df-hint-color: rgba(0, 0, 0, .6);--df-hint-font-size: .875rem;--df-error-color: #f44336;--df-error-font-size: .875rem;display:block;width:100%}:host([hidden]){display:none!important}.df-mat-field{display:flex;flex-direction:column;gap:var(--df-field-gap);width:100%}.df-mat-label{font-weight:var(--df-label-font-weight);color:var(--df-label-color)}.df-mat-hint{color:var(--df-hint-color);font-size:var(--df-hint-font-size)}.df-mat-error{color:var(--df-error-color);font-size:var(--df-error-font-size)}\n"] }]
        }], ctorParameters: () => [], propDecorators: { field: [{ type: i0.Input, args: [{ isSignal: true, alias: "field", required: true }] }], key: [{ type: i0.Input, args: [{ isSignal: true, alias: "key", required: true }] }], label: [{ type: i0.Input, args: [{ isSignal: true, alias: "label", required: false }] }], placeholder: [{ type: i0.Input, args: [{ isSignal: true, alias: "placeholder", required: false }] }], className: [{ type: i0.Input, args: [{ isSignal: true, alias: "className", required: false }] }], tabIndex: [{ type: i0.Input, args: [{ isSignal: true, alias: "tabIndex", required: false }] }], props: [{ type: i0.Input, args: [{ isSignal: true, alias: "props", required: false }] }], meta: [{ type: i0.Input, args: [{ isSignal: true, alias: "meta", required: false }] }], validationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "validationMessages", required: false }] }], defaultValidationMessages: [{ type: i0.Input, args: [{ isSignal: true, alias: "defaultValidationMessages", required: false }] }] } });

var matToggle_component = /*#__PURE__*/Object.freeze({
    __proto__: null,
    default: MatToggleFieldComponent
});

// Public exports for material field components and types

/**
 * Material Design field type constants
 * Based on available field components in the /fields folder
 */
const MatField = {
    Input: 'input',
    Select: 'select',
    Checkbox: 'checkbox',
    Button: 'button',
    Submit: 'submit',
    Next: 'next',
    Previous: 'previous',
    AddArrayItem: 'addArrayItem',
    PrependArrayItem: 'prependArrayItem',
    InsertArrayItem: 'insertArrayItem',
    RemoveArrayItem: 'removeArrayItem',
    PopArrayItem: 'popArrayItem',
    ShiftArrayItem: 'shiftArrayItem',
    Textarea: 'textarea',
    Radio: 'radio',
    MultiCheckbox: 'multi-checkbox',
    Datepicker: 'datepicker',
    Slider: 'slider',
    Toggle: 'toggle',
};

/**
 * Generic button mapper for custom events or basic buttons.
 * For specific button types (submit, next, prev, add/remove array items),
 * use the dedicated field types and their specific mappers.
 *
 * Supports template property for array events (AppendArrayItemEvent, PrependArrayItemEvent, InsertArrayItemEvent)
 * which enables the $template token in eventArgs.
 *
 * @param fieldDef The button field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
function buttonFieldMapper(fieldDef) {
    const defaultProps = inject(DEFAULT_PROPS);
    const arrayContext = inject(ARRAY_CONTEXT, { optional: true });
    return computed(() => {
        const baseInputs = buildBaseInputs(fieldDef, defaultProps());
        const inputs = {
            ...baseInputs,
        };
        if (fieldDef.disabled !== undefined) {
            inputs['disabled'] = fieldDef.disabled;
        }
        if (fieldDef.hidden !== undefined) {
            inputs['hidden'] = fieldDef.hidden;
        }
        // Add event binding for button events
        if ('event' in fieldDef && fieldDef.event !== undefined) {
            inputs['event'] = fieldDef.event;
        }
        // Add eventArgs binding if provided
        if ('eventArgs' in fieldDef && fieldDef.eventArgs !== undefined) {
            inputs['eventArgs'] = fieldDef.eventArgs;
        }
        // Add eventContext for token resolution (supports $template, $arrayKey, $index, etc.)
        const template = 'template' in fieldDef ? fieldDef.template : undefined;
        if (template || arrayContext) {
            // Read signal value if index is a signal (supports differential updates)
            const getIndex = () => {
                if (!arrayContext)
                    return -1;
                return isSignal(arrayContext.index) ? arrayContext.index() : arrayContext.index;
            };
            inputs['eventContext'] = {
                key: fieldDef.key,
                index: getIndex(),
                arrayKey: arrayContext?.arrayKey ?? '',
                formValue: arrayContext?.formValue ?? {},
                template,
            };
        }
        return inputs;
    });
}

/**
 * Navigation button mappers for Material - re-exported from integration package.
 *
 * These mappers handle submit, next, and previous buttons with proper
 * disabled state resolution based on form validity and options.
 */

/**
 * Base definition for button field types that don't use the `field` input.
 * Button fields render immediately without waiting for form value integration.
 */
const BUTTON_FIELD_TYPES_BASE = {
    renderReadyWhen: [],
};
/**
 * Material Design field type definitions
 * Follows the FieldTypeDefinition interface for proper registry integration
 */
const MATERIAL_FIELD_TYPES = [
    {
        name: MatField.Input,
        loadComponent: () => Promise.resolve().then(function () { return matInput_component; }),
        mapper: valueFieldMapper,
        propsToMeta: ['type'],
        scope: ['text-input', 'numeric'],
    },
    {
        name: MatField.Select,
        loadComponent: () => Promise.resolve().then(function () { return matSelect_component; }),
        mapper: optionsFieldMapper,
        scope: 'single-select',
    },
    {
        name: MatField.Checkbox,
        loadComponent: () => Promise.resolve().then(function () { return matCheckbox_component; }),
        mapper: checkboxFieldMapper,
        scope: 'boolean',
    },
    {
        name: MatField.Button,
        loadComponent: () => Promise.resolve().then(function () { return matButton_component; }),
        mapper: buttonFieldMapper,
        valueHandling: 'exclude',
        ...BUTTON_FIELD_TYPES_BASE,
    },
    {
        name: MatField.Submit,
        loadComponent: () => Promise.resolve().then(function () { return matButton_component; }),
        mapper: submitButtonFieldMapper,
        valueHandling: 'exclude',
        ...BUTTON_FIELD_TYPES_BASE,
    },
    {
        name: MatField.Next,
        loadComponent: () => Promise.resolve().then(function () { return matButton_component; }),
        mapper: nextButtonFieldMapper,
        valueHandling: 'exclude',
        ...BUTTON_FIELD_TYPES_BASE,
    },
    {
        name: MatField.Previous,
        loadComponent: () => Promise.resolve().then(function () { return matButton_component; }),
        mapper: previousButtonFieldMapper,
        valueHandling: 'exclude',
        ...BUTTON_FIELD_TYPES_BASE,
    },
    {
        name: MatField.AddArrayItem,
        loadComponent: () => Promise.resolve().then(function () { return matButton_component; }),
        mapper: addArrayItemButtonMapper,
        valueHandling: 'exclude',
        ...BUTTON_FIELD_TYPES_BASE,
    },
    {
        name: MatField.PrependArrayItem,
        loadComponent: () => Promise.resolve().then(function () { return matButton_component; }),
        mapper: prependArrayItemButtonMapper,
        valueHandling: 'exclude',
        ...BUTTON_FIELD_TYPES_BASE,
    },
    {
        name: MatField.InsertArrayItem,
        loadComponent: () => Promise.resolve().then(function () { return matButton_component; }),
        mapper: insertArrayItemButtonMapper,
        valueHandling: 'exclude',
        ...BUTTON_FIELD_TYPES_BASE,
    },
    {
        name: MatField.RemoveArrayItem,
        loadComponent: () => Promise.resolve().then(function () { return matButton_component; }),
        mapper: removeArrayItemButtonMapper,
        valueHandling: 'exclude',
        ...BUTTON_FIELD_TYPES_BASE,
    },
    {
        name: MatField.PopArrayItem,
        loadComponent: () => Promise.resolve().then(function () { return matButton_component; }),
        mapper: popArrayItemButtonMapper,
        valueHandling: 'exclude',
        ...BUTTON_FIELD_TYPES_BASE,
    },
    {
        name: MatField.ShiftArrayItem,
        loadComponent: () => Promise.resolve().then(function () { return matButton_component; }),
        mapper: shiftArrayItemButtonMapper,
        valueHandling: 'exclude',
        ...BUTTON_FIELD_TYPES_BASE,
    },
    {
        name: MatField.Textarea,
        loadComponent: () => Promise.resolve().then(function () { return matTextarea_component; }),
        mapper: valueFieldMapper,
        propsToMeta: ['rows', 'cols'],
        scope: 'text-input',
    },
    {
        name: MatField.Radio,
        loadComponent: () => Promise.resolve().then(function () { return matRadio_component; }),
        mapper: optionsFieldMapper,
        scope: 'single-select',
    },
    {
        name: MatField.MultiCheckbox,
        loadComponent: () => Promise.resolve().then(function () { return matMultiCheckbox_component; }),
        mapper: optionsFieldMapper,
        scope: 'multi-select',
    },
    {
        name: MatField.Datepicker,
        loadComponent: () => Promise.resolve().then(function () { return matDatepicker_component; }),
        mapper: datepickerFieldMapper,
        scope: 'date',
    },
    {
        name: MatField.Slider,
        loadComponent: () => Promise.resolve().then(function () { return matSlider_component; }),
        mapper: valueFieldMapper,
        scope: 'numeric',
    },
    {
        name: MatField.Toggle,
        loadComponent: () => Promise.resolve().then(function () { return matToggle_component; }),
        mapper: checkboxFieldMapper,
        scope: 'boolean',
    },
];

/**
 * Module augmentation for @ng-forge/dynamic-form
 * This file augments the FieldRegistryLeaves interface to include
 * all Material Design field types provided by this library.
 */

/**
 * Configure dynamic forms with Material Design field types.
 * Provides all Material Design field types for use with provideDynamicForm.
 *
 * @param config - Optional global configuration for Material form fields
 *
 * @example
 * ```typescript
 * // Application-level setup
 * import { ApplicationConfig } from '@angular/core';
 * import { provideDynamicForm } from '@ng-forge/dynamic-form';
 * import { withMaterialFields } from '@ng-forge/dynamic-form-material';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideDynamicForm(...withMaterialFields())
 *   ]
 * };
 * ```
 *
 * @example
 * ```typescript
 * // With global configuration
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideDynamicForm(
 *       ...withMaterialFields({
 *         appearance: 'fill',
 *         subscriptSizing: 'fixed'
 *       })
 *     )
 *   ]
 * };
 * ```
 *
 * @returns Array of field type definitions for Material Design components
 */
function withMaterialFields(config) {
    const fields = MATERIAL_FIELD_TYPES;
    if (config) {
        fields.__configProviders = [
            {
                provide: MATERIAL_CONFIG,
                useValue: config,
            },
        ];
    }
    return fields;
}

// Field components

/**
 * Generated bundle index. Do not edit.
 */

export { MATERIAL_CONFIG, MATERIAL_FIELD_TYPES, MatButtonFieldComponent, MatCheckboxFieldComponent, MatDatepickerFieldComponent, MatField, MatInputFieldComponent, MatMultiCheckboxFieldComponent, MatRadioFieldComponent, MatSelectFieldComponent, MatSliderFieldComponent, MatTextareaFieldComponent, MatToggleFieldComponent, withMaterialFields };
//# sourceMappingURL=ng-forge-dynamic-forms-material.mjs.map
