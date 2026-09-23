import type { Step } from '@/core/guides/types';
import { cleanAnswer } from './guide-ai';
import type { PromptSettings } from './prompt-settings';
import { getPrePromptPrefix, getStepStyleRules, tidyStepDescription } from './prompts';
import { describeStepContext } from './step-context';

/** Which part of a guide a piece of text is; steps get the built-in step rules. */
export type ProofreadKind = 'title' | 'description' | 'step' | 'note' | 'heading' | 'callout';

const KIND_LABELS: Record<ProofreadKind, string> = {
  title: 'the title of the guide',
  description: 'the short description of the guide',
  step: 'the text of one step',
  note: 'a note shown under the screenshot of one step',
  heading: 'a section heading',
  callout: 'a highlighted note between steps',
};

export const PROOFREAD_PROMPT = `You are proofreading {{kind}} in a step-by-step browser guide.
{{context}}
The text is between the <text> tags:
<text>
{{text}}
</text>

Fix only:
- grammar: agreement, cases and declension, verb forms;
- spelling, punctuation and typography (quotation marks, dashes, spaces, capital letters);
- how on-screen names are formatted: put each one in the quotation marks the rules call for, and spell it exactly as on the screen (see the screen context, when given).

Do not:
- change the meaning, add or remove information, or rephrase text that is already correct;
- translate on-screen names;
- add comments, a preamble, or quotes around the whole answer.

Keep the text in the language it is written in. If it is already correct, return it unchanged.
Return only the corrected text, without the <text> tags.`;

export function buildProofreadPrompt(text: string, kind: ProofreadKind, settings: PromptSettings, step?: Step): string {
  const context = step ? `\nWhat was on the screen when the step was captured:\n${describeStepContext(step)}\n` : '';
  const rules = kind === 'step' && settings.styleGuide ? `\n\n${getStepStyleRules(settings.locale)}` : '';
  return (
    getPrePromptPrefix(settings.prePrompt) +
    PROOFREAD_PROMPT.replace('{{kind}}', KIND_LABELS[kind])
      .replace('{{context}}', () => context)
      .replace('{{text}}', () => text) +
    rules
  );
}

const ECHOED_PROMPT = /Fix only:|Do not:|<\/?text>|Keep the text in the language/i;

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
const lineCount = (text: string) => text.split('\n').filter((line) => line.trim()).length;

/**
 * Whether an answer looks like a correction of the original rather than a rewrite: no echoed
 * prompt, no extra lines, and about the same number of words (grammar fixes rarely add or drop more
 * than a word or two; small models tend to add whole clauses).
 */
export function isPlausibleCorrection(original: string, corrected: string): boolean {
  if (ECHOED_PROMPT.test(corrected)) return false;
  if (lineCount(corrected) > Math.max(1, lineCount(original))) return false;
  const before = wordCount(original);
  const delta = Math.abs(wordCount(corrected) - before);
  if (delta > Math.max(1, Math.round(before * 0.2))) return false;
  return sharedStems(original, corrected) >= 0.6;
}

/** Word stems, roughly: lower case, letters and digits only, cut to 4 characters so endings don't count. */
function stems(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map((word) => word.slice(0, 4));
}

/** Share of the original's word stems still present in the correction (grammar fixes keep nearly all). */
function sharedStems(original: string, corrected: string): number {
  const before = stems(original);
  if (before.length === 0) return 1;
  const after = new Set(stems(corrected));
  return before.filter((stem) => after.has(stem)).length / before.length;
}

/** The model's corrected text, tidied; the original when the answer is empty or not a plausible correction. */
export function cleanProofread(answer: string, original: string, kind: ProofreadKind, styleGuide: boolean): string {
  const cleaned = cleanAnswer(answer);
  if (!cleaned) return original;
  const tidied = kind === 'step' && styleGuide ? tidyStepDescription(cleaned) : cleaned;
  return isPlausibleCorrection(original, tidied) ? tidied : original;
}
