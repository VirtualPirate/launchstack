import { HttpException, HttpStatus, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: result.error.format(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return result.data;
  }
}
