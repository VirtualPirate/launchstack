import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { Resend } from 'resend';
import { renderOtpEmail } from '../emails/render-email';
import type { Auth } from './auth.config';

@Injectable()
export class EmailOtpService {
  private readonly resend: Resend;
  private readonly emailFrom: string;

  constructor(
    private readonly authService: AuthService<Auth>,
    private readonly configService: ConfigService,
  ) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );
    this.emailFrom = this.configService.getOrThrow<string>('EMAIL_FROM');
  }

  async sendVerificationOtp(
    email: string,
    type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email',
  ): Promise<void> {
    let otp: string;
    try {
      otp = await this.authService.api.createVerificationOTP({
        body: { email, type },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create OTP';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }

    const { subject, html, text } = await renderOtpEmail(otp, type);

    const { data, error } = await this.resend.emails.send({
      from: this.emailFrom,
      to: email,
      subject,
      html,
      text,
    });

    if (error) {
      throw new HttpException(
        `Failed to send verification email: ${error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    console.log('OTP email sent:', data?.id);
  }
}
