import { BriefSchedulesService } from '../services/brief-schedules.service';
import { CadenceService } from '../services/cadence.service';

function makeService() {
  const schedules = {
    listByOrganization: jest.fn(),
    findByIdScopedToOrg: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
  const projects = { findByIdScopedToOrg: jest.fn() };
  const teams = { findByIdScopedToOrg: jest.fn() };
  const collaborators = { findByIdScopedToOrg: jest.fn() };
  const repos = { findByIdScopedToOrg: jest.fn() };
  const slack = { findActiveByOrganizationId: jest.fn() };
  const cadence = new CadenceService();
  const pgBoss = { send: jest.fn().mockResolvedValue('job-id') };
  const svc = new BriefSchedulesService(
    schedules as any,
    projects as any,
    teams as any,
    collaborators as any,
    repos as any,
    slack as any,
    cadence,
    pgBoss as any,
  );
  return {
    svc,
    schedules,
    projects,
    teams,
    collaborators,
    repos,
    slack,
    pgBoss,
  };
}

describe('BriefSchedulesService', () => {
  describe('create', () => {
    it('rejects invalid IANA timezone', async () => {
      const { svc, projects } = makeService();
      projects.findByIdScopedToOrg.mockResolvedValue({ id: 'p1' });
      await expect(
        svc.create('org-1', 'user-1', {
          name: 'Test',
          cadence: { type: 'daily', time: '16:00' },
          timezone: 'Mars/Phobos',
          scope: { type: 'project', projectId: 'p1' },
          delivery: {},
        }),
      ).rejects.toMatchObject({ code: 'BRIEF_SCHEDULE_INVALID_TIMEZONE' });
    });

    it('rejects weekly cadence without dayOfWeek (defense in depth past zod)', async () => {
      const { svc, projects } = makeService();
      projects.findByIdScopedToOrg.mockResolvedValue({ id: 'p1' });
      await expect(
        svc.create('org-1', 'user-1', {
          name: 'Test',
          cadence: { type: 'weekly', time: '16:00' } as any,
          timezone: 'UTC',
          scope: { type: 'project', projectId: 'p1' },
          delivery: {},
        }),
      ).rejects.toMatchObject({ code: 'BRIEF_SCHEDULE_INVALID_CADENCE' });
    });

    it('rejects when scope project is not in org', async () => {
      const { svc, projects } = makeService();
      projects.findByIdScopedToOrg.mockResolvedValue(null);
      await expect(
        svc.create('org-1', 'user-1', {
          name: 'Test',
          cadence: { type: 'daily', time: '16:00' },
          timezone: 'UTC',
          scope: { type: 'project', projectId: 'p1' },
          delivery: {},
        }),
      ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    });

    it('rejects slack delivery without active installation', async () => {
      const { svc, projects, slack } = makeService();
      projects.findByIdScopedToOrg.mockResolvedValue({ id: 'p1' });
      slack.findActiveByOrganizationId.mockResolvedValue(null);
      await expect(
        svc.create('org-1', 'user-1', {
          name: 'Test',
          cadence: { type: 'daily', time: '16:00' },
          timezone: 'UTC',
          scope: { type: 'project', projectId: 'p1' },
          delivery: { slackChannelId: 'C123' },
        }),
      ).rejects.toMatchObject({ code: 'SLACK_INSTALLATION_NOT_FOUND' });
    });

    it('persists with computed next_run_at when valid', async () => {
      const { svc, projects, schedules } = makeService();
      projects.findByIdScopedToOrg.mockResolvedValue({ id: 'p1' });
      schedules.create.mockImplementation(async (input: any) => ({
        ...input,
        id: 'sch1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        lastSentAt: null,
        paused: false,
        slackInstallationId: null,
        slackChannelId: null,
      }));
      jest.useFakeTimers().setSystemTime(new Date('2026-05-26T10:00:00Z'));
      const out = await svc.create('org-1', 'user-1', {
        name: 'Test',
        cadence: { type: 'daily', time: '16:00' },
        timezone: 'UTC',
        scope: { type: 'project', projectId: 'p1' },
        delivery: { emails: ['a@b.com'] },
      });
      expect(out.nextRunAt).toBe('2026-05-26T16:00:00.000Z');
      jest.useRealTimers();
    });

    it('enqueues a backfill job for the new schedule', async () => {
      const { svc, projects, schedules, pgBoss } = makeService();
      projects.findByIdScopedToOrg.mockResolvedValue({ id: 'p1' });
      schedules.create.mockImplementation(async (input: any) => ({
        ...input,
        id: 'sch-new',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        lastSentAt: null,
        paused: false,
        slackInstallationId: null,
        slackChannelId: null,
      }));
      jest.useFakeTimers().setSystemTime(new Date('2026-05-26T10:00:00Z'));
      await svc.create('org-1', 'user-1', {
        name: 'Test',
        cadence: { type: 'daily', time: '16:00' },
        timezone: 'UTC',
        scope: { type: 'project', projectId: 'p1' },
        delivery: {},
      });
      jest.useRealTimers();
      expect(pgBoss.send).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'briefs.backfill' }),
        { scheduleId: 'sch-new' },
      );
    });
  });

  describe('resume', () => {
    it('recomputes next_run_at from now()', async () => {
      const { svc, schedules } = makeService();
      schedules.findByIdScopedToOrg.mockResolvedValue({
        id: 'sch1',
        organizationId: 'org-1',
        name: 'T',
        paused: true,
        cadenceType: 'daily',
        cadenceTime: '16:00',
        cadenceDayOfWeek: null,
        cadenceDayOfMonth: null,
        timezone: 'UTC',
        scopeType: 'project',
        scopeProjectId: 'p1',
        scopeTeamId: null,
        scopeCollaboratorId: null,
        scopeRepositoryId: null,
        nextRunAt: new Date('2026-05-20T16:00:00Z'),
        lastSentAt: null,
        emailRecipients: [],
        slackInstallationId: null,
        slackChannelId: null,
        createdByMemberId: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      schedules.update.mockImplementation(async (_id: string, patch: any) => ({
        id: 'sch1',
        organizationId: 'org-1',
        name: 'T',
        paused: patch.paused ?? false,
        cadenceType: 'daily',
        cadenceTime: '16:00',
        cadenceDayOfWeek: null,
        cadenceDayOfMonth: null,
        timezone: 'UTC',
        scopeType: 'project',
        scopeProjectId: 'p1',
        scopeTeamId: null,
        scopeCollaboratorId: null,
        scopeRepositoryId: null,
        nextRunAt: patch.nextRunAt,
        lastSentAt: null,
        emailRecipients: [],
        slackInstallationId: null,
        slackChannelId: null,
        createdByMemberId: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }));
      jest.useFakeTimers().setSystemTime(new Date('2026-05-26T09:00:00Z'));
      const out = await svc.resume('org-1', 'sch1');
      expect(out.paused).toBe(false);
      expect(out.nextRunAt).toBe('2026-05-26T16:00:00.000Z');
      jest.useRealTimers();
    });
  });
});
