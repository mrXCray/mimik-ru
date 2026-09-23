import { generateText } from 'ai';
import { settingsForGuide } from '@/core/profiles/guide-settings';
import { logger } from '@/lib/logger';
import type { RewriteSelectionResponse } from '@/lib/messaging';
import { resolveAiKey } from './keys';
import { AI_PROVIDERS } from './models';
import { applyPromptSettings, type PromptSettings, resolvePromptSettings } from './prompt-settings';
import { REWRITE_PROMPT } from './prompts';
import { createModel } from './provider';

const WRAPPED_IN_QUOTES = /^["“'](.*)["”']$/s;

export function cleanRewrite(raw: string): string {
  const trimmed = raw.trim();
  const unwrapped = trimmed.match(WRAPPED_IN_QUOTES);
  return (unwrapped ? unwrapped[1] : trimmed).trim();
}

export function buildRewritePrompt(text: string, instruction: string, settings: PromptSettings): string {
  return applyPromptSettings(
    REWRITE_PROMPT.replace('{{text}}', () => text).replace('{{instruction}}', () => instruction),
    settings,
  );
}

export async function rewriteSelection(
  text: string,
  instruction: string,
  guideId?: string,
): Promise<RewriteSelectionResponse> {
  const settings = await settingsForGuide(guideId, [
    'aiApiKeys',
    'aiApiKey',
    'aiProvider',
    'aiModel',
    'aiBaseUrl',
    'aiLanguage',
    'aiPrePrompt',
  ]);
  const { provider, apiKey } = resolveAiKey(settings);
  if (!apiKey) return { error: 'no-api-key' };

  try {
    const { text: raw } = await generateText({
      model: createModel(
        provider,
        (settings.aiModel as string) || AI_PROVIDERS[provider].defaultModel,
        apiKey,
        settings.aiBaseUrl as string | undefined,
      ),
      prompt: buildRewritePrompt(text, instruction, resolvePromptSettings(settings)),
      maxOutputTokens: 400,
    });

    const cleaned = cleanRewrite(raw);
    if (!cleaned) return { error: 'generation-failed' };
    return { text: cleaned };
  } catch (err) {
    logger.error('Selection rewrite failed', err);
    return { error: 'generation-failed' };
  }
}
