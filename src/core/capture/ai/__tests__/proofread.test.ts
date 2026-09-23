import { describe, expect, it } from 'vitest';
import type { Step } from '@/core/guides/types';
import { buildProofreadPrompt, cleanProofread, isPlausibleCorrection } from '../proofread';
import { buildStepNotePrompt, cleanStepNote } from '../step-note';

const settings = { locale: 'ru', prePrompt: 'CRM «Альфа»', styleGuide: true };

function step(id: string, description: string, extra: Partial<Step> = {}): Step {
  return {
    id,
    guideId: 'g1',
    index: 0,
    description,
    action: 'click',
    url: 'https://crm.example.com/deals',
    timestamp: 0,
    ...extra,
  };
}

describe('buildProofreadPrompt', () => {
  it('sends the text, the project context and the screen context of the step', () => {
    const prompt = buildProofreadPrompt(
      'нажмите на кнопка "Save".',
      'step',
      settings,
      step('s1', 'x', { domContext: '→ Target: button "Save" (click)' }),
    );
    expect(prompt).toContain('нажмите на кнопка "Save".');
    expect(prompt).toContain('CRM «Альфа»');
    expect(prompt).toContain('→ Target: button "Save" (click)');
    expect(prompt).toContain('Describe exactly one action');
    expect(prompt).toContain('Keep the text in the language it is written in');
    expect(prompt).not.toContain('Write the output in');
  });

  it('leaves the step rules out of other kinds of text and when they are off', () => {
    expect(buildProofreadPrompt('Заголовок', 'heading', settings)).not.toContain('Describe exactly one action');
    expect(buildProofreadPrompt('Шаг', 'step', { ...settings, styleGuide: false })).not.toContain(
      'Describe exactly one action',
    );
  });
});

describe('cleanProofread', () => {
  it('tidies step text and keeps the original for an empty answer', () => {
    expect(cleanProofread('Нажмите кнопку «Save».', 'Нажмите кнопка Save', 'step', true)).toBe('Нажмите кнопку «Save»');
    expect(cleanProofread('   ', 'оригинал', 'note', true)).toBe('оригинал');
    expect(cleanProofread('"Проверьте сумму."', 'Проверте сумму', 'note', true)).toBe('Проверьте сумму.');
  });

  it('does not unwrap a single on-screen name in «ёлочки»', () => {
    expect(cleanProofread('«Отчёты»', 'Отчёты', 'heading', true)).toBe('«Отчёты»');
  });
});

describe('step note', () => {
  it('sends the step, its screen context and its neighbours', () => {
    const current = step('s2', 'Нажмите кнопку «Save»', { domContext: '→ Target: button "Save" (click)' });
    const prompt = buildStepNotePrompt(
      current,
      2,
      step('s1', 'Откройте сделку'),
      step('s3', 'Закройте окно'),
      settings,
    );
    expect(prompt).toContain('Step 2: Нажмите кнопку «Save»');
    expect(prompt).toContain('→ Target: button "Save" (click)');
    expect(prompt).toContain('Previous step: Откройте сделку');
    expect(prompt).toContain('Next step: Закройте окно');
    expect(prompt).toContain('Write the output in Russian');
  });

  it('turns the "nothing to add" hyphen into an empty note', () => {
    expect(cleanStepNote(' - ')).toBe('');
    expect(cleanStepNote('Сумма появится в карточке сделки.')).toBe('Сумма появится в карточке сделки.');
  });
});

describe('answers from small models', () => {
  it('strips code fences, triple quotes and empty quote lines', () => {
    expect(
      cleanProofread('```\nНажмите кнопку «Новая сделка».\n```', 'Нажмите на кнопка "новая сделка".', 'step', true),
    ).toBe('Нажмите кнопку «Новая сделка»');
    expect(cleanProofread('"""\nКак завести сделку\n"""', 'Как завести сделку', 'description', true)).toBe(
      'Как завести сделку',
    );
    expect(cleanProofread('""\nоткройте раздел «Сделки»\n""', 'откройте раздел сделки', 'step', true)).toBe(
      'откройте раздел «Сделки»',
    );
  });

  it('keeps the original when the model echoes the prompt', () => {
    const original = 'Как завести новую сделку для контрагента';
    expect(cleanProofread(`${original}\n\nFix only:\n- grammar`, original, 'description', true)).toBe(original);
  });

  it('keeps the original when the model adds a whole clause', () => {
    const original = 'Введите «ООО Ромашка» в поле Контрагент';
    expect(
      cleanProofread('Нажмите кнопку «Контрагент», введите «ООО Ромашка» в поле «Контрагент»', original, 'step', true),
    ).toBe(original);
  });

  it('accepts a grammar fix that keeps the words', () => {
    expect(cleanProofread('Нажмите на кнопку «Новая сделка»', 'Нажмите на кнопка "новая сделка".', 'step', true)).toBe(
      'Нажмите на кнопку «Новая сделка»',
    );
  });
});

describe('cleanStepNote with a small model', () => {
  it('drops echoed context and keeps the actual note', () => {
    const answer =
      'Страница: "Сделки" /deals\nПеремещение: Нажатие на кнопку "Новая сделка".\nURL: crm.example.com/deals\n\nУбедитесь, что открылась форма «Новая сделка».';
    expect(cleanStepNote(answer)).toBe('Убедитесь, что открылась форма «Новая сделка».');
  });

  it('keeps a plain note as is, joining its lines', () => {
    expect(cleanStepNote('Сумма появится в карточке сделки.\nПроверьте валюту.')).toBe(
      'Сумма появится в карточке сделки. Проверьте валюту.',
    );
  });

  it('keeps a note that only has label lines rather than returning nothing', () => {
    expect(cleanStepNote('Важно: сохраните черновик.')).toBe('Важно: сохраните черновик.');
  });
});

describe('isPlausibleCorrection', () => {
  it('accepts fixes of case endings, quotes and capitals', () => {
    expect(isPlausibleCorrection('Нажмите на кнопка "новая сделка".', 'Нажмите на кнопку «Новая сделка»')).toBe(true);
    expect(
      isPlausibleCorrection('Введите  «ООО Ромашка» в поле Контрагент', 'Введите «ООО Ромашка» в поле «Контрагент»'),
    ).toBe(true);
  });

  it('rejects a different sentence with the same number of words', () => {
    expect(
      isPlausibleCorrection(
        'Введите «ООО Ромашка» в поле Контрагент',
        'Нажмите кнопку «Сохранить», чтобы сохранить сделку',
      ),
    ).toBe(false);
    expect(isPlausibleCorrection('откройте раздел сделки', 'Нажмите кнопку «Сделки»')).toBe(false);
  });
});
