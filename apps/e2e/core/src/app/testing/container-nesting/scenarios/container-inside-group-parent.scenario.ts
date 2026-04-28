import { EvaluationContext, FormConfig } from '@ng-forge/dynamic-forms';
import { TestScenario } from '../../shared/types';

/**
 * Variant of `container-inside-group` that exercises the `$group` dependency
 * token. `dependsOn: ['$group']` resolves at collection time to the field's
 * nearest parent container path (`address` here), so the derivation fires
 * whenever any sibling in the same group changes — without enumerating each
 * sibling explicitly.
 *
 * Shape: `group(address) > container > input(state) + input(country)` where
 * `state` has a derivation that picks a value from `country`.
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
              key: 'country',
              type: 'input',
              label: 'Country',
              value: '',
            },
            {
              key: 'state',
              type: 'input',
              label: 'State',
              value: '',
              logic: [
                {
                  type: 'derivation',
                  functionName: 'deriveStateFromCountry',
                  // $group resolves to 'address' — the derivation fires on
                  // any change inside the address group.
                  dependsOn: ['$group'],
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

export const containerInsideGroupParentScenario: TestScenario = {
  testId: 'container-inside-group-parent',
  title: 'Container Inside Group ($group)',
  description: 'Verify $group in dependsOn resolves to the nearest parent container path',
  config,
  customFnConfig: {
    derivations: {
      deriveStateFromCountry: (context: EvaluationContext) => {
        // `groupValue` is the address group's value — no need to know
        // the parent group's key. Mirrors the `'$group'` token's
        // path-resolution semantic in dependsOn.
        const group = (context.groupValue ?? {}) as Record<string, unknown>;
        const country = String(group['country'] ?? '').toLowerCase();
        if (country === 'usa') return 'NY';
        if (country === 'canada') return 'ON';
        return '';
      },
    },
  },
};
