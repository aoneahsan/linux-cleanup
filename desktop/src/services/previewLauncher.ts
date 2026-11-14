/** Start a dry run from anywhere (Ctrl+P, the palette, the Overview, the tray) and open the preview sheet. */
import { translate } from '@/i18n';
import { SAFE_BATCH } from '@/data/sections';
import { useRun, isActive } from '@/stores/run';
import { toast } from '@/lib/feedback';

/** Dry-run the given sections. Dry runs never claim an allowance run. */
export async function startPreview(sections: readonly number[], name: string, profile: string | null = null): Promise<void> {
  if (isActive(useRun.getState())) {
    useRun.getState().setSheetOpen(true);
    toast(translate('run.busy'));
    return;
  }
  await useRun.getState().start(
    { sections: [...sections], dryRun: true, profile, name, claimId: null },
    { sheet: true },
  );
}

/** Dry-run the all-safe cleanup. */
export async function startSafePreview(): Promise<void> {
  await startPreview(SAFE_BATCH, translate('sections.allSafe'));
}
