/**
 * The app's single persistence layer. strata-storage is the only code that touches
 * web storage. `keyPrefix: false` keeps physical keys as `macleanup-app:<key>`,
 * because the pre-paint script in index.html reads the appearance keys directly.
 */
import { defineStorage } from 'strata-storage';
import { logger } from '@/lib/logger';

export const STORAGE_NAMESPACE = 'macleanup-app';

const storage = defineStorage({
  namespace: STORAGE_NAMESPACE,
  keyPrefix: false,
  adapters: { localStorage: {} },
  defaultStorages: ['localStorage'],
});

/** Read a stored value, or the fallback when absent or unreadable. */
export function load<T>(key: string, fallback: T): T {
  try {
    const value = storage.getSync<T>(key, { storage: 'localStorage' });
    return value === null || value === undefined ? fallback : value;
  } catch (error) {
    logger.warn(`storage read failed: ${key}`, error);
    return fallback;
  }
}

/** Persist a value; a storage failure leaves the in-memory state intact. */
export function save<T>(key: string, value: T): void {
  try {
    storage.setSync(key, value, { storage: 'localStorage' });
  } catch (error) {
    logger.warn(`storage write failed: ${key}`, error);
  }
}

/** Remove a stored value. */
export function remove(key: string): void {
  try {
    storage.removeSync(key, { storage: 'localStorage' });
  } catch (error) {
    logger.warn(`storage remove failed: ${key}`, error);
  }
}
