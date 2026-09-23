// Pin the process zone to UTC. The `auth` schema keeps Better Auth's naive
// `timestamp` columns, which only round-trip while every process shares one
// zone. The API and the worker both boot AppAuthModule, so a deploy where their
// TZ differs shifts session and OTP expiry. Overridable via the TZ env var.
process.env.TZ ??= 'UTC';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
