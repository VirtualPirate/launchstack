import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KyselyModule } from './databases/kysely';
import { AppAuthModule } from './auth';
import { OrganizationsModule } from './organizations';
import { QueueModule } from './queue/queue.module';
import { TemporalModule } from './temporal';
import { LoggerModule, RequestIdMiddleware } from './logger';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    KyselyModule,
    TemporalModule.forRoot(),
    AppAuthModule,
    OrganizationsModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
