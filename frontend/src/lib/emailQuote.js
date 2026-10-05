/**
 * Split plain-text email into normal text and ">"-quoted runs (nested for
 * ">>"), so quotes can render with Gmail's vertical line instead of markers.
 *
 * @returns {Array<{ type: 'text', value: string } | { type: 'quote', children: Array }>}
 */
export function parseQuotedText(text = '') {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const segments = [];
  let buffer = [];
  let quoted = [];

  const flushText = () => {
    if (buffer.length) {
      segments.push({ type: 'text', value: buffer.join('\n') });
      buffer = [];
    }
  };
  const flushQuote = () => {
    if (quoted.length) {
      segments.push({ type: 'quote', children: parseQuotedText(quoted.join('\n')) });
      quoted = [];
    }
  };

  lines.forEach((line) => {
    const match = line.match(/^\s*>\s?(.*)$/);
    if (match) {
      flushText();
      quoted.push(match[1]);
    } else {
      flushQuote();
      buffer.push(line);
    }
  });
  flushText();
  flushQuote();

  return segments;
}

export function hasQuotedLines(text = '') {
  return /^\s*>/m.test(String(text));
}
