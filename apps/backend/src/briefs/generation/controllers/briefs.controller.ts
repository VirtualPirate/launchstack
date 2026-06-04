import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  GenerateBriefSchema,
  ListBriefsQuerySchema,
  type ApiResponse,
  type BriefResponse,
  type GenerateBriefEnqueueResponse,
  type GenerateBriefRequest,
  type ListBriefsQuery,
  type PaginatedBriefs,
} from '@launchstack/api-interfaces';
import {
  OrgMembership,
  type OrgMembershipContext,
} from '../../../organizations/decorators/org-membership.decorator';
import { RequireOrgRole } from '../../../organizations/decorators/require-org-role.decorator';
import { ZodValidationPipe } from '../../../organizations/dto/zod-validation.pipe';
import { BriefsService } from '../services/briefs.service';
import { BriefIdParamSchema, type BriefIdParam } from '../dto/briefs.dto';

@Controller('api/organizations/current/briefs')
export class BriefsController {
  constructor(private readonly briefs: BriefsService) {}

  @Get()
  @RequireOrgRole('member')
  async list(
    @OrgMembership() m: OrgMembershipContext,
    @Query(new ZodValidationPipe(ListBriefsQuerySchema)) q: ListBriefsQuery,
  ): Promise<ApiResponse<PaginatedBriefs>> {
    const data = await this.briefs.list(m.organizationId, q);
    return { data, message: 'OK', success: true };
  }

  @Get(':briefId')
  @RequireOrgRole('member')
  async get(
    @OrgMembership() m: OrgMembershipContext,
    @Param(new ZodValidationPipe(BriefIdParamSchema)) params: BriefIdParam,
  ): Promise<ApiResponse<BriefResponse>> {
    const data = await this.briefs.get(m.organizationId, params.briefId);
    return { data, message: 'OK', success: true };
  }

  @Post('generate')
  @RequireOrgRole('admin')
  @HttpCode(202)
  async generate(
    @OrgMembership() m: OrgMembershipContext,
    @Body(new ZodValidationPipe(GenerateBriefSchema)) body: GenerateBriefRequest,
  ): Promise<ApiResponse<GenerateBriefEnqueueResponse>> {
    const data = await this.briefs.generateAdHoc(m.organizationId, body);
    return { data, message: 'Brief generation enqueued', success: true };
  }
}
