import { EvaluationContext, FormConfig } from '@ng-forge/dynamic-forms';
import { TestScenario } from '../../shared/types';

/**
 * Mirrors the "should resolve $self to the array placeholder path inside arrays"
 * unit test from `derivation-collector.spec.ts`, but at runtime. The field is
 * placed directly inside the array (no row wrapper) so the derivation lives
 * exactly one container hop below the array boundary.
 *
 * Validates that a `dependsOn: ['$self']` derivation actually fires for fields
 * inside array items — the unit test confirms collection produces the correct
 * `items.$.name` path; this scenario confirms the orchestrator applies it.
 */
const config = {
  fields: [
    {
      key: 'items',
      type: 'array',
      fields: [
        [
          {
            key: 'name',
            type: 'input',
            label: 'Name',
            value: 'first',
            logic: [
              {
                type: 'derivation',
                functionName: 'uppercase',
                dependsOn: ['$self'],
              },
            ],
          },
        ],
        [
          {
            key: 'name',
            type: 'input',
            label: 'Name',
            value: 'second',
            logic: [
              {
                type: 'derivation',
                functionName: 'uppercase',
                dependsOn: ['$self'],
              },
            ],
          },
        ],
      ],
    },
    {
      key: 'addItem',
      type: 'addArrayItem',
      arrayKey: 'items',
      label: 'Add Item',
      props: { color: 'primary' },
      template: [
        {
          key: 'name',
          type: 'input',
          label: 'Name',
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
    {
      key: 'removeItem',
      type: 'removeArrayItem',
      arrayKey: 'items',
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

export const arrayFieldSelfDerivationScenario: TestScenario = {
  testId: 'array-field-self-derivation-test',
  title: 'Array Field $self Derivation (No Row Wrapper)',
  description:
    'Tests dependsOn:["$self"] derivation on a field placed directly inside an array — the derivation function should fire per array item and produce the uppercase value.',
  config,
  customFnConfig: {
    derivations: {
      uppercase: (ctx: EvaluationContext) => {
        const value = String(ctx.fieldValue ?? '');
        return value.toUpperCase();
      },
    },
  },
};
