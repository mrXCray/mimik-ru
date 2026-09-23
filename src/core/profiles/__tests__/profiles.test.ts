import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, unknown>());

vi.mock('@/lib/browser-api', () => ({
  localStorage: {
    get: async (keys: readonly string[]) =>
      Object.fromEntries(keys.filter((k) => store.has(k)).map((k) => [k, structuredClone(store.get(k))])),
    set: async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) store.set(k, structuredClone(v));
    },
    remove: async (keys: readonly string[]) => {
      for (const k of keys) store.delete(k);
    },
  },
}));

import {
  createProfile,
  DEFAULT_PROFILE_ID,
  deleteProfile,
  loadProfiles,
  profileName,
  readProfileSettings,
  renameProfile,
  switchProfile,
  writeProfileSettings,
} from '../profiles';

beforeEach(() => store.clear());

describe('loadProfiles', () => {
  it('creates the built-in profile on first use', async () => {
    const state = await loadProfiles();
    expect(state.activeId).toBe(DEFAULT_PROFILE_ID);
    expect(state.profiles).toHaveLength(1);
    expect(profileName(state.profiles[0])).toBe('profiles.defaultName');
    expect(store.get('activeProfileId')).toBe(DEFAULT_PROFILE_ID);
  });

  it('repairs an active id that points at a missing profile', async () => {
    store.set('profiles', [{ id: 'a', name: 'A', createdAt: 1, settings: {} }]);
    store.set('activeProfileId', 'gone');
    expect((await loadProfiles()).activeId).toBe('a');
    expect(store.get('activeProfileId')).toBe('a');
  });
});

describe('createProfile / switchProfile', () => {
  it('starts a new profile as a copy of the active one and makes it active', async () => {
    store.set('aiApiKey', 'sk-1');
    store.set('aiPrePrompt', 'Acme');

    const id = await createProfile('  Client B  ');
    const state = await loadProfiles();

    expect(state.activeId).toBe(id);
    expect(state.profiles.find((p) => p.id === id)?.name).toBe('Client B');
    expect(store.get('aiApiKey')).toBe('sk-1');
    expect(state.profiles.find((p) => p.id === DEFAULT_PROFILE_ID)?.settings).toEqual({
      aiApiKey: 'sk-1',
      aiPrePrompt: 'Acme',
    });
  });

  it('swaps live settings, clearing keys the target profile never set', async () => {
    store.set('aiPrePrompt', 'Acme');
    store.set('aiLanguage', 'ru');
    const b = await createProfile('B');
    store.set('aiPrePrompt', 'Beta');
    store.delete('aiLanguage');

    await switchProfile(DEFAULT_PROFILE_ID);
    expect(store.get('aiPrePrompt')).toBe('Acme');
    expect(store.get('aiLanguage')).toBe('ru');

    await switchProfile(b);
    expect(store.get('aiPrePrompt')).toBe('Beta');
    expect(store.has('aiLanguage')).toBe(false);
  });

  it('leaves settings that are not per profile alone', async () => {
    store.set('voiceApiKey', 'voice');
    await createProfile('B');
    await switchProfile(DEFAULT_PROFILE_ID);
    expect(store.get('voiceApiKey')).toBe('voice');
  });
});

describe('renameProfile / deleteProfile', () => {
  it('renames a profile', async () => {
    await loadProfiles();
    await renameProfile(DEFAULT_PROFILE_ID, 'Work');
    expect((await loadProfiles()).profiles[0].name).toBe('Work');
  });

  it('never deletes the last profile', async () => {
    await loadProfiles();
    await deleteProfile(DEFAULT_PROFILE_ID);
    expect((await loadProfiles()).profiles).toHaveLength(1);
  });

  it('switches away before deleting the active profile', async () => {
    store.set('aiPrePrompt', 'Acme');
    const b = await createProfile('B');
    store.set('aiPrePrompt', 'Beta');

    await deleteProfile(b);
    const state = await loadProfiles();

    expect(state.activeId).toBe(DEFAULT_PROFILE_ID);
    expect(state.profiles.map((p) => p.id)).toEqual([DEFAULT_PROFILE_ID]);
    expect(store.get('aiPrePrompt')).toBe('Acme');
  });
});

describe('readProfileSettings / writeProfileSettings', () => {
  it('reads an inactive profile from its stored settings and the active one live', async () => {
    store.set('brandFooter', 'Acme footer');
    const b = await createProfile('B');
    store.set('brandFooter', 'Beta footer');

    expect(await readProfileSettings(DEFAULT_PROFILE_ID, ['brandFooter'])).toEqual({ brandFooter: 'Acme footer' });
    expect(await readProfileSettings(b, ['brandFooter'])).toEqual({ brandFooter: 'Beta footer' });
    expect(await readProfileSettings(undefined, ['brandFooter'])).toEqual({ brandFooter: 'Beta footer' });
  });

  it('falls back to the live settings for a deleted profile', async () => {
    store.set('brandFooter', 'Live');
    await loadProfiles();
    expect(await readProfileSettings('deleted', ['brandFooter'])).toEqual({ brandFooter: 'Live' });
  });

  it('writes into an inactive profile without touching the live settings', async () => {
    store.set('brandFooter', 'Acme footer');
    await createProfile('B');

    await writeProfileSettings(DEFAULT_PROFILE_ID, { brandFooter: 'Changed' });

    expect(store.get('brandFooter')).toBe('Acme footer');
    expect(await readProfileSettings(DEFAULT_PROFILE_ID, ['brandFooter'])).toEqual({ brandFooter: 'Changed' });
  });
});
