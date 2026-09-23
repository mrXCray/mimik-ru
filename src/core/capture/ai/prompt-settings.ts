import { i18n } from '#imports';
import { readProfileSettings } from '@/core/profiles/profiles';
import { defaultAiLanguage, getLanguageSuffix, getPrePromptPrefix, getStepStyleRules } from './prompts';

export interface PromptSettings {
  locale: string;
  prePrompt: string;
  /** Built-in writing rules for step text (on unless the profile turned them off). */
  styleGuide: boolean;
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
    styleGuide: stored.aiStyleGuide !== false,
  };
}

export async function loadPromptSettings(profileId?: string): Promise<PromptSettings> {
  return resolvePromptSettings(await readProfileSettings(profileId, ['aiLanguage', 'aiPrePrompt', 'aiStyleGuide']));
}

/**
 * Project context first, then the task, then (for step text) the built-in writing rules, and the
 * language rule last so it is the freshest instruction.
 */
export function applyPromptSettings(
  prompt: string,
  settings: PromptSettings,
  { stepRules = false }: { stepRules?: boolean } = {},
): string {
  const rules = stepRules && settings.styleGuide ? `\n\n${getStepStyleRules(settings.locale)}` : '';
  return getPrePromptPrefix(settings.prePrompt) + prompt + rules + getLanguageSuffix(settings.locale);
}
