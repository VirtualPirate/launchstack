import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, openAPI } from 'better-auth/plugins';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Resend } from 'resend';
import * as authSchema from '../databases/pg-drizzle/auth-schema';

export interface AuthConfig {
  db: PostgresJsDatabase<Record<string, unknown>>;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  resendApiKey: string;
  emailFrom: string;
  nodeEnv?: string;
}

export function createAuth(config: AuthConfig) {
  const resend = new Resend(config.resendApiKey);

  return betterAuth({
    database: drizzleAdapter(config.db, {
      provider: 'pg',
      schema: authSchema,
    }),
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    emailAndPassword: { enabled: true },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        sendVerificationOnSignUp: true,
        async sendVerificationOTP({ email, otp, type }) {
          const { data, error } = await resend.emails.send({
            from: config.emailFrom,
            to: email,
            subject:
              type === 'sign-in'
                ? `Your sign-in code: ${otp}`
                : type === 'email-verification'
                  ? `Verify your email: ${otp}`
                  : `Reset your password: ${otp}`,
            text: `Your verification code is: ${otp}. It expires in 5 minutes.`,
          });
          if (error) {
            console.error('Resend email failed:', error);
            throw new Error(`Failed to send OTP email: ${error.message}`);
          }
          console.log('OTP email sent:', data?.id);
        },
      }),
      ...(config.nodeEnv !== 'production' ? [openAPI()] : []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
