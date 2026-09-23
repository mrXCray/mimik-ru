import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { NO_KEY_PLACEHOLDER } from './keys';
import { AI_PROVIDERS, DEFAULT_AI_PROVIDER, findProvider, openAITransport, resolveBaseUrl } from './models';

export function createModel(provider: string, model: string, apiKey: string, baseUrl?: string) {
  const config = findProvider(provider) ?? AI_PROVIDERS[DEFAULT_AI_PROVIDER];
  const baseURL = resolveBaseUrl(config, baseUrl);
  apiKey ||= NO_KEY_PLACEHOLDER;
  if (config.protocol === 'anthropic') return createAnthropic({ apiKey, baseURL })(model);
  const openai = createOpenAI({ apiKey, baseURL, name: provider });
  return openAITransport(config, baseUrl) === 'responses' ? openai(model) : openai.chat(model);
}
