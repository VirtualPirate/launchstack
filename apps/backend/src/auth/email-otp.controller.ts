import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { EmailOtpService } from './email-otp.service';

const ALLOWED_OTP_TYPES = [
  'email-verification',
  'sign-in',
  'forget-password',
  'change-email',
] as const;

type OtpType = (typeof ALLOWED_OTP_TYPES)[number];

@Controller('api/email-otp')
export class EmailOtpController {
  constructor(private readonly emailOtpService: EmailOtpService) {}

  @AllowAnonymous()
  @Post('send-verification')
  async sendVerification(
    @Body() body: { email?: string; type?: string },
  ): Promise<{ success: boolean }> {
    const email = body?.email?.trim().toLowerCase();
    if (!email) {
      throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
    }

    const type = body?.type;
    if (!type || !ALLOWED_OTP_TYPES.includes(type as OtpType)) {
      throw new HttpException(
        `Invalid OTP type. Must be one of: ${ALLOWED_OTP_TYPES.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.emailOtpService.sendVerificationOtp(email, type as OtpType);
    return { success: true };
  }
}
