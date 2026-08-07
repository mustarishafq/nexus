import DOMPurify from 'dompurify';
import { MENTION_TOKEN_REGEX, isAllMention } from '@/lib/mentions';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'a',
  'span',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'data-mention-id', 'data-mention-label'];

export const RICH_TEXT_CONTENT_CLASS =
  'rich-text-content break-words text-sm leading-relaxed ' +
  '[&_p]:my-0 [&_p]:min-h-[1.5em] [&_p+p]:mt-0 ' +
  '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-foreground ' +
  '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:marker:text-foreground ' +
  '[&_li]:my-0.5 [&_li]:pl-0.5 [&_li>p]:my-0 [&_li>p]:min-h-0 [&_li>p]:inline ' +
  '[&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through ' +
  '[&_a]:text-primary';

export function looksLikeHtml(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(String(value));
}

const BLANK_PARAGRAPH_INNER =
  /^(?:\s|&nbsp;|&#160;|&#x0*a0;|\u00a0|\u200b|\ufeff|<br\b[^>]*>)*$/i;

function isBlankParagraphInner(inner = '') {
  return BLANK_PARAGRAPH_INNER.test(String(inner));
}

/**
 * TipTap stores blank Enter presses as empty <p></p>, which collapse in HTML.
 * Keep a <br> so blank lines render with the same height as in the editor.
 * Also covers ZWSP / NBSP / attribute variants TipTap sometimes emits.
 */
export function preserveBlankLines(html = '') {
  return String(html).replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (match, inner) => {
    return isBlankParagraphInner(inner) ? '<p><br></p>' : match;
  });
}

/**
 * Inverse of preserveBlankLines for TipTap setContent.
 * Saved <p><br></p> blank lines parse as HardBreak nodes; ProseMirror then adds
 * its trailing break on top, so the editor shows two blank lines. Load them as
 * empty <p></p> instead — TipTap paints one trailing break while editing.
 */
export function prepareRichTextForEditor(html = '') {
  return String(html).replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (match, inner) => {
    return isBlankParagraphInner(inner) ? '<p></p>' : match;
  });
}

export function stripHtml(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isEmptyRichText(value = '') {
  return stripHtml(value) === '';
}

export function sanitizeRichText(value = '') {
  return preserveBlankLines(
    DOMPurify.sanitize(String(value), {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    })
  );
}

/**
 * Sanitize HTML and turn @[id|label] tokens into mention chips/links.
 */
export function formatRichTextWithMentions(value = '') {
  if (!value) {
    return '';
  }

  const source = looksLikeHtml(value) ? sanitizeRichText(value) : String(value);
  const mentionChipClass =
    'mx-0.5 inline-flex max-w-full items-center rounded-md bg-primary/10 px-1.5 py-0.5 align-middle text-xs font-medium text-primary';

  return source.replace(MENTION_TOKEN_REGEX, (_match, userId, label) => {
    const safeLabel = String(label)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    if (isAllMention(userId)) {
      return `<span class="${mentionChipClass}">@${safeLabel}</span>`;
    }

    const safeId = encodeURIComponent(String(userId));
    return `<a href="/people/${safeId}" class="${mentionChipClass} hover:bg-primary/15 hover:underline">@${safeLabel}</a>`;
  });
}
