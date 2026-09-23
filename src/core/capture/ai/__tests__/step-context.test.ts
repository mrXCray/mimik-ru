import { describe, expect, it } from 'vitest';
import type { Step } from '@/core/guides/types';
import { describeStepContext } from '../step-context';

const base: Step = {
  id: 's1',
  guideId: 'g1',
  index: 0,
  description: 'Нажмите кнопку «Save»',
  action: 'click',
  url: 'https://crm.example.com/deals/42?tab=main',
  timestamp: 0,
};

describe('describeStepContext', () => {
  it('sends the page context captured with the step', () => {
    const text = describeStepContext({
      ...base,
      domContext: 'Page: "Deal" /deals/42\n→ Target: button "Save" (click)',
    });
    expect(text).toBe(
      'Action: click\nURL: crm.example.com/deals/42\nPage: "Deal" /deals/42\n→ Target: button "Save" (click)',
    );
  });

  it('keeps the query string out of the URL', () => {
    expect(describeStepContext(base)).not.toContain('tab=main');
  });

  it('falls back to the stored element for steps recorded before page context was kept', () => {
    const text = describeStepContext({
      ...base,
      action: 'input',
      inputValue: 'ООО Ромашка',
      elementMeta: {
        tag: 'input',
        cssSelector: '#company',
        textContent: null,
        ariaLabel: 'Company',
        placeholder: null,
        altText: null,
        name: 'company',
        role: null,
        href: null,
        inputType: 'text',
        dataTestId: null,
        rect: { x: 0, y: 0, width: 1, height: 1 },
        devicePixelRatio: 1,
      },
    });
    expect(text).toContain('→ Target: input[text] "Company"');
    expect(text).toContain('Typed value: "ООО Ромашка"');
  });
});
