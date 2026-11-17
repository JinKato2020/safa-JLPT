// Startup has several concurrent callers (snapshots, events, auth, trial checks).
// Share the read/create/write operation so one installation cannot mint several IDs.
export function createCachedIdResolver<T extends string | null>(resolve: () => Promise<T>): () => Promise<T> {
  let cached: T | undefined;
  let pending: Promise<T> | null = null;
  return () => {
    if (cached !== undefined) return Promise.resolve(cached);
    if (!pending) {
      pending = Promise.resolve().then(resolve).then(id => {
        if (id) cached = id; // A transient storage failure must remain retryable.
        return id;
      }).finally(() => { pending = null; });
    }
    return pending;
  };
}
