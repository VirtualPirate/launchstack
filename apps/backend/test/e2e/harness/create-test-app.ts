import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';

export interface TestApp {
  app: INestApplication;
  server: Server;
  close: () => Promise<void>;
}

/** Minimal shape of what we need off the wrapper's AuthService. */
type AuthServiceLike = {
  instance: { options: { database?: { end?: () => Promise<void> } } };
};

/**
 * Boot AppModule against whatever DATABASE_URL and TEMPORAL_ADDRESS are
 * currently in process.env.
 *
 * Imports are dynamic and deliberately inside the function: the module graph
 * must not load until the calling file's `beforeAll` has set its env. Vitest
 * isolates module registries per test file, so a file that needs different env
 * (see the worker spec's per-file task queue) can set it before the first call
 * here without affecting any other file.
 *
 * `controllers` mounts extra routes next to AppModule's, under the same global
 * guards: for exercising a guard against a route shape no real controller has.
 */
export async function createTestApp(
  opts: { controllers?: Type[] } = {},
): Promise<TestApp> {
  const { AppModule } = await import('../../../src/app.module');
  const { configureApp } = await import('../../../src/bootstrap/configure-app');
  const { AuthService } = await import('@thallesp/nestjs-better-auth');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: opts.controllers,
  }).compile();

  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureApp(app);
  await app.init();

  // createAuth() builds Better Auth its own pg.Pool (search_path=auth) and
  // nothing in the DI graph owns it, so app.close() leaves it open. betterAuth()
  // returns the options object it was handed verbatim, so options.database is
  // that Pool. Resolve the handle now, while the app is still up.
  // The wrapper types `instance` as `{ api: any }`, so `options` is invisible
  // to TypeScript even though betterAuth() returns the options object it was
  // handed verbatim. Cast to the one property this needs.
  const authService: AuthServiceLike = app.get(AuthService);
  const authPool = authService.instance.options.database;

  return {
    app,
    server: app.getHttpServer() as Server,
    close: async () => {
      // Order matters: close the app first so in-flight requests finish
      // against a live auth pool.
      await app.close();
      if (typeof authPool?.end === 'function') {
        await authPool.end();
      }
    },
  };
}
