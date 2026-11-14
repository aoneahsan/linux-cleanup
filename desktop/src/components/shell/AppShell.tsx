import { lazy, Suspense, useEffect } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { IconSprite } from '@/components/ui/Icon';
import { Titlebar } from '@/components/shell/Titlebar';
import { Rail } from '@/components/shell/Rail';
import { StatusBar } from '@/components/shell/StatusBar';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { Toasts } from '@/components/shell/Toasts';
import { LegalBar } from '@/components/shell/LegalBar';
import { TourBinder } from '@/components/shell/TourBinder';
import { PreviewSheet } from '@/components/run/PreviewSheet';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { bindRunEvents } from '@/stores/run';
import { initAppearance } from '@/theme/apply';
import { bootAccount } from '@/services/account';
import { bindSettingsSync } from '@/services/settingsSync';
import { bindScheduleIngest } from '@/services/scheduleIngest';
import { startAnalytics } from '@/services/analytics';
import { commands } from '@/lib/tauri';
import { bindAutoUpdate } from '@/services/autoUpdate';
import { bindReleaseGate } from '@/services/releaseCheck';
import { bindLicenceCheck, licenceCheckEnabled } from '@/services/licensing/licenceCheck';
import { useReleaseGate } from '@/stores/releaseGate';
import { useSettings } from '@/stores/settings';

/** The block and notice load only when a release record asks for them. */
const ReleaseGate = lazy(() => import('@/components/shell/ReleaseGate').then((m) => ({ default: m.ReleaseGate })));
/** The licence view exists only in a white-label build (VITE_WHITE_LABEL_KEY set). */
const WhiteLabelGuard = lazy(() => import('@/components/shell/WhiteLabelGuard').then((m) => ({ default: m.WhiteLabelGuard })));

/** Routes drawn as a "lite" window: title bar and canvas, no source list. */
const LITE = new Set(['/onboarding']);
/** Task pages the legal bar never interrupts. */
const TASK = new Set(['/confirm', '/run', '/onboarding']);

/** The one window shell around every screen. */
export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useGlobalShortcuts();
  useEffect(() => initAppearance(), []);
  useEffect(() => bindRunEvents(), []);
  useEffect(() => bindSettingsSync(), []);
  useEffect(() => bindScheduleIngest(), []);
  useEffect(() => startAnalytics(), []);
  // Update flow: layer 1 (signed updater) and layer 2 (release record) check at start, on return
  // and the moment a release is published (services/releaseBroadcast).
  useEffect(() => bindAutoUpdate(), []);
  useEffect(() => bindReleaseGate(), []);
  useEffect(() => bindLicenceCheck(), []);
  useEffect(() => {
    void bootAccount();
    // The tray mode is persisted by the UI and re-sent at every launch.
    void commands.setTrayMode(useSettings.getState().settings.closeToMenuBar).catch(() => undefined);
  }, []);
  const gate = useReleaseGate((s) => s.decision !== null && s.decision.action !== 'none');
  const lite = LITE.has(pathname);
  return (
    <>
      <IconSprite />
      <div className={`window${lite ? ' lite' : ''}`}>
        <Titlebar />
        {lite ? null : <Rail />}
        <main className="canvas" id="main">
          <Outlet />
        </main>
        <StatusBar />
      </div>
      <CommandPalette />
      <PreviewSheet />
      
      <TourBinder pathname={pathname} />
      <LegalBar taskPage={TASK.has(pathname)} />
      {gate ? <Suspense fallback={null}><ReleaseGate /></Suspense> : null}
      {licenceCheckEnabled ? <Suspense fallback={null}><WhiteLabelGuard /></Suspense> : null}
      <Toasts />
    </>
  );
}
