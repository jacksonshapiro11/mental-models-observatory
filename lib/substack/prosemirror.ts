/**
 * Markdown → Substack ProseMirror doc.
 *
 * Covers the Brief Light / Weekly Light markdown subset: headings, paragraphs,
 * horizontal rules, blockquotes, bullet lists, and inline bold / italic /
 * links (including links nested inside bold, e.g. **[→ Explore](url)**).
 *
 * Node shapes mirror python-substack's `substack/nodes.py` — the one working
 * reference for Substack's (undocumented) editor schema. Keep changes in sync
 * with scripts/publish-substack.py.
 */

export interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface PMNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: PMMark[];
  content?: PMNode[];
}

function textNode(text: string, marks: PMMark[]): PMNode {
  const node: PMNode = { type: 'text', text };
  if (marks.length > 0) node.marks = marks;
  return node;
}

interface InlinePattern {
  re: RegExp;
  mark: (m: RegExpExecArray) => PMMark;
  inner: (m: RegExpExecArray) => string;
}

// Order matters on index ties: bold before italic so `**x**` never
// half-matches as italic.
const INLINE_PATTERNS: InlinePattern[] = [
  {
    re: /\*\*(.+?)\*\*/,
    mark: () => ({ type: 'strong' }),
    inner: m => m[1] ?? '',
  },
  {
    re: /(?<!\*)\*([^*]+)\*(?!\*)/,
    mark: () => ({ type: 'em' }),
    inner: m => m[1] ?? '',
  },
  {
    re: /\[([^\]]+)\]\(([^)]+)\)/,
    mark: m => ({ type: 'link', attrs: { href: m[2] ?? '' } }),
    inner: m => m[1] ?? '',
  },
];

/** Parse inline markdown into text nodes, recursing so marks can nest. */
export function parseInline(text: string, marks: PMMark[] = []): PMNode[] {
  if (!text) return [];

  let earliest: { index: number; m: RegExpExecArray; p: InlinePattern } | null =
    null;
  for (const p of INLINE_PATTERNS) {
    const m = p.re.exec(text);
    if (m && (earliest === null || m.index < earliest.index)) {
      earliest = { index: m.index, m, p };
    }
  }

  if (!earliest) return [textNode(text, marks)];

  const { index, m, p } = earliest;
  const out: PMNode[] = [];
  if (index > 0) out.push(textNode(text.slice(0, index), marks));
  out.push(...parseInline(p.inner(m), [...marks, p.mark(m)]));
  const rest = text.slice(index + m[0].length);
  if (rest) out.push(...parseInline(rest, marks));
  return out;
}

function paragraph(inline: PMNode[]): PMNode {
  return { type: 'paragraph', content: inline };
}

function heading(inline: PMNode[], level: number): PMNode {
  return { type: 'heading', attrs: { level }, content: inline };
}

/** Convert block-level markdown into a list of ProseMirror block nodes. */
export function markdownToBlocks(markdown: string): PMNode[] {
  const lines = markdown.split('\n');
  const blocks: PMNode[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push(paragraph(parseInline(para.join(' ').trim())));
      para = [];
    }
  };
  const flushQuote = () => {
    if (quote.length > 0) {
      blocks.push({
        type: 'blockquote',
        content: [paragraph(parseInline(quote.join(' ').trim()))],
      });
      quote = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({
        type: 'bullet_list',
        content: list.map(item => ({
          type: 'list_item',
          content: [paragraph(parseInline(item))],
        })),
      });
      list = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === '') {
      flushAll();
      continue;
    }
    if (line.startsWith('<!--')) continue;

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushAll();
      blocks.push(heading(parseInline((h[2] ?? '').trim()), h[1]?.length ?? 1));
      continue;
    }
    if (/^(---+|\*\*\*+|___+)$/.test(line)) {
      flushAll();
      blocks.push({ type: 'horizontal_rule' });
      continue;
    }
    if (line.startsWith('> ') || line === '>') {
      flushPara();
      flushList();
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(line);
    if (li) {
      flushPara();
      flushQuote();
      list.push((li[1] ?? '').trim());
      continue;
    }

    flushQuote();
    flushList();
    para.push(line);
  }
  flushAll();

  return blocks;
}

/** Full ProseMirror document for a markdown body. */
export function markdownToDoc(markdown: string): PMNode {
  return { type: 'doc', content: markdownToBlocks(markdown) };
}
