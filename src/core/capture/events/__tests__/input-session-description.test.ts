// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/lib/messaging';
import { InputSession } from '../input-session';

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

function field(value: string, label?: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'text';
  el.value = value;
  if (label) el.setAttribute('aria-label', label);
  document.body.appendChild(el);
  return el;
}

async function descriptionFor(el: HTMLInputElement): Promise<string> {
  const session = new InputSession('guide-1');
  await session.start(el);
  vi.mocked(sendMessage).mockClear();
  session.update(el);
  const call = vi.mocked(sendMessage).mock.calls.find(([name]) => name === 'updateInputStep');
  return (call?.[1] as { description: string }).description;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.mocked(sendMessage).mockReset();
  vi.mocked(sendMessage).mockResolvedValue({ stepId: 'step-1' } as never);
});

// The i18n mock echoes keys with their substitutions, so these prove the text goes
// through the locale files instead of a hard-coded English sentence.
describe('typing step description', () => {
  it('is localized with the typed value and the field label', async () => {
    expect(await descriptionFor(field('Acme', 'Company'))).toBe('steps.typeValue[Acme,Company]');
  });

  it('is localized when the field is cleared', async () => {
    expect(await descriptionFor(field('', 'Company'))).toBe('steps.clearField[Company]');
  });

  it('uses the unlabeled wording when the field has no label', async () => {
    expect(await descriptionFor(field('Acme'))).toBe('steps.typeValueUnlabeled[Acme]');
    expect(await descriptionFor(field(''))).toBe('steps.clearFieldUnlabeled');
  });
});
