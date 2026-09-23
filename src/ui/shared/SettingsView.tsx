import {
  ArrowLeft,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  EyeOff,
  FileText,
  FlaskConical,
  Gauge,
  Globe,
  ImageIcon,
  ListChecks,
  Mic,
  Shield,
  Sparkles,
  Star,
  Target,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { i18n } from '#imports';
import { PRESET_LABELS, type PresetKey } from '@/core/blur/regexes';
import { type AIApiKeys, keyFor, migrateApiKeys, withKeyFor } from '@/core/capture/ai/keys';
import { AI_LIMIT_KEYS, DEFAULT_AI_LIMITS, resolveAiLimits } from '@/core/capture/ai/limits';
import {
  AI_PROVIDERS,
  type AIProviderKey,
  CUSTOM_MODEL_VALUE,
  DEFAULT_AI_PROVIDER,
  isCustomBaseUrl,
  isCustomModel,
  providerOrDefault,
} from '@/core/capture/ai/models';
import { uiLocale } from '@/core/capture/ai/prompt-settings';
import { AI_LANGUAGES, type AILanguageCode, defaultAiLanguage, MAX_PRE_PROMPT_CHARS } from '@/core/capture/ai/prompts';
import { resolveVoiceApiKey } from '@/core/capture/voice/api-key';
import type { VoiceProvider } from '@/core/capture/voice/transcribe';
import { type BrandLogo, defaultFooterLine, makeBrandLogo } from '@/core/export/branding';
import { PROFILE_SETTING_KEYS, type ProfileSettings } from '@/core/guides/types';
import { type ProfilesState, writeProfileSettings } from '@/core/profiles/profiles';
import { DEFAULT_TARGET_COLOR, TARGET_COLORS } from '@/core/screenshot/types';
import { localStorage } from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select';
import { AiTestNote, useAiTest } from '@/ui/shared/ai-test';
import ColorPicker from '@/ui/shared/ColorPicker';
import { KeyStatusNote, KeyWarningNote, ModelList, SecretInput, useKeyCheck } from '@/ui/shared/key-check';
import MicrophonePicker from '@/ui/shared/MicrophonePicker';
import { ProfileManager, useProfiles } from '@/ui/shared/profiles';
import { changedSettings, type SettingsSnapshot } from '@/ui/shared/settings-autosave';

interface SettingsViewProps {
  onBack?: () => void;
}

const SAVE_DEBOUNCE_MS = 400;
const SAVED_BADGE_MS = 1600;

const FOOTER_PRESETS = () => [
  defaultFooterLine(),
  i18n.t('settings.footerPresetConfidential'),
  i18n.t('settings.footerPresetNoDistribute'),
];

function LimitInput({ label, value, onChange }: { label: string; value: number; onChange: (next: number) => void }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] text-muted-foreground leading-tight mb-0.5 min-h-[2.5em]">{label}</span>
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const next = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(next) && next > 0 ? next : 0);
        }}
        className="h-8 text-[13px] rounded-lg border-border tabular-nums"
      />
    </label>
  );
}

export default function SettingsView(props: SettingsViewProps) {
  const profiles = useProfiles();
  if (!profiles) return null;
  // Remount per profile so every field reloads from the newly active profile.
  return <SettingsBody key={profiles.activeId} {...props} profiles={profiles} />;
}

function SettingsBody({ onBack, profiles }: SettingsViewProps & { profiles: ProfilesState }) {
  const profileId = profiles.activeId;
  const [provider, setProvider] = useState<AIProviderKey>('openai');
  const [model, setModel] = useState(AI_PROVIDERS.openai.defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [apiKeys, setApiKeys] = useState<AIApiKeys>({});
  const [baseUrl, setBaseUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const aiKeyCheck = useKeyCheck();
  const voiceKeyCheck = useKeyCheck();
  const [customModel, setCustomModel] = useState(false);
  const [ownServer, setOwnServer] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const savedSnapshot = useRef<SettingsSnapshot | null>(null);
  const pending = useRef<SettingsSnapshot>({});
  const saveTimer = useRef<number | undefined>(undefined);
  const [aiLanguage, setAiLanguage] = useState<AILanguageCode>(() => defaultAiLanguage(uiLocale()));
  const [aiPrePrompt, setAiPrePrompt] = useState('');
  const [aiStyleGuide, setAiStyleGuide] = useState(true);
  const [showStyleRules, setShowStyleRules] = useState(false);
  const [aiMaxOutputTokens, setAiMaxOutputTokens] = useState(DEFAULT_AI_LIMITS.maxOutputTokens);
  const [aiRequestTimeoutSec, setAiRequestTimeoutSec] = useState(DEFAULT_AI_LIMITS.requestTimeoutSec);
  const [aiStopWaitSec, setAiStopWaitSec] = useState(DEFAULT_AI_LIMITS.stopWaitSec);
  const aiTest = useAiTest();
  const prePromptInputRef = useRef<HTMLInputElement>(null);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('openai');
  const [voiceApiKey, setVoiceApiKey] = useState('');
  const [voiceMicrophoneId, setVoiceMicrophoneId] = useState('');
  const [targetColor, setTargetColor] = useState<string>(DEFAULT_TARGET_COLOR);
  const [brandLogo, setBrandLogo] = useState<BrandLogo | null>(null);
  const [brandFooter, setBrandFooter] = useState('');
  const [brandAttribution, setBrandAttribution] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [blurPresets, setBlurPresets] = useState<Record<PresetKey, boolean>>({
    email: true,
    phone: true,
    ssn: false,
    creditCard: false,
    ipAddress: false,
    macAddress: false,
  });

  useEffect(() => {
    localStorage
      .get([
        'aiApiKey',
        'aiApiKeys',
        'aiProvider',
        'aiModel',
        'aiBaseUrl',
        'aiLanguage',
        'aiPrePrompt',
        'aiStyleGuide',
        ...AI_LIMIT_KEYS,
        'blurPresets',
        'voiceProvider',
        'voiceApiKey',
        'voiceMicrophoneId',
        'targetColor',
        'brandLogo',
        'brandFooter',
        'brandAttribution',
      ])
      .then((result) => {
        const p = providerOrDefault(result.aiProvider);
        setProvider(p);
        setModel((result.aiModel as string) || AI_PROVIDERS[p].defaultModel);
        const keys = migrateApiKeys(result);
        setApiKeys(keys);
        setApiKey(keyFor(keys, p));
        if (isCustomBaseUrl(AI_PROVIDERS[p], result.aiBaseUrl as string)) {
          setBaseUrl(result.aiBaseUrl as string);
          setOwnServer(true);
        }
        if (result.aiLanguage) setAiLanguage(result.aiLanguage as AILanguageCode);
        if (typeof result.aiPrePrompt === 'string') setAiPrePrompt(result.aiPrePrompt);
        setAiStyleGuide(result.aiStyleGuide !== false);
        const limits = resolveAiLimits(result);
        setAiMaxOutputTokens(limits.maxOutputTokens);
        setAiRequestTimeoutSec(limits.requestTimeoutSec);
        setAiStopWaitSec(limits.stopWaitSec);
        if (result.blurPresets) setBlurPresets(result.blurPresets as Record<PresetKey, boolean>);
        setVoiceProvider((result.voiceProvider as VoiceProvider) || 'openai');
        if (result.voiceApiKey) setVoiceApiKey(result.voiceApiKey as string);
        if (result.voiceMicrophoneId) setVoiceMicrophoneId(result.voiceMicrophoneId as string);
        if (result.targetColor) setTargetColor(result.targetColor as string);
        if (result.brandLogo) setBrandLogo(result.brandLogo as BrandLogo);
        setBrandFooter(typeof result.brandFooter === 'string' ? result.brandFooter : defaultFooterLine());
        if (result.brandAttribution === false) setBrandAttribution(false);
        setLoaded(true);
      });
  }, []);

  const stored = {
    aiApiKey: apiKey,
    aiApiKeys: apiKeys,
    aiProvider: provider,
    aiModel: model,
    aiBaseUrl: baseUrl,
    aiLanguage,
    aiPrePrompt,
    aiStyleGuide,
    aiMaxOutputTokens,
    aiRequestTimeoutSec,
    aiStopWaitSec,
    blurPresets,
    voiceProvider,
    voiceApiKey,
    voiceMicrophoneId,
    targetColor,
    brandLogo,
    brandFooter,
    brandAttribution,
  };

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    try {
      const profilePatch: Record<string, unknown> = {};
      const globalPatch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(patch)) {
        if ((PROFILE_SETTING_KEYS as readonly string[]).includes(key)) profilePatch[key] = value;
        else globalPatch[key] = value;
      }
      // Edits land in the profile they were made in, even if another profile became active meanwhile.
      if (Object.keys(profilePatch).length) await writeProfileSettings(profileId, profilePatch as ProfileSettings);
      if (Object.keys(globalPatch).length) await localStorage.set(globalPatch);
      setSaved(true);
    } catch (err) {
      logger.error('Settings autosave failed', err);
      setSaved(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (!loaded) return;
    const snapshot = savedSnapshot.current;
    if (!snapshot) {
      savedSnapshot.current = stored;
      return;
    }

    const patch = changedSettings(stored, snapshot);
    if (!patch) return;

    savedSnapshot.current = stored;
    Object.assign(pending.current, patch);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  });

  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      void flush();
    },
    [flush],
  );

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), SAVED_BADGE_MS);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const handlePrePromptFile = async (file: File | undefined) => {
    if (!file) return;
    setAiPrePrompt((await file.text()).slice(0, MAX_PRE_PROMPT_CHARS));
  };

  const handleLogoPick = async (file: File | undefined) => {
    if (!file) return;
    setBrandLogo(await makeBrandLogo(file));
  };

  const handleProviderChange = (newProvider: AIProviderKey) => {
    setProvider(newProvider);
    setApiKey(keyFor(apiKeys, newProvider));
    aiKeyCheck.reset();
    setCustomModel(false);
    setModel(AI_PROVIDERS[newProvider].defaultModel);
    setOwnServer(false);
    setBaseUrl('');
  };

  const handleOwnServerToggle = () => {
    setOwnServer((on) => {
      if (on) setBaseUrl('');
      return !on;
    });
    aiKeyCheck.reset();
  };

  const handleModelChange = (value: string) => {
    if (value === CUSTOM_MODEL_VALUE) {
      setCustomModel(true);
      setModel('');
      aiKeyCheck.reset();
      return;
    }
    setCustomModel(false);
    setModel(value);
    aiKeyCheck.reset();
  };

  const providerConfig = AI_PROVIDERS[provider] ?? AI_PROVIDERS[DEFAULT_AI_PROVIDER];
  const usingCustomModel = customModel || isCustomModel(model, providerConfig);
  const voiceKey = resolveVoiceApiKey({ voiceProvider, voiceApiKey, aiProvider: provider, aiApiKey: apiKey });

  const BLUR_PRESET_I18N: Record<PresetKey, string> = {
    email: 'blurPresets.email',
    phone: 'blurPresets.phoneNumbers',
    ssn: 'blurPresets.ssn',
    creditCard: 'blurPresets.creditCard',
    ipAddress: 'blurPresets.ipAddress',
    macAddress: 'blurPresets.macAddress',
  };

  return (
    <div className="bg-card flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {onBack && (
          <button
            onClick={onBack}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <h1 className="text-[15px] font-bold text-foreground">{i18n.t('settings.title')}</h1>
        <span
          aria-live="polite"
          className={`ml-auto flex items-center gap-1 text-[11px] font-semibold transition-opacity duration-300 ${
            saved ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ color: 'var(--color-success)' }}
        >
          <Check size={12} />
          {i18n.t('settings.saved')}
        </span>
      </div>

      <div className="flex-1 px-3 py-4 space-y-3">
        <ProfileManager state={profiles} beforeSwitch={flush} />

        <div className="border border-border rounded-[10px] p-3.5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <Sparkles size={14} className="text-accent" />
            </div>
            <span className="text-xs font-bold text-foreground">{i18n.t('settings.aiDescriptions')}</span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              {i18n.t('settings.provider')}
            </label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as AIProviderKey)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AI_PROVIDERS).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.model')}</label>
            <Select value={usingCustomModel ? CUSTOM_MODEL_VALUE : model} onValueChange={handleModelChange}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerConfig.models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id === CUSTOM_MODEL_VALUE ? i18n.t('settings.modelCustom') : m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {usingCustomModel && (
              <Input
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  aiKeyCheck.reset();
                }}
                placeholder={providerConfig.defaultModel}
                aria-label={i18n.t('settings.modelCustom')}
                className="mt-1.5 h-8 text-[13px] rounded-lg border-border"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.apiKey')}</label>
            <div className="flex items-center gap-1.5">
              <SecretInput
                value={apiKey}
                onChange={(next) => {
                  setApiKey(next);
                  setApiKeys((prev) => withKeyFor(prev, provider, next));
                  aiKeyCheck.reset();
                }}
                placeholder={ownServer ? i18n.t('settings.apiKeyOptional') : 'sk-...'}
                className="h-8 text-[13px] rounded-lg border-border"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={(!apiKey && !ownServer) || aiKeyCheck.status === 'checking'}
                onClick={() => {
                  if (aiKeyCheck.status !== 'checking')
                    void aiKeyCheck.check(provider, apiKey, baseUrl, model, aiRequestTimeoutSec);
                }}
                className="h-8 shrink-0 rounded-lg bg-card text-[11px] font-semibold"
              >
                {i18n.t('settings.checkKey')}
              </Button>
            </div>
            <KeyStatusNote status={aiKeyCheck.status} />
            <KeyWarningNote warning={aiKeyCheck.warning} />
            {aiKeyCheck.models && <ModelList models={aiKeyCheck.models} />}
            {!apiKey.trim() && !ownServer && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-destructive leading-relaxed" role="alert">
                <TriangleAlert size={11} className="shrink-0 mt-0.5" />
                <span>{i18n.t('settings.aiNoKey')}</span>
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 py-0.5">
              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                <Globe size={11} className="-mt-px" />
                {i18n.t('settings.useOwnServer')}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={ownServer}
                aria-label={i18n.t('settings.useOwnServer')}
                onClick={handleOwnServerToggle}
                className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                  ownServer ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    ownServer ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {ownServer && (
              <div className="mt-2 space-y-1.5">
                <Input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value);
                    aiKeyCheck.reset();
                    aiTest.reset();
                  }}
                  placeholder={providerConfig.defaultBaseUrl}
                  aria-label={i18n.t('settings.baseUrl')}
                  className="h-8 text-[13px] rounded-lg border-border"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {i18n.t(
                    providerConfig.protocol === 'anthropic'
                      ? 'settings.ownServerHintAnthropic'
                      : 'settings.ownServerHintOpenai',
                  )}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!baseUrl.trim() || !model.trim() || aiTest.state.status === 'running'}
                    onClick={() =>
                      void aiTest.run({
                        provider,
                        model,
                        apiKey,
                        baseUrl,
                        locale: aiLanguage,
                        prePrompt: aiPrePrompt,
                        styleGuide: aiStyleGuide,
                        maxOutputTokens: aiMaxOutputTokens,
                        requestTimeoutSec: aiRequestTimeoutSec,
                        stopWaitSec: aiStopWaitSec,
                      })
                    }
                    className="h-7 shrink-0 rounded-lg bg-card text-[11px] font-semibold"
                  >
                    <FlaskConical size={12} />
                    {i18n.t('settings.testModel')}
                  </Button>
                  <span className="text-[10px] text-muted-foreground leading-snug">{i18n.t('settings.testHint')}</span>
                </div>
                <AiTestNote state={aiTest.state} timeoutSec={aiRequestTimeoutSec} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              <Globe size={11} className="inline mr-1 -mt-px" />
              {i18n.t('settings.aiLanguage')}
            </label>
            <Select value={aiLanguage} onValueChange={(v) => setAiLanguage(v as AILanguageCode)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="ai-pre-prompt" className="text-[11px] font-semibold text-foreground">
                <FileText size={11} className="inline mr-1 -mt-px" />
                {i18n.t('settings.prePrompt')}
              </label>
              <div className="flex items-center gap-1">
                <input
                  ref={prePromptInputRef}
                  type="file"
                  accept=".md,.markdown,.txt,text/markdown,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    void handlePrePromptFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => prePromptInputRef.current?.click()}
                  className="border border-border rounded-md px-2 py-0.5 text-[10px] font-medium text-foreground hover:border-accent transition-colors"
                >
                  {i18n.t('settings.prePromptLoad')}
                </button>
                {aiPrePrompt && (
                  <button
                    type="button"
                    onClick={() => setAiPrePrompt('')}
                    aria-label={i18n.t('settings.prePromptClear')}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <textarea
              id="ai-pre-prompt"
              value={aiPrePrompt}
              onChange={(e) => setAiPrePrompt(e.target.value.slice(0, MAX_PRE_PROMPT_CHARS))}
              placeholder={i18n.t('settings.prePromptPlaceholder')}
              rows={5}
              className="w-full resize-y rounded-lg border border-border bg-transparent px-2.5 py-2 text-[12px] leading-relaxed font-mono text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-accent"
            />
            <p className="mt-1 flex justify-between gap-2 text-[10px] text-muted-foreground leading-relaxed">
              <span>{i18n.t('settings.prePromptHint')}</span>
              <span className="tabular-nums shrink-0">
                {aiPrePrompt.length.toLocaleString()} / {MAX_PRE_PROMPT_CHARS.toLocaleString()}
              </span>
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 py-0.5">
              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                <ListChecks size={11} className="-mt-px" />
                {i18n.t('settings.styleGuide')}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={aiStyleGuide}
                aria-label={i18n.t('settings.styleGuide')}
                onClick={() => setAiStyleGuide((on) => !on)}
                className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                  aiStyleGuide ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    aiStyleGuide ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">
              {i18n.t('settings.styleGuideHint')}{' '}
              <button
                type="button"
                onClick={() => setShowStyleRules((open) => !open)}
                aria-expanded={showStyleRules}
                className="text-accent hover:underline"
              >
                {i18n.t(showStyleRules ? 'settings.styleGuideHide' : 'settings.styleGuideShow')}
              </button>
            </p>
            {showStyleRules && (
              <ul className="mt-1.5 space-y-1 rounded-lg border border-border bg-secondary px-3 py-2 text-[11px] text-foreground leading-relaxed list-disc list-inside">
                {i18n
                  .t('settings.styleGuideRules')
                  .split('\n')
                  .filter(Boolean)
                  .map((rule: string) => (
                    <li key={rule}>{rule}</li>
                  ))}
              </ul>
            )}
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-foreground mb-1">
              <Gauge size={11} className="inline mr-1 -mt-px" />
              {i18n.t('settings.limits')}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <LimitInput
                label={i18n.t('settings.maxOutputTokens')}
                value={aiMaxOutputTokens}
                onChange={setAiMaxOutputTokens}
              />
              <LimitInput
                label={i18n.t('settings.requestTimeout')}
                value={aiRequestTimeoutSec}
                onChange={setAiRequestTimeoutSec}
              />
              <LimitInput label={i18n.t('settings.stopWait')} value={aiStopWaitSec} onChange={setAiStopWaitSec} />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{i18n.t('settings.limitsHint')}</p>
          </div>
        </div>

        <div className="border border-border rounded-[10px] p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Target size={14} className="text-accent" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">{i18n.t('settings.targetColor')}</div>
              <div className="text-[11px] text-muted-foreground">{i18n.t('settings.targetColorHint')}</div>
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 shrink-0 border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground hover:border-accent"
              >
                <span
                  className="w-[22px] h-[22px] rounded-full border border-foreground/15"
                  style={{ backgroundColor: targetColor }}
                />
                <code className="tabular-nums">{targetColor.toUpperCase()}</code>
                <ChevronDown size={12} className="opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2.5">
              <ColorPicker value={targetColor} presets={TARGET_COLORS} onChange={setTargetColor} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="border border-border rounded-[10px] p-3.5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <ImageIcon size={14} className="text-accent" />
            </div>
            <span className="text-xs font-bold text-foreground">{i18n.t('settings.branding')}</span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              {i18n.t('settings.brandLogo')}
            </label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => handleLogoPick(e.target.files?.[0])}
            />
            <div className="flex items-center gap-2.5">
              {brandLogo && (
                <img
                  src={brandLogo.dataUrl}
                  alt=""
                  className="h-9 max-w-[92px] object-contain rounded border border-border bg-secondary p-1"
                />
              )}
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="border border-border rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:border-accent transition-colors"
              >
                {brandLogo ? i18n.t('settings.replaceLogo') : i18n.t('settings.uploadLogo')}
              </button>
              {brandLogo && (
                <button
                  onClick={() => setBrandLogo(null)}
                  aria-label={i18n.t('settings.removeLogo')}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              {i18n.t('settings.footerLine')}
            </label>
            <Input
              value={brandFooter}
              onChange={(e) => setBrandFooter(e.target.value)}
              placeholder={i18n.t('settings.footerLinePlaceholder')}
              className="h-8 text-[13px] rounded-lg border-border"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {FOOTER_PRESETS().map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBrandFooter(preset)}
                  className={`px-2 py-1 rounded-md border text-[10px] transition-colors ${
                    brandFooter === preset
                      ? 'border-accent text-accent'
                      : 'border-border text-muted-foreground hover:border-accent hover:text-foreground'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-[11px] font-semibold text-foreground">{i18n.t('settings.attribution')}</div>
            <button
              onClick={() => setBrandAttribution((prev) => !prev)}
              className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                brandAttribution ? 'bg-accent' : 'bg-border'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  brandAttribution ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="border border-border rounded-[10px] p-3.5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <Mic size={14} className="text-accent" />
            </div>
            <span className="text-xs font-bold text-foreground">{i18n.t('settings.voiceNarration')}</span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              {i18n.t('settings.provider')}
            </label>
            <Select
              value={voiceProvider}
              onValueChange={(v) => {
                setVoiceProvider(v as VoiceProvider);
                voiceKeyCheck.reset();
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.apiKey')}</label>
            <div className="flex items-center gap-1.5">
              <SecretInput
                value={voiceApiKey}
                onChange={(next) => {
                  setVoiceApiKey(next);
                  voiceKeyCheck.reset();
                }}
                placeholder={voiceProvider === 'groq' ? 'gsk_...' : 'sk-...'}
                className="h-8 text-[13px] rounded-lg border-border"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!voiceApiKey || voiceKeyCheck.status === 'checking'}
                onClick={() => void voiceKeyCheck.check(voiceProvider, voiceApiKey)}
                className="h-8 shrink-0 rounded-lg bg-card text-[11px] font-semibold"
              >
                {i18n.t('settings.checkKey')}
              </Button>
            </div>
            <KeyStatusNote status={voiceKeyCheck.status} />
            {voiceKeyCheck.models && <ModelList models={voiceKeyCheck.models} />}
            {voiceKey.source === 'ai' && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
                <Sparkles size={11} className="shrink-0 mt-0.5 text-accent" />
                <span>{i18n.t('settings.voiceUsingAiKey')}</span>
              </p>
            )}
            {voiceKey.source === 'none' && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-destructive leading-relaxed" role="alert">
                <TriangleAlert size={11} className="shrink-0 mt-0.5" />
                <span>{i18n.t('settings.voiceNoKey')}</span>
              </p>
            )}
          </div>

          {import.meta.env.BROWSER !== 'firefox' && (
            <MicrophonePicker value={voiceMicrophoneId} onChange={setVoiceMicrophoneId} triggerClassName="h-8" />
          )}
        </div>

        <div className="border border-border rounded-[10px] p-3.5 space-y-1">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <EyeOff size={14} className="text-accent" />
            </div>
            <span className="text-xs font-bold text-foreground">{i18n.t('settings.smartBlur')}</span>
          </div>

          {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key, i, arr) => (
            <div
              key={key}
              className={`flex items-center justify-between py-2 ${i < arr.length - 1 ? 'border-b border-secondary' : ''}`}
            >
              <span className="text-[11px] font-semibold text-foreground">{i18n.t(BLUR_PRESET_I18N[key])}</span>
              <button
                onClick={() =>
                  setBlurPresets((prev) => {
                    const next = { ...prev, [key]: !prev[key] };
                    localStorage.set({ blurPresets: next });
                    return next;
                  })
                }
                className={`w-9 h-5 rounded-full transition-colors relative ${
                  blurPresets[key] ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    blurPresets[key] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-secondary text-[10px] text-muted-foreground leading-relaxed">
          <Shield size={12} className="shrink-0 mt-0.5 text-accent" />
          <span>{i18n.t('settings.privacyNotice')}</span>
        </div>

        <a
          href="https://github.com/westpoint-io/mimik/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-accent transition-colors"
        >
          <Bug size={13} className="shrink-0" />
          <span>{i18n.t('settings.bugReport')}</span>
        </a>

        <div className="flex items-center gap-3.5 border border-border rounded-[10px] p-3.5">
          <svg width="44" height="44" viewBox="20 55 160 108" className="shrink-0">
            <rect x="30" y="95" width="140" height="68" rx="8" fill="#1E1B4B" />
            <path d="M30 95 L30 80 Q30 58, 100 58 Q170 58, 170 80 L170 95 Z" fill="#3730A3" />
            <rect x="30" y="93" width="140" height="3" fill="#C7D2FE" />
            <path d="M68 122 Q76 112 84 122" stroke="#C7D2FE" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M116 122 Q124 112 132 122" stroke="#C7D2FE" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M84 138 Q100 148 116 138" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground mb-0.5">{i18n.t('settings.starCtaTitle')}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
              {i18n.t('settings.starCtaMessage')}
            </p>
            <a
              href="https://github.com/westpoint-io/mimik"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-[10px] font-semibold text-accent hover:bg-accent hover:text-white transition-colors"
            >
              <Star size={11} fill="#FBBF24" className="text-[#FBBF24]" />
              {i18n.t('settings.starOnGithub')}
              <ChevronRight size={11} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
