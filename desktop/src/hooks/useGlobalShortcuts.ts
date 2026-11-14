import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { startSafePreview } from '@/services/previewLauncher';
import { subscribe } from '@/lib/tauri';
import { goTo } from '@/components/ui/primitives';
import { comboFrom, useSettings, type ShortcutId } from '@/stores/settings';
import { useOverlays } from '@/stores/overlays';
import { isActive, useRun } from '@/stores/run';

/** The rebindable shortcuts (Settings → Keyboard shortcuts) and the native menu items. */
export function useGlobalShortcuts(): void {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('[data-capturing]')) return;
      const combo = comboFrom(e);
      if (!combo) return;
      const b = useSettings.getState().bindings;
      const hit = (Object.keys(b) as ShortcutId[]).find((id) => b[id] === combo);
      if (!hit) return;
      e.preventDefault();
      if (hit === 'search') useOverlays.getState().setPaletteOpen(!useOverlays.getState().paletteOpen);
      else if (hit === 'preview') void startSafePreview();
      else if (hit === 'appearance') useOverlays.getState().setThemeOpen(true);
      else if (hit === 'sections') goTo(navigate, '/sections');
      else if (hit === 'history') goTo(navigate, '/history');
      else if (hit === 'cancel' && isActive(useRun.getState())) void useRun.getState().cancel();
    };
    document.addEventListener('keydown', onKey);
    const offMenu = subscribe('menu', ({ id }) => {
      if (id === 'preferences') goTo(navigate, '/settings');
      else if (id === 'check-updates') goTo(navigate, '/updates');
      else if (id === 'new-preview') void startSafePreview();
      else if (id === 'history') goTo(navigate, '/history');
      else if (id === 'help') goTo(navigate, '/walkthrough');
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      offMenu();
    };
  }, [navigate]);
}
