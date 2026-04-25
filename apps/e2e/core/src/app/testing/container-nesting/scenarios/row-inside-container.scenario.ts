import { FormConfig } from '@ng-forge/dynamic-forms';
import { TestScenario } from '../../shared/types';

/**
 * Verifies a `row` rendered inside a `container`. At runtime the row is
 * rewritten to a container with a synthesized `{ type: 'row' }` wrapper, so
 * this is effectively container-inside-container — confirms that nesting
 * works even though the static types in `ContainerAllowedChildren` allow
 * `RowField` but not `ContainerField`.
 */
const config = {
  fields: [
    {
      key: 'addressContainer',
      type: 'container',
      wrappers: [{ type: 'css', cssClasses: 'test-container' }],
      fields: [
        {
          key: 'addressRow',
          type: 'row',
          fields: [
            { key: 'street', type: 'input', label: 'Street', col: 8, value: '' },
            { key: 'unit', type: 'input', label: 'Unit', col: 4, value: '' },
          ],
        },
        { key: 'city', type: 'input', label: 'City', value: '' },
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

export const rowInsideContainerScenario: TestScenario = {
  testId: 'row-inside-container',
  title: 'Row Inside Container',
  description: 'Verify that a row renders correctly when nested inside a container field',
  config,
};
