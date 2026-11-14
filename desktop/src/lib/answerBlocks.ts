/** One block of an assistant answer: a paragraph, or a run of list lines. */
export type AnswerBlock = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };

/**
 * Splits a plain-text answer into paragraphs and lists. Lines starting with "- " or "* "
 * form a list; blank lines end a paragraph. The text stays text: nothing is parsed as HTML.
 */
export function answerBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const last = blocks.at(-1);
      if (last?.kind === 'list') last.items.push(item[1]);
      else blocks.push({ kind: 'list', items: [item[1]] });
    } else if (!line) {
      flush();
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}
