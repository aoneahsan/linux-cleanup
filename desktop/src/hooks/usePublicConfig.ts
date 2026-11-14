/** Public admin fields from `app_config` (rows with is_public = true), readable signed out. */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface PublicConfig {
  deviceRuns: number | null;
  accountExtraRuns: number | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Allowance numbers for copy such as "+15 after sign-in"; null when unreachable. */
export function usePublicConfig() {
  return useQuery({
    queryKey: ['app-config', 'public'],
    enabled: supabase() !== null,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<PublicConfig> => {
      const sb = supabase();
      if (!sb) return { deviceRuns: null, accountExtraRuns: null };
      const { data, error } = await sb.from('app_config').select('key, value').eq('is_public', true).limit(50);
      if (error) throw error;
      const get = (k: string) => num(data?.find((r) => r.key === k)?.value);
      return { deviceRuns: get('device_real_runs_per_month'), accountExtraRuns: get('account_extra_real_runs_per_month') };
    },
  });
}
