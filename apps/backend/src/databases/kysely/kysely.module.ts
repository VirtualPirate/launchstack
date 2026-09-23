import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './database.types';
import { KYSELY_DB } from './kysely.token';

export type AppDatabase = Kysely<Database>;

@Global()
@Module({
  providers: [
    {
      provide: KYSELY_DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
        return new Kysely<Database>({
          dialect: new PostgresDialect({
            pool: new Pool({ connectionString: databaseUrl }),
          }),
          plugins: [new CamelCasePlugin()],
        });
      },
    },
  ],
  exports: [KYSELY_DB],
})
export class KyselyModule implements OnModuleDestroy {
  constructor(@Inject(KYSELY_DB) private readonly db: AppDatabase) {}

  async onModuleDestroy() {
    await this.db.destroy();
  }
}
