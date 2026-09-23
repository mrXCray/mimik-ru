import type { Step } from '@/core/guides/types';
import { cleanAnswer } from './guide-ai';
import { applyPromptSettings, type PromptSettings } from './prompt-settings';
import { describeStepContext } from './step-context';

export const STEP_NOTE_PROMPT = `You are writing a short note shown under the screenshot of one step in a step-by-step browser guide.

Step {{number}}: {{step}}

What was on the screen when the step was captured:
{{context}}

Previous step: {{previous}}
Next step: {{next}}

Write one or two short sentences, at most 30 words in total, that help the reader with this step: what they should see after it, what to check before moving on, or a caution.
- Start directly with that information. Do not restate the action, and do not mention the step number, the URL or the screenshot.
- Do not invent features, values or results that the steps and the screen context do not show.
- Name on-screen elements exactly as in the context, in quotation marks.
If there is nothing useful to add, reply with a single hyphen: -
Return only the note.`;

/** Marker the model returns when it has nothing worth adding. */
const NOTHING = /^[-–—]$/;

export function buildStepNotePrompt(
  step: Step,
  number: number,
  previous: Step | undefined,
  next: Step | undefined,
  settings: PromptSettings,
): string {
  return applyPromptSettings(
    STEP_NOTE_PROMPT.replace('{{number}}', String(number))
      .replace('{{step}}', () => step.description)
      .replace('{{context}}', () => describeStepContext(step))
      .replace('{{previous}}', () => previous?.description || 'none (this is the first step)')
      .replace('{{next}}', () => next?.description || 'none (this is the last step)'),
    settings,
  );
}

/** A "Label: value" line, as in the screen context a small model sometimes echoes back. */
const LABEL_LINE = /^\s*(?:→|[\p{L}][\p{L}\s.]{0,24}:\s)/u;

/**
 * The note text, or '' when the model said there is nothing to add. Echoed context lines
 * ("Page: …", "URL: …", "→ Target: …") are dropped, and of several paragraphs only the last is kept,
 * which is where models put the actual note after restating the input.
 */
export function cleanStepNote(answer: string): string {
  const cleaned = cleanAnswer(answer);
  if (NOTHING.test(cleaned)) return '';
  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const last = paragraphs[paragraphs.length - 1] ?? '';
  const lines = last
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const prose = lines.filter((line) => !LABEL_LINE.test(line));
  const note = (prose.length ? prose : lines).join(' ').trim();
  return NOTHING.test(note) ? '' : note;
}
