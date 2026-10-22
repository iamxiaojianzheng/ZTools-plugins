import { services, hasServices } from '@/api/services';

export function loadState<T>(key: string, fallback: T): T {
  try {
    if (!hasServices()) return fallback;
    const v = services().storage.get(key);
    if (v == null) return fallback;
    return v as T;
  } catch (e) {
    return fallback;
  }
}

export function saveState(key: string, value: unknown): void {
  try {
    if (!hasServices()) return;
    services().storage.set(key, value);
  } catch (e) {
    /* ignore */
  }
}
