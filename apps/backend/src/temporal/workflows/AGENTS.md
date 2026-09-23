# AGENTS.md — `src/temporal/workflows/`

Parent doc: [backend AGENTS.md](../../../AGENTS.md), "Background jobs (Temporal)". That section covers topology, the producer API and how to add a job. This file covers the rules for workflow code itself.

## What lives here

Temporal **workflow definitions**: pure, deterministic TypeScript that `src/worker.ts` loads into the workflow sandbox. They orchestrate. They never touch the DB, the network or NestJS.

- `activity-proxies.ts` — shared `proxyActivities` retry profiles.
- `index.ts` — barrel. The worker registers this module as `workflowsPath`, so it only sees what the barrel exports.
- `*.workflow.ts` — one workflow per file.

Activity implementations live next to the feature they belong to (for example `src/queue/`), discovered via `@Activity('name')`. Their signatures are typed once in `../activities.interface.ts` (`Activities`). That interface is the contract this directory codes against.

## Retry profiles (`activity-proxies.ts`)

| Proxy | Timeout | `maximumAttempts` | `initialInterval` | Backoff | Use for |
| --- | --- | --- | --- | --- | --- |
| `standard` | 10 min | 4 | 30s | ×2 | Default for idempotent activities |
| `once` | 5 min | 1 | — | — | No retry: smoke tests, or work a retry would race (for example a claim that advances a `nextRunAt` inside a `FOR UPDATE` transaction) |

Reuse the closest profile. Add a new one only when the difference is real.

**Heartbeats get their own profile.** Put `heartbeatTimeout` only on a proxy whose activities all call `heartbeat()`. An activity that never heartbeats fails as soon as the timeout elapses, so adding `heartbeatTimeout` to `standard` breaks every activity on it. A long activity that pages through work of unbounded size (bounded by data size, not a fixed slice) needs this: heartbeat per page, set `heartbeatTimeout` to a few minutes, and treat `startToCloseTimeout` as a backstop only (for example 2 hours). Under a fixed 10-minute timeout, a big enough input is killed and retried from page 1 forever.

Moving a call site from one profile to another changes timeouts only (same activity type, same call site), so in-flight executions replay fine.

## Rules when editing this directory

- **No NestJS, no DB, no `fetch`, no `Date.now()`/`Math.random()` in workflow code.** Workflow code is replayed. Only activities may be non-deterministic. Non-determinism breaks executions already running, not just new ones.
- **Changing a workflow's shape is a versioning problem.** In-flight executions replay against the new code. For anything beyond additive optional input fields, gate the new path with `patched('change-id')`, then later `deprecatePatch('change-id')` once no old execution remains, or start a new workflow type.
- **Adding an activity:** add its signature to `../activities.interface.ts`, implement it as an `@Activity('name')` method on a DI provider in the owning feature module, then call it through a proxy from `activity-proxies.ts`.
- **Adding a workflow:** create the file, export it from `index.ts`, and add a key to `../workflow-types.ts` `WORKFLOW` so callers use that const, not a string literal.
- **`ParentClosePolicy.ABANDON` on every `startChild` from a dispatcher.** A parent that fans out work is a dispatcher, not a supervisor: its completion must not cancel in-flight children.
- **Fan-out uses `Promise.allSettled`** when partial failure is acceptable and the activity records its own failure. Use `Promise.all` only when one failure should abort the run.
- **Bound history.** Any unbounded fan-out or loop needs `continueAsNew` after a fixed page size. Temporal terminates a run whose history grows past its limits.
- **Bound the argument too.** `continueAsNew` carrying a list that grows with the data hits the 2 MB payload cap eventually. Carry a cursor and re-query in the next run.

## Testing

Orchestration tests use `@temporalio/testing`'s time-skipping `TestWorkflowEnvironment` with mocked activities. They assert control flow (which activities ran, in what order, whether a child started, where `continueAsNew` fires), not business logic. Test activity logic separately as plain NestJS providers.

```ts
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { MyWorkflow } from '../my.workflow';

jest.setTimeout(60_000);

let env: TestWorkflowEnvironment;
beforeAll(async () => {
  env = await TestWorkflowEnvironment.createTimeSkipping();
});
afterAll(async () => {
  await env?.teardown();
});

it('calls the activity once', async () => {
  const calls: string[] = [];
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue: 'test',
    workflowsPath: require.resolve('../my.workflow'),
    activities: { 'feature.action': async (x: string) => void calls.push(x) },
  });
  await worker.runUntil(
    env.client.workflow.execute(MyWorkflow, {
      taskQueue: 'test',
      workflowId: 'my-1', // unique per case, or the start fails as already started
      args: ['hello'],
    }),
  );
  expect(calls).toEqual(['hello']);
});
```

`sleep()` inside the workflow completes instantly under time skipping. Put these specs in `__tests__/` here and run them with `pnpm exec jest --testPathPatterns=workflows`.

Run the worker locally with `pnpm start:worker:dev` (the API process runs no worker) and watch executions in the Temporal UI at http://localhost:8080.
