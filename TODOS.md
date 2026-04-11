# TODOS

## GitHub OAuth Provider
**What:** Add GitHub OAuth to BetterAuth socialProviders config (Google OAuth is already done).
**Why:** Social login reduces friction. GitHub is structurally identical to the existing Google OAuth setup.
**Effort:** human: ~30min / CC: ~2min
**Depends on:** Google OAuth setup (done)
**Context:** Same pattern as Google: add `githubClientId`/`githubClientSecret` to AuthConfig, conditional spread in socialProviders, add to trustedProviders array, 2 env vars. Also add `github` to the `trustedProviders` array alongside `google`.

## Frontend Auth Client
**What:** Install better-auth/react in frontend, create auth client, add sign-up/sign-in forms, protect routes.
**Why:** Backend auth is useless without a frontend that uses it. The React frontend has no auth integration.
**Effort:** human: ~4hrs / CC: ~15min
**Depends on:** BetterAuth base setup + CORS config (this branch)
**Context:** BetterAuth provides React hooks (useSession, signIn, signUp). Frontend needs React Router or similar for route protection. CORS is configured via trustedOrigins in this setup.

## NestJS Swagger for Non-Auth Routes
**What:** Add @nestjs/swagger to document non-auth endpoints (GET /, GET /users, future routes).
**Why:** The Better Auth OpenAPI plugin only documents auth routes. As the API grows, non-auth routes need docs too.
**Effort:** human: ~2hrs / CC: ~10min
**Depends on:** OpenAPI plugin setup (this PR)
**Context:** @nestjs/swagger can coexist with Better Auth's OpenAPI. Scalar supports multiple sources, so both can feed into one docs page.
