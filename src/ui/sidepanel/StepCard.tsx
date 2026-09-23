import { Check, Copy, Loader2, NotebookPen, StickyNote, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { i18n } from '#imports';
import { replaceScreenshot } from '@/core/guides/service';
import type { Screenshot, Step } from '@/core/guides/types';
import { imageDimensions, renderScreenshot } from '@/core/screenshot/render';
import { logger } from '@/lib/logger';
import { sendMessage } from '@/lib/messaging';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/components/ui/tooltip';
import { useAskAi } from '@/ui/shared/AskAi';
import ConfirmDialog from '@/ui/shared/ConfirmDialog';
import { DragGrip, type DragHandleProps, useCardDrag } from '@/ui/shared/card-drag';
import ImagePlaceholder from '@/ui/shared/ImagePlaceholder';
import { rewriteErrorMessage } from '@/ui/shared/rewrite-error';
import ScreenshotView from '@/ui/shared/ScreenshotView';
import StepSourceBadge from '@/ui/shared/StepSourceBadge';

interface StepCardProps {
  step: Step;
  number: number;
  screenshot: Screenshot | undefined;
  onDescriptionChange?: (stepId: string, description: string) => void;
  onNoteChange?: (stepId: string, note: string) => void;
  onDelete?: (stepId: string) => void;
  dragHandleProps?: DragHandleProps;
  onOpenEditor?: (stepId: string, tool: 'annotate' | 'redact' | 'crop' | 'target') => void;
  onCopy?: (stepId: string) => void;
  placeholderRatio?: number;
  frameRatio?: number;
  readOnly?: boolean;
  onChanged?: () => void;
  hasApiKey?: boolean;
}

export default function StepCard({
  step,
  number,
  screenshot,
  onDescriptionChange,
  onNoteChange,
  onDelete,
  dragHandleProps,
  onOpenEditor,
  placeholderRatio,
  frameRatio,
  readOnly,
  onChanged,
  hasApiKey,
}: StepCardProps) {
  const [description, setDescription] = useState(step.description);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cardDrag = useCardDrag(dragHandleProps);

  useEffect(() => {
    setDescription(step.description);
  }, [step.description]);

  const [note, setNote] = useState(step.note ?? '');
  const [noteOpen, setNoteOpen] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const aiAvailable = !readOnly && Boolean(hasApiKey);

  useEffect(() => {
    setNote(step.note ?? '');
  }, [step.note]);

  const saveNote = (next: string) => {
    setNote(next);
    if (next !== (step.note ?? '')) onNoteChange?.(step.id, next);
  };

  const noteAskAi = useAskAi(note, saveNote, aiAvailable && Boolean(note.trim()), step.guideId);

  const handleGenerateNote = async () => {
    if (noteBusy) return;
    setNoteBusy(true);
    setNoteError(null);
    setNoteOpen(true);
    try {
      const result = await sendMessage('generateStepNote', { guideId: step.guideId, stepId: step.id });
      if (result.error) setNoteError(rewriteErrorMessage(result.error));
      else if (result.text) saveNote(result.text);
      else setNoteError(i18n.t('editor.noteNothing'));
    } catch (err) {
      logger.error('Step note generation failed', err);
      setNoteError(rewriteErrorMessage('generation-failed'));
    } finally {
      setNoteBusy(false);
    }
  };

  const showNote = readOnly ? Boolean(step.note?.trim()) : noteOpen || Boolean(note.trim()) || noteBusy;

  const handleDescriptionBlur = () => {
    if (description !== step.description) onDescriptionChange?.(step.id, description);
  };

  const askAi = useAskAi(
    description,
    (next) => {
      setDescription(next);
      onDescriptionChange?.(step.id, next);
    },
    !readOnly && !step.aiPending && Boolean(hasApiKey),
    step.guideId,
  );

  const handleDelete = () => {
    setConfirmDelete(false);
    onDelete?.(step.id);
  };

  const handleCopy = async () => {
    if (!screenshot) return;
    try {
      const rendered = await renderScreenshot(screenshot, { format: 'image/png' });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': rendered })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      logger.error(' Copy to clipboard failed', err);
    }
  };

  const handleUpload = async (file: File) => {
    await replaceScreenshot(step.id, file, await imageDimensions(file));
    onChanged?.();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
    dragHandleProps?.onDragOver(e);
  };

  return (
    <div
      {...cardDrag}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDragEnd={() => {
        setDragOver(false);
        dragHandleProps?.onDragEnd();
      }}
      className={`rounded-xl mb-3 overflow-hidden transition-shadow border border-border bg-card ${dragOver ? 'ring-2 ring-accent' : ''}`}
    >
      {screenshot ? (
        <ScreenshotView
          screenshot={screenshot}
          alt={`Step ${number} screenshot`}
          className="!rounded-none !border-0"
          crop
          frameRatio={frameRatio}
          readOnly={readOnly}
          onOpenEditor={!readOnly && onOpenEditor ? (tool) => onOpenEditor(step.id, tool) : undefined}
          onChanged={onChanged}
        />
      ) : (
        <ImagePlaceholder
          label={i18n.t('editor.noScreenshot')}
          ratio={placeholderRatio}
          className="w-full !rounded-none border-x-0 border-t-0"
          onUpload={readOnly ? undefined : handleUpload}
        />
      )}

      <div className="px-3 pt-2 pb-2">
        <div className="flex items-center gap-2">
          {dragHandleProps && <DragGrip />}
          <span className="flex items-center justify-center w-[22px] h-[22px] rounded-full text-[11px] font-bold shrink-0 bg-primary text-primary-foreground">
            {number}
          </span>
          {step.aiPending ? (
            <span className="flex items-center gap-1.5 text-[13px] font-medium leading-snug flex-1 text-muted-foreground">
              <Loader2 size={13} className="animate-spin" />
              {i18n.t('editor.writingStepDescription')}
            </span>
          ) : readOnly ? (
            <p className="text-[13px] font-medium leading-snug flex-1 text-foreground whitespace-pre-wrap">
              {step.description}
            </p>
          ) : (
            <textarea
              className="w-full text-[13px] font-medium resize-none outline-none border-0 bg-transparent p-0 leading-snug flex-1 text-foreground"
              value={description}
              rows={1}
              onChange={(e) => setDescription(e.target.value)}
              onSelect={askAi.onSelect}
              onBlur={handleDescriptionBlur}
            />
          )}
        </div>
        {showNote && (
          <div className="mt-1.5 ml-[30px] flex items-start gap-1.5">
            {readOnly ? (
              <p className="flex-1 text-[12px] leading-snug text-muted-foreground whitespace-pre-wrap">{step.note}</p>
            ) : noteBusy ? (
              <span className="flex-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Loader2 size={12} className="animate-spin" />
                {i18n.t('editor.noteWriting')}
              </span>
            ) : (
              <textarea
                className="flex-1 min-w-0 text-[12px] leading-snug resize-none outline-none border-0 border-b border-transparent focus:border-accent bg-transparent p-0 text-muted-foreground placeholder:text-muted-foreground/60"
                value={note}
                rows={1}
                ref={(el) => {
                  noteRef.current = el;
                  if (el) {
                    el.style.height = '0';
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
                placeholder={i18n.t('editor.notePlaceholder')}
                onChange={(e) => {
                  setNote(e.target.value);
                  e.target.style.height = '0';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onSelect={noteAskAi.onSelect}
                onBlur={() => {
                  saveNote(note);
                  if (!note.trim()) setNoteOpen(false);
                }}
              />
            )}
            {!readOnly && noteAskAi.trigger}
          </div>
        )}
        {noteError && <p className="mt-1 ml-[30px] text-[11px] text-destructive">{noteError}</p>}
        <div className="flex items-center justify-between gap-2 mt-1">
          {step.aiPending ? <span /> : <StepSourceBadge source={step.descriptionSource} />}
          <div className="flex items-center gap-0.5">
            {!readOnly && !showNote && onNoteChange && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setNoteOpen(true);
                      requestAnimationFrame(() => noteRef.current?.focus());
                    }}
                    className="p-1 rounded-md transition-colors text-border hover:text-accent"
                    aria-label={i18n.t('editor.addNote')}
                  >
                    <StickyNote size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{i18n.t('editor.addNote')}</TooltipContent>
              </Tooltip>
            )}
            {aiAvailable && onNoteChange && !step.aiPending && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => void handleGenerateNote()}
                    aria-disabled={noteBusy}
                    className="p-1 rounded-md transition-colors text-border hover:text-accent aria-disabled:opacity-50"
                    aria-label={i18n.t(note.trim() ? 'editor.regenerateNote' : 'editor.generateNote')}
                  >
                    <NotebookPen size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{i18n.t(note.trim() ? 'editor.regenerateNote' : 'editor.generateNote')}</TooltipContent>
              </Tooltip>
            )}
            {askAi.trigger}
            {screenshot && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCopy}
                    className={`p-1 rounded-md transition-colors ${copied ? 'text-success' : 'text-border hover:text-success'}`}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{i18n.t('editor.copyScreenshot')}</TooltipContent>
              </Tooltip>
            )}
            {!readOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-1 rounded-md transition-colors text-border hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{i18n.t('recording.deleteStep')}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        heading={i18n.t('editor.deleteThisStep')}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
