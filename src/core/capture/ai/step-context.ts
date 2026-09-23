import type { Step } from '@/core/guides/types';

function pagePath(url: string): string | null {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return null;
  }
}

function quoted(value: string | null | undefined): string | null {
  const text = value?.trim().replace(/\s+/g, ' ');
  return text ? `"${text.slice(0, 80)}"` : null;
}

/**
 * What was on screen when the step was captured, as text for the AI: the action, the page, and the
 * page context recorded at capture time (falling back to the stored element for older steps).
 */
export function describeStepContext(step: Step): string {
  const lines = [`Action: ${step.action}`];
  const page = pagePath(step.url);
  if (page) lines.push(`URL: ${page}`);

  if (step.domContext) {
    lines.push(step.domContext);
  } else if (step.elementMeta) {
    const meta = step.elementMeta;
    const name =
      quoted(meta.ariaLabel) ??
      quoted(meta.textContent) ??
      quoted(meta.placeholder) ??
      quoted(meta.altText) ??
      quoted(meta.name);
    const kind = meta.role ?? (meta.inputType ? `${meta.tag}[${meta.inputType}]` : meta.tag);
    lines.push(`→ Target: ${kind}${name ? ` ${name}` : ''}`);
  }

  if (step.inputValue && !step.domContext) lines.push(`Typed value: ${quoted(step.inputValue)}`);
  return lines.join('\n');
}
