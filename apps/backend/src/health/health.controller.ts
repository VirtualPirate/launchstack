import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { ApiResponse } from '@launchstack/api-interfaces';

@Controller('api/health')
export class HealthController {
  /**
   * Liveness: touches no dependency, so a Postgres or Temporal blip never
   * restarts a healthy API. Point container healthchecks here.
   */
  @AllowAnonymous()
  @Get('live')
  live(): ApiResponse<{ status: 'ok' }> {
    return { data: { status: 'ok' }, message: 'OK', success: true };
  }
}
