import { describe, expect, it } from 'vitest';
import { diffWords } from '../text-diff';

const render = (before: string, after: string) =>
  diffWords(before, after)
    .map((p) => (p.kind === 'same' ? p.text : p.kind === 'removed' ? `[-${p.text}-]` : `{+${p.text}+}`))
    .join('');

describe('diffWords', () => {
  it('marks only the words that changed', () => {
    expect(render('Нажмите на кнопка "Сохранить"', 'Нажмите на кнопку «Сохранить»')).toBe(
      'Нажмите на [-кнопка-]{+кнопку+} [-"Сохранить"-]{+«Сохранить»+}',
    );
  });

  it('returns one unchanged part for equal texts', () => {
    expect(diffWords('Откройте меню', 'Откройте меню')).toEqual([{ id: 0, kind: 'same', text: 'Откройте меню' }]);
  });

  it('handles added and removed words at the ends', () => {
    expect(render('Выберите отчёт', 'Выберите отчёт и нажмите «Скачать»')).toBe(
      'Выберите отчёт{+ и нажмите «Скачать»+}',
    );
    expect(render('Сначала откройте меню', 'Откройте меню')).toBe('[-Сначала откройте-]{+Откройте+} меню');
  });

  it('gives every part a distinct id', () => {
    const ids = diffWords('a b c', 'a x c').map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
