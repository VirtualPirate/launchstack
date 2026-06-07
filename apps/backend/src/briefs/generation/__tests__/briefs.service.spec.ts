import { BriefsService } from '../services/briefs.service';

describe('BriefsService.list filter mapping', () => {
  function makeService(listMock: jest.Mock) {
    // Only the briefs repository is exercised by list(); the other six
    // constructor deps are unused on this path.
    return new BriefsService(
      { list: listMock } as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
    );
  }

  it('maps from/to to Date period bounds and passes excludeNoActivity', async () => {
    const listMock = jest.fn().mockResolvedValue([]);
    const service = makeService(listMock);

    await service.list('org1', {
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-07T23:59:59.999Z',
      excludeNoActivity: true,
      limit: 20,
    });

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        periodEndFrom: new Date('2026-06-01T00:00:00.000Z'),
        periodEndTo: new Date('2026-06-07T23:59:59.999Z'),
        excludeNoActivity: true,
      }),
    );
  });

  it('leaves period bounds undefined when from/to absent', async () => {
    const listMock = jest.fn().mockResolvedValue([]);
    const service = makeService(listMock);

    await service.list('org1', { limit: 20 });

    const arg = listMock.mock.calls[0][0];
    expect(arg.periodEndFrom).toBeUndefined();
    expect(arg.periodEndTo).toBeUndefined();
  });
});
