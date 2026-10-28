import type { Settings } from '../store/state';

/** Stable signature: send once after a complete profile is committed, not on every usage tick. */
export function completedProfileSnapshotKey(settings: Settings, accountId: string | null): string | null {
  if (!settings.onboarded || !settings.nickname?.trim() || !settings.avatar ||
      !settings.personality || !settings.moodMsg) return null;
  return JSON.stringify([
    accountId, settings.nickname, settings.avatar, settings.personality,
    settings.moodMsg, settings.country, settings.uiLang, settings.l1,
  ]);
}
