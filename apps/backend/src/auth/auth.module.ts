/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { DRIZZLE_DB } from '../databases/pg-drizzle';
import { createAuth } from './auth.config';

@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      inject: [DRIZZLE_DB, ConfigService],
      useFactory: (db: any, configService: ConfigService) => {
        const secret = configService.getOrThrow<string>('BETTER_AUTH_SECRET');
        const baseURL = configService.getOrThrow<string>('BETTER_AUTH_URL');
        const frontendURL = configService.getOrThrow<string>('FRONTEND_URL');
        const resendApiKey = configService.getOrThrow<string>('RESEND_API_KEY');
        const emailFrom = configService.getOrThrow<string>('EMAIL_FROM');
        return {
          auth: createAuth({
            db,
            secret,
            baseURL,
            trustedOrigins: [baseURL, frontendURL],
            resendApiKey,
            emailFrom,
            nodeEnv: configService.get<string>('NODE_ENV'),
          }),
        };
      },
    }),
  ],
})
export class AppAuthModule {}
