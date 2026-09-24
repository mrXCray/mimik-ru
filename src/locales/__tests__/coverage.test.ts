import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function localeEntries(path: string): Map<string, string> {
  const entries = new Map<string, string>();
  let section = '';

  for (const line of readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    const top = /^([\w-]+):/.exec(line);
    if (top) {
      section = top[1];
      continue;
    }

    const nested = /^ {2}([\w-]+):\s*(.*)$/.exec(line);
    if (nested && section) entries.set(`${section}.${nested[1]}`, nested[2]);
  }

  return entries;
}

const placeholders = (value: string) => (value.match(/\$\d/g) ?? []).sort();

const english = localeEntries('src/locales/en.yml');

describe.each(['zh-CN', 'ru', 'pl', 'sr'])('%s locale coverage', (locale) => {
  const entries = localeEntries(`src/locales/${locale}.yml`);

  it('matches the English message keys', () => {
    expect([...entries.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it('keeps the same $1/$2 placeholders as English', () => {
    const mismatched = [...english].filter(
      ([key, value]) => entries.has(key) && placeholders(entries.get(key) ?? '').join() !== placeholders(value).join(),
    );
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });
});
