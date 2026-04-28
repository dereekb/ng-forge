import { DerivationLogicConfig } from '../../models/logic/logic-config';
import { extractExpressionDependencies, extractStringDependencies } from '../cross-field/cross-field-detector';

/**
 * Extracts the union of field dependencies declared by a derivation config.
 *
 * Combines:
 * - Explicit `dependsOn` (when provided, it takes precedence over auto-detection)
 * - Expression-detected dependencies (only used when `dependsOn` is empty)
 * - `'*'` wildcard for `functionName` (only when `dependsOn` is empty)
 * - Condition expression dependencies (always included)
 *
 * @internal
 */
export function extractDependenciesFromConfig(config: DerivationLogicConfig): string[] {
  const deps = new Set<string>();

  if (config.dependsOn && config.dependsOn.length > 0) {
    config.dependsOn.forEach((dep) => deps.add(dep));
  } else {
    if (config.expression) {
      extractStringDependencies(config.expression).forEach((dep) => deps.add(dep));
    }
    if (config.functionName) {
      deps.add('*');
    }
  }

  if (config.condition && config.condition !== true) {
    extractExpressionDependencies(config.condition).forEach((dep) => deps.add(dep));
  }

  return Array.from(deps);
}
