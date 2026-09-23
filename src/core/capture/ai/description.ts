import { generateText } from 'ai';
import type { DOMContext } from '../dom/context';
import { serializeDOMContext } from '../dom/context';
import { applyPromptSettings, loadPromptSettings } from './prompt-settings';
import { STEP_DESCRIPTION_PROMPT } from './prompts';
import { createModel } from './provider';

export async function getAIDescription(
  domContext: DOMContext,
  provider: string,
  model: string,
  apiKey: string,
  baseUrl?: string,
  profileId?: string,
): Promise<string | null> {
  const settings = await loadPromptSettings(profileId);
  const { text } = await generateText({
    model: createModel(provider, model, apiKey, baseUrl),
    prompt: applyPromptSettings(
      STEP_DESCRIPTION_PROMPT.replace('{{context}}', serializeDOMContext(domContext)),
      settings,
    ),
    maxOutputTokens: 50,
  });
  return text.trim().replace(/^"|"$/g, '') || null;
}
