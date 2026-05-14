import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import * as authSchema from './auth-schema';
import * as githubSchema from './github-schema';
import { DRIZZLE_DB } from './drizzle.token';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
        const client = postgres(databaseUrl);
        return drizzle(client, {
          schema: { ...schema, ...authSchema, ...githubSchema },
        });
      },
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DrizzleModule implements OnModuleDestroy {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: ReturnType<typeof drizzle>,
  ) {}

  async onModuleDestroy() {
    await this.db.$client.end();
  }
}
