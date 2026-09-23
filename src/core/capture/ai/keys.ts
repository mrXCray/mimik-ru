import { AI_PROVIDERS, type AIProviderKey, isCustomBaseUrl, isProviderKey, providerOrDefault } from './models';

export type AIApiKeys = Partial<Record<AIProviderKey, string>>;

export function parseApiKeys(value: unknown): AIApiKeys {
  if (typeof value !== 'object' || value === null) return {};
  const keys: AIApiKeys = {};
  for (const [provider, key] of Object.entries(value as Record<string, unknown>)) {
    if (!isProviderKey(provider)) continue;
    const trimmed = typeof key === 'string' ? key.trim() : '';
    if (trimmed) keys[provider] = trimmed;
  }
  return keys;
}

export function migrateApiKeys(stored: { aiApiKeys?: unknown; aiApiKey?: unknown; aiProvider?: unknown }): AIApiKeys {
  const keys = parseApiKeys(stored.aiApiKeys);
  if (Object.keys(keys).length > 0) return keys;

  const legacy = typeof stored.aiApiKey === 'string' ? stored.aiApiKey.trim() : '';
  return legacy ? { [providerOrDefault(stored.aiProvider)]: legacy } : {};
}

export function keyFor(keys: AIApiKeys, provider: AIProviderKey): string {
  return keys[provider] ?? '';
}

export function withKeyFor(keys: AIApiKeys, provider: AIProviderKey, apiKey: string): AIApiKeys {
  const next = { ...keys };
  const trimmed = apiKey.trim();
  if (trimmed) next[provider] = apiKey;
  else delete next[provider];
  return next;
}

export const AI_KEY_SETTINGS = ['aiApiKeys', 'aiApiKey', 'aiProvider', 'aiBaseUrl'] as const;

/** Sent when a self-hosted server needs no key; llama.cpp, Ollama and LM Studio ignore it. */
export const NO_KEY_PLACEHOLDER = 'sk-no-key-required';

export function resolveAiKey(stored: {
  aiApiKeys?: unknown;
  aiApiKey?: unknown;
  aiProvider?: unknown;
  aiBaseUrl?: unknown;
}): {
  provider: AIProviderKey;
  apiKey: string;
  /** AI is on: a key is set, or requests go to the user's own server, which may need none. */
  usable: boolean;
} {
  const provider = providerOrDefault(stored.aiProvider);
  const apiKey = keyFor(migrateApiKeys(stored), provider);
  const ownServer = isCustomBaseUrl(
    AI_PROVIDERS[provider],
    typeof stored.aiBaseUrl === 'string' ? stored.aiBaseUrl : undefined,
  );
  return { provider, apiKey, usable: Boolean(apiKey) || ownServer };
}
