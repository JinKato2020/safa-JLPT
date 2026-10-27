// Native-independent foreground clock. Call tick every 15s with a monotonic clock.
export const USAGE_TICK_MS = 15_000;
const SNAPSHOT_MS = 60_000;

export function createForegroundUsage(callbacks: {
  addSeconds: (seconds: number) => void;
  snapshot: (force: boolean) => void;
  session: (seconds: number) => void;
}) {
  let last: number | null = null;
  let started = 0;
  let lastSnapshot = 0;
  let remainder = 0;

  function checkpoint(now: number) {
    if (last === null) return;
    remainder += Math.max(0, now - last);
    last = now;
    const seconds = Math.floor(remainder / 1000);
    remainder -= seconds * 1000;
    if (seconds > 0) callbacks.addSeconds(seconds);
  }

  return {
    active(now: number) {
      if (last !== null) return; // Repeated active events must not reset the clock.
      last = started = lastSnapshot = now;
      callbacks.snapshot(false);
    },
    tick(now: number) {
      if (last === null) return;
      checkpoint(now);
      if (now - lastSnapshot >= SNAPSHOT_MS) {
        lastSnapshot = now;
        callbacks.snapshot(true); // addSeconds has already committed the sampled value.
      }
    },
    pause(now: number) {
      if (last === null) return; // inactive -> background must not count twice.
      checkpoint(now);
      last = null;
      callbacks.session(Math.max(0, Math.floor((now - started) / 1000)));
      callbacks.snapshot(true);
    },
  };
}
