import { Logger } from '@nestjs/common';
import { OrganizationTeardownService } from '../services/organization-teardown.service';

const ORG_ID = '3f1a9c62-2c1f-4f2e-9a52-4b1d0d5f8e11';

function makeClient(
  executions: Array<{ workflowId: string; runId: string }>,
  terminate = jest.fn().mockResolvedValue(undefined),
) {
  return {
    terminate,
    client: {
      workflow: {
        list: jest.fn(() => ({
          async *[Symbol.asyncIterator]() {
            yield* executions;
          },
        })),
        getHandle: jest.fn(() => ({ terminate })),
      },
    } as any,
  };
}

describe('OrganizationTeardownService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it("terminates the org's running workflows, scoped by search attribute", async () => {
    const { client, terminate } = makeClient([
      { workflowId: 'wf-1', runId: 'run-1' },
    ]);

    await new OrganizationTeardownService(client).run(ORG_ID);

    expect(client.workflow.list).toHaveBeenCalledWith({
      query: `OrganizationId = '${ORG_ID}' AND ExecutionStatus = 'Running'`,
    });
    expect(client.workflow.getHandle).toHaveBeenCalledWith('wf-1', 'run-1');
    expect(terminate).toHaveBeenCalledWith(`organization ${ORG_ID} deleted`);
  });

  it('keeps terminating after one workflow fails to terminate', async () => {
    const terminate = jest
      .fn()
      .mockRejectedValueOnce(new Error('already completed'))
      .mockResolvedValue(undefined);
    const { client } = makeClient(
      [
        { workflowId: 'wf-1', runId: 'run-1' },
        { workflowId: 'wf-2', runId: 'run-2' },
      ],
      terminate,
    );

    await expect(
      new OrganizationTeardownService(client).run(ORG_ID),
    ).resolves.toBeUndefined();
    expect(terminate).toHaveBeenCalledTimes(2);
  });

  it('resolves when visibility is down, so the org stays deletable', async () => {
    const client = {
      workflow: {
        list: jest.fn(() => {
          throw new Error('visibility down');
        }),
      },
    } as any;

    await expect(
      new OrganizationTeardownService(client).run(ORG_ID),
    ).resolves.toBeUndefined();
  });
});
