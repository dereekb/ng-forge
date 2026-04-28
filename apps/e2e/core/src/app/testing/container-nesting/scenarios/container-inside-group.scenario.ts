import { EvaluationContext, FormConfig } from '@ng-forge/dynamic-forms';
import { TestScenario } from '../../shared/types';

/**
 * Reproduces a bug found via @dereekb/dbx-form: a derivation attached to a
 * value field does not fire when the field lives inside a `group` whose
 * children include a layout-only `container` (no key) that holds the value
 * field. The same derivation works when the value field is at the root.
 *
 * Shape under test: `group(address) > container > input(state)` with a
 * self-transforming derivation on `state` (uppercases its own value).
 *
 * `dependsOn` uses the convention-correct absolute path `'address.state'`
 * (rooted at the form). The bug is that the collector still computes the
 * derivation's writeback target as the bare `'state'` rather than
 * `'address.state'`, so writeback fails silently regardless of the
 * `dependsOn` form.
 *
 * Expected: typing `tx` into `address.state` results in `address.state === 'TX'`
 * after the derivation fires.
 */
const config = {
  fields: [
    {
      key: 'address',
      type: 'group',
      fields: [
        {
          type: 'container',
          key: 'container',
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
                  // Convention: dependsOn paths are absolute (rooted at form).
                  // The field's actual form path is `address.state`.
                  dependsOn: ['address.state'],
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

export const containerInsideGroupScenario: TestScenario = {
  testId: 'container-inside-group',
  title: 'Container Inside Group',
  description: 'Verify a derivation fires for a value field nested as group > container > input',
  config,
  customFnConfig: {
    derivations: {
      uppercaseState: (context: EvaluationContext) => String(context.fieldValue ?? '').toUpperCase(),
    },
  },
};
