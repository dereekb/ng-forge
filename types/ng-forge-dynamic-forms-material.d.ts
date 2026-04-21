import * as _ng_forge_dynamic_forms_integration from '@ng-forge/dynamic-forms/integration';
import { CheckboxField, DatepickerField, DatepickerProps, InputMeta, InputField, InputProps, MultiCheckboxField, RadioField, SelectField, SelectProps, SliderField, ButtonField, EventArgs, TextareaField, TextareaProps, TextareaMeta, ToggleField } from '@ng-forge/dynamic-forms/integration';
import * as _angular_core from '@angular/core';
import { InjectionToken, Provider } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';
import { DynamicText, CheckedFieldComponent, FieldMeta, ValidationMessages, ValueFieldComponent, ValueType, FieldOption, FormEvent, NextPageEvent, PreviousPageEvent, AppendArrayItemEvent, ArrayAllowedChildren, PrependArrayItemEvent, InsertArrayItemEvent, RemoveAtIndexEvent, PopArrayItemEvent, ShiftArrayItemEvent, FieldComponent, FormEventConstructor, ArrayItemContext, FieldTypeDefinition, NarrowFields, RegisteredFieldTypes, InferFormValue, FormConfig } from '@ng-forge/dynamic-forms';
import { ThemePalette } from '@angular/material/core';
import * as _angular_material_form_field from '@angular/material/form-field';
import { MatFormFieldAppearance, SubscriptSizing, FloatLabelType } from '@angular/material/form-field';

interface MatCheckboxProps {
    color?: ThemePalette;
    disableRipple?: boolean;
    labelPosition?: 'before' | 'after';
    hint?: DynamicText;
    indeterminate?: boolean;
}
type MatCheckboxField = CheckboxField<MatCheckboxProps>;
type MatCheckboxComponent = CheckedFieldComponent<MatCheckboxField>;

declare class MatCheckboxFieldComponent implements MatCheckboxComponent {
    private materialConfig;
    private readonly elementRef;
    readonly field: _angular_core.InputSignal<FieldTree<boolean>>;
    readonly key: _angular_core.InputSignal<string>;
    readonly label: _angular_core.InputSignal<DynamicText | undefined>;
    readonly placeholder: _angular_core.InputSignal<DynamicText | undefined>;
    readonly className: _angular_core.InputSignal<string>;
    readonly tabIndex: _angular_core.InputSignal<number | undefined>;
    readonly props: _angular_core.InputSignal<MatCheckboxProps | undefined>;
    readonly meta: _angular_core.InputSignal<FieldMeta | undefined>;
    readonly validationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly defaultValidationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly effectiveDisableRipple: _angular_core.Signal<boolean>;
    readonly resolvedErrors: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    readonly showErrors: _angular_core.Signal<boolean>;
    readonly errorsToDisplay: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    constructor();
    /** Unique ID for the hint element, used for aria-describedby */
    protected readonly hintId: _angular_core.Signal<string>;
    /** Base ID for error elements, used for aria-describedby */
    protected readonly errorId: _angular_core.Signal<string>;
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    protected readonly ariaInvalid: _angular_core.Signal<boolean>;
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    protected readonly ariaRequired: _angular_core.Signal<true | null>;
    /** aria-describedby: links to hint and error messages for screen readers */
    protected readonly ariaDescribedBy: _angular_core.Signal<string | null>;
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
    private readonly syncAriaRequiredToDom;
    /**
     * Workaround: Angular Material's MatCheckbox does NOT propagate aria-describedby to its internal
     * input element. This effect imperatively sets/removes aria-describedby on the internal input.
     *
     * Uses afterRenderEffect to ensure DOM is ready before querying internal elements.
     */
    private readonly syncAriaDescribedByToDom;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<MatCheckboxFieldComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<MatCheckboxFieldComponent, "df-mat-checkbox", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "label": { "alias": "label"; "required": false; "isSignal": true; }; "placeholder": { "alias": "placeholder"; "required": false; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "tabIndex": { "alias": "tabIndex"; "required": false; "isSignal": true; }; "props": { "alias": "props"; "required": false; "isSignal": true; }; "meta": { "alias": "meta"; "required": false; "isSignal": true; }; "validationMessages": { "alias": "validationMessages"; "required": false; "isSignal": true; }; "defaultValidationMessages": { "alias": "defaultValidationMessages"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

interface MatDatepickerProps extends DatepickerProps {
    appearance?: MatFormFieldAppearance;
    color?: 'primary' | 'accent' | 'warn';
    disableRipple?: boolean;
    subscriptSizing?: SubscriptSizing;
    floatLabel?: FloatLabelType;
    hideRequiredMarker?: boolean;
    startView?: 'month' | 'year' | 'multi-year';
    touchUi?: boolean;
    hint?: DynamicText;
}
type MatDatepickerField = DatepickerField<MatDatepickerProps>;
type MatDatepickerComponent = ValueFieldComponent<MatDatepickerField>;

declare class MatDatepickerFieldComponent implements MatDatepickerComponent {
    private materialConfig;
    private readonly elementRef;
    readonly field: _angular_core.InputSignal<FieldTree<string>>;
    readonly key: _angular_core.InputSignal<string>;
    constructor();
    readonly label: _angular_core.InputSignal<DynamicText | undefined>;
    readonly placeholder: _angular_core.InputSignal<DynamicText | undefined>;
    readonly className: _angular_core.InputSignal<string>;
    readonly tabIndex: _angular_core.InputSignal<number | undefined>;
    readonly minDate: _angular_core.InputSignal<Date | null>;
    readonly maxDate: _angular_core.InputSignal<Date | null>;
    readonly startAt: _angular_core.InputSignal<Date | null>;
    readonly props: _angular_core.InputSignal<MatDatepickerProps | undefined>;
    readonly meta: _angular_core.InputSignal<InputMeta | undefined>;
    readonly validationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly defaultValidationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly effectiveAppearance: _angular_core.Signal<_angular_material_form_field.MatFormFieldAppearance>;
    readonly effectiveSubscriptSizing: _angular_core.Signal<_angular_material_form_field.SubscriptSizing>;
    readonly effectiveFloatLabel: _angular_core.Signal<_angular_material_form_field.FloatLabelType>;
    readonly effectiveHideRequiredMarker: _angular_core.Signal<boolean>;
    readonly resolvedErrors: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    readonly showErrors: _angular_core.Signal<boolean>;
    readonly errorsToDisplay: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    /** Unique ID for the hint element, used for aria-describedby */
    protected readonly hintId: _angular_core.Signal<string>;
    /** Base ID for error elements, used for aria-describedby */
    protected readonly errorId: _angular_core.Signal<string>;
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    protected readonly ariaInvalid: _angular_core.Signal<boolean>;
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    protected readonly ariaRequired: _angular_core.Signal<true | null>;
    /** aria-describedby: links to hint and error messages for screen readers */
    protected readonly ariaDescribedBy: _angular_core.Signal<string | null>;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<MatDatepickerFieldComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<MatDatepickerFieldComponent, "df-mat-datepicker", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "label": { "alias": "label"; "required": false; "isSignal": true; }; "placeholder": { "alias": "placeholder"; "required": false; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "tabIndex": { "alias": "tabIndex"; "required": false; "isSignal": true; }; "minDate": { "alias": "minDate"; "required": false; "isSignal": true; }; "maxDate": { "alias": "maxDate"; "required": false; "isSignal": true; }; "startAt": { "alias": "startAt"; "required": false; "isSignal": true; }; "props": { "alias": "props"; "required": false; "isSignal": true; }; "meta": { "alias": "meta"; "required": false; "isSignal": true; }; "validationMessages": { "alias": "validationMessages"; "required": false; "isSignal": true; }; "defaultValidationMessages": { "alias": "defaultValidationMessages"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

interface MatInputProps extends InputProps {
    appearance?: MatFormFieldAppearance;
    disableRipple?: boolean;
    subscriptSizing?: SubscriptSizing;
    floatLabel?: FloatLabelType;
    hideRequiredMarker?: boolean;
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
    hint?: DynamicText;
}
type MatInputField = InputField<MatInputProps>;
type MatInputComponent = ValueFieldComponent<MatInputField>;

declare class MatInputFieldComponent implements MatInputComponent {
    private materialConfig;
    private readonly elementRef;
    readonly field: _angular_core.InputSignal<FieldTree<string>>;
    readonly key: _angular_core.InputSignal<string>;
    readonly label: _angular_core.InputSignal<DynamicText | undefined>;
    readonly placeholder: _angular_core.InputSignal<DynamicText | undefined>;
    readonly className: _angular_core.InputSignal<string>;
    readonly tabIndex: _angular_core.InputSignal<number | undefined>;
    readonly props: _angular_core.InputSignal<MatInputProps | undefined>;
    readonly meta: _angular_core.InputSignal<InputMeta | undefined>;
    readonly validationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly defaultValidationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    constructor();
    /**
     * Reference to the native input element.
     * Used to imperatively sync the readonly attribute since Angular Signal Forms'
     * [field] directive doesn't sync FieldState.readonly() to the DOM.
     */
    private readonly inputRef;
    /**
     * Computed signal that extracts the readonly state from the field.
     * Used by the effect to reactively sync the readonly attribute to the DOM.
     */
    private readonly isReadonly;
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
    private readonly syncReadonlyToDom;
    readonly effectiveAppearance: _angular_core.Signal<_angular_material_form_field.MatFormFieldAppearance>;
    readonly effectiveSubscriptSizing: _angular_core.Signal<_angular_material_form_field.SubscriptSizing>;
    readonly effectiveFloatLabel: _angular_core.Signal<_angular_material_form_field.FloatLabelType>;
    readonly effectiveHideRequiredMarker: _angular_core.Signal<boolean>;
    readonly resolvedErrors: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    readonly showErrors: _angular_core.Signal<boolean>;
    readonly errorsToDisplay: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    /** Unique ID for the hint element, used for aria-describedby */
    protected readonly hintId: _angular_core.Signal<string>;
    /** Base ID for error elements, used for aria-describedby */
    protected readonly errorId: _angular_core.Signal<string>;
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    protected readonly ariaInvalid: _angular_core.Signal<boolean>;
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    protected readonly ariaRequired: _angular_core.Signal<true | null>;
    /** aria-describedby: links to hint and error messages for screen readers */
    protected readonly ariaDescribedBy: _angular_core.Signal<string | null>;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<MatInputFieldComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<MatInputFieldComponent, "df-mat-input", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "label": { "alias": "label"; "required": false; "isSignal": true; }; "placeholder": { "alias": "placeholder"; "required": false; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "tabIndex": { "alias": "tabIndex"; "required": false; "isSignal": true; }; "props": { "alias": "props"; "required": false; "isSignal": true; }; "meta": { "alias": "meta"; "required": false; "isSignal": true; }; "validationMessages": { "alias": "validationMessages"; "required": false; "isSignal": true; }; "defaultValidationMessages": { "alias": "defaultValidationMessages"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

interface MatMultiCheckboxProps {
    disableRipple?: boolean;
    tabIndex?: number;
    hint?: DynamicText;
    labelPosition?: 'before' | 'after';
    color?: ThemePalette;
}
type MatMultiCheckboxField<T> = MultiCheckboxField<T, MatMultiCheckboxProps>;
type MatMultiCheckboxComponent = ValueFieldComponent<MatMultiCheckboxField<ValueType>>;

declare class MatMultiCheckboxFieldComponent implements MatMultiCheckboxComponent {
    private readonly elementRef;
    readonly field: _angular_core.InputSignal<FieldTree<ValueType[]>>;
    readonly key: _angular_core.InputSignal<string>;
    readonly label: _angular_core.InputSignal<DynamicText | undefined>;
    readonly placeholder: _angular_core.InputSignal<DynamicText | undefined>;
    readonly className: _angular_core.InputSignal<string>;
    readonly tabIndex: _angular_core.InputSignal<number | undefined>;
    readonly options: _angular_core.InputSignal<FieldOption<ValueType>[]>;
    readonly props: _angular_core.InputSignal<MatMultiCheckboxProps | undefined>;
    readonly meta: _angular_core.InputSignal<FieldMeta | undefined>;
    valueViewModel: _angular_core.WritableSignal<FieldOption<ValueType>[]>;
    /** Computed map of checked option values for O(1) lookup in template */
    readonly checkedValuesMap: _angular_core.Signal<Record<string, boolean>>;
    constructor();
    onCheckboxChange(option: FieldOption<ValueType>, checked: boolean): void;
    readonly validationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly defaultValidationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly resolvedErrors: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    readonly showErrors: _angular_core.Signal<boolean>;
    readonly errorsToDisplay: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    /** Unique ID for the hint element, used for aria-describedby */
    protected readonly hintId: _angular_core.Signal<string>;
    /** Base ID for error elements, used for aria-describedby */
    protected readonly errorId: _angular_core.Signal<string>;
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    protected readonly ariaInvalid: _angular_core.Signal<boolean>;
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    protected readonly ariaRequired: _angular_core.Signal<true | null>;
    /** aria-describedby: links to hint and error messages for screen readers */
    protected readonly ariaDescribedBy: _angular_core.Signal<string | null>;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<MatMultiCheckboxFieldComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<MatMultiCheckboxFieldComponent, "df-mat-multi-checkbox", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "label": { "alias": "label"; "required": false; "isSignal": true; }; "placeholder": { "alias": "placeholder"; "required": false; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "tabIndex": { "alias": "tabIndex"; "required": false; "isSignal": true; }; "options": { "alias": "options"; "required": false; "isSignal": true; }; "props": { "alias": "props"; "required": false; "isSignal": true; }; "meta": { "alias": "meta"; "required": false; "isSignal": true; }; "validationMessages": { "alias": "validationMessages"; "required": false; "isSignal": true; }; "defaultValidationMessages": { "alias": "defaultValidationMessages"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

interface MatRadioProps {
    disableRipple?: boolean;
    color?: ThemePalette;
    labelPosition?: 'before' | 'after';
    hint?: DynamicText;
}
type MatRadioField<T> = RadioField<T, MatRadioProps>;
type MatRadioComponent = ValueFieldComponent<MatRadioField<ValueType>>;

declare class MatRadioFieldComponent implements MatRadioComponent {
    private readonly elementRef;
    readonly field: _angular_core.InputSignal<FieldTree<ValueType>>;
    readonly key: _angular_core.InputSignal<string>;
    readonly label: _angular_core.InputSignal<DynamicText | undefined>;
    readonly placeholder: _angular_core.InputSignal<DynamicText | undefined>;
    readonly className: _angular_core.InputSignal<string>;
    readonly tabIndex: _angular_core.InputSignal<number | undefined>;
    readonly options: _angular_core.InputSignal<FieldOption<ValueType>[]>;
    readonly props: _angular_core.InputSignal<MatRadioProps | undefined>;
    readonly meta: _angular_core.InputSignal<FieldMeta | undefined>;
    readonly validationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly defaultValidationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly resolvedErrors: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    readonly showErrors: _angular_core.Signal<boolean>;
    readonly errorsToDisplay: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    constructor();
    /** Unique ID for the hint element, used for aria-describedby */
    protected readonly hintId: _angular_core.Signal<string>;
    /** Base ID for error elements, used for aria-describedby */
    protected readonly errorId: _angular_core.Signal<string>;
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    protected readonly ariaInvalid: _angular_core.Signal<boolean>;
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    protected readonly ariaRequired: _angular_core.Signal<true | null>;
    /** aria-describedby: links to hint and error messages for screen readers */
    protected readonly ariaDescribedBy: _angular_core.Signal<string | null>;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<MatRadioFieldComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<MatRadioFieldComponent, "df-mat-radio", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "label": { "alias": "label"; "required": false; "isSignal": true; }; "placeholder": { "alias": "placeholder"; "required": false; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "tabIndex": { "alias": "tabIndex"; "required": false; "isSignal": true; }; "options": { "alias": "options"; "required": false; "isSignal": true; }; "props": { "alias": "props"; "required": false; "isSignal": true; }; "meta": { "alias": "meta"; "required": false; "isSignal": true; }; "validationMessages": { "alias": "validationMessages"; "required": false; "isSignal": true; }; "defaultValidationMessages": { "alias": "defaultValidationMessages"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

interface MatSelectProps extends SelectProps {
    appearance?: MatFormFieldAppearance;
    multiple?: boolean;
    panelMaxHeight?: string;
    subscriptSizing?: SubscriptSizing;
    floatLabel?: FloatLabelType;
    hideRequiredMarker?: boolean;
    compareWith?: (o1: ValueType, o2: ValueType) => boolean;
    hint?: DynamicText;
}
type MatSelectField<T> = SelectField<T, MatSelectProps>;
type MatSelectComponent = ValueFieldComponent<MatSelectField<ValueType>>;

declare class MatSelectFieldComponent implements MatSelectComponent {
    private materialConfig;
    private readonly elementRef;
    readonly field: _angular_core.InputSignal<FieldTree<ValueType>>;
    readonly key: _angular_core.InputSignal<string>;
    readonly label: _angular_core.InputSignal<DynamicText | undefined>;
    readonly placeholder: _angular_core.InputSignal<DynamicText | undefined>;
    readonly className: _angular_core.InputSignal<string>;
    readonly tabIndex: _angular_core.InputSignal<number | undefined>;
    readonly options: _angular_core.InputSignal<FieldOption<ValueType>[]>;
    readonly props: _angular_core.InputSignal<MatSelectProps | undefined>;
    readonly meta: _angular_core.InputSignal<FieldMeta | undefined>;
    readonly validationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly defaultValidationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly effectiveAppearance: _angular_core.Signal<_angular_material_form_field.MatFormFieldAppearance>;
    readonly effectiveSubscriptSizing: _angular_core.Signal<_angular_material_form_field.SubscriptSizing>;
    readonly effectiveFloatLabel: _angular_core.Signal<_angular_material_form_field.FloatLabelType>;
    readonly effectiveHideRequiredMarker: _angular_core.Signal<boolean>;
    readonly resolvedErrors: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    readonly showErrors: _angular_core.Signal<boolean>;
    readonly errorsToDisplay: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    defaultCompare: (value1: any, value2: any) => boolean;
    constructor();
    /** Unique ID for the hint element, used for aria-describedby */
    protected readonly hintId: _angular_core.Signal<string>;
    /** Base ID for error elements, used for aria-describedby */
    protected readonly errorId: _angular_core.Signal<string>;
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    protected readonly ariaInvalid: _angular_core.Signal<boolean>;
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    protected readonly ariaRequired: _angular_core.Signal<true | null>;
    /** aria-describedby: links to hint and error messages for screen readers */
    protected readonly ariaDescribedBy: _angular_core.Signal<string | null>;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<MatSelectFieldComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<MatSelectFieldComponent, "df-mat-select", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "label": { "alias": "label"; "required": false; "isSignal": true; }; "placeholder": { "alias": "placeholder"; "required": false; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "tabIndex": { "alias": "tabIndex"; "required": false; "isSignal": true; }; "options": { "alias": "options"; "required": false; "isSignal": true; }; "props": { "alias": "props"; "required": false; "isSignal": true; }; "meta": { "alias": "meta"; "required": false; "isSignal": true; }; "validationMessages": { "alias": "validationMessages"; "required": false; "isSignal": true; }; "defaultValidationMessages": { "alias": "defaultValidationMessages"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

interface MatSliderProps {
    hint?: DynamicText;
    color?: 'primary' | 'accent' | 'warn';
    appearance?: MatFormFieldAppearance;
    thumbLabel?: boolean;
    showThumbLabel?: boolean;
    tickInterval?: number | 'auto';
    step?: number;
}
type MatSliderField = SliderField<MatSliderProps>;
type MatSliderComponent = ValueFieldComponent<MatSliderField>;

declare class MatSliderFieldComponent implements MatSliderComponent {
    private readonly elementRef;
    readonly field: _angular_core.InputSignal<FieldTree<number>>;
    readonly key: _angular_core.InputSignal<string>;
    constructor();
    readonly label: _angular_core.InputSignal<DynamicText | undefined>;
    readonly placeholder: _angular_core.InputSignal<DynamicText | undefined>;
    readonly className: _angular_core.InputSignal<string>;
    readonly tabIndex: _angular_core.InputSignal<number | undefined>;
    readonly props: _angular_core.InputSignal<MatSliderProps | undefined>;
    readonly meta: _angular_core.InputSignal<InputMeta | undefined>;
    readonly validationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly defaultValidationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly resolvedErrors: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    readonly showErrors: _angular_core.Signal<boolean>;
    readonly errorsToDisplay: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    /** Unique ID for the hint element, used for aria-describedby */
    protected readonly hintId: _angular_core.Signal<string>;
    /** Base ID for error elements, used for aria-describedby */
    protected readonly errorId: _angular_core.Signal<string>;
    /** aria-required: true when field has required validation, null otherwise */
    protected readonly ariaRequired: _angular_core.Signal<true | null>;
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    protected readonly ariaInvalid: _angular_core.Signal<boolean>;
    /** aria-describedby: links to hint and error messages for screen readers */
    protected readonly ariaDescribedBy: _angular_core.Signal<string | null>;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<MatSliderFieldComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<MatSliderFieldComponent, "df-mat-slider", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "label": { "alias": "label"; "required": false; "isSignal": true; }; "placeholder": { "alias": "placeholder"; "required": false; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "tabIndex": { "alias": "tabIndex"; "required": false; "isSignal": true; }; "props": { "alias": "props"; "required": false; "isSignal": true; }; "meta": { "alias": "meta"; "required": false; "isSignal": true; }; "validationMessages": { "alias": "validationMessages"; "required": false; "isSignal": true; }; "defaultValidationMessages": { "alias": "defaultValidationMessages"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

interface MatButtonProps {
    color?: 'primary' | 'accent' | 'warn';
    type?: 'button' | 'submit' | 'reset';
}
type MatButtonField<TEvent extends FormEvent> = ButtonField<MatButtonProps, TEvent>;
type MatButtonComponent<TEvent extends FormEvent> = FieldComponent<MatButtonField<TEvent>>;
/**
 * Specific button field types with preconfigured events
 */
/** Submit button field - automatically disabled when form is invalid */
type MatSubmitButtonField = Omit<MatButtonField<SubmitEvent>, 'event' | 'type' | 'eventArgs'> & {
    type: 'submit';
};
/** Next page button field - with preconfigured NextPageEvent */
type MatNextButtonField = Omit<MatButtonField<NextPageEvent>, 'event' | 'type' | 'eventArgs'> & {
    type: 'next';
};
/** Previous page button field - with preconfigured PreviousPageEvent */
type MatPreviousButtonField = Omit<MatButtonField<PreviousPageEvent>, 'event' | 'type' | 'eventArgs'> & {
    type: 'previous';
};
/** Add array item button field - dispatches AppendArrayItemEvent */
type AddArrayItemButtonField = Omit<MatButtonField<AppendArrayItemEvent>, 'event' | 'type' | 'eventArgs'> & {
    type: 'addArrayItem';
    /**
     * The key of the array field to add items to.
     * Required when the button is placed outside the array.
     * When inside an array, this is automatically determined from context.
     */
    arrayKey?: string;
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (ArrayAllowedChildren): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (ArrayAllowedChildren[]): Creates an object item (fields merged into object)
     */
    template: ArrayAllowedChildren | readonly ArrayAllowedChildren[];
};
/** Prepend array item button field - dispatches PrependArrayItemEvent (adds at beginning) */
type PrependArrayItemButtonField = Omit<MatButtonField<PrependArrayItemEvent>, 'event' | 'type' | 'eventArgs'> & {
    type: 'prependArrayItem';
    /**
     * The key of the array field to prepend items to.
     * Required when the button is placed outside the array.
     * When inside an array, this is automatically determined from context.
     */
    arrayKey?: string;
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (ArrayAllowedChildren): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (ArrayAllowedChildren[]): Creates an object item (fields merged into object)
     */
    template: ArrayAllowedChildren | readonly ArrayAllowedChildren[];
};
/** Insert array item button field - dispatches InsertArrayItemEvent (adds at specific index) */
type InsertArrayItemButtonField = Omit<MatButtonField<InsertArrayItemEvent>, 'event' | 'type' | 'eventArgs'> & {
    type: 'insertArrayItem';
    /**
     * The key of the array field to insert items into.
     * Required when the button is placed outside the array.
     * When inside an array, this is automatically determined from context.
     */
    arrayKey?: string;
    /**
     * The index at which to insert the new item.
     */
    index: number;
    /**
     * Template for the new array item. REQUIRED.
     * - Single field (ArrayAllowedChildren): Creates a primitive item (field's value is extracted directly)
     * - Array of fields (ArrayAllowedChildren[]): Creates an object item (fields merged into object)
     */
    template: ArrayAllowedChildren | readonly ArrayAllowedChildren[];
};
/** Remove array item button field - dispatches RemoveAtIndexEvent or PopArrayItemEvent */
type RemoveArrayItemButtonField = Omit<MatButtonField<RemoveAtIndexEvent>, 'event' | 'type' | 'eventArgs'> & {
    type: 'removeArrayItem';
    /**
     * The key of the array field to remove items from.
     * Required when the button is placed outside the array.
     * When inside an array, this is automatically determined from context.
     */
    arrayKey?: string;
};
/** Pop array item button field - dispatches PopArrayItemEvent (removes last item) */
type PopArrayItemButtonField = Omit<MatButtonField<PopArrayItemEvent>, 'event' | 'type' | 'eventArgs'> & {
    type: 'popArrayItem';
    /**
     * The key of the array field to remove the last item from.
     * REQUIRED - must specify which array to pop from.
     */
    arrayKey: string;
};
/** Shift array item button field - dispatches ShiftArrayItemEvent (removes first item) */
type ShiftArrayItemButtonField = Omit<MatButtonField<ShiftArrayItemEvent>, 'event' | 'type' | 'eventArgs'> & {
    type: 'shiftArrayItem';
    /**
     * The key of the array field to remove the first item from.
     * REQUIRED - must specify which array to shift from.
     */
    arrayKey: string;
};

declare class MatButtonFieldComponent<TEvent extends FormEvent> implements MatButtonComponent<TEvent> {
    private readonly eventBus;
    private readonly arrayContext;
    readonly key: _angular_core.InputSignal<string>;
    readonly label: _angular_core.InputSignal<DynamicText>;
    readonly disabled: _angular_core.InputSignal<boolean>;
    readonly hidden: _angular_core.InputSignal<boolean>;
    readonly tabIndex: _angular_core.InputSignal<number | undefined>;
    readonly className: _angular_core.InputSignal<string>;
    /** Event to dispatch on click. Optional for submit buttons (native form submit handles it). */
    readonly event: _angular_core.InputSignal<FormEventConstructor<TEvent> | undefined>;
    readonly eventArgs: _angular_core.InputSignal<EventArgs | undefined>;
    readonly props: _angular_core.InputSignal<MatButtonProps | undefined>;
    readonly eventContext: _angular_core.InputSignal<ArrayItemContext | undefined>;
    /** Resolved button type - defaults to 'button' if not specified in props */
    readonly buttonType: _angular_core.Signal<"submit" | "button" | "reset">;
    readonly buttonTestId: _angular_core.Signal<string>;
    /**
     * Handle button click.
     * - For submit buttons (type="submit"): do nothing, native form submit handles it
     * - For other buttons: dispatch the configured event via EventBus
     */
    onClick(): void;
    private dispatchEvent;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<MatButtonFieldComponent<any>, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<MatButtonFieldComponent<any>, "df-mat-button", never, { "key": { "alias": "key"; "required": true; "isSignal": true; }; "label": { "alias": "label"; "required": true; "isSignal": true; }; "disabled": { "alias": "disabled"; "required": false; "isSignal": true; }; "hidden": { "alias": "hidden"; "required": false; "isSignal": true; }; "tabIndex": { "alias": "tabIndex"; "required": false; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "event": { "alias": "event"; "required": false; "isSignal": true; }; "eventArgs": { "alias": "eventArgs"; "required": false; "isSignal": true; }; "props": { "alias": "props"; "required": false; "isSignal": true; }; "eventContext": { "alias": "eventContext"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

interface MatTextareaProps extends TextareaProps {
    hint?: DynamicText;
    appearance?: MatFormFieldAppearance;
    subscriptSizing?: SubscriptSizing;
    floatLabel?: FloatLabelType;
    hideRequiredMarker?: boolean;
    rows?: number;
    cols?: number;
    resize?: 'none' | 'both' | 'horizontal' | 'vertical';
    maxLength?: number;
}
type MatTextareaField = TextareaField<MatTextareaProps>;
type MatTextareaComponent = ValueFieldComponent<MatTextareaField>;

declare class MatTextareaFieldComponent implements MatTextareaComponent {
    private materialConfig;
    private readonly elementRef;
    readonly field: _angular_core.InputSignal<FieldTree<string>>;
    readonly key: _angular_core.InputSignal<string>;
    readonly label: _angular_core.InputSignal<DynamicText | undefined>;
    readonly placeholder: _angular_core.InputSignal<DynamicText | undefined>;
    readonly className: _angular_core.InputSignal<string>;
    readonly tabIndex: _angular_core.InputSignal<number | undefined>;
    readonly props: _angular_core.InputSignal<MatTextareaProps | undefined>;
    readonly meta: _angular_core.InputSignal<TextareaMeta | undefined>;
    readonly validationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly defaultValidationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    constructor();
    /**
     * Reference to the native textarea element.
     * Used to imperatively sync the readonly attribute since Angular Signal Forms'
     * [field] directive doesn't sync FieldState.readonly() to the DOM.
     */
    private readonly textareaRef;
    /**
     * Computed signal that extracts the readonly state from the field.
     * Used by the effect to reactively sync the readonly attribute to the DOM.
     */
    private readonly isReadonly;
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
    private readonly syncReadonlyToDom;
    readonly effectiveAppearance: _angular_core.Signal<_angular_material_form_field.MatFormFieldAppearance>;
    readonly effectiveSubscriptSizing: _angular_core.Signal<_angular_material_form_field.SubscriptSizing>;
    readonly effectiveFloatLabel: _angular_core.Signal<_angular_material_form_field.FloatLabelType>;
    readonly effectiveHideRequiredMarker: _angular_core.Signal<boolean>;
    readonly resolvedErrors: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    readonly showErrors: _angular_core.Signal<boolean>;
    readonly errorsToDisplay: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    /** Unique ID for the hint element, used for aria-describedby */
    protected readonly hintId: _angular_core.Signal<string>;
    /** Base ID for error elements, used for aria-describedby */
    protected readonly errorId: _angular_core.Signal<string>;
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    protected readonly ariaInvalid: _angular_core.Signal<boolean>;
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    protected readonly ariaRequired: _angular_core.Signal<true | null>;
    /** aria-describedby: links to hint and error messages for screen readers */
    protected readonly ariaDescribedBy: _angular_core.Signal<string | null>;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<MatTextareaFieldComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<MatTextareaFieldComponent, "df-mat-textarea", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "label": { "alias": "label"; "required": false; "isSignal": true; }; "placeholder": { "alias": "placeholder"; "required": false; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "tabIndex": { "alias": "tabIndex"; "required": false; "isSignal": true; }; "props": { "alias": "props"; "required": false; "isSignal": true; }; "meta": { "alias": "meta"; "required": false; "isSignal": true; }; "validationMessages": { "alias": "validationMessages"; "required": false; "isSignal": true; }; "defaultValidationMessages": { "alias": "defaultValidationMessages"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

interface MatToggleProps {
    hint?: DynamicText;
    appearance?: MatFormFieldAppearance;
    color?: ThemePalette;
    labelPosition?: 'before' | 'after';
    disableRipple?: boolean;
    hideIcon?: boolean;
}
type MatToggleField = ToggleField<MatToggleProps>;
type MatToggleComponent = CheckedFieldComponent<MatToggleField>;

declare class MatToggleFieldComponent implements MatToggleComponent {
    private materialConfig;
    private readonly elementRef;
    readonly field: _angular_core.InputSignal<FieldTree<boolean>>;
    readonly key: _angular_core.InputSignal<string>;
    readonly label: _angular_core.InputSignal<DynamicText | undefined>;
    readonly placeholder: _angular_core.InputSignal<DynamicText | undefined>;
    readonly className: _angular_core.InputSignal<string>;
    readonly tabIndex: _angular_core.InputSignal<number | undefined>;
    readonly props: _angular_core.InputSignal<MatToggleProps | undefined>;
    readonly meta: _angular_core.InputSignal<FieldMeta | undefined>;
    readonly validationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly defaultValidationMessages: _angular_core.InputSignal<ValidationMessages | undefined>;
    readonly effectiveDisableRipple: _angular_core.Signal<boolean>;
    readonly resolvedErrors: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    readonly showErrors: _angular_core.Signal<boolean>;
    readonly errorsToDisplay: _angular_core.Signal<_ng_forge_dynamic_forms_integration.ResolvedError[]>;
    constructor();
    /** Unique ID for the hint element, used for aria-describedby */
    protected readonly hintId: _angular_core.Signal<string>;
    /** Base ID for error elements, used for aria-describedby */
    protected readonly errorId: _angular_core.Signal<string>;
    /** aria-invalid: true when field is invalid AND touched, false otherwise */
    protected readonly ariaInvalid: _angular_core.Signal<boolean>;
    /** aria-required: true if field is required, null otherwise (to remove attribute) */
    protected readonly ariaRequired: _angular_core.Signal<true | null>;
    /** aria-describedby: links to hint and error messages for screen readers */
    protected readonly ariaDescribedBy: _angular_core.Signal<string | null>;
    /**
     * Workaround: Angular Material's MatSlideToggle does NOT propagate aria-required to its internal
     * button element. This effect imperatively sets/removes aria-required on the internal button.
     *
     * Uses afterRenderEffect to ensure DOM is ready before querying internal elements.
     */
    private readonly syncAriaRequiredToDom;
    /**
     * Workaround: Angular Material's MatSlideToggle does NOT propagate aria-describedby to its internal
     * button element. This effect imperatively sets/removes aria-describedby on the internal button.
     *
     * Uses afterRenderEffect to ensure DOM is ready before querying internal elements.
     */
    private readonly syncAriaDescribedByToDom;
    static ɵfac: _angular_core.ɵɵFactoryDeclaration<MatToggleFieldComponent, never>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<MatToggleFieldComponent, "df-mat-toggle", never, { "field": { "alias": "field"; "required": true; "isSignal": true; }; "key": { "alias": "key"; "required": true; "isSignal": true; }; "label": { "alias": "label"; "required": false; "isSignal": true; }; "placeholder": { "alias": "placeholder"; "required": false; "isSignal": true; }; "className": { "alias": "className"; "required": false; "isSignal": true; }; "tabIndex": { "alias": "tabIndex"; "required": false; "isSignal": true; }; "props": { "alias": "props"; "required": false; "isSignal": true; }; "meta": { "alias": "meta"; "required": false; "isSignal": true; }; "validationMessages": { "alias": "validationMessages"; "required": false; "isSignal": true; }; "defaultValidationMessages": { "alias": "defaultValidationMessages"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}

/**
 * Material Design field type definitions
 * Follows the FieldTypeDefinition interface for proper registry integration
 */
declare const MATERIAL_FIELD_TYPES: FieldTypeDefinition[];

/**
 * Configuration options for Material Design form fields.
 *
 * These settings can be applied at two levels:
 * - **Library-level**: Via `withMaterialFields({ ... })` - applies to all forms
 * - **Form-level**: Via `defaultProps` in form config - applies to a specific form
 *
 * The cascade hierarchy is: Library-level → Form-level → Field-level
 *
 * @example
 * ```typescript
 * // Library-level (in app config)
 * provideDynamicForms(withMaterialFields({ appearance: 'outline' }))
 *
 * // Form-level (in form config)
 * const config: MatFormConfig = {
 *   defaultProps: { appearance: 'fill' },
 *   fields: [...]
 * };
 * ```
 */
interface MaterialConfig {
    /**
     * Default appearance for Material form fields
     * @default 'outline'
     */
    appearance?: MatFormFieldAppearance;
    /**
     * Default subscript sizing for Material form fields
     * @default 'dynamic'
     */
    subscriptSizing?: SubscriptSizing;
    /**
     * Whether to disable ripple effects by default
     * @default false
     */
    disableRipple?: boolean;
    /**
     * Default color theme for form controls (checkboxes, radios, sliders, toggles)
     * @default 'primary'
     */
    color?: ThemePalette;
    /**
     * Default label position for checkboxes and radios
     * @default 'after'
     */
    labelPosition?: 'before' | 'after';
    /**
     * Default float label behavior for form fields
     * @default 'auto'
     */
    floatLabel?: FloatLabelType;
    /**
     * Whether to hide the required marker by default
     * @default false
     */
    hideRequiredMarker?: boolean;
}

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
declare const MATERIAL_CONFIG: InjectionToken<MaterialConfig>;

/**
 * Material Design field type constants
 * Based on available field components in the /fields folder
 */
declare const MatField: {
    readonly Input: "input";
    readonly Select: "select";
    readonly Checkbox: "checkbox";
    readonly Button: "button";
    readonly Submit: "submit";
    readonly Next: "next";
    readonly Previous: "previous";
    readonly AddArrayItem: "addArrayItem";
    readonly PrependArrayItem: "prependArrayItem";
    readonly InsertArrayItem: "insertArrayItem";
    readonly RemoveArrayItem: "removeArrayItem";
    readonly PopArrayItem: "popArrayItem";
    readonly ShiftArrayItem: "shiftArrayItem";
    readonly Textarea: "textarea";
    readonly Radio: "radio";
    readonly MultiCheckbox: "multi-checkbox";
    readonly Datepicker: "datepicker";
    readonly Slider: "slider";
    readonly Toggle: "toggle";
};
type MatFieldType = (typeof MatField)[keyof typeof MatField];

/**
 * Material-specific props that can be set at form level and cascade to all fields.
 *
 * This is the same type as `MaterialConfig` used in `withMaterialFields()`.
 * Using a single type ensures consistency between library-level and form-level configuration.
 *
 * The cascade hierarchy is: Library-level → Form-level → Field-level
 *
 * @example
 * ```typescript
 * const config: MatFormConfig = {
 *   defaultProps: {
 *     appearance: 'outline',
 *     subscriptSizing: 'dynamic',
 *     color: 'accent',
 *   },
 *   fields: [
 *     { type: 'mat-input', key: 'name', label: 'Name' },
 *   ],
 * };
 * ```
 */
type MatFormProps = MaterialConfig;
/**
 * Material-specific FormConfig with type-safe defaultProps.
 *
 * Use this type alias when defining form configurations with Material Design components
 * to get IDE autocomplete and type checking for `defaultProps`.
 *
 * @example
 * ```typescript
 * const formConfig: MatFormConfig = {
 *   defaultProps: {
 *     appearance: 'outline',
 *     subscriptSizing: 'dynamic',
 *   },
 *   fields: [
 *     { type: 'mat-input', key: 'name', label: 'Name' },  // Uses form defaultProps
 *     { type: 'mat-input', key: 'email', props: { appearance: 'fill' } },  // Override
 *   ],
 * };
 * ```
 */
type MatFormConfig<TFields extends NarrowFields | RegisteredFieldTypes[] = RegisteredFieldTypes[], TValue = InferFormValue<TFields extends readonly RegisteredFieldTypes[] ? TFields : RegisteredFieldTypes[]>> = FormConfig<TFields, TValue, MatFormProps>;

/**
 * Module augmentation for @ng-forge/dynamic-form
 * This file augments the FieldRegistryLeaves interface to include
 * all Material Design field types provided by this library.
 */

declare module '@ng-forge/dynamic-forms' {
    interface FieldRegistryLeaves {
        input: MatInputField;
        select: MatSelectField<unknown>;
        checkbox: MatCheckboxField;
        button: MatButtonField<FormEvent>;
        submit: MatSubmitButtonField;
        next: MatNextButtonField;
        previous: MatPreviousButtonField;
        addArrayItem: AddArrayItemButtonField;
        prependArrayItem: PrependArrayItemButtonField;
        insertArrayItem: InsertArrayItemButtonField;
        removeArrayItem: RemoveArrayItemButtonField;
        popArrayItem: PopArrayItemButtonField;
        shiftArrayItem: ShiftArrayItemButtonField;
        textarea: MatTextareaField;
        radio: MatRadioField<unknown>;
        'multi-checkbox': MatMultiCheckboxField<unknown>;
        datepicker: MatDatepickerField;
        slider: MatSliderField;
        toggle: MatToggleField;
    }
}

/**
 * Field type definitions with optional config providers
 */
type FieldTypeDefinitionsWithConfig = FieldTypeDefinition[] & {
    __configProviders?: Provider[];
};
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
declare function withMaterialFields(config?: MaterialConfig): FieldTypeDefinitionsWithConfig;
/**
 * Module augmentation to extend the global DynamicFormFieldRegistry
 * with Material Design field types
 */
declare module '@ng-forge/dynamic-forms' {
    interface DynamicFormFieldRegistry {
        input: MatInputField;
        select: MatSelectField<any>;
        checkbox: MatCheckboxField;
        button: MatButtonField<any>;
        submit: MatSubmitButtonField;
        next: MatNextButtonField;
        previous: MatPreviousButtonField;
        textarea: MatTextareaField;
        radio: MatRadioField<any>;
        'multi-checkbox': MatMultiCheckboxField<any>;
        datepicker: MatDatepickerField;
        slider: MatSliderField;
        toggle: MatToggleField;
    }
}

export { MATERIAL_CONFIG, MATERIAL_FIELD_TYPES, MatButtonFieldComponent, MatCheckboxFieldComponent, MatDatepickerFieldComponent, MatField, MatInputFieldComponent, MatMultiCheckboxFieldComponent, MatRadioFieldComponent, MatSelectFieldComponent, MatSliderFieldComponent, MatTextareaFieldComponent, MatToggleFieldComponent, withMaterialFields };
export type { AddArrayItemButtonField, InsertArrayItemButtonField, MatButtonField, MatButtonProps, MatCheckboxComponent, MatCheckboxField, MatCheckboxProps, MatDatepickerComponent, MatDatepickerField, MatDatepickerProps, MatFieldType, MatFormConfig, MatFormProps, MatInputComponent, MatInputField, MatInputProps, MatMultiCheckboxComponent, MatMultiCheckboxField, MatMultiCheckboxProps, MatNextButtonField, MatPreviousButtonField, MatRadioComponent, MatRadioField, MatRadioProps, MatSelectComponent, MatSelectField, MatSelectProps, MatSliderComponent, MatSliderField, MatSliderProps, MatSubmitButtonField, MatTextareaComponent, MatTextareaField, MatTextareaProps, MatToggleComponent, MatToggleField, MatToggleProps, MaterialConfig, PopArrayItemButtonField, PrependArrayItemButtonField, RemoveArrayItemButtonField, ShiftArrayItemButtonField };
