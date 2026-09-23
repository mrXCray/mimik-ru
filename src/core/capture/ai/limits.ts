import { readProfileSettings } from '@/core/profiles/profiles';

/** Per-profile AI limits. 0 means "no limit" for every field. */
export interface AiLimits {
  /** Cap on generated tokens per answer. */
  maxOutputTokens: number;
  /** How long one AI request may take, in seconds. */
  requestTimeoutSec: number;
  /** How long stopping a recording waits for pending step descriptions, in seconds. */
  stopWaitSec: number;
}

export const AI_LIMIT_KEYS = ['aiMaxOutputTokens', 'aiRequestTimeoutSec', 'aiStopWaitSec'] as const;

export const DEFAULT_AI_LIMITS: AiLimits = {
  maxOutputTokens: 0,
  requestTimeoutSec: 120,
  stopWaitSec: 60,
};

const count = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

export function resolveAiLimits(stored: {
  aiMaxOutputTokens?: unknown;
  aiRequestTimeoutSec?: unknown;
  aiStopWaitSec?: unknown;
}): AiLimits {
  return {
    maxOutputTokens: count(stored.aiMaxOutputTokens, DEFAULT_AI_LIMITS.maxOutputTokens),
    requestTimeoutSec: count(stored.aiRequestTimeoutSec, DEFAULT_AI_LIMITS.requestTimeoutSec),
    stopWaitSec: count(stored.aiStopWaitSec, DEFAULT_AI_LIMITS.stopWaitSec),
  };
}

export async function loadAiLimits(profileId?: string): Promise<AiLimits> {
  return resolveAiLimits(await readProfileSettings(profileId, AI_LIMIT_KEYS));
}

/** generateText options for these limits: no token cap or abort signal when unlimited. */
export function generationLimits(limits: AiLimits): { maxOutputTokens?: number; abortSignal?: AbortSignal } {
  return {
    ...(limits.maxOutputTokens > 0 ? { maxOutputTokens: limits.maxOutputTokens } : {}),
    ...(limits.requestTimeoutSec > 0 ? { abortSignal: AbortSignal.timeout(limits.requestTimeoutSec * 1000) } : {}),
  };
}

export const secondsToMs = (seconds: number) => (seconds > 0 ? seconds * 1000 : undefined);
