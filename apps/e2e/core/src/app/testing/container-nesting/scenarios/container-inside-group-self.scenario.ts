import { EvaluationContext, FormConfig } from '@ng-forge/dynamic-forms';
import { TestScenario } from '../../shared/types';

/**
 * Variant of `container-inside-group` that exercises the `$self` dependency
 * token. `dependsOn: ['$self']` resolves at collection time to the field's
 * own absolute path (`address.state`), so factory authors don't need to know
 * the ancestor group keys when wiring self-derivations.
 *
 * Same shape: `group(address) > container > input(state)` with a
 * self-transforming derivation that uppercases the value.
 */
const config = {
  fields: [
    {
      key: 'address',
      type: 'group',
      fields: [
        {
          key: 'addressContainer',
          type: 'container',
          wrappers: [{ type: 'css', cssClasses: 'test-container' }],
          fields: [
            {
              key: 'state',
              type: 'input',
              label: 'State',
              value: '',
              logic: [
                {
                  type: 'derivation',
                  functionName: 'uppercaseState',
                  dependsOn: ['$self'],
                },
              ],
            },
          ],
        },
      ],
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

export const containerInsideGroupSelfScenario: TestScenario = {
  testId: 'container-inside-group-self',
  title: 'Container Inside Group ($self)',
  description: "Verify $self in dependsOn resolves to the field's absolute path under a group",
  config,
  customFnConfig: {
    derivations: {
      uppercaseState: (context: EvaluationContext) => String(context.fieldValue ?? '').toUpperCase(),
    },
  },
};
