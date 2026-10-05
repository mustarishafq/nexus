import { Node, mergeAttributes } from '@tiptap/react';
import { MENTION_TOKEN_REGEX } from '@/lib/mentions';

const MENTION_CHIP_CLASS =
  'mention-chip mx-0.5 inline-flex max-w-full items-center rounded-md bg-primary/10 px-1.5 py-0.5 align-middle text-xs font-medium text-primary';

/**
 * Inline atom that shows a mention as "@Name" inside the TipTap editor.
 * Stored content keeps the @[id|label] token (see serializeMentionNodes) so
 * the backend MentionService and feed rendering stay unchanged.
 */
export const MentionNode = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-mention-id'),
        renderHTML: (attributes) => ({ 'data-mention-id': attributes.id }),
      },
      label: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mention-label') || '',
        renderHTML: (attributes) => ({ 'data-mention-label': attributes.label }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-mention-id]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes({ class: MENTION_CHIP_CLASS }, HTMLAttributes), `@${node.attrs.label}`];
  },

  renderText({ node }) {
    return `@${node.attrs.label}`;
  },
});

function escapeAttribute(value = '') {
  return String(value).replace(/"/g, '&quot;');
}

/** Turn @[id|label] tokens in stored HTML into mention node markup for the editor. */
export function deserializeMentionTokens(html = '') {
  return String(html).replace(new RegExp(MENTION_TOKEN_REGEX.source, 'g'), (_match, id, label) => {
    return `<span data-mention-id="${escapeAttribute(id)}" data-mention-label="${escapeAttribute(label)}"></span>`;
  });
}

/** Turn editor mention node markup back into @[id|label] tokens for storage. */
export function serializeMentionNodes(html = '') {
  return String(html).replace(/<span\b([^>]*\bdata-mention-id="[^"]*"[^>]*)>[\s\S]*?<\/span>/g, (match, attrs) => {
    const id = attrs.match(/\bdata-mention-id="([^"]*)"/)?.[1];
    const label = attrs.match(/\bdata-mention-label="([^"]*)"/)?.[1];
    if (!id || !label) return match;

    return `@[${id}|${label.replace(/&quot;/g, '"').replace(/\]/g, '')}]`;
  });
}
