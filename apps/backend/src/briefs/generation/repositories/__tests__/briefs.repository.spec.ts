import { BriefsRepository } from '../briefs.repository';

describe('BriefsRepository.list', () => {
  function makeChain(rows: unknown[]) {
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve(rows),
            }),
          }),
        }),
      }),
    };
  }

  it('returns rows without cursor condition when no cursor provided', async () => {
    const rows = [{ id: 'a', createdAt: new Date() }];
    const repo = new BriefsRepository(makeChain(rows) as never);
    const result = await repo.list({ organizationId: 'org1', limit: 10 });
    expect(result).toEqual(rows);
  });

  it('returns rows when cursor is provided', async () => {
    const rows = [{ id: 'b', createdAt: new Date('2026-06-01T00:00:00Z') }];
    const repo = new BriefsRepository(makeChain(rows) as never);
    const result = await repo.list({
      organizationId: 'org1',
      limit: 10,
      cursorPeriodEnd: new Date('2026-06-07T16:16:38.264Z'),
      cursorId: 'e2861e81-15d2-46ac-b291-f152b7af2668',
    });
    expect(result).toEqual(rows);
  });

  it('builds query with date range and excludeNoActivity filters', async () => {
    const rows = [{ id: 'c', createdAt: new Date() }];
    const repo = new BriefsRepository(makeChain(rows) as never);
    const result = await repo.list({
      organizationId: 'org1',
      limit: 10,
      periodEndFrom: new Date('2026-06-01T00:00:00Z'),
      periodEndTo: new Date('2026-06-07T23:59:59Z'),
      excludeNoActivity: true,
    });
    expect(result).toEqual(rows);
  });
});

describe('BriefsRepository.findPeriodStartsForSchedule', () => {
  it('returns a Set of periodStart epoch-millis', async () => {
    const a = new Date('2026-05-18T00:00:00Z');
    const b = new Date('2026-05-25T00:00:00Z');
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([{ periodStart: a }, { periodStart: b }]),
        }),
      }),
    };
    const repo = new BriefsRepository(fakeDb as never);
    const out = await repo.findPeriodStartsForSchedule(
      'sch1',
      new Date('2025-06-06T00:00:00Z'),
    );
    expect(out.has(a.getTime())).toBe(true);
    expect(out.has(b.getTime())).toBe(true);
    expect(out.size).toBe(2);
  });
});
