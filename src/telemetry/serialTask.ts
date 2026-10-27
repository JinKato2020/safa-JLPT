// Keep later snapshots behind earlier writes, including slow/offline retries.
export function createSerialTask() {
  let pending: Promise<void> = Promise.resolve();
  return (task: () => Promise<void>): Promise<void> => {
    const next = pending.then(task);
    pending = next.catch(() => {}); // One failure must not block future snapshots.
    return next;
  };
}
