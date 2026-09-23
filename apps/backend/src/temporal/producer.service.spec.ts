import type { Client, WorkflowStartOptions } from '@temporalio/client';
import { TemporalProducerService } from './producer.service';

function makeService() {
  const started: Array<{ type: string; opts: WorkflowStartOptions }> = [];
  const client = {
    workflow: {
      start: jest.fn((type: string, opts: WorkflowStartOptions) => {
        started.push({ type, opts });
        return Promise.resolve({ workflowId: opts.workflowId });
      }),
    },
  } as unknown as Client;
  const svc = new TemporalProducerService(client, {
    address: 'x',
    namespace: 'default',
    taskQueue: 'launchstack',
    maxConcurrentActivities: 20,
    maxConcurrentWorkflowTasks: 20,
  });
  return { svc, client, started };
}

describe('TemporalProducerService', () => {
  it('starts a workflow and returns its workflowId', async () => {
    const { svc, started } = makeService();
    const id = await svc.start('NoopWorkflow', {
      args: ['hi'],
      workflowId: 'wf-1',
    });
    expect(id).toBe('wf-1');
    expect(started[0].opts.taskQueue).toBe('launchstack');
    expect(started[0].opts.args).toEqual(['hi']);
  });

  it('startDeduped sets USE_EXISTING conflict policy', async () => {
    const { svc, started } = makeService();
    await svc.startDeduped('NoopWorkflow', {
      args: ['hi'],
      workflowId: 'noop:1',
    });
    expect(started[0].opts.workflowIdConflictPolicy).toBe('USE_EXISTING');
  });

  it('generates a workflowId of the form `${type}:...` when none is supplied', async () => {
    const { svc, started } = makeService();
    await svc.start('NoopWorkflow', { args: ['hi'] });
    expect(started[0].opts.workflowId).toEqual(
      expect.stringMatching(/^NoopWorkflow:/),
    );
  });

  it('startDeduped rejects when no workflowId is supplied', async () => {
    const { svc } = makeService();
    await expect(
      svc.startDeduped('NoopWorkflow', { args: ['hi'] }),
    ).rejects.toThrow('startDeduped requires a workflowId');
  });
});
