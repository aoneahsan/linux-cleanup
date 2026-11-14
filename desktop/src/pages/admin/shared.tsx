import type { ReactNode } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { z } from 'zod';
import { FormTextField } from '@/components/form/FormTextField';
import { Btn, PageHead, StateCard } from '@/components/ui/primitives';
import { useT, translate, type TKey } from '@/i18n';
import { useSession } from '@/stores/session';
import { callFunction } from '@/services/account';
import { toast } from '@/lib/feedback';

export const PAGE = 20;

/** POST one admin action. The server checks the role and audits every write. */
export const admin = <T,>(action: string, params: object = {}) => callFunction<T>('admin', { body: { action, ...params } });

/** A cursor-paginated admin list (20 per page). */
export function useAdminList<T>(action: string, params: object, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['admin', action, params],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => admin<{ items: T[]; next_cursor: string | null }>(action, { ...params, limit: PAGE, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

/** An audited admin write: refreshes admin lists and acknowledges. */
export function useAdminWrite<V extends object>(action: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => admin(action, v),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin'] }); toast(translate('admin.saved')); },
    onError: (e) => toast(translate('admin.failed', { message: e instanceof Error ? e.message : String(e) })),
  });
}

/** The required reason on every admin write (it goes into the audit log). */
export const reasonSchema = z.string().trim().min(1, { error: () => translate('admin.reasonError') }).max(500);

/** The reason field, bound to a react-hook-form `reason` key. */
export function ReasonField<T extends FieldValues & { reason: string }>({ control }: { control: Control<T> }) {
  const t = useT();
  return <FormTextField control={control} name={'reason' as FieldPath<T>} label={t('admin.reason')} />;
}

/** Admin page frame: denies non-admins with a named state (the server enforces it too). */
export function AdminFrame({ id, screen, title, lede, actions, children }: { id: string; screen: TKey; title: string; lede: string; actions?: ReactNode; children: ReactNode }) {
  const t = useT();
  const role = useSession((s) => s.role);
  return (
    <div className="workbench">
      <PageHead id={id} dateline={t('admin.dateline', { screen: t(screen) })} title={title} lede={lede} actions={role === 'admin' ? actions : undefined} />
      {role === 'admin' ? children : (
        <div className="span-12"><StateCard tone="error" icon="shield" title={t('admin.denied')}>{t('admin.deniedBody')}</StateCard></div>
      )}
    </div>
  );
}

/** "Load more" for a cursor list. */
export function LoadMore({ q }: { q: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown } }) {
  const t = useT();
  if (!q.hasNextPage) return null;
  return <div className="row-actions mt-3"><Btn isDisabled={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()}>{t('admin.loadMore')}</Btn></div>;
}
