/**
 * Pure run-allowance arithmetic. No imports, no I/O: Deno functions and Vitest load it
 * as-is. public.claim_run() in SQL is the ENFORCING copy of the pool order; this module
 * formats the contract shape and cross-checks the database's decision.
 * Order: plan unlimited -> device pool -> account pool (signed-in only) -> limit reached.
 */

export type Pool = 'device' | 'account' | 'plan';

/** One pool's usage in the current month. */
export interface PoolCounter {
  used: number;
  limit: number;
}

/** What the database reports for one caller on one device (private.allowance_facts). */
export interface AllowanceFacts {
  month: string;
  is_anonymous: boolean;
  plan: { id: string; name: string; unlimited: boolean };
  device: PoolCounter;
  account: PoolCounter | null;
}

/** The `allowance` shape in docs/CONTRACTS.md section 3. */
export interface Allowance {
  month: string;
  resets_at: string;
  device: PoolCounter;
  account: PoolCounter | null;
  plan: { id: string; name: string; unlimited: boolean };
}

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** The UTC month key ('YYYY-MM') an instant falls in. */
export function monthKey(at: Date): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The first instant (UTC, ISO 8601) of the month after `month`: when every pool resets. */
export function resetsAt(month: string): string {
  const match = MONTH_KEY.exec(month);
  if (!match) throw new RangeError(`Not a month key: ${month}`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]); // 1-based now, so it is already "next month" 0-based.
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString();
}

/** Runs left in a pool, never negative (an admin may lower a limit below usage). */
export function remaining(counter: PoolCounter): number {
  return Math.max(0, counter.limit - counter.used);
}

/** The pool the next real run would use, or null when every pool is spent. */
export function choosePool(facts: AllowanceFacts): Pool | null {
  if (facts.plan.unlimited) return 'plan';
  if (remaining(facts.device) > 0) return 'device';
  if (!facts.is_anonymous && facts.account && remaining(facts.account) > 0) return 'account';
  return null;
}

/** Format the database facts as the contract's allowance object. */
export function toAllowance(facts: AllowanceFacts): Allowance {
  return {
    month: facts.month,
    resets_at: resetsAt(facts.month),
    device: { used: facts.device.used, limit: facts.device.limit },
    account: facts.is_anonymous || !facts.account
      ? null
      : { used: facts.account.used, limit: facts.account.limit },
    plan: { id: facts.plan.id, name: facts.plan.name, unlimited: facts.plan.unlimited },
  };
}
