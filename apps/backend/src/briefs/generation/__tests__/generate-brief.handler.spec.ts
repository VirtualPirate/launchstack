import { GenerateBriefHandler } from '../handlers/generate-brief.handler';

function makeHandler() {
  const briefs = { findById: jest.fn(), update: jest.fn() };
  const cadence = {
    formatPeriodLabel: jest.fn().mockReturnValue('May 19 – May 25, 2026'),
  };
  const generator = { generate: jest.fn() };
  const deliverer = { deliver: jest.fn().mockResolvedValue(undefined) };
  const handler = new GenerateBriefHandler(
    briefs as any,
    generator as any,
    cadence as any,
    deliverer as any,
  );
  return { handler, briefs, generator, deliverer };
}

const briefRow = {
  id: 'b1',
  organizationId: 'o1',
  briefScheduleId: null,
  scopeType: 'project',
  scopeProjectId: 'p1',
  scopeTeamId: null,
  scopeCollaboratorId: null,
  scopeRepositoryId: null,
  periodStart: new Date('2026-05-19T00:00:00Z'),
  periodEnd: new Date('2026-05-25T23:59:59Z'),
  status: 'pending',
};

describe('GenerateBriefHandler.handle', () => {
  it('exits early if brief status is not pending or failed', async () => {
    const { handler, briefs } = makeHandler();
    briefs.findById.mockResolvedValue({ ...briefRow, status: 'delivered' });
    await handler.handle({
      id: 'job1',
      data: { briefId: 'b1' },
      attempts: 1,
      raw: {} as any,
    });
    expect(briefs.update).not.toHaveBeenCalled();
  });

  it('marks failed with SCOPE_DELETED if generator throws', async () => {
    const { handler, briefs, generator } = makeHandler();
    briefs.findById.mockResolvedValue(briefRow);
    generator.generate.mockRejectedValue(
      new Error('SCOPE_DELETED: project missing'),
    );
    await expect(
      handler.handle({
        id: 'job1',
        data: { briefId: 'b1' },
        attempts: 1,
        raw: {} as any,
      }),
    ).resolves.toBeUndefined();
    expect(briefs.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        status: 'failed',
        failureReason: expect.stringContaining('SCOPE_DELETED'),
      }),
    );
  });

  it('writes generated brief and invokes deliverer for non-empty period', async () => {
    const { handler, briefs, generator, deliverer } = makeHandler();
    briefs.findById.mockResolvedValue(briefRow);
    generator.generate.mockResolvedValue({
      kind: 'generated',
      scopeLabel: 'Project: P',
      title: 'T',
      summary: 'S',
      contributorCount: 2,
      commitCount: 5,
      model: 'gpt-x',
      promptTokens: 100,
      completionTokens: 30,
    });
    await handler.handle({
      id: 'job1',
      data: { briefId: 'b1' },
      attempts: 1,
      raw: {} as any,
    });
    expect(briefs.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        status: 'generated',
        title: 'T',
        summary: 'S',
        contributorCount: 2,
        commitCount: 5,
      }),
    );
    expect(deliverer.deliver).toHaveBeenCalledWith('b1');
  });

  it('writes "no activity" brief for empty period and still delivers', async () => {
    const { handler, briefs, generator, deliverer } = makeHandler();
    briefs.findById.mockResolvedValue(briefRow);
    generator.generate.mockResolvedValue({
      kind: 'empty',
      scopeLabel: 'Project: P',
      contributorCount: 0,
      commitCount: 0,
    });
    await handler.handle({
      id: 'job1',
      data: { briefId: 'b1' },
      attempts: 1,
      raw: {} as any,
    });
    expect(briefs.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        status: 'generated',
        summary: 'No activity in this period.',
      }),
    );
    expect(deliverer.deliver).toHaveBeenCalledWith('b1');
  });

  it('skips delivery and stays at status "generated" when deliver=false', async () => {
    const { handler, briefs, generator, deliverer } = makeHandler();
    briefs.findById.mockResolvedValue(briefRow);
    generator.generate.mockResolvedValue({
      kind: 'generated',
      scopeLabel: 'Project: P',
      title: 'T',
      summary: 'S',
      contributorCount: 2,
      commitCount: 5,
      model: 'gpt-x',
      promptTokens: 100,
      completionTokens: 30,
    });
    await handler.handle({
      id: 'job1',
      data: { briefId: 'b1', deliver: false },
      attempts: 1,
      raw: {} as any,
    });
    expect(briefs.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ status: 'generated', title: 'T' }),
    );
    expect(deliverer.deliver).not.toHaveBeenCalled();
  });

  it('delivers by default when deliver is omitted', async () => {
    const { handler, briefs, generator, deliverer } = makeHandler();
    briefs.findById.mockResolvedValue(briefRow);
    generator.generate.mockResolvedValue({
      kind: 'generated',
      scopeLabel: 'Project: P',
      title: 'T',
      summary: 'S',
      contributorCount: 1,
      commitCount: 1,
      model: 'gpt-x',
      promptTokens: 10,
      completionTokens: 5,
    });
    await handler.handle({
      id: 'job1',
      data: { briefId: 'b1' },
      attempts: 1,
      raw: {} as any,
    });
    expect(deliverer.deliver).toHaveBeenCalledWith('b1');
  });

  it('rethrows when LLM fails (pg-boss retries handle the rest)', async () => {
    const { handler, briefs, generator } = makeHandler();
    briefs.findById.mockResolvedValue(briefRow);
    generator.generate.mockRejectedValue(new Error('OpenAI down'));
    await expect(
      handler.handle({
        id: 'job1',
        data: { briefId: 'b1' },
        attempts: 1,
        raw: {} as any,
      }),
    ).rejects.toThrow('OpenAI down');
    expect(briefs.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ status: 'failed' }),
    );
  });
});
