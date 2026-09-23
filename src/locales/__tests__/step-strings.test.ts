import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCRUB_PLACEHOLDER, scrubValues, typedValues } from '@/core/transfer/scrub';

const LOCALES = ['en', 'zh-CN', 'es', 'fr', 'de', 'pt-BR'] as const;

function stepMessage(locale: string, key: string): string {
  const lines = readFileSync(join(process.cwd(), `src/locales/${locale}.yml`), 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n');

  let inSteps = false;
  for (const line of lines) {
    if (/^[\w-]+:/.test(line)) inSteps = line.startsWith('steps:');
    if (!inSteps) continue;
    const match = new RegExp(`^ {2}${key}: (.*)$`).exec(line);
    if (!match) continue;
    const raw = match[1].trim();
    if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
    if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1).replace(/\\"/g, '"');
    return raw;
  }
  throw new Error(`steps.${key} missing from ${locale}.yml`);
}

function substitute(message: string, args: string[]): string {
  return message.replace(/\$(\d)/g, (_match, index) => args[Number(index) - 1] ?? '');
}

function describeTyping(locale: string, value: string, label: string): string {
  return substitute(stepMessage(locale, 'typeValueInto'), [value, label]);
}

describe('localized typing step descriptions', () => {
  it.each(LOCALES)('%s wraps the typed value in straight double quotes', (locale) => {
    const description = describeTyping(locale, 'hunter2', 'Password');
    expect(description).toContain('"hunter2"');
    expect(description).not.toMatch(/[“”«»「」]/);
  });

  it.each(LOCALES)('%s names the field as well as the value', (locale) => {
    expect(describeTyping(locale, 'hunter2', 'Password')).toContain('Password');
  });

  it.each(LOCALES)('%s clears a field without echoing any value', (locale) => {
    const cleared = substitute(stepMessage(locale, 'clearField'), ['Password']);
    expect(cleared).toContain('Password');
    expect(cleared).not.toContain('"');
  });
});

describe('bundle redaction over localized descriptions', () => {
  const cases = [
    { name: 'a short value only the quoted path can catch', value: 'abc' },
    { name: 'a long value', value: 'hunter2-secret-value' },
    { name: 'a value containing regex metacharacters', value: 'a.b*c+d' },
    { name: 'a value that looks like a substitution token', value: '$1$2' },
  ];

  for (const { name, value } of cases) {
    it.each(LOCALES)(`%s redacts ${name}`, (locale) => {
      const description = describeTyping(locale, value, 'Password');
      expect(description).toContain(value);

      const scrubbed = scrubValues(description, typedValues([{ inputValue: value }]));
      expect(scrubbed).not.toContain(value);
      expect(scrubbed).toContain(SCRUB_PLACEHOLDER);
    });
  }
});
