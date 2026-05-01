import { SetMetadata } from '@nestjs/common';
import type { z } from 'zod';
import type { JobDefinition } from './define-job';
import { HANDLER_METADATA_KEY } from './pg-boss.tokens';

export const Handler = <T extends z.ZodTypeAny>(
  jobDef: JobDefinition<T>,
): MethodDecorator => SetMetadata(HANDLER_METADATA_KEY, jobDef);
