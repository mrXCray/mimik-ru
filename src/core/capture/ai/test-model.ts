import { generateText } from 'ai';
import type { DOMContext } from '../dom/context';
import { serializeDOMContext } from '../dom/context';
import { type AiLimits, generationLimits } from './limits';
import { applyPromptSettings, type PromptSettings } from './prompt-settings';
import { STEP_DESCRIPTION_PROMPT, tidyStepDescription } from './prompts';
import { createModel } from './provider';

export interface AiTestRequest extends PromptSettings, AiLimits {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export type AiTestResult =
  | { ok: true; text: string; ms: number }
  | { ok: false; reason: 'timeout' | 'failed'; message: string; ms: number };

/** A typical click, so the test runs the same prompt a real recording sends. */
export const SAMPLE_DOM_CONTEXT: DOMContext = {
  page: { title: 'Public profile - Settings', path: '/settings/profile' },
  container: { tag: 'form', role: null, label: 'Public profile' },
  heading: 'Public profile',
  siblings: [
    { tag: 'input', role: null, name: 'Name', value: null },
    { tag: 'input', role: null, name: 'Email', value: null },
    { tag: 'textarea', role: null, name: 'Bio', value: null },
  ],
  target: { tag: 'button', role: null, name: 'Update profile', value: null, action: 'click' },
};

export function samplePrompt(settings: PromptSettings): string {
  return applyPromptSettings(
    STEP_DESCRIPTION_PROMPT.replace('{{context}}', serializeDOMContext(SAMPLE_DOM_CONTEXT)),
    settings,
    { stepRules: true },
  );
}

/** Sends one real step-description request with the given (possibly unsaved) settings. */
export async function testAiModel(request: AiTestRequest): Promise<AiTestResult> {
  const started = Date.now();
  try {
    const { text } = await generateText({
      model: createModel(request.provider, request.model, request.apiKey, request.baseUrl),
      prompt: samplePrompt(request),
      maxRetries: 0,
      ...generationLimits(request),
    });
    const answer = text.trim();
    return {
      ok: true,
      text: request.styleGuide ? tidyStepDescription(answer) : answer,
      ms: Date.now() - started,
    };
  } catch (err) {
    const ms = Date.now() - started;
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') return { ok: false, reason: 'timeout', message: '', ms };
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'failed', message: message.slice(0, 300), ms };
  }
}
