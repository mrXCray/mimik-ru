import { db } from '@/core/guides/db';
import type { ProfileSettingKey, Settings } from '@/core/guides/types';
import { readProfileSettings } from './profiles';

export async function guideProfileId(guideId: string | undefined): Promise<string | undefined> {
  if (!guideId) return undefined;
  return (await db.guides.get(guideId))?.profileId;
}

/** Profile settings for the profile a guide was recorded with. */
export async function settingsForGuide<K extends ProfileSettingKey>(
  guideId: string | undefined,
  keys: readonly K[],
): Promise<Partial<Pick<Settings, K>>> {
  return readProfileSettings(await guideProfileId(guideId), keys);
}
