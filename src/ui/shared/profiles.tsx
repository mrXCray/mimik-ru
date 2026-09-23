import { Check, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { browser, i18n } from '#imports';
import {
  createProfile,
  deleteProfile,
  loadProfiles,
  MAX_PROFILE_NAME_LENGTH,
  type ProfilesState,
  profileName,
  renameProfile,
  switchProfile,
} from '@/core/profiles/profiles';
import { logger } from '@/lib/logger';
import { Input } from '@/ui/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select';
import ConfirmDialog from '@/ui/shared/ConfirmDialog';

/** Live list of profiles and the active one, kept in sync across extension pages. */
export function useProfiles(): ProfilesState | null {
  const [state, setState] = useState<ProfilesState | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      loadProfiles()
        .then((next) => alive && setState(next))
        .catch((err) => logger.error('Loading profiles failed', err));
    void refresh();
    const onChanged = (changes: Record<string, unknown>) => {
      if ('profiles' in changes || 'activeProfileId' in changes) void refresh();
    };
    browser.storage.local.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      browser.storage.local.onChanged.removeListener(onChanged);
    };
  }, []);

  return state;
}

interface ProfileSelectProps {
  state: ProfilesState;
  disabled?: boolean;
  /** Runs before the switch, e.g. to save edits that belong to the current profile. */
  beforeSwitch?: () => Promise<void>;
  className?: string;
}

export function ProfileSelect({ state, disabled, beforeSwitch, className }: ProfileSelectProps) {
  const handleChange = async (id: string) => {
    try {
      await beforeSwitch?.();
      await switchProfile(id);
    } catch (err) {
      logger.error('Switching profile failed', err);
    }
  };

  return (
    <Select value={state.activeId} onValueChange={(id) => void handleChange(id)} disabled={disabled}>
      <SelectTrigger className={className ?? 'h-8'} aria-label={i18n.t('profiles.label')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {state.profiles.map((profile) => (
          <SelectItem key={profile.id} value={profile.id}>
            {profileName(profile)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Compact picker shown above "Start capture": the recording uses the chosen profile. */
export function RecordingProfilePicker() {
  const state = useProfiles();
  if (!state) return null;

  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground shrink-0">
        <UserRound size={12} className="text-accent" />
        {i18n.t('profiles.label')}
      </span>
      <ProfileSelect state={state} className="h-7 text-xs flex-1 min-w-0" />
    </div>
  );
}

type Editing = { mode: 'create' } | { mode: 'rename'; id: string };

/** Profile switcher plus create, rename and delete, for the settings page. */
export function ProfileManager({ state, beforeSwitch }: { state: ProfilesState; beforeSwitch: () => Promise<void> }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const active = state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0];

  const startCreate = () => {
    setName('');
    setEditing({ mode: 'create' });
  };

  const startRename = () => {
    setName(active.name);
    setEditing({ mode: 'rename', id: active.id });
  };

  const submit = async () => {
    if (!editing) return;
    try {
      if (editing.mode === 'create') {
        if (!name.trim()) return;
        await beforeSwitch();
        await createProfile(name);
      } else {
        await renameProfile(editing.id, name);
      }
      setEditing(null);
    } catch (err) {
      logger.error('Saving profile failed', err);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    try {
      await beforeSwitch();
      await deleteProfile(active.id);
    } catch (err) {
      logger.error('Deleting profile failed', err);
    }
  };

  const iconButton =
    'w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:pointer-events-none';

  return (
    <div className="border border-border rounded-[10px] p-3.5 space-y-2.5">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
          <UserRound size={14} className="text-accent" />
        </div>
        <span className="text-xs font-bold text-foreground">{i18n.t('profiles.label')}</span>
      </div>

      {editing ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={MAX_PROFILE_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
            placeholder={
              editing.mode === 'rename' && !active.name ? profileName(active) : i18n.t('profiles.namePlaceholder')
            }
            aria-label={i18n.t('profiles.namePlaceholder')}
            className="h-8 text-[13px] rounded-lg border-border"
          />
          <button
            type="submit"
            className={iconButton}
            disabled={editing.mode === 'create' && !name.trim()}
            aria-label={editing.mode === 'create' ? i18n.t('profiles.create') : i18n.t('common.save')}
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={() => setEditing(null)}
            aria-label={i18n.t('common.cancel')}
          >
            <X size={15} />
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-1">
          <ProfileSelect state={state} beforeSwitch={beforeSwitch} className="h-8 flex-1 min-w-0" />
          <button type="button" className={iconButton} onClick={startRename} aria-label={i18n.t('profiles.rename')}>
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={() => setConfirmDelete(true)}
            disabled={state.profiles.length <= 1}
            aria-label={i18n.t('profiles.delete')}
          >
            <Trash2 size={14} />
          </button>
          <button type="button" className={iconButton} onClick={startCreate} aria-label={i18n.t('profiles.new')}>
            <Plus size={15} />
          </button>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground leading-relaxed">{i18n.t('profiles.hint')}</p>

      <ConfirmDialog
        open={confirmDelete}
        heading={i18n.t('profiles.deleteTitle', [profileName(active)])}
        description={i18n.t('profiles.deleteMessage')}
        confirmLabel={i18n.t('profiles.delete')}
        destructive
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
