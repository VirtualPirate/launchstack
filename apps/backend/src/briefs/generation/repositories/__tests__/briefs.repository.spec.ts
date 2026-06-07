import { BriefsRepository } from '../briefs.repository';

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
