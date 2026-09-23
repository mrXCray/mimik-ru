import { Check, TriangleAlert } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { i18n } from '#imports';
import type { AiTestRequest, AiTestResult } from '@/core/capture/ai/test-model';
import { sendMessage } from '@/lib/messaging';

type AiTestState = { status: 'idle' } | { status: 'running' } | { status: 'done'; result: AiTestResult };

/** Runs one real step-description request through the background, like a recording would. */
export function useAiTest() {
  const [state, setState] = useState<AiTestState>({ status: 'idle' });
  const runId = useRef(0);

  const run = useCallback(async (request: AiTestRequest) => {
    const id = ++runId.current;
    setState({ status: 'running' });
    const result = await sendMessage('testAi', request).catch(
      (err): AiTestResult => ({ ok: false, reason: 'failed', message: String(err), ms: 0 }),
    );
    if (runId.current === id) setState({ status: 'done', result });
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    setState({ status: 'idle' });
  }, []);

  return { state, run, reset };
}

const seconds = (ms: number) => (ms / 1000).toFixed(1);

export function AiTestNote({ state, timeoutSec }: { state: AiTestState; timeoutSec: number }) {
  if (state.status === 'idle') return null;
  if (state.status === 'running') {
    return <p className="mt-1.5 text-[11px] text-muted-foreground">{i18n.t('settings.testRunning')}</p>;
  }

  const { result } = state;
  if (result.ok && result.text) {
    return (
      <div className="mt-1.5 rounded-lg border border-border bg-secondary px-2.5 py-2 text-[11px] leading-relaxed">
        <p className="flex items-center gap-1 font-semibold" style={{ color: 'var(--color-success)' }}>
          <Check size={11} />
          {i18n.t('settings.testOk', [seconds(result.ms)])}
        </p>
        <p className="mt-1 text-foreground whitespace-pre-wrap break-words">{result.text}</p>
      </div>
    );
  }

  const message = result.ok
    ? i18n.t('settings.testEmpty', [seconds(result.ms)])
    : result.reason === 'timeout'
      ? i18n.t('settings.testTimeout', [String(timeoutSec)])
      : i18n.t('settings.testFailed', [seconds(result.ms), result.message]);
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-destructive leading-relaxed" role="alert">
      <TriangleAlert size={11} className="shrink-0 mt-0.5" />
      <span className="break-words">{message}</span>
    </p>
  );
}
