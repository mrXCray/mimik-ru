import type { AIApiKeys } from '@/core/capture/ai/keys';
import type { AIProviderKey } from '@/core/capture/ai/models';
import type { VoiceProvider } from '@/core/capture/voice/transcribe';
import type { BrandLogo } from '@/core/export/branding';
import type { ExportOptions } from '@/core/export/options';
import type { GuideMeSession } from '@/core/guideme/session';
import type { ScreenshotEdits } from '@/core/screenshot/types';

export interface Guide {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  stepIds: string[];
  starred: boolean;
  deletedAt: number | null;
  staging?: boolean;
  /** Profile the guide was recorded with; its AI and export settings apply to this guide. */
  profileId?: string;
}

export type DescriptionSource = 'narration' | 'ai' | 'heuristic' | 'manual';

export type BlockType = 'heading' | 'callout';

export type CalloutVariant = 'info' | 'warning' | 'error' | 'success' | 'custom';

export interface Step {
  id: string;
  guideId: string;
  index: number;
  description: string;
  action: string;
  url: string;
  timestamp: number;
  screenshotId?: string;
  elementMeta?: ElementMeta;
  inputValue?: string;
  descriptionSource?: DescriptionSource;
  aiPending?: boolean;
  blockType?: BlockType;
  calloutVariant?: CalloutVariant;
  calloutColor?: string;
}

export interface ScreenshotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Screenshot {
  id: string;
  stepId: string;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  bounds?: ScreenshotBounds;
  pixelRatio?: number;
  clickPoint?: { x: number; y: number };
  edits?: ScreenshotEdits;
}

export interface Settings {
  aiApiKey: string;
  aiApiKeys: AIApiKeys;
  aiProvider: AIProviderKey;
  aiModel: string;
  aiBaseUrl: string;
  aiLanguage: string;
  aiPrePrompt: string;
  aiMaxOutputTokens: number;
  aiRequestTimeoutSec: number;
  aiStopWaitSec: number;
  voiceEnabled: boolean;
  voiceProvider: VoiceProvider;
  voiceApiKey: string;
  voiceMicrophoneId: string;
  voiceLanguage: string;
  blurPresets: Record<string, boolean>;
  targetColor: string;
  brandLogo: BrandLogo | null;
  brandFooter: string;
  brandAttribution: boolean;
  exportOptions: ExportOptions;
  guideMeSession: GuideMeSession | null;
  guideMeStep: Step | null;
  guideMeBlocked: number | null;
  guideMeManual: boolean;
  mimikBlurMode: boolean;
  onboardingCompleted: boolean;
  profiles: ProfileRecord[];
  activeProfileId: string;
}

export type SettingsKey = keyof Settings;

/** Settings that belong to a profile rather than to the whole extension. */
export const PROFILE_SETTING_KEYS = [
  'aiPrePrompt',
  'aiLanguage',
  'aiMaxOutputTokens',
  'aiRequestTimeoutSec',
  'aiStopWaitSec',
  'aiProvider',
  'aiModel',
  'aiApiKey',
  'aiApiKeys',
  'aiBaseUrl',
  'targetColor',
  'brandLogo',
  'brandFooter',
  'brandAttribution',
  'exportOptions',
] as const satisfies readonly SettingsKey[];

export type ProfileSettingKey = (typeof PROFILE_SETTING_KEYS)[number];

export type ProfileSettings = Partial<Pick<Settings, ProfileSettingKey>>;

export interface ProfileRecord {
  id: string;
  /** Empty for the built-in profile, which shows a localized default name. */
  name: string;
  createdAt: number;
  /** Stored values while the profile is inactive; the active profile's live values sit in the flat settings. */
  settings: ProfileSettings;
}

export interface ElementMeta {
  tag: string;
  cssSelector: string;
  textContent: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
  altText: string | null;
  name: string | null;
  role: string | null;
  href: string | null;
  inputType: string | null;
  dataTestId: string | null;
  rect: { x: number; y: number; width: number; height: number };
  devicePixelRatio: number;
  clickPoint?: { x: number; y: number };
}

export interface Snapshot {
  id: string;
  guideId: string;
  createdAt: number;
  contentHash: string;
  name?: string;
  title: string;
  stepIds: string[];
  steps: Step[];
  screenshots: Omit<Screenshot, 'blob'>[];
}
