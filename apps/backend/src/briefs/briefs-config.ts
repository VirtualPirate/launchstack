import type { ConfigService } from '@nestjs/config';

export const DEFAULT_MAX_PROMPT_CHARS = 30_000;
export const DEFAULT_DISPATCHER_INTERVAL_SECONDS = 60;
export const DEFAULT_BRIEF_MODEL = 'gpt-4o-mini';
export const DEFAULT_BACKFILL_MAX_BRIEFS = 366;

export interface BriefsConfig {
  apiKey: string;
  model: string;
  maxPromptChars: number;
  dispatcherIntervalSeconds: number;
  backfillMaxBriefs: number;
}

export function loadBriefsConfig(config: ConfigService): BriefsConfig | null {
  const apiKey = config.get<string>('OPENAI_API_KEY');
  if (!apiKey) return null;

  const maxPromptChars = Number.parseInt(
    config.get<string>('BRIEFS_MAX_PROMPT_CHARS') ?? '',
    10,
  );
  const dispatcherIntervalSeconds = Number.parseInt(
    config.get<string>('BRIEFS_DISPATCHER_INTERVAL_SECONDS') ?? '',
    10,
  );
  const backfillMaxBriefs = Number.parseInt(
    config.get<string>('BRIEFS_BACKFILL_MAX_BRIEFS') ?? '',
    10,
  );

  return {
    apiKey,
    model: config.get<string>('OPENAI_BRIEF_MODEL') || DEFAULT_BRIEF_MODEL,
    maxPromptChars:
      Number.isFinite(maxPromptChars) && maxPromptChars > 0
        ? maxPromptChars
        : DEFAULT_MAX_PROMPT_CHARS,
    dispatcherIntervalSeconds:
      Number.isFinite(dispatcherIntervalSeconds) &&
      dispatcherIntervalSeconds > 0
        ? dispatcherIntervalSeconds
        : DEFAULT_DISPATCHER_INTERVAL_SECONDS,
    backfillMaxBriefs:
      Number.isFinite(backfillMaxBriefs) && backfillMaxBriefs > 0
        ? backfillMaxBriefs
        : DEFAULT_BACKFILL_MAX_BRIEFS,
  };
}
