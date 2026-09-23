import { describe, expect, it, vi } from 'vitest';
import { i18n } from '#imports';

vi.mock('@/lib/browser-api', () => ({ localStorage: { get: vi.fn() } }));

import { applyPromptSettings, resolvePromptSettings } from '../prompt-settings';

describe('resolvePromptSettings', () => {
  it('uses the language the user picked', () => {
    expect(resolvePromptSettings({ aiLanguage: 'fr' }).locale).toBe('fr');
  });

  it('defaults to the extension UI language when none was picked', () => {
    const t = vi.spyOn(i18n, 't').mockImplementation(((key: string) => (key === 'meta.locale' ? 'ru' : key)) as never);
    expect(resolvePromptSettings({}).locale).toBe('ru');
    t.mockRestore();
  });

  it('reads the project context as text', () => {
    expect(resolvePromptSettings({ aiPrePrompt: 'Acme CRM' }).prePrompt).toBe('Acme CRM');
    expect(resolvePromptSettings({ aiPrePrompt: 42 }).prePrompt).toBe('');
  });
});

describe('applyPromptSettings', () => {
  it('wraps the task with project context first and the language rule last', () => {
    const prompt = applyPromptSettings('TASK', { locale: 'ru', prePrompt: 'Acme CRM', styleGuide: true });
    expect(prompt.indexOf('Acme CRM')).toBeLessThan(prompt.indexOf('TASK'));
    expect(prompt.indexOf('TASK')).toBeLessThan(prompt.indexOf('Russian'));
  });

  it('leaves an English prompt without context untouched', () => {
    expect(applyPromptSettings('TASK', { locale: 'en', prePrompt: '', styleGuide: true })).toBe('TASK');
  });
});

describe('built-in step rules', () => {
  const ru = { locale: 'ru', prePrompt: '', styleGuide: true };

  it('are added to step prompts, before the language rule', () => {
    const prompt = applyPromptSettings('TASK', ru, { stepRules: true });
    expect(prompt).toContain('Describe exactly one action');
    expect(prompt).toContain('«ёлочки»');
    expect(prompt.indexOf('TASK')).toBeLessThan(prompt.indexOf('Describe exactly one action'));
    expect(prompt.indexOf('Describe exactly one action')).toBeLessThan(prompt.indexOf('Write the output in Russian'));
  });

  it('are left out of prompts that are not step text', () => {
    expect(applyPromptSettings('TASK', ru)).not.toContain('Describe exactly one action');
  });

  it('are left out when the profile turned them off', () => {
    expect(applyPromptSettings('TASK', { ...ru, styleGuide: false }, { stepRules: true })).not.toContain(
      'Describe exactly one action',
    );
  });

  it('are on unless the profile stored false', () => {
    expect(resolvePromptSettings({}).styleGuide).toBe(true);
    expect(resolvePromptSettings({ aiStyleGuide: false }).styleGuide).toBe(false);
  });

  it('use plain double quotes for English and a generic note for other languages', () => {
    expect(applyPromptSettings('T', { ...ru, locale: 'en' }, { stepRules: true })).toContain('straight double quotes');
    expect(applyPromptSettings('T', { ...ru, locale: 'fr' }, { stepRules: true })).toContain(
      'quotation marks customary in the output language',
    );
  });
});
