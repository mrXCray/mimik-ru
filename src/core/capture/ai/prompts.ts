export const STEP_DESCRIPTION_PROMPT = `You are describing steps in a browser workflow guide. Given the following context about a user action on a web page, write a single concise sentence describing this step.

{{context}}

Examples of good descriptions:
- Click the "Submit" button
- Enter "ada@example.com" in the "Email" field
- Select "Admin" in the "Role" list
- Open the "Settings" page

Write only the description, no preamble.`;

export const GUIDE_META_PROMPT = `These are the steps of a browser workflow, with the page URL and description for each step:

{{steps}}

Write a title and a description for this workflow.

TITLE: specific and descriptive. Mention the application or website name and the specific task performed. Reference specific pages, features, or items that were interacted with. MUST be under 60 characters.

Examples of good titles:
- "Review claude-code Pull Requests"
- "Configure Slack Notification Preferences"
- "Submit Expense Report in Workday"
- "Create Repository in GitHub Organization"

DESCRIPTION: one or two sentences stating what the workflow accomplishes and who would follow it. Do not repeat the title. Do not list the individual steps. Do not mention any UI element that does not appear in the steps above.

Examples of good descriptions:
- "Reset a locked-out user's password from the Okta admin panel. For IT support staff."
- "Configure which Slack channels send desktop notifications, and set a do-not-disturb schedule."`;

export const GUIDE_META_JSON_SUFFIX = `

Reply with nothing but a JSON object shaped {"title": string, "description": string}. No code fence, no commentary.`;

export const REWRITE_PROMPT = `You are editing one span of text inside a browser workflow guide. The text describes a step a reader must perform, or summarises what the workflow accomplishes.

Selected text:
"""
{{text}}
"""

Instruction: {{instruction}}

Rules:
- Keep it imperative and describing a single action when the original does.
- Never introduce a UI element, button, page, or value that is absent from the original.
- Preserve specific names, labels, and quoted strings exactly as written.
- Match the length the instruction implies; otherwise stay close to the original length.

Return only the rewritten text. No preamble, no quotes, no explanation.`;

export const REWRITE_PRESETS = {
  shorter: 'Make it shorter and tighter without losing any required detail.',
  detail: 'Add detail that clarifies the action, using only information already present.',
  grammar: 'Fix grammar, spelling, and punctuation. Change nothing else.',
  formal: 'Make the tone more formal and professional.',
  casual: 'Make the tone more casual and conversational.',
} as const;

export type RewritePreset = keyof typeof REWRITE_PRESETS;

export const AI_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文' },
  { code: 'es', label: 'Español' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' },
  { code: 'pl', label: 'Polski' },
  { code: 'sr', label: 'Српски' },
] as const;

export type AILanguageCode = (typeof AI_LANGUAGES)[number]['code'];

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  pt: 'Brazilian Portuguese',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ru: 'Russian',
  pl: 'Polish',
  sr: 'Serbian (Cyrillic script)',
};

export function getLanguageSuffix(locale: string): string {
  if (locale.startsWith('en')) return '';
  const lang = LANGUAGE_NAMES[locale.split('-')[0]] || locale;
  return `\nIMPORTANT: Write the output in ${lang}, even though these instructions and examples are in English. Keep names, UI labels and quoted strings from the page exactly as written.`;
}

/** The AI language that matches the extension's UI locale, used until the user picks one. */
export function defaultAiLanguage(uiLocale: string | undefined): AILanguageCode {
  if (!uiLocale) return 'en';
  const normalized = uiLocale.replace('_', '-').toLowerCase();
  const exact = AI_LANGUAGES.find((lang) => lang.code.toLowerCase() === normalized);
  if (exact) return exact.code;
  const base = normalized.split('-')[0];
  return AI_LANGUAGES.find((lang) => lang.code.split('-')[0].toLowerCase() === base)?.code ?? 'en';
}

/** Built-in writing rules for step text, on by default in every profile. */
export const STEP_STYLE_RULES = `Writing rules for the step text:
- Describe exactly one action and start with an imperative verb.
- Copy the control's name character for character from the context and put it in quotation marks. Never translate, shorten or replace it, even when it is in another language than your output: the reader must find that exact text on the screen. Add the kind of control (button, tab, field, link, list, menu item, checkbox, switch) when it makes the control easier to find.
- When text is typed or an option is chosen, include the value. Never repeat a password or a masked value (***).
- Say where the control is only when its name alone is ambiguous, for example "in the top menu" or "in the "Billing" dialog".
- Keep it short: about 15 words at most. No "please", no "you need to", no reasons, and no mention of screenshots, recording or this guide.
- Do not end with a period.
- Never mention a control, page or value that is not in the context, and never copy technical markers from the context such as "(click)", "→", "[value=…]" or tag names.
- If the project context above sets different rules, follow the project context.`;

const STYLE_RULES_BY_LANGUAGE: Record<string, string> = {
  ru: `- In Russian, use the polite imperative (Нажмите, Выберите, Введите, Откройте, Включите), never the informal one (Нажми). Put on-screen names in «ёлочки» quotes and never translate them. Write the kind of control in lowercase before the name, following these patterns (NAME and VALUE stand for the real text from the context): нажмите кнопку «NAME», откройте вкладку «NAME», введите «VALUE» в поле «NAME». A name in English stays in English inside the Russian sentence.`,
  pl: `- In Polish, use the second-person singular imperative that Polish software instructions use (Kliknij, Wybierz, Wpisz, Otwórz, Włącz). Put on-screen names in „…” quotes and never translate them. Write the kind of control in lowercase before the name, following these patterns (NAME and VALUE stand for the real text from the context): kliknij przycisk „NAME”, otwórz kartę „NAME”, wpisz „VALUE” w polu „NAME”. A name in English stays in English inside the Polish sentence.`,
  sr: `- In Serbian, write in Cyrillic script and use the polite plural imperative (Кликните, Изаберите, Унесите, Отворите, Укључите), never the informal one (Кликни). Put on-screen names in „…“ quotes and never translate or transliterate them. Write the kind of control in lowercase before the name, following these patterns (NAME and VALUE stand for the real text from the context): кликните дугме „NAME“, отворите картицу „NAME“, унесите „VALUE“ у поље „NAME“. A name in English or in Latin script stays exactly as it is.`,
  en: `- Use straight double quotes around on-screen names.`,
};

/**
 * The action marker a model sometimes copies from the context line "→ Target: … (click)", in any
 * language ("(клик)", "(kliknięcie)"): one lower-case word in brackets at the very end, so "(PDF)" and
 * brackets inside a quoted name ("«Отчёт (PDF)»") are kept.
 */
const TRAILING_ACTION_MARKER = /\s*\(\p{Ll}{2,15}\)\s*$/u;

/** Tidies a step description the way the built-in rules ask: no copied action marker, no closing period. */
export function tidyStepDescription(text: string): string {
  const noPeriod = (value: string) => value.trim().replace(/(?<!\.)\.$/, '');
  return noPeriod(noPeriod(text).replace(TRAILING_ACTION_MARKER, ''));
}

/** The built-in step rules plus the notes for the output language. */
export function getStepStyleRules(locale: string): string {
  const note =
    STYLE_RULES_BY_LANGUAGE[locale.split('-')[0]] ?? '- Use the quotation marks customary in the output language.';
  return `${STEP_STYLE_RULES}\n${note}`;
}

export const MAX_PRE_PROMPT_CHARS = 20_000;

/** Wraps the user's project context so it steers tone and terms without overriding the task's output format. */
export function getPrePromptPrefix(prePrompt: string | undefined): string {
  const text = prePrompt?.trim().slice(0, MAX_PRE_PROMPT_CHARS);
  if (!text) return '';
  return `Project context and writing guidelines from the user. Follow them for terminology, tone and style, but keep the output format the task below asks for.
"""
${text}
"""

`;
}
