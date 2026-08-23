import { promises as fs } from 'fs';
import { createHash } from 'crypto';

export interface SyncState {
  subscribers: Record<string, string>;
  posts: Record<string, string>;
}

function emptyState(): SyncState {
  return { subscribers: {}, posts: {} };
}

export async function loadSyncState(filePath: string): Promise<SyncState> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      subscribers: parsed.subscribers ?? {},
      posts: parsed.posts ?? {},
    };
  } catch (error) {
    // Missing file (first run) or corrupt state — start clean rather than
    // failing the sync. A stale/absent cache only costs one full re-write,
    // never correctness.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
    return emptyState();
  }
}

export async function saveSyncState(filePath: string, state: SyncState): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Stable content hash of a mapped Notion properties object, used to detect
 * whether a record actually changed since the last sync. Key order in the
 * input object is irrelevant to the caller, so it's normalized via sorted
 * JSON.stringify before hashing.
 */
export function hashProperties(properties: Record<string, unknown>): string {
  const sortedKeys = Object.keys(properties).sort();
  const normalized = sortedKeys.map((key) => [key, properties[key]]);
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
