/** Active plans from the `plans` table (public under RLS), ordered by rank. Prices are admin fields. */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  rank: number;
  price_month_cents: number;
  price_year_cents: number;
  per_seat: boolean;
  min_seats: number;
  real_runs_unlimited: boolean;
  device_real_runs_per_month: number | null;
  account_extra_real_runs_per_month: number | null;
  max_synced_machines: number | null;
  history_sync: boolean;
  schedules: boolean;
  exports: boolean;
  fleet_reports: boolean;
  /** Assistant level the plan answers with (shown as Spark · Pulse · Surge, never a model). */
  ai_tier: AiTier;
  /** Unbroken paid months after which `standard` answers as Surge; null = never. */
  ai_surge_after_paid_months: number | null;
  ai_questions_per_month: number;
  receipt_backup: boolean;
  receipt_backup_max: number;
}

export type AiTier = 'economy' | 'standard' | 'enhanced';

/** The level a person sees for each plan tier. */
export const AI_LEVEL: Record<AiTier, 'spark' | 'pulse' | 'surge'> = { economy: 'spark', standard: 'pulse', enhanced: 'surge' };

/** A plan tier read defensively: anything unknown answers as Spark (economy). */
export const levelOfTier = (tier: unknown): 'spark' | 'pulse' | 'surge' => AI_LEVEL[tier as AiTier] ?? 'spark';

/** The plan set, at most 10 rows. */
export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    enabled: supabase() !== null,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<PlanRow[]> => {
      const sb = supabase();
      if (!sb) return [];
      const { data, error } = await sb
        .from('plans')
        .select('id, name, description, rank, price_month_cents, price_year_cents, per_seat, min_seats, real_runs_unlimited, device_real_runs_per_month, account_extra_real_runs_per_month, max_synced_machines, history_sync, schedules, exports, fleet_reports, ai_tier, ai_surge_after_paid_months, ai_questions_per_month, receipt_backup, receipt_backup_max')
        .eq('is_active', true)
        .order('rank')
        .limit(10);
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });
}
