import { EvaluationContext, FormConfig } from '@ng-forge/dynamic-forms';
import { TestScenario } from '../../shared/types';

/**
 * Variant of `array-container-field-self-derivation.scenario.ts` that nests
 * the leaf input under TWO containers, exercising the
 * array → container → container → leaf path.
 *
 * Reproduces the case where `dependsOn: ['$self']` derivations must still
 * fire for fields buried under more than one layout container in array items
 * when the form value is supplied programmatically AFTER initialization.
 */
export const arrayDoubleContainerFieldSelfDerivationConfig = {
  fields: [
    {
      key: 'array',
      type: 'array',
      template: [
        {
          key: 'outerBox',
          type: 'container',
          wrappers: [{ type: 'css', cssClasses: 'test-container' }],
          fields: [
            {
              key: 'innerBox',
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
                      trigger: 'onChange',
                      functionName: 'uppercase',
                      dependsOn: ['$self'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
} as const satisfies FormConfig;

export const arrayDoubleContainerFieldSelfDerivationCustomFns = {
  derivations: {
    uppercase: (ctx: EvaluationContext) => {
      const value = String(ctx.fieldValue ?? '');
      return value.toUpperCase();
    },
  },
};

export const arrayDoubleContainerFieldSelfDerivationScenario: TestScenario = {
  testId: 'array-double-container-field-self-derivation-test',
  title: 'Array → Container → Container → Field $self Derivation (Post-Init Value)',
  description:
    'Tests dependsOn:["$self"] derivation on a field wrapped in two nested containers inside an array. The form value is supplied programmatically AFTER initialization via a button — verifies the derivation fires even when the leaf is buried under multiple layout containers.',
  config: arrayDoubleContainerFieldSelfDerivationConfig,
  customFnConfig: arrayDoubleContainerFieldSelfDerivationCustomFns,
};
