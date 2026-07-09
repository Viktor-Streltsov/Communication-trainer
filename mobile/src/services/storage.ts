/**
 * Thin storage abstraction over Capacitor Preferences.
 *
 * When running in a real Capacitor container (iOS/Android) the native
 * Preferences plugin is used. In the browser dev server Capacitor falls
 * back to localStorage automatically — so this wrapper works in both
 * environments without any additional logic.
 */

import { Preferences } from '@capacitor/preferences';

export async function storageGet(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  return value;
}

export async function storageSet(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value });
}

export async function storageRemove(key: string): Promise<void> {
  await Preferences.remove({ key });
}
