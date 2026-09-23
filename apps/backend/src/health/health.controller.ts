import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import type { ApiResponse, HealthResponse } from '@launchstack/api-interfaces';
import { HealthService } from './health.service';

@Controller('api/health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Readiness: 200 when Postgres and Temporal answer, 503 when either does
   * not. Per-dependency detail is in the body. `passthrough` keeps Nest
   * serializing the return value while we pick the status code.
   */
  @AllowAnonymous()
  @Get()
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<HealthResponse>> {
    const data = await this.health.readiness();
    const healthy = data.status === 'ok';
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { data, message: healthy ? 'OK' : 'Degraded', success: healthy };
  }

  /**
   * Liveness: touches no dependency, so a Postgres or Temporal blip never
   * restarts a healthy API. Point container healthchecks here, never at
   * readiness.
   */
  @AllowAnonymous()
  @Get('live')
  live(): ApiResponse<{ status: 'ok' }> {
    return { data: { status: 'ok' }, message: 'OK', success: true };
  }
}
