// @vitest-environment jsdom

import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { buildGuideMarkdown, exportGuideAsMarkdown } from '@/core/export/markdown-export';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

vi.mock('@/core/screenshot/render', () => ({
  renderScreenshot: async (s: Screenshot) => s.blob,
}));

function makeGuide(overrides: Partial<Guide> = {}): Guide {
  return {
    id: 'guide-1',
    title: 'Test Guide',
    createdAt: new Date('2025-06-01T00:00:00Z').getTime(),
    updatedAt: new Date('2025-06-01T00:00:00Z').getTime(),
    stepIds: [],
    starred: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: 'step-1',
    guideId: 'guide-1',
    index: 0,
    description: 'Click the button',
    action: 'click',
    url: 'https://example.com',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeScreenshot(stepId: string, content = 'img'): Screenshot {
  return {
    id: `ss-${stepId}`,
    stepId,
    blob: new Blob([content], { type: 'image/png' }),
    mimeType: 'image/png',
    width: 800,
    height: 600,
  };
}

async function markdownOf(guide: Guide, steps: Step[], screenshots: Map<string, Screenshot>): Promise<string> {
  return (await buildGuideMarkdown(guide, steps, screenshots)).markdown;
}

describe('buildGuideMarkdown', () => {
  it('creates valid markdown with H1 title', async () => {
    const guide = makeGuide({ title: 'My Guide' });
    const steps = [makeStep()];
    const screenshots = new Map<string, Screenshot>();

    const md = await markdownOf(guide, steps, screenshots);
    expect(md).toMatch(/^# My Guide\n/);
  });

  it('includes metadata line with step count and created date', async () => {
    const guide = makeGuide();
    const steps = [makeStep(), makeStep({ id: 'step-2', index: 1, description: 'Type text' })];
    const screenshots = new Map<string, Screenshot>();

    const md = await markdownOf(guide, steps, screenshots);
    expect(md).toContain('export.stepsCount[2]');
    expect(md).toContain('export.createdLabel[');
  });

  it('includes step descriptions with padded step numbers', async () => {
    const guide = makeGuide();
    const steps = [
      makeStep({ index: 0, description: 'First action' }),
      makeStep({ id: 'step-2', index: 1, description: 'Second action' }),
    ];
    const screenshots = new Map<string, Screenshot>();

    const md = await markdownOf(guide, steps, screenshots);
    expect(md).toContain('## export.stepLabel[01]: First action');
    expect(md).toContain('## export.stepLabel[02]: Second action');
  });

  it('includes source domain when steps have URLs', async () => {
    const guide = makeGuide();
    const steps = [makeStep({ url: 'https://www.example.com/page' })];
    const screenshots = new Map<string, Screenshot>();

    const md = await markdownOf(guide, steps, screenshots);
    expect(md).toContain('export.sourceLabel[example.com]');
  });

  it('handles guide with no steps', async () => {
    const guide = makeGuide();
    const md = await markdownOf(guide, [], new Map());

    expect(md).toContain('# Test Guide');
    expect(md).toContain('export.stepsCount[0]');
    expect(md).not.toContain('## export.stepLabel');
  });

  it('handles steps without screenshots', async () => {
    const guide = makeGuide();
    const steps = [makeStep()];
    const screenshots = new Map<string, Screenshot>();

    const md = await markdownOf(guide, steps, screenshots);
    expect(md).toContain('## export.stepLabel[01]: Click the button');
    expect(md).not.toContain('![');
  });

  it('includes the description under the title when present', async () => {
    const guide = makeGuide({ description: 'Reset a locked-out user password.' });
    const steps = [makeStep()];
    const screenshots = new Map<string, Screenshot>();

    const md = await markdownOf(guide, steps, screenshots);
    expect(md).toContain('# Test Guide\n\nReset a locked-out user password.\n\n');
  });

  it('omits the description block when absent', async () => {
    const guide = makeGuide();
    const steps = [makeStep()];
    const screenshots = new Map<string, Screenshot>();

    const md = await markdownOf(guide, steps, screenshots);
    const lines = md.split('\n');
    expect(lines[1]).toBe('');
    expect(lines[2].startsWith('*')).toBe(true);
    expect(md).not.toContain('undefined');
  });

  it('links the screenshot as a relative file instead of inlining it', async () => {
    const step = makeStep();
    const ss = makeScreenshot(step.id, 'pixel-data');

    const { markdown, images } = await buildGuideMarkdown(makeGuide(), [step], new Map([[step.id, ss]]));

    expect(markdown).toContain('![export.stepLabel\\[01\\]](images/step-01.png)');
    expect(markdown).not.toContain('base64');
    expect(images).toHaveLength(1);
    expect(images[0].path).toBe('images/step-01.png');
  });

  it('escapes brackets in alt text so the image link stays intact', async () => {
    const step = makeStep();
    const ss = makeScreenshot(step.id);
    ss.edits = { alt: 'Menu [open]' };

    const { markdown } = await buildGuideMarkdown(makeGuide(), [step], new Map([[step.id, ss]]));

    expect(markdown).toContain('![Menu \\[open\\]](images/step-01.png)');
  });

  it('names the image file after the rendered mime type, not the stored one', async () => {
    const step = makeStep();
    const ss = makeScreenshot(step.id, 'pixel-data');
    ss.mimeType = 'image/jpeg';
    ss.blob = new Blob(['pixel-data'], { type: 'image/jpeg' });

    const { markdown } = await buildGuideMarkdown(makeGuide(), [step], new Map([[step.id, ss]]));

    expect(markdown).toContain('](images/step-01.jpg)');
  });

  it('renders a heading block as an H2 without a step number', async () => {
    const guide = makeGuide();
    const steps = [makeStep({ id: 'block-1', blockType: 'heading', description: 'Section title', url: '' })];

    const md = await markdownOf(guide, steps, new Map());
    expect(md).toContain('## Section title');
    expect(md).not.toContain('export.stepLabel');
  });

  it('renders a callout block as a blockquote with its variant label', async () => {
    const guide = makeGuide();
    const steps = [
      makeStep({
        id: 'block-1',
        blockType: 'callout',
        calloutVariant: 'warning',
        description: 'Do not skip this',
        url: '',
      }),
    ];

    const md = await markdownOf(guide, steps, new Map());
    expect(md).toContain('> **blocks.variantWarning**');
    expect(md).toContain('> Do not skip this');
  });

  it('prefixes every line of a multi-line callout', async () => {
    const guide = makeGuide();
    const steps = [makeStep({ id: 'block-1', blockType: 'callout', description: 'First line\nSecond line', url: '' })];

    const md = await markdownOf(guide, steps, new Map());
    expect(md).toContain('> First line\n> Second line');
  });

  it('keeps step numbering sequential across an interleaved block', async () => {
    const guide = makeGuide();
    const steps = [
      makeStep({ index: 0, description: 'First action' }),
      makeStep({ id: 'block-1', index: 1, blockType: 'heading', description: 'Section title', url: '' }),
      makeStep({ id: 'step-2', index: 2, description: 'Second action' }),
    ];

    const md = await markdownOf(guide, steps, new Map());
    expect(md).toContain('## export.stepLabel[01]: First action');
    expect(md).toContain('## export.stepLabel[02]: Second action');
    expect(md).not.toContain('export.stepLabel[03]');
  });

  it('counts only action steps in the metadata line', async () => {
    const guide = makeGuide();
    const steps = [
      makeStep({ index: 0 }),
      makeStep({ id: 'block-1', index: 1, blockType: 'heading', description: 'Section title', url: '' }),
      makeStep({ id: 'block-2', index: 2, blockType: 'callout', description: 'Heads up', url: '' }),
      makeStep({ id: 'step-2', index: 3, description: 'Type text' }),
    ];

    const md = await markdownOf(guide, steps, new Map());
    expect(md).toContain('export.stepsCount[2]');
  });
});

describe('exportGuideAsMarkdown', () => {
  it('zips the markdown file together with its screenshots', async () => {
    const steps = [makeStep(), makeStep({ id: 'step-2', index: 1, description: 'Type text' })];
    const screenshots = new Map<string, Screenshot>([
      ['step-1', makeScreenshot('step-1', 'first')],
      ['step-2', makeScreenshot('step-2', 'second')],
    ]);

    const zip = await exportGuideAsMarkdown(makeGuide({ title: 'My Guide' }), steps, screenshots);
    expect(zip.type).toBe('application/zip');

    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(['My Guide.md', 'images/step-01.png', 'images/step-02.png']);
    expect(strFromU8(files['My Guide.md'])).toContain('](images/step-02.png)');
    expect(strFromU8(files['images/step-01.png'])).toBe('first');
    expect(strFromU8(files['images/step-02.png'])).toBe('second');
  });

  it('produces a zip with only the markdown file when there are no screenshots', async () => {
    const zip = await exportGuideAsMarkdown(makeGuide(), [makeStep()], new Map());

    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(files)).toEqual(['Test Guide.md']);
  });

  it('puts a step note under the screenshot', async () => {
    const step = makeStep({ note: 'Сумма появится в карточке сделки.' });
    const { markdown } = await buildGuideMarkdown(makeGuide(), [step], new Map([[step.id, makeScreenshot(step.id)]]));
    expect(markdown).toContain('](images/step-01.png)\n\nСумма появится в карточке сделки.\n');
  });
});
