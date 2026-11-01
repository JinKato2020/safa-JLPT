export const REVIEW_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;
export const FEEDBACK_EMAIL = 'contact@safa-lang.com';

export function reviewIsDue(installedAt: number, lastAskedAt: number, now: number, studyCompleted: boolean): boolean {
  if (!studyCompleted || !Number.isFinite(installedAt) || installedAt <= 0) return false;
  const last = Number.isFinite(lastAskedAt) && lastAskedAt > 0 ? lastAskedAt : 0;
  return now - Math.max(installedAt, last) >= REVIEW_INTERVAL_MS;
}

export function feedbackMailUrl(subject: string): string {
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
