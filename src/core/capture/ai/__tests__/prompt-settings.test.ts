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
    const prompt = applyPromptSettings('TASK', { locale: 'ru', prePrompt: 'Acme CRM' });
    expect(prompt.indexOf('Acme CRM')).toBeLessThan(prompt.indexOf('TASK'));
    expect(prompt.indexOf('TASK')).toBeLessThan(prompt.indexOf('Russian'));
  });

  it('leaves an English prompt without context untouched', () => {
    expect(applyPromptSettings('TASK', { locale: 'en', prePrompt: '' })).toBe('TASK');
  });
});
