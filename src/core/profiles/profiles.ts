import { i18n } from '#imports';
import {
  PROFILE_SETTING_KEYS,
  type ProfileRecord,
  type ProfileSettingKey,
  type ProfileSettings,
  type Settings,
} from '@/core/guides/types';
import { localStorage } from '@/lib/browser-api';

/**
 * Profiles bundle the AI and export settings a guide is recorded with.
 *
 * The active profile's values live in the flat settings keys, so every existing
 * reader keeps working unchanged. Inactive profiles keep theirs in `profiles`,
 * and switching swaps the two. Readers that act on a specific guide go through
 * `readProfileSettings(guide.profileId, …)` so a guide keeps its own profile
 * even after the user switches to another.
 */

export const DEFAULT_PROFILE_ID = 'default';
export const MAX_PROFILE_NAME_LENGTH = 60;

export interface ProfilesState {
  profiles: ProfileRecord[];
  activeId: string;
}

export function profileName(profile: Pick<ProfileRecord, 'name'>): string {
  return profile.name.trim() || i18n.t('profiles.defaultName');
}

function pickProfileSettings(stored: Partial<Settings>): ProfileSettings {
  const settings: ProfileSettings = {};
  for (const key of PROFILE_SETTING_KEYS) {
    if (stored[key] !== undefined) (settings as Record<string, unknown>)[key] = stored[key];
  }
  return settings;
}

function normalise(profiles: unknown, activeId: unknown): ProfilesState | null {
  if (!Array.isArray(profiles) || profiles.length === 0) return null;
  const valid = profiles.filter(
    (p): p is ProfileRecord => !!p && typeof p === 'object' && typeof (p as ProfileRecord).id === 'string',
  );
  if (valid.length === 0) return null;
  const list = valid.map((p) => ({
    id: p.id,
    name: typeof p.name === 'string' ? p.name : '',
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0,
    settings: p.settings && typeof p.settings === 'object' ? p.settings : {},
  }));
  const active = typeof activeId === 'string' && list.some((p) => p.id === activeId) ? activeId : list[0].id;
  return { profiles: list, activeId: active };
}

/** Returns the profiles, creating the built-in one from the current settings on first use. */
export async function loadProfiles(): Promise<ProfilesState> {
  const stored = await localStorage.get(['profiles', 'activeProfileId']);
  const state = normalise(stored.profiles, stored.activeProfileId);
  if (state) {
    if (state.activeId !== stored.activeProfileId) await localStorage.set({ activeProfileId: state.activeId });
    return state;
  }

  const created: ProfilesState = {
    profiles: [{ id: DEFAULT_PROFILE_ID, name: '', createdAt: Date.now(), settings: {} }],
    activeId: DEFAULT_PROFILE_ID,
  };
  await localStorage.set({ profiles: created.profiles, activeProfileId: created.activeId });
  return created;
}

export async function getActiveProfileId(): Promise<string> {
  return (await loadProfiles()).activeId;
}

async function snapshotActive(state: ProfilesState): Promise<ProfileRecord[]> {
  const live = pickProfileSettings(await localStorage.get([...PROFILE_SETTING_KEYS]));
  return state.profiles.map((p) => (p.id === state.activeId ? { ...p, settings: live } : p));
}

/** Makes `id` the active profile: parks the live settings in the old profile and loads the new one's. */
export async function switchProfile(id: string): Promise<void> {
  const state = await loadProfiles();
  if (id === state.activeId) return;
  const target = state.profiles.find((p) => p.id === id);
  if (!target) throw new Error(`Unknown profile ${id}`);

  const profiles = await snapshotActive(state);
  const missing = PROFILE_SETTING_KEYS.filter((key) => target.settings[key] === undefined);
  if (missing.length) await localStorage.remove(missing);
  await localStorage.set({ ...target.settings, profiles, activeProfileId: id });
}

/** Creates a profile that starts as a copy of the active one (so API keys carry over) and switches to it. */
export async function createProfile(name: string): Promise<string> {
  const state = await loadProfiles();
  const profiles = await snapshotActive(state);
  const source = profiles.find((p) => p.id === state.activeId);
  const id = crypto.randomUUID();
  const profile: ProfileRecord = {
    id,
    name: name.trim().slice(0, MAX_PROFILE_NAME_LENGTH),
    createdAt: Date.now(),
    settings: structuredClone(source?.settings ?? {}),
  };
  await localStorage.set({ profiles: [...profiles, profile], activeProfileId: id });
  return id;
}

export async function renameProfile(id: string, name: string): Promise<void> {
  const { profiles } = await loadProfiles();
  await localStorage.set({
    profiles: profiles.map((p) => (p.id === id ? { ...p, name: name.trim().slice(0, MAX_PROFILE_NAME_LENGTH) } : p)),
  });
}

/** Deletes a profile. The last one cannot be deleted; deleting the active one switches to another first. */
export async function deleteProfile(id: string): Promise<void> {
  let state = await loadProfiles();
  if (state.profiles.length <= 1 || !state.profiles.some((p) => p.id === id)) return;
  if (state.activeId === id) {
    await switchProfile(state.profiles.find((p) => p.id !== id)!.id);
    state = await loadProfiles();
  }
  await localStorage.set({ profiles: state.profiles.filter((p) => p.id !== id) });
}

/**
 * Reads settings for a profile. The active profile (and guides recorded before
 * profiles existed, or whose profile was deleted) use the live settings.
 */
export async function readProfileSettings<K extends ProfileSettingKey>(
  profileId: string | undefined,
  keys: readonly K[],
): Promise<Partial<Pick<Settings, K>>> {
  if (profileId) {
    const state = await loadProfiles();
    const profile = state.profiles.find((p) => p.id === profileId);
    if (profile && profile.id !== state.activeId) {
      const picked: Partial<Pick<Settings, K>> = {};
      for (const key of keys) {
        if (profile.settings[key] !== undefined) picked[key] = profile.settings[key] as Settings[K];
      }
      return picked;
    }
  }
  return localStorage.get(keys);
}

/** Writes settings into a profile, live if it is the active one. */
export async function writeProfileSettings(profileId: string | undefined, patch: ProfileSettings): Promise<void> {
  if (profileId) {
    const state = await loadProfiles();
    if (profileId !== state.activeId && state.profiles.some((p) => p.id === profileId)) {
      await localStorage.set({
        profiles: state.profiles.map((p) => (p.id === profileId ? { ...p, settings: { ...p.settings, ...patch } } : p)),
      });
      return;
    }
  }
  await localStorage.set(patch);
}
