# Frontend — React + Vite + Tailwind v4

## Stack

React 19, Vite 7, TypeScript 5.9 (strict), TanStack Router v1 (code-based), TanStack Query v5, Zustand v5 (persisted stores), Tailwind CSS v4, shadcn/ui (Radix Nova style), Axios, Better Auth client (email OTP plugin), Zod v4, sonner (toasts), lucide-react (icons).

## Commands

```bash
pnpm dev          # Vite dev server on :5173 (or `pnpm dev:frontend` from repo root)
pnpm build        # tsc -b && vite build
pnpm lint         # eslint .
pnpm test         # node src/lib/auth-redirect.check.ts (the only frontend check)
pnpm preview      # Preview production build
pnpm dlx shadcn@latest add <component>   # Add a shadcn/ui component
```

## Directory Layout

```
src/
  api/                       # axios-client.ts + one <domain>.api.ts per backend domain (auth.api.ts is the AuthAPI facade)
  components/
    auth/                    # Email/Google auth forms, PasswordInput
    organization/            # Org switcher, invite form, role badge
    shared/                  # PageHeader, EmptyState, ErrorState, SkeletonList, SectionLabel
    theme/                   # ThemeProvider + toggles
    ui/                      # shadcn/ui primitives
  env/config-env.ts          # Zod-validated env (globalEnv)
  hooks/
    api/use-<domain>.ts      # React Query hooks + query-key factory per domain
    use-bootstrap-active-organization.ts
  lib/                       # auth-client, auth-redirect, extract-error, query-client, utils (cn)
  routes/                    # One page component per route (<name>.tsx exports <Name>Page)
  stores/                    # Zustand stores (active org)
  router.tsx                 # ALL route definitions (code-based TanStack Router)
  App.tsx                    # Protected layout: header, sidebar, <Outlet/>
  main.tsx                   # ThemeProvider > QueryClientProvider > RouterProvider + Toaster
  index.css                  # Tailwind imports + CSS variable theme (oklch)
```

## Path Alias

`@` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).

## Routing

Routes are defined **code-based** in `src/router.tsx` (no file-based routing plugin). Two tiers under the root route:

- **Public routes** — `/sign-in`, `/sign-up`, `/google-sign-in`, `/google-sign-up`, `/verify-email`, `/forgot-password`, `/reset-password`, `/auth/error`, `/accept-invite`. The auth pages' `beforeLoad` (`redirectAuthenticatedUser`) sends an already-signed-in user on to their redirect target.
- **`protectedRoute`** (pathless, `id: "protected"`) — wraps everything else. Its `beforeLoad` calls `AuthAPI.getSession()`: no session → `clearSignedOutUserState()` and redirect to `/sign-in?redirect=<path>`; unverified email → `/verify-email`. Its component is `App`.

To add a page:
1. Create `src/routes/<kebab-name>.tsx` exporting a named `<PascalName>Page` component.
2. In `router.tsx`: `createRoute({ getParentRoute: () => protectedRoute, path: "...", component: ... })` and add it to the `protectedRoute.addChildren([...])` list in `routeTree`.

Search params are validated with hand-written `validateSearch` functions (plain `typeof` checks returning a typed object, not Zod). A redirect target from a search param must go through `normalizeRedirectPath` from `@/lib/auth-redirect`, which rejects anything that resolves off-origin.

## Organization Scoping (cross-cutting)

Most data is scoped to the active organization:

- `useActiveOrganizationStore` (Zustand, persisted to localStorage) holds `activeOrganizationId`.
- The axios request interceptor (`src/api/axios-client.ts`) sends it as the `X-Organization-Id` header on **every** request. Backend URLs use `/api/organizations/current/...`.
- `useBootstrapActiveOrganization()` (called once in `App`) selects the first org when none is active, and drops the selection only when a list fetched during this mount no longer contains it.
- After deleting or leaving the active org, call `useExitActiveOrganization()`: it picks the next org from a fresh list and navigates.
- Every org-scoped query includes `orgId` in its key and gates with `enabled: !!orgId`, so switching orgs refetches automatically.

## API Integration Pattern

When integrating a backend endpoint, always create **two files**: an API module and a React Query hook file.

### 1. API module — `src/api/<domain>.api.ts`

Export a plain object named `<Domain>API` with async methods. Use `axiosInstance.request()` and return typed `response.data`.

```typescript
import type { ApiResponse, OrganizationMember } from "@launchstack/api-interfaces";
import { axiosInstance } from "./axios-client";

export const MembersAPI = {
  listCurrent: async (): Promise<ApiResponse<OrganizationMember[]>> => {
    const response = await axiosInstance.request({
      url: "/api/organizations/current/members",
      method: "GET",
    });
    return response.data as ApiResponse<OrganizationMember[]>;
  },
};
```

Rules:

- One file per backend domain/controller.
- Always use `axiosInstance.request({ url, method, params?, data? })` — not `axiosInstance.get()` / `.post()`.
- GET requests pass query parameters via `params`. POST/PUT/PATCH pass body via `data`.
- Import request/response types from `@launchstack/api-interfaces`. Never duplicate types locally.

### 2. React Query hooks — `src/hooks/api/use-<domain>.ts`

Each hook file exports a **query-key factory** plus `use<Verb><Noun>` hooks:

```typescript
export const membersKeys = {
  list: (activeOrgId: string | null) =>
    ["organizations", "current", activeOrgId, "members"] as const,
};

export function useCurrentOrganizationMembers() {
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useQuery({
    queryKey: membersKeys.list(activeOrgId),
    queryFn: () => MembersAPI.listCurrent(),
    enabled: !!activeOrgId,
  });
}
```

Rules:

- Key factories take `orgId` as their first argument for org-scoped data. Include every argument that affects the request.
- Gate queries with `enabled` (`!!orgId`, `!!id`).
- Mutations invalidate through the key factory in `onSuccess` (`queryClient.invalidateQueries({ queryKey: membersKeys.list(orgId) })`). Prefix matching covers filtered variants.
- Cursor-paginated lists use `useInfiniteQuery` with `initialPageParam: undefined` and `getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined`.
- For an in-progress resource, poll with a conditional `refetchInterval` that reads the response status (`refetchInterval: (q) => q.state.data?.data.status === "running" ? 3000 : false`). Never poll unconditionally.
- Hook functions are named `use<Verb><Noun>`. One hook file per API module.

### Common mistakes

```typescript
// BAD: fetching in a component with useEffect + axios
// GOOD: const { data, isLoading } = useCurrentOrganizationMembers();

// BAD: defining response interfaces in the frontend
// GOOD: import type { OrganizationMember } from "@launchstack/api-interfaces";
```

## Auth

- `src/lib/auth-client.ts` creates the Better Auth client (`createAuthClient` with the `emailOTPClient()` plugin, `baseURL: globalEnv.apiBaseUri`).
- **Components and routes never call `authClient` directly.** They go through the `AuthAPI` facade (`src/api/auth.api.ts`), which wraps the authClient methods (sign-in/up, Google OAuth, session, sign-out, password reset) and raw OTP endpoints, typed via `AuthClientResult<T>` from `@launchstack/api-interfaces`. Hooks over it live in `hooks/api/use-auth.ts`.
- Sessions are cookie-based (`withCredentials: true` on the axios instance). There is no token handling in the frontend.
- When a session ends, `clearSignedOutUserState()` clears the QueryClient and the active org so the next user in the tab sees nothing cached.
- Auth pages pass `redirect`/`email` search params. Build URLs with the helpers in `@/lib/auth-redirect`.

## Client State (Zustand)

Server state lives in React Query. Zustand is only for cross-cutting client state, persisted to localStorage via the `persist` middleware:

- `active-organization-store.ts` — active org id (key `launchstack.activeOrganization`).

Never copy server data into a store.

## UI & Feedback

- shadcn/ui primitives in `src/components/ui/`. Add new ones via `pnpm dlx shadcn@latest add <component>`. Feature components compose them under `src/components/<domain>/`.
- Layout primitives in `src/components/shared/`: `PageHeader` for every page title, `EmptyState` / `ErrorState` / `SkeletonList` for empty, failed and loading lists. See `DESIGN.md`.
- Use `Input` / `Label` from `components/ui`, never a raw `<input>` with copied classes.
- Merge classNames with `cn()` from `@/lib/utils`; use CVA for variants; icons from `lucide-react`.
- Toasts: `toast.success(...)` / `toast.error(extractErrorMessage(err))` from `sonner`. `extractErrorMessage` (`@/lib/extract-error`) reads the API's `response.data.message` instead of Axios's generic text. The `<Toaster/>` is mounted in `main.tsx`. Form errors stay inline; toasts are for actions without a form (buttons, menus). Auth routes keep their own `getErrorMessage`, because Better Auth errors have a different shape.

## Styling

- Tailwind CSS v4 via `@tailwindcss/vite` plugin — no `tailwind.config.js`, config is in `src/index.css`.
- Theme uses CSS custom properties in oklch color space (light + dark mode via `.dark` class, with matching `color-scheme`).
- Dark mode: custom `ThemeProvider` (`light | dark | system`, localStorage key `launchstack-theme`) toggles `.dark`; an inline script in `index.html` applies it before first paint. Read it with `useTheme()` from `@/components/theme/theme-provider`.
- Font: Geist Variable (`@fontsource-variable/geist`). Animations: `tw-animate-css`.

## Environment Variables

Validated with Zod in `src/env/config-env.ts` and exposed as `globalEnv` with **camelCase keys**:

```typescript
import { globalEnv } from "@/env/config-env";
globalEnv.apiBaseUri; // from VITE_API_BASE_URI
```

Copy `.env.example` to `.env`. It requires `VITE_API_BASE_URI=http://localhost:3000`. Vite reads `.env` at startup, so restart the dev server after a change.

## Shared Packages

- `@launchstack/api-interfaces` — `ApiResponse<T>`, `PaginatedResponse<T>`, `ApiError`, plus per-domain request types (`src/requests/`) and response types (`src/responses/`). All API payload types come from here.
- `@launchstack/core` — Utilities: `formatDate`, `generateId`, `isValidEmail`, `isEmpty`, constants (`API_VERSION`, `DEFAULT_PAGE_SIZE`).

Rebuild shared packages after changing them (`pnpm build:packages` from repo root). Apps consume the built output.
