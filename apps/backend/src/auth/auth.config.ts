import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP, openAPI } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Resend } from 'resend';
import * as authSchema from '../databases/pg-drizzle/auth-schema';
import { renderOtpEmail } from '../emails/render-email';
import { deriveKey, encrypt } from './crypto';

export interface AuthConfig {
  db: PostgresJsDatabase<Record<string, unknown>>;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  resendApiKey: string;
  emailFrom: string;
  nodeEnv?: string;
  googleClientId?: string;
  googleClientSecret?: string;
}

export function createAuth(config: AuthConfig) {
  const resend = new Resend(config.resendApiKey);
  const googleEnabled = config.googleClientId && config.googleClientSecret;
  const encryptionKey = deriveKey(config.secret);

  return betterAuth({
    database: drizzleAdapter(config.db, {
      provider: 'pg',
      schema: authSchema,
    }),
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    ...(googleEnabled && {
      socialProviders: {
        google: {
          clientId: config.googleClientId!,
          clientSecret: config.googleClientSecret!,
        },
      },
      account: {
        accountLinking: {
          enabled: true,
          trustedProviders: ['google'],
        },
      },
    }),
    emailAndPassword: { enabled: true },
    advanced: {
      disableCSRFCheck: config.nodeEnv !== 'production',
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-in/email') {
          return;
        }

        const email =
          typeof ctx.body === 'object' &&
          ctx.body !== null &&
          'email' in ctx.body &&
          typeof (ctx.body as { email?: unknown }).email === 'string'
            ? (ctx.body as { email: string }).email
            : undefined;

        if (!email) {
          return;
        }

        const [existingUser] = await config.db
          .select({ emailVerified: authSchema.user.emailVerified })
          .from(authSchema.user)
          .where(eq(authSchema.user.email, email))
          .limit(1);

        if (existingUser && !existingUser.emailVerified) {
          throw new APIError('FORBIDDEN', {
            message:
              'Please verify your email with the OTP code before signing in.',
          });
        }
      }),
    },
    databaseHooks: {
      account: {
        create: {
          before: (account) => {
            const encrypted = { ...account };
            if (account.accessToken) {
              encrypted.accessToken = encrypt(
                account.accessToken,
                encryptionKey,
              );
            }
            if (account.refreshToken) {
              encrypted.refreshToken = encrypt(
                account.refreshToken,
                encryptionKey,
              );
            }
            return Promise.resolve({ data: encrypted });
          },
        },
        update: {
          before: (account) => {
            const encrypted = { ...account };
            if (account.accessToken) {
              encrypted.accessToken = encrypt(
                account.accessToken,
                encryptionKey,
              );
            }
            if (account.refreshToken) {
              encrypted.refreshToken = encrypt(
                account.refreshToken,
                encryptionKey,
              );
            }
            return Promise.resolve({ data: encrypted });
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        sendVerificationOnSignUp: true,
        async sendVerificationOTP({ email, otp, type }) {
          const { subject, html, text } = await renderOtpEmail(otp, type);
          const { data, error } = await resend.emails.send({
            from: config.emailFrom,
            to: email,
            subject,
            html,
            text,
          });
          if (error) {
            console.error('Resend email failed (background):', error);
            return;
          }
          console.log('OTP email sent:', data?.id);
        },
      }),
      ...(config.nodeEnv !== 'production' ? [openAPI()] : []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
