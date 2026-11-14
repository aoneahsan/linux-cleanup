import { useEffect } from 'react';
import { startTour, tourTargets } from '@/lib/tour';
import { useOverlays } from '@/stores/overlays';
import { usePrefs } from '@/stores/prefs';
import { schedulePush } from '@/services/settingsSync';

const HINT_MS = 8000;

/**
 * Registers the visible screen's tour with the title bar and shows its one-time hint.
 * Steps mount with the lazy screen and can appear after its data loads, so the
 * count is re-read whenever the canvas changes, not only on the first frame.
 */
export function TourBinder({ pathname }: { pathname: string }) {
  useEffect(() => {
    let hintTimer = 0;
    let frame = 0;
    let count = -1;
    let deepDone = false;
    let hinting = false;
    const sync = () => {
      frame = 0;
      const steps = tourTargets().length;
      if (steps === count) return;
      count = steps;
      const seen = usePrefs.getState().toursSeen[pathname] === true;
      const hint = steps > 0 && !seen;
      // A hint already showing keeps showing when the step count changes under it.
      useOverlays.getState().registerTour(steps, steps ? () => void startTour() : null, hint || (hinting && steps > 0));
      const deep = Number(new URLSearchParams(window.location.search).get('tour'));
      if (steps && !deepDone && Number.isInteger(deep) && deep >= 1) { deepDone = true; void startTour(deep - 1); }
      if (hint) {
        usePrefs.getState().markTourSeen(pathname);
        schedulePush();
        hinting = true;
        hintTimer = window.setTimeout(() => { hinting = false; useOverlays.getState().clearHint(); }, HINT_MS);
      }
    };
    const queue = () => { if (!frame) frame = window.requestAnimationFrame(sync); };
    queue();
    const main = document.getElementById('main');
    const observer = main ? new MutationObserver(queue) : null;
    observer?.observe(main as HTMLElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tour'] });
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(hintTimer);
    };
  }, [pathname]);
  return null;
}
