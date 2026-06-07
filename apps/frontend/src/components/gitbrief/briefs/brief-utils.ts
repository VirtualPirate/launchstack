import type { BriefResponse } from "@launchstack/api-interfaces";

const NO_ACTIVITY_TITLE_SUFFIX = " — no activity";

/**
 * A brief is "no activity" when it reached a terminal status with zero commits.
 * Guarding on terminal status avoids mislabeling a brief that is still
 * generating — those also report commitCount: 0.
 */
export function isNoActivityBrief(brief: BriefResponse): boolean {
  return (
    (brief.status === "generated" || brief.status === "delivered") &&
    brief.commitCount === 0
  );
}

/**
 * The backend appends " — no activity" to the title of an empty brief
 * (generate-brief.handler.ts). Strip it so the UI can show a clean scope name
 * next to the dedicated badge. Falls back to the original title if absent.
 */
export function stripNoActivitySuffix(title: string): string {
  return title.endsWith(NO_ACTIVITY_TITLE_SUFFIX)
    ? title.slice(0, -NO_ACTIVITY_TITLE_SUFFIX.length)
    : title;
}
