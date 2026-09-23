import { generateForGuide } from '@/core/capture/ai/guide-ai';
import { buildProofreadPrompt, cleanProofread, type ProofreadKind } from '@/core/capture/ai/proofread';
import { buildStepNotePrompt, cleanStepNote } from '@/core/capture/ai/step-note';
import { actionSteps, stepNumbers } from '@/core/guides/blocks';
import { db } from '@/core/guides/db';
import { getStepsForGuide } from '@/core/guides/service';
import type { GuideTextResponse } from '@/lib/messaging';

/** Proofreads one piece of a guide with the guide's profile, sending the step's screen context along. */
export async function proofreadGuideText(
  guideId: string,
  text: string,
  kind: ProofreadKind,
  stepId?: string,
): Promise<GuideTextResponse> {
  if (!text.trim()) return { text };
  const step = stepId ? await db.steps.get(stepId) : undefined;
  let styleGuide = true;
  const result = await generateForGuide(
    guideId,
    (settings) => {
      styleGuide = settings.styleGuide;
      return buildProofreadPrompt(text, kind, settings, step?.blockType ? undefined : step);
    },
    'Proofreading',
  );
  if (result.error) return { error: result.error };
  return { text: cleanProofread(result.text, text, kind, styleGuide) };
}

/** Writes the note shown under a step's screenshot, from the step, its screen context and its neighbours. */
export async function generateStepNote(guideId: string, stepId: string): Promise<GuideTextResponse> {
  const steps = await getStepsForGuide(guideId);
  const actions = actionSteps(steps);
  const index = actions.findIndex((step) => step.id === stepId);
  if (index < 0) return { error: 'generation-failed' };
  const step = actions[index];
  const number = stepNumbers(steps).get(step.id) ?? index + 1;

  const result = await generateForGuide(
    guideId,
    (settings) => buildStepNotePrompt(step, number, actions[index - 1], actions[index + 1], settings),
    'Step note',
  );
  if (result.error) return { error: result.error };
  return { text: cleanStepNote(result.text) };
}
