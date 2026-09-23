import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Client } from '@temporalio/client';
import { SA_ORG, TEMPORAL_CLIENT } from '../../temporal';

/**
 * Releases what an organization holds outside its own rows, before the row is
 * deleted. `organizations` is hard-deleted and children cascade, so after the
 * DELETE nothing is left to find running workflows (or, later, third-party
 * installations) from. Add a step here per external resource.
 *
 * Best-effort: an outage must not make an organization undeletable. A failed
 * step logs at `error` with the org id so it can be cleaned up by hand.
 */
@Injectable()
export class OrganizationTeardownService {
  private readonly logger = new Logger(OrganizationTeardownService.name);

  constructor(@Inject(TEMPORAL_CLIENT) private readonly temporal: Client) {}

  async run(organizationId: string): Promise<void> {
    await this.terminateWorkflows(organizationId);
  }

  /** Every Running execution started with `orgSearchAttributes(organizationId)`. */
  private async terminateWorkflows(organizationId: string): Promise<void> {
    const reason = `organization ${organizationId} deleted`;
    // The id comes from OrgContextGuard (a validated uuid); escape anyway so a
    // stray quote cannot extend the visibility query.
    const query = `${SA_ORG} = '${organizationId.replace(/'/g, "''")}' AND ExecutionStatus = 'Running'`;
    try {
      for await (const wf of this.temporal.workflow.list({ query })) {
        try {
          await this.temporal.workflow
            .getHandle(wf.workflowId, wf.runId)
            .terminate(reason);
        } catch (err) {
          // Most likely it finished between list and terminate.
          this.logger.error(
            `Failed to terminate workflow ${wf.workflowId} for deleted org=${organizationId}: ${describe(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Could not list workflows for org=${organizationId}; running ones will keep retrying against deleted rows: ${describe(err)}`,
      );
    }
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
