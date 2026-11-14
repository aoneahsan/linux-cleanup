/** The one TanStack Query client. Local commands are cheap; account calls retry once. */
import { QueryClient } from '@tanstack/react-query';
import { isAppError } from '@/lib/tauri';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(isAppError(error) && error.kind === 'not_in_app') && count < 1,
    },
    mutations: { retry: 0 },
  },
});

/** Query keys, one place. */
export const qk = {
  cliInfo: ['cli-info'] as const,
  systemInfo: ['system-info'] as const,
  disk: ['disk'] as const,
  localHistory: (limit: number) => ['local-history', limit] as const,
  schedules: ['schedules'] as const,
};
