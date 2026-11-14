/**
 * The one analytics service, fronting GA4, Amplitude and Clarity. Each tool loads
 * ONLY when its env id exists; with none set nothing loads and nothing is sent.
 * Feature code calls `track()` with a registry event and never imports a vendor SDK.
 */
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { load, save } from '@/lib/storage';
import { clean, makeGtag, type EventName, type EventProps } from '@/services/analytics/events';

type Gtag = (...args: unknown[]) => void;
type Clarity = (...args: unknown[]) => void;
interface AmplitudeLike { track: (name: string, props?: object) => void; setUserId: (id: string | undefined) => void; reset: () => void }

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: Gtag; clarity?: Clarity & { q?: unknown[] } }
}

let gtag: Gtag | null = null;
let clarityOn = false;
/** Always call through window: the real script replaces the queue shim when it loads. */
const clarity = (...args: unknown[]) => { if (clarityOn) window.clarity?.(...args); };
let amplitude: AmplitudeLike | null = null;
let ampQueue: [string, object][] = [];
let started = false;

/** True when at least one analytics id is configured (the legal bar then names it). */
export const analyticsOn = (): boolean => Boolean(env.ga4Id || env.amplitudeKey || env.clarityId);

function addScript(src: string): void {
  const el = document.createElement('script');
  el.async = true;
  el.src = src;
  document.head.append(el);
}

function startGa4(id: string): void {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = makeGtag(window.dataLayer);
  gtag = window.gtag;
  gtag('js', new Date());
  // The app's origin (tauri://localhost) keeps no reliable cookies, so GA4 gets a random client id kept
  // in the app's own storage instead: one per install, never a device or account identifier.
  let clientId = load<string | null>('ga4-client-id', null);
  if (!clientId) { clientId = crypto.randomUUID(); save('ga4-client-id', clientId); }
  gtag('config', id, { send_page_view: false, anonymize_ip: true, client_storage: 'none', client_id: clientId });
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
}

function startClarity(id: string): void {
  // The standard queue shim; every text node is masked (data-clarity-mask on <body>).
  document.body.setAttribute('data-clarity-mask', 'True');
  const shim = function clarityShim() {
    // eslint-disable-next-line prefer-rest-params -- gtag/Clarity read an `arguments` object
    (shim.q = shim.q ?? []).push(arguments);
  } as Clarity & { q?: unknown[] };
  window.clarity = window.clarity ?? shim;
  clarityOn = true;
  addScript(`https://www.clarity.ms/tag/${encodeURIComponent(id)}`);
}

async function startAmplitude(key: string): Promise<void> {
  const amp = await import('@amplitude/analytics-browser');
  // Ready only when the init PROMISE resolves; events before that wait in a queue.
  await amp.init(key, { autocapture: false, defaultTracking: false, trackingOptions: { ipAddress: false } }).promise;
  amplitude = amp;
  for (const [n, p] of ampQueue) amp.track(n, p);
  ampQueue = [];
}

/** Load whichever tools have an id. Safe to call more than once. */
export function startAnalytics(): void {
  if (started || !analyticsOn()) return;
  started = true;
  try {
    if (env.ga4Id) startGa4(env.ga4Id);
    if (env.clarityId) startClarity(env.clarityId);
    if (env.amplitudeKey) void startAmplitude(env.amplitudeKey).catch((e: unknown) => logger.warn('amplitude init failed', e instanceof Error ? e.message : 'unknown'));
  } catch (error) {
    logger.warn('analytics start failed', error instanceof Error ? error.message : 'unknown');
  }
}

/** Send one registry event to every loaded tool (properties cleaned against the registry). */
export function track<E extends EventName>(name: E, props: EventProps<E> | Record<string, never> = {}): void {
  if (!started) return;
  const p = clean(name, props as Record<string, unknown>);
  gtag?.('event', name, p);
  clarity('event', name);
  if (amplitude) amplitude.track(name, p);
  else if (env.amplitudeKey) ampQueue.push([name, p]);
}

/** Signed in: one opaque account id in all three. Signed out: cleared, so a shared Mac never merges two people. */
export function identify(userId: string | null): void {
  if (!started) return;
  if (userId) {
    gtag?.('set', { user_id: userId });
    clarity('identify', userId);
    amplitude?.setUserId(userId);
  } else {
    gtag?.('set', { user_id: null });
    amplitude?.reset();
  }
}
