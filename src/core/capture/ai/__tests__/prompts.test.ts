import { describe, expect, it } from 'vitest';
import {
  AI_LANGUAGES,
  defaultAiLanguage,
  GUIDE_META_PROMPT,
  getLanguageSuffix,
  getPrePromptPrefix,
  MAX_PRE_PROMPT_CHARS,
} from '../prompts';

describe('GUIDE_META_PROMPT', () => {
  it('has a steps placeholder', () => {
    expect(GUIDE_META_PROMPT).toContain('{{steps}}');
  });

  it('keeps the 60-character title constraint', () => {
    expect(GUIDE_META_PROMPT).toContain('60 characters');
  });

  it('asks for a description of one or two sentences', () => {
    expect(GUIDE_META_PROMPT.toLowerCase()).toContain('description');
    expect(GUIDE_META_PROMPT).toMatch(/one or two sentences/i);
  });
});

describe('getLanguageSuffix', () => {
  it('returns empty string for English', () => {
    expect(getLanguageSuffix('en')).toBe('');
  });

  it('returns empty string for en-US', () => {
    expect(getLanguageSuffix('en-US')).toBe('');
  });

  it('returns Spanish suffix for es', () => {
    expect(getLanguageSuffix('es')).toContain('Spanish');
  });

  it('returns French suffix for fr', () => {
    expect(getLanguageSuffix('fr')).toContain('French');
  });

  it('returns Chinese suffix for zh-CN', () => {
    expect(getLanguageSuffix('zh-CN')).toContain('Chinese');
  });

  it('returns Russian suffix for ru', () => {
    expect(getLanguageSuffix('ru')).toContain('Russian');
  });

  it('returns Brazilian Portuguese suffix for pt-BR', () => {
    expect(getLanguageSuffix('pt-BR')).toContain('Brazilian Portuguese');
  });

  it('returns the locale code for unknown languages', () => {
    expect(getLanguageSuffix('sv')).toContain('sv');
  });

  it('includes IMPORTANT instruction', () => {
    const suffix = getLanguageSuffix('es');
    expect(suffix).toContain('IMPORTANT');
    expect(suffix).toContain('Write the output in');
  });
});

describe('AI_LANGUAGES', () => {
  it('has 7 supported languages', () => {
    expect(AI_LANGUAGES).toHaveLength(7);
  });

  it('includes English as first entry', () => {
    expect(AI_LANGUAGES[0]).toEqual({ code: 'en', label: 'English' });
  });

  it('includes Simplified Chinese', () => {
    expect(AI_LANGUAGES).toContainEqual({ code: 'zh-CN', label: '中文' });
  });

  it('includes Russian', () => {
    expect(AI_LANGUAGES).toContainEqual({ code: 'ru', label: 'Русский' });
  });

  it('each entry has code and label', () => {
    for (const lang of AI_LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.label).toBeTruthy();
    }
  });
});

describe('defaultAiLanguage', () => {
  it('follows the UI locale when it is a supported language', () => {
    expect(defaultAiLanguage('ru')).toBe('ru');
    expect(defaultAiLanguage('pt-BR')).toBe('pt-BR');
    expect(defaultAiLanguage('zh_CN')).toBe('zh-CN');
  });

  it('matches on the base language', () => {
    expect(defaultAiLanguage('de-AT')).toBe('de');
    expect(defaultAiLanguage('pt')).toBe('pt-BR');
  });

  it('falls back to English', () => {
    expect(defaultAiLanguage(undefined)).toBe('en');
    expect(defaultAiLanguage('ja')).toBe('en');
  });
});

describe('getPrePromptPrefix', () => {
  it('is empty when there is no project context', () => {
    expect(getPrePromptPrefix('')).toBe('');
    expect(getPrePromptPrefix('   ')).toBe('');
    expect(getPrePromptPrefix(undefined)).toBe('');
  });

  it('wraps the project context in delimiters', () => {
    const prefix = getPrePromptPrefix('  # Acme CRM\nUse formal tone.  ');
    expect(prefix).toContain('"""\n# Acme CRM\nUse formal tone.\n"""');
    expect(prefix.endsWith('\n\n')).toBe(true);
  });

  it('caps very long context', () => {
    const prefix = getPrePromptPrefix('a'.repeat(MAX_PRE_PROMPT_CHARS + 500));
    expect(prefix).toContain('a'.repeat(MAX_PRE_PROMPT_CHARS));
    expect(prefix).not.toContain('a'.repeat(MAX_PRE_PROMPT_CHARS + 1));
  });
});
