# TODOS

## Social OAuth Providers
**What:** Add GitHub and Google OAuth to BetterAuth socialProviders config.
**Why:** Email/password is minimum viable. Social login reduces friction for users who don't want to create passwords.
**Effort:** human: ~1hr / CC: ~5min
**Depends on:** BetterAuth base setup (this branch)
**Context:** BetterAuth supports socialProviders natively via config. Requires creating OAuth apps with each provider and adding client ID/secret env vars. No plugins needed.
**Also:** Update `.requestly/collections/betterauth-api.json` with OAuth endpoint configs when providers are added.

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
