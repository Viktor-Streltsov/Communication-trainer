/**
 * Local notification reminders — "haven't seen you in a while" nudges.
 *
 * Strategy
 * ────────
 * A single notification (fixed ID) is scheduled 3 days into the future each
 * time the user opens the app or visits Home. The previous notification is
 * always cancelled first so duplicates never accumulate.
 *
 * Quiet hours: 23:00–08:00. If the computed fire time falls in that window it
 * is nudged forward to 09:00 on the appropriate day.
 *
 * Tone: warm and optional. None of the message copy mentions streaks, counts
 * of missed days, or any form of guilt.
 *
 * Capacitor guard: all calls are wrapped so the module is safe to import in
 * the browser dev server where the native plugin is unavailable.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import { storageGet, storageSet } from './storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LAST_ACTIVE_KEY      = 'last_active_at';
export const NOTIF_ASKED_KEY      = 'notif_permission_asked';
export const SESSIONS_DONE_KEY    = 'notif_sessions_done';

const REMINDER_ID    = 1001;
const DAYS_AHEAD     = 3;
const QUIET_FROM     = 23;   // 23:00 start of quiet window
const QUIET_UNTIL    = 8;    //  8:00 end of quiet window
const MORNING_HOUR   = 9;    // target hour when shifting out of quiet window

// ---------------------------------------------------------------------------
// Notification copy — warm, never guilt-inducing
// ---------------------------------------------------------------------------

const MESSAGES = [
  'Есть немного времени на разговор?',
  'Заглянешь на тренировку, если будет настроение?',
  'Как ты? Можем порепетировать разговор, который давно откладывал.',
  'Иногда пара минут практики меняет то, как проходит следующий разговор.',
];

function pickMessage(): string {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

// ---------------------------------------------------------------------------
// Fire-time calculation
// ---------------------------------------------------------------------------

function computeFireDate(): Date {
  const target = new Date(Date.now() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
  const h = target.getHours();

  const inQuietWindow = h >= QUIET_FROM || h < QUIET_UNTIL;
  if (inQuietWindow) {
    // If we're already past midnight (h < QUIET_UNTIL), 09:00 is later today.
    // If we're past 23:00, 09:00 belongs to the next day.
    if (h >= QUIET_FROM) {
      target.setDate(target.getDate() + 1);
    }
    target.setHours(MORNING_HOUR, 0, 0, 0);
  }

  return target;
}

// ---------------------------------------------------------------------------
// Platform guard
// ---------------------------------------------------------------------------

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Record that the app is open right now. */
export async function recordActivity(): Promise<void> {
  await storageSet(LAST_ACTIVE_KEY, new Date().toISOString());
}

/** Cancel the currently scheduled reminder (if any). Safe to call repeatedly. */
export async function cancelReminder(): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  } catch {
    // Plugin may throw if there is nothing to cancel — ignore.
  }
}

/**
 * Cancel any existing reminder then schedule a fresh one 3 days from now,
 * respecting quiet hours.
 *
 * Silently no-ops in the browser dev environment.
 * Silently no-ops if the user has not granted notification permission.
 */
export async function scheduleReminder(): Promise<void> {
  if (!isNative()) return;

  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') return;

    await cancelReminder();

    const at = computeFireDate();
    await LocalNotifications.schedule({
      notifications: [
        {
          id:    REMINDER_ID,
          title: 'Тренажёр общения',
          body:  pickMessage(),
          schedule: { at },
          // Keep the notification silent / default sound to avoid being annoying
          sound: undefined,
          attachments: undefined,
          actionTypeId: '',
          extra: null,
        },
      ],
    });
  } catch {
    // Non-critical — never crash the app over a notification failure.
  }
}

/**
 * Check the current OS permission status.
 * Returns 'granted' | 'denied' | 'prompt' (prompt = not asked yet).
 */
export async function checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNative()) return 'denied'; // meaningless on web
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'denied';
  }
}

/**
 * Trigger the OS permission dialog.
 * Returns true if the user granted permission.
 */
export async function requestPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

/**
 * Mark that we have asked (or decided not to ask) for permission.
 * Prevents the prompt from appearing more than once.
 */
export async function markPermissionAsked(): Promise<void> {
  await storageSet(NOTIF_ASKED_KEY, 'true');
}

/** Returns true if we have already shown (or skipped) the permission prompt. */
export async function hasAskedPermission(): Promise<boolean> {
  return (await storageGet(NOTIF_ASKED_KEY)) === 'true';
}

/**
 * Increment the count of completed sessions and return the new total.
 * Used to decide when to surface the permission prompt.
 */
export async function incrementSessionsDone(): Promise<number> {
  const raw = await storageGet(SESSIONS_DONE_KEY);
  const next = parseInt(raw ?? '0', 10) + 1;
  await storageSet(SESSIONS_DONE_KEY, String(next));
  return next;
}
