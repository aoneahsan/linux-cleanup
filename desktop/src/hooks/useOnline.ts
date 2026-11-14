import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** True while the webview reports a network connection. */
export const useOnline = (): boolean => useSyncExternalStore(subscribe, () => navigator.onLine);
