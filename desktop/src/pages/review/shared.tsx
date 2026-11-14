import { PreviewBtn, StateCard } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { plate } from '@/i18n/format';
import { startPreview } from '@/services/previewLauncher';

/** The empty state for a review screen whose sections have not been previewed yet. */
export function NeedsPreview({ ids, name }: { ids: number[]; name: string }) {
  const t = useT();
  const list = ids.map(plate).join(', ');
  return (
    <StateCard
      icon="ledger"
      title={t('review.previewN', { ids: list })}
      actions={<PreviewBtn tag={t('common.dryRun')} onPress={() => void startPreview(ids, name)}>{t('review.previewN', { ids: list })}</PreviewBtn>}
    >
      {t('review.emptyBody', { ids: list })}
    </StateCard>
  );
}

/** True for launch items in the system domain. */
export const isSystemPath = (path: string): boolean => /^\/(Library|System)\//.test(path);
