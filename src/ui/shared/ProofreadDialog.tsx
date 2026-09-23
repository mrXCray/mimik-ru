import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { i18n } from '#imports';
import type { ProofreadKind } from '@/core/capture/ai/proofread';
import { stepNumbers } from '@/core/guides/blocks';
import {
  createSnapshot,
  updateGuideDescription,
  updateGuideTitle,
  updateStepDescription,
  updateStepNote,
} from '@/core/guides/service';
import type { Guide, Step } from '@/core/guides/types';
import { logger } from '@/lib/logger';
import { sendMessage } from '@/lib/messaging';
import { Button } from '@/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog';
import { rewriteErrorMessage } from '@/ui/shared/rewrite-error';
import { diffWords } from '@/ui/shared/text-diff';

interface ProofreadItem {
  key: string;
  kind: ProofreadKind;
  label: string;
  text: string;
  stepId?: string;
  field: 'title' | 'description' | 'step' | 'note';
}

interface ProofreadChange extends ProofreadItem {
  after: string;
}

/** Every piece of text in the guide, in reading order. */
export function proofreadItems(guide: Guide, steps: Step[]): ProofreadItem[] {
  const numbers = stepNumbers(steps);
  const items: ProofreadItem[] = [
    { key: 'title', kind: 'title', field: 'title', label: i18n.t('proofread.itemTitle'), text: guide.title },
  ];
  if (guide.description?.trim()) {
    items.push({
      key: 'description',
      kind: 'description',
      field: 'description',
      label: i18n.t('proofread.itemDescription'),
      text: guide.description,
    });
  }
  for (const step of steps) {
    if (!step.description.trim()) continue;
    if (step.blockType) {
      items.push({
        key: step.id,
        kind: step.blockType === 'heading' ? 'heading' : 'callout',
        field: 'step',
        stepId: step.id,
        label: i18n.t(step.blockType === 'heading' ? 'blocks.heading' : 'blocks.callout'),
        text: step.description,
      });
      continue;
    }
    const number = String(numbers.get(step.id) ?? 0);
    items.push({
      key: step.id,
      kind: 'step',
      field: 'step',
      stepId: step.id,
      label: i18n.t('export.stepLabel', [number]),
      text: step.description,
    });
    if (step.note?.trim()) {
      items.push({
        key: `${step.id}:note`,
        kind: 'note',
        field: 'note',
        stepId: step.id,
        label: i18n.t('proofread.itemNote', [number]),
        text: step.note,
      });
    }
  }
  return items;
}

interface ProofreadDialogProps {
  open: boolean;
  guide: Guide;
  steps: Step[];
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}

type Phase =
  | { name: 'checking'; done: number }
  | { name: 'review' }
  | { name: 'applying' }
  | { name: 'error'; message: string };

export default function ProofreadDialog({ open, guide, steps, onOpenChange, onApplied }: ProofreadDialogProps) {
  const [phase, setPhase] = useState<Phase>({ name: 'checking', done: 0 });
  const [items, setItems] = useState<ProofreadItem[]>([]);
  const [changes, setChanges] = useState<ProofreadChange[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(0);
  const run = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: one pass per opening, over the guide as it was then
  useEffect(() => {
    if (!open) {
      run.current += 1;
      return;
    }
    const id = ++run.current;
    const list = proofreadItems(guide, steps);
    setItems(list);
    setChanges([]);
    setAccepted(new Set());
    setFailed(0);
    setPhase({ name: 'checking', done: 0 });

    void (async () => {
      const found: ProofreadChange[] = [];
      let failures = 0;
      for (let index = 0; index < list.length; index++) {
        if (run.current !== id) return;
        const item = list[index];
        const result = await sendMessage('proofreadText', {
          guideId: guide.id,
          text: item.text,
          kind: item.kind,
          stepId: item.stepId,
        }).catch(() => ({ error: 'generation-failed' as const, text: undefined }));
        if (run.current !== id) return;
        if (result.error === 'no-api-key') {
          setPhase({ name: 'error', message: rewriteErrorMessage('no-api-key') });
          return;
        }
        if (result.error || result.text === undefined) failures++;
        else if (result.text.trim() !== item.text.trim()) {
          found.push({ ...item, after: result.text });
          setChanges([...found]);
          setAccepted((prev) => new Set(prev).add(item.key));
        }
        setFailed(failures);
        setPhase({ name: 'checking', done: index + 1 });
      }
      if (run.current !== id) return;
      if (list.length > 0 && failures === list.length) {
        setPhase({ name: 'error', message: i18n.t('proofread.allFailed') });
        return;
      }
      setPhase({ name: 'review' });
    })();
  }, [open]);

  const toggle = (key: string) =>
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const apply = async () => {
    const chosen = changes.filter((change) => accepted.has(change.key));
    if (chosen.length === 0) return onOpenChange(false);
    setPhase({ name: 'applying' });
    try {
      await createSnapshot(guide.id);
      for (const change of chosen) {
        if (change.field === 'title') await updateGuideTitle(guide.id, change.after);
        else if (change.field === 'description') await updateGuideDescription(guide.id, change.after);
        else if (change.field === 'note' && change.stepId) await updateStepNote(change.stepId, change.after);
        else if (change.stepId) await updateStepDescription(change.stepId, change.after);
      }
      onApplied();
      onOpenChange(false);
    } catch (err) {
      logger.error('Applying proofreading failed', err);
      setPhase({ name: 'error', message: i18n.t('proofread.applyFailed') });
    }
  };

  const checking = phase.name === 'checking';
  const total = items.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{i18n.t('proofread.title')}</DialogTitle>
          <DialogDescription>
            {checking
              ? i18n.t('proofread.progress', [String(phase.done), String(total)])
              : phase.name === 'error'
                ? phase.message
                : changes.length === 0
                  ? i18n.t('proofread.noChanges')
                  : i18n.t('proofread.found', [String(changes.length)])}
            {failed > 0 && phase.name !== 'error' && ` ${i18n.t('proofread.failed', [String(failed)])}`}
          </DialogDescription>
        </DialogHeader>

        {checking && (
          <div className="h-1 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${total ? Math.round((phase.done / total) * 100) : 0}%` }}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {changes.map((change) => (
            <label
              key={change.key}
              className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 cursor-pointer hover:border-accent"
            >
              <input
                type="checkbox"
                checked={accepted.has(change.key)}
                onChange={() => toggle(change.key)}
                disabled={phase.name === 'applying'}
                className="mt-0.5 w-4 h-4 accent-accent shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-muted-foreground mb-0.5">{change.label}</span>
                <span className="block text-[13px] leading-snug text-foreground whitespace-pre-wrap break-words">
                  {diffWords(change.text, change.after).map((part) =>
                    part.kind === 'same' ? (
                      <span key={part.id}>{part.text}</span>
                    ) : part.kind === 'removed' ? (
                      <del
                        key={part.id}
                        className="mr-0.5 rounded-sm px-0.5 text-destructive bg-destructive/10 decoration-destructive/60"
                      >
                        {part.text}
                      </del>
                    ) : (
                      <ins
                        key={part.id}
                        className="rounded-sm px-0.5 no-underline bg-success/15"
                        style={{ color: 'var(--color-success)' }}
                      >
                        {part.text}
                      </ins>
                    ),
                  )}
                </span>
              </span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!checking) return onOpenChange(false);
              run.current += 1;
              setPhase({ name: 'review' });
            }}
          >
            {i18n.t(checking ? 'proofread.stop' : 'common.close')}
          </Button>
          <Button size="sm" disabled={accepted.size === 0 || phase.name !== 'review'} onClick={() => void apply()}>
            {phase.name === 'applying' && <Loader2 size={13} className="animate-spin" />}
            {i18n.t('proofread.apply', [String(accepted.size)])}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
