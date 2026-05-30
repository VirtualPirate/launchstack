# Frontend — React + Vite + Tailwind v4

## Stack

React 19, Vite 7, TypeScript 5.9 (strict), Tailwind CSS v4, shadcn/ui (Radix Nova style), React Query v5, Axios, Better Auth client, Zod v4.

## Directory Layout

```
src/
  api/
    axios-client.ts          # Shared Axios instance (uses globalEnv)
    <domain>.api.ts           # API module per domain
  components/
    ui/                       # shadcn/ui components (Button, Card, Avatar, Separator, etc.)
  env/
    config-env.ts             # Zod-validated env vars (VITE_API_BASE_URI)
  hooks/
    api/
      use-<domain>.ts         # React Query hooks per domain
  lib/
    auth-client.ts            # Better Auth client (createAuthClient)
    utils.ts                  # cn() — clsx + tailwind-merge
  assets/                     # Static assets
  App.tsx                     # Main app component
  main.tsx                    # Entry — mounts React root with QueryClientProvider
  index.css                   # Tailwind imports + CSS variable theme (oklch)
```

## Path Alias

`@` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).

## API Integration Pattern

When integrating a backend endpoint, always create **two files**: an API module and a React Query hook.

### 1. API module — `src/api/<domain>.api.ts`

Export a plain object named `<Domain>API` with async methods. Use `axiosInstance.request()` and return typed `response.data`.

```typescript
import { ApiResponse } from "@launchstack/api-interfaces";
import { axiosInstance } from "./axios-client";

export const AppAPI = {
  getHello: async (): Promise<
    ApiResponse<{ message: string; version: string }>
  > => {
    const response = await axiosInstance.request({
      url: "/",
      method: "GET",
    });
    return response.data as ApiResponse<{ message: string; version: string }>;
  },
};
```

Rules:

- One file per backend domain/controller (e.g. `users.api.ts`, `organizations.api.ts`).
- Always use `axiosInstance.request({ url, method, params?, data? })` — not `axiosInstance.get()` / `.post()`.
- GET requests pass query parameters via `params`. POST/PUT/PATCH pass body via `data`.
- Import request/response types from `@launchstack/api-interfaces`. Never duplicate types locally.
- Return `response.data` with a type assertion matching the endpoint's return type.

### 2. React Query hook — `src/hooks/api/use-<domain>.ts`

Export named functions wrapping `useQuery` (reads) or `useMutation` (writes).

```typescript
import { useQuery } from "@tanstack/react-query";
import { ApiResponse } from "@launchstack/api-interfaces";
import { AppAPI } from "../../api/app.api";

export function useGetHello() {
  return useQuery<ApiResponse<{ message: string; version: string }>>({
    queryKey: ["app", "hello"],
    queryFn: () => AppAPI.getHello(),
  });
}
```

Rules:

- Query keys follow `["<domain>", "<action>", ...params]` — include all arguments that affect the request.
- Use `enabled` for conditional fetching (e.g. `enabled: !!id`).
- Hook functions are named `use<Verb><Noun>` (e.g. `useGetUsers`, `useCreateOrganization`).
- One hook file per API module. Multiple hooks per file are fine when they share a domain.

### Common mistakes

```typescript
// BAD: fetching directly in a component without the hook layer
const [data, setData] = useState(null);
useEffect(() => {
  axiosInstance.get("/").then((r) => setData(r.data));
}, []);

// GOOD: use the hook
const { data, isLoading } = useGetHello();
```

```typescript
// BAD: duplicating interface types in the frontend
interface HelloResponse {
  message: string;
  version: string;
}

// GOOD: import from shared package
import { ApiResponse } from "@launchstack/api-interfaces";
```

## UI Components

- shadcn/ui components live in `src/components/ui/`. Add new ones via `pnpm dlx shadcn@latest add <component>`.
- Components wrap Radix UI primitives with Tailwind styling and use `data-slot` attributes.
- Use `class-variance-authority` (CVA) for variant-based component styling.
- Always merge classNames with `cn()` from `@/lib/utils` (clsx + tailwind-merge).
- Icons come from `lucide-react`.

## Styling

- Tailwind CSS v4 via `@tailwindcss/vite` plugin — no `tailwind.config.js`, config is in `src/index.css`.
- Theme uses CSS custom properties in oklch color space (light + dark mode via `.dark` class).
- Font: Geist Variable (`@fontsource-variable/geist`).
- Animations: `tw-animate-css`.

## Auth

Better Auth client initialized in `src/lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
});
```

Use `authClient.signIn.social({ provider, callbackURL })` for OAuth, and the other `authClient` methods for email/password, OTP, session management.

## Environment Variables

Validated with Zod in `src/env/config-env.ts`. Access via `globalEnv`:

```typescript
import { globalEnv } from "@/env/config-env";
// globalEnv.VITE_API_BASE_URI
```

Frontend `.env` requires: `VITE_API_BASE_URI=http://localhost:3000`

## Shared Packages

- `@launchstack/api-interfaces` — Types: `ApiResponse<T>`, `User`, `CreateUserDto`, `PaginatedResponse<T>`, `ApiError`
- `@launchstack/core` — Utilities: `formatDate`, `generateId`, `isValidEmail`, `isEmpty`, constants (`API_VERSION`, `DEFAULT_PAGE_SIZE`)
