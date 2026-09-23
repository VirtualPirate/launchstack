// Run: pnpm --filter frontend test  (Node >= 22.18 strips the types itself)
import {
  DEFAULT_AUTH_REDIRECT_PATH,
  normalizeRedirectPath,
} from "./auth-redirect.ts";

Object.assign(globalThis, {
  window: { location: { origin: "https://app.example" } },
});

const cases: [input: string, expected: string][] = [
  ["/settings", "/settings"],
  ["/a?b=1#c", "/a?b=1#c"],
  ["//evil.com", DEFAULT_AUTH_REDIRECT_PATH],
  ["/\\evil.com", DEFAULT_AUTH_REDIRECT_PATH],
  ["/\t/evil.com", DEFAULT_AUTH_REDIRECT_PATH],
  ["/\n/evil.com", DEFAULT_AUTH_REDIRECT_PATH],
  ["https://evil.com", DEFAULT_AUTH_REDIRECT_PATH],
  ["javascript:alert(1)", DEFAULT_AUTH_REDIRECT_PATH],
];

for (const [input, expected] of cases) {
  const actual = normalizeRedirectPath(input);
  if (actual !== expected) {
    throw new Error(
      `normalizeRedirectPath(${JSON.stringify(input)}) = ${actual}, want ${expected}`,
    );
  }
}
console.log(`auth-redirect: ${cases.length} cases ok`);
