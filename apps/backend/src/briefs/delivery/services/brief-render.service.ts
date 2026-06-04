import { Injectable } from '@nestjs/common';

export interface RenderableBrief {
  id: string;
  title: string;
  briefInfoTitle: string;
  summary: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class BriefRenderService {
  toEmail(brief: RenderableBrief): string {
    return [
      '<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 0 auto;">',
      `  <h1 style="margin: 0 0 8px 0; font-size: 22px;">${escapeHtml(brief.title)}</h1>`,
      `  <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px;">${escapeHtml(brief.briefInfoTitle)}</p>`,
      `  <p style="margin: 0; font-size: 15px; line-height: 1.6;">${escapeHtml(brief.summary)}</p>`,
      '</div>',
    ].join('\n');
  }

  toSlackMarkdown(brief: RenderableBrief): string {
    return `*${brief.title}*\n_${brief.briefInfoTitle}_\n\n${brief.summary}`;
  }

  emailSubject(brief: RenderableBrief): string {
    return brief.title || 'Engineering brief';
  }
}
