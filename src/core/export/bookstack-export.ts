import { strToU8, type Zippable, zipSync } from 'fflate';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { blobBytes, buildGuideMarkdown } from './markdown-export';

/** BookStack caps entity names at 255 characters. */
const MAX_PAGE_NAME = 255;

export const bookStackImageRef = (id: number) => `[[bsexport:image:${id}]]`;

/**
 * A single page in BookStack's Portable ZIP format (v24.12+), importable from
 * Books → Import. Screenshots travel as files/ entries and the Markdown points
 * at them with [[bsexport:image:N]] references, which BookStack swaps for the
 * uploaded image URLs on import.
 * Format: https://github.com/BookStackApp/BookStack/blob/development/dev/docs/portable-zip-file-format.md
 */
export async function exportGuideAsBookStack(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
): Promise<Blob> {
  const { markdown, images } = await buildGuideMarkdown(guide, steps, screenshots, {
    title: false,
    imageDir: '',
    imageLink: (_path, index) => bookStackImageRef(index + 1),
  });

  const data = {
    exported_at: new Date().toISOString(),
    page: {
      name: (guide.title.trim() || 'Guide').slice(0, MAX_PAGE_NAME),
      markdown,
      images: images.map((image, index) => ({ id: index + 1, name: image.path, file: image.path, type: 'gallery' })),
    },
  };

  const files: Zippable = { 'data.json': strToU8(JSON.stringify(data, null, 2)) };
  // Screenshots are already compressed, so store them instead of deflating again.
  for (const image of images) files[`files/${image.path}`] = [await blobBytes(image.blob), { level: 0 }];
  const zipped = zipSync(files);
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}
