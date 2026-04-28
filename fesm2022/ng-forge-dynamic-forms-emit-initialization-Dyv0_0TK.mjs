import { afterNextRender } from '@angular/core';
import { D as DynamicFormLogger, t as ComponentInitializedEvent } from './ng-forge-dynamic-forms-ng-forge-dynamic-forms-BjZM7I4E.mjs';

/**
 * Emits a component initialization event after the next render cycle.
 *
 * This utility is used by container components (group, page, array, container) to signal
 * that their child fields have been resolved and rendered. The event is dispatched
 * through the EventBus and is used by the initialization tracking system.
 *
 * @param eventBus - The EventBus instance to dispatch the event on
 * @param componentType - The type of component being initialized
 * @param componentKey - The unique key/id of the component
 * @param injector - The injector to use for afterNextRender scheduling
 */
function emitComponentInitialized(eventBus, componentType, componentKey, injector) {
    const logger = injector.get(DynamicFormLogger);
    afterNextRender(() => {
        try {
            eventBus.dispatch(ComponentInitializedEvent, componentType, componentKey);
        }
        catch (error) {
            logger.error(`Failed to emit initialization event for ${componentType} '${componentKey}'`, error);
        }
    }, { injector });
}

export { emitComponentInitialized as e };
//# sourceMappingURL=ng-forge-dynamic-forms-emit-initialization-Dyv0_0TK.mjs.map
