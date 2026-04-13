// In-memory store for tracking ISR revalidation events per rule slug.
// NOTE: This store is not shared across server instances. In a multi-instance
// deployment (e.g. multiple Azure containers), each instance maintains its own
// copy. For production at scale, consider a shared store (Redis, Azure Table Storage).

interface SlugStatus {
  lastWebhookAt: number | null;
  lastGeneratedAt: number | null;
}

const store = new Map<string, SlugStatus>();

function getOrCreate(slug: string): SlugStatus {
  let entry = store.get(slug);
  if (!entry) {
    entry = { lastWebhookAt: null, lastGeneratedAt: null };
    store.set(slug, entry);
  }
  return entry;
}

/** Record that a TinaCMS webhook triggered revalidation for a rule slug. */
export function recordRevalidation(slug: string): void {
  const entry = getOrCreate(slug);
  entry.lastWebhookAt = Date.now();
}

/** Record that a rule page was generated (ISR) at the given timestamp. */
export function recordPageGeneration(slug: string, timestamp: number): void {
  const entry = getOrCreate(slug);
  entry.lastGeneratedAt = timestamp;
}

/** Get the revalidation/generation timestamps for a rule slug. */
export function getSlugStatus(slug: string): SlugStatus {
  return store.get(slug) ?? { lastWebhookAt: null, lastGeneratedAt: null };
}
