import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './databases/pg-drizzle';
import { AppAuthModule } from './auth';
import { OrganizationsModule } from './organizations';
import { PgBossModule } from './queue';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    PgBossModule.forRoot(),
    AppAuthModule,
    OrganizationsModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
