import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './databases/pg-drizzle';
import { AppAuthModule } from './auth';
import { OrganizationsModule } from './organizations';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    AppAuthModule,
    OrganizationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
