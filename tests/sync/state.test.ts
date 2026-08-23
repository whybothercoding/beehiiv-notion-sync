import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadSyncState, saveSyncState, hashProperties } from '../../src/sync/state';

describe('loadSyncState / saveSyncState', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-state-test-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('returns an empty state when the file does not exist', async () => {
    const state = await loadSyncState(path.join(dir, 'missing.json'));
    expect(state).toEqual({ subscribers: {}, posts: {} });
  });

  it('returns an empty state when the file is corrupt JSON', async () => {
    const file = path.join(dir, 'corrupt.json');
    await fs.writeFile(file, '{not valid json', 'utf-8');
    const state = await loadSyncState(file);
    expect(state).toEqual({ subscribers: {}, posts: {} });
  });

  it('round-trips a saved state', async () => {
    const file = path.join(dir, 'state.json');
    await saveSyncState(file, { subscribers: { sub_1: 'hash1' }, posts: { post_1: 'hash2' } });
    const loaded = await loadSyncState(file);
    expect(loaded).toEqual({ subscribers: { sub_1: 'hash1' }, posts: { post_1: 'hash2' } });
  });
});

describe('hashProperties', () => {
  it('is stable regardless of key order', () => {
    const a = hashProperties({ x: 1, y: 2 });
    const b = hashProperties({ y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it('changes when a value changes', () => {
    const a = hashProperties({ x: 1 });
    const b = hashProperties({ x: 2 });
    expect(a).not.toBe(b);
  });

  it('changes when a key is added or removed', () => {
    const a = hashProperties({ x: 1 });
    const b = hashProperties({ x: 1, y: 2 });
    expect(a).not.toBe(b);
  });
});
