import type { RewriteSelectionResponse } from '@/lib/messaging';
import { generateForGuide } from './guide-ai';
import { applyPromptSettings, type PromptSettings } from './prompt-settings';
import { REWRITE_PROMPT } from './prompts';

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
  const result = await generateForGuide(
    guideId,
    (settings) => buildRewritePrompt(text, instruction, settings),
    'Selection rewrite',
  );
  if (result.error) return { error: result.error };
  const cleaned = cleanRewrite(result.text);
  return cleaned ? { text: cleaned } : { error: 'generation-failed' };
}
