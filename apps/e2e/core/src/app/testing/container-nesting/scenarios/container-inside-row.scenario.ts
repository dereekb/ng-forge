import { FormConfig } from '@ng-forge/dynamic-forms';
import { TestScenario } from '../../shared/types';

/**
 * Verifies a `container` rendered inside a `row`. At runtime the row is
 * itself a container, so this exercises container-inside-container nesting.
 */
const config = {
  fields: [
    {
      key: 'profileRow',
      type: 'row',
      fields: [
        { key: 'firstName', type: 'input', label: 'First name', col: 6, value: '' },
        {
          key: 'metaContainer',
          type: 'container',
          wrappers: [{ type: 'css', cssClasses: 'test-container' }],
          fields: [
            { key: 'nickname', type: 'input', label: 'Nickname', value: '' },
            { key: 'pronouns', type: 'input', label: 'Pronouns', value: '' },
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

export const containerInsideRowScenario: TestScenario = {
  testId: 'container-inside-row',
  title: 'Container Inside Row',
  description: 'Verify that a container renders correctly when nested inside a row field (runtime container-in-container)',
  config,
};
