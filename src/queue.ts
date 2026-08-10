// Per-conversation FIFO: two replies from the same customer can never race.
// (BullMQ + Redis replaces this in the Postgres increment — same key discipline.)

const chains = new Map<string, Promise<void>>();

export function enqueue(key: string, fn: () => Promise<void>): void {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev
    .then(fn)
    .catch((e) => console.error(JSON.stringify({ at: "queue", key, err: String(e).slice(0, 400) })));
  chains.set(key, next);
  void next.finally(() => {
    if (chains.get(key) === next) chains.delete(key);
  });
}
