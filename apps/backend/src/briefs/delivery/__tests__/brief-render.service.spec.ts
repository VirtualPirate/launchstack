import { BriefRenderService } from '../services/brief-render.service';

const svc = new BriefRenderService();

const brief = {
  id: 'b1',
  title: 'Mobile shipped notifications',
  briefInfoTitle: 'May 19 – May 25, 2026 · 3 contributors · 24 commits',
  summary: 'We shipped notifications and improved checkout perf.',
};

describe('BriefRenderService', () => {
  it('toEmail produces an HTML body with title, info, summary', () => {
    const html = svc.toEmail(brief);
    expect(html).toContain('<h1');
    expect(html).toContain('Mobile shipped notifications');
    expect(html).toContain(brief.briefInfoTitle);
    expect(html).toContain(brief.summary);
  });

  it('toSlackMarkdown produces title bolded + info italic + summary', () => {
    const md = svc.toSlackMarkdown(brief);
    expect(md.startsWith('*Mobile shipped notifications*')).toBe(true);
    expect(md).toContain(`_${brief.briefInfoTitle}_`);
    expect(md).toContain(brief.summary);
  });
});
