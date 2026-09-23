import { generateText } from 'ai';
import { settingsForGuide } from '@/core/profiles/guide-settings';
import { logger } from '@/lib/logger';
import type { RewriteError } from '@/lib/messaging';
import { resolveAiKey } from './keys';
import { AI_LIMIT_KEYS, generationLimits, resolveAiLimits } from './limits';
import { AI_PROVIDERS } from './models';
import { type PromptSettings, resolvePromptSettings } from './prompt-settings';
import { createModel } from './provider';

const GUIDE_AI_KEYS = [
  'aiApiKeys',
  'aiApiKey',
  'aiProvider',
  'aiModel',
  'aiBaseUrl',
  'aiLanguage',
  'aiPrePrompt',
  'aiStyleGuide',
  ...AI_LIMIT_KEYS,
] as const;

export type GuideAiResult = { text: string; error?: undefined } | { text?: undefined; error: RewriteError };

/**
 * One AI request on behalf of a guide, with the AI settings, context and limits of the profile the
 * guide was recorded with. `buildPrompt` receives that profile's prompt settings.
 */
export async function generateForGuide(
  guideId: string | undefined,
  buildPrompt: (settings: PromptSettings) => string,
  label: string,
): Promise<GuideAiResult> {
  const settings = await settingsForGuide(guideId, GUIDE_AI_KEYS);
  const { provider, apiKey, usable } = resolveAiKey(settings);
  if (!usable) return { error: 'no-api-key' };

  try {
    const { text } = await generateText({
      model: createModel(
        provider,
        (settings.aiModel as string) || AI_PROVIDERS[provider].defaultModel,
        apiKey,
        settings.aiBaseUrl as string | undefined,
      ),
      prompt: buildPrompt(resolvePromptSettings(settings)),
      ...generationLimits(resolveAiLimits(settings)),
    });
    return { text };
  } catch (err) {
    logger.error(`${label} failed`, err);
    return { error: 'generation-failed' };
  }
}

// «…» is left alone: an answer wrapped in it is usually one on-screen name, not quoting.
const WRAPPED_IN_QUOTES = /^["“'](.*)["”']$/s;
const CODE_FENCE = /^```[\w-]*\s*\n?([\s\S]*?)\n?\s*```$/;
const TRIPLE_QUOTES = /^(?:"{3}|'{3})\s*([\s\S]*?)\s*(?:"{3}|'{3})$/;
const EMPTY_QUOTE_LINES = /^(?:""|'')\s*\n([\s\S]*?)\n\s*(?:""|'')$/;
const TEXT_TAG = /^<text>\s*([\s\S]*?)\s*<\/text>$/i;

/**
 * Trims an answer and strips what models wrap around it: code fences, triple quotes, the <text> tag
 * from the prompt, and quotes around the whole answer.
 */
export function cleanAnswer(raw: string): string {
  let text = raw.trim();
  for (const wrapper of [CODE_FENCE, TRIPLE_QUOTES, EMPTY_QUOTE_LINES, TEXT_TAG]) {
    const match = text.match(wrapper);
    if (match) text = match[1].trim();
  }
  const unwrapped = text.match(WRAPPED_IN_QUOTES);
  return (unwrapped ? unwrapped[1] : text).trim();
}
