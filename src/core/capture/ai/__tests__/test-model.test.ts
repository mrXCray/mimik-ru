import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateTextMock, createModelMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  createModelMock: vi.fn(() => ({ id: 'model' })),
}));

vi.mock('ai', () => ({ generateText: generateTextMock }));
vi.mock('../provider', () => ({ createModel: createModelMock }));

import { samplePrompt, testAiModel } from '../test-model';

const request = {
  provider: 'openai',
  model: 'local',
  apiKey: '',
  baseUrl: 'http://127.0.0.1:8080/v1',
  locale: 'ru',
  prePrompt: 'Acme CRM',
  styleGuide: true,
  maxOutputTokens: 0,
  requestTimeoutSec: 30,
  stopWaitSec: 60,
};

beforeEach(() => {
  generateTextMock.mockReset();
  createModelMock.mockClear();
});

describe('testAiModel', () => {
  it('sends the real step prompt with the project context and language, without retries', async () => {
    generateTextMock.mockResolvedValue({ text: '  Нажмите «Update profile»  ' });

    const result = await testAiModel(request);

    expect(result).toMatchObject({ ok: true, text: 'Нажмите «Update profile»' });
    expect(createModelMock).toHaveBeenCalledWith('openai', 'local', '', 'http://127.0.0.1:8080/v1');
    const options = generateTextMock.mock.calls[0][0];
    expect(options.prompt).toBe(samplePrompt(request));
    expect(options.prompt).toContain('Acme CRM');
    expect(options.prompt).toContain('Russian');
    expect(options.maxRetries).toBe(0);
    expect(options.maxOutputTokens).toBeUndefined();
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('reports a timeout separately from other failures', async () => {
    generateTextMock.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    expect(await testAiModel(request)).toMatchObject({ ok: false, reason: 'timeout' });

    generateTextMock.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8080'));
    expect(await testAiModel(request)).toMatchObject({
      ok: false,
      reason: 'failed',
      message: 'connect ECONNREFUSED 127.0.0.1:8080',
    });
  });
});

describe('testAiModel with the built-in rules', () => {
  it('sends the rules and drops a closing period, but keeps an ellipsis', async () => {
    generateTextMock.mockResolvedValue({ text: 'Нажмите кнопку «Update profile».' });
    const result = await testAiModel(request);
    expect(generateTextMock.mock.calls[0][0].prompt).toContain('Describe exactly one action');
    expect(result).toMatchObject({ ok: true, text: 'Нажмите кнопку «Update profile»' });

    generateTextMock.mockResolvedValue({ text: 'Подождите...' });
    expect(await testAiModel(request)).toMatchObject({ ok: true, text: 'Подождите...' });
  });
});
