import { getAIDescription } from '@/core/capture/ai/description';
import { describeAiFailure } from '@/core/capture/ai/errors';
import { resolveAiKey } from '@/core/capture/ai/keys';
import { AI_PROVIDERS } from '@/core/capture/ai/models';
import type { DOMContext } from '@/core/capture/dom/context';
import { guideProfileId } from '@/core/profiles/guide-settings';
import { readProfileSettings } from '@/core/profiles/profiles';
import { logger } from '@/lib/logger';
import { broadcastAiToPanel } from '@/lib/port';

export async function generateAiDescription(guideId: string, domContext: DOMContext): Promise<string | undefined> {
  const profileId = await guideProfileId(guideId);
  const settings = await readProfileSettings(profileId, [
    'aiApiKeys',
    'aiApiKey',
    'aiProvider',
    'aiModel',
    'aiBaseUrl',
  ]);
  const { provider, apiKey, usable } = resolveAiKey(settings);
  if (!usable) return undefined;

  const model = (settings.aiModel as string) || AI_PROVIDERS[provider].defaultModel;
  try {
    const description = await getAIDescription(
      domContext,
      provider,
      model,
      apiKey,
      settings.aiBaseUrl as string | undefined,
      profileId,
    );
    return description || undefined;
  } catch (err) {
    const failure = describeAiFailure(err);
    logger.error(`AI description failed (${failure.reason}${failure.status ? ` ${failure.status}` : ''})`, err);
    broadcastAiToPanel({ type: 'AI_UPDATE', reason: failure.reason, status: failure.status, provider });
    return undefined;
  }
}
