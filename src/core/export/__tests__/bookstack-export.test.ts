// @vitest-environment node
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { exportGuideAsBookStack } from '@/core/export/bookstack-export';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

// vitest.setup.ts swaps in a TextEncoder that mangles non-ASCII text, and fflate
// captures the encoder when it loads, so restore the real one before any import.
vi.hoisted(async () => {
  globalThis.TextEncoder = (await import('node:util')).TextEncoder as typeof TextEncoder;
});

vi.mock('@/core/screenshot/render', () => ({
  renderScreenshot: async (s: Screenshot) => s.blob,
}));

const guide: Guide = {
  id: 'guide-1',
  title: 'Создать счёт',
  description: 'Как выставить счёт клиенту.',
  createdAt: new Date('2025-06-01T00:00:00Z').getTime(),
  updatedAt: new Date('2025-06-01T00:00:00Z').getTime(),
  stepIds: [],
  starred: false,
  deletedAt: null,
};

function step(id: string, index: number, description: string): Step {
  return { id, guideId: guide.id, index, description, action: 'click', url: 'https://example.com', timestamp: 0 };
}

function shot(stepId: string, content: string, type = 'image/png'): Screenshot {
  return { id: `ss-${stepId}`, stepId, blob: new Blob([content], { type }), mimeType: type, width: 1, height: 1 };
}

async function unpack(blob: Blob) {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return { files, data: JSON.parse(strFromU8(files['data.json'])) };
}

describe('exportGuideAsBookStack', () => {
  it('packs a single page with its screenshots in the Portable ZIP layout', async () => {
    const steps = [step('s1', 0, 'Open billing'), step('s2', 1, 'Click New invoice')];
    const screenshots = new Map([
      ['s1', shot('s1', 'first')],
      ['s2', shot('s2', 'second', 'image/jpeg')],
    ]);

    const zip = await exportGuideAsBookStack(guide, steps, screenshots);
    expect(zip.type).toBe('application/zip');
    const { files, data } = await unpack(zip);

    expect(Object.keys(files).sort()).toEqual(['data.json', 'files/step-01.png', 'files/step-02.jpg']);
    expect(strFromU8(files['files/step-01.png'])).toBe('first');
    expect(data.page.name).toBe('Создать счёт');
    expect(data.page.images).toEqual([
      { id: 1, name: 'step-01.png', file: 'step-01.png', type: 'gallery' },
      { id: 2, name: 'step-02.jpg', file: 'step-02.jpg', type: 'gallery' },
    ]);
    expect(typeof data.exported_at).toBe('string');
  });

  it('references images with bsexport links and leaves the title to BookStack', async () => {
    const steps = [step('s1', 0, 'Open billing'), step('s2', 1, 'Click New invoice')];
    const screenshots = new Map([
      ['s1', shot('s1', 'a')],
      ['s2', shot('s2', 'b')],
    ]);

    const { data } = await unpack(await exportGuideAsBookStack(guide, steps, screenshots));
    const markdown: string = data.page.markdown;

    expect(markdown).toContain('([[bsexport:image:1]])');
    expect(markdown).toContain('([[bsexport:image:2]])');
    expect(markdown).not.toContain('# Создать счёт');
    expect(markdown.startsWith('Как выставить счёт клиенту.')).toBe(true);
    expect(markdown).toContain('## export.stepLabel[02]: Click New invoice');
  });

  it('exports a page without images when there are no screenshots', async () => {
    const { files, data } = await unpack(await exportGuideAsBookStack(guide, [step('s1', 0, 'Open')], new Map()));
    expect(Object.keys(files)).toEqual(['data.json']);
    expect(data.page.images).toEqual([]);
  });

  it('keeps the page name within BookStack limits', async () => {
    const long = { ...guide, title: 'x'.repeat(300) };
    const { data } = await unpack(await exportGuideAsBookStack(long, [], new Map()));
    expect(data.page.name).toHaveLength(255);
  });
});
