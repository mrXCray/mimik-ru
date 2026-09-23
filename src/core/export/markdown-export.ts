import { strToU8, type Zippable, zipSync } from 'fflate';
import { i18n } from '#imports';
import { safeFilename } from '@/core/export/download';
import { extractDomain, formatDate } from '@/core/export/utils';
import { actionSteps, isBlock, stepNumbers, variantLabel } from '@/core/guides/blocks';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { renderScreenshot } from '@/core/screenshot/render';

export const MARKDOWN_IMAGE_DIR = 'images';

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface MarkdownImage {
  path: string;
  blob: Blob;
}

export interface MarkdownBundle {
  markdown: string;
  images: MarkdownImage[];
}

export interface MarkdownOptions {
  /** Start with the guide title as an H1. Off when the target shows the title itself. */
  title?: boolean;
  /** Folder the image paths are placed under; empty for none. */
  imageDir?: string;
  /** What the Markdown image points at, given the image's path and its 0-based position. */
  imageLink?: (path: string, index: number) => string;
}

function blockLines(step: Step): string[] {
  if (step.blockType === 'heading') return [`## ${step.description}`];
  const label = variantLabel(step.calloutVariant ?? 'info');
  const body = step.description.split('\n').map((line) => (line ? `> ${line}` : '>'));
  return [`> **${label}**`, '>', ...body];
}

function imagePath(dir: string, num: string, type: string, taken: Set<string>): string {
  const ext = IMAGE_EXTENSIONS[type] ?? 'png';
  const prefix = dir ? `${dir}/` : '';
  let path = `${prefix}step-${num}.${ext}`;
  for (let n = 2; taken.has(path); n++) path = `${prefix}step-${num}-${n}.${ext}`;
  taken.add(path);
  return path;
}

export async function buildGuideMarkdown(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
  { title = true, imageDir = MARKDOWN_IMAGE_DIR, imageLink = (path) => path }: MarkdownOptions = {},
): Promise<MarkdownBundle> {
  const domain = extractDomain(steps);
  const numbers = stepNumbers(steps);
  const meta = [
    i18n.t('export.stepsCount', [String(actionSteps(steps).length)]),
    i18n.t('export.createdLabel', [formatDate(guide.createdAt)]),
    ...(domain ? [i18n.t('export.sourceLabel', [domain])] : []),
  ].join(' · ');

  const lines: string[] = title ? [`# ${guide.title}`, ''] : [];
  if (guide.description) lines.push(guide.description, '');
  lines.push(`*${meta}*`, '', '---', '');

  const images: MarkdownImage[] = [];
  const taken = new Set<string>();

  for (const step of steps) {
    if (isBlock(step)) {
      lines.push(...blockLines(step), '');
      continue;
    }

    const num = String(numbers.get(step.id) ?? 0).padStart(2, '0');
    lines.push(`## ${i18n.t('export.stepLabel', [num])}: ${step.description}`, '');

    const screenshot = screenshots.get(step.id);
    if (screenshot) {
      const rendered = await renderScreenshot(screenshot);
      const path = imagePath(imageDir, num, rendered.type, taken);
      // Brackets in user alt text would close the image link early.
      const altText = (screenshot.edits?.alt || i18n.t('export.stepLabel', [num])).replace(/[[\]]/g, '\\$&');
      lines.push(`![${altText}](${imageLink(path, images.length)})`, '');
      images.push({ path, blob: rendered });
    }
  }

  return { markdown: lines.join('\n'), images };
}

export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Markdown file plus its screenshots under `images/`, packed as one zip. */
export async function exportGuideAsMarkdown(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
): Promise<Blob> {
  const { markdown, images } = await buildGuideMarkdown(guide, steps, screenshots);
  const files: Zippable = { [safeFilename(guide.title, 'md')]: strToU8(markdown) };
  // Screenshots are already compressed, so store them instead of deflating again.
  for (const image of images) files[image.path] = [await blobBytes(image.blob), { level: 0 }];
  const zipped = zipSync(files);
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}
