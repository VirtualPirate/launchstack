/**
 * Custom search attribute stamped on every org-scoped workflow start, so an
 * organization's executions can be found (and terminated when it is deleted,
 * see OrganizationTeardownService). Temporal rejects a start carrying an
 * unregistered attribute; SchedulesBootstrap registers it on API boot.
 */
export const SA_ORG = 'OrganizationId';

/**
 * `searchAttributes` for an org-scoped start. System-scoped work passes none.
 * An empty id is a bug, not "system-scoped": the run would still touch that
 * org's rows but be invisible to teardown.
 */
export function orgSearchAttributes(
  organizationId: string,
): Record<string, string[]> {
  if (!organizationId) {
    throw new Error('orgSearchAttributes: organizationId is empty');
  }
  return { [SA_ORG]: [organizationId] };
}
