import { createAuthClient } from "better-auth/react";
import { globalEnv } from "@/env/config-env";

export const authClient = createAuthClient({
  baseURL: globalEnv.apiBaseUri,
});
