import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import * as express from 'express';
import {
  OrganizationsController,
  MembersController,
  InvitesController,
} from './controllers';
import {
  OrganizationsService,
  MembersService,
  InvitesService,
  InviteMailer,
} from './services';
import {
  OrganizationsRepository,
  OrganizationMembersRepository,
  OrganizationInvitesRepository,
} from './repositories';
import { OrgContextGuard } from './guards/org-context.guard';
import { OrgDeactivationGuard } from './guards/org-deactivation.guard';

@Module({
  controllers: [OrganizationsController, MembersController, InvitesController],
  providers: [
    OrganizationsRepository,
    OrganizationMembersRepository,
    OrganizationInvitesRepository,
    OrganizationsService,
    MembersService,
    InvitesService,
    InviteMailer,
    {
      provide: APP_GUARD,
      useClass: OrgContextGuard,
    },
    // Order matters: Nest runs global guards in registration order, and this
    // one reads the membership OrgContextGuard puts on the request.
    {
      provide: APP_GUARD,
      useClass: OrgDeactivationGuard,
    },
  ],
})
export class OrganizationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(express.json())
      .forRoutes(OrganizationsController, MembersController, InvitesController);
  }
}
