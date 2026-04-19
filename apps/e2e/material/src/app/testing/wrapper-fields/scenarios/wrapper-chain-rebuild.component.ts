import { ChangeDetectionStrategy, Component, computed, linkedSignal, signal } from '@angular/core';
import { DynamicForm, FormConfig } from '@ng-forge/dynamic-forms';

/**
 * Exercises view preservation across a wrapper chain rebuild. The input's
 * component class is stable (`type: 'input'`); only its wrapper chain changes
 * on button click. The E2E asserts focus + caret + value survive the rebuild.
 */
@Component({
  selector: 'example-wrapper-chain-rebuild',
  imports: [DynamicForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="test-page">
      <h1>Wrapper Chain Rebuild — View Preservation</h1>

      <section class="test-scenario" data-testid="wrapper-chain-rebuild">
        <h2>Wrapper Chain Rebuild</h2>
        <p class="scenario-description">Toggling the wrapper chain should not tear down the input — focus, caret, and value persist.</p>

        <button type="button" data-testid="toggle-wrappers" (click)="toggleWrappers()">Toggle wrappers</button>

        <form [dynamic-form]="config()" [(value)]="formValue"></form>
      </section>
    </div>
  `,
})
export class WrapperChainRebuildComponent {
  private readonly wrapped = signal(false);

  protected readonly config = computed<FormConfig>(() => ({
    fields: [
      {
        key: 'focused',
        type: 'input',
        label: 'Focused input',
        wrappers: this.wrapped() ? [{ type: 'css', cssClasses: 'chain-rebuild-wrap' }] : [],
      },
    ],
  }));

  protected readonly formValue = linkedSignal<Record<string, unknown>>(() => ({}));

  protected toggleWrappers(): void {
    this.wrapped.update((v) => !v);
  }
}
