const RECOVERABLE_PROVIDER_CODES = new Set([
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_RATE_LIMIT',
  'PROVIDER_ERROR',
]);

/**
 * Only transient/configuration provider failures and the explicit budget-quality
 * rejection may use deterministic recovery. Auth, ownership, grounding, and all
 * other validation failures remain terminal.
 */
export function isDeterministicFallbackEligible(code: string): boolean {
  return RECOVERABLE_PROVIDER_CODES.has(code) || code === 'BUDGET_EXCEEDED';
}
