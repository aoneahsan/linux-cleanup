/** Start a dry run from anywhere (⌘P, the palette, the Overview) and open the preview sheet. */
import { translate } from '@/i18n';
import { SAFE_BATCH } from '@/data/sections';
import { useRun, isActive } from '@/stores/run';
import { toast } from '@/lib/feedback';

/** Preview the given sections. Previews never claim an allowance run. */
export async function startPreview(sections: readonly number[], name: string, profile: string | null = null): Promise<void> {
  if (isActive(useRun.getState())) {
    useRun.getState().setSheetOpen(true);
    toast(translate('run.busy'));
    return;
  }
  await useRun.getState().start(
    { sections: [...sections], dryRun: true, deepOk: false, profile, name, claimId: null },
    { sheet: true },
  );
}

/** Preview the safe batch. */
export async function startSafePreview(): Promise<void> {
  await startPreview(SAFE_BATCH, translate('sections.safeBatch'));
}
