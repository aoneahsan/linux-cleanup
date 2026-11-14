import { describe, expect, it } from 'vitest';
import { answerBlocks } from './answerBlocks';

describe('answerBlocks', () => {
  it('splits paragraphs and groups list lines', () => {
    expect(answerBlocks('Here is the preview.\n- Section 5 is routine.\n- Logs are small.\n\nRun it when you are ready.')).toEqual([
      { kind: 'p', text: 'Here is the preview.' },
      { kind: 'list', items: ['Section 5 is routine.', 'Logs are small.'] },
      { kind: 'p', text: 'Run it when you are ready.' },
    ]);
  });

  it('keeps markup-looking text as plain text', () => {
    expect(answerBlocks('<b>not html</b>')).toEqual([{ kind: 'p', text: '<b>not html</b>' }]);
  });
});
