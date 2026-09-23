import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_LIMITS, generationLimits, resolveAiLimits, secondsToMs } from '../limits';

describe('resolveAiLimits', () => {
  it('uses the defaults when nothing is stored', () => {
    expect(resolveAiLimits({})).toEqual(DEFAULT_AI_LIMITS);
  });

  it('has no answer-length cap by default', () => {
    expect(DEFAULT_AI_LIMITS.maxOutputTokens).toBe(0);
  });

  it('keeps stored values and rejects negative or broken ones', () => {
    expect(resolveAiLimits({ aiMaxOutputTokens: 300, aiRequestTimeoutSec: 0, aiStopWaitSec: 12.7 })).toEqual({
      maxOutputTokens: 300,
      requestTimeoutSec: 0,
      stopWaitSec: 12,
    });
    expect(resolveAiLimits({ aiMaxOutputTokens: -5, aiRequestTimeoutSec: 'soon' })).toEqual(DEFAULT_AI_LIMITS);
  });
});

describe('generationLimits', () => {
  it('sends neither a token cap nor an abort signal when both are unlimited', () => {
    expect(generationLimits({ maxOutputTokens: 0, requestTimeoutSec: 0, stopWaitSec: 0 })).toEqual({});
  });

  it('passes the token cap and a timeout signal when set', () => {
    const options = generationLimits({ maxOutputTokens: 120, requestTimeoutSec: 30, stopWaitSec: 0 });
    expect(options.maxOutputTokens).toBe(120);
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
  });
});

describe('secondsToMs', () => {
  it('treats 0 as no limit', () => {
    expect(secondsToMs(0)).toBeUndefined();
    expect(secondsToMs(20)).toBe(20_000);
  });
});
