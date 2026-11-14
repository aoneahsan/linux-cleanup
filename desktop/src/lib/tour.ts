/**
 * Page tours behind one wrapper over driver.js. A screen marks its steps with
 * `data-tour="<catalogue text>"`; the tour is skippable, closable (Esc), and the
 * step dots jump to any step. driver.js is imported only when a tour starts.
 */
import { translate } from '@/i18n';

/** Collect the current screen's tour steps, in document order. */
export function tourTargets(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('main [data-tour]')].filter((el) => el.dataset.tour);
}

/** Start the tour for the visible screen. */
export async function startTour(at = 0): Promise<void> {
  const targets = tourTargets();
  if (!targets.length) return;
  const { driver } = await import('driver.js');
  await import('driver.js/dist/driver.css');
  const instant = getComputedStyle(document.documentElement).getPropertyValue('--dur').trim() === '0ms';
  const d = driver({
    animate: !instant,
    smoothScroll: !instant,
    allowClose: true,
    overlayOpacity: 0.35,
    stagePadding: 6,
    popoverClass: 'tour-card',
    showProgress: true,
    progressText: translate('tour.progress', { current: '{{current}}', total: '{{total}}' }),
    nextBtnText: translate('common.next'),
    prevBtnText: translate('common.back'),
    doneBtnText: translate('tour.finish'),
    steps: targets.map((el) => ({ element: el, popover: { description: el.dataset.tour ?? '' } })),
    onPopoverRender: (popover, { state }) => {
      const current = state.activeIndex ?? 0;
      const dots = document.createElement('div');
      dots.className = 'tour-dots';
      dots.setAttribute('role', 'group');
      dots.setAttribute('aria-label', translate('tour.jump'));
      targets.forEach((_, k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', translate('tour.step', { n: k + 1 }));
        b.setAttribute('aria-current', String(k === current));
        b.addEventListener('click', () => d.moveTo(k));
        dots.append(b);
      });
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'link-arrow';
      skip.textContent = translate('tour.skip');
      skip.addEventListener('click', () => d.destroy());
      popover.description.after(dots);
      popover.footerButtons.append(skip);
    },
  });
  d.drive(Math.min(Math.max(0, at), targets.length - 1));
}
