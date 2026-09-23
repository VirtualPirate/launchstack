import { QueryClient } from "@tanstack/react-query";

/**
 * The app's single QueryClient. Lives outside `main.tsx` so the router's
 * `beforeLoad` guard can wipe per-user cache when a session ends on its own.
 */
export const queryClient = new QueryClient();
