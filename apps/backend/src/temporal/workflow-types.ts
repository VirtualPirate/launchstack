export const WORKFLOW = {
  noop: 'NoopWorkflow',
} as const;

export type WorkflowType = (typeof WORKFLOW)[keyof typeof WORKFLOW];
