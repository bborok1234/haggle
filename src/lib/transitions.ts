import type { Result } from './result.js';
import { ok, err } from './result.js';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  active: ['reserved', 'sold', 'deleted'],
  reserved: ['active', 'sold', 'deleted'],
};

export function validateTransition(
  currentStatus: string,
  targetStatus: string,
): Result<true, string> {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    return err('INVALID_TRANSITION');
  }
  return ok(true);
}
