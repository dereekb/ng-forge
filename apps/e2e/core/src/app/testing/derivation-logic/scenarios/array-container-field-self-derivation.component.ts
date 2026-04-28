import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { DynamicForm, FormConfig } from '@ng-forge/dynamic-forms';
import {
  arrayContainerFieldSelfDerivationConfig,
  arrayContainerFieldSelfDerivationCustomFns,
  arrayContainerFieldSelfDerivationScenario,
} from './array-container-field-self-derivation.scenario';

/**
 * Route component for `array-container-field-self-derivation`.
 *
 * Crucially, the form value is NOT supplied via initialValue. Instead, buttons
 * programmatically set the [(value)] signal AFTER form initialization to verify
 * that `dependsOn: ['$self']` derivations fire for leaves buried under a
 * container inside an array when the value arrives post-init.
 */
@Component({
  selector: 'example-array-container-field-self-derivation',
  imports: [DynamicForm, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="test-page">
      <h1>{{ scenario.title }}</h1>

      <section class="test-scenario" [attr.data-testid]="scenario.testId">
        <h2>{{ scenario.title }}</h2>
        <p class="scenario-description">{{ scenario.description }}</p>

        <div class="value-controls">
          <button type="button" data-testid="load-value" (click)="loadValue()">Load array with first='hi'</button>
          <button type="button" data-testid="update-value" (click)="updateValue()">Update first to 'world'</button>
          <button type="button" data-testid="clear-value" (click)="clearValue()">Clear Value</button>
        </div>

        <form [dynamic-form]="config" [(value)]="formValue"></form>

        <details class="debug-output" open>
          <summary>Debug Output</summary>
          <pre [attr.data-testid]="'form-value-' + scenario.testId">{{ formValue() | json }}</pre>
        </details>
      </section>
    </div>
  `,
  styleUrl: '../../test-styles.scss',
  styles: [
    `
      .value-controls {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      .value-controls button {
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        background: #f5f5f5;
        cursor: pointer;
        border-radius: 4px;
      }
      .value-controls button:hover {
        background: #e0e0e0;
      }
    `,
  ],
})
export class ArrayContainerFieldSelfDerivationComponent {
  readonly scenario = arrayContainerFieldSelfDerivationScenario;

  readonly config: FormConfig = {
    ...arrayContainerFieldSelfDerivationConfig,
    customFnConfig: arrayContainerFieldSelfDerivationCustomFns,
  };

  readonly formValue = signal<Record<string, unknown>>({});

  loadValue(): void {
    this.formValue.set({ array: [{ first: 'hi' }] });
  }

  updateValue(): void {
    this.formValue.set({ array: [{ first: 'world' }] });
  }

  clearValue(): void {
    this.formValue.set({});
  }
}
