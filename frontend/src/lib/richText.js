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
  'break-words text-sm leading-relaxed ' +
  '[&_p]:my-0 [&_p]:min-h-[1.5em] [&_p+p]:mt-0 ' +
  '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-foreground ' +
  '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:marker:text-foreground ' +
  '[&_li]:my-0.5 [&_li]:pl-0.5 [&_li>p]:my-0 [&_li>p]:min-h-0 [&_li>p]:inline ' +
  '[&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through ' +
  '[&_a]:text-primary';

export function looksLikeHtml(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(String(value));
}

/**
 * TipTap stores blank Enter presses as empty <p></p>, which collapse in HTML.
 * Keep a <br> so blank lines render with the same height as in the editor.
 */
export function preserveBlankLines(html = '') {
  return String(html)
    .replace(/<p>(?:\s|&nbsp;|&#160;|<br\b[^>]*>)*<\/p>/gi, '<p><br></p>');
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
    'mx-0.5 inline-flex max-w-full items-center rounded-md bg-primary/10 px-1.5 py-0.5 align-baseline text-xs font-medium text-primary';

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
