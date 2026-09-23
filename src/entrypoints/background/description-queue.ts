import PQueue from 'p-queue';
import { logger } from '@/lib/logger';

const queue = new PQueue({ concurrency: 1 });
const byGuide = new Map<string, Set<Promise<unknown>>>();

export function queueDescription(guideId: string, run: () => Promise<void>): void {
  const pending = queue
    // Each AI request carries its own timeout from the profile's limits.
    .add(run)
    .catch((err) => logger.error('AI description failed', err));

  const tracked = byGuide.get(guideId) ?? new Set<Promise<unknown>>();
  tracked.add(pending);
  byGuide.set(guideId, tracked);

  pending.finally(() => {
    tracked.delete(pending);
    if (tracked.size === 0) byGuide.delete(guideId);
  });
}

/** Waits for the guide's queued descriptions, at most `waitMs` when given. */
export async function drainDescriptions(guideId: string, waitMs?: number): Promise<void> {
  const tracked = byGuide.get(guideId);
  if (!tracked?.size) return;
  if (waitMs === undefined) {
    await Promise.allSettled([...tracked]);
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled([...tracked]),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, waitMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
