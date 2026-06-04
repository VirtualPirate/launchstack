import {
  BRIEF_SYSTEM_PROMPT,
  buildBriefUserPrompt,
  type BriefPromptCommit,
} from '../services/brief-summary-prompt';

const period = {
  start: new Date('2026-05-19T00:00:00Z'),
  end: new Date('2026-05-25T23:59:59Z'),
};

const commits: BriefPromptCommit[] = [
  {
    sha: 'abc123',
    authorName: 'Ada',
    authorEmail: 'ada@x.io',
    messageFirstLine: 'feat: notifications',
    analysis: {
      commitType: 'feature',
      summary: 'Add push notifications end-to-end',
      changes: ['Register device tokens', 'Deliver test push'],
    },
  },
  {
    sha: 'def456',
    authorName: 'Grace',
    authorEmail: 'grace@x.io',
    messageFirstLine: 'perf: cache checkout',
    analysis: null,
  },
];

describe('BRIEF_SYSTEM_PROMPT', () => {
  it('contains the one-paragraph instruction', () => {
    expect(BRIEF_SYSTEM_PROMPT).toMatch(/single cohesive paragraph/i);
    expect(BRIEF_SYSTEM_PROMPT).toMatch(/do not use headings/i);
  });
});

describe('buildBriefUserPrompt', () => {
  it('renders scope, period, and commit lines', () => {
    const out = buildBriefUserPrompt({
      scopeLabel: 'Project: Mobile',
      period,
      commits,
      maxChars: 10_000,
    });
    expect(out).toContain('Project: Mobile');
    expect(out).toContain('May 19, 2026');
    expect(out).toContain('[feature] Add push notifications end-to-end');
    expect(out).toContain('Register device tokens');
    expect(out).toContain('perf: cache checkout');
  });

  it('drops oldest commits and annotates omissions when over budget', () => {
    const many: BriefPromptCommit[] = Array.from({ length: 50 }, (_, i) => ({
      sha: `c${i}`,
      authorName: `A${i}`,
      authorEmail: `a${i}@x.io`,
      messageFirstLine: `commit ${i} with a reasonably long description that adds bulk`,
      analysis: null,
    }));
    const out = buildBriefUserPrompt({
      scopeLabel: 'Project: P',
      period,
      commits: many,
      maxChars: 800,
    });
    expect(out).toMatch(/\(\d+ commits omitted\)/);
    expect(out.length).toBeLessThanOrEqual(900);
  });
});
