import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import * as express from 'express';
import { NoopController } from './noop.controller';
import { NoopHandler } from './noop.handler';

@Module({
  controllers: [NoopController],
  providers: [NoopHandler],
})
export class QueueModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(express.json()).forRoutes(NoopController);
  }
}
