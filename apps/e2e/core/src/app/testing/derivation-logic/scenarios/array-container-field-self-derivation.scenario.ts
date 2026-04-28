import { EvaluationContext, FormConfig } from '@ng-forge/dynamic-forms';
import { TestScenario } from '../../shared/types';

/**
 * Variant of `array-field-self-derivation.scenario.ts` that wraps the input
 * inside a `container` field, exercising the array → container → leaf path.
 *
 * Reproduces a regression where `dependsOn: ['$self']` derivations do not fire
 * for fields buried under a layout container in array items when the form
 * value (e.g. `{ array: [{ first: 'hi' }] }`) is supplied via the form value
 * binding rather than baked into the field config — including the case where
 * the value is set programmatically AFTER the form has been initialized.
 */
export const arrayContainerFieldSelfDerivationConfig = {
  fields: [
    {
      key: 'array',
      type: 'array',
      fields: [
        [
          {
            key: 'wrapBox',
            type: 'container',
            wrappers: [{ type: 'css', cssClasses: 'test-container' }],
            fields: [
              {
                key: 'first',
                type: 'input',
                label: 'First',
                logic: [
                  {
                    type: 'derivation',
                    functionName: 'uppercase',
                    dependsOn: ['$self'],
                  },
                ],
              },
            ],
          },
        ],
      ],
    },
    {
      key: 'addItem',
      type: 'addArrayItem',
      arrayKey: 'array',
      label: 'Add Item',
      props: { color: 'primary' },
      template: [
        {
          key: 'wrapBox',
          type: 'container',
          wrappers: [{ type: 'css', cssClasses: 'test-container' }],
          fields: [
            {
              key: 'first',
              type: 'input',
              label: 'First',
              logic: [
                {
                  type: 'derivation',
                  functionName: 'uppercase',
                  dependsOn: ['$self'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'removeItem',
      type: 'removeArrayItem',
      arrayKey: 'array',
      label: 'Remove Last Item',
      props: { color: 'warn' },
    },
    {
      key: 'submit',
      type: 'submit',
      label: 'Submit',
      props: { type: 'submit', color: 'primary' },
      col: 12,
    },
  ],
} as const satisfies FormConfig;

export const arrayContainerFieldSelfDerivationCustomFns = {
  derivations: {
    uppercase: (ctx: EvaluationContext) => {
      const value = String(ctx.fieldValue ?? '');
      return value.toUpperCase();
    },
  },
};

export const arrayContainerFieldSelfDerivationScenario: TestScenario = {
  testId: 'array-container-field-self-derivation-test',
  title: 'Array → Container → Field $self Derivation (Post-Init Value)',
  description:
    'Tests dependsOn:["$self"] derivation on a field wrapped in a container inside an array. The form value is supplied programmatically AFTER initialization via a button — verifies the derivation fires even when the leaf is buried under a layout container.',
  config: arrayContainerFieldSelfDerivationConfig,
  customFnConfig: arrayContainerFieldSelfDerivationCustomFns,
};
