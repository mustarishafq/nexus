export const ALL_MENTION_ID = 'all';
export const ALL_MENTION_LABEL = 'all';
export const ALL_MENTION_OPTION = {
  id: ALL_MENTION_ID,
  name: ALL_MENTION_LABEL,
  full_name: ALL_MENTION_LABEL,
  isAll: true,
};

export const MENTION_TOKEN_REGEX = /@\[(\d+|all)\|([^\]]+)\]/g;

export function isAllMention(userId) {
  return String(userId) === ALL_MENTION_ID;
}

export function buildMentionToken(user) {
  if (user?.isAll || isAllMention(user?.id)) {
    return `@[${ALL_MENTION_ID}|${ALL_MENTION_LABEL}]`;
  }

  const name = (user?.name?.trim() || user?.full_name?.trim() || 'User').replace(/\]/g, '');
  return `@[${user.id}|${name}]`;
}

export function matchesAllMentionQuery(query = '') {
  const normalized = String(query).trim().toLowerCase();
  return normalized === '' || 'all'.startsWith(normalized);
}

export function displayMentionText(text = '') {
  return String(text).replace(MENTION_TOKEN_REGEX, '@$2');
}

export function splitMentionText(text = '') {
  const parts = [];
  let lastIndex = 0;
  const regex = new RegExp(MENTION_TOKEN_REGEX.source, 'g');
  let match = regex.exec(String(text));

  while (match) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'mention',
      userId: match[1],
      label: match[2],
    });
    lastIndex = match.index + match[0].length;
    match = regex.exec(String(text));
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: 'text', value: String(text) }];
}

export function isCursorInsideMentionToken(value, cursorIndex) {
  if (cursorIndex < 0) {
    return false;
  }

  const text = String(value);
  const regex = new RegExp(MENTION_TOKEN_REGEX.source, 'g');
  let match = regex.exec(text);

  while (match) {
    const start = match.index;
    const end = start + match[0].length;
    if (cursorIndex > start && cursorIndex < end) {
      return true;
    }
    match = regex.exec(text);
  }

  const beforeCursor = text.slice(0, cursorIndex);
  const openIndex = beforeCursor.lastIndexOf('@[');
  if (openIndex !== -1 && !beforeCursor.slice(openIndex).includes(']')) {
    return true;
  }

  return false;
}

export function getMentionQuery(value, cursorIndex) {
  if (isCursorInsideMentionToken(value, cursorIndex)) {
    return null;
  }

  const beforeCursor = value.slice(0, cursorIndex);
  const match = beforeCursor.match(/(?:^|\s)@([\w\s.-]{0,40})$/);

  if (!match) {
    return null;
  }

  return {
    query: match[1].trim(),
    start: beforeCursor.lastIndexOf('@'),
    end: cursorIndex,
  };
}

function getTextBeforeCursor(root, range) {
  const preRange = range.cloneRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.startContainer, range.startOffset);

  const container = document.createElement('div');
  container.appendChild(preRange.cloneContents());
  return serializeMentionEditor(container);
}

export function getMentionQueryFromEditor(root) {
  const selection = window.getSelection();
  if (!root || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) {
    return null;
  }

  const textBefore = getTextBeforeCursor(root, range);
  const serialized = serializeMentionEditor(root);
  const cursor = textBefore.length;

  if (isCursorInsideMentionToken(serialized, cursor)) {
    return null;
  }

  const match = textBefore.match(/(?:^|\s)@([\w\s.-]{0,40})$/);
  if (!match) {
    return null;
  }

  return {
    query: match[1].trim(),
    start: textBefore.lastIndexOf('@'),
    end: cursor,
  };
}

export function replaceActiveMentionQuery(serialized, mentionState, user) {
  const token = `${buildMentionToken(user)} `;
  const end =
    typeof mentionState.end === 'number'
      ? mentionState.end
      : mentionState.start + 1 + (mentionState.query?.length || 0);

  return {
    value: `${serialized.slice(0, mentionState.start)}${token}${serialized.slice(end)}`,
    cursor: mentionState.start + token.length,
  };
}

export function insertMentionToken(value, startIndex, _query, user) {
  const token = `${buildMentionToken(user)} `;
  return `${value.slice(0, startIndex)}${token}${value.slice(startIndex + 1 + (_query?.length || 0))}`;
}

export function mentionTokenLength(userId, label) {
  return `@[${userId}|${label}]`.length;
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

function isBlockElement(element) {
  return BLOCK_TAGS.has(element?.tagName);
}

/**
 * Serialize a contentEditable mention editor to plain text while preserving
 * line breaks. Browsers insert <br>, <div>, or <p> for Enter — all must map to \n.
 */
export function serializeMentionEditor(root) {
  if (!root) {
    return '';
  }

  let text = '';
  let isOnFreshLine = true;

  const walk = (nodes) => {
    nodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.textContent || '';
        if (value) {
          text += value;
          isOnFreshLine = false;
        }
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const element = node;

      if (element.dataset?.mentionId && element.dataset?.mentionLabel) {
        text += `@[${element.dataset.mentionId}|${element.dataset.mentionLabel}]`;
        isOnFreshLine = false;
        return;
      }

      if (element.tagName === 'BR') {
        text += '\n';
        isOnFreshLine = true;
        return;
      }

      if (isBlockElement(element) && !isOnFreshLine) {
        text += '\n';
        isOnFreshLine = true;
      }

      walk(element.childNodes);
    });
  };

  walk(root.childNodes);
  return text;
}

export function getSerializedCursorOffset(root) {
  const selection = window.getSelection();
  if (!root || !selection || selection.rangeCount === 0) {
    return serializeMentionEditor(root).length;
  }

  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.startContainer, range.startOffset);

  const container = document.createElement('div');
  container.appendChild(preRange.cloneContents());
  return serializeMentionEditor(container);
}

export function createMentionChip(userId, label) {
  const chip = document.createElement('span');
  chip.className =
    'mention-chip mx-0.5 inline-flex max-w-full items-center rounded-md bg-primary/10 px-1.5 py-0.5 align-baseline text-xs font-medium text-primary';
  chip.contentEditable = 'false';
  chip.dataset.mentionId = String(userId);
  chip.dataset.mentionLabel = label;
  chip.textContent = `@${label}`;
  return chip;
}

export function renderMentionEditor(root, text = '') {
  if (!root) {
    return;
  }

  root.innerHTML = '';
  const parts = splitMentionText(text);

  parts.forEach((part) => {
    if (part.type === 'mention') {
      root.appendChild(createMentionChip(part.userId, part.label));
      return;
    }

    const lines = part.value.split('\n');
    lines.forEach((line, index) => {
      if (line) {
        root.appendChild(document.createTextNode(line));
      }
      if (index < lines.length - 1) {
        root.appendChild(document.createElement('br'));
      }
    });
  });
}

export function setSerializedCursorOffset(root, offset) {
  const selection = window.getSelection();
  if (!root || !selection) {
    return;
  }

  const range = document.createRange();
  let remaining = Math.max(0, offset);
  let placed = false;
  let isOnFreshLine = true;

  const placeAtNode = (node, nodeOffset) => {
    range.setStart(node, nodeOffset);
    range.collapse(true);
    placed = true;
  };

  const consumeNewline = (beforeNode) => {
    if (remaining <= 0) {
      const parent = beforeNode.parentNode || root;
      placeAtNode(parent, Array.from(parent.childNodes).indexOf(beforeNode));
      return true;
    }
    remaining -= 1;
    isOnFreshLine = true;
    return false;
  };

  const walk = (node) => {
    if (placed) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length || 0;
      if (length > 0) {
        isOnFreshLine = false;
      }
      if (remaining <= length) {
        placeAtNode(node, remaining);
        return;
      }
      remaining -= length;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node;

    if (element.dataset?.mentionId && element.dataset?.mentionLabel) {
      const length = mentionTokenLength(element.dataset.mentionId, element.dataset.mentionLabel);
      isOnFreshLine = false;
      if (remaining <= length) {
        placeAtNode(element.parentNode || root, Array.from((element.parentNode || root).childNodes).indexOf(element) + 1);
        return;
      }
      remaining -= length;
      return;
    }

    if (element.tagName === 'BR') {
      if (consumeNewline(element)) {
        return;
      }
      return;
    }

    if (isBlockElement(element) && !isOnFreshLine) {
      if (consumeNewline(element)) {
        return;
      }
    }

    element.childNodes.forEach(walk);
  };

  root.childNodes.forEach(walk);

  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}
