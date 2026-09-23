import { i18n } from '#imports';
import { readProfileSettings } from '@/core/profiles/profiles';
import { defaultAiLanguage, getLanguageSuffix, getPrePromptPrefix } from './prompts';

export interface PromptSettings {
  locale: string;
  prePrompt: string;
}

export function uiLocale(): string | undefined {
  try {
    return i18n.t('meta.locale') || undefined;
  } catch {
    return undefined;
  }
}

export function resolvePromptSettings(stored: Record<string, unknown>): PromptSettings {
  return {
    locale: (typeof stored.aiLanguage === 'string' && stored.aiLanguage) || defaultAiLanguage(uiLocale()),
    prePrompt: typeof stored.aiPrePrompt === 'string' ? stored.aiPrePrompt : '',
  };
}

export async function loadPromptSettings(profileId?: string): Promise<PromptSettings> {
  return resolvePromptSettings(await readProfileSettings(profileId, ['aiLanguage', 'aiPrePrompt']));
}

/** Project context first, then the task, then the language rule last so it is the freshest instruction. */
export function applyPromptSettings(prompt: string, settings: PromptSettings): string {
  return getPrePromptPrefix(settings.prePrompt) + prompt + getLanguageSuffix(settings.locale);
}
